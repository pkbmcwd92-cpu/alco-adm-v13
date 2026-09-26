import React, { useState } from 'react';
import {
  Archive,
  Download,
  FolderTree,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  Files,
  FolderArchive,
  Check,
  Layers,
  FileText,
} from 'lucide-react';
import {
  DocumentType,
  DocumentMode,
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AdministrationWorkspace,
  AppDocumentRecord,
} from '../types';
import {
  generateZipBundle,
  ZipExportFormat,
  ZipExportResult,
  MERDEKA_DOC_TYPES,
  K13_DOC_TYPES,
  getDocumentZipFolder,
  DocumentGenerationContext,
} from '../services/documentEngine';
import { getCurriculumType } from '../services/curriculumRules';

interface ZipExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: DocumentGenerationContext;
  existingRecords: AppDocumentRecord[];
  onSuccess?: (result: ZipExportResult) => void;
}

export const ZipExportModal: React.FC<ZipExportModalProps> = ({
  isOpen,
  onClose,
  context,
  existingRecords,
  onSuccess,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ZipExportFormat>('both');
  const [selectedMode, setSelectedMode] = useState<DocumentMode>('data');
  const [isExporting, setIsExporting] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [exportResult, setExportResult] = useState<ZipExportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const curType = getCurriculumType(
    context.academicSetting?.curriculumType || context.academicSetting?.curriculum
  );
  const availableTypes: DocumentType[] = curType === 'K13' ? K13_DOC_TYPES : MERDEKA_DOC_TYPES;

  const [selectedTypes, setSelectedTypes] = useState<DocumentType[]>(availableTypes);

  if (!isOpen) return null;

  const toggleSelectType = (type: DocumentType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const selectAll = () => setSelectedTypes([...availableTypes]);
  const deselectAll = () => setSelectedTypes([]);

  const handleStartExport = async () => {
    if (selectedTypes.length === 0) {
      setErrorMessage('Pilih minimal satu jenis dokumen untuk diekspor ke dalam arsip ZIP.');
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setExportResult(null);
    setProgressPercent(0);
    setProgressText('Menyiapkan struktur folder administrasi...');

    try {
      const result = await generateZipBundle(
        {
          format: selectedFormat,
          documentMode: selectedMode,
          types: selectedTypes,
          existingRecords,
          onProgress: (current, total, docTitle) => {
            const pct = Math.round((current / total) * 100);
            setProgressPercent(pct);
            setProgressText(`[${pct}%] Mengepak (${current}/${total}): ${docTitle}`);
          },
        },
        context
      );

      setExportResult(result);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat membuat paket ZIP';
      setErrorMessage(msg);
    } finally {
      setIsExporting(false);
      setProgressText(null);
    }
  };

  // Group available documents by folder
  const groupedDocs: Record<string, DocumentType[]> = {
    '01_Kurikulum': [],
    '02_Perencanaan': [],
    '03_Asesmen': [],
    '04_Pelaksanaan': [],
    '05_Tindak_Lanjut': [],
  };

  availableTypes.forEach((type) => {
    const folder = getDocumentZipFolder(type, false);
    if (groupedDocs[folder]) {
      groupedDocs[folder].push(type);
    }
  });

  const getDocDisplayName = (type: DocumentType): string => {
    const names: Record<DocumentType, string> = {
      ANALISIS_CP_TP: 'Analisis CP → TP',
      ANALISIS_SKL_KI_KD: 'Analisis SKL-KI-KD',
      PENETAPAN_KKM: 'Penetapan KKM',
      CP: 'Capaian Pembelajaran',
      TP: 'Tujuan Pembelajaran',
      ATP: 'Alur Tujuan Pembelajaran (ATP)',
      KALENDER_AKADEMIK: 'Kalender Pendidikan',
      ALOKASI_WAKTU: 'Rincian Alokasi Waktu',
      PROTA: 'Program Tahunan (PROTA)',
      PROMES: 'Program Semester (PROMES)',
      MODUL_AJAR: 'Modul Ajar / RPP Berdiferensiasi',
      KKTP: 'Kriteria Ketercapaian TP (KKTP)',
      ASESMEN: 'Instrumen & Rubrik Asesmen',
      DAFTAR_HADIR: 'Buku Daftar Hadir Siswa',
      DAFTAR_NILAI: 'Buku Daftar Nilai',
      JURNAL: 'Jurnal Harian Mengajar',
      REMEDIAL_PENGAYAAN: 'Program Remedial & Pengayaan',
      HARI_EFEKTIF: 'Rincian Hari Efektif & Libur',
    };
    return names[type] || type;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-linear-to-r from-emerald-900 to-teal-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-emerald-300 border border-white/10">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Pusat Ekspor Paket ZIP Administrasi</h3>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Bundling terstruktur 6 kategori folder administrasi ({curType})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Format Selection Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              1. Pilih Format Berkas dalam ZIP
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                disabled={isExporting}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'pdf'
                    ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-600/20 text-rose-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${selectedFormat === 'pdf' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Printer className="w-4 h-4" />
                  </div>
                  {selectedFormat === 'pdf' && <Check className="w-4 h-4 text-rose-600 font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-xs">ZIP PDF</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Dokumen PDF resmi siap cetak & arsip</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('docx')}
                disabled={isExporting}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'docx'
                    ? 'border-blue-700 bg-blue-50/70 ring-2 ring-blue-700/20 text-blue-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${selectedFormat === 'docx' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Files className="w-4 h-4" />
                  </div>
                  {selectedFormat === 'docx' && <Check className="w-4 h-4 text-blue-700 font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-xs">ZIP Word (.docx)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Dokumen Word yang dapat diedit bebas</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('both')}
                disabled={isExporting}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'both'
                    ? 'border-emerald-700 bg-emerald-50/70 ring-2 ring-emerald-700/20 text-emerald-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${selectedFormat === 'both' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  {selectedFormat === 'both' && <Check className="w-4 h-4 text-emerald-700 font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-xs">ZIP PDF + Word (Lengkap)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Kedua versi PDF & DOCX per folder</div>
                </div>
              </button>
            </div>
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              2. Pilih Sumber Konten
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMode('data')}
                disabled={isExporting}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedMode === 'data'
                    ? 'border-emerald-700 bg-emerald-50/70 text-emerald-950 font-semibold ring-2 ring-emerald-700/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <div>
                    <div className="text-xs font-bold">Dokumen Berisi Data Aktif</div>
                    <div className="text-[11px] text-slate-500">Otomatis terisi data guru, mapel, CP, TP, & siswa</div>
                  </div>
                </div>
                {selectedMode === 'data' && <Check className="w-4 h-4 text-emerald-700" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('blank')}
                disabled={isExporting}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedMode === 'blank'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-950 font-semibold ring-2 ring-amber-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div>
                    <div className="text-xs font-bold">Template Format Kosong</div>
                    <div className="text-[11px] text-slate-500">Struktur folder 06_Format_Kosong untuk tulis manual</div>
                  </div>
                </div>
                {selectedMode === 'blank' && <Check className="w-4 h-4 text-amber-600" />}
              </button>
            </div>
          </div>

          {/* Folder & Document Breakdown Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-slate-500" />
                <span>3. Struktur Folder Administrasi & Dokumen</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={isExporting}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  disabled={isExporting}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Batal Semua
                </button>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {selectedMode === 'blank' ? (
                <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 font-semibold flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Seluruh dokumen format kosong akan dikelompokkan ke dalam folder utama: <strong className="font-mono">06_Format_Kosong</strong>
                  </span>
                </div>
              ) : null}

              {Object.entries(groupedDocs).map(([folderName, docList]) => {
                if (docList.length === 0) return null;
                const folderSelectedCount = docList.filter((d) => selectedTypes.includes(d)).length;

                return (
                  <div key={folderName} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">{folderName}</span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          ({folderSelectedCount}/{docList.length} dipilih)
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {docList.map((docType) => {
                        const isChecked = selectedTypes.includes(docType);
                        return (
                          <label
                            key={docType}
                            className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-emerald-50/60 text-emerald-950 font-medium'
                                : 'hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isExporting}
                              onChange={() => toggleSelectType(docType)}
                              className="rounded text-emerald-700 focus:ring-emerald-500 h-3.5 w-3.5"
                            />
                            <span className="truncate">{getDocDisplayName(docType)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Indicator */}
          {isExporting && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                  {progressText || 'Membuat paket ZIP...'}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-700 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Gagal membuat ZIP: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Success Result Summary */}
          {exportResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Paket ZIP Berhasil Dibuat & Diunduh!</span>
              </div>
              <p className="font-mono text-[11px] bg-white/70 p-2 rounded border border-emerald-200">
                📁 {exportResult.zipFileName}
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <div className="text-[10px] text-slate-500 font-bold">TOTAL DOKUMEN</div>
                  <div className="font-bold text-base text-emerald-800">{exportResult.exportedCount}</div>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <div className="text-[10px] text-slate-500 font-bold">BERKAS PDF</div>
                  <div className="font-bold text-base text-rose-700">{exportResult.pdfCount}</div>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <div className="text-[10px] text-slate-500 font-bold">BERKAS WORD</div>
                  <div className="font-bold text-base text-blue-700">{exportResult.docxCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedTypes.length} jenis dokumen terpilih
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition-all cursor-pointer disabled:opacity-50"
            >
              {exportResult ? 'Tutup' : 'Batal'}
            </button>
            <button
              type="button"
              id="btn-execute-zip-export"
              onClick={handleStartExport}
              disabled={isExporting || selectedTypes.length === 0}
              className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Mengompresi ZIP...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-200" />
                  <span>
                    Unduh Paket ZIP ({selectedFormat === 'both' ? 'PDF + Word' : selectedFormat.toUpperCase()})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
