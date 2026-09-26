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
  Layers,
  CheckCircle2,
  Info,
  Clipboard,
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
import {
  buildTPDiagnosticReport,
  recordDiagnosticEvent,
} from '../services/diagnosticService';
import {
  runPreviewRouteProbe,
  formatPreviewRouteProbeReport,
} from '../services/previewRouteProbe';

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
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Edit/Add modal state
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<TPItem | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    setItems(tp.items || []);
    setIsDirty(false);
  }, [tp]);

  const hasCP =
    (cp.generalDescription && cp.generalDescription.trim().length > 0) ||
    (cp.elements && cp.elements.length > 0);

  const cpVerStatus = cp.source ? normalizeCPVerificationStatus(cp.source.verificationStatus) : 'UNVERIFIED';
  const isCpUnusable = cpVerStatus === 'SUPERSEDED' || cpVerStatus === 'VERSION_CONFLICT';
  const hasCPAnalysis = !!(cpAnalysis?.items && cpAnalysis.items.length > 0);

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
  const isStoredStatusAligned = (tp.workflowStatus || 'BELUM_DIMULAI') === validation.status;
  const saveState: 'DIRTY' | 'SAVED_READY' | 'SAVED_INCOMPLETE' = isDirty || !isStoredStatusAligned
    ? 'DIRTY'
    : validation.isSiap
    ? 'SAVED_READY'
    : 'SAVED_INCOMPLETE';

  // Integrity checks for stale upstream
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
  const showSaveNotice = (message: string) => {
    setSaveNotice(message);
  };

  const markDirty = () => {
    setIsDirty(true);
    setSaveNotice(null);
  };

  const persistTP = (source: 'AI_AUTO' | 'MANUAL' | 'STATUS_SYNC' | 'CONFIRM_ALIGNMENT') => {
    const updatedItems = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    const nextGeneratedBy =
      source === 'AI_AUTO'
        ? 'AI'
        : tp.generatedBy === 'AI'
        ? 'AI_EDITED_BY_TEACHER'
        : tp.generatedBy || 'TEACHER';
    const isAlignmentIntent = source === 'AI_AUTO' || source === 'CONFIRM_ALIGNMENT';
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
      generatedBy: nextGeneratedBy,
      needsReview: isAlignmentIntent ? false : tp.needsReview,
      reviewReason: isAlignmentIntent ? undefined : tp.reviewReason,
      basedOnCpUpdatedAt: isAlignmentIntent ? (cp.updatedAt || new Date().toISOString()) : tp.basedOnCpUpdatedAt,
      basedOnAnalysisUpdatedAt: isAlignmentIntent ? (cpAnalysis?.updatedAt || new Date().toISOString()) : tp.basedOnAnalysisUpdatedAt,
      updatedAt: new Date().toISOString(),
    };
    const val = validateTPDataWorkflow(candidateTP, cp, cpAnalysis, academicSetting);
    const updatedTP: TPData = {
      ...candidateTP,
      workflowStatus: val.status,
    };
    onSaveTP(updatedTP);
    setIsDirty(false);
    recordDiagnosticEvent({
      scope: 'TP',
      action: 'TP_SAVE',
      status: val.status,
      metadata: {
        source,
        itemsCount: updatedItems.length,
        validationStatus: val.status,
        needsReview: updatedTP.needsReview || false,
      },
    });
    showSaveNotice(val.isSiap ? 'TP tersimpan dan SIAP.' : 'TP tersimpan, tetapi masih perlu diperbaiki.');
    return { updatedTP, validation: val };
  };

  // Handle Confirm Alignment
  const handleConfirmAlignment = () => {
    persistTP('CONFIRM_ALIGNMENT');
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
    recordDiagnosticEvent({
      scope: 'TP',
      action: 'TP_GENERATE_STARTED',
      status: 'STARTED',
      metadata: { itemsCount: items.length },
    });

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
      setIsDirty(false);
      recordDiagnosticEvent({
        scope: 'TP',
        action: 'TP_GENERATE_SUCCESS',
        status: val.status,
        metadata: {
          itemsCount: generated.length,
          validationStatus: val.status,
          validationIssueCount: val.issues.length,
        },
      });
      recordDiagnosticEvent({
        scope: 'TP',
        action: 'TP_SAVE',
        status: val.status,
        metadata: {
          source: 'AI_AUTO',
          itemsCount: generated.length,
          validationStatus: val.status,
          needsReview: false,
        },
      });
      showSaveNotice(val.isSiap ? 'AI membuat dan menyimpan TP. Status: SIAP.' : 'AI membuat dan menyimpan TP, tetapi masih perlu diperbaiki.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghasilkan TP dengan AI';
      setGenerationError(msg);
      recordDiagnosticEvent({
        scope: 'TP',
        action: 'TP_GENERATE_FAILED',
        status: 'FAILED',
        metadata: { reason: msg },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    persistTP(isStoredStatusAligned ? 'MANUAL' : 'STATUS_SYNC');
  };

  const handleContinue = () => {
    if (items.length === 0) {
      alert('Tambahkan minimal 1 Tujuan Pembelajaran (TP) sebelum menyusun ATP.');
      recordDiagnosticEvent({
        scope: 'TP',
        action: 'TP_CONTINUE_BLOCKED',
        status: validation.status,
        metadata: { reason: 'NO_TP_ITEMS', validationStatus: validation.status, issueCount: validation.issues.length },
      });
      return;
    }
    if (saveState !== 'SAVED_READY') {
      const reason = isDirty
        ? 'Perubahan TP belum disimpan.'
        : !isStoredStatusAligned
        ? 'Status TP tersimpan belum sinkron dengan validasi runtime.'
        : validation.issues[0] || 'TP belum SIAP.';
      setGenerationError(reason);
      recordDiagnosticEvent({
        scope: 'TP',
        action: 'TP_CONTINUE_BLOCKED',
        status: validation.status,
        metadata: { reason, validationStatus: validation.status, issueCount: validation.issues.length },
      });
      return;
    }
    recordDiagnosticEvent({
      scope: 'TP',
      action: 'TP_CONTINUE_ALLOWED',
      status: validation.status,
      metadata: { itemsCount: items.length },
    });
    onNextStep();
  };

  // Move items up / down (Preserves stable item.id)
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;

    const reordered = newItems.map((it, idx) => ({ ...it, order: idx + 1 }));
    setItems(reordered);
    markDirty();
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus butir Tujuan Pembelajaran ini?')) {
      const filtered = items.filter((i) => i.id !== id);
      const reordered = filtered.map((it, idx) => ({ ...it, order: idx + 1 }));
      setItems(reordered);
      markDirty();
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
      p3Dimensions: [],
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
    markDirty();
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
      setCurrentItem({ ...currentItem, statement: refined });
    } catch (err: unknown) {
      alert('Gagal menyempurnakan teks dengan AI.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleCopyDiagnostic = async () => {
    let report = buildTPDiagnosticReport({
      module: 'TP',
      workspaceId: tp.workspaceId,
      academicSetting,
      context,
      tp,
      uiItemsCount: items.length,
      validation,
      learningPlanGate: validation.isSiap ? 'ALLOWED' : 'BLOCKED',
      learningPlanGateReason: validation.isSiap ? undefined : validation.issues[0],
    });

    try {
      const probeResult = await runPreviewRouteProbe();
      const probeText = formatPreviewRouteProbeReport(probeResult);
      report += probeText;
    } catch (err: any) {
      report += `\n\n=== GAS Preview Route Probe ===\nFAILED: ${err?.message || String(err)}\n`;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        const area = document.createElement('textarea');
        area.value = report;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      showSaveNotice('Diagnostik berhasil disalin.');
    } catch {
      setGenerationError('Gagal menyalin diagnostik. Browser tidak memberi akses clipboard.');
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
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs shadow-xs">
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
            type="button"
            onClick={handleConfirmAlignment}
            className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white px-3.5 py-2 rounded-xl font-semibold shadow-xs transition shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Konfirmasi & Tandai Sesuai</span>
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
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
              Rumuskan butir-butir Tujuan Pembelajaran yang diturunkan dari Capaian Pembelajaran (CP) dan Analisis CP untuk <strong>{context.subject}</strong> ({context.grade} - {context.phase}).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyDiagnostic}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 shadow-sm transition cursor-pointer"
            >
              <Clipboard className="w-4 h-4" />
              <span>Salin Diagnostik</span>
            </button>
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
                  <span>Generate TP dari CP & Analisis (AI)</span>
                </>
              )}
            </button>
          </div>
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

      {/* Upstream Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source CP Reference Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs text-slate-700">
          <div className="flex items-center justify-between font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5 text-blue-800">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Rujukan CP Tersimpan ({context.phase})</span>
            </span>
            {cp.source && (
              <span className="text-[11px] font-semibold text-slate-500 truncate max-w-xs">
                {cp.source.title}
              </span>
            )}
          </div>
          <p className="text-slate-600 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200/60 line-clamp-3">
            "{cp.generalDescription || 'Elemen tertera pada CP tersimpan.'}"
          </p>
        </div>

        {/* Source CP Analysis Reference Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs text-slate-700">
          <div className="flex items-center justify-between font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5 text-indigo-800">
              <Brain className="w-4 h-4 text-indigo-600" />
              <span>Analisis CP Rujukan ({cpAnalysis?.items?.length || 0} Elemen)</span>
            </span>
            <button
              onClick={onBackToCP}
              className="text-xs text-blue-700 hover:underline font-semibold"
            >
              Lihat Analisis
            </button>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/60 space-y-1">
            <p className="text-slate-600 font-medium line-clamp-2">
              {cpAnalysis?.generalSummary || 'Analisis kompetensi dan materi esensial diturunkan dari CP Fase.'}
            </p>
            {hasCPAnalysis && (
              <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                <Check className="w-3.5 h-3.5" /> Analisis CP siap dirujuk
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List of TP Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span>Daftar Tujuan Pembelajaran ({items.length})</span>
          </h4>

          <button
            id="btn-add-tp-manual"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah TP Manual</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-3">
            <Target className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h5 className="font-bold text-slate-700 text-sm">Belum Ada Tujuan Pembelajaran (TP)</h5>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Klik tombol <strong>"Generate TP dari CP (AI)"</strong> di atas untuk membuat rumusan TP secara instan atau gunakan tombol tambah manual.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {item.code}
                        </span>
                        {item.elementName && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            Elemen: {item.elementName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 leading-relaxed">
                        {item.statement}
                      </p>
                    </div>
                  </div>

                  {/* Ordering and action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
                      title="Geser ke atas"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === items.length - 1}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
                      title="Geser ke bawah"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit rumusan TP"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus TP ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub Metadata (Kompetensi, Materi, P3) */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Kompetensi (KKO):</span>
                    <span className="font-semibold text-slate-800">{item.competence || '-'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Lingkup Materi:</span>
                    <span className="font-semibold text-slate-800">{item.contentScope || '-'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Profil Pancasila:</span>
                    <span className="font-semibold text-blue-700">
                      {item.p3Dimensions?.join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
              saveState === 'SAVED_READY'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : saveState === 'SAVED_INCOMPLETE'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {saveState === 'SAVED_READY'
              ? 'Tersimpan • SIAP'
              : saveState === 'SAVED_INCOMPLETE'
              ? 'Tersimpan • Perlu diperbaiki'
              : 'Perubahan belum disimpan'}
          </span>
          <button
            id="btn-save-tp-draft"
            type="button"
            onClick={handleSave}
            disabled={saveState === 'SAVED_READY'}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition"
          >
            Simpan TP
          </button>
          {saveNotice && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-600" /> {saveNotice}
            </span>
          )}
        </div>

        {saveState === 'SAVED_READY' && (
          <button
            id="btn-next-to-atp"
            type="button"
            onClick={handleContinue}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white py-2.5 px-6 rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <span>Lanjut ke ATP</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* MODAL: Add / Edit TP */}
      {isEditing && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {currentItem.statement ? 'Edit Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItemModal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kode TP
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: TP 4.1"
                    value={currentItem.code}
                    onChange={(e) => setCurrentItem({ ...currentItem, code: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Elemen Rujukan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Menyimak / Bilangan"
                    value={currentItem.elementName || ''}
                    onChange={(e) => setCurrentItem({ ...currentItem, elementName: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Rumusan Tujuan Pembelajaran (TP) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRefineStatementWithAI}
                    disabled={isRefining}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md transition"
                  >
                    <Wand2 className="w-3 h-3 text-blue-600" />
                    <span>{isRefining ? 'Memoles...' : 'Poles AI'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  required
                  placeholder="Peserta didik mampu mengidentifikasi ide pokok..."
                  value={currentItem.statement}
                  onChange={(e) => setCurrentItem({ ...currentItem, statement: e.target.value })}
                  className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kompetensi (KKO)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Mengidentifikasi"
                    value={currentItem.competence}
                    onChange={(e) => setCurrentItem({ ...currentItem, competence: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Lingkup Materi
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ide Pokok Teks Narasi"
                    value={currentItem.contentScope}
                    onChange={(e) => setCurrentItem({ ...currentItem, contentScope: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Dimensi Profil Lulusan (Pilih 1-3)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {P3_DIMENSIONS.map((dim) => {
                    const isSelected = currentItem.p3Dimensions?.includes(dim);
                    return (
                      <button
                        key={dim}
                        type="button"
                        onClick={() => handleToggleP3(dim)}
                        className={`text-left p-2 rounded-lg text-xs transition border ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {dim}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 shadow-sm transition"
                >
                  Simpan TP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
