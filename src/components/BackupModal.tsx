import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  X,
  FileJson,
  Check,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { exportAppDataAsJSON, importAppDataFromJSON, resetToDefaultData } from '../services/storage';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    exportAppDataAsJSON();
    setImportStatus({
      type: 'success',
      message: 'File cadangan JSON berhasil diunduh ke perangkat Anda.',
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = importAppDataFromJSON(text);
      if (success) {
        setImportStatus({
          type: 'success',
          message: 'Data berhasil dipulihkan dari file JSON!',
        });
        setTimeout(() => {
          onDataRestored();
          onClose();
        }, 1200);
      } else {
        setImportStatus({
          type: 'error',
          message: 'Format file JSON tidak valid atau struktur data tidak sesuai.',
        });
      }
    } catch {
      setImportStatus({
        type: 'error',
        message: 'Gagal membaca file JSON cadangan.',
      });
    }
  };

  const handleReset = () => {
    if (
      confirm(
        'Apakah Anda yakin ingin mengatur ulang data ke setelan awal? Semua data yang belum dicadangkan akan hilang.'
      )
    ) {
      resetToDefaultData();
      setImportStatus({
        type: 'success',
        message: 'Data aplikasi berhasil diatur ulang ke preset awal.',
      });
      setTimeout(() => {
        onDataRestored();
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Backup & Restore Data</h3>
              <p className="text-[11px] text-slate-500">Pencadangan manual & pemulihan data lokal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {importStatus.type && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              importStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {importStatus.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3 text-xs">
          {/* Export / Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-blue-600" />
                <span>Cadangkan Data (Export JSON)</span>
              </span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Unduh seluruh profil guru, sekolah, CP, TP, dan ATP ke file berkas JSON untuk disimpan di komputer Anda.
            </p>
            <button
              id="btn-export-backup-json"
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-2 px-3 rounded-lg font-semibold transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File Backup (.json)</span>
            </button>
          </div>

          {/* Import / Restore */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Pulihkan Data (Import JSON)</span>
              </span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Unggah file cadangan JSON yang pernah Anda simpan sebelumnya untuk memulihkan seluruh data.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              id="btn-import-backup-json"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 py-2 px-3 rounded-lg font-semibold transition shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Pilih File Backup JSON</span>
            </button>
          </div>

          {/* Reset */}
          <div className="pt-2">
            <button
              id="btn-reset-app-data"
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-1.5 text-slate-500 hover:text-rose-600 text-[11px] font-medium py-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Atur Ulang ke Template Awal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
