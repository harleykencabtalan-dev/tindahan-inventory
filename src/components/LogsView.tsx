import { useState, useMemo } from 'react';
import {
  RotateCcw,
  Receipt,
  PackagePlus,
  Wheat,
  Store,
  Calendar,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  type Product,
  type Sale,
  type StockLog,
  type BusinessType,
  getSaleSource,
  formatPeso,
  roundNum,
} from '../types';
import { voidSaleTransaction } from '../db';

interface LogsViewProps {
  uid: string;
  products: Product[];
  sales: Sale[];
  stockLogs: StockLog[];
}

type LogPeriod = 'day' | 'weekly' | 'month' | 'year';
type BusinessFilter = 'all' | BusinessType;
type LogKind = 'sales' | 'restocks';

const PAGE_SIZE = 30;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toMonthInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function getDateRange(
  period: LogPeriod,
  selectedDate: string,
  selectedMonth: string,
  selectedYear: number
): { start: number; end: number; label: string } {
  const now = new Date();

  if (period === 'day') {
    const [y, m, day] = selectedDate.split('-').map(Number);
    const d = y && m && day ? new Date(y, m - 1, day) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const isToday = toDateInputValue(d) === toDateInputValue(now);
    const label = isToday
      ? 'Today'
      : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    return { start, end, label };
  }

  if (period === 'weekly') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    return { start, end, label: 'Last 7 Days' };
  }

  if (period === 'month') {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = y && m ? new Date(y, m - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const label = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    return { start, end, label };
  }

  // Year
  const start = new Date(selectedYear, 0, 1).getTime();
  const end = new Date(selectedYear + 1, 0, 1).getTime();
  return { start, end, label: `Year ${selectedYear}` };
}

