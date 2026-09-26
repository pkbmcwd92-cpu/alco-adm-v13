import {
  WorkflowStepId,
  CurriculumType,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  AdministrationWorkspace,
  CPData,
  CPAnalysisData,
  TPData,
  TPItem,
  ATPData,
  ATPItem,
  AssessmentCriterion,
  Assessment,
  AssessmentResult,
  RemedialRecord,
  EnrichmentRecord,
  K13Analysis,
  K13KKM,
  ProfileWorkspaceData,
} from '../types';
import { getCurriculumTypeFromSetting } from './curriculumRouter';
import { validateAcademicSettingReadiness } from './academicSettingReadiness';
import { resolveCurriculumContext, resolveSubjectInput } from '../data/curriculum/resolver';
import { ResolvedCurriculumContext } from '../data/curriculum/types';
import { getPhaseFromGrade } from '../data/curriculumDefaults';
import { validateKKTPData, resolveCriterionTPReference } from './cpWorkflowService';

export type WorkflowStatus = 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETE' | 'STALE';

export interface WorkflowStepState {
  id: WorkflowStepId;
  status: WorkflowStatus;
  isBlocked: boolean;
  isComplete: boolean;
  isStale: boolean;
  reason?: string;
  missingDependencies?: string[];
}

export interface AdministrationContext {
  workspaceId: string;
  teacherProfileId: string;
  schoolId: string;
  academicYear: string;
  semester?: 1 | 2;
  curriculumType?: CurriculumType;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK' | '';
  grade: number;
  rawGrade: string;
  subjectCode: string;
  subjectName: string;
  phase?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  curriculumResolutionStatus: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
  resolvedContext?: ResolvedCurriculumContext | null;
  unresolvedReason?: string;
}

/**
 * Builds a canonical AdministrationContext from workspace and administrative inputs.
 * Strictly avoids fake fallbacks. If any mandatory parameter is missing or invalid,
 * curriculumResolutionStatus is set to 'UNRESOLVED'.
 * Integrates directly with resolveCurriculumContext from PATCH A as single source of truth.
 */
export function buildAdministrationContext(data: {
  workspace?: AdministrationWorkspace | null;
  profile?: TeacherProfile | null;
  school?: SchoolData | null;
  academicSetting?: AcademicSetting | null;
}): AdministrationContext {
  const { workspace, profile, school, academicSetting } = data;

  const academicReadiness = validateAcademicSettingReadiness(academicSetting);
  const curriculumType: CurriculumType | undefined =
    academicReadiness.curriculumType || getCurriculumTypeFromSetting(academicSetting);

  // Extract raw inputs without injecting false default values
  const schoolId = school?.id || '';
  const teacherProfileId = profile?.id || '';
  const workspaceId = workspace?.id || '';
  const academicYear = academicSetting?.academicYear?.trim() || '';
  const semester: 1 | 2 | undefined = academicSetting?.semester === '1 (Ganjil)'
    ? 1
    : academicSetting?.semester === '2 (Genap)'
    ? 2
    : undefined;

  const rawLevel = (academicSetting?.level?.trim() || '') as 'SD' | 'SMP' | 'SMA' | 'SMK';
  const rawGrade = (academicSetting?.grade || '').trim();
  const rawSubject = academicSetting?.subject?.trim() || '';

  // Parse grade number
  const gradeMatch = rawGrade.match(/\d+/);
  const gradeNum = gradeMatch ? parseInt(gradeMatch[0], 10) : 0;

  const isSchoolMissing = !schoolId;
  const isWorkspaceMissing = !workspaceId;

  let curriculumResolutionStatus: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS' = 'UNRESOLVED';
  let resolvedContext: ResolvedCurriculumContext | null = null;
  let unresolvedReason: string | undefined = undefined;
  let subjectCode = '';
  let subjectName = rawSubject;
  let phase: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | undefined = undefined;

  if (!academicReadiness.valid) {
    unresolvedReason = academicReadiness.errors[0] || 'Data Pembelajaran belum lengkap.';
  } else if (isWorkspaceMissing) {
    unresolvedReason = 'Workspace administrasi belum dipilih atau belum lengkap.';
  } else if (isSchoolMissing) {
    unresolvedReason = 'Data satuan pendidikan (sekolah) belum dipilih atau belum lengkap.';
  } else {
    // Resolve via Canonical Curriculum Resolver PATCH A
    const resolution = resolveCurriculumContext({
      curriculumType,
      academicYear,
      level: rawLevel,
      grade: gradeNum,
      subjectInput: rawSubject,
    });

    if (resolution) {
      resolvedContext = resolution;
      subjectCode = resolution.subject.code;
      subjectName = resolution.subject.name;
      phase = resolution.phase as 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
      curriculumResolutionStatus = resolution.isAmbiguous ? 'AMBIGUOUS' : 'RESOLVED';
    } else {
      unresolvedReason = `Struktur kurikulum tidak ditemukan untuk mata pelajaran '${rawSubject}' pada jenjang ${rawLevel} Kelas ${gradeNum}.`;
      curriculumResolutionStatus = 'UNRESOLVED';
    }
  }

  // If subject was not resolved through canonical curriculum structure, normalize code for display/fallback
  if (!subjectCode && rawSubject) {
    const subRes = resolveSubjectInput(rawSubject);
    subjectCode = subRes.subjectCode || rawSubject;
    subjectName = subRes.subject?.name || rawSubject;
  }

  // Derive phase if grade is valid even when curriculum structure is unresolved
  if (!phase && gradeNum >= 1 && gradeNum <= 12 && rawLevel && rawLevel !== 'SMK') {
    phase = getPhaseFromGrade(rawLevel, rawGrade).replace('Fase ', '') as 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  }

  return {
    workspaceId,
    teacherProfileId,
    schoolId,
    academicYear,
    semester,
    curriculumType,
    level: rawLevel || ('' as any),
    grade: gradeNum,
    rawGrade,
    subjectCode: subjectCode || rawSubject,
    subjectName: subjectName || rawSubject,
    phase,
    curriculumResolutionStatus,
    resolvedContext,
    unresolvedReason,
  };
}

