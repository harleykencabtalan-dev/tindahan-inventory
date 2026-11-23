import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Store,
  ShoppingCart,
  Boxes,
  Wheat,
  ClipboardList,
  HardDriveDownload,
} from 'lucide-react';
import { auth } from './firebase';
import {
  ensureSeeded,
  subscribeProducts,
  subscribeSales,
  subscribeStockLogs,
} from './db';
import { type Product, type Sale, type StockLog } from './types';
import { PosView } from './components/PosView';
import { StockView } from './components/StockView';
import { RiceView } from './components/RiceView';
import { LogsView } from './components/LogsView';
import { BackupModal } from './components/BackupModal';
import { AuthScreen } from './components/AuthScreen';

type Tab = 'pos' | 'stock' | 'rice' | 'logs';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('pos');
  const [backupOpen, setBackupOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setSales([]);
      setStockLogs([]);
      return;
    }

    ensureSeeded(user.uid).catch(() => {});
    const unsubProducts = subscribeProducts(user.uid, setProducts);
    const unsubSales = subscribeSales(user.uid, setSales);
    const unsubLogs = subscribeStockLogs(user.uid, setStockLogs);

    return () => {
      unsubProducts();
      unsubSales();
      unsubLogs();
    };
  }, [user]);

  const { sariSariProducts, riceProducts } = useMemo(() => {
    const sari: Product[] = [];
    const rice: Product[] = [];
    for (const p of products) {
      if (p.category === 'Rice' || p.unit === 'kg') rice.push(p);
      else sari.push(p);
    }
    return { sariSariProducts: sari, riceProducts: rice };
  }, [products]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-sm font-semibold text-slate-500">Loading Tindahan POS...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

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
          title="Sync & Backup"
          aria-label="Sync and Backup"
        >
          <HardDriveDownload className="w-4 h-4" />
          <span>Account</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'pos' && (
          <PosView uid={user.uid} products={products} sales={sales} />
        )}
        {activeTab === 'stock' && <StockView uid={user.uid} products={sariSariProducts} />}
        {activeTab === 'rice' && <RiceView uid={user.uid} riceProducts={riceProducts} />}
        {activeTab === 'logs' && (
          <LogsView uid={user.uid} products={products} sales={sales} stockLogs={stockLogs} />
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
      {backupOpen && (
        <BackupModal
          uid={user.uid}
          userEmail={user.email}
          onClose={() => setBackupOpen(false)}
        />
      )}
    </div>
  );
}
