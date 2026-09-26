import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Trash2,
  Edit3,
  Download,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Check,
  RotateCcw,
  Info,
  Clock,
  ExternalLink,
  Clipboard,
} from 'lucide-react';
import {
  LearningPlan,
  LearningPlanStatus,
  LearningActivity,
  AssessmentPlanItem,
  LearningResource,
  TeacherProfile,
  SchoolData,
  AcademicSetting,
  TPData,
  ATPData,
  Student,
  TimeAllocation,
  AssessmentCriterion,
  AdministrationWorkspace,
  LearningExperiencePhase,
} from '../../types';
import {
  validateLearningPlan,
  createEmptyLearningPlan,
  createAIDraftLearningPlan,
  confirmLearningPlan,
  isSubstantiveLearningPlanChange,
  resolveLearningPlanObjectives,
  resolveLearningPlanAllocatedJP,
  LEARNING_EXPERIENCE_PHASE_LABELS,
} from '../../services/learningPlanService';
import { generateLearningPlanWithAI } from '../../services/aiService';
import { getCurriculumTypeFromSetting } from '../../services/curriculumRouter';
import { generateModulAjar } from '../../services/documentEngine/generators/modulAjarGenerator';
import { generatePdfDocument } from '../../services/documentEngine/renderers/pdf/pdfDocGenerators';
import { DocumentGenerationContext } from '../../services/documentEngine/types';
import {
  buildTPDiagnosticReport,
  recordDiagnosticEvent,
} from '../../services/diagnosticService';
import saveAs from 'file-saver';
import { TPItem, ATPItem } from '../../types';

export interface LearningPlanScopeUnit {
  id: string;
  type: 'ATP_STEP' | 'SINGLE_TP';
  title: string;
  stepNumber?: number;
  tpCode?: string;
  tpItem: TPItem;
  atpItem?: ATPItem;
  linkedTpIds: string[];
  linkedAtpItemIds: string[];
  materialScope?: string;
  jp?: number | null;
}

function isAtpReadyForAIScope(atpData?: ATPData | null): boolean {
  if (!atpData || !atpData.items || atpData.items.length === 0) return false;
  return atpData.workflowStatus === 'SIAP' && !atpData.needsReview;
}

export function resolveAvailableScopes(
  tpData?: TPData | null,
  atpData?: ATPData | null
): LearningPlanScopeUnit[] {
  const availableTps = tpData?.items || [];
  if (availableTps.length === 0) return [];

  const availableAtps = isAtpReadyForAIScope(atpData)
    ? (atpData?.items || []).filter((a) => a.tpId && availableTps.some((t) => t.id === a.tpId))
    : [];
  const representedTpIds = new Set<string>();
  const atpScopes = availableAtps.map((atpItem, index) => {
      const linkedTp = availableTps.find((t) => t.id === atpItem.tpId)!;
      representedTpIds.add(linkedTp.id);
      const stepNo = atpItem.stepNumber || index + 1;
      const material = atpItem.materialScope || linkedTp.contentScope || linkedTp.statement;
      const allocatedJP = atpItem.allocatedJP ?? atpItem.jp ?? null;

      return {
        id: atpItem.id,
        type: 'ATP_STEP' as const,
        title: `Langkah ${stepNo}: ${material}`,
        stepNumber: stepNo,
        tpCode: linkedTp.code,
        tpItem: linkedTp,
        atpItem: atpItem,
        linkedTpIds: [linkedTp.id],
        linkedAtpItemIds: [atpItem.id],
        materialScope: material,
        jp: allocatedJP,
      };
    });

  const singleTpScopes: LearningPlanScopeUnit[] = availableTps.filter((tpItem) => !representedTpIds.has(tpItem.id)).map((tpItem) => {
    return {
      id: tpItem.id,
      type: 'SINGLE_TP' as const,
      title: tpItem.code ? `[${tpItem.code}] ${tpItem.statement}` : tpItem.statement,
      tpCode: tpItem.code || undefined,
      tpItem: tpItem,
      linkedTpIds: [tpItem.id],
      linkedAtpItemIds: [],
      materialScope: tpItem.contentScope,
      jp: null,
    };
  });
  return [...atpScopes, ...singleTpScopes];
}

interface LearningPlanManagerProps {
  profile: TeacherProfile;
  school: SchoolData;
  academicSetting: AcademicSetting;
  workspace?: AdministrationWorkspace;
  tp?: TPData;
  atp?: ATPData;
  students?: Student[];
  timeAllocations?: TimeAllocation[];
  assessmentCriteria?: AssessmentCriterion[];
  learningPlans: LearningPlan[];
  onSavePlan: (plan: LearningPlan) => void;
  onDeletePlan: (planId: string) => void;
}

