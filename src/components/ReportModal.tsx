import { X, Printer } from 'lucide-react';
import { formatPeso } from '../types';
import { type TopItemStat } from '../utils/logAnalytics';

interface ReportModalProps {
  periodLabel: string;
  businessLabel: string;
  totals: {
    totalRevenue: number;
    totalProfit: number;
    marginPct: number;
    sariSariRevenue: number;
    sariSariProfit: number;
    riceRevenue: number;
    riceProfit: number;
    riceKilosSold: number;
    txCount: number;
  };
  items: TopItemStat[];
  onClose: () => void;
}

export function ReportModal({
  periodLabel,
  businessLabel,
  totals,
  items,
  onClose,
}: ReportModalProps) {
  const generatedAt = new Date().toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex items-end sm:items-center justify-center print-report-overlay">
      <div className="bg-white w-full max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden print-report-sheet">
        {/* Top Action Bar (hidden when printing) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50 no-print">
          <h3 className="font-bold text-slate-900 text-sm">Store Summary Report</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Save PDF / Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-200/80 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="overflow-y-auto p-5 space-y-5 text-slate-900">
          {/* Report Header */}
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-extrabold text-teal-900">
              Tindahan POS — Sales Report
            </h2>
            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                Period: <strong className="text-slate-800">{periodLabel}</strong>
              </span>
              <span>
                Filter: <strong className="text-slate-800">{businessLabel}</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Generated {generatedAt}</div>
          </div>

          {/* Sari-Sari vs Rice Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Business Breakdown
            </h4>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="py-1.5 font-semibold">Module</th>
                  <th className="py-1.5 font-semibold text-right">Revenue</th>
                  <th className="py-1.5 font-semibold text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 font-semibold text-slate-800">Sari-Sari Store</td>
                  <td className="py-2 text-right font-bold">
                    {formatPeso(totals.sariSariRevenue)}
                  </td>
                  <td className="py-2 text-right font-bold text-emerald-700">
                    {formatPeso(totals.sariSariProfit)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold text-slate-800">
                    Rice / Bigasan ({totals.riceKilosSold} kg)
                  </td>
                  <td className="py-2 text-right font-bold">
                    {formatPeso(totals.riceRevenue)}
                  </td>
                  <td className="py-2 text-right font-bold text-emerald-700">
                    {formatPeso(totals.riceProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Items
            </h4>
            {items.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No items sold for this period.
              </p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-1.5 font-semibold">Item</th>
                    <th className="py-1.5 font-semibold text-right">Qty</th>
                    <th className="py-1.5 font-semibold text-right">Revenue</th>
                    <th className="py-1.5 font-semibold text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-1.5 font-medium text-slate-800">{item.name}</td>
                      <td className="py-1.5 text-right text-slate-500 whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-1.5 text-right font-bold">
                        {formatPeso(item.revenue)}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-emerald-700">
                        {formatPeso(item.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 text-slate-900">
                    <td colSpan={2} className="pt-2.5 pb-1 font-extrabold uppercase tracking-wide">
                      Total
                    </td>
                    <td className="pt-2.5 pb-1 text-right font-extrabold">
                      {formatPeso(totals.totalRevenue)}
                    </td>
                    <td className="pt-2.5 pb-1 text-right font-extrabold text-emerald-700">
                      {formatPeso(totals.totalProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Grand Total Summary Below Everything */}
          <div className="border-t-2 border-slate-200 pt-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold uppercase tracking-wider">Grand Total</span>
              <span>
                {totals.txCount} completed {totals.txCount === 1 ? 'sale' : 'sales'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Total Revenue
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {formatPeso(totals.totalRevenue)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] font-semibold text-emerald-700 uppercase">
                  Total Profit (Kita)
                </div>
                <div className="text-xl font-extrabold text-emerald-900 mt-0.5">
                  {formatPeso(totals.totalProfit)}
                </div>
                <div className="text-[11px] text-emerald-700">
                  {totals.marginPct}% profit margin
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
