import { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Calculator,
  BookOpen,
  X,
  Wheat,
} from 'lucide-react';
import {
  type Product,
  type Sale,
  type CartItem,
  type BusinessType,
  formatPeso,
  roundNum,
} from '../types';
import { completeSaleTransaction } from '../db';

interface PosViewProps {
  uid: string;
  products: Product[];
  sales: Sale[];
}

const PESO_BILLS = [20, 50, 100, 200, 500, 1000];

const RICE_QUICK_KGS = [
  { label: '¼ kg', value: 0.25 },
  { label: '½ kg', value: 0.5 },
  { label: '1 kg', value: 1 },
  { label: '2 kg', value: 2 },
  { label: '5 kg', value: 5 },
  { label: '25 kg', value: 25 },
];

export function PosView({ uid, products, sales }: PosViewProps) {
  // Current input line (Notebook style: Product Name from Stock, Quantity, locked Price)
  const [itemName, setItemName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [qtyInput, setQtyInput] = useState('1');

  // Optional multi-item list (for customers buying several items at once)
  const [draftLines, setDraftLines] = useState<CartItem[]>([]);

  // Always-visible optional Sukli calculator
  const [cashInput, setCashInput] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Matching suggestions across BOTH Sari-Sari & Rice (prefix matches first)
  const suggestions = useMemo(() => {
    const q = itemName.trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);
  }, [products, itemName]);

  // Also auto-match if she typed the exact full name of a product in Stock
  const matchedProduct = useMemo(() => {
    if (selectedProduct && selectedProduct.name.toLowerCase() === itemName.trim().toLowerCase()) {
      return selectedProduct;
    }
    const q = itemName.trim().toLowerCase();
    if (!q) return null;
    return products.find((p) => p.name.toLowerCase() === q) ?? null;
  }, [selectedProduct, itemName, products]);

  const isRiceSelected =
    matchedProduct != null &&
    (matchedProduct.category === 'Rice' || matchedProduct.unit === 'kg');

  const parsedQty = Math.max(0, parseFloat(qtyInput) || 0);
  const currentLineValid = matchedProduct != null && parsedQty > 0;

  const buildCurrentCartItem = (): CartItem | null => {
    if (!currentLineValid || !matchedProduct) return null;
    return {
      product: matchedProduct,
      quantity: roundNum(parsedQty, 2),
    };
  };

  const resetCurrentInputs = () => {
    setItemName('');
    setSelectedProduct(null);
    setQtyInput('1');
    setDropdownOpen(false);
  };

  const handleSelectSuggestion = (p: Product) => {
    setSelectedProduct(p);
    setItemName(p.name);
    setQtyInput('1');
    setDropdownOpen(false);
  };

  const handleAddLineToDraft = () => {
    const entry = buildCurrentCartItem();
    if (!entry || !matchedProduct) {
      showToast('Select a product from Stock and enter a valid quantity');
      return;
    }
    if (entry.quantity > matchedProduct.stock) {
      showToast(`Only ${roundNum(matchedProduct.stock, 2)} ${matchedProduct.unit} left in stock`);
      return;
    }
    setDraftLines((prev) => [...prev, entry]);
    resetCurrentInputs();
    inputRef.current?.focus();
  };

  const removeDraftLine = (index: number) => {
    setDraftLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const effectiveItems = useMemo(() => {
    const current = buildCurrentCartItem();
    return current ? [...draftLines, current] : draftLines;
  }, [draftLines, matchedProduct, qtyInput]);

  const grandTotal = useMemo(
    () =>
      roundNum(
        effectiveItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
      ),
    [effectiveItems]
  );

  const cashNumber = parseFloat(cashInput) || 0;
  const change = roundNum(cashNumber - grandTotal);

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveItems.length === 0 || isSubmitting) return;

    // Validate stock for all items (aggregating duplicate lines)
    const qtyByProductId = new Map<string, number>();
    for (const item of effectiveItems) {
      if (item.product.id) {
        qtyByProductId.set(
          item.product.id,
          roundNum((qtyByProductId.get(item.product.id) ?? 0) + item.quantity, 2)
        );
      }
    }
    for (const [productId, totalQty] of qtyByProductId) {
      const live = products.find((p) => p.id === productId);
      if (live && totalQty > live.stock) {
        showToast(`Only ${roundNum(live.stock, 2)} ${live.unit} left for ${live.name}`);
        return;
      }
    }

    if (cashInput.trim() !== '' && cashNumber < grandTotal) {
      showToast(`Cash received is short by ${formatPeso(Math.abs(change))}`);
      return;
    }

    const finalCash = cashInput.trim() !== '' ? cashNumber : grandTotal;
    const allRice = effectiveItems.every(
      (item) => item.product.category === 'Rice' || item.product.unit === 'kg'
    );
    const source: BusinessType = allRice ? 'rice' : 'sari-sari';

    setIsSubmitting(true);
    try {
      const sale = await completeSaleTransaction(uid, effectiveItems, finalCash, source);
      setDraftLines([]);
      resetCurrentInputs();
      setCashInput('');
      showToast(
        sale.change > 0
          ? `Logged! Sukli: ${formatPeso(sale.change)}`
          : `Logged ${formatPeso(sale.total)}!`
      );
    } catch {
      showToast('Could not save log. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Today's Notebook entries (all sales today — both Sari-Sari and Rice)
  const todayNotebook = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const rows: Array<{
      key: string;
      qty: number;
      unit: string;
      name: string;
      subtotal: number;
      time: string;
      isRice: boolean;
    }> = [];
    let todayTotal = 0;

    for (const sale of sales) {
      if (sale.voided || sale.createdAt < startOfDay) continue;
      todayTotal += sale.total;
      const time = new Date(sale.createdAt).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
      });
      sale.items.forEach((item, idx) => {
        rows.push({
          key: `${sale.id}-${idx}`,
          qty: item.quantity,
          unit: item.unit,
          name: item.name,
          subtotal: item.subtotal,
          time,
          isRice: item.unit === 'kg' || sale.source === 'rice',
        });
      });
    }

    return { rows, todayTotal: roundNum(todayTotal) };
  }, [sales]);

  const qtyStep = isRiceSelected ? 0.5 : 1;

  return (
    <div className="flex flex-col pb-24 px-4 pt-3.5 space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* NOTEBOOK QUICK-LOG CARD */}
      <form
        onSubmit={handleSaveSale}
        className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-base leading-tight">
                Log a Sale (Lista)
              </h2>
              <p className="text-[11px] text-slate-500">
                Sari-Sari &amp; Rice • Prices come from Stock
              </p>
            </div>
          </div>
          {grandTotal > 0 && (
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Total</div>
              <div className="text-lg font-extrabold text-teal-800">
                {formatPeso(grandTotal)}
              </div>
            </div>
          )}
        </div>

        {/* Queued Multi-Item List */}
        {draftLines.length > 0 && (
          <div className="bg-teal-50/60 border border-teal-200/80 rounded-2xl p-3 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
              Items in this log ({draftLines.length})
            </div>
            {draftLines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 text-sm bg-white px-3 py-2 rounded-xl border border-teal-100"
              >
                <span className="font-bold text-teal-800 w-14 shrink-0">
                  {line.quantity}
                  {line.product.unit === 'kg' ? ' kg' : '×'}
                </span>
                <span className="font-semibold text-slate-900 truncate flex-1">
                  {line.product.name}
                </span>
                <span className="font-bold text-slate-900 shrink-0">
                  {formatPeso(roundNum(line.product.price * line.quantity))}
                </span>
                <button
                  type="button"
                  onClick={() => removeDraftLine(idx)}
                  aria-label="Remove line"
                  className="text-red-500 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 1. PRODUCT NAME (Autocomplete across Sari-Sari & Rice) */}
        <div className="relative">
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Product Name
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={itemName}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              onChange={(e) => {
                setItemName(e.target.value);
                setSelectedProduct(null);
                setDropdownOpen(true);
              }}
              placeholder="Type item or rice (e.g. Coke, Dinorado)..."
              className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-300 rounded-2xl text-base font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {itemName && (
              <button
                type="button"
                onClick={resetCurrentInputs}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Big Tap-Friendly Autocomplete Dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {suggestions.map((p) => {
                const isOut = p.stock <= 0;
                const isRice = p.category === 'Rice' || p.unit === 'kg';
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isOut}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(p);
                    }}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between gap-2 ${
                      isOut
                        ? 'opacity-45 cursor-not-allowed bg-slate-50'
                        : 'hover:bg-teal-50 active:bg-teal-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isRice && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            <Wheat className="w-2.5 h-2.5" />
                            Bigas
                          </span>
                        )}
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isOut ? 'Out of stock' : `Stock: ${roundNum(p.stock, 2)} ${p.unit}`}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-extrabold shrink-0 ${
                        isRice ? 'text-amber-700' : 'text-teal-800'
                      }`}
                    >
                      {formatPeso(p.price)}/{p.unit}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {matchedProduct ? (
            <p className="text-[11px] text-teal-700 font-semibold mt-1">
              Stock: {roundNum(matchedProduct.stock, 2)} {matchedProduct.unit} available
            </p>
          ) : (
            itemName.trim().length > 0 && (
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                Pick an item from the dropdown (add new items in Stock or Rice tab)
              </p>
            )
          )}
        </div>

        {/* 2. QUANTITY & READ-ONLY PRICE ROW */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Quantity {isRiceSelected ? '(kg)' : ''}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setQtyInput(
                    String(
                      Math.max(
                        isRiceSelected ? 0.25 : 1,
                        roundNum((parseFloat(qtyInput) || 1) - qtyStep, 2)
                      )
                    )
                  )
                }
                className="w-11 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 active:bg-slate-200 shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={isRiceSelected ? '0.25' : '1'}
                step={isRiceSelected ? '0.25' : '1'}
                inputMode="decimal"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                onFocus={() => setDropdownOpen(false)}
                className="w-full h-12 text-center bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={() =>
                  setQtyInput(String(roundNum((parseFloat(qtyInput) || 0) + qtyStep, 2)))
                }
                className="w-11 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 active:bg-slate-200 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Price (Fixed)
            </label>
            <div className="w-full h-12 px-3.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-slate-700">
              {matchedProduct ? (
                <>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatPeso(matchedProduct.price)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    /{matchedProduct.unit}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400 font-medium">Select item</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Rice Kilo Buttons (shown automatically when a Rice item is selected) */}
        {isRiceSelected && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {RICE_QUICK_KGS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setQtyInput(String(opt.value))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                  parseFloat(qtyInput) === opt.value
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-900 border-amber-200 active:bg-amber-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Optional "+ Add Another Item" button */}
        {currentLineValid && (
          <button
            type="button"
            onClick={handleAddLineToDraft}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            Add Another Item to This Receipt
          </button>
        )}

        {/* 3. INLINE OPTIONAL SUKLI CALCULATOR (Always Visible, Not a Dropdown) */}
        <div className="border-t border-slate-100 pt-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Calculator className="w-4 h-4 text-teal-700" />
            <span>Cash Received / Sukli (Optional)</span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
              ₱
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              placeholder="Leave blank if exact payment"
              className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setCashInput(grandTotal > 0 ? String(grandTotal) : '')}
              className="px-2.5 py-1.5 rounded-lg bg-teal-100 text-teal-800 text-xs font-bold whitespace-nowrap"
            >
              Exact
            </button>
            {PESO_BILLS.map((bill) => (
              <button
                key={bill}
                type="button"
                onClick={() => setCashInput(String(bill))}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap active:bg-slate-100"
              >
                ₱{bill}
              </button>
            ))}
          </div>

          {cashInput.trim() !== '' && (
            <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Change (Sukli)</span>
              <span
                className={`text-base font-extrabold ${
                  change < 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {change < 0
                  ? `Short ${formatPeso(Math.abs(change))}`
                  : formatPeso(change)}
              </span>
            </div>
          )}
        </div>

        {/* BIG SAVE BUTTON */}
        <button
          type="submit"
          disabled={effectiveItems.length === 0 || isSubmitting}
          className={`w-full py-3.5 rounded-2xl font-extrabold text-base transition-all ${
            effectiveItems.length > 0 && !isSubmitting
              ? 'bg-teal-700 hover:bg-teal-800 text-white shadow-md active:scale-[0.99]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting
            ? 'Saving...'
            : effectiveItems.length > 0
              ? `Save Log • ${formatPeso(grandTotal)}`
              : 'Save Log'}
        </button>
      </form>

      {/* TODAY'S NOTEBOOK (Simple Qty | Product Name | Price) */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
            Today&apos;s Notebook
          </h3>
          <span className="text-sm font-extrabold text-teal-800">
            {formatPeso(todayNotebook.todayTotal)}
          </span>
        </div>

        {todayNotebook.rows.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Nothing logged yet today.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase text-slate-400 text-left">
                <th className="py-2 pl-4 pr-2 font-bold w-16">Qty</th>
                <th className="py-2 px-2 font-bold">Product Name</th>
                <th className="py-2 pl-2 pr-4 font-bold text-right w-24">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayNotebook.rows.slice(0, 15).map((row) => (
                <tr key={row.key}>
                  <td
                    className={`py-2.5 pl-4 pr-2 font-bold whitespace-nowrap ${
                      row.isRice ? 'text-amber-700' : 'text-teal-800'
                    }`}
                  >
                    {row.qty}
                    {row.unit === 'kg' ? ' kg' : '×'}
                  </td>
                  <td className="py-2.5 px-2 text-slate-900 font-medium">
                    <div className="leading-snug">{row.name}</div>
                    <div className="text-[10px] text-slate-400">{row.time}</div>
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                    {formatPeso(row.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
