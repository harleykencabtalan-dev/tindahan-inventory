import { useRef, useState } from 'react';
import { X, Download, Upload, Trash2, ShieldCheck } from 'lucide-react';
import { db, exportAllData, importAllData } from '../db';

interface BackupModalProps {
  onClose: () => void;
}

export function BackupModal({ onClose }: BackupModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `tindahan-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Backup file downloaded! Save it to Google Drive or phone storage.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importAllData(text);
      setStatus(
        `Restored ${result.products} items, ${result.sales} sales, and ${result.stockLogs} restock logs!`
      );
    } catch {
      setStatus('Invalid backup file. Please choose a valid Tindahan backup (.json).');
    }
    e.target.value = '';
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        'Clear ALL products, sales, and restock logs? Make sure you downloaded a backup first if needed.'
      )
    ) {
      return;
    }
    await db.transaction('rw', db.products, db.sales, db.stockLogs, async () => {
      await db.products.clear();
      await db.sales.clear();
      await db.stockLogs.clear();
    });
    setStatus('All items and logs cleared. Ready for your own inventory!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-7 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
            <h3 className="text-lg font-bold text-slate-900">Local Data &amp; Backup</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          All inventory and logs are stored <strong>100% locally on this phone</strong> (works
          offline, ₱0 cost). Download a backup every week so you never lose data if the phone is
          replaced.
        </p>

        {status && (
          <div className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 p-3 rounded-xl">
            {status}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={handleExport}
            className="w-full py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99]"
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
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Upload className="w-4 h-4" />
            Restore from Backup
          </button>

          <button
            onClick={handleClearAll}
            className="w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Trash2 className="w-4 h-4" />
            Clear All / Wipe Sample Data
          </button>
        </div>
      </div>
    </div>
  );
}
