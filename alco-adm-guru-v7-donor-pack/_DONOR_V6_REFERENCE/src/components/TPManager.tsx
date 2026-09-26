import React, { useState, useEffect } from 'react';
import {
  Target,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Check,
  BookOpen,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Tag,
  Wand2,
  ShieldCheck,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  TPData,
  TPItem,
  CPData,
  CPAnalysisData,
  AcademicSetting,
  TeacherProfile,
  ActiveContext,
  normalizeCPVerificationStatus,
} from '../types';
import { P3_DIMENSIONS } from '../data/curriculumDefaults';
import { generateTPWithAI, refineTextWithAI } from '../services/aiService';
import { validateTPDataWorkflow } from '../services/cpWorkflowService';

interface TPManagerProps {
  tp: TPData;
  cp: CPData;
  cpAnalysis?: CPAnalysisData;
  context: ActiveContext;
  academicSetting: AcademicSetting;
  profile: TeacherProfile;
  onSaveTP: (tp: TPData) => void;
  onNextStep: () => void;
  onBackToCP: () => void;
}

export const TPManager: React.FC<TPManagerProps> = ({
  tp,
  cp,
  cpAnalysis,
  context,
  academicSetting,
  profile,
  onSaveTP,
  onNextStep,
  onBackToCP,
}) => {
  const [items, setItems] = useState<TPItem[]>(tp.items || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState(false);

  // Edit/Add modal state
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<TPItem | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    setItems(tp.items || []);
  }, [tp]);

  const hasCP =
    (cp.generalDescription && cp.generalDescription.trim().length > 0) ||
    (cp.elements && cp.elements.length > 0);

  const cpVerStatus = cp.source ? normalizeCPVerificationStatus(cp.source.verificationStatus) : 'UNVERIFIED';
  const isCpUnusable = cpVerStatus === 'SUPERSEDED' || cpVerStatus === 'VERSION_CONFLICT';

  // Workflow validation
  const validation = validateTPDataWorkflow(
    {
      ...tp,
      items,
      academicSettingId: tp.academicSettingId || academicSetting.id,
      cpId: tp.cpId || cp.id,
      academicYear: tp.academicYear || context.academicYear,
      subjectCode: tp.subjectCode || context.subject,
      phase: tp.phase || context.phase,
    },
    cp,
    cpAnalysis,
    academicSetting
  );

  // Integrity check: CP or Analysis changed after TP was created
  const isCPOutdated =
    hasCP &&
    items.length > 0 &&
    tp.basedOnCpUpdatedAt &&
    cp.updatedAt &&
    new Date(cp.updatedAt).getTime() > new Date(tp.basedOnCpUpdatedAt).getTime() + 1000;

  const isAnalysisOutdated =
    cpAnalysis &&
    items.length > 0 &&
    tp.basedOnAnalysisUpdatedAt &&
    cpAnalysis.updatedAt &&
    new Date(cpAnalysis.updatedAt).getTime() > new Date(tp.basedOnAnalysisUpdatedAt).getTime() + 1000;

  const needsReview = tp.needsReview || isCPOutdated || isAnalysisOutdated || isCpUnusable;

  // Handle Confirm Alignment
  const handleConfirmAlignment = () => {
    const updatedItems = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    const candidateTP: TPData = {
      ...tp,
      academicSettingId: academicSetting.id,
      cpId: cp.id,
      cpVersion: cp.cpVersion ?? cp.source?.versionCode,
      cpRegulationIds: cp.source?.regulationIds || cp.regulationIds || [],
      cpAnalysisId: cpAnalysis?.id,
      academicYear: context.academicYear,
      subjectCode: context.subject,
      phase: context.phase,
      items: updatedItems,
      needsReview: false,
      reviewReason: undefined,
      basedOnCpUpdatedAt: cp.updatedAt || new Date().toISOString(),
      basedOnAnalysisUpdatedAt: cpAnalysis?.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const val = validateTPDataWorkflow(candidateTP, cp, cpAnalysis, academicSetting);
    const updatedTP: TPData = {
      ...candidateTP,
      workflowStatus: val.status,
    };
    onSaveTP(updatedTP);
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2500);
  };

  // Handle AI Generate TP from CP & CP Analysis
  const handleGenerateAI = async () => {
    if (!hasCP) {
      alert('Data CP belum tersedia. Harap isi CP pada tahap 03 terlebih dahulu.');
      return;
    }

    if (isCpUnusable) {
      alert(`Capaian Pembelajaran (CP) rujukan berstatus ${cpVerStatus}. Mohon sesuaikan data CP pada Tahap 03 sebelum merumuskan TP.`);
      return;
    }

    if (
      items.length > 0 &&
      !confirm(
        'Menghasilkan TP baru dengan AI akan menggantikan daftar TP saat ini. Lanjutkan?'
      )
    ) {
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const generated = await generateTPWithAI({
        cpGeneral: cp.generalDescription,
        cpElements: cp.elements || [],
        cpAnalysisItems: cpAnalysis?.items || [],
        subject: context.subject,
        grade: context.grade,
        phase: context.phase,
        curriculum: context.curriculum,
        count: 4,
      });

      setItems(generated);
      const candidateTP: TPData = {
        ...tp,
        academicSettingId: academicSetting.id,
        cpId: cp.id,
        cpVersion: cp.cpVersion ?? cp.source?.versionCode,
        cpRegulationIds: cp.source?.regulationIds || cp.regulationIds || [],
        cpAnalysisId: cpAnalysis?.id,
        academicYear: context.academicYear,
        subjectCode: context.subject,
        phase: context.phase,
        items: generated,
        generatedBy: 'AI',
        generatedAt: new Date().toISOString(),
        needsReview: false,
        reviewReason: undefined,
        basedOnCpUpdatedAt: cp.updatedAt || new Date().toISOString(),
        basedOnAnalysisUpdatedAt: cpAnalysis?.updatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const val = validateTPDataWorkflow(candidateTP, cp, cpAnalysis, academicSetting);
      const updatedTP: TPData = {
        ...candidateTP,
        workflowStatus: val.status,
      };
      onSaveTP(updatedTP);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghasilkan TP dengan AI';
      setGenerationError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const updatedItems = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    const nextGeneratedBy =
      tp.generatedBy === 'AI' ? 'AI_EDITED_BY_TEACHER' : tp.generatedBy || 'TEACHER';

    const testTP: TPData = {
      ...tp,
      academicSettingId: academicSetting.id,
      cpId: cp.id,
      cpVersion: cp.cpVersion ?? cp.source?.versionCode,
      cpRegulationIds: cp.source?.regulationIds || cp.regulationIds || [],
      cpAnalysisId: cpAnalysis?.id,
      academicYear: context.academicYear,
      subjectCode: context.subject,
      phase: context.phase,
      items: updatedItems,
      generatedBy: nextGeneratedBy,
      basedOnCpUpdatedAt: cp.updatedAt || new Date().toISOString(),
      basedOnAnalysisUpdatedAt: cpAnalysis?.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const val = validateTPDataWorkflow(testTP, cp, cpAnalysis, academicSetting);

    const updatedTP: TPData = {
      ...testTP,
      workflowStatus: val.status,
      needsReview: false,
      reviewReason: undefined,
    };

    onSaveTP(updatedTP);
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2500);
  };

  const handleSaveAndNext = () => {
    if (items.length === 0) {
      alert('Tambahkan minimal 1 Tujuan Pembelajaran (TP) sebelum menyusun ATP.');
      return;
    }
    handleSave();
    onNextStep();
  };

  // Move items up / down (Preserves stable item.id!)
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;

    const reordered = newItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    setItems(reordered);
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus butir Tujuan Pembelajaran ini?')) {
      const filtered = items.filter((i) => i.id !== id);
      const reordered = filtered.map((it, idx) => ({ ...it, order: idx + 1 }));
      setItems(reordered);
    }
  };

  const handleOpenAdd = () => {
    const nextNum = items.length + 1;
    const gradeNum = context.grade.replace(/[^0-9]/g, '') || '4';
    const newId = `tp-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setCurrentItem({
      id: newId,
      code: `TP ${gradeNum}.${nextNum}`,
      elementName: cp.elements?.[0]?.name || 'Umum',
      statement: '',
      competence: '',
      contentScope: '',
      p3Dimensions: ['Bernalar Kritis', 'Mandiri'],
      order: nextNum,
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (item: TPItem) => {
    setCurrentItem({ ...item });
    setIsEditing(true);
  };

  const handleSaveItemModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || (!currentItem.statement.trim() && !(currentItem.description || '').trim())) {
      alert('Rumusan Tujuan Pembelajaran wajib diisi.');
      return;
    }

    const stmt = (currentItem.statement || currentItem.description || '').trim();
    const finalItem: TPItem = {
      ...currentItem,
      statement: stmt,
      description: stmt,
    };

    const exists = items.some((i) => i.id === finalItem.id);
    let newItems: TPItem[];
    if (exists) {
      newItems = items.map((i) => (i.id === finalItem.id ? finalItem : i));
    } else {
      newItems = [...items, finalItem];
    }

    const reordered = newItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    setItems(reordered);
    setIsEditing(false);
    setCurrentItem(null);
  };

  const handleToggleP3 = (dim: string) => {
    if (!currentItem) return;
    const current = currentItem.p3Dimensions || [];
    if (current.includes(dim)) {
      setCurrentItem({ ...currentItem, p3Dimensions: current.filter((d) => d !== dim) });
    } else {
      setCurrentItem({ ...currentItem, p3Dimensions: [...current, dim] });
    }
  };

  const handleRefineStatementWithAI = async () => {
    if (!currentItem || !currentItem.statement.trim()) {
      alert('Tulis draf rumusan TP terlebih dahulu.');
      return;
    }
    setIsRefining(true);
    try {
      const refined = await refineTextWithAI({
        text: currentItem.statement,
        instruction:
          'Sempurnakan kalimat Tujuan Pembelajaran (TP) ini menggunakan formula: Peserta didik mampu [Kompetensi/KKO] [Lingkup Materi] melalui [Konteks/Metode] dengan [Kriteria/Tepat].',
        context: `${context.subject} ${context.grade} (${context.phase})`,
      });
      setCurrentItem({ ...currentItem, statement: refined, description: refined });
    } catch (err: unknown) {
      alert('Gagal menyempurnakan teks dengan AI.');
    } finally {
      setIsRefining(false);
    }
  };

  if (!hasCP) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Data Capaian Pembelajaran (CP) Belum Ada</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Sesuai prinsip kurikulum dan integritas alur kerja, Tujuan Pembelajaran (TP) wajib diturunkan secara langsung dari Capaian Pembelajaran (CP) tersimpan.
        </p>
        <button
          onClick={onBackToCP}
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Kembali ke Tahap 03 CP</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integrity Alert / Review Warning */}
      {needsReview && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-amber-950">
                Pembaruan / Peninjauan Diperlukan pada TP
              </h4>
              <p className="text-amber-800">
                {tp.reviewReason ||
                  (isCPOutdated
                    ? 'Teks Capaian Pembelajaran (CP) telah diperbarui sejak TP ini dirumuskan.'
                    : isAnalysisOutdated
                    ? 'Data Analisis CP telah diperbarui sejak TP ini dirumuskan.'
                    : isCpUnusable
                    ? `CP Rujukan berstatus ${cpVerStatus}. Periksa kesesuaian CP terlebih dahulu.`
                    : 'Mohon tinjau kesesuaian butir TP di bawah ini.')}
              </p>
            </div>
          </div>
          <button
            onClick={handleConfirmAlignment}
            className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white px-3.5 py-2 rounded-xl font-semibold shadow-xs transition shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Konfirmasi & Tandai Sesuai</span>
          </button>
        </div>
      )}

      {/* Header Info & Provenance */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
                05
              </span>
              <h3 className="text-lg font-bold text-slate-900">Perumusan Tujuan Pembelajaran (TP)</h3>
              {/* Workflow status badge */}
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  validation.isSiap
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}
              >
                {validation.isSiap ? 'SIAP (VALID)' : 'PERLU DILENGKAPI'}
              </span>
              {/* Provenance source badge */}
              {tp.generatedBy && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                  {tp.generatedBy === 'AI' && <Sparkles className="w-3 h-3 text-amber-500" />}
                  {tp.generatedBy === 'AI' ? 'DRAF AI' : tp.generatedBy === 'AI_EDITED_BY_TEACHER' ? 'AI + EDIT GURU' : 'MANUAL GURU'}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Rumuskan butir-butir Tujuan Pembelajaran yang diturunkan dari Capaian Pembelajaran (CP) tersimpan untuk <strong>{context.subject}</strong> ({context.grade} - {context.phase}).
            </p>
          </div>

          {/* AI Generator Button */}
          <button
            id="btn-ai-generate-tp"
            onClick={handleGenerateAI}
            disabled={isGenerating || isCpUnusable}
            title={isCpUnusable ? `CP Berstatus ${cpVerStatus}` : 'Generate TP dengan AI'}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI Sedang Merumuskan TP...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generate TP dari CP (AI)</span>
              </>
            )}
          </button>
        </div>

        {generationError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{generationError}</span>
          </div>
        )}

        {/* Validation Issues Alert */}
        {!validation.isSiap && validation.issues.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <Info className="w-4 h-4 text-amber-600" />
              <span>Catatan Kelengkapan TP:</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
              {validation.issues.map((iss, idx) => (
                <li key={idx}>{iss}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Source CP Reference Card */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs text-slate-700">
        <div className="flex items-center justify-between font-bold text-slate-800 uppercase tracking-wider text-[11px]">
          <span className="flex items-center gap-1.5 text-blue-800">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Rujukan CP Tersimpan ({context.phase})</span>
          </span>
          <div className="flex items-center gap-2">
            {cp.source?.regulationIds && cp.source.regulationIds.length > 0 && (
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                Regulasi: {cp.source.regulationIds.join(', ')}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                cpVerStatus === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : cpVerStatus === 'SUPERSEDED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {cpVerStatus}
            </span>
          </div>
        </div>
        <p className="line-clamp-2 text-slate-600 italic">
          {cp.generalDescription || 'Belum ada deskripsi umum CP.'}
        </p>
        {cpAnalysis && cpAnalysis.items && cpAnalysis.items.length > 0 && (
          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-600">
            <Brain className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              Terhubung dengan <strong>{cpAnalysis.items.length} baris Bedah Analisis CP</strong>
            </span>
          </div>
        )}
      </div>

      {/* Main List of TP Items */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span>Daftar Tujuan Pembelajaran (Canonical TP)</span>
              <span className="text-xs font-normal text-slate-500">
                ({items.length} butir terumuskan)
              </span>
            </h4>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah TP Manual</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Target className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Daftar TP Masih Kosong</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Klik <strong>"Generate TP dari CP (AI)"</strong> di atas untuk perumusan otomatis, atau klik <strong>"Tambah TP Manual"</strong> untuk menuliskan butir TP secara mandiri.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-blue-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-md shadow-2xs">
                      {item.code || `TP ${idx + 1}`}
                    </span>
                    {item.elementName && (
                      <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-0.5 rounded-md border border-slate-200">
                        Elemen: {item.elementName}
                      </span>
                    )}
                    {item.competence && (
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-md border border-indigo-200/60">
                        KKO: {item.competence}
                      </span>
                    )}
                    {item.contentScope && (
                      <span className="bg-emerald-50 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded-md border border-emerald-200/60">
                        Materi: {item.contentScope}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    {item.statement || item.description}
                  </p>

                  {item.p3Dimensions && item.p3Dimensions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {item.p3Dimensions.map((d, i) => (
                        <span
                          key={i}
                          className="bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200/60"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Relational metadata display */}
                  <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                    ID: {item.id}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0}
                    title="Naikkan Urutan"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg disabled:opacity-30 cursor-pointer transition"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === items.length - 1}
                    title="Turunkan Urutan"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg disabled:opacity-30 cursor-pointer transition"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(item)}
                    title="Edit TP"
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition ml-1"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Hapus TP"
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <button
          onClick={onBackToCP}
          className="inline-flex items-center justify-center gap-2 border border-slate-300 hover:bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Kembali ke Tahap 04 Analisis CP</span>
        </button>

        <div className="flex items-center gap-3">
          {saveNotice && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="w-4 h-4" />
              <span>TP Berhasil Disimpan</span>
            </span>
          )}

          <button
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition cursor-pointer"
          >
            <span>Simpan Draf TP</span>
          </button>

          <button
            onClick={handleSaveAndNext}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <span>Lanjut ke Tahap 06 ATP</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add / Edit TP Modal */}
      {isEditing && currentItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span>{items.some((i) => i.id === currentItem.id) ? 'Edit Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran Baru'}</span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItemModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kode TP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={currentItem.code}
                    onChange={(e) => setCurrentItem({ ...currentItem, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                    placeholder="misal: TP 4.1"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Elemen CP Rujukan</label>
                  <select
                    value={currentItem.elementName || ''}
                    onChange={(e) => setCurrentItem({ ...currentItem, elementName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Umum">Umum (Lintas Elemen)</option>
                    {cp.elements?.map((e, idx) => (
                      <option key={idx} value={e.name}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kompetensi Utam (KKO)
                  </label>
                  <input
                    type="text"
                    value={currentItem.competence}
                    onChange={(e) => setCurrentItem({ ...currentItem, competence: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    placeholder="misal: Menganalisis, Membandingkan"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lingkup Materi Inti
                  </label>
                  <input
                    type="text"
                    value={currentItem.contentScope}
                    onChange={(e) => setCurrentItem({ ...currentItem, contentScope: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    placeholder="misal: Teks Narasi & Gagasan Pokok"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Rumusan Kalimat Tujuan Pembelajaran (TP) <span className="text-rose-500">*</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleRefineStatementWithAI}
                    disabled={isRefining}
                    className="text-blue-700 hover:text-blue-900 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isRefining ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                    ) : (
                      <Wand2 className="w-3 h-3 text-amber-500" />
                    )}
                    <span>Sempurnakan dengan AI</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  required
                  value={currentItem.statement}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, statement: e.target.value, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 leading-relaxed"
                  placeholder="Formula TP: Peserta didik mampu [Kompetensi] [Materi] melalui [Konteks]..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Dimensi Profil Pelajar Pancasila (P3)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {P3_DIMENSIONS.map((dim) => {
                    const isChecked = currentItem.p3Dimensions?.includes(dim);
                    return (
                      <button
                        type="button"
                        key={dim}
                        onClick={() => handleToggleP3(dim)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium text-left transition flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{dim}</span>
                        {isChecked && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition cursor-pointer"
                >
                  Simpan Butir TP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
