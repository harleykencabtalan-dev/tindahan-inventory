import { useRef, useState } from 'react';
import { X, Download, Upload, Trash2, ShieldCheck, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { clearAllData, exportAllData, importAllData } from '../db';

interface BackupModalProps {
  uid: string;
  userEmail: string | null;
  onClose: () => void;
}

export function BackupModal({ uid, userEmail, onClose }: BackupModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const json = await exportAllData(uid);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tindahan-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Backup file downloaded!');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const result = await importAllData(uid, text);
      setStatus(
        `Restored ${result.products} items, ${result.sales} sales, and ${result.stockLogs} restock logs!`
      );
    } catch {
      setStatus('Invalid backup file. Please choose a valid Tindahan backup (.json).');
    } finally {
      setBusy(false);
    }
    e.target.value = '';
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        'Clear ALL products, sales, and restock logs from your cloud store? Make sure you downloaded a backup first if needed.'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await clearAllData(uid);
      setStatus('All items and logs cleared. Ready for your own inventory!');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-7 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
            <h3 className="text-lg font-bold text-slate-900">Cloud Sync &amp; Backup</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
          <div>
            Signed in as: <strong className="text-slate-900">{userEmail ?? 'Store Owner'}</strong>
          </div>
          <div>
            Synced to <strong>Firebase Firestore</strong> with offline cache — works without
            internet and syncs across devices automatically.
          </div>
        </div>

        {status && (
          <div className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 p-3 rounded-xl">
            {status}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            disabled={busy}
            onClick={handleExport}
            className="w-full py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            Download Backup (.json)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Upload className="w-4 h-4" />
            Restore from Backup
          </button>

          <button
            disabled={busy}
            onClick={handleClearAll}
            className="w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Trash2 className="w-4 h-4" />
            Clear All / Wipe Sample Data
          </button>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
