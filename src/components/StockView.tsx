import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit3,
  PackagePlus,
  AlertTriangle,
  X,
  Trash2,
} from 'lucide-react';
import {
  type Product,
  type StoreCategory,
  type UnitType,
  SARI_SARI_CATEGORIES,
  SARI_SARI_UNITS,
  formatPeso,
  formatQty,
  roundNum,
} from '../types';
import { saveProduct, deleteProduct, restockProductTransaction } from '../db';

interface StockViewProps {
  uid: string;
  products: Product[];
}

type StockFilter = 'All' | 'Low' | Exclude<StoreCategory, 'Rice'>;

export function StockView({ uid, products }: StockViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('All');

  // Restock modal state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState('');

  // Add/Edit product modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Exclude<StoreCategory, 'Rice'>>('Sari-Sari');
  const [unit, setUnit] = useState<Exclude<UnitType, 'kg'>>('pc');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  const stats = useMemo(() => {
    let lowCount = 0;
    let outCount = 0;
    let totalValue = 0;
    for (const p of products) {
      if (p.stock <= 0) outCount++;
      else if (p.stock <= p.lowStockThreshold) lowCount++;
      totalValue += p.stock * p.price;
    }
    return { lowCount, outCount, totalValue: roundNum(totalValue) };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (filter === 'Low' && p.stock > p.lowStockThreshold) return false;
        if (filter !== 'All' && filter !== 'Low' && p.category !== filter) return false;
        if (q && !p.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (filter === 'Low') return a.stock - b.stock;
        return a.name.localeCompare(b.name);
      });
  }, [products, search, filter]);

  const openAddForm = () => {
    setEditingProduct(null);
    setName('');
    setCategory('Sari-Sari');
    setUnit('pc');
    setPrice('');
    setCostPrice('');
    setStock('');
    setLowStockThreshold('5');
    setFormOpen(true);
  };

  const openEditForm = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category === 'Rice' ? 'Sari-Sari' : p.category);
    setUnit(p.unit === 'kg' ? 'pc' : p.unit);
    setPrice(String(p.price));
    setCostPrice(p.costPrice ? String(p.costPrice) : '');
    setStock(String(p.stock));
    setLowStockThreshold(String(p.lowStockThreshold));
    setFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const numPrice = parseFloat(price);
    const numCost = parseFloat(costPrice) || 0;
    const numStock = parseFloat(stock) || 0;
    const numLow = parseFloat(lowStockThreshold) || 5;

    if (!cleanName || isNaN(numPrice) || numPrice < 0) return;

    const payload: Omit<Product, 'id'> = {
      name: cleanName,
      category,
      unit,
      price: roundNum(numPrice),
      costPrice: roundNum(numCost),
      stock: Math.max(0, roundNum(numStock, 2)),
      lowStockThreshold: Math.max(0, roundNum(numLow, 2)),
      updatedAt: Date.now(),
    };

    try {
      await saveProduct(uid, payload, editingProduct?.id);
      setFormOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save item.';
      window.alert(
        msg.includes('permission') || msg.includes('PERMISSION_DENIED')
          ? 'Permission denied by Firestore. Make sure you published firestore.rules in Firebase Console!'
          : `Could not save item: ${msg}`
      );
    }
  };

  const handleDeleteProduct = async () => {
    if (!editingProduct?.id) return;
    if (!window.confirm(`Delete "${editingProduct.name}" from inventory?`)) return;
    try {
      await deleteProduct(uid, editingProduct.id);
      setFormOpen(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete item.');
    }
  };

  const openRestock = (p: Product) => {
    setRestockProduct(p);
    setRestockAmount('12');
  };

  const handleConfirmRestock = async (addQty: number) => {
    if (!restockProduct || isNaN(addQty) || addQty <= 0) return;
    try {
      await restockProductTransaction(uid, restockProduct, addQty);
      setRestockProduct(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to restock item.');
    }
  };

  return (
    <div className="flex flex-col pb-24">
      {/* Summary KPI Strip */}
      <div className="px-4 pt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => setFilter('All')}
          className="bg-white border border-slate-200 rounded-2xl p-3 text-left shadow-2xs"
        >
          <div className="text-[11px] font-medium text-slate-500">Sari-Sari Items</div>
          <div className="text-lg font-extrabold text-slate-900 mt-0.5">{products.length}</div>
        </button>

        <button
          onClick={() => setFilter('Low')}
          className={`border rounded-2xl p-3 text-left shadow-2xs ${
            stats.lowCount + stats.outCount > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Low / Out
          </div>
          <div className="text-lg font-extrabold text-amber-900 mt-0.5">
            {stats.lowCount + stats.outCount}
          </div>
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 text-left shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Stock Value</div>
          <div className="text-sm font-extrabold text-teal-800 mt-1 truncate">
            {formatPeso(stats.totalValue)}
          </div>
        </div>
      </div>

      {/* Search + Add Button + Filter Pills */}
      <div className="sticky top-14 z-20 bg-slate-50/95 backdrop-blur-sm pt-3 pb-2 px-4 border-b border-slate-200/80">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sari-sari stock..."
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
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
            onClick={openAddForm}
            className="px-3.5 py-2.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-2.5 pb-1">
          <button
            onClick={() => setFilter('All')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              filter === 'All'
                ? 'bg-teal-700 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('Low')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              filter === 'Low'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            Low Stock ({stats.lowCount + stats.outCount})
          </button>
          {SARI_SARI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                filter === cat.id
                  ? 'bg-teal-700 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock List */}
      <div className="px-4 pt-3 space-y-2.5">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No matching sari-sari items in stock.
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isOut = p.stock <= 0;
            const isLow = !isOut && p.stock <= p.lowStockThreshold;

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {p.category}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">
                      {p.name}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      Sell: <strong className="text-teal-800">{formatPeso(p.price)}</strong>/{p.unit}
                      {p.costPrice > 0 && (
                        <span className="ml-2 text-slate-400">
                          (Cost: {formatPeso(p.costPrice)})
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
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isOut ? 'Out of Stock' : formatQty(p.stock, p.unit)}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Alert ≤ {p.lowStockThreshold} {p.unit}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-2.5 border-t border-slate-100">
                  <button
                    onClick={() => openRestock(p)}
                    className="flex-1 py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    Restock (+)
                  </button>
                  <button
                    onClick={() => openEditForm(p)}
                    className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-7 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                  Add Stock (Restock)
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {restockProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Current Stock:{' '}
                  <strong className="text-slate-800">
                    {formatQty(restockProduct.stock, restockProduct.unit)}
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

            <div className="grid grid-cols-4 gap-2 my-3.5">
              {[
                { label: '+6', val: 6 },
                { label: '+10', val: 10 },
                { label: '+12\n(1 Doz)', val: 12 },
                { label: '+24\n(1 Case)', val: 24 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => handleConfirmRestock(opt.val)}
                  className="py-2.5 px-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 font-bold text-xs whitespace-pre-line active:scale-95"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3.5">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Custom quantity to add ({restockProduct.unit}):
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={() => handleConfirmRestock(parseFloat(restockAmount))}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm"
                >
                  Add Stock
                </button>
              </div>
              {parseFloat(restockAmount) > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  New stock will be:{' '}
                  <strong className="text-teal-800">
                    {formatQty(
                      roundNum(restockProduct.stock + parseFloat(restockAmount), 2),
                      restockProduct.unit
                    )}
                  </strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white w-full max-w-md rounded-t-3xl max-h-[92vh] overflow-y-auto p-5 pb-7 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Sari-Sari Item' : 'Add Sari-Sari Item'}
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
                Product Name *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Coke Mismo, Lucky Me Canton"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as Exclude<StoreCategory, 'Rice'>)
                  }
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {SARI_SARI_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Unit
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Exclude<UnitType, 'kg'>)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {SARI_SARI_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Selling Price (₱ / {unit}) *
                </label>
                <input
                  required
                  type="number"
                  step="0.25"
                  min="0"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Cost Price (Optional)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  inputMode="decimal"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Current Stock ({unit}) *
                </label>
                <input
                  required
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Low Stock Alert ({unit})
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {editingProduct && (
                <button
                  type="button"
                  onClick={handleDeleteProduct}
                  className="px-4 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-sm"
              >
                {editingProduct ? 'Save Changes' : 'Add to Inventory'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
