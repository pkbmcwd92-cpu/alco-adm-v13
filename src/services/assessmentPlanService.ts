import {
  AssessmentPlan,
  AssessmentPurpose,
  AssessmentTiming,
  AssessmentScopeType,
  AssessmentInstrumentRef,
  AssessmentInstrumentType,
  AssessmentCriterion,
  TPData,
  TPItem,
  ATPData,
  K13Analysis,
  LearningPlan,
  Assessment,
  AcademicSetting,
} from '../types';
import { isK13, isMerdeka } from './curriculumRouter';

export interface AssessmentPlanValidationContext {
  academicSetting?: AcademicSetting;
  tp?: TPData;
  k13Analysis?: K13Analysis;
  assessmentCriteria?: AssessmentCriterion[];
  learningPlans?: LearningPlan[];
}

export interface AssessmentPlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Service Layer untuk Canonical Assessment Plan (Audit 9A).
 * Mengelola lifecycle, validasi, dan penanganan dependensi perangkat asesmen.
 */

export function createEmptyAssessmentPlan(params: {
  academicSettingId: string;
  workspaceId?: string;
  title?: string;
  purpose?: AssessmentPurpose;
  timing?: AssessmentTiming;
  scopeType?: AssessmentScopeType;
  tpIds?: string[];
  criterionIds?: string[];
  instruments?: AssessmentInstrumentRef[];
  displayLabel?: string;
  customTimingLabel?: string;
  customScopeLabel?: string;
}): AssessmentPlan {
  const now = new Date().toISOString();
  return {
    id: `asp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    academicSettingId: params.academicSettingId,
    workspaceId: params.workspaceId,
    title: params.title || '',
    purpose: params.purpose || 'FORMATIVE',
    timing: params.timing || 'POST',
    scopeType: params.scopeType || 'TP',
    tpIds: params.tpIds || [],
    criterionIds: params.criterionIds || [],
    instruments: params.instruments || [],
    displayLabel: params.displayLabel,
    customTimingLabel: params.customTimingLabel,
    customScopeLabel: params.customScopeLabel,
    workflowStatus: 'DRAFT',
    needsReview: false,
    revision: 1,
    provenance: {
      generatedBy: 'USER',
      engine: 'MANUAL',
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createAIDraftAssessmentPlan(params: {
  academicSettingId: string;
  workspaceId?: string;
  title: string;
  purpose: AssessmentPurpose;
  timing: AssessmentTiming;
  scopeType: AssessmentScopeType;
  tpIds?: string[];
  criterionIds?: string[];
  instruments?: AssessmentInstrumentRef[];
  displayLabel?: string;
}): AssessmentPlan {
  const base = createEmptyAssessmentPlan({
    ...params,
  });
  return {
    ...base,
    workflowStatus: 'DRAFT',
    needsReview: true,
    reviewReason: 'Draf asesmen dihasilkan oleh AI. Harap diperiksa dan disesuaikan oleh guru sebelum dikonfirmasi SIAP.',
    provenance: {
      generatedBy: 'AI',
      engine: 'GEMINI_STUDIO',
    },
  };
}

export function validateAssessmentPlan(
  plan: AssessmentPlan,
  context: AssessmentPlanValidationContext
): AssessmentPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Identity & Setting
  if (!plan.academicSettingId) {
    errors.push('Rencana Asesmen belum terhubung ke Setting Akademik.');
  }

  if (!plan.title || !plan.title.trim()) {
    errors.push('Judul Perangkat Asesmen wajib diisi.');
  }

  // 2. Scope constraints
  if (plan.scopeType === 'TP') {
    if (plan.tpIds.length === 0) {
      errors.push('Asesmen dengan cakupan "TP" wajib memilih tepat 1 Tujuan Pembelajaran.');
    } else if (plan.tpIds.length > 1) {
      errors.push('Asesmen lingkup TP tunggal tidak boleh mereferensikan lebih dari 1 TP. Gunakan jenis cakupan "MULTI_TP".');
    }
  } else if (plan.scopeType === 'MULTI_TP') {
    if (plan.tpIds.length < 2) {
      errors.push('Asesmen dengan cakupan "MULTI_TP" harus memilih minimal 2 Tujuan Pembelajaran.');
    }
  }

  // Canonical Objective Source Verification
  const hasSetting = !!context.academicSetting;
  const currStr = context.academicSetting?.curriculum || '';
  const currType = context.academicSetting?.curriculumType;
  const isCurrUnresolved = !hasSetting || (!currStr && !currType);

  if (isCurrUnresolved) {
    if (plan.scopeType === 'TP' || plan.scopeType === 'MULTI_TP' || plan.tpIds.length > 0) {
      errors.push('Konteks kurikulum tidak teridentifikasi sehingga referensi asesmen tidak dapat diverifikasi.');
    }
  } else if (isMerdeka(context.academicSetting)) {
    if (plan.scopeType === 'TP' || plan.scopeType === 'MULTI_TP' || plan.tpIds.length > 0) {
      if (!context.tp?.items || context.tp.items.length === 0) {
        errors.push('Sumber TP canonical Kurikulum Merdeka tidak tersedia sehingga referensi asesmen tidak dapat diverifikasi.');
      } else if (context.tp.workflowStatus !== 'SIAP' || context.tp.needsReview) {
        errors.push('Sumber TP canonical belum SIAP atau masih memerlukan peninjauan ulang.');
      } else {
        const validTpIds = new Set(context.tp.items.map((t) => t.id));
        const invalidTpIds = plan.tpIds.filter((id) => !validTpIds.has(id));
        if (invalidTpIds.length > 0) {
          errors.push(`Terdapat ${invalidTpIds.length} referensi Tujuan Pembelajaran (TP) yang tidak valid atau telah dihapus dari alur hulu.`);
        }
      }
    }
  } else if (isK13(context.academicSetting)) {
    if (plan.scopeType === 'TP' || plan.scopeType === 'MULTI_TP' || plan.tpIds.length > 0) {
      if (!context.k13Analysis?.items || context.k13Analysis.items.length === 0) {
        errors.push('Sumber KD canonical Kurikulum 2013 tidak tersedia sehingga referensi asesmen tidak dapat diverifikasi.');
      } else {
        const validKdIds = new Set(context.k13Analysis.items.map((k) => k.id));
        const invalidKdIds = plan.tpIds.filter((id) => !validKdIds.has(id));
        if (invalidKdIds.length > 0) {
          errors.push(`Terdapat ${invalidKdIds.length} referensi Kompetensi Dasar (KD) yang tidak valid atau telah dihapus dari alur hulu.`);
        }
      }
    }
  }

  // 3. Custom Labels Check
  if (plan.timing === 'CUSTOM' && (!plan.customTimingLabel || !plan.customTimingLabel.trim())) {
    errors.push('Waktu Pelaksanaan kustom (CUSTOM) wajib melengkapi teks label waktu.');
  }

  if (plan.scopeType === 'CUSTOM' && (!plan.customScopeLabel || !plan.customScopeLabel.trim())) {
    errors.push('Cakupan Asesmen kustom (CUSTOM) wajib melengkapi teks label cakupan.');
  }

  // 4. Instrument Requirements
  if (!plan.instruments || plan.instruments.length === 0) {
    errors.push('Minimal 1 Bentuk / Instrumen Asesmen harus dipilih untuk menyelesaikan perencanaan.');
  }

  // 5. KKTP Criteria References Check
  if (plan.criterionIds && plan.criterionIds.length > 0 && !context.assessmentCriteria) {
    errors.push('Rencana Asesmen merujuk KKTP tetapi sumber kriteria tidak tersedia.');
  } else if (plan.criterionIds && plan.criterionIds.length > 0 && context.assessmentCriteria) {
    const criteriaById = new Map(context.assessmentCriteria.map((c) => [c.id, c]));
    const invalidCriteria = plan.criterionIds.filter((cid) => !criteriaById.has(cid));
    if (invalidCriteria.length > 0) {
      errors.push(`Terdapat ${invalidCriteria.length} referensi Kriteria Capaian (KKTP) yang tidak ditemukan pada alur hulu.`);
    }
    const staleCriteria = plan.criterionIds.filter((cid) => {
      const criterion = criteriaById.get(cid);
      return criterion && (criterion.workflowStatus !== 'SIAP' || criterion.needsReview);
    });
    if (staleCriteria.length > 0) {
      errors.push(`Terdapat ${staleCriteria.length} referensi Kriteria Capaian (KKTP) yang belum SIAP atau perlu ditinjau ulang.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function confirmAssessmentPlan(
  plan: AssessmentPlan,
  context: AssessmentPlanValidationContext
): { success: boolean; plan: AssessmentPlan; errors: string[] } {
  const validation = validateAssessmentPlan(plan, context);
  if (!validation.valid) {
    return {
      success: false,
      plan,
      errors: validation.errors,
    };
  }

  const now = new Date().toISOString();
  return {
    success: true,
    plan: {
      ...plan,
      workflowStatus: 'SIAP',
      needsReview: false,
      reviewReason: undefined,
      revision: (plan.revision || 1) + 1,
      provenance: {
        ...(plan.provenance || { generatedBy: 'USER' }),
        generatedBy: 'USER',
        engine: 'TEACHER_CONFIRMED',
      },
      confirmedAt: now,
      updatedAt: now,
    },
    errors: [],
  };
}

export function invalidateAssessmentPlanDependencies(
  plan: AssessmentPlan,
  context: AssessmentPlanValidationContext
): { isInvalidated: boolean; plan: AssessmentPlan } {
  if (plan.workflowStatus !== 'SIAP') {
    return { isInvalidated: false, plan };
  }

  const validation = validateAssessmentPlan(plan, context);
  if (!validation.valid) {
    return {
      isInvalidated: true,
      plan: {
        ...plan,
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: `Dependensi hulu mengalami perubahan atau penghapusan: ${validation.errors.join('; ')}`,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  return { isInvalidated: false, plan };
}

export function migrateLegacyAssessment(
  legacy: Assessment,
  context: AssessmentPlanValidationContext,
  existingPlans: AssessmentPlan[] = []
): AssessmentPlan {
  const migrationId = `asp-migrated-${legacy.id}`;

  // Check if already migrated
  const found = existingPlans.find((p) => p.id === migrationId || p.id === legacy.id);
  if (found) {
    return found;
  }

  const now = new Date().toISOString();
  const purpose: AssessmentPurpose = legacy.type === 'formatif' ? 'FORMATIVE' : 'SUMMATIVE';
  const timing: AssessmentTiming =
    legacy.type === 'formatif'
      ? 'DURING'
      : legacy.type === 'sumatif_akhir_semester'
      ? 'END_SEMESTER'
      : 'POST';
  const scopeType: AssessmentScopeType = legacy.type === 'sumatif_akhir_semester' ? 'SEMESTER' : 'TP';

  const tpIds = legacy.tpId ? [legacy.tpId] : [];

  const rawPlan: AssessmentPlan = {
    id: migrationId,
    academicSettingId: legacy.academicSettingId,
    title: legacy.title || 'Asesmen Migrasi',
    purpose,
    timing,
    scopeType,
    tpIds,
    criterionIds: [],
    instruments: [], // BLOCKER 1: NO FAKE INSTRUMENT!
    displayLabel: legacy.title,
    workflowStatus: 'PERLU_DILENGKAPI',
    needsReview: true,
    reviewReason: 'Hasil migrasi dari perangkat asesmen legacy. Harap tentukan instrumen dan konfirmasi.',
    revision: 1,
    provenance: {
      generatedBy: 'SYSTEM',
      engine: 'LEGACY_MIGRATION',
    },
    createdAt: legacy.createdAt || now,
    updatedAt: now,
  };

  const validation = validateAssessmentPlan(rawPlan, context);
  if (validation.valid) {
    return {
      ...rawPlan,
      workflowStatus: 'SIAP',
      needsReview: false,
      reviewReason: undefined,
      confirmedAt: now,
    };
  } else {
    return {
      ...rawPlan,
      workflowStatus: 'PERLU_DILENGKAPI',
      needsReview: true,
      reviewReason: validation.errors.join('; ') || 'Data migrasi legacy belum lengkap.',
    };
  }
}

/**
 * Mendapatkan label tampilan instrumen asesmen terstandar.
 */
export function getInstrumentLabel(type: AssessmentInstrumentType): string {
  switch (type) {
    case 'WRITTEN_TEST':
      return 'Tes Tertulis';
    case 'ORAL_TEST':
      return 'Tes Lisan';
    case 'PERFORMANCE':
      return 'Tes Kinerja / Praktik';
    case 'OBSERVATION':
      return 'Lembar Observasi';
    case 'ASSIGNMENT':
      return 'Penugasan';
    case 'PROJECT':
      return 'Tugas Proyek';
    case 'PRODUCT':
      return 'Penilaian Produk';
    case 'PORTFOLIO':
      return 'Dokumen Portofolio';
    case 'SELF_ASSESSMENT':
      return 'Penilaian Diri';
    case 'PEER_ASSESSMENT':
      return 'Penilaian Antarteman';
    default:
      return type;
  }
}

/**
 * Rekomendasi instrumen asesmen berdasarkan karakteristik kompetensi (Audit 9A/Recovery B).
 * Rule-based & deterministik, tanpa memaksakan semua TP menjadi WRITTEN_TEST.
 * Membedakan kompetensi motorik/keterampilan fisik (PERFORMANCE, OBSERVATION)
 * dari kompetensi kognitif/konseptual (WRITTEN_TEST, ORAL_TEST),
 * dan produk/projek (PRODUCT, PROJECT, ASSIGNMENT).
 * TIDAK MENG-HARDCODE "PJOK = PERFORMANCE" semata-mata dari nama mata pelajaran.
 */
export function recommendInstrumentsForCompetency(params: {
  competence?: string;
  statement?: string;
  contentScope?: string;
  subject?: string;
}): AssessmentInstrumentRef[] {
  const comp = (params.competence || '').toLowerCase();
  const stmt = (params.statement || '').toLowerCase();
  const scope = (params.contentScope || '').toLowerCase();
  const fullText = `${comp} ${stmt} ${scope}`.trim();

  // 1. Indikator Psikomotorik / Kinerja Fisik / Unjuk Kerja / Keterampilan Praktik
  const psychomotorKeywords = [
    'mempraktikkan', 'melakukan', 'memeragakan', 'bermain', 'senam', 'lari',
    'melempar', 'menendang', 'menangkap', 'melompat', 'gerak dasar', 'lokomotor',
    'nonlokomotor', 'manipulatif', 'keterampilan gerak', 'kebugaran', 'renang',
    'atletik', 'senam lantai', 'unjuk kerja', 'simulasi', 'demonstrasi', 'mendemonstrasikan',
    'memainkan alat', 'berpidato', 'membaca puisi', 'menyanyikan', 'menari',
    'pola gerak', 'aktivitas jasmani', 'mengoperasikan', 'merangkai alat', 'percobaan',
    'mempresentasikan', 'presentasi'
  ];

  // 2. Indikator Kognitif / Konseptual
  const cognitiveKeywords = [
    'menjelaskan', 'mengidentifikasi', 'menganalisis', 'memahami', 'menyebutkan',
    'membedakan', 'menguraikan', 'menghitung', 'menentukan', 'merumuskan',
    'menyimpulkan', 'menafsirkan', 'mengklasifikasikan', 'mengevaluasi konsep',
    'konsep', 'teori', 'prinsip', 'aturan', 'prosedur', 'menelaah', 'mengkaji'
  ];

  // 3. Indikator Produk / Projek / Karya
  const productKeywords = [
    'membuat karya', 'menciptakan karya', 'menggambar karya', 'menulis laporan',
    'merancang produk', 'membuat produk', 'karya seni', 'projek', 'poster',
    'laporan hasil', 'produk kerajinan', 'makalah', 'proyek', 'membuat video',
    'menyusun laporan'
  ];

  const hasPsychomotor = psychomotorKeywords.some((kw) => fullText.includes(kw));
  const hasCognitive = cognitiveKeywords.some((kw) => fullText.includes(kw));
  const hasProduct = productKeywords.some((kw) => fullText.includes(kw));

  const recommendedTypes: AssessmentInstrumentType[] = [];

  if (hasPsychomotor && hasCognitive) {
    // Campuran motorik & kognitif -> multi-instrumen
    recommendedTypes.push('PERFORMANCE', 'WRITTEN_TEST');
  } else if (hasPsychomotor && hasProduct) {
    recommendedTypes.push('PERFORMANCE', 'PRODUCT');
  } else if (hasCognitive && hasProduct) {
    recommendedTypes.push('PRODUCT', 'ASSIGNMENT');
  } else if (hasPsychomotor) {
    // Psikomotor murni / kinerja gerak -> PERFORMANCE & OBSERVATION
    recommendedTypes.push('PERFORMANCE', 'OBSERVATION');
  } else if (hasProduct) {
    // Produk / proyek
    recommendedTypes.push('PRODUCT', 'ASSIGNMENT');
  } else if (hasCognitive) {
    // Kognitif murni -> WRITTEN_TEST
    recommendedTypes.push('WRITTEN_TEST');
  } else {
    // Karakter kompetensi tidak dapat ditentukan secara otomatis -> return [] (unresolved)
    // Unknown competency MUST NOT default to WRITTEN_TEST.
    // Guru wajib memilih instrumen asesmen secara manual sebelum status dapat menjadi SIAP.
    return [];
  }

  const now = Date.now();
  return recommendedTypes.map((type, idx) => ({
    id: `inst-${type.toLowerCase()}-${now}-${idx}`,
    type,
    label: getInstrumentLabel(type),
  }));
}

export interface TargetTPSelectionResult {
  status: 'RESOLVED' | 'AMBIGUOUS' | 'NO_TP';
  selectedTpId?: string;
  selectedTpIds: string[];
  candidateIds?: string[];
  reason?: string;
}

/**
 * Resolusi seleksi TP target asesmen yang aman tanpa first-match fallback (Audit 9A/Recovery B).
 * 0 MATCH = FAIL / NO_TP
 * 1 MATCH = OK / RESOLVED
 * >1 MATCH = AMBIGUOUS / REQUIRE USER SELECTION
 */
export function resolveTargetTPSelection(
  tpsOrParams:
    | { id: string; code?: string; statement?: string }[]
    | {
        academicSetting?: AcademicSetting;
        tp?: TPData | null;
        k13Analysis?: K13Analysis | null;
        tps?: { id: string; code?: string; statement?: string }[];
        targetTpId?: string;
        explicitTpId?: string;
        learningPlans?: LearningPlan[];
        atp?: ATPData;
      },
  context?: {
    explicitTpId?: string;
    targetTpId?: string;
    learningPlans?: LearningPlan[];
    atp?: ATPData;
  }
): TargetTPSelectionResult {
  let tps: { id: string; code?: string; statement?: string }[] = [];
  let explicitId: string | undefined = context?.explicitTpId || context?.targetTpId;
  let learningPlans: LearningPlan[] | undefined = context?.learningPlans;

  if (Array.isArray(tpsOrParams)) {
    tps = tpsOrParams;
  } else if (tpsOrParams && typeof tpsOrParams === 'object') {
    explicitId = explicitId || tpsOrParams.targetTpId || tpsOrParams.explicitTpId;
    learningPlans = learningPlans || tpsOrParams.learningPlans;
    if (tpsOrParams.tps) {
      tps = tpsOrParams.tps;
    } else if (tpsOrParams.tp?.items) {
      tps = tpsOrParams.tp.items;
    } else if (tpsOrParams.k13Analysis?.items) {
      tps = tpsOrParams.k13Analysis.items.map((k) => ({
        id: k.id,
        code: k.kd,
        statement: k.tujuanPembelajaran || k.materi || k.indikator || k.kd || k.id,
      }));
    }
  }

  if (!tps || tps.length === 0) {
    return {
      status: 'NO_TP',
      selectedTpId: undefined,
      selectedTpIds: [],
      candidateIds: [],
      reason: 'Tidak ada Tujuan Pembelajaran kanonikal yang tersedia.',
    };
  }

  // 1. Explicit ID if provided
  if (explicitId) {
    const found = tps.find((t) => t.id === explicitId);
    if (found) {
      return {
        status: 'RESOLVED',
        selectedTpId: found.id,
        selectedTpIds: [found.id],
        candidateIds: tps.map((t) => t.id),
      };
    }
  }

  // 2. Unambiguous single TP in LearningPlan context
  if (learningPlans && learningPlans.length === 1) {
    const lp = learningPlans[0];
    if (lp.tpIds && lp.tpIds.length === 1) {
      const found = tps.find((t) => t.id === lp.tpIds[0]);
      if (found) {
        return {
          status: 'RESOLVED',
          selectedTpId: found.id,
          selectedTpIds: [found.id],
          candidateIds: tps.map((t) => t.id),
        };
      }
    }
  }

  // 3. Exactly 1 TP in total -> OK
  if (tps.length === 1) {
    return {
      status: 'RESOLVED',
      selectedTpId: tps[0].id,
      selectedTpIds: [tps[0].id],
      candidateIds: [tps[0].id],
    };
  }

  // 4. >1 TP without explicit/unambiguous context -> AMBIGUOUS (no guessing!)
  return {
    status: 'AMBIGUOUS',
    selectedTpId: undefined,
    selectedTpIds: [],
    candidateIds: tps.map((t) => t.id),
    reason: `Terdapat ${tps.length} Tujuan Pembelajaran. Harap pilih Tujuan Pembelajaran yang menjadi fokus asesmen.`,
  };
}

export interface DeriveAutoDraftAssessmentPlanParams {
  academicSetting: AcademicSetting;
  workspaceId?: string;
  tp?: TPData | null;
  k13Analysis?: K13Analysis | null;
  assessmentCriteria?: AssessmentCriterion[] | null;
  learningPlans?: LearningPlan[] | null;
  atp?: ATPData | null;
  targetObjectiveId?: string;
  targetTpId?: string;
  purpose?: AssessmentPurpose;
  timing?: AssessmentTiming;
  title?: string;
}

export interface DeriveAutoDraftAssessmentPlanResult {
  plan: AssessmentPlan;
  status: 'DRAFT_READY' | 'DRAFT_NEEDS_SELECTION' | 'CANNOT_DRAFT';
  resolutionStatus: 'EXACT' | 'AMBIGUOUS' | 'NO_TP';
  hasCriteria: boolean;
  warnings: string[];
  recommendations: {
    instruments: AssessmentInstrumentRef[];
    suggestedPurpose: AssessmentPurpose;
    suggestedTiming: AssessmentTiming;
  };
}

/**
 * Menyusun draf rencana asesmen secara otomatis dari data kanonikal (AcademicSetting + TP/KD).
 * Tidak memerlukan kalender / alokasi waktu untuk menyusun DRAFT pedagogis.
 * Menghasilkan workflowStatus 'DRAFT' yang wajib ditinjau guru sebelum SIAP.
 */
export function deriveAutoDraftAssessmentPlan(
  params: DeriveAutoDraftAssessmentPlanParams
): DeriveAutoDraftAssessmentPlanResult {
  const warnings: string[] = [];
  const setting = params.academicSetting;
  const merdekaTpBlocked = isMerdeka(setting) &&
    (!params.tp || params.tp.workflowStatus !== 'SIAP' || params.tp.needsReview === true);

  if (merdekaTpBlocked) {
    const emptyDraft = createEmptyAssessmentPlan({
      academicSettingId: setting.id,
      workspaceId: params.workspaceId,
      title: params.title || 'Draf Rencana Asesmen',
    });
    return {
      plan: emptyDraft,
      status: 'CANNOT_DRAFT',
      resolutionStatus: 'NO_TP',
      hasCriteria: false,
      warnings: ['TP canonical Kurikulum Merdeka belum SIAP atau masih memerlukan review.'],
      recommendations: {
        instruments: [],
        suggestedPurpose: params.purpose || 'FORMATIVE',
        suggestedTiming: params.timing || 'POST',
      },
    };
  }

  // 1. Kumpulkan objectives kanonikal
  let objectives: { id: string; code: string; statement: string; competence?: string; contentScope?: string }[] = [];

  if (isMerdeka(setting) && params.tp?.items) {
    objectives = params.tp.items.map((item) => ({
      id: item.id,
      code: item.code,
      statement: item.statement || item.description || (item.competence ? `${item.competence} ${item.contentScope || ''}`.trim() : item.code),
      competence: item.competence,
      contentScope: item.contentScope,
    }));
  } else if (isK13(setting) && params.k13Analysis?.items) {
    objectives = params.k13Analysis.items.map((item) => ({
      id: item.id,
      code: item.kd || '',
      statement: item.tujuanPembelajaran || item.materi || item.indikator || item.kd || item.id,
      competence: item.indikator || item.materi || '',
      contentScope: item.materi || '',
    }));
  }

  if (objectives.length === 0) {
    const emptyDraft = createEmptyAssessmentPlan({
      academicSettingId: setting.id,
      workspaceId: params.workspaceId,
      title: params.title || 'Draf Rencana Asesmen',
    });
    return {
      plan: emptyDraft,
      status: 'CANNOT_DRAFT',
      resolutionStatus: 'NO_TP',
      hasCriteria: false,
      warnings: ['Data kanonikal Tujuan Pembelajaran (TP) atau KD belum tersedia pada alur hulu.'],
      recommendations: {
        instruments: [],
        suggestedPurpose: 'FORMATIVE',
        suggestedTiming: 'POST',
      },
    };
  }

  // 2. Resolusi target objective
  let resolvedObj: { id: string; code: string; statement: string; competence?: string; contentScope?: string } | undefined;

  const targetId = params.targetObjectiveId || params.targetTpId;
  if (targetId) {
    resolvedObj = objectives.find((obj) => obj.id === targetId);
  } else {
    const selection = resolveTargetTPSelection(objectives, {
      learningPlans: params.learningPlans || undefined,
      atp: params.atp || undefined,
    });
    if (selection.status === 'RESOLVED' && selection.selectedTpIds.length > 0) {
      resolvedObj = objectives.find((obj) => obj.id === selection.selectedTpIds[0]);
    }
  }

  // Rekomendasi purpose & timing
  const suggestedPurpose: AssessmentPurpose = params.purpose || 'FORMATIVE';
  const suggestedTiming: AssessmentTiming = params.timing || 'POST';

  if (!resolvedObj) {
    // Ambigu (>1 TP dan belum ada target eksplisit)
    const emptyDraft = createEmptyAssessmentPlan({
      academicSettingId: setting.id,
      workspaceId: params.workspaceId,
      title: params.title || 'Draf Rencana Asesmen',
      purpose: suggestedPurpose,
      timing: suggestedTiming,
      scopeType: 'TP',
      tpIds: [],
      criterionIds: [],
      instruments: [],
    });
    return {
      plan: {
        ...emptyDraft,
        needsReview: true,
        reviewReason: 'Terdapat lebih dari satu Tujuan Pembelajaran. Harap guru memilih TP target asesmen.',
      },
      status: 'DRAFT_NEEDS_SELECTION',
      resolutionStatus: 'AMBIGUOUS',
      hasCriteria: false,
      warnings: ['Terdapat lebih dari satu TP. Harap tentukan TP target asesmen secara eksplisit.'],
      recommendations: {
        instruments: [],
        suggestedPurpose,
        suggestedTiming,
      },
    };
  }

  // 3. Resolusi instrumen berdasarkan karakteristik kompetensi
  const recommendedInstruments = recommendInstrumentsForCompetency({
    competence: resolvedObj.competence,
    statement: resolvedObj.statement,
    contentScope: resolvedObj.contentScope,
    subject: setting.subject,
  });

  const hasUnresolvedInstruments = recommendedInstruments.length === 0;
  if (hasUnresolvedInstruments) {
    warnings.push('Instrumen asesmen perlu dipilih guru karena karakter kompetensi belum dapat ditentukan secara otomatis.');
  }

  // 4. Hubungkan kriteria KKTP kanonikal jika tersedia
  const matchingCriteria = (params.assessmentCriteria || []).filter((c) => c.tpId === resolvedObj!.id);
  const criterionIds = matchingCriteria.map((c) => c.id);

  if (matchingCriteria.length === 0) {
    warnings.push('Kriteria ketercapaian (KKTP) belum tersedia untuk TP ini.');
  }

  // 5. Susun judul otomatis
  const defaultTitle = params.title || (
    resolvedObj.code
      ? `Asesmen Formatif: [${resolvedObj.code}] ${resolvedObj.statement.slice(0, 50)}${resolvedObj.statement.length > 50 ? '...' : ''}`
      : `Asesmen Formatif: ${resolvedObj.statement.slice(0, 50)}...`
  );

  const reviewReason = hasUnresolvedInstruments
    ? 'Instrumen asesmen perlu dipilih guru karena karakter kompetensi belum dapat ditentukan secara otomatis.'
    : 'Draf rencana asesmen disusun otomatis dari data kanonikal. Harap guru meninjau dan mengonfirmasi menjadi SIAP.';

  const plan = createAIDraftAssessmentPlan({
    academicSettingId: setting.id,
    workspaceId: params.workspaceId,
    title: defaultTitle,
    purpose: suggestedPurpose,
    timing: suggestedTiming,
    scopeType: 'TP',
    tpIds: [resolvedObj.id],
    criterionIds,
    instruments: recommendedInstruments,
    displayLabel: resolvedObj.code ? `Asesmen ${resolvedObj.code}` : undefined,
  });

  return {
    plan: {
      ...plan,
      workflowStatus: 'DRAFT',
      needsReview: true,
      reviewReason,
      provenance: {
        generatedBy: 'SYSTEM',
        engine: 'AUTO_DRAFT',
      },
    },
    status: 'DRAFT_READY',
    resolutionStatus: 'EXACT',
    hasCriteria: matchingCriteria.length > 0,
    warnings,
    recommendations: {
      instruments: recommendedInstruments,
      suggestedPurpose,
      suggestedTiming,
    },
  };
}

/**
 * Menghasilkan kumpulan Draf Rencana Asesmen untuk seluruh TP/KD kanonikal yang belum memiliki rencana.
 * Digunakan untuk alur "AUTO GENERATE FIRST".
 */
export function generateAutoDraftPlansFromCanonicalContext(params: {
  academicSetting: AcademicSetting;
  workspaceId?: string;
  tp?: TPData | null;
  k13Analysis?: K13Analysis | null;
  assessmentCriteria?: AssessmentCriterion[] | null;
  learningPlans?: LearningPlan[] | null;
  atp?: ATPData | null;
  existingPlans?: AssessmentPlan[];
}): AssessmentPlan[] {
  const existing = params.existingPlans || [];
  const existingTpIds = new Set<string>();
  for (const p of existing) {
    (p.tpIds || []).forEach((id) => existingTpIds.add(id));
  }

  const newPlans: AssessmentPlan[] = [];

  if (isMerdeka(params.academicSetting) && (!params.tp || params.tp.workflowStatus !== 'SIAP' || params.tp.needsReview === true)) {
    return [];
  }

  if (isMerdeka(params.academicSetting) && params.tp?.items) {
    for (const item of params.tp.items) {
      if (existingTpIds.has(item.id)) continue;

      const derived = deriveAutoDraftAssessmentPlan({
        ...params,
        targetObjectiveId: item.id,
      });
      if (derived.status === 'DRAFT_READY') {
        newPlans.push(derived.plan);
      }
    }
  } else if (isK13(params.academicSetting) && params.k13Analysis?.items) {
    for (const item of params.k13Analysis.items) {
      if (existingTpIds.has(item.id)) continue;

      const derived = deriveAutoDraftAssessmentPlan({
        ...params,
        targetObjectiveId: item.id,
      });
      if (derived.status === 'DRAFT_READY') {
        newPlans.push(derived.plan);
      }
    }
  }

  return newPlans;
}

