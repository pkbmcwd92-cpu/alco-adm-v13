import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Brain,
  Sparkles,
  Plus,
  Trash2,
  Save,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Target,
  BookOpen,
  Info,
  Lightbulb,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import {
  CPData,
  CPAnalysisData,
  CPAnalysisItem,
  AcademicSetting,
  TeacherProfile,
  ActiveContext,
  normalizeCPVerificationStatus,
} from '../types';
import { validateCPAnalysisDataWorkflow } from '../services/cpWorkflowService';

interface CPAnalysisManagerProps {
  cp: CPData;
  cpAnalysis?: CPAnalysisData;
  context: ActiveContext;
  academicSetting: AcademicSetting;
  profile: TeacherProfile;
  onSaveCPAnalysis: (analysis: CPAnalysisData) => void;
  onNextStep: () => void;
  onBackToCP: () => void;
}

export const CPAnalysisManager: React.FC<CPAnalysisManagerProps> = ({
  cp,
  cpAnalysis,
  context,
  academicSetting,
  profile,
  onSaveCPAnalysis,
  onNextStep,
  onBackToCP,
}) => {
  // Initialize analysis items from existing or derive from CP elements
  const initialItems = (): CPAnalysisItem[] => {
    if (cpAnalysis?.items && cpAnalysis.items.length > 0) {
      return cpAnalysis.items;
    }
    if (cp?.elements && cp.elements.length > 0) {
      return cp.elements.map((el, idx) => ({
        id: `ana-item-${Date.now()}-${idx + 1}`,
        elementName: el.name,
        cpText: el.content,
        cpCompetence: 'Mempraktikkan, memahami, menerapkan, mengevaluasi',
        materialScope: el.name,
        meaningfulUnderstanding: `Peserta didik mampu menerapkan esensi ${el.name} dalam kehidupan sehari-hari.`,
        suggestedTp: `Peserta didik dapat menguasai keterampilan dasar pada elemen ${el.name}.`,
        order: idx + 1,
      }));
    }
    return [
      {
        id: `ana-item-default-1`,
        elementName: 'Elemen Utama',
        cpText: cp.generalDescription || 'Capaian pembelajaran pada fase ini.',
        cpCompetence: 'Memahami, mengidentifikasi, mempraktikkan',
        materialScope: academicSetting.subject || 'Materi Pokok',
        meaningfulUnderstanding: 'Peserta didik memahami konsep kunci secara kontekstual.',
        suggestedTp: 'Peserta didik mampu menguraikan konsep utama dengan benar.',
        order: 1,
      },
    ];
  };

  const [items, setItems] = useState<CPAnalysisItem[]>(initialItems());
  const [generalSummary, setGeneralSummary] = useState(
    cpAnalysis?.generalSummary || 'Analisis kompetensi dan materi esensial diturunkan langsung dari CP Fase untuk perumusan Tujuan Pembelajaran (TP).'
  );
  const [generatedBy, setGeneratedBy] = useState<'AI' | 'TEACHER' | 'AI_EDITED_BY_TEACHER'>(
    cpAnalysis?.generatedBy || 'AI'
  );
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (cpAnalysis?.items && cpAnalysis.items.length > 0) {
      setItems(cpAnalysis.items);
      setGeneralSummary(cpAnalysis.generalSummary || '');
      if (cpAnalysis.generatedBy) setGeneratedBy(cpAnalysis.generatedBy);
    }
  }, [cpAnalysis]);

  // Check if source CP was updated after analysis was created
  const isCPUpdatedSinceAnalysis =
    cp &&
    cpAnalysis?.basedOnCpUpdatedAt &&
    cp.updatedAt &&
    new Date(cp.updatedAt).getTime() > new Date(cpAnalysis.basedOnCpUpdatedAt).getTime() + 1000;

  const needsReview = cpAnalysis?.needsReview || isCPUpdatedSinceAnalysis;

  const handleUpdateItem = (id: string, field: keyof CPAnalysisItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
    if (generatedBy === 'AI') {
      setGeneratedBy('AI_EDITED_BY_TEACHER');
    }
  };

  const handleAddItem = () => {
    const newItem: CPAnalysisItem = {
      id: `ana-item-${Date.now()}`,
      elementName: 'Elemen Baru',
      cpText: '',
      cpCompetence: '',
      materialScope: '',
      meaningfulUnderstanding: '',
      suggestedTp: '',
      order: items.length + 1,
    };
    setItems([...items, newItem]);
    setGeneratedBy('AI_EDITED_BY_TEACHER');
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
    setGeneratedBy('AI_EDITED_BY_TEACHER');
  };

  const handleSave = () => {
    const validation = validateCPAnalysisDataWorkflow({ items } as any, cp);
    const updated: CPAnalysisData = {
      id: cpAnalysis?.id || `cpanalysis-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      cpId: cp.id,
      cpSourceId: cp.source?.regulationId || cp.regulationSourceId || cp.source?.id || cp.id,
      cpRegulationIds: cp.regulationIds || (cp.source?.regulationId ? [cp.source.regulationId] : (cp.regulationSourceId ? [cp.regulationSourceId] : [])),
      cpVersion: cp.cpVersion,
      academicYear: academicSetting.academicYear,
      subjectCode: academicSetting.subject,
      phase: academicSetting.phase,
      generalSummary,
      items,
      generatedBy,
      generatedAt: cpAnalysis?.generatedAt || new Date().toISOString(),
      basedOnCpUpdatedAt: cp.updatedAt || new Date().toISOString(),
      workflowStatus: validation.isSiap ? 'SIAP' : 'PERLU_DILENGKAPI',
      needsReview: false,
      reviewReason: undefined,
      updatedAt: new Date().toISOString(),
    };
    onSaveCPAnalysis(updated);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  const handleGenerateFromCP = () => {
    if (!cp.elements || cp.elements.length === 0) {
      alert('Elemen CP belum tersedia. Silakan isi elemen pada tahap CP terlebih dahulu.');
      return;
    }
    const derived: CPAnalysisItem[] = cp.elements.map((el, idx) => ({
      id: `ana-item-${Date.now()}-${idx + 1}`,
      elementName: el.name,
      cpText: el.content,
      cpCompetence: 'Memahami, menerapkan, menganalisis, menyajikan',
      materialScope: el.name,
      meaningfulUnderstanding: `Pemahaman kontekstual mengenai konsep inti ${el.name}.`,
      suggestedTp: `Peserta didik mampu mengaplikasikan keterampilan dan pengetahuan ${el.name} secara terstruktur.`,
      order: idx + 1,
    }));
    setItems(derived);
    setGeneratedBy('AI');
    handleSave();
  };

  // Verification status display label
  const getVerificationBadge = () => {
    const status = normalizeCPVerificationStatus(cp.source?.verificationStatus);
    if (status === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Terverifikasi Resmi
        </span>
      );
    }
    if (status === 'LOCAL_REFERENCE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Referensi Lokal Guru
        </span>
      );
    }
    if (status === 'SUPERSEDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          Tidak Berlaku / Digantikan
        </span>
      );
    }
    if (status === 'VERSION_CONFLICT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
          <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
          Konflik Versi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
        <Info className="w-3.5 h-3.5 text-slate-500" />
        Belum Terverifikasi
      </span>
    );
  };

  return (
    <div className="space-y-6" id="cp-analysis-manager">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-md">
              Langkah 04 — Kurikulum Merdeka
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {academicSetting.subject} • {academicSetting.grade} ({academicSetting.phase})
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            Analisis Capaian Pembelajaran (CP)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Bedah kompetensi (KKO) dan lingkup materi esensial dari setiap elemen CP sebagai jembatan perumusan Tujuan Pembelajaran (TP).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateFromCP}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            Tarik dari Elemen CP
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Analisis
          </button>
        </div>
      </div>

      {showSavedToast && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Data Analisis CP berhasil disimpan ke workspace!
        </div>
      )}

      {/* Provenance & Source CP Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              Analisis Berdasarkan CP Sumber:
            </span>
            {getVerificationBadge()}
          </div>
          <p className="font-semibold text-slate-200">
            Mapel: <span className="text-white">{academicSetting.subject}</span> | Fase:{' '}
            <span className="text-blue-300">{academicSetting.phase}</span> | Sumber:{' '}
            <span className="text-emerald-300">{cp.source?.title || 'Dokumen CP Workspace'}</span>
          </p>
          {cp.source?.institution && (
            <p className="text-slate-400 text-[11px]">
              Penerbit: {cp.source.institution} ({cp.source.documentYear || '2026'})
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono text-[11px]">
            Mode: {generatedBy === 'AI' ? 'Hasil Analisis AI' : generatedBy === 'AI_EDITED_BY_TEACHER' ? 'AI + Editan Guru' : 'Disusun Guru'}
          </span>
        </div>
      </div>

      {/* Review alert if source CP was updated */}
      {needsReview && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-950">
              Perhatian: Dokumen CP Sumber Telah Diperbarui
            </h4>
            <p className="text-amber-800">
              Versi teks CP di workspace atau regulasi acuan telah mengalami pembaruan. Mohon periksa kembali ketersesuaian hasil bedah kompetensi dan lingkup materi sebelum melanjut ke tahap TP.
            </p>
          </div>
        </div>
      )}

      {/* Overview Context Box */}
      <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-200/70 text-xs text-blue-900 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <span className="font-bold">Panduan Analisis CP Kurikulum Merdeka (Berdasarkan Panduan Pembelajaran & Asesmen):</span>
          <p className="text-blue-800">
            Setiap kalimat CP dipecah menjadi dua komponen vital: <strong>Kompetensi</strong> (kemampuan yang harus dicapai siswa melalui Kata Kerja Operasional) dan <strong>Lingkup Materi</strong> (konsep esensial yang dipelajari). Hasil bedah ini disimpan terpisah dari teks CP resmi untuk menjaga kemurnian dokumen normatif pemerintah.
          </p>
        </div>
      </div>

      {/* Ringkasan Analisis CP */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Catatan & Ringkasan Analisis CP
        </label>
        <textarea
          rows={2}
          value={generalSummary}
          onChange={(e) => {
            setGeneralSummary(e.target.value);
            if (generatedBy === 'AI') setGeneratedBy('AI_EDITED_BY_TEACHER');
          }}
          placeholder="Tuliskan catatan umum mengenai pendekatan analisis CP pada mata pelajaran dan fase ini..."
          className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
      </div>

      {/* Matriks Analisis Item */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Matriks Analisis Elemen CP ({items.length} Komponen)
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Baris
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {items.map((item, idx) => (
            <div key={item.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={item.elementName}
                    onChange={(e) => handleUpdateItem(item.id, 'elementName', e.target.value)}
                    placeholder="Nama Elemen CP (misal: Keterampilan Gerak)"
                    className="font-bold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden px-1"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  title="Hapus baris analisis"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* CP Text reference */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Kutipan Capaian Pembelajaran (CP) Elemen:
                </label>
                <textarea
                  rows={2}
                  value={item.cpText}
                  onChange={(e) => handleUpdateItem(item.id, 'cpText', e.target.value)}
                  placeholder="Kutipan kalimat CP dari BSKAP Kemendikbud..."
                  className="w-full text-xs text-slate-700 bg-slate-50/80 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Grid: Kompetensi & Lingkup Materi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-blue-900 block">
                    1. Kompetensi / Kata Kerja Operasional (KKO):
                  </label>
                  <input
                    type="text"
                    value={item.cpCompetence}
                    onChange={(e) => handleUpdateItem(item.id, 'cpCompetence', e.target.value)}
                    placeholder="Contoh: Menunjukkan, mempraktikkan, memahami"
                    className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-indigo-900 block">
                    2. Lingkup Materi Inti / Konten:
                  </label>
                  <input
                    type="text"
                    value={item.materialScope}
                    onChange={(e) => handleUpdateItem(item.id, 'materialScope', e.target.value)}
                    placeholder="Contoh: Pola gerak dasar lokomotor dan manipulatif"
                    className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  />
                </div>
              </div>

              {/* Grid: Pemahaman Bermakna & Rumusan Awal TP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">
                    3. Pemahaman Bermakna / Konteks / Variasi:
                  </label>
                  <input
                    type="text"
                    value={item.meaningfulUnderstanding || ''}
                    onChange={(e) => handleUpdateItem(item.id, 'meaningfulUnderstanding', e.target.value)}
                    placeholder="Contoh: Penerapan dalam permainan beregu dan gaya hidup sehat"
                    className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-emerald-900 block">
                    4. Rumusan Awal Tujuan Pembelajaran (Draft TP):
                  </label>
                  <input
                    type="text"
                    value={item.suggestedTp || ''}
                    onChange={(e) => handleUpdateItem(item.id, 'suggestedTp', e.target.value)}
                    placeholder="Contoh: Peserta didik mampu mempraktikkan pola gerak dasar secara tepat."
                    className="w-full text-xs text-emerald-950 bg-emerald-50/50 border border-emerald-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onBackToCP}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke CP (03)
        </button>

        <button
          type="button"
          onClick={() => {
            handleSave();
            onNextStep();
          }}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-900 text-white hover:bg-blue-800 flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
        >
          <span>Lanjut ke Penyusunan TP (05)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