export function LogsView({ uid, products, sales, stockLogs }: LogsViewProps) {
  const todayStr = toDateInputValue(new Date());
  const thisMonthStr = toMonthInputValue(new Date());
  const thisYear = new Date().getFullYear();

  const [period, setPeriod] = useState<LogPeriod>('day');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(thisMonthStr);
  const [selectedYear, setSelectedYear] = useState(thisYear);

  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>('all');
  const [logKind, setLogKind] = useState<LogKind>('sales');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const handlePeriodChange = (next: LogPeriod) => {
    setPeriod(next);
    setVisibleCount(PAGE_SIZE);
  };

  const handleBusinessChange = (next: BusinessFilter) => {
    setBusinessFilter(next);
    setVisibleCount(PAGE_SIZE);
  };

  const handleLogKindChange = (next: LogKind) => {
    setLogKind(next);
    setVisibleCount(PAGE_SIZE);
  };

  const shiftDate = (deltaDays: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + deltaDays);
    setSelectedDate(toDateInputValue(next));
    setVisibleCount(PAGE_SIZE);
  };

  const shiftMonth = (deltaMonths: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m - 1 + deltaMonths, 1);
    setSelectedMonth(toMonthInputValue(next));
    setVisibleCount(PAGE_SIZE);
  };

  const yearOptions = useMemo(() => {
    const years = new Set<number>([thisYear, thisYear - 1, thisYear - 2]);
    for (const s of sales) years.add(new Date(s.createdAt).getFullYear());
    for (const l of stockLogs) years.add(new Date(l.createdAt).getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [sales, stockLogs, thisYear]);

  const range = useMemo(
    () => getDateRange(period, selectedDate, selectedMonth, selectedYear),
    [period, selectedDate, selectedMonth, selectedYear]
  );

  // Fallback cost lookup for older sales saved before costPrice snapshotting
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.id != null) map.set(p.id, p.costPrice || 0);
    }
    return map;
  }, [products]);

  const computeSaleProfit = (sale: Sale): number => {
    if (typeof sale.profit === 'number') return sale.profit;
    let cost = 0;
    for (const item of sale.items) {
      const unitCost =
        typeof item.costPrice === 'number'
          ? item.costPrice
          : productCostMap.get(item.productId) ?? 0;
      cost += unitCost * item.quantity;
    }
    return roundNum(sale.total - cost);
  };

  const periodSales = useMemo(
    () => sales.filter((s) => s.createdAt >= range.start && s.createdAt < range.end),
    [sales, range]
  );

  const filteredSales = useMemo(
    () =>
      periodSales.filter((s) => {
        if (businessFilter === 'all') return true;
        return getSaleSource(s) === businessFilter;
      }),
    [periodSales, businessFilter]
  );

  const filteredStockLogs = useMemo(
    () =>
      stockLogs.filter((l) => {
        if (l.createdAt < range.start || l.createdAt >= range.end) return false;
        if (businessFilter === 'all') return true;
        return l.business === businessFilter;
      }),
    [stockLogs, range, businessFilter]
  );

  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let sariSariRevenue = 0;
    let sariSariProfit = 0;
    let riceRevenue = 0;
    let riceProfit = 0;
    let riceKilosSold = 0;
    let txCount = 0;

    for (const s of periodSales) {
      if (s.voided) continue;
      const src = getSaleSource(s);
      const saleProfit = computeSaleProfit(s);

      if (src === 'rice') {
        riceRevenue += s.total;
        riceProfit += saleProfit;
        for (const item of s.items) {
          if (item.unit === 'kg') riceKilosSold += item.quantity;
        }
      } else {
        sariSariRevenue += s.total;
        sariSariProfit += saleProfit;
      }

      if (businessFilter === 'all' || businessFilter === src) {
        totalRevenue += s.total;
        totalProfit += saleProfit;
        txCount++;
      }
    }

    const marginPct =
      totalRevenue > 0 ? roundNum((totalProfit / totalRevenue) * 100, 1) : 0;

    return {
      totalRevenue: roundNum(totalRevenue),
      totalProfit: roundNum(totalProfit),
      marginPct,
      sariSariRevenue: roundNum(sariSariRevenue),
      sariSariProfit: roundNum(sariSariProfit),
      riceRevenue: roundNum(riceRevenue),
      riceProfit: roundNum(riceProfit),
      riceKilosSold: roundNum(riceKilosSold, 2),
      txCount,
    };
  }, [periodSales, businessFilter, productCostMap]);

  const handleVoid = async (sale: Sale) => {
    if (!sale.id || sale.voided) return;
    if (!window.confirm('Void this sale and return all items back to stock?')) return;
    await voidSaleTransaction(uid, sale.id);
  };

  return (
    <div className="flex flex-col pb-24">
      {/* Period Selector (Day / Weekly / Month / Year) */}
      <div className="sticky top-14 z-20 bg-slate-50/95 backdrop-blur-sm px-4 pt-3 pb-2.5 border-b border-slate-200/80 space-y-2.5">
        <div className="grid grid-cols-4 bg-slate-200/70 p-1 rounded-xl">
          {(
            [
              { id: 'day', label: 'Day' },
              { id: 'weekly', label: '7 Days' },
              { id: 'month', label: 'Month' },
              { id: 'year', label: 'Year' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => handlePeriodChange(p.id)}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                period === p.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Specific Date / Month / Year Picker */}
        {period === 'day' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftDate(-1)}
              aria-label="Previous day"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }
              }}
              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
            <button
              onClick={() => shiftDate(1)}
              aria-label="Next day"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedDate !== todayStr && (
              <button
                onClick={() => {
                  setSelectedDate(todayStr);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="px-2.5 py-2 rounded-xl bg-teal-50 text-teal-800 text-xs font-bold"
              >
                Today
              </button>
            )}
          </div>
        )}

        {period === 'month' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }
              }}
              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedMonth !== thisMonthStr && (
              <button
                onClick={() => {
                  setSelectedMonth(thisMonthStr);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="px-2.5 py-2 rounded-xl bg-teal-50 text-teal-800 text-xs font-bold"
              >
                This Mo
              </button>
            )}
          </div>
        )}

        {period === 'year' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedYear((y) => y - 1);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="Previous year"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setVisibleCount(PAGE_SIZE);
              }}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setSelectedYear((y) => y + 1);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="Next year"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Business Filter Pills */}
        <div className="flex gap-2">
          {(
            [
              { id: 'all', label: 'All Combined' },
              { id: 'sari-sari', label: 'Sari-Sari' },
              { id: 'rice', label: 'Rice (Bigas)' },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              onClick={() => handleBusinessChange(b.id)}
              className={`flex-1 py-1.5 px-2 rounded-full text-xs font-semibold border transition-colors ${
                businessFilter === b.id
                  ? b.id === 'rice'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue & Profit Summary Hero Card */}
      <div className="px-4 pt-3 space-y-3">
        <div className="bg-gradient-to-br from-teal-800 to-teal-700 text-white rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-teal-100 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {range.label} Summary
            </span>
            <span className="bg-white/15 px-2.5 py-0.5 rounded-full">
              {totals.txCount} {totals.txCount === 1 ? 'sale' : 'sales'}
            </span>
          </div>

          {/* Primary Revenue + Profit Row */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-teal-200 font-semibold">
                Revenue (Sales)
              </div>
              <div className="text-2xl font-extrabold mt-0.5 tracking-tight">
                {formatPeso(totals.totalRevenue)}
              </div>
            </div>

            <div className="bg-emerald-500/20 border border-emerald-300/30 rounded-xl px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-emerald-200 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Profit (Kita)
              </div>
              <div className="text-xl font-extrabold text-emerald-100 mt-0.5 tracking-tight">
                {formatPeso(totals.totalProfit)}
              </div>
              {totals.totalRevenue > 0 && (
                <div className="text-[10px] text-emerald-200/90 font-medium">
                  {totals.marginPct}% margin
                </div>
              )}
            </div>
          </div>

          {/* Sari-Sari vs Rice Breakdown */}
          <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-white/15">
            <div className="bg-white/10 rounded-xl p-2.5">
              <div className="text-[11px] text-teal-100 flex items-center gap-1">
                <Store className="w-3 h-3" /> Sari-Sari
              </div>
              <div className="text-sm font-bold mt-0.5">
                {formatPeso(totals.sariSariRevenue)}
              </div>
              <div className="text-[11px] text-emerald-200 font-semibold">
                Profit: {formatPeso(totals.sariSariProfit)}
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-2.5">
              <div className="text-[11px] text-amber-200 flex items-center gap-1">
                <Wheat className="w-3 h-3" /> Rice ({totals.riceKilosSold} kg)
              </div>
              <div className="text-sm font-bold mt-0.5">
                {formatPeso(totals.riceRevenue)}
              </div>
              <div className="text-[11px] text-emerald-200 font-semibold">
                Profit: {formatPeso(totals.riceProfit)}
              </div>
            </div>
          </div>
        </div>

        {/* Log Kind Toggle (Sales vs Restocks) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleLogKindChange('sales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                logKind === 'sales'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Sales Logs ({filteredSales.length})
            </button>
            <button
              onClick={() => handleLogKindChange('restocks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                logKind === 'restocks'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5" />
              Restock Logs ({filteredStockLogs.length})
            </button>
          </div>
        </div>

        {/* Sales Logs List */}
        {logKind === 'sales' && (
          <div className="space-y-2.5">
            {filteredSales.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No sales recorded for {range.label.toLowerCase()}.
              </div>
            ) : (
              <>
                {filteredSales.slice(0, visibleCount).map((sale) => {
                  const src = getSaleSource(sale);
                  const saleProfit = computeSaleProfit(sale);
                  const dt = new Date(sale.createdAt);
                  const timeStr = dt.toLocaleTimeString('en-PH', {
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  const dateStr = dt.toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={sale.id}
                      className={`p-3.5 rounded-2xl border ${
                        sale.voided
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ${
                              src === 'rice'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {src === 'rice' ? 'Rice' : 'Sari-Sari'}
                          </span>
                          <span className="text-xs font-medium text-slate-500 truncate">
                            {dateStr} • {timeStr}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {sale.voided ? (
                            <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-md">
                              Voided
                            </span>
                          ) : (
                            <button
                              onClick={() => handleVoid(sale)}
                              className="text-[11px] font-semibold text-red-600 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 active:bg-red-100"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Undo
                            </button>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-0.5 text-xs text-slate-700">
                        {sale.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between gap-2">
                            <span className="truncate">
                              {item.quantity} {item.unit} × {item.name}
                            </span>
                            <span className="text-slate-500 shrink-0">
                              {formatPeso(item.subtotal)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          Rev:{' '}
                          <strong
                            className={
                              sale.voided
                                ? 'line-through text-slate-400'
                                : src === 'rice'
                                  ? 'text-amber-800'
                                  : 'text-teal-800'
                            }
                          >
                            {formatPeso(sale.total)}
                          </strong>
                        </span>

                        {!sale.voided && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold">
                            +{formatPeso(saleProfit)} profit
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredSales.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-[0.99]"
                  >
                    Load More ({filteredSales.length - visibleCount} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Restock Logs List */}
        {logKind === 'restocks' && (
          <div className="space-y-2.5">
            {filteredStockLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No restocks recorded for {range.label.toLowerCase()}.
              </div>
            ) : (
              <>
                {filteredStockLogs.slice(0, visibleCount).map((log) => {
                  const dt = new Date(log.createdAt);
                  const timeStr = dt.toLocaleTimeString('en-PH', {
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  const dateStr = dt.toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              log.business === 'rice'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {log.business === 'rice' ? 'Rice' : 'Sari-Sari'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {dateStr} • {timeStr}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {log.productName}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs shrink-0">
                        +{log.quantityAdded} {log.unit}
                      </span>
                    </div>
                  );
                })}
                {filteredStockLogs.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-[0.99]"
                  >
                    Load More ({filteredStockLogs.length - visibleCount} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
