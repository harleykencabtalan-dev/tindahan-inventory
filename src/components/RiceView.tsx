import { useState, useMemo } from 'react';
import {
  Wheat,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  PackagePlus,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import {
  type Product,
  type CartItem,
  formatPeso,
  formatQty,
  roundNum,
} from '../types';
import { db, completeSaleTransaction, restockProductTransaction } from '../db';

interface RiceViewProps {
  riceProducts: Product[];
}

type RiceSubTab = 'sell' | 'stock';

const RICE_PRESETS = [
  { label: '¼ kg', value: 0.25 },
  { label: '½ kg', value: 0.5 },
  { label: '1 kg', value: 1 },
  { label: '2 kg', value: 2 },
  { label: '3 kg', value: 3 },
  { label: '5 kg', value: 5 },
  { label: '10 kg', value: 10 },
  { label: '25 kg (1 Sack)', value: 25 },
];

const PESO_BILLS = [20, 50, 100, 200, 500, 1000];

export function RiceView({ riceProducts }: RiceViewProps) {
  const [subTab, setSubTab] = useState<RiceSubTab>('sell');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // POS state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [customKg, setCustomKg] = useState('1');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stock / Restock state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState('25');

  // Add / Edit Rice modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingRice, setEditingRice] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('15');

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
      totalSacks: roundNum(totalKg / 25, 1),
      lowOrOut,
      totalValue: roundNum(totalValue),
    };
  }, [riceProducts]);

  const cartMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of cart) {
      if (item.product.id != null) map.set(item.product.id, item.quantity);
    }
    return map;
  }, [cart]);

  const cartTotal = useMemo(
    () => roundNum(cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)),
    [cart]
  );

  const totalCartKg = useMemo(
    () => roundNum(cart.reduce((sum, item) => sum + item.quantity, 0), 2),
    [cart]
  );

  const addToCart = (product: Product, kgToAdd: number) => {
    if (product.id == null || isNaN(kgToAdd) || kgToAdd <= 0) return;

    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const nextQty = roundNum(currentQty + kgToAdd, 2);

      if (nextQty > product.stock) {
        showToast(`Only ${roundNum(product.stock, 2)} kg left for ${product.name}`);
        return prev;
      }

      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: nextQty } : c
        );
      }
      return [...prev, { product, quantity: nextQty }];
    });
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== productId) return c;
          const next = roundNum(c.quantity + delta, 2);
          if (next > c.product.stock) {
            showToast(`Max stock reached (${roundNum(c.product.stock, 2)} kg)`);
            return c;
          }
          return { ...c, quantity: next };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const handleConfirmKg = (kgVal: number) => {
    if (!pickerProduct) return;
    if (isNaN(kgVal) || kgVal <= 0) {
      showToast('Enter a valid kilo amount');
      return;
    }
    addToCart(pickerProduct, kgVal);
    setPickerProduct(null);
  };

  const openCheckout = () => {
    setCashInput(String(cartTotal));
    setCheckoutOpen(true);
  };

  const cashNumber = parseFloat(cashInput) || 0;
  const change = roundNum(cashNumber - cartTotal);
  const canComplete = cart.length > 0 && cashNumber >= cartTotal && !isSubmitting;

  const handleCompleteSale = async () => {
    if (!canComplete) return;
    setIsSubmitting(true);
    try {
      const sale = await completeSaleTransaction(cart, cashNumber, 'rice');
      setCart([]);
      setCheckoutOpen(false);
      showToast(
        sale.change > 0
          ? `Rice sale saved! Sukli: ${formatPeso(sale.change)}`
          : `Rice sale saved! (${formatPeso(sale.total)})`
      );
    } catch {
      showToast('Failed to save rice sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stock Form handlers
  const openAddRice = () => {
    setEditingRice(null);
    setName('');
    setPrice('');
    setCostPrice('');
    setStock('25');
    setLowStockThreshold('15');
    setFormOpen(true);
  };

  const openEditRice = (p: Product) => {
    setEditingRice(p);
    setName(p.name);
    setPrice(String(p.price));
    setCostPrice(p.costPrice ? String(p.costPrice) : '');
    setStock(String(p.stock));
    setLowStockThreshold(String(p.lowStockThreshold));
    setFormOpen(true);
  };

  const handleSaveRice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const numPrice = parseFloat(price);
    const numCost = parseFloat(costPrice) || 0;
    const numStock = parseFloat(stock) || 0;
    const numLow = parseFloat(lowStockThreshold) || 15;

    if (!cleanName || isNaN(numPrice) || numPrice < 0) return;

    const payload: Omit<Product, 'id'> = {
      name: cleanName,
      category: 'Rice',
      unit: 'kg',
      price: roundNum(numPrice),
      costPrice: roundNum(numCost),
      stock: Math.max(0, roundNum(numStock, 2)),
      lowStockThreshold: Math.max(0, roundNum(numLow, 2)),
      updatedAt: Date.now(),
    };

    if (editingRice?.id != null) {
      await db.products.update(editingRice.id, payload);
    } else {
      await db.products.add(payload);
    }
    setFormOpen(false);
    showToast(editingRice ? 'Rice variety updated!' : 'Rice variety added!');
  };

  const handleDeleteRice = async () => {
    if (!editingRice?.id) return;
    if (!window.confirm(`Delete "${editingRice.name}" from Rice inventory?`)) return;
    await db.products.delete(editingRice.id);
    setFormOpen(false);
  };

  const handleConfirmRestock = async (addKg: number) => {
    if (!restockProduct || isNaN(addKg) || addKg <= 0) return;
    await restockProductTransaction(restockProduct, addKg);
    showToast(`Added +${roundNum(addKg, 2)} kg to ${restockProduct.name}`);
    setRestockProduct(null);
  };

  return (
    <div className="flex flex-col pb-36">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Rice Module Sub-Header & Segmented Toggle */}
      <div className="sticky top-14 z-20 bg-amber-50/95 backdrop-blur-sm px-4 pt-3 pb-3 border-b border-amber-200/80 space-y-2.5">
        <div className="grid grid-cols-2 bg-amber-100/80 p-1 rounded-xl">
          <button
            onClick={() => setSubTab('sell')}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'sell'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-900'
            }`}
          >
            Sell Rice (POS)
          </button>
          <button
            onClick={() => setSubTab('stock')}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'stock'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-900'
            }`}
          >
            Rice Stock ({riceProducts.length})
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-amber-600/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rice variety (e.g. Dinorado)..."
              className="w-full pl-10 pr-8 py-2 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600"
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
          {subTab === 'stock' && (
            <button
              onClick={openAddRice}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Rice
            </button>
          )}
        </div>
      </div>

      {/* SELL RICE (POS) SUB-TAB */}
      {subTab === 'sell' && (
        <div className="px-4 pt-3 space-y-2.5">
          {filteredRice.length === 0 ? (
            <div className="text-center py-14 text-slate-500">
              <Wheat className="w-10 h-10 mx-auto mb-2 text-amber-300" />
              <p className="text-sm font-medium">No rice varieties found</p>
              <button
                onClick={() => {
                  setSubTab('stock');
                  openAddRice();
                }}
                className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold"
              >
                + Add Rice Variety
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredRice.map((rice) => {
                const inCartKg = rice.id != null ? cartMap.get(rice.id) ?? 0 : 0;
                const isOut = rice.stock <= 0;
                const isLow = !isOut && rice.stock <= rice.lowStockThreshold;

                return (
                  <button
                    key={rice.id}
                    disabled={isOut}
                    onClick={() => {
                      setCustomKg('1');
                      setPickerProduct(rice);
                    }}
                    className={`relative w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.99] flex items-center justify-between gap-3 ${
                      isOut
                        ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                        : inCartKg > 0
                          ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/30 shadow-xs'
                          : 'bg-white border-amber-200/80 shadow-2xs hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Wheat className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-base truncate">
                            {rice.name}
                          </h3>
                          {isOut && (
                            <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md">
                              Out
                            </span>
                          )}
                          {isLow && (
                            <span className="text-[10px] font-bold uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md">
                              Low
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Stock:{' '}
                          <strong className="text-slate-700">
                            {formatQty(rice.stock, 'kg')}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-extrabold text-amber-800">
                        {formatPeso(rice.price)}
                        <span className="text-xs font-medium text-slate-500">/kg</span>
                      </div>
                      {inCartKg > 0 ? (
                        <span className="inline-block mt-0.5 bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                          In cart: {inCartKg} kg
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-700">
                          Tap to weigh →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* RICE STOCK SUB-TAB */}
      {subTab === 'stock' && (
        <div className="px-4 pt-3 space-y-3">
          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-amber-200/80 rounded-2xl p-3">
              <div className="text-[11px] font-medium text-slate-500">Total Rice</div>
              <div className="text-base font-extrabold text-amber-900 mt-0.5">
                {stats.totalKg} kg
              </div>
              <div className="text-[10px] text-amber-700 font-semibold">
                ≈ {stats.totalSacks} sacks
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
          <div className="space-y-2.5">
            {filteredRice.map((rice) => {
              const isOut = rice.stock <= 0;
              const isLow = !isOut && rice.stock <= rice.lowStockThreshold;
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
                        {isOut ? 'Out of Stock' : formatQty(rice.stock, 'kg')}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Alert ≤ {rice.lowStockThreshold} kg
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setRestockProduct(rice);
                        setRestockAmount('25');
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Restock Sacks (+)
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
        </div>
      )}

      {/* Floating Rice Cart Bar */}
      {subTab === 'sell' && cart.length > 0 && (
        <div className="fixed bottom-[70px] left-0 right-0 z-30 px-4">
          <div className="max-w-md mx-auto">
            <button
              onClick={openCheckout}
              className="w-full bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white rounded-2xl px-4 py-3.5 shadow-lg shadow-amber-900/20 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/80 p-2 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-amber-100 font-medium">
                    Rice Cart • {totalCartKg} kg total
                  </div>
                  <div className="text-lg font-extrabold leading-tight">
                    {formatPeso(cartTotal)}
                  </div>
                </div>
              </div>
              <span className="bg-white/20 px-3.5 py-1.5 rounded-xl text-sm font-bold">
                Checkout →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Weight Picker Modal */}
      {pickerProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-7 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                  Select Weight (Bigas)
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {pickerProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {formatPeso(pickerProduct.price)} / kg • Available:{' '}
                  <strong className="text-slate-700">
                    {roundNum(pickerProduct.stock, 2)} kg
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setPickerProduct(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 my-4">
              {RICE_PRESETS.map((preset) => {
                const disabled = preset.value > pickerProduct.stock;
                return (
                  <button
                    key={preset.value}
                    disabled={disabled}
                    onClick={() => handleConfirmKg(preset.value)}
                    className={`py-2.5 px-1.5 rounded-xl border text-center transition-all active:scale-95 ${
                      disabled
                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100 text-amber-950'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{preset.label}</div>
                    <div className="text-[10px] text-amber-700/90 mt-0.5 font-medium">
                      {formatPeso(roundNum(preset.value * pickerProduct.price))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-3.5">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Or enter custom kilos:
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.25"
                  min="0.1"
                  max={pickerProduct.stock}
                  value={customKg}
                  onChange={(e) => setCustomKg(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 1.5"
                />
                <button
                  onClick={() => handleConfirmKg(parseFloat(customKg))}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm"
                >
                  Add ({formatPeso(roundNum((parseFloat(customKg) || 0) * pickerProduct.price))})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rice Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Rice Checkout</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCart([]);
                    setCheckoutOpen(false);
                  }}
                  className="text-xs font-semibold text-red-600 px-2.5 py-1 rounded-lg bg-red-50"
                >
                  Clear Cart
                </button>
                <button
                  onClick={() => setCheckoutOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-3 space-y-2.5 flex-1">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between gap-2 bg-amber-50/50 p-3 rounded-xl border border-amber-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatPeso(item.product.price)} / kg •{' '}
                      <span className="font-bold text-amber-800">
                        {formatPeso(roundNum(item.product.price * item.quantity))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateCartQty(item.product.id!, -0.5)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-12 text-center text-xs font-bold text-slate-900">
                      {item.quantity}kg
                    </span>
                    <button
                      onClick={() => updateCartQty(item.product.id!, 0.5)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id!)}
                      className="w-8 h-8 rounded-lg text-red-500 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-5 bg-slate-50/70 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">
                  Total ({totalCartKg} kg)
                </span>
                <span className="text-2xl font-extrabold text-slate-900">
                  {formatPeso(cartTotal)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Cash Received (Bayad)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ₱
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2">
                  <button
                    onClick={() => setCashInput(String(cartTotal))}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold whitespace-nowrap"
                  >
                    Exact
                  </button>
                  {PESO_BILLS.map((bill) => (
                    <button
                      key={bill}
                      onClick={() => setCashInput(String(bill))}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap"
                    >
                      ₱{bill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200">
                <span className="text-sm font-semibold text-slate-600">Change (Sukli)</span>
                <span
                  className={`text-lg font-extrabold ${
                    change < 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {change < 0 ? `Short ${formatPeso(Math.abs(change))}` : formatPeso(change)}
                </span>
              </div>

              <button
                disabled={!canComplete}
                onClick={handleCompleteSale}
                className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all ${
                  canComplete
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md active:scale-[0.99]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Saving...' : `Complete Rice Sale • ${formatPeso(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rice Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-7 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
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
                    {formatQty(restockProduct.stock, 'kg')}
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
                { label: '+5 kg', val: 5 },
                { label: '+10 kg', val: 10 },
                { label: '+25 kg\n(1 Sack)', val: 25 },
                { label: '+50 kg\n(2 Sacks)', val: 50 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => handleConfirmRestock(opt.val)}
                  className="py-2.5 px-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-bold text-xs whitespace-pre-line active:scale-95"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3.5">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Custom kilos to add:
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={() => handleConfirmRestock(parseFloat(restockAmount))}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm"
                >
                  Add Kilos
                </button>
              </div>
              {parseFloat(restockAmount) > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  New stock will be:{' '}
                  <strong className="text-amber-800">
                    {formatQty(
                      roundNum(restockProduct.stock + parseFloat(restockAmount), 2),
                      'kg'
                    )}
                  </strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Rice Modal */}
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Current Stock (kg) *
                </label>
                <input
                  required
                  type="number"
                  step="0.25"
                  min="0"
                  inputMode="decimal"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="25 = 1 sack"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Low Stock Alert (kg)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
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
