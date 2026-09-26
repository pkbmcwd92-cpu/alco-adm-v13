import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Plus,
  Trash2,
  BookOpen,
  ArrowRight,
  Check,
  BrainCircuit,
  Lightbulb,
  Tag,
  Target,
  FileText,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { CPData, CPElem, AcademicSetting, TeacherProfile, ActiveContext, CPSource, CPVerificationStatus, normalizeCPVerificationStatus } from '../types';
import { cpSourceRepository, CPSourceSearchResult } from '../services/cpSourceRepository';
import { analyzeCPWithAI, CPAnalysisResult } from '../services/aiService';

interface CPManagerProps {
  cp: CPData;
  context: ActiveContext;
  academicSetting: AcademicSetting;
  profile: TeacherProfile;
  onSaveCP: (cp: CPData) => void;
  onNextStep: () => void;
}

export const CPManager: React.FC<CPManagerProps> = ({
  cp,
  context,
  academicSetting,
  profile,
  onSaveCP,
  onNextStep,
}) => {
  const [generalDescription, setGeneralDescription] = useState(cp.generalDescription || '');
  const [elements, setElements] = useState<CPElem[]>(cp.elements || []);
  const [source, setSource] = useState<CPSource | undefined>(cp.source);
  const [aiNotes, setAiNotes] = useState(cp.aiNotes || '');

  // Modal / Source selector state
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<CPSourceSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<CPSourceSearchResult | null>(null);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CPAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  // Sync if prop changes
  useEffect(() => {
    setGeneralDescription(cp.generalDescription || '');
    setElements(cp.elements || []);
    setSource(cp.source);
    setAiNotes(cp.aiNotes || '');
  }, [cp]);

  // Perform search based on ActiveContext
  const handleOpenSourceSearch = () => {
    const results = cpSourceRepository.search(context);
    setSearchResults(results);
    setSelectedResult(results.length > 0 ? results[0] : null);
    setIsSourceModalOpen(true);
  };

  const handleApplySelectedSource = (item: CPSourceSearchResult) => {
    if (
      generalDescription.trim().length > 0 &&
      !confirm('Gantikan teks CP saat ini dengan rujukan terpilih?')
    ) {
      return;
    }

    setGeneralDescription(item.generalDescription);
    setElements(item.elements);
    setSource(item.sourceMeta);
    setIsSourceModalOpen(false);

    // Auto save
    const updated: CPData = {
      ...cp,
      academicSettingId: academicSetting.id,
      generalDescription: item.generalDescription,
      elements: item.elements,
      source: item.sourceMeta,
      lastEditedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCP(updated);
  };

  const handleAddElement = () => {
    const newElem: CPElem = {
      id: `elem-${Date.now()}`,
      name: '',
      content: '',
    };
    setElements([...elements, newElem]);
  };

  const handleRemoveElement = (id: string) => {
    setElements(elements.filter((e) => e.id !== id));
  };

  const handleElementChange = (id: string, field: 'name' | 'content', val: string) => {
    setElements(elements.map((e) => (e.id === id ? { ...e, [field]: val } : e)));
  };

  const handleSave = () => {
    const updated: CPData = {
      ...cp,
      academicSettingId: academicSetting.id,
      generalDescription,
      elements,
      source: source || {
        title: `CP ${academicSetting.subject} (${context.phase})`,
        institution: 'Entri Mandiri Guru',
        retrievedAt: new Date().toISOString(),
        verificationStatus: 'local_reference',
      },
      aiNotes: aiNotes || (analysisResult ? analysisResult.summary : ''),
      lastEditedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCP(updated);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleSaveAndNext = () => {
    if (!generalDescription.trim() && elements.length === 0) {
      alert('Mohon isi deskripsi CP umum atau minimal 1 elemen CP sebelum melanjutkan.');
      return;
    }
    handleSave();
    onNextStep();
  };

  const handleRunAIAnalysis = async () => {
    if (!generalDescription.trim() && elements.length === 0) {
      alert('Pilih sumber atau isi CP terlebih dahulu agar AI dapat membedah kompetensinya.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const res = await analyzeCPWithAI({
        cpText: generalDescription,
        elements,
        subject: context.subject,
        grade: context.grade,
        phase: context.phase,
        curriculum: context.curriculum,
      });
      setAnalysisResult(res);
      setAiNotes(res.summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menganalisis CP dengan AI';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasCP = (generalDescription && generalDescription.trim().length > 0) || elements.length > 0;

  return (
    <div className="space-y-6">
      {/* Step Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
                03
              </span>
              <h3 className="text-lg font-bold text-slate-900">Capaian Pembelajaran (CP)</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Pilih sumber resmi atau masukkan Capaian Pembelajaran untuk <strong>{context.subject}</strong> ({context.grade} - {context.phase}).
              Data CP ini menjadi fondasi mutlak dalam penurunan Tujuan Pembelajaran (TP).
            </p>
          </div>

          {/* Search Official Sources Button */}
          <button
            id="btn-search-cp-source"
            onClick={handleOpenSourceSearch}
            className="inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-800 px-4 py-2.5 rounded-xl text-xs font-bold border border-blue-200 transition cursor-pointer self-start sm:self-auto shadow-2xs"
          >
            <Search className="w-4 h-4 text-blue-600" />
            <span>Cari Sumber CP Resmi ({context.phase})</span>
          </button>
        </div>

        {/* Source Metadata Banner */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-semibold">Status Sumber CP:</span>
            {(() => {
              const status = normalizeCPVerificationStatus(source?.verificationStatus);
              if (status === 'VERIFIED') {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Terverifikasi Resmi: {source?.institution}</span>
                  </span>
                );
              }
              if (status === 'LOCAL_REFERENCE') {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Referensi Lokal (Belum Terverifikasi SK BSKAP/BKPDM)</span>
                  </span>
                );
              }
              if (status === 'SUPERSEDED') {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Dokumen Kedaluwarsa / Digantikan</span>
                  </span>
                );
              }
              if (status === 'VERSION_CONFLICT') {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
                    <span>Konflik Versi CP (Ambiguous)</span>
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  <span>Input Mandiri / Draft</span>
                </span>
              );
            })()}
          </div>

          {source?.title && (
            <span className="text-slate-500 truncate max-w-md" title={source.title}>
              Dokumen: <strong className="text-slate-800 font-medium">{source.title}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: CP Editor Form (7 cols) & AI Analysis (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: CP Editor Form */}
        <div className="lg:col-span-7 space-y-5">
          {/* General CP Textarea */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Deskripsi Umum Capaian Pembelajaran ({context.phase})</span>
              </label>
              <span className="text-[11px] text-slate-400">Teks naratif fase</span>
            </div>

            <textarea
              id="textarea-cp-general"
              rows={4}
              placeholder="Contoh: Pada akhir Fase B, peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar, sesuai dengan tujuan, konteks sosial, akademis..."
              value={generalDescription}
              onChange={(e) => setGeneralDescription(e.target.value)}
              className="w-full text-sm p-3.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 leading-relaxed"
            />
          </div>

          {/* CP Elements Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rincian Elemen CP ({elements.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Elemen mata pelajaran (misal: Menyimak, Membaca, Menulis, Keterampilan Gerak, dll)
                </p>
              </div>

              <button
                id="btn-add-cp-element"
                type="button"
                onClick={handleAddElement}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Elemen</span>
              </button>
            </div>

            {elements.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                <p className="text-xs text-slate-500">
                  Belum ada elemen CP terpisah. Anda dapat menambahkan elemen atau mengandalkan deskripsi CP umum di atas.
                </p>
                <button
                  type="button"
                  onClick={handleOpenSourceSearch}
                  className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Ambil elemen otomatis dari sumber resmi</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {elements.map((elem, idx) => (
                  <div key={elem.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Nama Elemen (misal: Menyimak / Keterampilan Gerak)"
                        value={elem.name}
                        onChange={(e) => handleElementChange(elem.id, 'name', e.target.value)}
                        className="text-xs font-bold text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveElement(elem.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Hapus elemen ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Uraian capaian pada elemen ini..."
                      value={elem.content}
                      onChange={(e) => handleElementChange(elem.id, 'content', e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Analysis & Pedagogical Insight Assistant */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-b from-blue-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">AI Bedah & Pahami CP</h4>
                  <p className="text-[11px] text-blue-200">Analisis kata kerja, materi esensial, & profil pelajar</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-blue-100/90 leading-relaxed">
              AI akan menganalisis teks CP Anda untuk mengekstraksi kompetensi kunci (KKO), konten esensial, dan Dimensi Profil Lulusan yang harus tercapai.
            </p>

            <button
              id="btn-run-ai-cp-analysis"
              onClick={handleRunAIAnalysis}
              disabled={isAnalyzing || !hasCP}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sedang Membedah CP dengan AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Analisis & Bedah CP dengan AI</span>
                </>
              )}
            </button>

            {analysisError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs">
                ⚠️ {analysisError}
              </div>
            )}
          </div>

          {/* AI Analysis Result Display */}
          {analysisResult && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-2">
                <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Hasil Analisis CP</span>
                </h5>
                <p className="text-slate-600 mt-1 leading-relaxed">{analysisResult.summary}</p>
              </div>

              {/* Key competencies */}
              <div>
                <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1.5">
                  Kompetensi Utama / KKO:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.keyCompetencies.map((k, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold border border-blue-200/80"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              {/* Key contents */}
              <div>
                <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1.5">
                  Konten / Materi Esensial:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.keyContents.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* P3 focus */}
              <div>
                <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1.5">
                  Dimensi Profil Lulusan:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.p3Focus.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pedagogical tips */}
              {analysisResult.pedagogicalTips && analysisResult.pedagogicalTips.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block">
                    Tips Strategi Pembelajaran:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                    {analysisResult.pedagogicalTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            id="btn-save-cp-draft"
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition"
          >
            Simpan Draft CP
          </button>
          {saveToast && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-600" /> Data CP tersimpan
            </span>
          )}
        </div>

        <button
          id="btn-next-to-tp"
          type="button"
          onClick={handleSaveAndNext}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white py-2.5 px-6 rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer"
        >
          <span>Simpan & Lanjut ke Bedah & Analisis CP (04)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* MODAL: Official CP Source Browser & Verification Selection */}
      {isSourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-700" />
                  <span>Pencarian Sumber Capaian Pembelajaran (CP)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Konteks: {context.level} • {context.grade} ({context.phase}) • {context.subject}
                </p>
              </div>
              <button
                onClick={() => setIsSourceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Tidak ditemukan dokumen terverifikasi khusus untuk mata pelajaran "{context.subject}".
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Anda dapat menggunakan format rujukan lokal atau menginputkan uraian CP secara mandiri sesuai dokumen kurikulum sekolah Anda.
                  </p>
                  <button
                    onClick={() => {
                      const fallback = cpSourceRepository.getLocalReferenceFallback(context);
                      handleApplySelectedSource(fallback);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-xs"
                  >
                    <span>Gunakan Format Rujukan Lokal</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((item) => {
                    const isSelected = selectedResult?.id === item.id;
                    const itemVerStatus = normalizeCPVerificationStatus(item.verificationStatus);
                    const isVerified = itemVerStatus === 'VERIFIED';

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedResult(item)}
                        className={`p-4 rounded-2xl border transition cursor-pointer text-left space-y-2.5 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-2 ring-blue-600/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Sumber Resmi Terverifikasi</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Referensi Lokal</span>
                                </span>
                              )}
                              <span className="text-xs font-mono font-bold text-slate-700">
                                {item.phase} ({item.grade})
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 leading-tight">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Diterbitkan oleh: <strong className="text-slate-700">{item.institution}</strong> ({item.documentYear})
                            </p>
                          </div>

                          <div className="shrink-0">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>

                        {/* Snippet preview */}
                        <p className="text-xs text-slate-600 line-clamp-2 italic bg-white p-2.5 rounded-xl border border-slate-200/80">
                          "{item.generalDescription}"
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>{item.elements.length} Elemen terstruktur</span>
                          {item.url && (
                            <span className="flex items-center gap-1 text-blue-600 hover:underline">
                              <span>Tautan Kemendikbud</span>
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsSourceModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Tutup
              </button>

              {selectedResult && (
                <button
                  type="button"
                  onClick={() => handleApplySelectedSource(selectedResult)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Gunakan Dokumen CP Ini</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
