import { useState, useMemo } from 'react';
import {
  Wheat,
  Search,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  PackagePlus,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import {
  type Product,
  KG_PER_SACK,
  splitRiceKg,
  formatRiceStock,
  formatPeso,
  roundNum,
} from '../types';
import {
  saveProduct,
  deleteProduct,
  restockProductTransaction,
} from '../db';

interface RiceViewProps {
  uid: string;
  riceProducts: Product[];
}

export function RiceView({ uid, riceProducts }: RiceViewProps) {
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Restock modal state (Sacks + Extra kg together)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockSacksInput, setRestockSacksInput] = useState('0');
  const [restockExtraKgInput, setRestockExtraKgInput] = useState('0');

  // Add / Edit Rice modal state (Sacks + Extra kg together, Low alert in sacks)
  const [formOpen, setFormOpen] = useState(false);
  const [editingRice, setEditingRice] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockSacksInput, setStockSacksInput] = useState('1');
  const [stockExtraKgInput, setStockExtraKgInput] = useState('0');
  const [lowAlertSacksInput, setLowAlertSacksInput] = useState('2');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filteredRice = useMemo(() => {
    const q = search.trim().toLowerCase();
    return riceProducts.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [riceProducts, search]);

  const stats = useMemo(() => {
    let totalKg = 0;
    let lowOrOut = 0;
    let totalValue = 0;
    for (const p of riceProducts) {
      totalKg += p.stock;
      if (p.stock <= p.lowStockThreshold) lowOrOut++;
      totalValue += p.stock * p.price;
    }
    return {
      totalKg: roundNum(totalKg, 2),
      lowOrOut,
      totalValue: roundNum(totalValue),
    };
  }, [riceProducts]);

  const openAddRice = () => {
    setEditingRice(null);
    setName('');
    setPrice('');
    setCostPrice('');
    setStockSacksInput('1');
    setStockExtraKgInput('0');
    setLowAlertSacksInput('2');
    setFormOpen(true);
  };

  const openEditRice = (p: Product) => {
    setEditingRice(p);
    setName(p.name);
    setPrice(String(p.price));
    setCostPrice(p.costPrice ? String(p.costPrice) : '');
    const { sacks, extraKg } = splitRiceKg(p.stock);
    setStockSacksInput(String(sacks));
    setStockExtraKgInput(String(extraKg));
    setLowAlertSacksInput(String(roundNum(p.lowStockThreshold / KG_PER_SACK, 2)));
    setFormOpen(true);
  };

  const computedFormKg = roundNum(
    Math.max(0, parseFloat(stockSacksInput) || 0) * KG_PER_SACK +
      Math.max(0, parseFloat(stockExtraKgInput) || 0),
    2
  );

  const computedLowAlertKg = roundNum(
    Math.max(0, parseFloat(lowAlertSacksInput) || 0) * KG_PER_SACK,
    2
  );

  const handleSaveRice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const numPrice = parseFloat(price);
    const numCost = parseFloat(costPrice) || 0;

    if (!cleanName || isNaN(numPrice) || numPrice < 0) return;

    const payload: Omit<Product, 'id'> = {
      name: cleanName,
      category: 'Rice',
      unit: 'kg',
      price: roundNum(numPrice),
      costPrice: roundNum(numCost),
      stock: computedFormKg,
      lowStockThreshold: computedLowAlertKg,
      updatedAt: Date.now(),
    };

    try {
      await saveProduct(uid, payload, editingRice?.id);
      setFormOpen(false);
      showToast(editingRice ? 'Rice variety updated!' : 'Rice variety added!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save rice variety.';
      window.alert(
        msg.includes('permission') || msg.includes('PERMISSION_DENIED')
          ? 'Permission denied by Firestore. Make sure you published firestore.rules in Firebase Console!'
          : `Could not save rice: ${msg}`
      );
    }
  };

  const handleDeleteRice = async () => {
    if (!editingRice?.id) return;
    if (!window.confirm(`Delete "${editingRice.name}" from Rice inventory?`)) return;
    try {
      await deleteProduct(uid, editingRice.id);
      setFormOpen(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete rice variety.');
    }
  };

  const openRestock = (rice: Product) => {
    setRestockProduct(rice);
    setRestockSacksInput('0');
    setRestockExtraKgInput('0');
  };

  const computedRestockKg = roundNum(
    Math.max(0, parseFloat(restockSacksInput) || 0) * KG_PER_SACK +
      Math.max(0, parseFloat(restockExtraKgInput) || 0),
    2
  );

  const handleConfirmRestock = async (addKg: number) => {
    if (!restockProduct || isNaN(addKg) || addKg <= 0) return;
    try {
      await restockProductTransaction(uid, restockProduct, addKg);
      showToast(`Added +${formatRiceStock(addKg)} to ${restockProduct.name}`);
      setRestockProduct(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to restock rice.');
    }
  };

  return (
    <div className="flex flex-col pb-24">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Search + Add Rice Sticky Bar */}
      <div className="sticky top-14 z-20 bg-amber-50/95 backdrop-blur-sm px-4 py-3 border-b border-amber-200/80">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-amber-600/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rice variety (e.g. Dinorado)..."
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={openAddRice}
            className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Rice
          </button>
        </div>
      </div>

      {/* RICE STOCK BODY */}
      <div className="px-4 pt-3 space-y-3">
        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white border border-amber-200/80 rounded-2xl p-3">
            <div className="text-[11px] font-medium text-slate-500">Total Rice</div>
            <div className="text-sm font-extrabold text-amber-900 mt-0.5 leading-snug">
              {formatRiceStock(stats.totalKg)}
            </div>
            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
              {stats.totalKg} kg total
            </div>
          </div>

          <div
            className={`border rounded-2xl p-3 ${
              stats.lowOrOut > 0
                ? 'bg-orange-50 border-orange-200'
                : 'bg-white border-amber-200/80'
            }`}
          >
            <div className="text-[11px] font-medium text-orange-800 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Low / Out
            </div>
            <div className="text-lg font-extrabold text-orange-900 mt-0.5">
              {stats.lowOrOut}
            </div>
          </div>

          <div className="bg-white border border-amber-200/80 rounded-2xl p-3">
            <div className="text-[11px] font-medium text-slate-500">Stock Value</div>
            <div className="text-sm font-extrabold text-amber-800 mt-1 truncate">
              {formatPeso(stats.totalValue)}
            </div>
          </div>
        </div>

        {/* Rice Stock List */}
        {filteredRice.length === 0 ? (
          <div className="text-center py-14 text-slate-500">
            <Wheat className="w-10 h-10 mx-auto mb-2 text-amber-300" />
            <p className="text-sm font-medium">No rice varieties found</p>
            <button
              onClick={openAddRice}
              className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold"
            >
              + Add Rice Variety
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredRice.map((rice) => {
              const isOut = rice.stock <= 0;
              const isLow = !isOut && rice.stock <= rice.lowStockThreshold;
              const alertSacks = roundNum(rice.lowStockThreshold / KG_PER_SACK, 2);

              return (
                <div
                  key={rice.id}
                  className="bg-white border border-amber-200/80 rounded-2xl p-3.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm">{rice.name}</h3>
                      <div className="text-xs text-slate-500 mt-1">
                        Sell: <strong className="text-amber-800">{formatPeso(rice.price)}</strong>/kg
                        {rice.costPrice > 0 && (
                          <span className="ml-2 text-slate-400">
                            (Cost: {formatPeso(rice.costPrice)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-xl text-xs font-bold ${
                          isOut
                            ? 'bg-red-100 text-red-700'
                            : isLow
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : formatRiceStock(rice.stock)}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Alert ≤ {alertSacks} sack{alertSacks === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <button
                      onClick={() => openRestock(rice)}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Restock (+)
                    </button>
                    <button
                      onClick={() => openEditRice(rice)}
                      className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rice Restock Modal (Sacks + Extra kg at the same time) */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-7 shadow-2xl space-y-3.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  Restock Rice (Bigas)
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {restockProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Current Stock:{' '}
                  <strong className="text-slate-800">
                    {formatRiceStock(restockProduct.stock)}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setRestockProduct(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Tap Sack Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '+1 Sack\n(25 kg)', kg: 25 },
                { label: '+2 Sacks\n(50 kg)', kg: 50 },
                { label: '+3 Sacks\n(75 kg)', kg: 75 },
                { label: '+5 Sacks\n(125 kg)', kg: 125 },
              ].map((opt) => (
                <button
                  key={opt.kg}
                  onClick={() => handleConfirmRestock(opt.kg)}
                  className="py-2.5 px-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-bold text-xs whitespace-pre-line active:scale-95"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Combined Sacks + Extra kg inputs */}
            <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
              <div className="text-xs font-semibold text-slate-600">
                Or enter sacks + extra kilos together:
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Add Sacks (25 kg)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    value={restockSacksInput}
                    onChange={(e) => setRestockSacksInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    + Extra kg
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    inputMode="decimal"
                    value={restockExtraKgInput}
                    onChange={(e) => setRestockExtraKgInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {computedRestockKg > 0 && (
                <p className="text-xs text-slate-500">
                  Adding <strong className="text-amber-800">+{formatRiceStock(computedRestockKg)}</strong>{' '}
                  → New stock:{' '}
                  <strong className="text-slate-900">
                    {formatRiceStock(roundNum(restockProduct.stock + computedRestockKg, 2))}
                  </strong>
                </p>
              )}

              <button
                type="button"
                disabled={computedRestockKg <= 0}
                onClick={() => handleConfirmRestock(computedRestockKg)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm"
              >
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Rice Modal (Sacks + Extra kg together, Low alert in Sacks) */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <form
            onSubmit={handleSaveRice}
            className="bg-white w-full max-w-md rounded-t-3xl max-h-[92vh] overflow-y-auto p-5 pb-7 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingRice ? 'Edit Rice Variety' : 'Add Rice Variety'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Rice Variety Name *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dinorado, Sinandomeng, Ganador"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Selling Price (₱ / kg) *
                </label>
                <input
                  required
                  type="number"
                  step="0.25"
                  min="0"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 58"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Cost Price (₱ / kg)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  inputMode="decimal"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Combined Sacks + Extra kg Current Stock */}
            <div className="space-y-2 bg-amber-50/60 p-3 rounded-2xl border border-amber-200/70">
              <div className="text-xs font-semibold text-slate-700">
                Current Stock (Sacks + Extra kg) *
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Sacks (25 kg)
                  </label>
                  <input
                    required
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    value={stockSacksInput}
                    onChange={(e) => setStockSacksInput(e.target.value)}
                    placeholder="e.g. 2"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    + Extra kg
                  </label>
                  <input
                    required
                    type="number"
                    step="0.25"
                    min="0"
                    inputMode="decimal"
                    value={stockExtraKgInput}
                    onChange={(e) => setStockExtraKgInput(e.target.value)}
                    placeholder="e.g. 21"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="text-[11px] text-amber-800 font-semibold">
                Total stock: {computedFormKg} kg
              </div>
            </div>

            {/* Low Stock Alert in Sacks */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Low Stock Alert (sacks)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  inputMode="decimal"
                  value={lowAlertSacksInput}
                  onChange={(e) => setLowAlertSacksInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs font-semibold text-slate-500 shrink-0">
                  = {computedLowAlertKg} kg
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {editingRice && (
                <button
                  type="button"
                  onClick={handleDeleteRice}
                  className="px-4 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-sm"
              >
                {editingRice ? 'Save Changes' : 'Add Rice Variety'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
