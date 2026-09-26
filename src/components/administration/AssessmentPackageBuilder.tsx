import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  FileSpreadsheet,
  ListOrdered,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Edit2,
  Save,
  Layers,
  BookOpen,
} from 'lucide-react';
import {
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AdministrationWorkspace,
  TPData,
  K13Analysis,
  AssessmentCriterion,
  AssessmentPlan,
  AssessmentPackage,
  AssessmentBlueprintItem,
  AssessmentInstrument,
  WrittenAssessmentInstrument,
  WrittenAssessmentItem,
  WrittenAssessmentOption,
  OralAssessmentInstrument,
  PerformanceAssessmentInstrument,
  ObservationAssessmentInstrument,
  AssignmentAssessmentInstrument,
  ProjectAssessmentInstrument,
  ProductAssessmentInstrument,
  PortfolioAssessmentInstrument,
  SelfPeerAssessmentInstrument,
  AssessmentAnswerKey,
  AssessmentScoringGuide,
  AssessmentRubric,
  RubricCriterion,
  RubricScaleLevel,
  AssessmentInstrumentType,
  WrittenAssessmentItemType,
  ShortAnswerResponseMode,
  MatchingAssessmentEntry,
  MatchingAssessmentPair,
  CategoryResponseStatement,
  CategoryResponseCategory,
  AssessmentRegenerationTarget,
} from '../../types';
import {
  createEmptyAssessmentPackage,
  validateAssessmentPackage,
  confirmAssessmentPackage,
  canConfirmAssessmentPackage,
} from '../../services/assessmentPackageService';
import { isK13, isMerdeka } from '../../services/curriculumRouter';
import { resolveAssessmentGenerationUIState } from '../../services/assessmentGenerationUIStateResolver';
import { resolveAssessmentGenerationSpec } from '../../services/assessmentGenerationSpecService';
import { resolveAssessmentGenerationPlan } from '../../services/assessmentGenerationPlanService';
import { generateAssessmentPackageDraft } from '../../services/assessmentPackageGeneratorService';
import { assessmentRegenerationService } from '../../services/assessmentRegenerationService';
import { assessmentRegenerationEligibilityService } from '../../services/assessmentRegenerationEligibilityService';
import { validateGeneratedAssessment } from '../../services/assessmentValidationService';
import { exportAssessmentDocx, exportAssessmentPdf, createAssessmentPreviewModel } from '../../services/documentEngine/assessmentExportService';
import { AssessmentDocumentPreview } from './AssessmentDocumentPreview';
import { DocumentGenerationContext } from '../../services/documentEngine/types';
import { RefreshCw, AlertOctagon, Info, Printer, Eye } from 'lucide-react';

interface AssessmentPackageBuilderProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  workspace?: AdministrationWorkspace;
  tp?: TPData;
  k13Analysis?: K13Analysis;
  assessmentCriteria?: AssessmentCriterion[];
  assessmentPlans?: AssessmentPlan[];
  assessmentPackages?: AssessmentPackage[];
  onSaveAssessmentPackage: (pkg: AssessmentPackage) => void;
  onDeleteAssessmentPackage?: (pkgId: string) => void;
}

