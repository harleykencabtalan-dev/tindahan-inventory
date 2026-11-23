import { type Sale, type StockLog, getSaleSource, roundNum } from '../types';

export interface TopItemStat {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  revenue: number;
  profit: number;
  business: 'sari-sari' | 'rice';
}

export interface BreakdownBucket {
  key: string;       // e.g. '2026-11-24' or '2026-11' or 'morning'
  label: string;     // e.g. 'Nov 24 (Tue)' or 'November' or 'Morning'
  revenue: number;
  profit: number;
  count: number;
}

export interface DateGroup<T> {
  dateKey: string;
  label: string;
  totalRevenue?: number;
  items: T[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatFriendlyDate(dateKey: string, now = new Date()): string {
  const todayKey = formatDateKey(now.getTime());
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yestKey = formatDateKey(yest.getTime());

  if (dateKey === todayKey) return 'Today';
  if (dateKey === yestKey) return 'Yesterday';

  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: dt.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function computeTopItems(
  sales: Sale[],
  productCostMap: Map<string, number>,
  limit = 10
): TopItemStat[] {
  const map = new Map<string, TopItemStat>();

  for (const sale of sales) {
    if (sale.voided) continue;
    const biz = getSaleSource(sale);

    for (const item of sale.items) {
      const unitCost =
        typeof item.costPrice === 'number'
          ? item.costPrice
          : productCostMap.get(item.productId) ?? 0;
      const itemProfit =
        typeof item.profit === 'number'
          ? item.profit
          : roundNum((item.price - unitCost) * item.quantity);

      const existing = map.get(item.productId);
      if (existing) {
        existing.quantity = roundNum(existing.quantity + item.quantity, 2);
        existing.revenue = roundNum(existing.revenue + item.subtotal);
        existing.profit = roundNum(existing.profit + itemProfit);
      } else {
        map.set(item.productId, {
          productId: item.productId,
          name: item.name,
          unit: item.unit,
          quantity: roundNum(item.quantity, 2),
          revenue: roundNum(item.subtotal),
          profit: roundNum(itemProfit),
          business: biz,
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function computePeriodBreakdown(
  sales: Sale[],
  period: 'day' | 'weekly' | 'month' | 'year',
  computeSaleProfit: (sale: Sale) => number
): BreakdownBucket[] {
  const activeSales = sales.filter((s) => !s.voided);
  const map = new Map<string, BreakdownBucket>();

  if (period === 'day') {
    const slots: BreakdownBucket[] = [
      { key: 'morning', label: 'Morning (Before 12 PM)', revenue: 0, profit: 0, count: 0 },
      { key: 'afternoon', label: 'Afternoon (12–6 PM)', revenue: 0, profit: 0, count: 0 },
      { key: 'evening', label: 'Evening (6 PM+)', revenue: 0, profit: 0, count: 0 },
    ];
    for (const s of activeSales) {
      const hr = new Date(s.createdAt).getHours();
      const idx = hr < 12 ? 0 : hr < 18 ? 1 : 2;
      slots[idx].revenue = roundNum(slots[idx].revenue + s.total);
      slots[idx].profit = roundNum(slots[idx].profit + computeSaleProfit(s));
      slots[idx].count += 1;
    }
    return slots.filter((b) => b.count > 0);
  }

  if (period === 'year') {
    for (const s of activeSales) {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      const label = d.toLocaleDateString('en-PH', { month: 'long' });
      const prev = map.get(key) ?? { key, label, revenue: 0, profit: 0, count: 0 };
      prev.revenue = roundNum(prev.revenue + s.total);
      prev.profit = roundNum(prev.profit + computeSaleProfit(s));
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }

  // Weekly or Month: group by day
  for (const s of activeSales) {
    const key = formatDateKey(s.createdAt);
    const d = new Date(s.createdAt);
    const label = d.toLocaleDateString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const prev = map.get(key) ?? { key, label, revenue: 0, profit: 0, count: 0 };
    prev.revenue = roundNum(prev.revenue + s.total);
    prev.profit = roundNum(prev.profit + computeSaleProfit(s));
    prev.count += 1;
    map.set(key, prev);
  }

  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export function groupSalesByDate(sales: Sale[], now = new Date()): DateGroup<Sale>[] {
  const map = new Map<string, DateGroup<Sale>>();
  for (const s of sales) {
    const key = formatDateKey(s.createdAt);
    let grp = map.get(key);
    if (!grp) {
      grp = {
        dateKey: key,
        label: formatFriendlyDate(key, now),
        totalRevenue: 0,
        items: [],
      };
      map.set(key, grp);
    }
    grp.items.push(s);
    if (!s.voided) {
      grp.totalRevenue = roundNum((grp.totalRevenue ?? 0) + s.total);
    }
  }
  return Array.from(map.values());
}

export function groupStockLogsByDate(
  logs: StockLog[],
  now = new Date()
): DateGroup<StockLog>[] {
  const map = new Map<string, DateGroup<StockLog>>();
  for (const l of logs) {
    const key = formatDateKey(l.createdAt);
    let grp = map.get(key);
    if (!grp) {
      grp = {
        dateKey: key,
        label: formatFriendlyDate(key, now),
        items: [],
      };
      map.set(key, grp);
    }
    grp.items.push(l);
  }
  return Array.from(map.values());
}