export const LearningPlanManager: React.FC<LearningPlanManagerProps> = ({
  profile,
  school,
  academicSetting,
  workspace,
  tp,
  atp,
  students = [],
  timeAllocations = [],
  assessmentCriteria = [],
  learningPlans = [],
  onSavePlan,
  onDeletePlan,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(() => {
    return learningPlans.length > 0 ? learningPlans[0].id : null;
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'editor' | 'preview'>('overview');
  const [editorSection, setEditorSection] = useState<'identity' | 'objectives' | 'activities' | 'assessments' | 'followup' | 'reflection'>('identity');
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Active plan resolution
  const activePlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return learningPlans.find((p) => p.id === selectedPlanId) || null;
  }, [selectedPlanId, learningPlans]);

  // Validation of active plan
  const validationResult = useMemo(() => {
    if (!activePlan) return null;
    return validateLearningPlan(activePlan, {
      academicSetting,
      tp,
      atp,
      timeAllocations,
      assessmentCriteria,
    });
  }, [activePlan, academicSetting, tp, atp, timeAllocations, assessmentCriteria]);
  const curriculumType = getCurriculumTypeFromSetting(academicSetting);
  const activePlanJpResolution = useMemo(() => {
    if (!activePlan) return null;
    return resolveLearningPlanAllocatedJP(activePlan, { atp, timeAllocations });
  }, [activePlan, atp, timeAllocations]);

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const recordLearningPlanBlocked = (reasonCode: string) => {
    recordDiagnosticEvent({
      scope: 'LEARNING_PLAN',
      action: 'LEARNING_PLAN_AI_BLOCKED',
      status: 'BLOCKED',
      metadata: {
        reasonCode,
        tpItemsCount: tp?.items?.length || 0,
        tpWorkflowStatus: tp?.workflowStatus,
        tpNeedsReview: tp?.needsReview || false,
        atpItemsCount: atp?.items?.length || 0,
        atpWorkflowStatus: atp?.workflowStatus,
        atpNeedsReview: atp?.needsReview || false,
      },
    });
  };

  const handleCopyDiagnostic = async () => {
    const gateReason = !tp || tp.workflowStatus !== 'SIAP'
      ? 'TP_STATUS_NOT_READY'
      : tp.needsReview
      ? 'TP_NEEDS_REVIEW'
      : atp?.needsReview
      ? 'ATP_NEEDS_REVIEW'
      : atp?.items?.length && !isAtpReadyForAIScope(atp)
      ? 'ATP_STATUS_NOT_READY'
      : 'ALLOWED';
    const report = buildTPDiagnosticReport({
      module: 'LEARNING_PLAN',
      workspaceId: workspace?.id,
      academicSetting,
      tp,
      uiItemsCount: tp?.items?.length || 0,
      atp,
      learningPlanGate: gateReason === 'ALLOWED' ? 'ALLOWED' : 'BLOCKED',
      learningPlanGateReason: gateReason,
    });
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
      showNotification('success', 'Diagnostik berhasil disalin.');
    } catch {
      showNotification('error', 'Gagal menyalin diagnostik. Browser tidak memberi akses clipboard.');
    }
  };

  // Create new manual empty plan
  const handleCreateNewManual = () => {
    if (curriculumType === 'K13') {
      showNotification('error', 'Penyusunan RPP K13 pada modul Perencanaan Pembelajaran ini belum didukung. Gunakan administrasi K13 yang tersedia sampai workflow K13 khusus disiapkan.');
      return;
    }
    if (curriculumType !== 'KURIKULUM_MERDEKA') {
      showNotification('error', 'Kurikulum belum terselesaikan. Rancangan manual tidak dibuat agar tidak diarahkan diam-diam ke Kurikulum Merdeka.');
      return;
    }
    const newPlan = createEmptyLearningPlan({
      academicSetting,
      curriculumType,
      tpIds: [],
      atpItemIds: [],
      context: { tp, atp },
    });

    onSavePlan(newPlan);
    setSelectedPlanId(newPlan.id);
    setActiveTab('editor');
    showNotification('success', 'Rancangan Pembelajaran baru dibuat (Status: DRAFT). Silakan pilih TP/ATP.');
  };

  const [availableScopes, setAvailableScopes] = useState<LearningPlanScopeUnit[]>([]);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  // Trigger AI Assisted Draft with strict canonical scope (0 / 1 / >1 rule)
  const handleCreateAIDraftClick = () => {
    if (curriculumType === 'K13') {
      recordLearningPlanBlocked('CURRICULUM_UNRESOLVED');
      showNotification('error', 'Penyusunan RPP K13 pada modul Perencanaan Pembelajaran ini belum didukung. Gunakan administrasi K13 yang tersedia sampai workflow K13 khusus disiapkan.');
      return;
    }
    if (curriculumType !== 'KURIKULUM_MERDEKA') {
      recordLearningPlanBlocked('CURRICULUM_UNRESOLVED');
      showNotification('error', 'Kurikulum belum terselesaikan. Draf AI tidak dibuat agar tidak diarahkan diam-diam ke Kurikulum Merdeka.');
      return;
    }
    if (!tp || tp.workflowStatus !== 'SIAP') {
      recordLearningPlanBlocked('TP_STATUS_NOT_READY');
      showNotification('error', `TP belum siap untuk AI (${tp?.workflowStatus || 'BELUM_DIMULAI'}). Tinjau TP terlebih dahulu.`);
      return;
    }
    if (tp?.needsReview) {
      recordLearningPlanBlocked('TP_NEEDS_REVIEW');
      showNotification('error', `TP perlu ditinjau sebelum AI draft: ${tp.reviewReason || 'status needsReview aktif'}.`);
      return;
    }
    if (atp?.needsReview) {
      recordLearningPlanBlocked('ATP_NEEDS_REVIEW');
      showNotification('error', `ATP perlu ditinjau sebelum AI draft: ${atp.reviewReason || 'status needsReview aktif'}.`);
      return;
    }
    if (atp?.items?.length && !isAtpReadyForAIScope(atp)) {
      recordLearningPlanBlocked('ATP_STATUS_NOT_READY');
      showNotification('error', 'ATP belum siap untuk digunakan sebagai sumber Draf AI. Tinjau dan selesaikan ATP terlebih dahulu.');
      return;
    }
    const scopes = resolveAvailableScopes(tp, atp);

    if (scopes.length === 0) {
      recordLearningPlanBlocked('NO_VALID_SCOPE');
      showNotification(
        'error',
        'Tidak ada Scope/Unit Pembelajaran yang valid. Silakan buat TP atau ATP terlebih dahulu di menu Tujuan Pembelajaran / ATP.'
      );
      return;
    }

    if (scopes.length === 1) {
      // 1 valid scope -> auto-select -> generate
      executeAIGenerationForScope(scopes[0]);
    } else {
      // >1 valid scope -> require explicit teacher selection
      setAvailableScopes(scopes);
      setIsScopeModalOpen(true);
    }
  };

  const executeAIGenerationForScope = async (scope: LearningPlanScopeUnit) => {
    setIsScopeModalOpen(false);
    setIsGeneratingAI(true);
    showNotification('info', `Sedang menyusun Draf AI Modul Ajar untuk unit '${scope.title}'...`);

    try {
      const aiDraftResult = await generateLearningPlanWithAI({
        academicSetting,
        tps: [scope.tpItem],
        atpItems: scope.atpItem ? [scope.atpItem] : [],
        topic: scope.materialScope || scope.tpItem.contentScope || scope.tpItem.statement,
      });

      const draftPlan = createAIDraftLearningPlan({
        academicSetting,
        curriculumType,
        tpIds: scope.linkedTpIds,
        atpItemIds: scope.linkedAtpItemIds,
        aiDraft: aiDraftResult,
        context: { tp, atp },
      });

      onSavePlan(draftPlan);
      setSelectedPlanId(draftPlan.id);
      setActiveTab('editor');
      showNotification(
        'success',
        `Draf AI Modul Ajar berhasil disusun untuk unit '${scope.title}' (Status: DRAFT). Silakan tinjau dan lengkapi komponen modul.`
      );
    } catch (err: any) {
      console.error('Failed to generate AI Learning Plan:', err);
      showNotification('error', `Draf AI tidak dibuat. Rancangan yang sedang terlihat adalah rancangan sebelumnya. ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Update Plan Field with SIAP status invalidation for substantive edits
  const handleUpdateActivePlan = (updates: Partial<LearningPlan>) => {
    if (!activePlan) return;
    const candidate: LearningPlan = {
      ...activePlan,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (activePlan.status === 'SIAP' && isSubstantiveLearningPlanChange(activePlan, candidate)) {
      candidate.status = 'DRAFT';
      candidate.confirmedAt = undefined;
      showNotification(
        'info',
        'Status Modul Ajar diperbarui menjadi DRAFT karena terdapat perubahan konten pedagogis. Silakan tinjau dan konfirmasi SIAP kembali.'
      );
    }

    onSavePlan(candidate);
  };

  const resolveSingleAtpForTp = (tpId: string): string[] => {
    const matches = (atp?.items || []).filter((item) => item.tpId === tpId);
    return matches.length === 1 ? [matches[0].id] : [];
  };

  const handleUpdateTpSelection = (tpId: string, checked: boolean) => {
    if (!activePlan) return;
    const nextTpIds = checked
      ? Array.from(new Set([...(activePlan.tpIds || []), tpId]))
      : (activePlan.tpIds || []).filter((id) => id !== tpId);
    const removedTpIds = new Set((activePlan.tpIds || []).filter((id) => !nextTpIds.includes(id)));
    const autoAtpIds = checked ? resolveSingleAtpForTp(tpId) : [];
    const nextAtpIds = Array.from(
      new Set([
        ...(activePlan.atpItemIds || []).filter((id) => {
          const item = (atp?.items || []).find((candidate) => candidate.id === id);
          return !item?.tpId || !removedTpIds.has(item.tpId);
        }),
        ...autoAtpIds,
      ])
    );
    const objectives = resolveLearningPlanObjectives({
      tpIds: nextTpIds,
      tp,
      curriculumType,
    }).objectives;
    handleUpdateActivePlan({ tpIds: nextTpIds, atpItemIds: nextAtpIds, objectives });
  };

  // Confirm Plan (Set to SIAP)
  const handleConfirmPlan = () => {
    if (!activePlan) return;
    const result = confirmLearningPlan(activePlan, {
      academicSetting,
      tp,
      atp,
      timeAllocations,
      assessmentCriteria,
    });

    if (result.success && result.plan.status === 'SIAP') {
      onSavePlan(result.plan);
      showNotification('success', 'Rancangan Pembelajaran berhasil diverifikasi dan dikonfirmasi SIAP untuk pelaksanaan & ekspor.');
    } else {
      onSavePlan(result.plan);
      showNotification('error', `Gagal konfirmasi SIAP: ${result.validation.errors.join('; ')}`);
    }
  };

  // Export handlers
  const handleExportDocx = async () => {
    if (!activePlan) return;
    if (activePlan.status !== 'SIAP') {
      showNotification('error', `Gagal ekspor: Rancangan Pembelajaran masih berstatus '${activePlan.status}'. Harus diverifikasi dan dikonfirmasi SIAP terlebih dahulu.`);
      return;
    }
    if (validationResult && !validationResult.isValid) {
      showNotification('error', `Gagal ekspor: Data prasyarat belum valid: ${validationResult.errors.join('; ')}`);
      return;
    }
    setIsExporting('docx');
    try {
      const docContext: DocumentGenerationContext = {
        school,
        profile,
        academicSetting,
        workspace,
        tp,
        atp,
        students,
        timeAllocations,
        assessmentCriteria,
        learningPlans: [activePlan],
        activeLearningPlanId: activePlan.id,
      };

      await generateModulAjar(docContext);
      showNotification('success', 'Modul Ajar (.docx) berhasil diunduh.');
    } catch (err: any) {
      showNotification('error', `Gagal ekspor Word: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!activePlan) return;
    if (activePlan.status !== 'SIAP') {
      showNotification('error', `Gagal ekspor: Rancangan Pembelajaran masih berstatus '${activePlan.status}'. Harus diverifikasi dan dikonfirmasi SIAP terlebih dahulu.`);
      return;
    }
    if (validationResult && !validationResult.isValid) {
      showNotification('error', `Gagal ekspor: Data prasyarat belum valid: ${validationResult.errors.join('; ')}`);
      return;
    }
    setIsExporting('pdf');
    try {
      const docContext: DocumentGenerationContext = {
        school,
        profile,
        academicSetting,
        workspace,
        tp,
        atp,
        students,
        timeAllocations,
        assessmentCriteria,
        learningPlans: [activePlan],
        activeLearningPlanId: activePlan.id,
      };

      const res = await generatePdfDocument('MODUL_AJAR', docContext);
      saveAs(res.blob, res.fileName);
      showNotification('success', 'Modul Ajar (.pdf) berhasil diunduh.');
    } catch (err: any) {
      showNotification('error', `Gagal ekspor PDF: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6" id="learning-plan-manager-container">
      {/* Header & Title */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Audit No. 8 — Perencanaan Pembelajaran Canonical
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ID Reference Only
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-blue-600" />
              Perencanaan Pembelajaran & Modul Ajar
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Penyusunan RPP / Modul Ajar berbasis Capaian Pembelajaran, TP/ATP, dan KKTP tanpa fabrikasi data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyDiagnostic}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 transition-colors"
            >
              <Clipboard className="w-4 h-4" />
              Salin Diagnostik
            </button>
            <button
              onClick={handleCreateNewManual}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Buat Manual
            </button>
            <button
              onClick={handleCreateAIDraftClick}
              disabled={isGeneratingAI}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingAI ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Menyusun AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Susun Draf AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 border ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />}
            {notification.type === 'error' && <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />}
            {notification.type === 'info' && <Info className="w-4 h-4 flex-shrink-0 text-blue-600" />}
            <span>{notification.text}</span>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List of Learning Plans */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Daftar Rancangan ({learningPlans.length})</span>
            </h3>

            {learningPlans.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-lg">
                <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">Belum ada Rancangan Pembelajaran</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Buat rancangan modul ajar baru untuk memulai penyusunan canonical.
                </p>
                <button
                  onClick={handleCreateNewManual}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Mulai Buat Rencana
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {learningPlans.map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  const isSiap = plan.status === 'SIAP';

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-800 truncate">
                            {plan.title || plan.topic || 'Rancangan Tanpa Judul'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {plan.tpIds.length} TP terpilih • {resolveLearningPlanAllocatedJP(plan, { atp, timeAllocations }).allocatedJP ? `${resolveLearningPlanAllocatedJP(plan, { atp, timeAllocations }).allocatedJP} JP` : 'Belum ada JP'}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            isSiap
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : plan.status === 'PERLU_DILENGKAPI'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {plan.status}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Sumber: {plan.sourceType}</span>
                        <span>{new Date(plan.updatedAt).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Validation Checklist Box for Active Plan */}
          {activePlan && validationResult && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Status Validasi Canonical
                </h4>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    validationResult.isValid
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {validationResult.isValid ? 'Valid' : 'Perlu Dilengkapi'}
                </span>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                  <span className="font-semibold block">Prasyarat Wajib Belum Terpenuhi:</span>
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-500">•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  <span className="font-semibold block">Catatan Kelengkapan:</span>
                  {validationResult.warnings.map((warn, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-500">•</span>
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Referensi TP Sah:</span>
                  <span className="font-semibold">{validationResult.resolvedTPs.length} TP</span>
                </div>
                <div className="flex justify-between">
                  <span>Alokasi Jam Pelajaran:</span>
                  <span className="font-semibold">
                    {validationResult.resolvedAllocatedJP !== undefined
                      ? `${validationResult.resolvedAllocatedJP} JP`
                      : 'Belum Ditetapkan'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Konfirmasi Guru:</span>
                  <span className="font-semibold">
                    {activePlan.status === 'SIAP' ? 'Terkonfirmasi (SIAP)' : 'Draf Guru'}
                  </span>
                </div>
              </div>

              {/* Confirmation Action Button */}
              {activePlan.status !== 'SIAP' ? (
                <button
                  onClick={handleConfirmPlan}
                  disabled={!validationResult.isValid}
                  className={`w-full mt-2 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                    validationResult.isValid
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  Konfirmasi SIAP (Verifikasi Guru)
                </button>
              ) : (
                <div className="w-full mt-2 py-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg text-center font-medium flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Telah Dikonfirmasi SIAP
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Active Plan Editor & Viewer */}
        <div className="lg:col-span-8">
          {activePlan ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 pt-4 bg-slate-50/50">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('editor')}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'editor'
                        ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Editor Rencana
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'preview'
                        ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pratinjau & Ekspor
                  </button>
                </div>

                <div className="flex items-center gap-2 pb-2">
                  <button
                    onClick={handleExportDocx}
                    disabled={isExporting !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Word (.docx)
                  </button>
                  <button
                    onClick={handleExportPdf}
                    disabled={isExporting !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Hapus rencana pembelajaran ini?')) {
                        onDeletePlan(activePlan.id);
                        setSelectedPlanId(null);
                        showNotification('info', 'Rancangan pembelajaran dihapus.');
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                    title="Hapus Rencana"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tab Content: Editor */}
              {activeTab === 'editor' && (
                <div className="p-6 space-y-6">
                  {/* Editor sub-section pills */}
                  <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
                    {[
                      { id: 'identity', label: '1. Identitas & Model' },
                      { id: 'objectives', label: '2. Tujuan (TP/ATP)' },
                      { id: 'activities', label: '3. Langkah Kegiatan' },
                      { id: 'assessments', label: '4. Asesmen' },
                      { id: 'followup', label: '5. Pengayaan & Remedial' },
                      { id: 'reflection', label: '6. Refleksi' },
                    ].map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => setEditorSection(sec.id as any)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          editorSection === sec.id
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>

                  {/* Section 1: Identitas & Model */}
                  {editorSection === 'identity' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Judul / Topik Pembelajaran <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={activePlan.topic || activePlan.title || ''}
                            onChange={(e) => handleUpdateActivePlan({ topic: e.target.value, title: e.target.value })}
                            placeholder="Contoh: Operasi Penjumlahan Bilangan Cacah"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Alokasi Jam Pelajaran (JP)
                          </label>
                          <input
                            type="number"
                            value={activePlan.allocatedJP || ''}
                            onChange={(e) => handleUpdateActivePlan({ allocatedJP: e.target.value ? Number(e.target.value) : undefined })}
                            placeholder="Contoh: 4"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Model & Pendekatan Pembelajaran
                          </label>
                          <input
                            type="text"
                            value={activePlan.learningModel || ''}
                            onChange={(e) => handleUpdateActivePlan({ learningModel: e.target.value })}
                            placeholder="Contoh: Problem Based Learning (PBL), Saintifik"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Target Peserta Didik
                          </label>
                          <input
                            type="text"
                            value={activePlan.targetStudents || ''}
                            onChange={(e) => handleUpdateActivePlan({ targetStudents: e.target.value })}
                            placeholder="Contoh: Reguler / Tipikal (28 Siswa)"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kompetensi Awal (Prasyarat Belajar Siswa)
                        </label>
                        <textarea
                          rows={2}
                          value={activePlan.initialCompetency || ''}
                          onChange={(e) => handleUpdateActivePlan({ initialCompetency: e.target.value })}
                          placeholder="Deskripsikan pengetahuan atau keterampilan prasyarat yang dimiliki siswa..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Sarana & Sumber Belajar
                        </label>
                        <textarea
                          rows={2}
                          value={(activePlan.resources || []).map((r) => r.title).join('\n')}
                          onChange={(e) => {
                            const lines = e.target.value.split('\n').filter((l) => l.trim().length > 0);
                            handleUpdateActivePlan({
                              resources: lines.map((l, idx) => ({ id: `res-${Date.now()}-${idx + 1}`, type: 'other', title: l.trim() })),
                            });
                          }}
                          placeholder="Tuliskan daftar sarana/alat/sumber per baris (contoh: Buku Guru, LCD Proyektor, LKPD)..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 2: Tujuan (Strict Canonical TP & ATP links) */}
                  {editorSection === 'objectives' && (
                    <div className="space-y-4">
                      <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                        <span className="font-semibold block">Prinsip Canonical ID Reference:</span>
                        Pilih Tujuan Pembelajaran (TP) dan Tahapan ATP resmi yang terhubung dengan modul ajar ini. Data dirujuk secara deterministik berdasarkan ID.
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Pilih Tujuan Pembelajaran Terkait (TP) <span className="text-rose-500">*</span>
                        </label>
                        {tp?.items && tp.items.length > 0 ? (
                          <div className="space-y-2 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                            {tp.items.map((t) => {
                              const isChecked = activePlan.tpIds.includes(t.id);
                              return (
                                <label
                                  key={t.id}
                                  className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer border transition-colors ${
                                    isChecked
                                      ? 'bg-white border-blue-400 shadow-2xs'
                                      : 'bg-white/50 border-slate-200 hover:bg-white'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      handleUpdateTpSelection(t.id, e.target.checked);
                                    }}
                                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="text-xs">
                                    <span className="font-bold text-slate-800 mr-1.5">[{t.code || 'TP'}]</span>
                                    <span className="text-slate-700">{t.statement}</span>
                                    {t.materialScope && (
                                      <span className="text-slate-400 block mt-0.5">Materi: {t.materialScope}</span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-rose-600 italic">Data TP belum disusun di workspace ini.</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Tahapan ATP Terkait
                        </label>
                        {atp?.items && atp.items.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                            {atp.items.map((item) => {
                              const linkedTp = tp?.items?.find((t) => t.id === item.tpId);
                              const isChecked = (activePlan.atpItemIds || []).includes(item.id);
                              return (
                                <label key={item.id} className="flex items-start gap-2.5 p-2 rounded-md cursor-pointer border bg-white/70 border-slate-200 hover:bg-white">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const nextAtpIds = e.target.checked
                                        ? Array.from(new Set([...(activePlan.atpItemIds || []), item.id]))
                                        : (activePlan.atpItemIds || []).filter((id) => id !== item.id);
                                      const nextTpIds = item.tpId && e.target.checked
                                        ? Array.from(new Set([...(activePlan.tpIds || []), item.tpId]))
                                        : activePlan.tpIds;
                                      const objectives = resolveLearningPlanObjectives({ tpIds: nextTpIds, tp, curriculumType }).objectives;
                                      handleUpdateActivePlan({ atpItemIds: nextAtpIds, tpIds: nextTpIds, objectives });
                                    }}
                                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="text-xs">
                                    <span className="font-bold text-slate-800 mr-1.5">Langkah {item.stepNumber || '-'}</span>
                                    <span className="text-slate-700">{item.materialScope || item.tpStatement || linkedTp?.statement || 'ATP belum berisi materi'}</span>
                                    <span className="text-slate-400 block mt-0.5">
                                      {linkedTp?.code || 'TP'} • {item.jp ?? item.allocatedJP ?? 'JP belum ditentukan'} JP
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">ATP belum tersedia. TP tetap dapat dipilih tanpa ATP.</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Pemahaman Bermakna
                        </label>
                        <textarea
                          rows={2}
                          value={activePlan.meaningfulUnderstanding || ''}
                          onChange={(e) => handleUpdateActivePlan({ meaningfulUnderstanding: e.target.value })}
                          placeholder="Deskripsikan pemahaman esensial yang akan didapatkan siswa..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Pertanyaan Pemantik (1 per baris)
                        </label>
                        <textarea
                          rows={3}
                          value={(activePlan.triggerQuestions || []).join('\n')}
                          onChange={(e) => {
                            const questions = e.target.value.split('\n').filter((q) => q.trim().length > 0);
                            handleUpdateActivePlan({ triggerQuestions: questions });
                          }}
                          placeholder="1. Mengapa materi ini penting untuk kita pahami?&#10;2. Bagaimana kita memanfaatkannya dalam kehidupan nyata?"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 3: Langkah Kegiatan Pembelajaran */}
                  {editorSection === 'activities' && (
                    <div className="space-y-4">
                      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-blue-900">
                            Pengalaman Belajar Canonical 2026
                          </label>
                          <button
                            onClick={() => {
                              const curr = activePlan.learningExperiences || [];
                              handleUpdateActivePlan({
                                learningExperiences: [
                                  ...curr,
                                  { id: `exp-${Date.now()}`, phase: 'UNDERSTAND', description: '', durationMinutes: undefined },
                                ],
                              });
                            }}
                            className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah Pengalaman
                          </button>
                        </div>

                        {(activePlan.learningExperiences || []).map((exp, idx) => (
                          <div key={exp.id || idx} className="grid grid-cols-1 md:grid-cols-[160px_1fr_90px_32px] gap-2 items-center">
                            <select
                              value={exp.phase}
                              onChange={(e) => {
                                const list = [...(activePlan.learningExperiences || [])];
                                list[idx] = { ...list[idx], phase: e.target.value as LearningExperiencePhase };
                                handleUpdateActivePlan({ learningExperiences: list });
                              }}
                              className="px-2 py-1.5 text-xs border border-blue-200 rounded-md bg-white"
                            >
                              <option value="UNDERSTAND">Memahami</option>
                              <option value="APPLY">Mengaplikasi</option>
                              <option value="REFLECT">Merefleksi</option>
                            </select>
                            <input
                              type="text"
                              value={exp.description}
                              onChange={(e) => {
                                const list = [...(activePlan.learningExperiences || [])];
                                list[idx] = { ...list[idx], description: e.target.value };
                                handleUpdateActivePlan({ learningExperiences: list });
                              }}
                              placeholder="Deskripsi pengalaman belajar..."
                              className="px-3 py-1.5 text-xs border border-blue-200 rounded-md bg-white"
                            />
                            <input
                              type="number"
                              value={exp.durationMinutes || ''}
                              onChange={(e) => {
                                const list = [...(activePlan.learningExperiences || [])];
                                list[idx] = { ...list[idx], durationMinutes: e.target.value ? Number(e.target.value) : undefined };
                                handleUpdateActivePlan({ learningExperiences: list });
                              }}
                              placeholder="Menit"
                              className="px-2 py-1.5 text-xs border border-blue-200 rounded-md bg-white text-center"
                            />
                            <button
                              onClick={() => {
                                const list = (activePlan.learningExperiences || []).filter((_, i) => i !== idx);
                                handleUpdateActivePlan({ learningExperiences: list });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {(activePlan.learningExperiences || []).length === 0 && (
                          <p className="text-xs text-blue-700 italic">Belum ada Pengalaman Belajar canonical. Tambahkan atau gunakan draf AI, tanpa membuat fallback palsu.</p>
                        )}
                      </div>

                      {/* Pendahuluan */}
                      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800">
                            A. Kegiatan Pendahuluan
                          </label>
                          <button
                            onClick={() => {
                              const curr = activePlan.learningSteps?.opening || [];
                              handleUpdateActivePlan({
                                learningSteps: {
                                  ...activePlan.learningSteps,
                                  opening: [...curr, { id: `open-${Date.now()}`, phase: 'opening', description: '', durationMinutes: undefined }],
                                  core: activePlan.learningSteps?.core || [],
                                  closing: activePlan.learningSteps?.closing || [],
                                },
                              });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah Langkah
                          </button>
                        </div>

                        {(activePlan.learningSteps?.opening || []).map((step, idx) => (
                          <div key={step.id || idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={step.description}
                              onChange={(e) => {
                                const list = [...(activePlan.learningSteps?.opening || [])];
                                list[idx] = { ...list[idx], description: e.target.value };
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: list, core: activePlan.learningSteps?.core || [], closing: activePlan.learningSteps?.closing || [] },
                                });
                              }}
                              placeholder="Deskripsi kegiatan pendahuluan (orientasi, apersepsi, motivasi)..."
                              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                            />
                            <input
                              type="number"
                              value={step.durationMinutes || ''}
                              onChange={(e) => {
                                const list = [...(activePlan.learningSteps?.opening || [])];
                                list[idx] = { ...list[idx], durationMinutes: Number(e.target.value) || undefined };
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: list, core: activePlan.learningSteps?.core || [], closing: activePlan.learningSteps?.closing || [] },
                                });
                              }}
                              placeholder="Menit"
                              className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-center"
                            />
                            <button
                              onClick={() => {
                                const list = (activePlan.learningSteps?.opening || []).filter((_, i) => i !== idx);
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: list, core: activePlan.learningSteps?.core || [], closing: activePlan.learningSteps?.closing || [] },
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Inti */}
                      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800">
                            B. Kegiatan Inti (Berdiferensiasi)
                          </label>
                          <button
                            onClick={() => {
                              const curr = activePlan.learningSteps?.core || [];
                              handleUpdateActivePlan({
                                learningSteps: {
                                  ...activePlan.learningSteps,
                                  opening: activePlan.learningSteps?.opening || [],
                                  core: [...curr, { id: `core-${Date.now()}`, phase: 'core', description: '', durationMinutes: undefined }],
                                  closing: activePlan.learningSteps?.closing || [],
                                },
                              });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah Langkah
                          </button>
                        </div>

                        {(activePlan.learningSteps?.core || []).map((step, idx) => (
                          <div key={step.id || idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={step.description}
                              onChange={(e) => {
                                const list = [...(activePlan.learningSteps?.core || [])];
                                list[idx] = { ...list[idx], description: e.target.value };
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: activePlan.learningSteps?.opening || [], core: list, closing: activePlan.learningSteps?.closing || [] },
                                });
                              }}
                              placeholder="Deskripsi aktivitas eksplorasi, diskusi, diferensiasi konten/proses..."
                              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                            />
                            <input
                              type="number"
                              value={step.durationMinutes || ''}
                              onChange={(e) => {
                                const list = [...(activePlan.learningSteps?.core || [])];
                                list[idx] = { ...list[idx], durationMinutes: Number(e.target.value) || undefined };
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: activePlan.learningSteps?.opening || [], core: list, closing: activePlan.learningSteps?.closing || [] },
                                });
                              }}
                              placeholder="Menit"
                              className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-center"
                            />
                            <button
                              onClick={() => {
                                const list = (activePlan.learningSteps?.core || []).filter((_, i) => i !== idx);
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: activePlan.learningSteps?.opening || [], core: list, closing: activePlan.learningSteps?.closing || [] },
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Penutup */}
                      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800">
                            C. Kegiatan Penutup
                          </label>
                          <button
                            onClick={() => {
                              const curr = activePlan.learningSteps?.closing || [];
                              handleUpdateActivePlan({
                                learningSteps: {
                                  ...activePlan.learningSteps,
                                  opening: activePlan.learningSteps?.opening || [],
                                  core: activePlan.learningSteps?.core || [],
                                  closing: [...curr, { id: `close-${Date.now()}`, phase: 'closing', description: '', durationMinutes: undefined }],
                                },
                              });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah Langkah
                          </button>
                        </div>

                        {(activePlan.learningSteps?.closing || []).map((step, idx) => (
                          <div key={step.id || idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={step.description}
                              onChange={(e) => {
                                const list = [...(activePlan.learningSteps?.closing || [])];
                                list[idx] = { ...list[idx], description: e.target.value };
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: activePlan.learningSteps?.opening || [], core: activePlan.learningSteps?.core || [], closing: list },
                                });
                              }}
                              placeholder="Deskripsi kesimpulan, refleksi, tindak lanjut, doa..."
                              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                            />
                            <input
                              type="number"
                              value={step.durationMinutes || ''}
                              onChange={(e) => {
                                const list = [...(activePlan.learningSteps?.closing || [])];
                                list[idx] = { ...list[idx], durationMinutes: Number(e.target.value) || undefined };
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: activePlan.learningSteps?.opening || [], core: activePlan.learningSteps?.core || [], closing: list },
                                });
                              }}
                              placeholder="Menit"
                              className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-center"
                            />
                            <button
                              onClick={() => {
                                const list = (activePlan.learningSteps?.closing || []).filter((_, i) => i !== idx);
                                handleUpdateActivePlan({
                                  learningSteps: { ...activePlan.learningSteps, opening: activePlan.learningSteps?.opening || [], core: activePlan.learningSteps?.core || [], closing: list },
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 4: Asesmen */}
                  {editorSection === 'assessments' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          A. Rencana Asesmen Awal (Diagnostik)
                        </label>
                        <input
                          type="text"
                          value={(activePlan.assessmentPlan?.initial || []).map((a) => a.description).join('; ')}
                          onChange={(e) => {
                            const desc = e.target.value;
                            handleUpdateActivePlan({
                              assessmentPlan: {
                                ...activePlan.assessmentPlan,
                                initial: desc ? [{ id: 'asm-init-1', type: 'INITIAL', description: desc }] : [],
                                formative: activePlan.assessmentPlan?.formative || [],
                                summative: activePlan.assessmentPlan?.summative || [],
                              },
                            });
                          }}
                          placeholder="Contoh: Tanya jawab apersepsi lisan terkait konsep awal..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          B. Rencana Asesmen Formatif (Proses)
                        </label>
                        <input
                          type="text"
                          value={(activePlan.assessmentPlan?.formative || []).map((a) => a.description).join('; ')}
                          onChange={(e) => {
                            const desc = e.target.value;
                            handleUpdateActivePlan({
                              assessmentPlan: {
                                ...activePlan.assessmentPlan,
                                initial: activePlan.assessmentPlan?.initial || [],
                                formative: desc ? [{ id: 'asm-form-1', type: 'FORMATIVE', description: desc }] : [],
                                summative: activePlan.assessmentPlan?.summative || [],
                              },
                            });
                          }}
                          placeholder="Contoh: Observasi diskusi kelompok dan lembar kerja peserta didik (LKPD)..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          C. Rencana Asesmen Sumatif (Akhir TP/Materi)
                        </label>
                        <input
                          type="text"
                          value={(activePlan.assessmentPlan?.summative || []).map((a) => a.description).join('; ')}
                          onChange={(e) => {
                            const desc = e.target.value;
                            handleUpdateActivePlan({
                              assessmentPlan: {
                                ...activePlan.assessmentPlan,
                                initial: activePlan.assessmentPlan?.initial || [],
                                formative: activePlan.assessmentPlan?.formative || [],
                                summative: desc ? [{ id: 'asm-sum-1', type: 'SUMMATIVE', description: desc }] : [],
                              },
                            });
                          }}
                          placeholder="Contoh: Tes tertulis objektif dan tugas portofolio mandiri..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 5: Pengayaan & Remedial (Planning only) */}
                  {editorSection === 'followup' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Rencana Pembelajaran Pengayaan
                        </label>
                        <textarea
                          rows={3}
                          value={activePlan.enrichmentPlan || ''}
                          onChange={(e) => handleUpdateActivePlan({ enrichmentPlan: e.target.value })}
                          placeholder="Deskripsikan rancangan aktivitas pengayaan bagi siswa yang telah mencapai KKTP..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Rencana Pembelajaran Remedial
                        </label>
                        <textarea
                          rows={3}
                          value={activePlan.remedialPlan || ''}
                          onChange={(e) => handleUpdateActivePlan({ remedialPlan: e.target.value })}
                          placeholder="Deskripsikan strategi bimbingan ulang / penyederhanaan materi bagi siswa yang belum tuntas..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 6: Refleksi */}
                  {editorSection === 'reflection' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Panduan Refleksi Guru
                        </label>
                        <textarea
                          rows={3}
                          value={activePlan.reflection?.teacherReflection || ''}
                          onChange={(e) =>
                            handleUpdateActivePlan({
                              reflection: {
                                ...activePlan.reflection,
                                teacherReflection: e.target.value,
                                studentReflection: activePlan.reflection?.studentReflection || '',
                              },
                            })
                          }
                          placeholder="Pertanyaan refleksi guru untuk evaluasi efektivitas pembelajaran..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Panduan Refleksi Peserta Didik
                        </label>
                        <textarea
                          rows={3}
                          value={activePlan.reflection?.studentReflection || ''}
                          onChange={(e) =>
                            handleUpdateActivePlan({
                              reflection: {
                                ...activePlan.reflection,
                                teacherReflection: activePlan.reflection?.teacherReflection || '',
                                studentReflection: e.target.value,
                              },
                            })
                          }
                          placeholder="Pertanyaan panduan refleksi bagi siswa setelah pembelajaran selesai..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Preview */}
              {activeTab === 'preview' && (
                <div className="p-6 space-y-4 bg-slate-50">
                  <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-sm font-sans">
                    <div className="text-center border-b pb-4">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">
                        {activePlan.status === 'SIAP' ? 'DOKUMEN RESMI' : 'DRAF PERENCANAAN'}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        MODUL AJAR / RPP BERDIFERENSIASI
                      </h3>
                      <p className="text-xs text-slate-500">
                        {academicSetting.curriculum} • {academicSetting.grade} • {school.name}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs border-b pb-3 text-slate-600">
                      <div>Topik: <span className="font-semibold text-slate-800">{activePlan.topic || activePlan.title}</span></div>
                      <div>Alokasi Waktu: <span className="font-semibold text-slate-800">{activePlanJpResolution?.allocatedJP ? `${activePlanJpResolution.allocatedJP} JP` : '-'}</span></div>
                      <div>Guru: <span className="font-semibold text-slate-800">{profile.name}</span></div>
                      <div>Status: <span className="font-semibold text-slate-800">{activePlan.status} ({activePlan.sourceType})</span></div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">I. TUJUAN PEMBELAJARAN:</span>
                        <div className="mt-1 pl-3 text-slate-700 space-y-0.5">
                          {validationResult?.resolvedTPs.map((t, idx) => (
                            <div key={t.id}>
                              {idx + 1}. [{t.code || 'TP'}] {t.statement}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-800 block">II. KEGIATAN PEMBELAJARAN:</span>
                        <div className="mt-1 pl-3 space-y-1 text-slate-700">
                          {(activePlan.learningExperiences || []).length > 0 ? (
                            (['UNDERSTAND', 'APPLY', 'REFLECT'] as const).map((phase) => (
                              <div key={phase}>
                                <span className="font-semibold">{LEARNING_EXPERIENCE_PHASE_LABELS[phase]}:</span>{' '}
                                {(activePlan.learningExperiences || [])
                                  .filter((exp) => exp.phase === phase)
                                  .map((exp) => `${exp.description}${exp.durationMinutes ? ` (${exp.durationMinutes} menit)` : ''}`)
                                  .join('; ') || '-'}
                              </div>
                            ))
                          ) : (
                            <>
                              <div>
                                <span className="font-semibold">Pendahuluan:</span>{' '}
                                {(activePlan.learningSteps?.opening || []).map((s) => s.description).join('; ') || '-'}
                              </div>
                              <div>
                                <span className="font-semibold">Inti:</span>{' '}
                                {(activePlan.learningSteps?.core || []).map((s) => s.description).join('; ') || '-'}
                              </div>
                              <div>
                                <span className="font-semibold">Penutup:</span>{' '}
                                {(activePlan.learningSteps?.closing || []).map((s) => s.description).join('; ') || '-'}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-800 block">III. ASESMEN:</span>
                        <div className="mt-1 pl-3 text-slate-700 space-y-0.5">
                          <div>Awal: {(activePlan.assessmentPlan?.initial || []).map((a) => a.description).join('; ') || '-'}</div>
                          <div>Formatif: {(activePlan.assessmentPlan?.formative || []).map((a) => a.description).join('; ') || '-'}</div>
                          <div>Sumatif: {(activePlan.assessmentPlan?.summative || []).map((a) => a.description).join('; ') || '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Pilih atau Buat Rancangan Pembelajaran</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Silakan pilih salah satu draf pada daftar sebelah kiri atau klik tombol "Buat Manual / Susun Draf AI" di atas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog: Scope Selector (>1 Scope Available) */}
      {isScopeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">Pilih Scope / Unit Pembelajaran Modul Ajar</h3>
              </div>
              <button
                onClick={() => setIsScopeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                title="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              <p className="text-sm text-slate-600 mb-2">
                Satu Modul Pembelajaran AI harus mempunyai scope pedagogis yang spesifik. Ditemukan{' '}
                <span className="font-semibold text-slate-800">{availableScopes.length} unit pembelajaran</span>.{' '}
                Pilih unit yang akan disusun drafnya:
              </p>

              <div className="space-y-2.5">
                {availableScopes.map((scope) => (
                  <div
                    key={scope.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group"
                  >
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {scope.stepNumber && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-md">
                            Langkah {scope.stepNumber}
                          </span>
                        )}
                        {scope.tpCode ? (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-md">
                            {scope.tpCode}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-md italic">
                            Tanpa kode
                          </span>
                        )}
                        {scope.jp && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                            {scope.jp} JP
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">{scope.title}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2">{scope.tpItem.statement}</p>
                    </div>

                    <button
                      onClick={() => executeAIGenerationForScope(scope)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 flex-shrink-0 shadow-2xs group-hover:scale-102 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Susun Draf Ini</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsScopeModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
