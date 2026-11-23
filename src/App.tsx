import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store,
  ShoppingCart,
  Boxes,
  Wheat,
  ClipboardList,
  HardDriveDownload,
} from 'lucide-react';
import { db, ensureSeeded } from './db';
import { PosView } from './components/PosView';
import { StockView } from './components/StockView';
import { RiceView } from './components/RiceView';
import { LogsView } from './components/LogsView';
import { BackupModal } from './components/BackupModal';

type Tab = 'pos' | 'stock' | 'rice' | 'logs';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('pos');
  const [backupOpen, setBackupOpen] = useState(false);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), []) ?? [];
  const sales =
    useLiveQuery(() => db.sales.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const stockLogs =
    useLiveQuery(() => db.stockLogs.orderBy('createdAt').reverse().toArray(), []) ?? [];

  const { sariSariProducts, riceProducts } = useMemo(() => {
    const sari: typeof products = [];
    const rice: typeof products = [];
    for (const p of products) {
      if (p.category === 'Rice' || p.unit === 'kg') rice.push(p);
      else sari.push(p);
    }
    return { sariSariProducts: sari, riceProducts: rice };
  }, [products]);

  const lowSariSariCount = sariSariProducts.filter(
    (p) => p.stock <= p.lowStockThreshold
  ).length;
  const lowRiceCount = riceProducts.filter((p) => p.stock <= p.lowStockThreshold).length;

  const isRiceTab = activeTab === 'rice';

  const headerSubtitle =
    activeTab === 'pos'
      ? 'Sari-Sari Store • POS'
      : activeTab === 'stock'
        ? 'Sari-Sari Store • Stock'
        : activeTab === 'rice'
          ? 'Bigasan • Rice Module'
          : 'Sales & Restock Logs';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative shadow-sm">
      {/* Top App Bar */}
      <header
        className={`sticky top-0 z-30 h-14 text-white px-4 flex items-center justify-between shadow-sm transition-colors ${
          isRiceTab ? 'bg-amber-700' : 'bg-teal-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="bg-white/15 p-1.5 rounded-xl">
            {isRiceTab ? <Wheat className="w-5 h-5" /> : <Store className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="font-extrabold text-base leading-tight tracking-tight">
              {isRiceTab ? 'Bigasan (Rice)' : 'Tindahan POS'}
            </h1>
            <p className="text-[10px] text-white/80 font-medium leading-tight">
              {headerSubtitle}
            </p>
          </div>
        </div>

        <button
          onClick={() => setBackupOpen(true)}
          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold"
          title="Backup & Restore"
          aria-label="Backup and Restore"
        >
          <HardDriveDownload className="w-4 h-4" />
          <span>Backup</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'pos' && <PosView products={sariSariProducts} sales={sales} />}
        {activeTab === 'stock' && <StockView products={sariSariProducts} />}
        {activeTab === 'rice' && <RiceView riceProducts={riceProducts} />}
        {activeTab === 'logs' && (
          <LogsView products={products} sales={sales} stockLogs={stockLogs} />
        )}
      </main>

      {/* Bottom Navigation Bar (4 Modules) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'pos' ? 'text-teal-700' : 'text-slate-400'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="text-[11px] font-bold">POS</span>
          </button>

          <button
            onClick={() => setActiveTab('stock')}
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'stock' ? 'text-teal-700' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Boxes className="w-5 h-5" />
              {lowSariSariCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 rounded-full">
                  {lowSariSariCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold">Stock</span>
          </button>

          <button
            onClick={() => setActiveTab('rice')}
            className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'rice' ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Wheat className="w-5 h-5" />
              {lowRiceCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-orange-600 text-white text-[9px] font-extrabold px-1.5 rounded-full">
                  {lowRiceCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold">Rice</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'logs' ? 'text-teal-700' : 'text-slate-400'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-[11px] font-bold">Logs</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {backupOpen && <BackupModal onClose={() => setBackupOpen(false)} />}
    </div>
  );
}
