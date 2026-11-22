import { useState, useMemo } from 'react';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  Package,
} from 'lucide-react';
import {
  type Product,
  type CartItem,
  type StoreCategory,
  SARI_SARI_CATEGORIES,
  formatPeso,
  roundNum,
} from '../types';
import { completeSaleTransaction } from '../db';

interface PosViewProps {
  products: Product[];
}

const PESO_BILLS = [20, 50, 100, 200, 500, 1000];

export function PosView({ products }: PosViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | Exclude<StoreCategory, 'Rice'>>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, search, selectedCategory]);

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

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const addToCart = (product: Product, qtyToAdd = 1) => {
    if (product.id == null || qtyToAdd <= 0) return;

    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const nextQty = roundNum(currentQty + qtyToAdd, 2);

      if (nextQty > product.stock) {
        showToast(`Only ${product.stock} ${product.unit} left for ${product.name}`);
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
            showToast(`Max stock reached (${c.product.stock} ${c.product.unit})`);
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

  const handleProductTap = (product: Product) => {
    if (product.stock <= 0) {
      showToast(`${product.name} is out of stock`);
      return;
    }
    addToCart(product, 1);
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
      const sale = await completeSaleTransaction(cart, cashNumber, 'sari-sari');
      setCart([]);
      setCheckoutOpen(false);
      showToast(
        sale.change > 0
          ? `Sale saved! Sukli: ${formatPeso(sale.change)}`
          : `Sale saved! (${formatPeso(sale.total)})`
      );
    } catch {
      showToast('Failed to save sale. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col pb-36">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Search & Categories */}
      <div className="sticky top-14 z-20 bg-slate-50/95 backdrop-blur-sm pt-3 pb-2 px-4 border-b border-slate-200/80">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sari-sari items..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-2.5 pb-1">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'All'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            All ({products.length})
          </button>
          {SARI_SARI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="px-4 pt-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-14 text-slate-500">
            <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No sari-sari items found</p>
            <p className="text-xs text-slate-400 mt-1">
              Add items in the Stock tab to start selling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredProducts.map((product) => {
              const inCartQty = product.id != null ? cartMap.get(product.id) ?? 0 : 0;
              const isOut = product.stock <= 0;
              const isLow = !isOut && product.stock <= product.lowStockThreshold;

              return (
                <button
                  key={product.id}
                  onClick={() => handleProductTap(product)}
                  disabled={isOut}
                  className={`relative text-left p-3.5 rounded-2xl border transition-all active:scale-[0.98] flex flex-col justify-between min-h-[108px] ${
                    isOut
                      ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                      : inCartQty > 0
                        ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-500/30 shadow-xs'
                        : 'bg-white border-slate-200/90 shadow-2xs hover:border-teal-300'
                  }`}
                >
                  {inCartQty > 0 && (
                    <span className="absolute -top-2 -right-1.5 bg-teal-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {inCartQty}×
                    </span>
                  )}

                  <div>
                    <div className="flex items-center gap-1 mb-1">
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
                    <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-2.5 flex items-end justify-between gap-1">
                    <div>
                      <span className="text-base font-bold text-teal-800">
                        {formatPeso(product.price)}
                      </span>
                      <span className="text-[11px] text-slate-500">/{product.unit}</span>
                    </div>
                    <span
                      className={`text-[11px] font-medium ${
                        isOut
                          ? 'text-red-600'
                          : isLow
                            ? 'text-orange-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {roundNum(product.stock, 2)} {product.unit}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-[70px] left-0 right-0 z-30 px-4">
          <div className="max-w-md mx-auto">
            <button
              onClick={openCheckout}
              className="w-full bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white rounded-2xl px-4 py-3.5 shadow-lg shadow-teal-900/20 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="bg-teal-600/80 p-2 rounded-xl relative">
                  <ShoppingBag className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-900 text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                    {roundNum(cartCount, 1)}
                  </span>
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-teal-100 font-medium">
                    Sari-Sari Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                  </div>
                  <div className="text-lg font-extrabold leading-tight">
                    {formatPeso(cartTotal)}
                  </div>
                </div>
              </div>
              <span className="bg-white/15 px-3.5 py-1.5 rounded-xl text-sm font-bold">
                Checkout →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Checkout Bottom Sheet */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Sari-Sari Checkout</h3>
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
                  className="flex items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatPeso(item.product.price)} / {item.product.unit} •{' '}
                      <span className="font-bold text-teal-700">
                        {formatPeso(roundNum(item.product.price * item.quantity))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateCartQty(item.product.id!, -1)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:bg-slate-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQty(item.product.id!, 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:bg-slate-100"
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
                <span className="text-sm font-semibold text-slate-600">Total Amount</span>
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
                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2">
                  <button
                    onClick={() => setCashInput(String(cartTotal))}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-100 text-teal-800 text-xs font-bold whitespace-nowrap"
                  >
                    Exact
                  </button>
                  {PESO_BILLS.map((bill) => (
                    <button
                      key={bill}
                      onClick={() => setCashInput(String(bill))}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap active:bg-slate-100"
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
                    ? 'bg-teal-700 hover:bg-teal-800 text-white shadow-md active:scale-[0.99]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Saving...' : `Complete Sale • ${formatPeso(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