export interface DependencyValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  module: WorkflowStepId | 'KKTP' | 'PERENCANAAN' | 'ASESMEN' | 'TINDAK_LANJUT';
  code: string;
  message: string;
  targetId?: string;
}

export interface DependencyValidationReport {
  isValid: boolean;
  hasErrors: boolean;
  hasStaleModules: boolean;
  issues: DependencyValidationIssue[];
  stepStates: Record<WorkflowStepId, WorkflowStepState>;
  kktpState?: {
    status: WorkflowStatus;
    isBlocked: boolean;
    isComplete: boolean;
    isStale: boolean;
    hasOrphans: boolean;
  };
}

/**
 * Checks timestamp difference to detect stale upstream dependencies.
 * Returns true if upstream was modified significantly later than downstream's reference timestamp.
 */
export function isUpstreamStale(
  upstreamUpdatedAt?: string,
  downstreamReferenceUpdatedAt?: string,
  thresholdMs: number = 1000
): boolean {
  if (!upstreamUpdatedAt || !downstreamReferenceUpdatedAt) return false;
  const upstreamTime = new Date(upstreamUpdatedAt).getTime();
  const refTime = new Date(downstreamReferenceUpdatedAt).getTime();
  return upstreamTime > refTime + thresholdMs;
}

/**
 * Validates the full workflow dependency graph for a workspace.
 */