export const AssessmentPackageBuilder: React.FC<AssessmentPackageBuilderProps> = ({
  school,
  profile,
  academicSetting,
  workspace,
  tp,
  k13Analysis,
  assessmentCriteria = [],
  assessmentPlans = [],
  assessmentPackages = [],
  onSaveAssessmentPackage,
  onDeleteAssessmentPackage,
}) => {
  const readyPlans = assessmentPlans.filter((p) => p.workflowStatus === 'SIAP' && p.needsReview !== true);

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // Ref for authoritative current-package lookup (Blocker 4)
  const latestPackagesRef = useRef(assessmentPackages);
  useEffect(() => {
    latestPackagesRef.current = assessmentPackages;
  }, [assessmentPackages]);

  const [activeTab, setActiveTab] = useState<'overview' | 'blueprint' | 'instruments' | 'keys_rubrics' | 'preview' | 'validation'>('overview');
  const [activeInstType, setActiveInstType] = useState<AssessmentInstrumentType | ''>('');

  // 9C.7 AI Generation & Validation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const selectedPlan = assessmentPlans.find((p) => p.id === selectedPlanId);
  const activePackage = assessmentPackages.find((pkg) => pkg.assessmentPlanId === selectedPlanId);

  useEffect(() => {
    setValidationReport(null);
  }, [activePackage?.id]);

  const validationContext = {
    academicSetting,
    assessmentPlan: selectedPlan,
    tp,
    k13Analysis,
    assessmentCriteria,
  };

  const confirmationEligible = activePackage
    ? canConfirmAssessmentPackage(activePackage, validationContext, validationReport).eligible
    : false;

  // Deterministic state machine resolver
  const uiState = resolveAssessmentGenerationUIState({
    selectedPlanId,
    assessmentPlan: selectedPlan,
    activePackage,
    isGenerating,
    isRegenerating,
    isValidating,
    academicSetting,
    tp,
    k13Analysis,
    assessmentCriteria,
    validationReport,
    confirmationEligible,
  });

  // Synchronize active instrument tab
  useEffect(() => {
    if (selectedPlan && selectedPlan.instruments.length > 0) {
      if (!activeInstType || !selectedPlan.instruments.some((i) => i.type === activeInstType)) {
        setActiveInstType(selectedPlan.instruments[0].type);
      }
    }
  }, [selectedPlan, activeInstType]);

  const validationResult = activePackage
    ? validateAssessmentPackage(activePackage, validationContext)
    : { valid: false, errors: ['Belum ada Perangkat Asesmen.'], warnings: [] };

  // Helper to handle creation of new empty package
  const handleCreatePackage = () => {
    if (!selectedPlan || selectedPlan.workflowStatus !== 'SIAP' || selectedPlan.needsReview) return;
    const newPkg = createEmptyAssessmentPackage(selectedPlan, academicSetting.id, workspace?.id);
    onSaveAssessmentPackage(newPkg);
    setValidationReport(null);
  };

  // Helper to update active package with centralized manual edit logic and field-level provenance tracking (Blocker 5)
  const updatePackage = (updated: AssessmentPackage) => {
    if (!activePackage) return;

    // 1. Clone package
    const pkgCopy = JSON.parse(JSON.stringify(updated)) as AssessmentPackage;

    // 2. Intelligently detect what changed between activePackage and updated to add/merge field-level provenance
    if (activePackage.title !== updated.title) {
      pkgCopy.provenance = pkgCopy.provenance || {};
      const provRec = pkgCopy.provenance as Record<string, unknown>;
      provRec.fields = provRec.fields || {};
      (provRec.fields as Record<string, string>)['title'] = 'TEACHER_EDITED';
    }
    // Detect changed instruments
    pkgCopy.instruments.forEach((inst) => {
      const oldInst = activePackage.instruments.find((i) => i.id === inst.id);
      if (oldInst) {
        const instRec = inst as AssessmentInstrument & Record<string, unknown>;
        const oldInstRec = oldInst as AssessmentInstrument & Record<string, unknown>;
        instRec.provenance = JSON.parse(JSON.stringify(oldInstRec.provenance || {}));
        const primitiveFields = [
          'title',
          'task',
          'instructions',
          'expectedOutput',
          'projectBrief',
          'expectedDeliverable',
          'productBrief',
          'expectedProduct',
          'recordingScheme',
          'responseScheme',
        ];
        primitiveFields.forEach((f) => {
          if (instRec[f] !== oldInstRec[f]) {
            instRec.provenance = instRec.provenance || {};
            const provRec = instRec.provenance as Record<string, unknown>;
            provRec.fields = provRec.fields || {};
            (provRec.fields as Record<string, string>)[f] = 'TEACHER_EDITED';
          }
        });
        const objectOrArrayFields = ['evidenceRequirements', 'items', 'aspects'];
        objectOrArrayFields.forEach((f) => {
          if (JSON.stringify(instRec[f]) !== JSON.stringify(oldInstRec[f])) {
            instRec.provenance = instRec.provenance || {};
            const provRec = instRec.provenance as Record<string, unknown>;
            provRec.fields = provRec.fields || {};
            (provRec.fields as Record<string, string>)[f] = 'TEACHER_EDITED';
          }
        });
        // If it's a written instrument, check written items too
        if (inst.type === 'WRITTEN_TEST') {
          const wr = inst;
          const oldWr = oldInst as WrittenAssessmentInstrument;
          wr.items?.forEach((item) => {
            const oldItem = oldWr.items?.find((oi) => oi.id === item.id);
            if (oldItem) {
              const itemRec = item as WrittenAssessmentItem & Record<string, unknown>;
              const oldItemRec = oldItem as WrittenAssessmentItem & Record<string, unknown>;

              itemRec.provenance = JSON.parse(JSON.stringify(oldItemRec.provenance || {}));

              if (item.prompt !== oldItem.prompt) {
                itemRec.provenance = itemRec.provenance || {};
                const provRec = itemRec.provenance as Record<string, unknown>;
                provRec.fields = provRec.fields || {};
                (provRec.fields as Record<string, string>)['prompt'] = 'TEACHER_EDITED';
              }

              if (JSON.stringify(item.options) !== JSON.stringify(oldItem.options)) {
                itemRec.provenance = itemRec.provenance || {};
                const provRec = itemRec.provenance as Record<string, unknown>;
                provRec.fields = provRec.fields || {};
                (provRec.fields as Record<string, string>)['options'] = 'TEACHER_EDITED';
              }

              if (item.stimulus !== oldItem.stimulus) {
                itemRec.provenance = itemRec.provenance || {};
                const provRec = itemRec.provenance as Record<string, unknown>;
                provRec.fields = provRec.fields || {};
                (provRec.fields as Record<string, string>)['stimulus'] = 'TEACHER_EDITED';
              }
            }
          });
        }
      }
    });
    // Detect changed rubrics
    pkgCopy.rubrics.forEach((rub) => {
      const oldRub = activePackage.rubrics.find((r) => r.id === rub.id);
      if (oldRub) {
        const rubRec = rub as AssessmentRubric & Record<string, unknown>;
        const oldRubRec = oldRub as AssessmentRubric & Record<string, unknown>;
        rubRec.provenance = JSON.parse(JSON.stringify(oldRubRec.provenance || {}));
        const fieldsToCheck = ['title', 'criteria', 'scale'];
        fieldsToCheck.forEach((f) => {
          if (JSON.stringify(rubRec[f]) !== JSON.stringify(oldRubRec[f])) {
            rubRec.provenance = rubRec.provenance || {};
            const provRec = rubRec.provenance as Record<string, unknown>;
            provRec.fields = provRec.fields || {};
            (provRec.fields as Record<string, string>)[f] = 'TEACHER_EDITED';
          }
        });
      }
    });
    // Detect changed blueprintItems
    pkgCopy.blueprintItems.forEach((bp) => {
      const oldBp = activePackage.blueprintItems.find((b) => b.id === bp.id);
      if (oldBp) {
        const bpRec = bp as AssessmentBlueprintItem & Record<string, unknown>;
        const oldBpRec = oldBp as AssessmentBlueprintItem & Record<string, unknown>;
        bpRec.provenance = JSON.parse(JSON.stringify(oldBpRec.provenance || {}));
        const fieldsToCheck = ['assessmentIndicator', 'materialOrContext'];
        fieldsToCheck.forEach((f) => {
          if (bpRec[f] !== oldBpRec[f]) {
            bpRec.provenance = bpRec.provenance || {};
            const provRec = bpRec.provenance as Record<string, unknown>;
            provRec.fields = provRec.fields || {};
            (provRec.fields as Record<string, string>)[f] = 'TEACHER_EDITED';
          }
        });
      }
    });
    // Detect changed answerKeys
    pkgCopy.answerKeys.forEach((ak) => {
      const oldAk = activePackage.answerKeys.find((k) => k.id === ak.id);
      if (oldAk) {
        const akRec = ak as AssessmentAnswerKey & Record<string, unknown>;
        const oldAkRec = oldAk as AssessmentAnswerKey & Record<string, unknown>;
        akRec.provenance = JSON.parse(JSON.stringify(oldAkRec.provenance || {}));
        const fieldsToCheck = ['value', 'answer', 'optionIds', 'matchingPairs', 'categoryAnswers'];
        fieldsToCheck.forEach((f) => {
          if (JSON.stringify(akRec[f]) !== JSON.stringify(oldAkRec[f])) {
            akRec.provenance = akRec.provenance || {};
            const provRec = akRec.provenance as Record<string, unknown>;
            provRec.fields = provRec.fields || {};
            (provRec.fields as Record<string, string>)[f] = 'TEACHER_EDITED';
          }
        });
      }
    });

    // 3. Mark package level attributes: revert to DRAFT, needs review, update timestamp, increment revision
    pkgCopy.workflowStatus = 'DRAFT';
    pkgCopy.needsReview = true;
    pkgCopy.revision = (activePackage.revision ?? 1) + 1;
    pkgCopy.updatedAt = new Date().toISOString();

    // 4. Invalidate validation state in UI
    setValidationReport(null);

    // 5. Persist
    onSaveAssessmentPackage(pkgCopy);
  };

  // 9C.7 Auto Generate First Integration
  const handleAutoGeneratePackage = async () => {
    if (!selectedPlan) return;
    setIsGenerating(true);
    setGenerationError(null);

    try {
      // 1. Resolve Generation Spec
      const spec = resolveAssessmentGenerationSpec({
        assessmentPlan: selectedPlan,
        academicSetting,
        tp,
        k13Analysis,
        assessmentCriteria,
      });

      // 2. Resolve Generation Plan
      const genPlan = resolveAssessmentGenerationPlan({
        generationSpec: spec,
      });

      // 3. Inject standard provider calling the backend proxy endpoint
      const provider = {
        generate: async (request: any) => {
          const res = await fetch('/api/ai/generate-assessment-package', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemPrompt: request.systemPrompt,
              userPrompt: request.userPrompt,
            }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Gagal menghubungi AI (Status ${res.status})`);
          }
          const data = await res.json();
          return { rawText: data.rawText };
        },
      };

      // 4. Generate the draft using canonical Generator Service
      const result = await generateAssessmentPackageDraft({
        generationPlan: genPlan,
        academicSettingId: academicSetting.id,
        provider,
      });

      if (result.status === 'GENERATED' || result.status === 'PARTIAL') {
        if (result.generatedPackage) {
          // Set parent workspace ID if available
          if (workspace?.id) {
            result.generatedPackage.workspaceId = workspace.id;
          }
          onSaveAssessmentPackage(result.generatedPackage);
          setValidationReport(null);
        } else {
          throw new Error('AI menghasilkan paket kosong.');
        }
      } else {
        const issuesMsg = result.issues.map((i) => i.message).join(', ');
        throw new Error(issuesMsg || 'AI gagal menyusun draf perangkat.');
      }
    } catch (err: any) {
      console.error('Auto generate package error:', err);
      setGenerationError(err.message || 'Terjadi kesalahan saat generate draf perangkat.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 9C.7 Comprehensive Validation Integration
  const handleValidatePackage = async () => {
    if (!activePackage || !selectedPlan) return;
    setIsValidating(true);
    setGenerationError(null);

    try {
      const spec = resolveAssessmentGenerationSpec({
        assessmentPlan: selectedPlan,
        academicSetting,
        tp,
        k13Analysis,
        assessmentCriteria,
      });

      const genPlan = resolveAssessmentGenerationPlan({
        generationSpec: spec,
      });

      const report = await validateGeneratedAssessment({
        assessmentPackage: activePackage,
        generationPlan: genPlan,
        validationContext,
        gradeCalibration: spec.generationProfile?.gradeCalibration,
        subjectProfile: spec.subjectProfile,
      });

      setValidationReport(report);
    } catch (err: any) {
      console.error('Validation error:', err);
      setGenerationError(err.message || 'Terjadi kesalahan saat validasi perangkat.');
    } finally {
      setIsValidating(false);
    }
  };

  // 9C.7 Granular Regeneration Integration
  const handleRegenerateTarget = async (
    target: AssessmentRegenerationTarget,
    targetId: string,
    explicitOverride: boolean = false,
    locator?: import('../../types').AssessmentRegenerationLocator
  ) => {
    if (!activePackage || !selectedPlan) return;
    setIsRegenerating(true);
    setGenerationError(null);

    try {
      const request = {
        packageId: activePackage.id,
        expectedPackageRevision: activePackage.revision ?? 1,
        target,
        targetId,
        locator,
        explicitTeacherOverride: explicitOverride,
      };

      const spec = resolveAssessmentGenerationSpec({
        assessmentPlan: selectedPlan,
        academicSetting,
        tp,
        k13Analysis,
        assessmentCriteria,
      });

      const provider = {
        regenerate: async (contract: any) => {
          const res = await fetch('/api/ai/regenerate-assessment-target', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contract }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${res.status}`);
          }
          const data = await res.json();
          return data.data;
        },
      };

      const extra = {
        gradeCalibration: spec.generationProfile?.gradeCalibration,
        subjectProfile: spec.subjectProfile,
        validationFindings: validationReport ? [
          ...(validationReport.structural?.findings || []),
          ...(validationReport.coverage?.findings || []),
          ...(validationReport.answerVerification?.findings || []),
          ...(validationReport.quality?.findings || []),
          ...(validationReport.assembly?.findings || []),
        ] : [],
        getCurrentPackageRevision: () => {
          const current = latestPackagesRef.current.find(
            pkg => pkg.id === request.packageId
          );
          return current?.revision;
        },
      };

      const result = await assessmentRegenerationService.regenerate(
        activePackage,
        request,
        provider,
        extra
      );

      if (result.status === 'REGENERATED') {
        if (result.regeneratedPackage) {
          onSaveAssessmentPackage(result.regeneratedPackage);
          // Auto reset validation to force re-evaluation
          setValidationReport(null);
        }
      } else if (result.status === 'TEACHER_EDIT_PROTECTED') {
        const confirmOverwrite = window.confirm(
          'Perhatian: Komponen ini telah Anda edit secara manual. Apakah Anda yakin ingin menimpa (overwrite) perubahan Anda dengan hasil generasi baru dari AI?'
        );
        if (confirmOverwrite) {
          await handleRegenerateTarget(target, targetId, true, locator);
        }
      } else {
        const msg = result.issues?.join(', ') || 'Gagal melakukan regenerasi granular.';
        throw new Error(msg);
      }
    } catch (err: any) {
      console.error('Granular regeneration error:', err);
      setGenerationError(err.message || 'Terjadi kesalahan saat regenerasi granular.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 9C.8 Document / Export Integration
  const handleExportDocx = async () => {
    if (!activePackage || activePackage.workflowStatus !== 'SIAP') return;
    setIsExportingDocx(true);
    setGenerationError(null);
    try {
      const context: DocumentGenerationContext = {
        school,
        profile,
        academicSetting,
        workspace,
        tp,
        k13Analysis,
        assessmentCriteria,
        assessmentPlans,
        assessmentPackages,
        activeAssessmentPackageId: activePackage.id,
        documentMode: 'data',
      };
      await exportAssessmentDocx(context, { documentMode: 'data' });
    } catch (err: any) {
      console.error('Export DOCX error:', err);
      setGenerationError(err.message || 'Gagal mengekspor dokumen Word (.docx).');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activePackage || activePackage.workflowStatus !== 'SIAP') return;
    setIsExportingPdf(true);
    setGenerationError(null);
    try {
      const context: DocumentGenerationContext = {
        school,
        profile,
        academicSetting,
        workspace,
        tp,
        k13Analysis,
        assessmentCriteria,
        assessmentPlans,
        assessmentPackages,
        activeAssessmentPackageId: activePackage.id,
        documentMode: 'data',
      };
      await exportAssessmentPdf(context, { documentMode: 'data' });
    } catch (err: any) {
      console.error('Export PDF error:', err);
      setGenerationError(err.message || 'Gagal mencetak dokumen PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // If no AssessmentPlans exist with SIAP status
  if (readyPlans.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center max-w-2xl mx-auto my-8">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Rencana asesmen perlu direview dan disiapkan terlebih dahulu.</h3>
        <p className="text-slate-600 mb-6 text-sm">
          Perangkat Asesmen hanya dapat dibuat dari Rencana Asesmen yang telah dikonfirmasi berstatus <strong>SIAP</strong>. Silakan tinjau dan siapkan rencana asesmen terlebih dahulu di tab <strong>Rencana Asesmen</strong>.
        </p>
        {assessmentPlans.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 inline-block font-medium">
              Terdapat {assessmentPlans.length} Rencana Asesmen yang masih berstatus DRAFT atau belum SIAP.
            </p>
            <p className="text-xs text-slate-500">
              Buka tab <strong>Rencana Asesmen</strong> untuk meninjau instrumen dan kriteria ketercapaian, lalu klik <strong>Konfirmasi SIAP</strong>.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Belum ada rencana asesmen. Silakan buka tab <strong>Rencana Asesmen</strong> untuk membuat atau meng-generate draf rencana asesmen secara otomatis.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Selector Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Pilih Rencana Asesmen Induk (Parent Plan)
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
          >
            <option value="">-- Pilih Rencana Asesmen --</option>
            {assessmentPlans.map((plan) => {
              const isReady = plan.workflowStatus === 'SIAP' && plan.needsReview !== true;
              return (
                <option key={plan.id} value={plan.id} disabled={!isReady}>
                  {plan.displayLabel || plan.title} [{plan.workflowStatus}]{!isReady ? ' - (Belum SIAP)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {activePackage && (
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                activePackage.workflowStatus === 'SIAP'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : activePackage.workflowStatus === 'PERLU_DILENGKAPI'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              Status: {activePackage.workflowStatus}
            </span>
          </div>
        )}
      </div>

      {/* Review Reason Alert */}
      {activePackage?.needsReview && activePackage.reviewReason && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Perlu Review / Penyesuaian:</span> {activePackage.reviewReason}
          </div>
        </div>
      )}

      {/* UI State Driven Layouts */}
      {uiState === 'NO_PLAN' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h4 className="text-lg font-bold text-slate-800 mb-2">Pilih Rencana Asesmen</h4>
          <p className="text-slate-600 text-sm">
            Silakan pilih salah satu Rencana Asesmen berstatus <strong>SIAP</strong> pada dropdown di atas untuk melihat atau menyusun Perangkat Asesmen.
          </p>
        </div>
      ) : uiState === 'GENERATION_BLOCKED' ? (
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl text-center max-w-xl mx-auto shadow-sm">
          <AlertOctagon className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h4 className="text-lg font-bold mb-2">Generasi AI Diblokir</h4>
          <p className="text-sm text-red-700">
            Beberapa kelengkapan data kurikulum atau kriteria asesmen belum dikonfigurasi secara lengkap untuk rencana ini. Silakan lengkapi data TP/KD atau kriteria di tab sebelumnya.
          </p>
        </div>
      ) : uiState === 'READY_TO_GENERATE' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-2xl mx-auto space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">Rancang Perangkat Asesmen Berbasis AI</h4>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              Rencana Asesmen "{selectedPlan?.displayLabel || selectedPlan?.title}" siap disusun. AI akan merumuskan kisi-kisi, merancang instrumen soal/tugas, menyusun kunci jawaban, serta membuat pedoman penilaian secara otomatis dan presisi sesuai kaidah kurikulum.
            </p>
          </div>

          {generationError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg text-left max-w-md mx-auto flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <span>{generationError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleAutoGeneratePackage}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2 shadow-md transition-all transform hover:scale-[1.01]"
            >
              <Sparkles className="w-4 h-4" />
              Buat Perangkat Asesmen
            </button>

            <button
              onClick={handleCreatePackage}
              className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-2 transition"
            >
              Mulai Manual
            </button>
          </div>
        </div>
      ) : uiState === 'GENERATING' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <h4 className="text-lg font-bold text-slate-800">Menyusun Perangkat Asesmen...</h4>
          <p className="text-slate-600 text-sm max-w-xs mx-auto">
            AI sedang merumuskan indikator asesmen, merancang draf soal instrumen, dan memetakan rubrik kriteria penilaian berdasarkan rencana Anda. Proses ini membutuhkan beberapa detik.
          </p>
        </div>
      ) : uiState === 'REGENERATING_TARGET' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <h4 className="text-lg font-bold text-slate-800">Melakukan Regenerasi Granular...</h4>
          <p className="text-slate-600 text-sm max-w-xs mx-auto">
            AI sedang memperbarui elemen terpilih berdasarkan instruksi dan data pendukung secara aman dan bertahap. Mohon tunggu sebentar.
          </p>
        </div>
      ) : uiState === 'FINAL_VALIDATION' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <h4 className="text-lg font-bold text-slate-800">Menjalankan Pengujian Kualitas & Validasi...</h4>
          <p className="text-slate-600 text-sm max-w-xs mx-auto">
            Sistem sedang memeriksa keselarasan draf perangkat dengan standar kurikulum kanonikal serta verifikasi kunci jawaban secara deterministik.
          </p>
        </div>
      ) : (
        /* Package Editor Active (DRAFT_REVIEW, READY_FOR_CONFIRMATION, SIAP) */
        <div className="space-y-6">
          {/* Validation Banner at the top of workspace */}
          {uiState === 'DRAFT_REVIEW' && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-800 text-sm">Draf Perangkat Siap Direview</span>
                  <p className="text-xs text-blue-700">
                    Review draf, lakukan penyesuaian manual bila perlu, kemudian jalankan validasi otomatis sebelum menandai perangkat ini sebagai siap pakai.
                  </p>
                </div>
              </div>
              <button
                onClick={handleValidatePackage}
                disabled={isValidating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                Periksa Perangkat
              </button>
            </div>
          )}

          {uiState === 'READY_FOR_CONFIRMATION' && (
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              validationReport?.overallStatus === 'REVIEW'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : validationReport?.overallStatus === 'FAIL' 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-start gap-2.5">
                {validationReport?.overallStatus === 'REVIEW' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                ) : validationReport?.overallStatus === 'FAIL' ? (
                  <AlertOctagon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold text-sm">
                    {validationReport?.overallStatus === 'REVIEW'
                      ? 'Perlu Pemeriksaan Manual Sebelum Konfirmasi'
                      : validationReport?.overallStatus === 'FAIL'
                      ? 'Validasi Gagal'
                      : 'Hasil Validasi: Siap Dikonfirmasi'}
                  </span>
                  <p className="text-xs">
                    {validationReport?.overallStatus === 'REVIEW'
                      ? 'Tidak ada error blocking, tetapi terdapat peringatan atau catatan yang perlu ditinjau guru. Setelah seluruh catatan diperiksa, guru dapat mengonfirmasi perangkat berstatus SIAP.'
                      : validationReport?.overallStatus === 'FAIL'
                      ? 'Terdapat kendala struktural yang perlu diperbaiki terlebih dahulu.'
                      : 'Perangkat telah melewati pemeriksaan otomatis dan siap ditinjau akhir serta dikonfirmasi oleh guru.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={handleValidatePackage}
                  disabled={isValidating}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Uji Ulang
                </button>
                <button
                  onClick={() => {
                    if (!activePackage) return;
                    const res = confirmAssessmentPackage(activePackage, validationContext, validationReport);
                    onSaveAssessmentPackage(res.package);
                  }}
                  className={`px-4 py-2 ${
                    validationReport?.overallStatus === 'REVIEW'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  } text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                  {validationReport?.overallStatus === 'REVIEW'
                    ? 'Konfirmasi Setelah Review & Tandai SIAP'
                    : 'Konfirmasi & Tandai SIAP'}
                </button>
              </div>
            </div>
          )}

          {uiState === 'SIAP' && (
            <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Status: SIAP DIPAKAI (Dokumen Terverifikasi)</span>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">SIAP</span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Perangkat asesmen telah diverifikasi valid dan dikonfirmasi guru. Dokumen siap dicetak atau diekspor ke format resmi DOCX & PDF.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <button
                  onClick={handleExportDocx}
                  disabled={isExportingDocx}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {isExportingDocx ? 'Memproses...' : 'Ekspor Word (.docx)'}
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isExportingPdf ? 'Memproses...' : 'Cetak PDF'}
                </button>
                <button
                  onClick={() => {
                    if (!activePackage) return;
                    const pkgCopy = JSON.parse(JSON.stringify(activePackage));
                    pkgCopy.workflowStatus = 'DRAFT';
                    pkgCopy.needsReview = true;
                    onSaveAssessmentPackage(pkgCopy);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                  title="Kembalikan ke status Draf untuk melakukan pengeditan lebih lanjut"
                >
                  <Edit2 className="w-3 h-3" /> Edit Draf
                </button>
              </div>
            </div>
          )}

          {generationError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <span>{generationError}</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Main Navigation Tabs */}
            <div className="border-b border-slate-200 bg-slate-50 flex flex-wrap gap-1 p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'overview' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              1. Ringkasan
            </button>
            <button
              onClick={() => setActiveTab('blueprint')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'blueprint' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              2. Kisi-Kisi Asesmen ({activePackage.blueprintItems.length})
            </button>
            <button
              onClick={() => setActiveTab('instruments')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'instruments' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              3. Instrumen ({activePackage.instruments.length})
            </button>
            <button
              onClick={() => setActiveTab('keys_rubrics')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'keys_rubrics' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              4. Kunci, Pedoman & Rubrik
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'preview' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-4 h-4" />
              5. Pratinjau
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'validation' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${validationResult.valid ? 'text-emerald-600' : 'text-amber-600'}`} />
              6. Validasi Status ({validationResult.errors.length} Error)
            </button>
          </div>

          <div className="p-6">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-base font-bold text-slate-800 mb-3">Informasi Rencana Asesmen Induk</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block text-xs">Tujuan Asesmen</span>
                      <span className="font-semibold text-slate-800">{selectedPlan?.purpose}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Waktu Pelaksanaan</span>
                      <span className="font-semibold text-slate-800">{selectedPlan?.timing}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Cakupan Asesmen</span>
                      <span className="font-semibold text-slate-800">{selectedPlan?.scopeType}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Judul Perangkat Asesmen</label>
                  <input
                    type="text"
                    value={activePackage.title}
                    onChange={(e) => updatePackage({ ...activePackage, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <h5 className="text-sm font-bold text-slate-800 mb-2">Daftar Tipe Instrumen Terencana:</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlan?.instruments.map((inst) => (
                      <span key={inst.id} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded-lg">
                        {inst.label || inst.type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BLUEPRINT (KISI-KISI) */}
            {activeTab === 'blueprint' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-800">Kisi-Kisi Asesmen Pembelajaran</h4>
                  <button
                    onClick={() => {
                      const newBpItem: AssessmentBlueprintItem = {
                        id: `bp-${Date.now()}`,
                        objectiveRefId: '',
                        instrumentType: '',
                        instrumentItemIds: [],
                        order: activePackage.blueprintItems.length + 1,
                        assessmentIndicator: '',
                        materialOrContext: '',
                      };
                      updatePackage({
                        ...activePackage,
                        blueprintItems: [...activePackage.blueprintItems, newBpItem],
                      });
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Baris Kisi-Kisi
                  </button>
                </div>

                {activePackage.blueprintItems.length === 0 ? (
                  <p className="text-slate-500 text-sm italic py-4">Belum ada baris kisi-kisi. Klik tombol Tambah di atas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                          <th className="p-3 text-center w-12">No</th>
                          <th className="p-3 text-left">TP / KD Tujuan</th>
                          <th className="p-3 text-left">Indikator Asesmen</th>
                          <th className="p-3 text-left">Materi / Konteks</th>
                          <th className="p-3 text-left">Bentuk Instrumen</th>
                          <th className="p-3 text-center w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activePackage.blueprintItems.map((bp, idx) => (
                          <tr key={bp.id} className="hover:bg-slate-50">
                            <td className="p-3 text-center font-semibold text-slate-600">{idx + 1}</td>
                            <td className="p-3">
                              <select
                                value={bp.objectiveRefId}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, objectiveRefId: e.target.value } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">-- Pilih TP/KD --</option>
                                {isMerdeka(academicSetting)
                                  ? tp?.items?.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        [{item.code}] {(item.statement || item.description || '').slice(0, 60)}...
                                      </option>
                                    ))
                                  : k13Analysis?.items?.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        [{item.kdCode || item.code || ''}] {(item.kdDisplay || item.materiPokok || (item as typeof item & { kdStatement?: string }).kdStatement || '').slice(0, 60)}...
                                      </option>
                                    ))}
                              </select>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder="Indikator asesmen (ditulis guru)..."
                                value={bp.assessmentIndicator || ''}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, assessmentIndicator: e.target.value } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder="Lingkup materi/konteks..."
                                value={bp.materialOrContext || ''}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, materialOrContext: e.target.value } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                value={bp.instrumentType}
                                onChange={(e) => {
                                  const updated = activePackage.blueprintItems.map((b) =>
                                    b.id === bp.id ? { ...b, instrumentType: e.target.value as AssessmentInstrumentType } : b
                                  );
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded"
                              >
                                <option value="">-- Pilih Bentuk Instrumen --</option>
                                {selectedPlan?.instruments.map((i) => (
                                  <option key={i.id} value={i.type}>
                                    {i.label || i.type}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => {
                                  const updated = activePackage.blueprintItems.filter((b) => b.id !== bp.id);
                                  updatePackage({ ...activePackage, blueprintItems: updated });
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: INSTRUMENTS */}
            {activeTab === 'instruments' && (
              <div className="space-y-6">
                <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                  {selectedPlan?.instruments.map((instRef) => (
                    <button
                      key={instRef.id}
                      onClick={() => setActiveInstType(instRef.type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeInstType === instRef.type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {instRef.label || instRef.type}
                    </button>
                  ))}
                </div>

                {/* WRITTEN TEST EDITOR */}
                {activeInstType === 'WRITTEN_TEST' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-base font-bold text-slate-800">Instrumen Tes Tertulis</h4>
                      <button
                        onClick={() => {
                          let writtenInst = activePackage.instruments.find((i) => i.type === 'WRITTEN_TEST') as WrittenAssessmentInstrument | undefined;
                          const newItem: WrittenAssessmentItem = {
                            id: `item-${Date.now()}`,
                            itemType: '',
                            prompt: '',
                            options: [],
                            order: writtenInst ? writtenInst.items.length + 1 : 1,
                          };

                          let updatedInstruments = [...activePackage.instruments];
                          if (!writtenInst) {
                            writtenInst = {
                              id: `inst-written-${Date.now()}`,
                              type: 'WRITTEN_TEST',
                              items: [newItem],
                            };
                            updatedInstruments.push(writtenInst);
                          } else {
                            updatedInstruments = updatedInstruments.map((inst) =>
                              inst.type === 'WRITTEN_TEST'
                                ? { ...writtenInst, items: [...writtenInst.items, newItem] }
                                : inst
                            );
                          }
                          updatePackage({ ...activePackage, instruments: updatedInstruments });
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Tambah Soal Tertulis
                      </button>
                    </div>

                    {(() => {
                      const writtenInst = activePackage.instruments.find((i) => i.type === 'WRITTEN_TEST') as WrittenAssessmentInstrument | undefined;
                      if (!writtenInst || writtenInst.items.length === 0) {
                        return <p className="text-slate-500 text-sm italic">Belum ada butir soal tertulis.</p>;
                      }
                      return (
                        <div className="space-y-4">
                          {writtenInst.items.map((item, itemIdx) => (
                            <div key={item.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Soal #{itemIdx + 1}</span>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={item.itemType}
                                    onChange={(e) => {
                                      const updatedItems = writtenInst!.items.map((it) =>
                                        it.id === item.id ? { ...it, itemType: e.target.value as WrittenAssessmentItemType } : it
                                      );
                                      const updatedInstruments = activePackage.instruments.map((inst) =>
                                        inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                      );
                                      updatePackage({ ...activePackage, instruments: updatedInstruments });
                                    }}
                                    className="text-xs p-1 border border-slate-300 rounded font-semibold"
                                  >
                                    <option value="">-- Pilih Jenis Soal --</option>
                                    <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
                                    <option value="MULTIPLE_SELECT">Pilihan Ganda Kompleks</option>
                                    <option value="TRUE_FALSE">Benar / Salah</option>
                                    <option value="SHORT_ANSWER">Isian Singkat</option>
                                    <option value="ESSAY">Uraian / Esai</option>
                                    <option value="MATCHING">Menjodohkan (Matching)</option>
                                    <option value="CATEGORY_RESPONSE">Kategori / Benar-Salah Majemuk (Category Response)</option>
                                  </select>

                                  <button
                                    onClick={() => {
                                      const updatedItems = writtenInst!.items.filter((it) => it.id !== item.id);
                                      const updatedInstruments = activePackage.instruments.map((inst) =>
                                        inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                      );
                                      const updatedAnswerKeys = (activePackage.answerKeys || []).filter(
                                        (ak) => !(ak.instrumentId === writtenInst!.id && ak.instrumentItemId === item.id)
                                      );
                                      updatePackage({
                                        ...activePackage,
                                        instruments: updatedInstruments,
                                        answerKeys: updatedAnswerKeys,
                                      });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {!item.itemType && (
                                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                                  Silakan tentukan jenis soal (Pilihan Ganda, Benar/Salah, Isian, Uraian, Menjodohkan, atau Kategori) pada menu di atas.
                                </p>
                              )}

                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Pertanyaan / Soal</label>
                                <textarea
                                  value={item.prompt}
                                  onChange={(e) => {
                                    const updatedItems = writtenInst!.items.map((it) =>
                                      it.id === item.id ? { ...it, prompt: e.target.value } : it
                                    );
                                    const updatedInstruments = activePackage.instruments.map((inst) =>
                                      inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                    );
                                    updatePackage({ ...activePackage, instruments: updatedInstruments });
                                  }}
                                  className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                                  rows={2}
                                />
                              </div>

                              {item.itemType === 'SHORT_ANSWER' && (
                                <div className="flex items-center gap-2 pt-1">
                                  <label className="text-xs font-semibold text-slate-600">Mode Respon (Opsional):</label>
                                  <select
                                    value={item.responseMode || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedItems = writtenInst!.items.map((it) =>
                                        it.id === item.id ? { ...it, responseMode: val ? (val as ShortAnswerResponseMode) : undefined } : it
                                      );
                                      const updatedInstruments = activePackage.instruments.map((inst) =>
                                        inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                      );
                                      updatePackage({ ...activePackage, instruments: updatedInstruments });
                                    }}
                                    className="text-xs p-1 border border-slate-300 rounded bg-white"
                                  >
                                    <option value="">-- Belum Ditentukan (Default) --</option>
                                    <option value="SHORT_RESPONSE">Jawaban Singkat (Short Response)</option>
                                    <option value="COMPLETION">Melengkapi Kalimat / Isian (Completion)</option>
                                  </select>
                                </div>
                              )}

                              {(item.itemType === 'MULTIPLE_CHOICE' || item.itemType === 'MULTIPLE_SELECT') && (() => {
                                const optAnswerKey = (activePackage.answerKeys || []).find(
                                  (ak) => ak.instrumentId === writtenInst!.id && ak.instrumentItemId === item.id
                                );
                                return (
                                  <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                                    <label className="block text-xs font-bold text-slate-700">Opsi Jawaban:</label>
                                    {(!item.options || item.options.length === 0) && (
                                      <p className="text-xs text-slate-400 italic">Belum ada opsi jawaban. Klik tombol di bawah untuk menambahkan opsi.</p>
                                    )}
                                    {(item.options || []).map((opt) => {
                                      const isChecked = optAnswerKey?.optionIds?.includes(opt.id) ?? false;

                                      return (
                                        <div key={opt.id} className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              const isCheck = e.target.checked;
                                              const existingAk = (activePackage.answerKeys || []).find(
                                                (ak) => ak.instrumentId === writtenInst!.id && ak.instrumentItemId === item.id
                                              );

                                              let nextOptionIds: string[];
                                              if (item.itemType === 'MULTIPLE_CHOICE') {
                                                nextOptionIds = isCheck ? [opt.id] : [];
                                              } else {
                                                const currentOptionIds = existingAk?.optionIds ?? [];
                                                const selectedSet = new Set(currentOptionIds);
                                                if (isCheck) {
                                                  selectedSet.add(opt.id);
                                                } else {
                                                  selectedSet.delete(opt.id);
                                                }
                                                nextOptionIds = (item.options || [])
                                                  .map((o) => o.id)
                                                  .filter((id) => selectedSet.has(id));
                                              }

                                              let updatedAnswerKeys: AssessmentAnswerKey[];
                                              if (nextOptionIds.length > 0) {
                                                const updatedAk: AssessmentAnswerKey = {
                                                  ...(existingAk || {
                                                    id: `ak-${writtenInst!.id}-${item.id}`,
                                                    instrumentId: writtenInst!.id,
                                                    instrumentItemId: item.id,
                                                  }),
                                                  instrumentId: writtenInst!.id,
                                                  instrumentItemId: item.id,
                                                  answerType: item.itemType === 'MULTIPLE_CHOICE' ? 'OPTION' : 'MULTIPLE_OPTION',
                                                  optionIds: nextOptionIds,
                                                };
                                                if (existingAk) {
                                                  updatedAnswerKeys = (activePackage.answerKeys || []).map((ak) =>
                                                    ak.id === existingAk.id ? updatedAk : ak
                                                  );
                                                } else {
                                                  updatedAnswerKeys = [...(activePackage.answerKeys || []), updatedAk];
                                                }
                                              } else {
                                                updatedAnswerKeys = (activePackage.answerKeys || []).filter(
                                                  (ak) => !(ak.instrumentId === writtenInst!.id && ak.instrumentItemId === item.id)
                                                );
                                              }

                                              // Mirror to legacy isCorrect for compatibility
                                              const updatedOpts = item.options?.map((o) => ({
                                                ...o,
                                                isCorrect: nextOptionIds.includes(o.id),
                                              }));

                                              const updatedItems = writtenInst!.items.map((it) =>
                                                it.id === item.id ? { ...it, options: updatedOpts } : it
                                              );
                                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                                inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                              );
                                              updatePackage({
                                                ...activePackage,
                                                instruments: updatedInstruments,
                                                answerKeys: updatedAnswerKeys,
                                              });
                                            }}
                                          />
                                          <span className="text-xs font-bold text-slate-600 w-4">{opt.label}.</span>
                                          <input
                                            type="text"
                                            value={opt.text}
                                            onChange={(e) => {
                                              const updatedOpts = item.options?.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o));
                                              const updatedItems = writtenInst!.items.map((it) =>
                                                it.id === item.id ? { ...it, options: updatedOpts } : it
                                              );
                                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                                inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                              );
                                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                                            }}
                                            className="text-xs p-1.5 border border-slate-300 rounded flex-1 bg-white"
                                            placeholder="Teks opsi jawaban..."
                                          />
                                          <button
                                            onClick={() => {
                                              const existingAk = (activePackage.answerKeys || []).find(
                                                (ak) => ak.instrumentId === writtenInst!.id && ak.instrumentItemId === item.id
                                              );

                                              const remainingOpts = (item.options || []).filter((o) => o.id !== opt.id);
                                              const nextOptionIds = remainingOpts
                                                .map((o) => o.id)
                                                .filter((id) => (existingAk?.optionIds || []).includes(id));

                                              let updatedAnswerKeys: AssessmentAnswerKey[];
                                              if (nextOptionIds.length > 0) {
                                                const updatedAk: AssessmentAnswerKey = {
                                                  ...(existingAk || {
                                                    id: `ak-${writtenInst!.id}-${item.id}`,
                                                    instrumentId: writtenInst!.id,
                                                    instrumentItemId: item.id,
                                                  }),
                                                  instrumentId: writtenInst!.id,
                                                  instrumentItemId: item.id,
                                                  answerType: item.itemType === 'MULTIPLE_CHOICE' ? 'OPTION' : 'MULTIPLE_OPTION',
                                                  optionIds: nextOptionIds,
                                                };
                                                if (existingAk) {
                                                  updatedAnswerKeys = (activePackage.answerKeys || []).map((ak) =>
                                                    ak.id === existingAk.id ? updatedAk : ak
                                                  );
                                                } else {
                                                  updatedAnswerKeys = [...(activePackage.answerKeys || []), updatedAk];
                                                }
                                              } else {
                                                updatedAnswerKeys = (activePackage.answerKeys || []).filter(
                                                  (ak) => !(ak.instrumentId === writtenInst!.id && ak.instrumentItemId === item.id)
                                                );
                                              }

                                              const updatedOpts = remainingOpts.map((o) => ({
                                                ...o,
                                                isCorrect: nextOptionIds.includes(o.id),
                                              }));

                                              const updatedItems = writtenInst!.items.map((it) =>
                                                it.id === item.id ? { ...it, options: updatedOpts } : it
                                              );
                                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                                inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                              );
                                              updatePackage({
                                                ...activePackage,
                                                instruments: updatedInstruments,
                                                answerKeys: updatedAnswerKeys,
                                              });
                                            }}
                                            className="text-red-500 hover:text-red-700 p-1"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                    <button
                                      onClick={() => {
                                        const newOptLabel = String.fromCharCode(65 + (item.options?.length || 0));
                                        const newOpt: WrittenAssessmentOption = {
                                          id: `opt-${Date.now()}`,
                                          label: newOptLabel,
                                          text: '',
                                        };
                                        const updatedOpts = [...(item.options || []), newOpt];
                                        const updatedItems = writtenInst!.items.map((it) =>
                                          it.id === item.id ? { ...it, options: updatedOpts } : it
                                        );
                                        const updatedInstruments = activePackage.instruments.map((inst) =>
                                          inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                        );
                                        updatePackage({ ...activePackage, instruments: updatedInstruments });
                                      }}
                                      className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 mt-1"
                                    >
                                      + Opsi Jawaban
                                    </button>
                                  </div>
                                );
                              })()}

                               {item.itemType === 'MATCHING' && (() => {
                                 const matchingKey = (activePackage.answerKeys || []).find(
                                   (ak) => ak.instrumentItemId === item.id && ak.answerType === 'MATCHING'
                                 );
                                 const pairs = matchingKey?.matchingPairs || [];

                                 const updateMatchingPairs = (updatedPairs: MatchingAssessmentPair[]) => {
                                   let updatedAnswerKeys: AssessmentAnswerKey[];
                                   if (matchingKey) {
                                     updatedAnswerKeys = activePackage.answerKeys.map((ak) =>
                                       ak.id === matchingKey.id ? { ...ak, matchingPairs: updatedPairs } : ak
                                     );
                                   } else {
                                     const newKey: AssessmentAnswerKey = {
                                       id: `ak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                       instrumentId: writtenInst!.id,
                                       instrumentItemId: item.id,
                                       answerType: 'MATCHING',
                                       matchingPairs: updatedPairs,
                                     };
                                     updatedAnswerKeys = [...(activePackage.answerKeys || []), newKey];
                                   }
                                   // Clean deprecated item.matchingPairs from item to ensure SSOT
                                   const updatedItems = writtenInst!.items.map((it) => {
                                     if (it.id === item.id) {
                                       const { matchingPairs: _, ...rest } = it;
                                       return rest as WrittenAssessmentItem;
                                     }
                                     return it;
                                   });
                                   const updatedInstruments = activePackage.instruments.map((inst) =>
                                     inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                   );
                                   updatePackage({ ...activePackage, instruments: updatedInstruments, answerKeys: updatedAnswerKeys });
                                 };

                                 return (
                                   <div className="space-y-4 pl-4 border-l-2 border-indigo-200">
                                     {/* Premises */}
                                     <div className="space-y-2">
                                       <label className="block text-xs font-bold text-slate-700">Daftar Premis / Pernyataan Asal (Kolom Kiri):</label>
                                       {(!item.matchingPremises || item.matchingPremises.length === 0) && (
                                         <p className="text-xs text-slate-400 italic">Belum ada premis.</p>
                                       )}
                                       {(item.matchingPremises || []).map((premise, pIdx) => (
                                         <div key={premise.id} className="flex items-center gap-2">
                                           <span className="text-xs font-bold text-slate-600 w-6">#{pIdx + 1}.</span>
                                           <input
                                             type="text"
                                             value={premise.text}
                                             onChange={(e) => {
                                               const updatedPremises = item.matchingPremises?.map((p) =>
                                                 p.id === premise.id ? { ...p, text: e.target.value } : p
                                               );
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, matchingPremises: updatedPremises } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({ ...activePackage, instruments: updatedInstruments });
                                             }}
                                             className="text-xs p-1.5 border border-slate-300 rounded flex-1 bg-white"
                                             placeholder="Teks premis / soal asal..."
                                           />
                                           <button
                                             onClick={() => {
                                               const updatedPremises = item.matchingPremises?.filter((p) => p.id !== premise.id);
                                               const updatedPairs = pairs.filter((pair) => pair.premiseId !== premise.id);
                                               const updatedAnswerKeys = matchingKey
                                                 ? activePackage.answerKeys.map((ak) =>
                                                     ak.id === matchingKey.id ? { ...ak, matchingPairs: updatedPairs } : ak
                                                   )
                                                 : activePackage.answerKeys;
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, matchingPremises: updatedPremises } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({
                                                 ...activePackage,
                                                 instruments: updatedInstruments,
                                                 answerKeys: updatedAnswerKeys,
                                               });
                                             }}
                                             className="text-red-500 hover:text-red-700 p-1"
                                           >
                                             <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                         </div>
                                       ))}
                                       <button
                                         onClick={() => {
                                           const newPremise: MatchingAssessmentEntry = {
                                             id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                             text: '',
                                           };
                                           const updatedPremises = [...(item.matchingPremises || []), newPremise];
                                           const updatedItems = writtenInst!.items.map((it) =>
                                             it.id === item.id ? { ...it, matchingPremises: updatedPremises } : it
                                           );
                                           const updatedInstruments = activePackage.instruments.map((inst) =>
                                             inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                           );
                                           updatePackage({ ...activePackage, instruments: updatedInstruments });
                                         }}
                                         className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                                       >
                                         + Tambah Premis
                                       </button>
                                     </div>

                                     {/* Responses */}
                                     <div className="space-y-2">
                                       <label className="block text-xs font-bold text-slate-700">Daftar Respon / Pilihan Pasangan (Kolom Kanan):</label>
                                       {(!item.matchingResponses || item.matchingResponses.length === 0) && (
                                         <p className="text-xs text-slate-400 italic">Belum ada respon pasangan.</p>
                                       )}
                                       {(item.matchingResponses || []).map((resp, rIdx) => (
                                         <div key={resp.id} className="flex items-center gap-2">
                                           <span className="text-xs font-bold text-slate-600 w-6">{String.fromCharCode(65 + rIdx)}.</span>
                                           <input
                                             type="text"
                                             value={resp.text}
                                             onChange={(e) => {
                                               const updatedResp = item.matchingResponses?.map((r) =>
                                                 r.id === resp.id ? { ...r, text: e.target.value } : r
                                               );
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, matchingResponses: updatedResp } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({ ...activePackage, instruments: updatedInstruments });
                                             }}
                                             className="text-xs p-1.5 border border-slate-300 rounded flex-1 bg-white"
                                             placeholder="Teks opsi pasangan..."
                                           />
                                           <button
                                             onClick={() => {
                                               const updatedResp = item.matchingResponses?.filter((r) => r.id !== resp.id);
                                               const updatedPairs = pairs.filter((pair) => pair.responseId !== resp.id);
                                               const updatedAnswerKeys = matchingKey
                                                 ? activePackage.answerKeys.map((ak) =>
                                                     ak.id === matchingKey.id ? { ...ak, matchingPairs: updatedPairs } : ak
                                                   )
                                                 : activePackage.answerKeys;
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, matchingResponses: updatedResp } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({
                                                 ...activePackage,
                                                 instruments: updatedInstruments,
                                                 answerKeys: updatedAnswerKeys,
                                               });
                                             }}
                                             className="text-red-500 hover:text-red-700 p-1"
                                           >
                                             <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                         </div>
                                       ))}
                                       <button
                                         onClick={() => {
                                           const newResp: MatchingAssessmentEntry = {
                                             id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                             text: '',
                                           };
                                           const updatedResp = [...(item.matchingResponses || []), newResp];
                                           const updatedItems = writtenInst!.items.map((it) =>
                                             it.id === item.id ? { ...it, matchingResponses: updatedResp } : it
                                           );
                                           const updatedInstruments = activePackage.instruments.map((inst) =>
                                             inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                           );
                                           updatePackage({ ...activePackage, instruments: updatedInstruments });
                                         }}
                                         className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                                       >
                                         + Tambah Respon
                                       </button>
                                     </div>

                                     {/* Pairs / Kunci Pasangan (AssessmentAnswerKey) */}
                                     <div className="space-y-2 pt-2 border-t border-slate-200">
                                       <div className="flex items-center justify-between">
                                         <label className="block text-xs font-bold text-slate-700">Kunci Pasangan (AssessmentAnswerKey):</label>
                                         <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                           Single Source of Truth
                                         </span>
                                       </div>
                                       {pairs.length === 0 && (
                                         <p className="text-xs text-slate-400 italic">Belum ada pasangan kunci jawaban.</p>
                                       )}
                                       {pairs.map((pair, pIdx) => (
                                         <div key={pIdx} className="flex items-center gap-2">
                                           <select
                                             value={pair.premiseId}
                                             onChange={(e) => {
                                               const updatedPairs = pairs.map((pr, idx) =>
                                                 idx === pIdx ? { ...pr, premiseId: e.target.value } : pr
                                               );
                                               updateMatchingPairs(updatedPairs);
                                             }}
                                             className="text-xs p-1.5 border border-slate-300 rounded bg-white flex-1"
                                           >
                                             <option value="">-- Pilih Premis --</option>
                                             {(item.matchingPremises || []).map((p, idx) => (
                                               <option key={p.id} value={p.id}>
                                                 Premis #{idx + 1}: {p.text ? p.text.slice(0, 30) : '(kosong)'}
                                               </option>
                                             ))}
                                           </select>
                                           <span className="text-xs font-bold text-slate-500">➔</span>
                                           <select
                                             value={pair.responseId}
                                             onChange={(e) => {
                                               const updatedPairs = pairs.map((pr, idx) =>
                                                 idx === pIdx ? { ...pr, responseId: e.target.value } : pr
                                               );
                                               updateMatchingPairs(updatedPairs);
                                             }}
                                             className="text-xs p-1.5 border border-slate-300 rounded bg-white flex-1"
                                           >
                                             <option value="">-- Pilih Respon Pasangan --</option>
                                             {(item.matchingResponses || []).map((r, idx) => (
                                               <option key={r.id} value={r.id}>
                                                 Respon {String.fromCharCode(65 + idx)}: {r.text ? r.text.slice(0, 30) : '(kosong)'}
                                               </option>
                                             ))}
                                           </select>
                                           <button
                                             onClick={() => {
                                               const updatedPairs = pairs.filter((_, idx) => idx !== pIdx);
                                               updateMatchingPairs(updatedPairs);
                                             }}
                                             className="text-red-500 hover:text-red-700 p-1"
                                           >
                                             <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                         </div>
                                       ))}
                                       <button
                                         onClick={() => {
                                           const newPair: MatchingAssessmentPair = {
                                             premiseId: '',
                                             responseId: '',
                                           };
                                           updateMatchingPairs([...pairs, newPair]);
                                         }}
                                         className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                                       >
                                         + Tambah Pasangan Kunci
                                       </button>
                                     </div>
                                   </div>
                                 );
                               })()}

                               {item.itemType === 'CATEGORY_RESPONSE' && (() => {
                                 const catAnswerKey = (activePackage.answerKeys || []).find(
                                   (ak) => ak.instrumentItemId === item.id && ak.answerType === 'CATEGORY_RESPONSE'
                                 );
                                 const catAnswers = catAnswerKey?.categoryAnswers || [];
                                 const catAnswerMap = new Map(catAnswers.map((ca) => [ca.statementId, ca.categoryId]));

                                 const updateStatementCategoryAnswer = (stmtId: string, categoryId: string) => {
                                   let updatedAnswers: { statementId: string; categoryId: string }[];
                                   if (categoryId) {
                                     const exists = catAnswers.some((ca) => ca.statementId === stmtId);
                                     if (exists) {
                                       updatedAnswers = catAnswers.map((ca) =>
                                         ca.statementId === stmtId ? { statementId: stmtId, categoryId } : ca
                                       );
                                     } else {
                                       updatedAnswers = [...catAnswers, { statementId: stmtId, categoryId }];
                                     }
                                   } else {
                                     updatedAnswers = catAnswers.filter((ca) => ca.statementId !== stmtId);
                                   }

                                   let updatedAnswerKeys: AssessmentAnswerKey[];
                                   if (catAnswerKey) {
                                     updatedAnswerKeys = activePackage.answerKeys.map((ak) =>
                                       ak.id === catAnswerKey.id ? { ...ak, categoryAnswers: updatedAnswers } : ak
                                     );
                                   } else {
                                     const newKey: AssessmentAnswerKey = {
                                       id: `ak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                       instrumentId: writtenInst!.id,
                                       instrumentItemId: item.id,
                                       answerType: 'CATEGORY_RESPONSE',
                                       categoryAnswers: updatedAnswers,
                                     };
                                     updatedAnswerKeys = [...(activePackage.answerKeys || []), newKey];
                                   }

                                   // Clean deprecated correctCategoryId from statements to ensure SSOT
                                   const updatedStmts = (item.categoryResponseStatements || []).map((s) => {
                                     const { correctCategoryId: _, ...rest } = s;
                                     return rest;
                                   });
                                   const updatedItems = writtenInst!.items.map((it) =>
                                     it.id === item.id ? { ...it, categoryResponseStatements: updatedStmts } : it
                                   );
                                   const updatedInstruments = activePackage.instruments.map((inst) =>
                                     inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                   );
                                   updatePackage({
                                     ...activePackage,
                                     instruments: updatedInstruments,
                                     answerKeys: updatedAnswerKeys,
                                   });
                                 };

                                 return (
                                   <div className="space-y-4 pl-4 border-l-2 border-emerald-200">
                                     {/* Categories */}
                                     <div className="space-y-2">
                                       <label className="block text-xs font-bold text-slate-700">Daftar Kategori Pilihan (misal: Benar / Salah):</label>
                                       {(!item.categoryResponseCategories || item.categoryResponseCategories.length === 0) && (
                                         <p className="text-xs text-slate-400 italic">Belum ada kategori pilihan.</p>
                                       )}
                                       {(item.categoryResponseCategories || []).map((cat, cIdx) => (
                                         <div key={cat.id} className="flex items-center gap-2">
                                           <span className="text-xs font-bold text-slate-600 w-6">Cat #{cIdx + 1}:</span>
                                           <input
                                             type="text"
                                             value={cat.label}
                                             onChange={(e) => {
                                               const updatedCats = item.categoryResponseCategories?.map((c) =>
                                                 c.id === cat.id ? { ...c, label: e.target.value } : c
                                               );
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, categoryResponseCategories: updatedCats } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({ ...activePackage, instruments: updatedInstruments });
                                             }}
                                             className="text-xs p-1.5 border border-slate-300 rounded flex-1 bg-white"
                                             placeholder="Label kategori (misal: Benar, Salah, Sesuai)..."
                                           />
                                           <button
                                             onClick={() => {
                                               const updatedCats = item.categoryResponseCategories?.filter((c) => c.id !== cat.id);
                                               const updatedAnswers = catAnswers.filter((ca) => ca.categoryId !== cat.id);
                                               const updatedAnswerKeys = catAnswerKey
                                                 ? activePackage.answerKeys.map((ak) =>
                                                     ak.id === catAnswerKey.id ? { ...ak, categoryAnswers: updatedAnswers } : ak
                                                   )
                                                 : activePackage.answerKeys;
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, categoryResponseCategories: updatedCats } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({
                                                 ...activePackage,
                                                 instruments: updatedInstruments,
                                                 answerKeys: updatedAnswerKeys,
                                               });
                                             }}
                                             className="text-red-500 hover:text-red-700 p-1"
                                           >
                                             <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                         </div>
                                       ))}
                                       <button
                                         onClick={() => {
                                           const newCat: CategoryResponseCategory = {
                                             id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                             label: '',
                                           };
                                           const updatedCats = [...(item.categoryResponseCategories || []), newCat];
                                           const updatedItems = writtenInst!.items.map((it) =>
                                             it.id === item.id ? { ...it, categoryResponseCategories: updatedCats } : it
                                           );
                                           const updatedInstruments = activePackage.instruments.map((inst) =>
                                             inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                           );
                                           updatePackage({ ...activePackage, instruments: updatedInstruments });
                                         }}
                                         className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                                       >
                                         + Tambah Kategori
                                       </button>
                                     </div>

                                     {/* Statements */}
                                     <div className="space-y-2 pt-2 border-t border-slate-200">
                                       <div className="flex items-center justify-between">
                                         <label className="block text-xs font-bold text-slate-700">Daftar Pernyataan & Kunci Kategori (AssessmentAnswerKey):</label>
                                         <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                           Single Source of Truth
                                         </span>
                                       </div>
                                       {(!item.categoryResponseStatements || item.categoryResponseStatements.length === 0) && (
                                         <p className="text-xs text-slate-400 italic">Belum ada butir pernyataan.</p>
                                       )}
                                       {(item.categoryResponseStatements || []).map((stmt, sIdx) => (
                                         <div key={stmt.id} className="flex items-center gap-2">
                                           <span className="text-xs font-bold text-slate-600 w-6">#{sIdx + 1}.</span>
                                           <input
                                             type="text"
                                             value={stmt.text}
                                             onChange={(e) => {
                                               const updatedStmts = item.categoryResponseStatements?.map((s) =>
                                                 s.id === stmt.id ? { ...s, text: e.target.value } : s
                                               );
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, categoryResponseStatements: updatedStmts } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({ ...activePackage, instruments: updatedInstruments });
                                             }}
                                             className="text-xs p-1.5 border border-slate-300 rounded flex-1 bg-white"
                                             placeholder="Teks butir pernyataan..."
                                           />
                                           <select
                                             value={catAnswerMap.get(stmt.id) || ''}
                                             onChange={(e) => {
                                               updateStatementCategoryAnswer(stmt.id, e.target.value);
                                             }}
                                             className="text-xs p-1.5 border border-slate-300 rounded bg-white w-44"
                                           >
                                             <option value="">-- Kunci Kategori --</option>
                                             {(item.categoryResponseCategories || []).map((cat) => (
                                               <option key={cat.id} value={cat.id}>
                                                 {cat.label || '(tanpa label)'}
                                               </option>
                                             ))}
                                           </select>
                                           <button
                                             onClick={() => {
                                               const updatedStmts = item.categoryResponseStatements?.filter((s) => s.id !== stmt.id);
                                               const updatedAnswers = catAnswers.filter((ca) => ca.statementId !== stmt.id);
                                               const updatedAnswerKeys = catAnswerKey
                                                 ? activePackage.answerKeys.map((ak) =>
                                                     ak.id === catAnswerKey.id ? { ...ak, categoryAnswers: updatedAnswers } : ak
                                                   )
                                                 : activePackage.answerKeys;
                                               const updatedItems = writtenInst!.items.map((it) =>
                                                 it.id === item.id ? { ...it, categoryResponseStatements: updatedStmts } : it
                                               );
                                               const updatedInstruments = activePackage.instruments.map((inst) =>
                                                 inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                               );
                                               updatePackage({
                                                 ...activePackage,
                                                 instruments: updatedInstruments,
                                                 answerKeys: updatedAnswerKeys,
                                               });
                                             }}
                                             className="text-red-500 hover:text-red-700 p-1"
                                           >
                                             <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                         </div>
                                       ))}
                                       <button
                                         onClick={() => {
                                           const newStmt: CategoryResponseStatement = {
                                             id: `stmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                             text: '',
                                           };
                                           const updatedStmts = [...(item.categoryResponseStatements || []), newStmt];
                                           const updatedItems = writtenInst!.items.map((it) =>
                                             it.id === item.id ? { ...it, categoryResponseStatements: updatedStmts } : it
                                           );
                                           const updatedInstruments = activePackage.instruments.map((inst) =>
                                             inst.type === 'WRITTEN_TEST' ? { ...writtenInst!, items: updatedItems } : inst
                                           );
                                           updatePackage({ ...activePackage, instruments: updatedInstruments });
                                         }}
                                         className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                                       >
                                         + Tambah Pernyataan
                                       </button>
                                     </div>
                                   </div>
                                 );
                               })()}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ORAL TEST EDITOR */}
                {activeInstType === 'ORAL_TEST' && (() => {
                  const oralInst = activePackage.instruments.find((i) => i.type === 'ORAL_TEST') as OralAssessmentInstrument | undefined;
                  if (!oralInst) {
                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                        Instrumen Tes Lisan belum tersedia pada paket asesmen.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-800">Instrumen Tes Lisan</h4>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                          <input
                            type="text"
                            value={oralInst.title || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === oralInst.id ? { ...oralInst, title: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Judul instrumen tes lisan..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Petunjuk:</label>
                          <textarea
                            rows={2}
                            value={oralInst.instructions || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === oralInst.id ? { ...oralInst, instructions: e.target.value || undefined } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Petunjuk pelaksanaan tes lisan..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-700">Daftar Pertanyaan Lisan ({oralInst.items?.length || 0} butir):</h5>
                        {(!oralInst.items || oralInst.items.length === 0) && (
                          <p className="text-slate-500 text-xs italic">Belum ada butir pertanyaan tes lisan.</p>
                        )}
                        {(oralInst.items || []).map((item, idx) => (
                          <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {item.id}</span>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Pertanyaan:</label>
                              <textarea
                                rows={2}
                                value={item.prompt}
                                onChange={(e) => {
                                  const updatedItems = oralInst.items.map((it) =>
                                    it.id === item.id ? { ...it, prompt: e.target.value } : it
                                  );
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.id === oralInst.id ? { ...oralInst, items: updatedItems } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                placeholder="Teks pertanyaan lisan..."
                                className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Respons yang Diharapkan:</label>
                              <textarea
                                rows={2}
                                value={item.expectedResponse || ''}
                                onChange={(e) => {
                                  const updatedItems = oralInst.items.map((it) =>
                                    it.id === item.id ? { ...it, expectedResponse: e.target.value || undefined } : it
                                  );
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.id === oralInst.id ? { ...oralInst, items: updatedItems } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                placeholder="Respons atau poin jawaban yang diharapkan (opsional)..."
                                className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* PERFORMANCE EDITOR */}
                {activeInstType === 'PERFORMANCE' && (() => {
                  const perfInst = activePackage.instruments.find((i) => i.type === 'PERFORMANCE') as PerformanceAssessmentInstrument | undefined;
                  if (!perfInst) {
                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                        Instrumen Unjuk Kerja / Kinerja belum tersedia pada paket asesmen.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-800">Instrumen Unjuk Kerja / Praktik / Kinerja</h4>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                          <input
                            type="text"
                            value={perfInst.title || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === perfInst.id ? { ...perfInst, title: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Judul instrumen unjuk kerja..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Tugas Praktik/Kinerja:</label>
                          <textarea
                            rows={3}
                            value={perfInst.task}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === perfInst.id ? { ...perfInst, task: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Deskripsi tugas kinerja / praktik yang harus dilakukan siswa..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Petunjuk Pelaksanaan:</label>
                          <textarea
                            rows={2}
                            value={perfInst.instructions || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === perfInst.id ? { ...perfInst, instructions: e.target.value || undefined } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Petunjuk pelaksanaan bagi siswa/guru (opsional)..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-700">Aspek yang Dinilai:</h5>
                        {(!perfInst.aspects || perfInst.aspects.length === 0) && (
                          <p className="text-slate-500 text-xs italic">Belum ada aspek yang dinilai.</p>
                        )}
                        {(perfInst.aspects || []).map((asp, idx) => (
                          <div key={asp.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-600">Aspek #{idx + 1}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {asp.id}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Label Aspek:</label>
                                <input
                                  type="text"
                                  value={asp.label}
                                  onChange={(e) => {
                                    const updatedAspects = perfInst.aspects!.map((a) =>
                                      a.id === asp.id ? { ...a, label: e.target.value } : a
                                    );
                                    const updatedInstruments = activePackage.instruments.map((inst) =>
                                      inst.id === perfInst.id ? { ...perfInst, aspects: updatedAspects } : inst
                                    );
                                    updatePackage({ ...activePackage, instruments: updatedInstruments });
                                  }}
                                  placeholder="Label aspek..."
                                  className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Bobot:</label>
                                <input
                                  type="number"
                                  value={asp.weight !== undefined ? asp.weight : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                                    const updatedAspects = perfInst.aspects!.map((a) =>
                                      a.id === asp.id ? { ...a, weight: val } : a
                                    );
                                    const updatedInstruments = activePackage.instruments.map((inst) =>
                                      inst.id === perfInst.id ? { ...perfInst, aspects: updatedAspects } : inst
                                    );
                                    updatePackage({ ...activePackage, instruments: updatedInstruments });
                                  }}
                                  placeholder="Bobot angka (opsional)..."
                                  className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi:</label>
                              <textarea
                                rows={2}
                                value={asp.description || ''}
                                onChange={(e) => {
                                  const updatedAspects = perfInst.aspects!.map((a) =>
                                    a.id === asp.id ? { ...a, description: e.target.value || undefined } : a
                                  );
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.id === perfInst.id ? { ...perfInst, aspects: updatedAspects } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                placeholder="Deskripsi aspek yang dinilai..."
                                className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* OBSERVATION EDITOR */}
                {activeInstType === 'OBSERVATION' && (() => {
                  const obsInst = activePackage.instruments.find((i) => i.type === 'OBSERVATION') as ObservationAssessmentInstrument | undefined;
                  return (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-base font-bold text-slate-800">Lembar Observasi / Pengamatan</h4>
                          <p className="text-xs text-slate-500">Tentukan aspek-aspek pengamatan yang akan dinilai oleh guru.</p>
                        </div>
                        <button
                          onClick={() => {
                            let currentObs = activePackage.instruments.find((i) => i.type === 'OBSERVATION') as ObservationAssessmentInstrument | undefined;
                            const newAspect = { id: `asp-${Date.now()}`, label: '', indicator: '' };

                            let updatedInstruments = [...activePackage.instruments];
                            if (!currentObs) {
                              currentObs = {
                                id: `inst-obs-${Date.now()}`,
                                type: 'OBSERVATION',
                                aspects: [newAspect],
                              };
                              updatedInstruments.push(currentObs);
                            } else {
                              updatedInstruments = updatedInstruments.map((inst) =>
                                inst.type === 'OBSERVATION' ? { ...currentObs!, aspects: [...currentObs!.aspects, newAspect] } : inst
                              );
                            }
                            updatePackage({ ...activePackage, instruments: updatedInstruments });
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Tambah Aspek Observasi
                        </button>
                      </div>

                      {!obsInst ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                          Instrumen Observasi belum tersedia pada paket asesmen.
                        </div>
                      ) : (
                        <>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                              <input
                                type="text"
                                value={obsInst.title || ''}
                                onChange={(e) => {
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.id === obsInst.id ? { ...obsInst, title: e.target.value } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                placeholder="Judul lembar observasi..."
                                className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Petunjuk Observasi:</label>
                                <textarea
                                  rows={2}
                                  value={obsInst.instructions || ''}
                                  onChange={(e) => {
                                    const updatedInstruments = activePackage.instruments.map((inst) =>
                                      inst.id === obsInst.id ? { ...obsInst, instructions: e.target.value || undefined } : inst
                                    );
                                    updatePackage({ ...activePackage, instruments: updatedInstruments });
                                  }}
                                  placeholder="Petunjuk observasi..."
                                  className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Skema Pencatatan:</label>
                                <textarea
                                  rows={2}
                                  value={obsInst.recordingScheme || ''}
                                  onChange={(e) => {
                                    const updatedInstruments = activePackage.instruments.map((inst) =>
                                      inst.id === obsInst.id ? { ...obsInst, recordingScheme: e.target.value || undefined } : inst
                                    );
                                    updatePackage({ ...activePackage, instruments: updatedInstruments });
                                  }}
                                  placeholder="Skema pencatatan (misal: Rating scale 1-4, Checklist Ya/Tidak)..."
                                  className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                                />
                              </div>
                            </div>
                          </div>

                          {obsInst.aspects.length === 0 ? (
                            <p className="text-slate-500 text-sm italic">Belum ada aspek observasi.</p>
                          ) : (
                            <div className="space-y-3">
                              <h5 className="text-xs font-bold text-slate-700">Daftar Aspek Observasi:</h5>
                              {obsInst.aspects.map((asp, aspIdx) => (
                                <div key={asp.id} className="bg-slate-50 p-3 border border-slate-200 rounded-lg space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-600">Aspek #{aspIdx + 1}</span>
                                    <button
                                      onClick={() => {
                                        const updatedAspects = obsInst.aspects.filter((a) => a.id !== asp.id);
                                        const updatedInstruments = activePackage.instruments.map((inst) =>
                                          inst.type === 'OBSERVATION' ? { ...obsInst, aspects: updatedAspects } : inst
                                        );
                                        updatePackage({ ...activePackage, instruments: updatedInstruments });
                                      }}
                                      className="text-red-500 hover:text-red-700 p-1"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Label Aspek:</label>
                                    <input
                                      type="text"
                                      value={asp.label}
                                      onChange={(e) => {
                                        const updatedAspects = obsInst.aspects.map((a) => (a.id === asp.id ? { ...a, label: e.target.value } : a));
                                        const updatedInstruments = activePackage.instruments.map((inst) =>
                                          inst.type === 'OBSERVATION' ? { ...obsInst, aspects: updatedAspects } : inst
                                        );
                                        updatePackage({ ...activePackage, instruments: updatedInstruments });
                                      }}
                                      placeholder="Label aspek (misal: Keaktifan Diskusi)..."
                                      className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Indikator yang Diamati:</label>
                                    <textarea
                                      rows={2}
                                      value={asp.indicator || ''}
                                      onChange={(e) => {
                                        const updatedAspects = obsInst.aspects.map((a) => (a.id === asp.id ? { ...a, indicator: e.target.value || undefined } : a));
                                        const updatedInstruments = activePackage.instruments.map((inst) =>
                                          inst.type === 'OBSERVATION' ? { ...obsInst, aspects: updatedAspects } : inst
                                        );
                                        updatePackage({ ...activePackage, instruments: updatedInstruments });
                                      }}
                                      placeholder="Indikator perilaku yang diamati..."
                                      className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ASSIGNMENT EDITOR */}
                {activeInstType === 'ASSIGNMENT' && (() => {
                  const assignInst = activePackage.instruments.find((i) => i.type === 'ASSIGNMENT') as AssignmentAssessmentInstrument | undefined;
                  if (!assignInst) {
                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                        Instrumen Penugasan belum tersedia pada paket asesmen.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-800">Instrumen Penugasan</h4>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                          <input
                            type="text"
                            value={assignInst.title || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === assignInst.id ? { ...assignInst, title: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Judul instrumen penugasan..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Instruksi Penugasan:</label>
                          <textarea
                            rows={4}
                            value={assignInst.instructions}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === assignInst.id ? { ...assignInst, instructions: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Instruksi penugasan bagi siswa..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Hasil / Luaran yang Diharapkan:</label>
                          <textarea
                            rows={2}
                            value={assignInst.expectedOutput || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === assignInst.id ? { ...assignInst, expectedOutput: e.target.value || undefined } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Luaran penugasan (misal: Laporan 2 halaman, Infografis)..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* PROJECT EDITOR */}
                {activeInstType === 'PROJECT' && (() => {
                  const projInst = activePackage.instruments.find((i) => i.type === 'PROJECT') as ProjectAssessmentInstrument | undefined;
                  if (!projInst) {
                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                        Instrumen Proyek belum tersedia pada paket asesmen.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-800">Instrumen Asesmen Proyek</h4>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                          <input
                            type="text"
                            value={projInst.title || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === projInst.id ? { ...projInst, title: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Judul instrumen proyek..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi / Brief Proyek:</label>
                          <textarea
                            rows={4}
                            value={projInst.projectBrief}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === projInst.id ? { ...projInst, projectBrief: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Deskripsi dan brief proyek..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Luaran Proyek yang Diharapkan:</label>
                          <textarea
                            rows={2}
                            value={projInst.expectedDeliverable || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === projInst.id ? { ...projInst, expectedDeliverable: e.target.value || undefined } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Luaran akhir proyek yang diharapkan..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* PRODUCT EDITOR */}
                {activeInstType === 'PRODUCT' && (() => {
                  const prodInst = activePackage.instruments.find((i) => i.type === 'PRODUCT') as ProductAssessmentInstrument | undefined;
                  if (!prodInst) {
                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                        Instrumen Produk belum tersedia pada paket asesmen.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-800">Instrumen Asesmen Produk</h4>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                          <input
                            type="text"
                            value={prodInst.title || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === prodInst.id ? { ...prodInst, title: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Judul instrumen produk..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi / Spesifikasi Produk:</label>
                          <textarea
                            rows={4}
                            value={prodInst.productBrief}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === prodInst.id ? { ...prodInst, productBrief: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Spesifikasi atau instruksi pembuatan produk..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Produk / Hasil yang Diharapkan:</label>
                          <textarea
                            rows={2}
                            value={prodInst.expectedProduct || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === prodInst.id ? { ...prodInst, expectedProduct: e.target.value || undefined } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Produk atau artefak yang diharapkan dihasilkan siswa..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* PORTFOLIO EDITOR */}
                {activeInstType === 'PORTFOLIO' && (() => {
                  const portInst = activePackage.instruments.find((i) => i.type === 'PORTFOLIO') as PortfolioAssessmentInstrument | undefined;
                  if (!portInst) {
                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                        Instrumen Portofolio belum tersedia pada paket asesmen.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-base font-bold text-slate-800">Instrumen Portofolio</h4>
                        <button
                          onClick={() => {
                            const updatedReqs = [...(portInst.evidenceRequirements || []), ''];
                            const updatedInstruments = activePackage.instruments.map((inst) =>
                              inst.id === portInst.id ? { ...portInst, evidenceRequirements: updatedReqs } : inst
                            );
                            updatePackage({ ...activePackage, instruments: updatedInstruments });
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Tambah Persyaratan Bukti
                        </button>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                          <input
                            type="text"
                            value={portInst.title || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === portInst.id ? { ...portInst, title: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Judul instrumen portofolio..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Petunjuk Portofolio:</label>
                          <textarea
                            rows={2}
                            value={portInst.instructions || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === portInst.id ? { ...portInst, instructions: e.target.value || undefined } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder="Petunjuk portofolio (opsional)..."
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-700">Persyaratan Bukti:</h5>
                        {(!portInst.evidenceRequirements || portInst.evidenceRequirements.length === 0) && (
                          <p className="text-slate-500 text-xs italic">Belum ada persyaratan bukti portofolio.</p>
                        )}
                        {(portInst.evidenceRequirements || []).map((req, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg">
                            <span className="text-xs font-bold text-slate-600 w-6">{rIdx + 1}.</span>
                            <input
                              type="text"
                              value={req}
                              onChange={(e) => {
                                const updatedReqs = portInst.evidenceRequirements.map((r, idx) =>
                                  idx === rIdx ? e.target.value : r
                                );
                                const updatedInstruments = activePackage.instruments.map((inst) =>
                                  inst.id === portInst.id ? { ...portInst, evidenceRequirements: updatedReqs } : inst
                                );
                                updatePackage({ ...activePackage, instruments: updatedInstruments });
                              }}
                              placeholder="Dokumen / bukti portofolio yang dipersyaratkan..."
                              className="text-xs p-1.5 border border-slate-300 rounded flex-1 bg-white"
                            />
                            <button
                              onClick={() => {
                                const updatedReqs = portInst.evidenceRequirements.filter((_, idx) => idx !== rIdx);
                                const updatedInstruments = activePackage.instruments.map((inst) =>
                                  inst.id === portInst.id ? { ...portInst, evidenceRequirements: updatedReqs } : inst
                                );
                                updatePackage({ ...activePackage, instruments: updatedInstruments });
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* SELF & PEER ASSESSMENT EDITOR */}
                {(activeInstType === 'SELF_ASSESSMENT' || activeInstType === 'PEER_ASSESSMENT') && (() => {
                  const selfPeerInst = activePackage.instruments.find((i) => i.type === activeInstType) as SelfPeerAssessmentInstrument | undefined;
                  const isSelf = activeInstType === 'SELF_ASSESSMENT';
                  const label = isSelf ? 'Penilaian Diri' : 'Penilaian Antar-Teman';
                  if (!selfPeerInst) {
                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                        Instrumen {label} belum tersedia pada paket asesmen.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-800">Instrumen {label}</h4>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen:</label>
                          <input
                            type="text"
                            value={selfPeerInst.title || ''}
                            onChange={(e) => {
                              const updatedInstruments = activePackage.instruments.map((inst) =>
                                inst.id === selfPeerInst.id ? { ...selfPeerInst, title: e.target.value } : inst
                              );
                              updatePackage({ ...activePackage, instruments: updatedInstruments });
                            }}
                            placeholder={`Judul instrumen ${label.toLowerCase()}...`}
                            className="text-xs p-2 border border-slate-300 rounded w-full bg-white font-medium"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Petunjuk:</label>
                            <textarea
                              rows={2}
                              value={selfPeerInst.instructions || ''}
                              onChange={(e) => {
                                const updatedInstruments = activePackage.instruments.map((inst) =>
                                  inst.id === selfPeerInst.id ? { ...selfPeerInst, instructions: e.target.value || undefined } : inst
                                );
                                updatePackage({ ...activePackage, instruments: updatedInstruments });
                              }}
                              placeholder="Petunjuk pengerjaan..."
                              className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Skema Respon:</label>
                            <textarea
                              rows={2}
                              value={selfPeerInst.responseScheme || ''}
                              onChange={(e) => {
                                const updatedInstruments = activePackage.instruments.map((inst) =>
                                  inst.id === selfPeerInst.id ? { ...selfPeerInst, responseScheme: e.target.value || undefined } : inst
                                );
                                updatePackage({ ...activePackage, instruments: updatedInstruments });
                              }}
                              placeholder="Skema respon (misal: Skala Likert 1-4, Ya/Tidak)..."
                              className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-700">Daftar Pernyataan ({selfPeerInst.items?.length || 0} butir):</h5>
                        {(!selfPeerInst.items || selfPeerInst.items.length === 0) && (
                          <p className="text-slate-500 text-xs italic">Belum ada butir pernyataan.</p>
                        )}
                        {(selfPeerInst.items || []).map((item, idx) => (
                          <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {item.id}</span>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Pernyataan:</label>
                              <textarea
                                rows={2}
                                value={item.statement}
                                onChange={(e) => {
                                  const updatedItems = selfPeerInst.items.map((it) =>
                                    it.id === item.id ? { ...it, statement: e.target.value } : it
                                  );
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.id === selfPeerInst.id ? { ...selfPeerInst, items: updatedItems } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                placeholder="Teks pernyataan refleksi/penilaian..."
                                className="text-xs p-2 border border-slate-300 rounded w-full bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori (opsional):</label>
                              <input
                                type="text"
                                value={item.category || ''}
                                onChange={(e) => {
                                  const updatedItems = selfPeerInst.items.map((it) =>
                                    it.id === item.id ? { ...it, category: e.target.value || undefined } : it
                                  );
                                  const updatedInstruments = activePackage.instruments.map((inst) =>
                                    inst.id === selfPeerInst.id ? { ...selfPeerInst, items: updatedItems } : inst
                                  );
                                  updatePackage({ ...activePackage, instruments: updatedInstruments });
                                }}
                                placeholder="Kategori aspek (misal: Kerjasama, Kejujuran)..."
                                className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* UNKNOWN / OTHER INSTRUMENTS GENERIC FALLBACK EDITOR */}
                {activeInstType &&
                  activeInstType !== 'WRITTEN_TEST' &&
                  activeInstType !== 'ORAL_TEST' &&
                  activeInstType !== 'PERFORMANCE' &&
                  activeInstType !== 'OBSERVATION' &&
                  activeInstType !== 'ASSIGNMENT' &&
                  activeInstType !== 'PROJECT' &&
                  activeInstType !== 'PRODUCT' &&
                  activeInstType !== 'PORTFOLIO' &&
                  activeInstType !== 'SELF_ASSESSMENT' &&
                  activeInstType !== 'PEER_ASSESSMENT' && (
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-800">Pengaturan Instrumen ({activeInstType})</h4>
                      <p className="text-xs text-slate-500">Lengkapi detail dan instruksi instrumen sesuai rencana pembelajaran.</p>
                    </div>
                  )}
              </div>
            )}

            {/* TAB 4: KEYS, PEDOMAN & RUBRIK */}
            {activeTab === 'keys_rubrics' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-bold text-slate-800 mb-2">Rubrik Penilaian & KKTP</h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Tambahkan rubrik kriteria dan skala capaian penilaian.
                  </p>
                  <button
                    onClick={() => {
                      const newRubric: AssessmentRubric = {
                        id: `rubric-${Date.now()}`,
                        title: '',
                        criteria: [],
                        scale: [],
                      };
                      updatePackage({ ...activePackage, rubrics: [...activePackage.rubrics, newRubric] });
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Tambah Rubrik
                  </button>
                </div>

                {activePackage.rubrics.length === 0 ? (
                  <p className="text-slate-500 text-sm italic">Belum ada rubrik yang dibuat.</p>
                ) : (
                  <div className="space-y-4">
                    {activePackage.rubrics.map((rub) => (
                      <div key={rub.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                        <div className="flex justify-between items-center gap-2">
                          <input
                            type="text"
                            placeholder="Judul Rubrik Penilaian..."
                            value={rub.title}
                            onChange={(e) => {
                              const updated = activePackage.rubrics.map((r) => (r.id === rub.id ? { ...r, title: e.target.value } : r));
                              updatePackage({ ...activePackage, rubrics: updated });
                            }}
                            className="font-bold text-sm bg-white p-1.5 border border-slate-300 rounded text-slate-800 flex-1"
                          />
                          <button
                            onClick={() => {
                              const updated = activePackage.rubrics.filter((r) => r.id !== rub.id);
                              updatePackage({ ...activePackage, rubrics: updated });
                            }}
                            className="text-red-500 hover:text-red-700 p-1 text-xs"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Criteria Section */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-slate-700">Kriteria Penilaian:</span>
                            <button
                              onClick={() => {
                                const newCrit = { id: `crit-${Date.now()}`, label: '' };
                                const updated = activePackage.rubrics.map((r) =>
                                  r.id === rub.id ? { ...r, criteria: [...r.criteria, newCrit] } : r
                                );
                                updatePackage({ ...activePackage, rubrics: updated });
                              }}
                              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Tambah Kriteria
                            </button>
                          </div>
                          {rub.criteria.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Belum ada kriteria. Silakan tambahkan kriteria penilaian.</p>
                          ) : (
                            rub.criteria.map((crit, cIdx) => (
                              <div key={crit.id} className="p-2.5 bg-white border border-slate-200 rounded space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-700">Kriteria #{cIdx + 1}</span>
                                  <button
                                    onClick={() => {
                                      const updatedCrits = rub.criteria.filter((c) => c.id !== crit.id);
                                      const updated = activePackage.rubrics.map((r) =>
                                        r.id === rub.id ? { ...r, criteria: updatedCrits } : r
                                      );
                                      updatePackage({ ...activePackage, rubrics: updated });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <div className="md:col-span-2">
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Label Kriteria:</label>
                                    <input
                                      type="text"
                                      value={crit.label}
                                      onChange={(e) => {
                                        const updatedCrits = rub.criteria.map((c) => (c.id === crit.id ? { ...c, label: e.target.value } : c));
                                        const updated = activePackage.rubrics.map((r) =>
                                          r.id === rub.id ? { ...r, criteria: updatedCrits } : r
                                        );
                                        updatePackage({ ...activePackage, rubrics: updated });
                                      }}
                                      placeholder="Label kriteria (misal: Ketepatan Konsep)..."
                                      className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Bobot:</label>
                                    <input
                                      type="number"
                                      value={crit.weight !== undefined ? crit.weight : ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                                        const updatedCrits = rub.criteria.map((c) => (c.id === crit.id ? { ...c, weight: val } : c));
                                        const updated = activePackage.rubrics.map((r) =>
                                          r.id === rub.id ? { ...r, criteria: updatedCrits } : r
                                        );
                                        updatePackage({ ...activePackage, rubrics: updated });
                                      }}
                                      placeholder="Bobot angka (opsional)..."
                                      className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Indikator:</label>
                                  <textarea
                                    rows={2}
                                    value={crit.indicator || ''}
                                    onChange={(e) => {
                                      const updatedCrits = rub.criteria.map((c) => (c.id === crit.id ? { ...c, indicator: e.target.value || undefined } : c));
                                      const updated = activePackage.rubrics.map((r) =>
                                        r.id === rub.id ? { ...r, criteria: updatedCrits } : r
                                      );
                                      updatePackage({ ...activePackage, rubrics: updated });
                                    }}
                                    placeholder="Indikator ketercapaian kriteria..."
                                    className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Scale Section */}
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-slate-700">Tingkat Skala Penilaian:</span>
                            <button
                              onClick={() => {
                                const newScale = {
                                  id: `scale-${Date.now()}`,
                                  label: '',
                                  order: rub.scale.length + 1,
                                  score: undefined,
                                  descriptor: '',
                                };
                                const updated = activePackage.rubrics.map((r) =>
                                  r.id === rub.id ? { ...r, scale: [...r.scale, newScale] } : r
                                );
                                updatePackage({ ...activePackage, rubrics: updated });
                              }}
                              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Tambah Tingkat Skala
                            </button>
                          </div>
                          {rub.scale.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Belum ada tingkat skala. Silakan tambahkan skala penilaian.</p>
                          ) : (
                            rub.scale.map((sc, sIdx) => (
                              <div key={sc.id} className="p-2 bg-white border border-slate-200 rounded space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-500 w-5">#{sIdx + 1}</span>
                                  <input
                                    type="text"
                                    value={sc.label}
                                    onChange={(e) => {
                                      const updatedScale = rub.scale.map((s) => (s.id === sc.id ? { ...s, label: e.target.value } : s));
                                      const updated = activePackage.rubrics.map((r) =>
                                        r.id === rub.id ? { ...r, scale: updatedScale } : r
                                      );
                                      updatePackage({ ...activePackage, rubrics: updated });
                                    }}
                                    placeholder="Label skala (misal: Baru Memulai, Berkembang, Mahir)..."
                                    className="text-xs p-1 border border-slate-300 rounded flex-1 bg-white font-medium"
                                  />
                                  <input
                                    type="number"
                                    value={sc.score !== undefined ? sc.score : ''}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                                      const updatedScale = rub.scale.map((s) => (s.id === sc.id ? { ...s, score: val } : s));
                                      const updated = activePackage.rubrics.map((r) =>
                                        r.id === rub.id ? { ...r, scale: updatedScale } : r
                                      );
                                      updatePackage({ ...activePackage, rubrics: updated });
                                    }}
                                    placeholder="Skor (opsional)"
                                    className="text-xs p-1 border border-slate-300 rounded w-28 bg-white"
                                  />
                                  <button
                                    onClick={() => {
                                      const updatedScale = rub.scale.filter((s) => s.id !== sc.id);
                                      const updated = activePackage.rubrics.map((r) =>
                                        r.id === rub.id ? { ...r, scale: updatedScale } : r
                                      );
                                      updatePackage({ ...activePackage, rubrics: updated });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={sc.descriptor || ''}
                                  onChange={(e) => {
                                    const updatedScale = rub.scale.map((s) => (s.id === sc.id ? { ...s, descriptor: e.target.value } : s));
                                    const updated = activePackage.rubrics.map((r) =>
                                      r.id === rub.id ? { ...r, scale: updatedScale } : r
                                    );
                                    updatePackage({ ...activePackage, rubrics: updated });
                                  }}
                                  placeholder="Deskriptor capaian untuk tingkat ini (opsional)..."
                                  className="text-xs p-1 border border-slate-200 rounded w-full text-slate-600 bg-slate-50"
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PEDOMAN PENSKORAN SECTION */}
                <div className="pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 mb-1">Pedoman Penskoran</h4>
                      <p className="text-xs text-slate-500">
                        Pedoman penilaian dan penskoran untuk item/instrumen yang membutuhkan panduan penilaian khusus.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const newGuide: AssessmentScoringGuide = {
                          id: `sg-${Date.now()}`,
                          title: '',
                          guideType: 'MANUAL',
                          instructions: '',
                          maxScore: undefined,
                        };
                        updatePackage({
                          ...activePackage,
                          scoringGuides: [...(activePackage.scoringGuides || []), newGuide],
                        });
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Tambah Pedoman Penskoran
                    </button>
                  </div>

                  {(!activePackage.scoringGuides || activePackage.scoringGuides.length === 0) ? (
                    <p className="text-slate-500 text-sm italic">Belum ada pedoman penskoran pada perangkat ini.</p>
                  ) : (
                    <div className="space-y-4">
                      {activePackage.scoringGuides.map((guide) => {
                        const selectedInst = activePackage.instruments.find((i) => i.id === guide.instrumentId);

                        let availableItems: { id: string; label: string; itemType?: string }[] = [];
                        if (selectedInst) {
                          if (selectedInst.type === 'WRITTEN_TEST') {
                            const written = selectedInst as WrittenAssessmentInstrument;
                            availableItems = (written.items || []).map((it, idx) => ({
                              id: it.id,
                              label: `Soal #${idx + 1} (${it.itemType || 'UNKNOWN'})${it.prompt ? `: ${it.prompt.slice(0, 30)}...` : ''}`,
                              itemType: it.itemType,
                            }));
                          } else if (selectedInst.type === 'ORAL_TEST') {
                            const oral = selectedInst as OralAssessmentInstrument;
                            availableItems = (oral.items || []).map((it, idx) => ({
                              id: it.id,
                              label: `Pertanyaan #${idx + 1}${it.prompt ? `: ${it.prompt.slice(0, 30)}...` : ''}`,
                            }));
                          } else if (selectedInst.type === 'PERFORMANCE') {
                            const perf = selectedInst as PerformanceAssessmentInstrument;
                            availableItems = (perf.aspects || []).map((asp, idx) => ({
                              id: asp.id,
                              label: `Aspek #${idx + 1}: ${asp.label || asp.id}`,
                            }));
                          } else if (selectedInst.type === 'OBSERVATION') {
                            const obs = selectedInst as ObservationAssessmentInstrument;
                            availableItems = (obs.aspects || []).map((asp, idx) => ({
                              id: asp.id,
                              label: `Aspek #${idx + 1}: ${asp.label || asp.id}`,
                            }));
                          } else if (selectedInst.type === 'SELF_ASSESSMENT' || selectedInst.type === 'PEER_ASSESSMENT') {
                            const sp = selectedInst as SelfPeerAssessmentInstrument;
                            availableItems = (sp.items || []).map((it, idx) => ({
                              id: it.id,
                              label: `Pernyataan #${idx + 1}${it.statement ? `: ${it.statement.slice(0, 30)}...` : ''}`,
                            }));
                          }
                        }

                        return (
                          <div key={guide.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                            <div className="flex justify-between items-center gap-2">
                              <div className="flex-1">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Judul Pedoman:</label>
                                <input
                                  type="text"
                                  value={guide.title}
                                  onChange={(e) => {
                                    const updatedGuides = activePackage.scoringGuides.map((g) =>
                                      g.id === guide.id ? { ...g, title: e.target.value } : g
                                    );
                                    updatePackage({ ...activePackage, scoringGuides: updatedGuides });
                                  }}
                                  placeholder="Judul pedoman penskoran..."
                                  className="font-bold text-sm bg-white p-1.5 border border-slate-300 rounded text-slate-800 w-full"
                                />
                              </div>
                              <div className="w-48">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Tipe Panduan (Read-Only):</label>
                                <input
                                  type="text"
                                  readOnly
                                  value={guide.guideType}
                                  className="text-xs p-1.5 border border-slate-200 rounded bg-slate-100 text-slate-600 font-mono w-full cursor-not-allowed"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const updatedGuides = activePackage.scoringGuides.filter((g) => g.id !== guide.id);
                                  updatePackage({ ...activePackage, scoringGuides: updatedGuides });
                                }}
                                className="text-red-500 hover:text-red-700 p-1 text-xs self-end mb-1"
                                title="Hapus Pedoman Penskoran"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Linkage Selection Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-2.5 rounded border border-slate-200">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Instrumen Terkait:</label>
                                <select
                                  value={guide.instrumentId || ''}
                                  onChange={(e) => {
                                    const nextInstId = e.target.value || undefined;
                                    const nextInst = activePackage.instruments.find((i) => i.id === nextInstId);

                                    let nextItemId = guide.instrumentItemId;
                                    let isEssayItem = false;

                                    if (nextInst && nextItemId) {
                                      let itemFound = false;
                                      if (nextInst.type === 'WRITTEN_TEST') {
                                        const written = nextInst as WrittenAssessmentInstrument;
                                        const item = written.items?.find((it) => it.id === nextItemId);
                                        if (item) {
                                          itemFound = true;
                                          if (item.itemType === 'ESSAY') isEssayItem = true;
                                        }
                                      } else if (nextInst.type === 'ORAL_TEST') {
                                        itemFound = (nextInst as OralAssessmentInstrument).items?.some((it) => it.id === nextItemId) || false;
                                      } else if (nextInst.type === 'PERFORMANCE' || nextInst.type === 'OBSERVATION') {
                                        itemFound = (nextInst as PerformanceAssessmentInstrument).aspects?.some((asp) => asp.id === nextItemId) || false;
                                      } else if (nextInst.type === 'SELF_ASSESSMENT' || nextInst.type === 'PEER_ASSESSMENT') {
                                        itemFound = (nextInst as SelfPeerAssessmentInstrument).items?.some((it) => it.id === nextItemId) || false;
                                      }

                                      if (!itemFound) {
                                        nextItemId = undefined;
                                      }
                                    } else if (!nextInstId) {
                                      nextItemId = undefined;
                                    }

                                    const nextGuideType = isEssayItem ? 'ESSAY' : guide.guideType === 'ESSAY' ? 'MANUAL' : guide.guideType;

                                    const updatedGuides = activePackage.scoringGuides.map((g) =>
                                      g.id === guide.id
                                        ? { ...g, instrumentId: nextInstId, instrumentItemId: nextItemId, guideType: nextGuideType }
                                        : g
                                    );
                                    updatePackage({ ...activePackage, scoringGuides: updatedGuides });
                                  }}
                                  className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white font-medium"
                                >
                                  <option value="">-- Tanpa Instrumen Spesifik --</option>
                                  {activePackage.instruments.map((inst) => (
                                    <option key={inst.id} value={inst.id}>
                                      {inst.type} ({inst.title || inst.id})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Butir Soal / Aspek Terkait:</label>
                                <select
                                  disabled={!guide.instrumentId}
                                  value={guide.instrumentItemId || ''}
                                  onChange={(e) => {
                                    const nextItemId = e.target.value || undefined;
                                    let isEssayItem = false;

                                    if (selectedInst && nextItemId) {
                                      if (selectedInst.type === 'WRITTEN_TEST') {
                                        const item = (selectedInst as WrittenAssessmentInstrument).items?.find((it) => it.id === nextItemId);
                                        if (item?.itemType === 'ESSAY') {
                                          isEssayItem = true;
                                        }
                                      }
                                    }

                                    const nextGuideType = isEssayItem ? 'ESSAY' : guide.guideType === 'ESSAY' ? 'MANUAL' : guide.guideType;

                                    const updatedGuides = activePackage.scoringGuides.map((g) =>
                                      g.id === guide.id ? { ...g, instrumentItemId: nextItemId, guideType: nextGuideType } : g
                                    );
                                    updatePackage({ ...activePackage, scoringGuides: updatedGuides });
                                  }}
                                  className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white font-medium disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <option value="">-- Tanpa Butir Spesifik --</option>
                                  {availableItems.map((it) => (
                                    <option key={it.id} value={it.id}>
                                      {it.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Instruksi Penskoran:</label>
                                <textarea
                                  rows={2}
                                  value={guide.instructions || ''}
                                  onChange={(e) => {
                                    const updatedGuides = activePackage.scoringGuides.map((g) =>
                                      g.id === guide.id ? { ...g, instructions: e.target.value || undefined } : g
                                    );
                                    updatePackage({ ...activePackage, scoringGuides: updatedGuides });
                                  }}
                                  placeholder="Petunjuk/instruksi pemberian skor..."
                                  className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Skor Maksimal:</label>
                                <input
                                  type="number"
                                  value={guide.maxScore !== undefined ? guide.maxScore : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                                    const updatedGuides = activePackage.scoringGuides.map((g) =>
                                      g.id === guide.id ? { ...g, maxScore: val } : g
                                    );
                                    updatePackage({ ...activePackage, scoringGuides: updatedGuides });
                                  }}
                                  placeholder="Skor maks..."
                                  className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Catatan Tambahan:</label>
                              <textarea
                                rows={2}
                                value={guide.notes || ''}
                                onChange={(e) => {
                                  const updatedGuides = activePackage.scoringGuides.map((g) =>
                                    g.id === guide.id ? { ...g, notes: e.target.value || undefined } : g
                                  );
                                  updatePackage({ ...activePackage, scoringGuides: updatedGuides });
                                }}
                                placeholder="Catatan tambahan penskoran (opsional)..."
                                className="text-xs p-1.5 border border-slate-300 rounded w-full bg-white"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: PREVIEW */}
            {activeTab === 'preview' && (
              <div className="space-y-6">
                {(() => {
                  try {
                    const previewContext: DocumentGenerationContext = {
                      school,
                      profile,
                      academicSetting,
                      workspace,
                      tp,
                      k13Analysis,
                      assessmentCriteria,
                      assessmentPlans,
                      assessmentPackages,
                      activeAssessmentPackageId: activePackage.id,
                      documentMode: 'data',
                    };

                    const previewModel = createAssessmentPreviewModel(previewContext, {
                      documentMode: 'data',
                    });

                    return (
                      <AssessmentDocumentPreview
                        model={previewModel}
                        workflowStatus={activePackage.workflowStatus}
                        needsReview={activePackage.needsReview}
                      />
                    );
                  } catch (err: any) {
                    return (
                      <div className="p-6 bg-red-50 border border-red-200 rounded-xl space-y-2 text-red-900">
                        <div className="flex items-center gap-2 font-bold text-base">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <span>Pratinjau belum dapat dibuat.</span>
                        </div>
                        <p className="text-xs text-red-700">
                          {err?.message || 'Terjadi kesalahan saat mengompilasi model dokumen pratinjau.'}
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            {/* TAB 6: VALIDATION & STATUS */}
            {activeTab === 'validation' && (
              <div className="space-y-6">
                <div
                  className={`p-4 rounded-xl border ${
                    validationResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    )}
                    <h4 className="font-bold text-base">
                      {validationResult.valid ? 'Perangkat Asesmen Lengkap & Valid' : 'Perangkat Asesmen Belum Lengkap'}
                    </h4>
                  </div>
                  <p className="text-sm">
                    {validationResult.valid
                      ? 'Seluruh komponen perangkat asesmen (kisi-kisi, instrumen, kunci/rubrik) telah terverifikasi valid.'
                      : 'Lengkapi seluruh item bertanda error di bawah ini agar Perangkat Asesmen dapat dikonfirmasi berstatus SIAP.'}
                  </p>
                </div>

                {validationResult.errors.length > 0 && (
                  <div>
                    <h5 className="font-bold text-sm text-red-700 mb-2">Daftar Hal Yang Wajib Perlu Ditingkatkan (Errors):</h5>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div>
                    <h5 className="font-bold text-sm text-amber-700 mb-2">Peringatan / Catatan (Warnings):</h5>
                    <ul className="list-disc list-inside space-y-1 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationReport && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                    <h5 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      Bagian yang Perlu Diperiksa
                    </h5>
                    {(() => {
                      const allFindings = [
                        ...(validationReport.structural?.findings || []),
                        ...(validationReport.coverage?.findings || []),
                        ...(validationReport.answerVerification?.findings || []),
                        ...(validationReport.quality?.findings || []),
                        ...(validationReport.assembly?.findings || []),
                      ];
                      if (allFindings.length === 0) {
                        return <p className="text-xs text-slate-500">Tidak ada temuan kualitas AI. Perangkat siap.</p>;
                      }
                      return (
                        <div className="space-y-2">
                          {allFindings.map((finding: any, idx: number) => {
                            const action = assessmentRegenerationEligibilityService.resolveActionForFinding(finding);
                            return (
                              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div>
                                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase">{finding.dimension || finding.code}</span>
                                    <span>{finding.message || finding.description || finding.code}</span>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  {action.eligible && action.target && action.targetId ? (
                                    <button
                                      onClick={() => handleRegenerateTarget(action.target!, action.targetId!, false, action.locator)}
                                      disabled={isRegenerating}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-sm transition"
                                    >
                                      <RefreshCw className="w-3 h-3" /> {action.label}
                                    </button>
                                  ) : (
                                    <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-semibold">
                                      Periksa Manual
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);
};