export function validateWorkflowDependencies(
  workspaceData: Partial<ProfileWorkspaceData>
): DependencyValidationReport {
  const issues: DependencyValidationIssue[] = [];

  const profile = workspaceData.profile;
  const school = workspaceData.school;
  const academicSetting = workspaceData.academicSetting;
  const cp = workspaceData.cp;
  const cpAnalysis = workspaceData.cpAnalysis;
  const tp = workspaceData.tp;
  const atp = workspaceData.atp;
  const criteria = workspaceData.assessmentCriteria || [];
  const assessments = workspaceData.assessments || [];
  const assessmentResults = workspaceData.assessmentResults || [];
  const remedials = workspaceData.remedials || [];
  const enrichments = workspaceData.enrichments || [];
  const k13Analysis = workspaceData.k13Analysis;
  const k13KKM = workspaceData.k13KKM;

  const academicReadiness = validateAcademicSettingReadiness(academicSetting);
  const isAcademicComplete = academicReadiness.valid;
  const isProfileComplete = !!profile?.name?.trim();
  const curriculumType = getCurriculumTypeFromSetting(academicSetting);
  const isK13Active = curriculumType === 'K13';

  // Step States initial map
  const stepStates: Record<WorkflowStepId, WorkflowStepState> = {
    profile: {
      id: 'profile',
      status: isProfileComplete ? 'COMPLETE' : 'IN_PROGRESS',
      isBlocked: false,
      isComplete: isProfileComplete,
      isStale: false,
    },
    academic: {
      id: 'academic',
      status: isAcademicComplete ? 'COMPLETE' : 'IN_PROGRESS',
      isBlocked: !isProfileComplete,
      isComplete: isAcademicComplete,
      isStale: false,
    },
    cp: { id: 'cp', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'cp-analysis': { id: 'cp-analysis', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    tp: { id: 'tp', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    atp: { id: 'atp', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'k13-kd': { id: 'k13-kd', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'k13-indikator': { id: 'k13-indikator', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'k13-tujuan': { id: 'k13-tujuan', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'k13-kkm': { id: 'k13-kkm', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    admin: { id: 'admin', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
  };

  // Base Profile & Academic Validation
  if (!isProfileComplete) {
    issues.push({
      severity: 'ERROR',
      module: 'profile',
      code: 'PROFILE_INCOMPLETE',
      message: 'Profil Guru belum lengkap (Nama Guru wajib diisi).',
    });
  }

  if (!isAcademicComplete) {
    issues.push({
      severity: 'ERROR',
      module: 'academic',
      code: 'ACADEMIC_SETTING_INCOMPLETE',
      message: academicReadiness.errors[0] || 'Pengaturan Data Pembelajaran belum lengkap.',
    });
    stepStates.academic.isBlocked = !isProfileComplete;
  }

  let kktpState: {
    status: WorkflowStatus;
    isBlocked: boolean;
    isComplete: boolean;
    isStale: boolean;
    hasOrphans: boolean;
  } = {
    status: 'BLOCKED',
    isBlocked: true,
    isComplete: false,
    isStale: false,
    hasOrphans: false,
  };

  const canEnterCurriculumWorkflow = isProfileComplete && isAcademicComplete;

  if (!canEnterCurriculumWorkflow) {
    // RECOVERY U1.3: ACADEMIC INCOMPLETE = ALL DOWNSTREAM BLOCKED
    // All downstream steps stay in their initial BLOCKED state:
    // status: 'BLOCKED', isBlocked: true, isComplete: false.
    // Existing downstream data (CP, TP, ATP, KD, etc.) in storage remains preserved,
    // but is strictly blocked and cannot be considered complete for the current workflow.
  } else if (curriculumType === 'K13') {
    // ==========================================
    // K13 WORKFLOW VALIDATION
    // ==========================================
    const kdItems = (k13Analysis?.items || []).filter((i) => i.kd && i.kd.trim().length > 0);
    const hasKD = kdItems.length > 0;

    stepStates['k13-kd'] = {
      id: 'k13-kd',
      status: hasKD ? 'COMPLETE' : stepStates.academic.isComplete ? 'READY' : 'BLOCKED',
      isBlocked: !stepStates.academic.isComplete,
      isComplete: hasKD,
      isStale: false,
    };

    const hasAnalisis = hasKD && kdItems.some((i) => (i.materi && i.materi.trim().length > 0) || (i.kegiatan && i.kegiatan.trim().length > 0));
    stepStates['k13-indikator'] = {
      id: 'k13-indikator',
      status: hasAnalisis ? 'COMPLETE' : hasKD ? 'READY' : 'BLOCKED',
      isBlocked: !hasKD,
      isComplete: hasAnalisis,
      isStale: false,
      reason: !hasKD ? 'Memerlukan data SKL/KI/KD terlebih dahulu' : undefined,
    };

    const hasTujuanIndikator = hasAnalisis && kdItems.some((i) => (i.indikator && i.indikator.trim().length > 0) || (i.tujuanPembelajaran && i.tujuanPembelajaran.trim().length > 0));
    stepStates['k13-tujuan'] = {
      id: 'k13-tujuan',
      status: hasTujuanIndikator ? 'COMPLETE' : hasAnalisis ? 'READY' : 'BLOCKED',
      isBlocked: !hasAnalisis,
      isComplete: hasTujuanIndikator,
      isStale: false,
      reason: !hasAnalisis ? 'Memerlukan Analisis KD & Materi terlebih dahulu' : undefined,
    };

    const hasKKM = !!(k13KKM?.items && k13KKM.items.length > 0);
    stepStates['k13-kkm'] = {
      id: 'k13-kkm',
      status: hasKKM ? 'COMPLETE' : hasKD ? 'READY' : 'BLOCKED',
      isBlocked: !hasKD,
      isComplete: hasKKM,
      isStale: false,
    };

    stepStates.admin = {
      id: 'admin',
      status: hasTujuanIndikator ? 'COMPLETE' : 'BLOCKED',
      isBlocked: !hasTujuanIndikator,
      isComplete: hasTujuanIndikator,
      isStale: false,
      reason: !hasTujuanIndikator ? 'Memerlukan Tujuan Pembelajaran & Indikator K13' : undefined,
    };
  } else if (curriculumType === 'KURIKULUM_MERDEKA') {
    // ==========================================
    // KURIKULUM MERDEKA WORKFLOW VALIDATION
    // ==========================================

    // 1. CP
    const hasCPText = !!(cp?.generalDescription && cp.generalDescription.trim().length > 10);
    const hasCPElements = !!(cp?.elements && cp.elements.length > 0);
    const isCPComplete = hasCPText || hasCPElements;

    stepStates.cp = {
      id: 'cp',
      status: isCPComplete ? 'COMPLETE' : stepStates.academic.isComplete ? 'READY' : 'BLOCKED',
      isBlocked: !stepStates.academic.isComplete,
      isComplete: isCPComplete,
      isStale: false,
    };

    // 2. CP Analysis (Explicit Dependency of TP)
    const analysisItems = cpAnalysis?.items || [];
    const isAnalysisComplete = isCPComplete && analysisItems.length > 0 && analysisItems.some((i) => (i.cpCompetence?.trim() || i.materialScope?.trim()));
    const isAnalysisStale = isCPComplete && isUpstreamStale(cp?.updatedAt, cpAnalysis?.basedOnCpUpdatedAt);

    stepStates['cp-analysis'] = {
      id: 'cp-analysis',
      status: !isCPComplete
        ? 'BLOCKED'
        : isAnalysisStale
        ? 'STALE'
        : isAnalysisComplete
        ? 'COMPLETE'
        : analysisItems.length > 0
        ? 'IN_PROGRESS'
        : 'READY',
      isBlocked: !isCPComplete,
      isComplete: isAnalysisComplete,
      isStale: isAnalysisStale,
      reason: !isCPComplete ? 'Memerlukan data Capaian Pembelajaran (CP) terlebih dahulu' : isAnalysisStale ? 'Data CP telah diperbarui, analisis CP perlu diselaraskan' : undefined,
      missingDependencies: !isCPComplete ? ['Capaian Pembelajaran (CP)'] : undefined,
    };

    if (!isCPComplete && analysisItems.length > 0) {
      issues.push({
        severity: 'WARNING',
        module: 'cp-analysis',
        code: 'ORPHAN_CP_ANALYSIS',
        message: 'Analisis CP ada tetapi data CP induk belum lengkap.',
      });
    }

    if (isAnalysisStale) {
      issues.push({
        severity: 'INFO',
        module: 'cp-analysis',
        code: 'STALE_CP_ANALYSIS',
        message: 'Capaian Pembelajaran diperbarui setelah Analisis CP dibuat. Tinjau kembali analisis CP.',
      });
    }

    // 3. TP (Tujuan Pembelajaran - Requires CP Analysis)
    const tpItems = tp?.items || [];
    const isTPDataValid = tpItems.length > 0 && tpItems.every((item) => item.statement?.trim().length > 0);
    const isTPStale =
      isAnalysisComplete &&
      (isUpstreamStale(cpAnalysis?.updatedAt, tp?.basedOnAnalysisUpdatedAt) ||
        isUpstreamStale(cp?.updatedAt, tp?.basedOnCpUpdatedAt));

    const isTPBlocked = !isAnalysisComplete;

    stepStates.tp = {
      id: 'tp',
      status: isTPBlocked
        ? 'BLOCKED'
        : isTPStale
        ? 'STALE'
        : isTPDataValid
        ? 'COMPLETE'
        : tpItems.length > 0
        ? 'IN_PROGRESS'
        : 'READY',
      isBlocked: isTPBlocked,
      isComplete: isTPDataValid && !isTPBlocked,
      isStale: isTPStale,
      reason: !isAnalysisComplete
        ? 'Memerlukan Analisis CP terlebih dahulu sebagai rujukan resmi TP'
        : isTPStale
        ? 'Analisis CP telah diperbarui, daftar TP perlu diselaraskan'
        : undefined,
      missingDependencies: !isAnalysisComplete ? ['Analisis CP'] : undefined,
    };

    if (tpItems.length > 0 && !isAnalysisComplete) {
      issues.push({
        severity: 'WARNING',
        module: 'tp',
        code: 'TP_WITHOUT_ANALYSIS',
        message: 'Tujuan Pembelajaran dirumuskan tanpa rujukan Analisis CP yang lengkap.',
      });
    }

    if (isTPStale) {
      issues.push({
        severity: 'INFO',
        module: 'tp',
        code: 'STALE_TP',
        message: 'Analisis CP telah diperbarui. Periksa dan selaraskan rumusan TP.',
      });
    }

    // 4. ATP (Alur Tujuan Pembelajaran - Requires TP and references canonical tpId)
    const atpItems = atp?.items || [];
    const validTpIds = new Set(tpItems.map((t) => t.id));
    const isATPBlocked = !isTPDataValid;

    // Check ATP sequence and orphan tpIds
    let hasOrphanATPItem = false;
    let hasDuplicateATPSequence = false;
    const seenSequences = new Set<number>();

    atpItems.forEach((atpItem) => {
      // An ATP item MUST have a valid tpId pointing to canonical TP
      if (!atpItem.tpId || !validTpIds.has(atpItem.tpId)) {
        hasOrphanATPItem = true;
        issues.push({
          severity: 'ERROR',
          module: 'atp',
          code: 'ORPHAN_ATP_TP_ID',
          message: `Item ATP '${atpItem.id}' tidak terhubung ke TP canonical (tpId: '${atpItem.tpId || 'kosong'}').`,
          targetId: atpItem.id,
        });
      }

      const seq = atpItem.stepNumber || atpItem.sequence;
      if (seq) {
        if (seenSequences.has(seq)) {
          hasDuplicateATPSequence = true;
          issues.push({
            severity: 'WARNING',
            module: 'atp',
            code: 'DUPLICATE_ATP_SEQUENCE',
            message: `Duplikasi nomor urut ATP ${seq} terdeteksi.`,
            targetId: atpItem.id,
          });
        }
        seenSequences.add(seq);
      }
    });

    const isATPComplete = isTPDataValid && atpItems.length > 0 && !hasOrphanATPItem;
    const isATPStale = isTPDataValid && isUpstreamStale(tp?.updatedAt, atp?.basedOnTpUpdatedAt);

    stepStates.atp = {
      id: 'atp',
      status: isATPBlocked
        ? 'BLOCKED'
        : isATPStale
        ? 'STALE'
        : isATPComplete
        ? 'COMPLETE'
        : atpItems.length > 0
        ? 'IN_PROGRESS'
        : 'READY',
      isBlocked: isATPBlocked,
      isComplete: isATPComplete,
      isStale: isATPStale,
      reason: isATPBlocked
        ? 'Memerlukan daftar Tujuan Pembelajaran (TP) terlebih dahulu'
        : isATPStale
        ? 'Daftar TP telah diperbarui, alur ATP perlu ditinjau'
        : undefined,
      missingDependencies: isATPBlocked ? ['Tujuan Pembelajaran (TP)'] : undefined,
    };

    if (isATPStale) {
      issues.push({
        severity: 'INFO',
        module: 'atp',
        code: 'STALE_ATP',
        message: 'Tujuan Pembelajaran diperbarui setelah penyusunan ATP. Alur ATP mungkin memerlukan penyesuaian.',
      });
    }

    // 5. KKTP Validation (Standalone branch from TP -> KKTP)
    let hasOrphanCriterion = false;
    let isKKTPStale = false;

    criteria.forEach((crit) => {
      const ref = resolveCriterionTPReference(crit, tp?.items || [], k13Analysis);
      if (ref.status === 'DANGLING_REFERENCE' || ref.status === 'UNRESOLVED_REFERENCE') {
        hasOrphanCriterion = true;
        issues.push({
          severity: 'ERROR',
          module: 'KKTP',
          code: 'ORPHAN_CRITERIA_TP_ID',
          message: ref.issue || `Kriteria KKTP '${crit.id}' merujuk ke tpId '${crit.tpId || 'kosong'}' yang tidak ditemukan dalam daftar TP canonical.`,
          targetId: crit.id,
        });
      } else if (ref.status === 'AMBIGUOUS_REFERENCE') {
        hasOrphanCriterion = true;
        issues.push({
          severity: 'ERROR',
          module: 'KKTP',
          code: 'AMBIGUOUS_CRITERIA_REFERENCE',
          message: ref.issue || `Kriteria KKTP '${crit.id}' memiliki referensi TP yang ambigu.`,
          targetId: crit.id,
        });
      }

      if (isTPDataValid && (crit.needsReview || isUpstreamStale(tp?.updatedAt, crit.basedOnTpUpdatedAt))) {
        isKKTPStale = true;
      }

      if (crit.approach === 'legacy_kkm' && !isK13Active) {
        issues.push({
          severity: 'WARNING',
          module: 'KKTP',
          code: 'LEGACY_KKM_IN_MERDEKA',
          message: 'Pendekatan Legacy KKM tidak direkomendasikan sebagai kriteria utama Kurikulum Merdeka.',
          targetId: crit.id,
        });
      }
    });

    if (isKKTPStale) {
      issues.push({
        severity: 'INFO',
        module: 'KKTP',
        code: 'STALE_KKTP',
        message: 'Tujuan Pembelajaran diperbarui setelah KKTP dirumuskan. Tinjau kembali kriteria ketercapaian.',
      });
    }

    const kktpDataVal = validateKKTPData(criteria, tp, academicSetting, k13Analysis);
    const isKKTPBlocked = !isTPDataValid;
    const isKKTPComplete =
      isTPDataValid &&
      criteria.length > 0 &&
      !hasOrphanCriterion &&
      !isKKTPStale &&
      kktpDataVal.isSiap;

    kktpState = {
      status: isKKTPBlocked
        ? 'BLOCKED'
        : isKKTPStale
        ? 'STALE'
        : isKKTPComplete
        ? 'COMPLETE'
        : criteria.length > 0
        ? 'IN_PROGRESS'
        : 'READY',
      isBlocked: isKKTPBlocked,
      isComplete: isKKTPComplete,
      isStale: isKKTPStale,
      hasOrphans: hasOrphanCriterion,
    };

    // 6. Administrasi Hub Overall Gating
    stepStates.admin = {
      id: 'admin',
      status: isATPComplete ? 'COMPLETE' : isTPDataValid ? 'IN_PROGRESS' : 'BLOCKED',
      isBlocked: !isTPDataValid,
      isComplete: isATPComplete,
      isStale: isATPStale || isTPStale || isKKTPStale,
      reason: !isTPDataValid ? 'Memerlukan TP dan Alur ATP untuk modul administrasi lengkap' : undefined,
    };
  } else {
    // Unresolved / unknown curriculum: all downstream branches stay BLOCKED!
    stepStates.cp.isBlocked = true;
    stepStates.cp.status = 'BLOCKED';
    stepStates['cp-analysis'].isBlocked = true;
    stepStates['cp-analysis'].status = 'BLOCKED';
    stepStates.tp.isBlocked = true;
    stepStates.tp.status = 'BLOCKED';
    stepStates.atp.isBlocked = true;
    stepStates.atp.status = 'BLOCKED';
    stepStates['k13-kd'].isBlocked = true;
    stepStates['k13-kd'].status = 'BLOCKED';
    stepStates['k13-indikator'].isBlocked = true;
    stepStates['k13-indikator'].status = 'BLOCKED';
    stepStates['k13-tujuan'].isBlocked = true;
    stepStates['k13-tujuan'].status = 'BLOCKED';
    stepStates['k13-kkm'].isBlocked = true;
    stepStates['k13-kkm'].status = 'BLOCKED';
    stepStates.admin.isBlocked = true;
    stepStates.admin.status = 'BLOCKED';
    issues.push({
      severity: 'ERROR',
      module: 'academic',
      code: 'CURRICULUM_UNRESOLVED',
      message: 'Kurikulum belum ditentukan atau tidak dikenali.',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'ERROR');
  const hasStaleModules = Object.values(stepStates).some((s) => s.isStale) || kktpState.isStale;

  return {
    isValid: !hasErrors,
    hasErrors,
    hasStaleModules,
    issues,
    stepStates,
    kktpState,
  };
}

/**
 * Resolves canonical display fields for an ATPItem from canonical TP list.
 * If the ATP item has a valid tpId, canonical statement, code, materialScope, and competence are resolved.
 * If tpId is missing or not found in canonical TP list, isOrphan is strictly marked as true.
 */
export function resolveATPItemWithTP(
  item: ATPItem,
  tpList: TPItem[]
): {
  item: ATPItem;
  canonicalTP: TPItem | null;
  displayCode: string;
  displayStatement: string;
  displayMaterialScope: string;
  isOrphan: boolean;
} {
  const canonicalTP = item.tpId ? tpList.find((t) => t.id === item.tpId) || null : null;

  if (canonicalTP) {
    return {
      item,
      canonicalTP,
      displayCode: canonicalTP.code || item.tpCode || `TP ${item.stepNumber || 1}`,
      displayStatement: canonicalTP.statement,
      displayMaterialScope: canonicalTP.contentScope || item.materialScope || '-',
      isOrphan: false,
    };
  }

  // If item has no tpId or tpId is not in canonical tpList -> ORPHAN
  return {
    item,
    canonicalTP: null,
    displayCode: item.tpCode || `TP ${item.stepNumber || 1}`,
    displayStatement: item.tpStatement || '(Tujuan Pembelajaran tidak ditemukan dalam daftar TP)',
    displayMaterialScope: item.materialScope || '-',
    isOrphan: true,
  };
}

/**
 * Resolves canonical TP or KD for an AssessmentCriterion.
 * If criterion has no tpId or target is not found in canonical TP/KD list, isOrphan is strictly true.
 */
/**
 * Matches an ATP item or input to a canonical TP item in the TP list according to PATCH B.2 rules:
 * 1. Exact tpId match
 * 2. Exact unique tpCode match (only if matches.length === 1)
 * 3. Exact unique statement match (only if matches.length === 1)
 * 4. Otherwise -> null (UNRESOLVED / ORPHAN; ambiguous matches are NOT chosen)
 * Strictly NO positional matching (no index-based fallback).
 * Strictly NO first-item fallback.
 */
export function matchCanonicalTP(
  item: { tpId?: string; tpCode?: string; tpStatement?: string },
  tpList: TPItem[]
): TPItem | null {
  if (!tpList || tpList.length === 0) return null;

  // 1. Exact tpId match
  if (item.tpId && item.tpId.trim()) {
    const matched = tpList.find((t) => t.id === item.tpId?.trim());
    if (matched) return matched;
  }

  // 2. Exact unique tpCode match
  if (item.tpCode && item.tpCode.trim()) {
    const trimmedCode = item.tpCode.trim();
    const codeCandidates = tpList.filter((t) => t.code && t.code.trim() === trimmedCode);
    if (codeCandidates.length === 1) {
      return codeCandidates[0];
    }
    if (codeCandidates.length > 1) {
      return null; // Ambiguous: do NOT pick first match
    }
  }

  // 3. Exact unique statement match
  if (item.tpStatement && item.tpStatement.trim()) {
    const trimmedStatement = item.tpStatement.trim();
    const statementCandidates = tpList.filter((t) => t.statement && t.statement.trim() === trimmedStatement);
    if (statementCandidates.length === 1) {
      return statementCandidates[0];
    }
    if (statementCandidates.length > 1) {
      return null; // Ambiguous: do NOT pick first match
    }
  }

  return null;
}

export function resolveCriterionTarget(
  criterion: AssessmentCriterion,
  tpList: TPItem[],
  k13Analysis?: K13Analysis
): {
  targetId: string;
  targetCode: string;
  targetStatement: string;
  isOrphan: boolean;
} {
  const ref = resolveCriterionTPReference(criterion, tpList, k13Analysis);

  if (ref.status === 'RESOLVED_REFERENCE' || ref.status === 'LEGACY_MIGRATED') {
    if (ref.canonicalTPItem) {
      return {
        targetId: ref.canonicalTPItem.id,
        targetCode: ref.canonicalTPItem.code || '',
        targetStatement: ref.canonicalTPItem.statement,
        isOrphan: false,
      };
    }
    if (k13Analysis?.items && ref.tpId) {
      const matchedKD = k13Analysis.items.find((k) => k.id === ref.tpId);
      if (matchedKD) {
        return {
          targetId: matchedKD.id,
          targetCode: 'KD',
          targetStatement: matchedKD.kd,
          isOrphan: false,
        };
      }
    }
  }

  return {
    targetId: criterion.tpId || '',
    targetCode: 'UNKNOWN',
    targetStatement: criterion.description || '(Target TP/KD tidak ditemukan dalam daftar canonical)',
    isOrphan: true,
  };
}

