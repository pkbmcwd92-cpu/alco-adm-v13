import {
  LearningPlan,
  LearningPlanStatus,
  LearningPlanSource,
  AcademicSetting,
  TPData,
  ATPData,
  K13Analysis,
  TimeAllocation,
  AssessmentCriterion,
  CurriculumType,
  TPItem,
  ATPItem,
  LearningExperience,
  LearningExperiencePhase,
  DeepLearningPrinciple,
  DeepLearningContext,
  LearningObjectiveReference,
  AssessmentPlanItem,
  LearningResource,
} from '../types';
import { validateATPReferences } from './cpWorkflowService';
import {
  CANONICAL_GRADUATE_PROFILE_DIMENSIONS,
  isCanonicalGraduateProfileDimension,
  validateGraduateProfileDimensions,
} from '../constants/graduateProfileDimensions';

export {
  CANONICAL_GRADUATE_PROFILE_DIMENSIONS,
  isCanonicalGraduateProfileDimension,
  validateGraduateProfileDimensions,
};

export const LEARNING_EXPERIENCE_PHASE_LABELS: Record<LearningExperiencePhase, string> = {
  UNDERSTAND: 'Memahami',
  APPLY: 'Mengaplikasi',
  REFLECT: 'Merefleksi',
};

export const DEEP_LEARNING_PRINCIPLE_LABELS: Record<DeepLearningPrinciple, string> = {
  MINDFUL: 'Berkesadaran',
  MEANINGFUL: 'Bermakna',
  JOYFUL: 'Menggembirakan',
};

export const GRADUATE_PROFILE_DIMENSIONS_LABEL = 'Dimensi Profil Lulusan';
export const LEARNING_EXPERIENCES_LABEL = 'Pengalaman Belajar';

export function normalizeLearningExperiencePhase(raw: unknown): LearningExperiencePhase | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s === 'UNDERSTAND' || s === 'MEMAHAMI') {
    return 'UNDERSTAND';
  }
  if (s === 'APPLY' || s === 'MENGAPLIKASI' || s === 'MENGAPLIKASIKAN') {
    return 'APPLY';
  }
  if (s === 'REFLECT' || s === 'MEREFLEKSI' || s === 'MEREFLEKSIKAN') {
    return 'REFLECT';
  }
  return null;
}

export function normalizeDeepLearningPrinciple(raw: unknown): DeepLearningPrinciple | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s === 'MINDFUL' || s === 'BERKESADARAN') return 'MINDFUL';
  if (s === 'MEANINGFUL' || s === 'BERMAKNA') return 'MEANINGFUL';
  if (s === 'JOYFUL' || s === 'MENGGEMBIRAKAN') return 'JOYFUL';
  return null;
}

export interface LearningPlanObjectiveResolution {
  objectives: LearningObjectiveReference[];
  danglingIds: string[];
}

export function resolveLearningPlanObjectives(params: {
  tpIds?: string[];
  tp?: TPData | null;
  k13Analysis?: K13Analysis | null;
  curriculumType?: CurriculumType;
}): LearningPlanObjectiveResolution {
  const objectives: LearningObjectiveReference[] = [];
  const danglingIds: string[] = [];
  const orderedIds = Array.isArray(params.tpIds) ? params.tpIds.filter(Boolean) : [];

  for (const id of orderedIds) {
    const tpItem = params.tp?.items?.find((item) => item.id === id);
    if (tpItem) {
      objectives.push({
        id: tpItem.id,
        tpId: tpItem.id,
        code: tpItem.code,
        statement: tpItem.statement || tpItem.description || '',
        materialScope: tpItem.contentScope,
      });
      continue;
    }

    if (params.curriculumType === 'K13') {
      const k13Item = params.k13Analysis?.items?.find((item) => item.id === id);
      if (k13Item) {
        objectives.push({
          id: k13Item.id,
          tpId: k13Item.id,
          code: k13Item.kd ? k13Item.kd.slice(0, 24) : 'KD',
          statement: k13Item.tujuanPembelajaran || k13Item.indikator || k13Item.kd || '',
          materialScope: k13Item.materi,
        });
        continue;
      }
    }

    danglingIds.push(id);
  }

  return { objectives, danglingIds };
}

export interface LearningPlanJPResolution {
  allocatedJP?: number;
  source: 'EXPLICIT_PLAN' | 'CANONICAL_ATP' | 'LINKED_TIME_ALLOCATION' | 'UNRESOLVED';
  timeAllocationIds?: string[];
  issues?: string[];
}

function isTimeAllocationRelatedToPlan(allocation: TimeAllocation, plan: LearningPlan): boolean {
  if (allocation.academicSettingId && allocation.academicSettingId !== plan.academicSettingId) return false;
  const planAtpIds = new Set(plan.atpItemIds || []);
  const planTpIds = new Set(plan.tpIds || []);
  const linkedByAtp = !!(
    (allocation.atpItemId && planAtpIds.has(allocation.atpItemId)) ||
    (allocation.sourceId && planAtpIds.has(allocation.sourceId))
  );
  const linkedByTp = !!(allocation.tpId && planTpIds.has(allocation.tpId));
  return linkedByAtp || linkedByTp;
}

/**
 * Resolves allocated JP strictly from real data hierarchy:
 * 1. explicit LearningPlan.allocatedJP
 * 2. canonical ATP allocatedJP / jp from linked atpItemIds
 * 3. linked TimeAllocation actual value
 * 4. UNRESOLVED (undefined)
 * Never guesses or falls back to synthetic numbers like 2.
 */
export function resolveLearningPlanAllocatedJP(
  plan: LearningPlan,
  context: {
    atp?: ATPData | null;
    timeAllocations?: TimeAllocation[] | null;
  }
): LearningPlanJPResolution {
  const issues: string[] = [];
  // 1. Explicit LearningPlan.allocatedJP
  if (typeof plan.allocatedJP === 'number' && !isNaN(plan.allocatedJP) && plan.allocatedJP > 0) {
    return { allocatedJP: plan.allocatedJP, source: 'EXPLICIT_PLAN' };
  }

  // 2. Canonical ATP allocatedJP / jp from referenced atpItemIds
  if (plan.atpItemIds && plan.atpItemIds.length > 0 && context.atp?.items) {
    const matchedAtps = context.atp.items.filter((item) => plan.atpItemIds.includes(item.id));
    const totalAtpJP = matchedAtps.reduce((sum, item) => {
      const jpVal = typeof item.allocatedJP === 'number' && item.allocatedJP > 0
        ? item.allocatedJP
        : (typeof item.jp === 'number' && item.jp > 0 ? item.jp : 0);
      return sum + jpVal;
    }, 0);

    if (totalAtpJP > 0) {
      return { allocatedJP: totalAtpJP, source: 'CANONICAL_ATP' };
    }
  }

  // 3. Linked TimeAllocation actual value, by explicit allocation IDs or exact canonical relationships
  if (context.timeAllocations && context.timeAllocations.length > 0) {
    const scopedAllocations = context.timeAllocations.filter((ta) => !ta.academicSettingId || ta.academicSettingId === plan.academicSettingId);
    const relatedById = plan.timeAllocationIds && plan.timeAllocationIds.length > 0
      ? scopedAllocations.filter((ta) => plan.timeAllocationIds?.includes(ta.id) && isTimeAllocationRelatedToPlan(ta, plan))
      : [];
    const relatedByAtp = (plan.atpItemIds || []).length > 0
      ? scopedAllocations.filter((ta) => {
          const sourceId = ta.sourceId || '';
          const atpItemId = ta.atpItemId || '';
          return (plan.atpItemIds || []).includes(atpItemId) || (plan.atpItemIds || []).includes(sourceId);
        })
      : [];
    const relatedByTp = (plan.tpIds || []).length > 0
      ? scopedAllocations.filter((ta) => ta.tpId && (plan.tpIds || []).includes(ta.tpId))
      : [];

    const matchedMap = new Map<string, TimeAllocation>();
    [...relatedById, ...relatedByAtp, ...relatedByTp].forEach((ta) => {
      if (ta.id) matchedMap.set(ta.id, ta);
    });
    const matchedAllocs = Array.from(matchedMap.values());

    const totalAllocJP = matchedAllocs.reduce((sum, a) => {
      const val = typeof a.allocatedJP === 'number' && a.allocatedJP > 0
        ? a.allocatedJP
        : (typeof a.jp === 'number' && a.jp > 0 ? a.jp : 0);
      return sum + val;
    }, 0);

    if (totalAllocJP > 0) {
      return {
        allocatedJP: totalAllocJP,
        source: 'LINKED_TIME_ALLOCATION',
        timeAllocationIds: matchedAllocs.map((a) => a.id),
        issues,
      };
    }
  }

  // 4. UNRESOLVED (Never guess, never fallback to synthetic numbers)
  return { allocatedJP: undefined, source: 'UNRESOLVED', issues };
}

export function normalizeAIReflection(raw: any): LearningPlan['reflection'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const teacherReflection = typeof raw.teacherReflection === 'string'
    ? raw.teacherReflection
    : (typeof raw.teacher === 'string' ? raw.teacher : undefined);
  const studentReflection = typeof raw.studentReflection === 'string'
    ? raw.studentReflection
    : (typeof raw.student === 'string' ? raw.student : undefined);
  if (!teacherReflection && !studentReflection) return undefined;
  return { teacherReflection, studentReflection };
}

export function normalizeDeepLearningContext(raw: any): DeepLearningContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const principles = Array.isArray(raw.principles)
    ? raw.principles
        .map((p: unknown) => normalizeDeepLearningPrinciple(p))
        .filter((p: DeepLearningPrinciple | null): p is DeepLearningPrinciple => p !== null)
    : undefined;
  const graduateProfileDimensions = Array.isArray(raw.graduateProfileDimensions)
    ? raw.graduateProfileDimensions.filter((d: unknown): d is string => typeof d === 'string' && d.trim().length > 0)
    : undefined;

  if ((!principles || principles.length === 0) && (!graduateProfileDimensions || graduateProfileDimensions.length === 0)) {
    return undefined;
  }

  return {
    principles: principles && principles.length > 0 ? Array.from(new Set(principles)) : undefined,
    graduateProfileDimensions,
  };
}

function normalizeAIAssessmentItems(rawItems: any, type: AssessmentPlanItem['type'], tpIds: string[]): AssessmentPlanItem[] {
  if (!Array.isArray(rawItems)) return [];
  const results: AssessmentPlanItem[] = [];
  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    if (!item || typeof item !== 'object') continue;
    const description = typeof item.description === 'string' ? item.description.trim() : '';
    const technique = typeof item.technique === 'string' ? item.technique.trim() : undefined;
    const method = typeof item.method === 'string' ? item.method.trim() : undefined;
    const instrument = typeof item.instrument === 'string' ? item.instrument.trim() : undefined;
    if (!description && !technique && !method && !instrument) continue;
    results.push({
      id: `asm-${type.toLowerCase()}-${results.length + 1}-${Date.now().toString(36)}`,
      type,
      linkedTpIds: [...tpIds],
      method,
      technique,
      instrument,
      description: description || technique || method || instrument,
    });
  }
  return results;
}

export function validateAILearningPlanPayload(data: any): { isValid: boolean; reason?: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { isValid: false, reason: 'Payload AI bukan berupa objek valid' };
  }

  if (!Array.isArray(data.learningExperiences) || data.learningExperiences.length === 0) {
    return { isValid: false, reason: 'Daftar Pengalaman Belajar (learningExperiences) kosong atau bukan array' };
  }

  const phaseSet = new Set<string>();
  for (let i = 0; i < data.learningExperiences.length; i++) {
    const exp = data.learningExperiences[i];
    if (!exp || typeof exp !== 'object') {
      return { isValid: false, reason: `Butir pengalaman belajar ke-${i + 1} bukan berupa objek` };
    }
    const normalizedPhase = normalizeLearningExperiencePhase(exp.phase);
    if (!normalizedPhase) {
      return { isValid: false, reason: `Fase pengalaman belajar ke-${i + 1} ('${exp.phase}') tidak valid. Pilihan sah: UNDERSTAND, APPLY, REFLECT` };
    }
    exp.phase = normalizedPhase;
    phaseSet.add(normalizedPhase);

    if (!exp.description || typeof exp.description !== 'string' || exp.description.trim() === '') {
      return { isValid: false, reason: `Deskripsi pengalaman belajar ke-${i + 1} kosong` };
    }

    exp.id = `exp-ai-${i + 1}`;
  }

  for (const phase of ['UNDERSTAND', 'APPLY', 'REFLECT']) {
    if (!phaseSet.has(phase)) {
      return { isValid: false, reason: `Pengalaman Belajar wajib memuat fase ${phase}` };
    }
  }

  return { isValid: true };
}

export function normalizeAIAssessmentPlan(raw: any, tpIds: string[]): LearningPlan['assessmentPlan'] {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    initial: normalizeAIAssessmentItems(source.initial, 'INITIAL', tpIds),
    formative: normalizeAIAssessmentItems(source.formative, 'FORMATIVE', tpIds),
    summative: normalizeAIAssessmentItems(source.summative, 'SUMMATIVE', tpIds),
  };
}

export function normalizeAIResources(raw: any): LearningPlan['resources'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((resource, idx) => {
      if (typeof resource === 'string') {
        const title = resource.trim();
        return title ? { id: `res-ai-${idx + 1}-${Date.now().toString(36)}`, title } : null;
      }
      if (!resource || typeof resource !== 'object') return null;
      const title = typeof resource.title === 'string' && resource.title.trim()
        ? resource.title.trim()
        : (typeof resource.source === 'string' && resource.source.trim() ? resource.source.trim() : '');
      if (!title) return null;
      const resItem: LearningResource = {
        id: `res-ai-${idx + 1}-${Date.now().toString(36)}`,
        type: typeof resource.type === 'string' ? resource.type : undefined,
        title,
        source: typeof resource.source === 'string' ? resource.source : undefined,
        url: typeof resource.url === 'string' ? resource.url : undefined,
      };
      return resItem;
    })
    .filter((resource): resource is LearningResource => resource !== null);
}

export interface LearningPlanValidationResult {
  valid: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  draftErrors: string[];
  finalizationErrors: string[];
  resolvedTPs: Array<{ id: string; code?: string; statement: string; materialScope?: string }>;
  resolvedATPs: Array<{ id: string; stepNumber?: number; materialScope?: string; jp?: number }>;
  resolvedAllocatedJP?: number;
  jpResolutionSource?: 'EXPLICIT_PLAN' | 'CANONICAL_ATP' | 'LINKED_TIME_ALLOCATION' | 'UNRESOLVED';
}

/**
 * Validates a canonical LearningPlan against workspace dependencies.
 * Follows strict principles:
 * - NO DATA > FAKE DATA
 * - ID > TEXT MATCH
 * - UNRESOLVED > GUESS
 * - VALIDATOR > AUTO SIAP
 * - AI OUTPUT = DRAFT
 * - TEACHER EDIT ALWAYS WINS
 */
export function validateLearningPlan(
  plan: LearningPlan,
  context: {
    academicSetting?: AcademicSetting | null;
    tp?: TPData | null;
    atp?: ATPData | null;
    k13Analysis?: K13Analysis | null;
    timeAllocations?: TimeAllocation[] | null;
    assessmentCriteria?: AssessmentCriterion[] | null;
  }
): LearningPlanValidationResult {
  const draftErrors: string[] = [];
  const finalizationErrors: string[] = [];
  const errors: string[] = draftErrors;
  const warnings: string[] = [];
  const resolvedTPs: Array<{ id: string; code?: string; statement: string; materialScope?: string }> = [];
  const resolvedATPs: Array<{ id: string; stepNumber?: number; materialScope?: string; jp?: number }> = [];

  if (!plan) {
    return {
      valid: false,
      isValid: false,
      errors: ['Data Perencanaan Pembelajaran (LearningPlan) tidak ditemukan / kosong.'],
      warnings: [],
      draftErrors: ['Data Perencanaan Pembelajaran (LearningPlan) tidak ditemukan / kosong.'],
      finalizationErrors: [],
      resolvedTPs: [],
      resolvedATPs: [],
      resolvedAllocatedJP: undefined,
      jpResolutionSource: 'UNRESOLVED',
    };
  }

  // 1. Validate Academic Setting linkage
  if (!plan.academicSettingId || plan.academicSettingId.trim() === '') {
    errors.push('ID Pengaturan Akademik (academicSettingId) tidak valid.');
  } else if (context.academicSetting && context.academicSetting.id !== plan.academicSettingId) {
    errors.push(`ID Pengaturan Akademik tidak sesuai (Plan: ${plan.academicSettingId}, Context: ${context.academicSetting.id}).`);
  }
  if (!plan.curriculumType || !context.academicSetting?.curriculumType || plan.curriculumType !== context.academicSetting.curriculumType) {
    errors.push('Kurikulum LearningPlan belum terselesaikan.');
  }

  const objectiveResolution = resolveLearningPlanObjectives({
    tpIds: plan.tpIds,
    tp: context.tp,
    k13Analysis: context.k13Analysis,
    curriculumType: plan.curriculumType,
  });

  if (plan.curriculumType === 'KURIKULUM_MERDEKA') {
    if (plan.tpIds && plan.tpIds.length > 0) {
      if (!context.tp || context.tp.workflowStatus !== 'SIAP' || context.tp.needsReview) {
        errors.push('TP acuan belum SIAP atau masih memerlukan peninjauan ulang.');
      }
    }
    if (plan.atpItemIds && plan.atpItemIds.length > 0) {
      if (!context.atp || context.atp.workflowStatus !== 'SIAP' || context.atp.needsReview) {
        errors.push('ATP acuan belum SIAP atau masih memerlukan peninjauan ulang.');
      } else {
        const atpRuntime = validateATPReferences(context.atp, context.tp || undefined);
        if (!atpRuntime.isSiap) {
          errors.push('ATP acuan tidak lolos validasi runtime terhadap TP kanonikal.');
        }
      }
    }
  }

  // 2. Validate Canonical TP Dependency (Strict ID lookup - NO text matching)
  if (!plan.tpIds || !Array.isArray(plan.tpIds) || plan.tpIds.length === 0) {
    errors.push('Perencanaan Pembelajaran wajib merujuk minimal 1 Tujuan Pembelajaran (tpIds kosong).');
  } else {
    objectiveResolution.objectives.forEach((obj) => {
      resolvedTPs.push({
        id: obj.tpId || obj.id,
        code: obj.code,
        statement: obj.statement,
        materialScope: obj.materialScope,
      });
    });
    objectiveResolution.danglingIds.forEach((tpId) => {
      errors.push(`Tujuan Pembelajaran/KD dengan ID '${tpId}' tidak ditemukan dalam data canonical aktif (Orphan TP ID).`);
    });
  }

  // 3. Validate Canonical ATP Dependency (Strict ID lookup)
  if (plan.atpItemIds && Array.isArray(plan.atpItemIds) && plan.atpItemIds.length > 0) {
    const availableAtpItems: ATPItem[] = context.atp?.items || [];
    for (const atpItemId of plan.atpItemIds) {
      const foundAtp = availableAtpItems.find((item) => item.id === atpItemId);
      if (foundAtp) {
        resolvedATPs.push({
          id: foundAtp.id,
          stepNumber: foundAtp.stepNumber,
          materialScope: foundAtp.materialScope,
          jp: typeof foundAtp.jp === 'number' ? foundAtp.jp : undefined,
        });
      } else {
        errors.push(`Langkah ATP dengan ID '${atpItemId}' tidak ditemukan dalam alur ATP aktif (Orphan ATP ID).`);
      }
    }
  }

  // 4. Validate Objectives list from canonical TP/KD, not stale stored cache
  if (objectiveResolution.objectives.length === 0) {
    errors.push('Daftar rumusan Tujuan Pembelajaran canonical tidak boleh kosong.');
  } else {
    objectiveResolution.objectives.forEach((obj, i) => {
      if (!obj.statement || obj.statement.trim() === '') {
        errors.push(`Tujuan Pembelajaran canonical butir ke-${i + 1} memiliki rumusan kalimat kosong.`);
      }
    });
  }

  // 5. Validate Learning Activity & Canonical Learning Experiences (2026 Compatible)
  const experiences = Array.isArray(plan.learningExperiences) ? plan.learningExperiences : [];
  const seenExpIds = new Set<string>();
  let validExpCount = 0;

  for (let i = 0; i < experiences.length; i++) {
    const exp = experiences[i];
    if (!exp) continue;

    let isExperienceValid = true;

    // Validate ID
    if (!exp.id || exp.id.trim() === '') {
      errors.push(`Pengalaman Belajar butir ke-${i + 1} memiliki ID kosong.`);
      isExperienceValid = false;
    } else if (seenExpIds.has(exp.id)) {
      errors.push(`Terdapat duplikasi ID '${exp.id}' pada Pengalaman Belajar (learningExperiences).`);
      isExperienceValid = false;
    } else {
      seenExpIds.add(exp.id);
    }

    // Validate phase
    const validPhases: LearningExperiencePhase[] = ['UNDERSTAND', 'APPLY', 'REFLECT'];
    if (!validPhases.includes(exp.phase)) {
      errors.push(
        `Pengalaman Belajar '${exp.id || i + 1}' memiliki fase tidak sah ('${exp.phase}'). Pilihan yang sah: UNDERSTAND (Memahami), APPLY (Mengaplikasi), REFLECT (Merefleksi).`
      );
      isExperienceValid = false;
    }

    // Validate description
    if (!exp.description || exp.description.trim() === '') {
      errors.push(`Pengalaman Belajar '${exp.id || i + 1}' memiliki deskripsi kosong.`);
      isExperienceValid = false;
    }

    // Validate durationMinutes if provided
    if (exp.durationMinutes !== undefined && exp.durationMinutes !== null) {
      if (
        typeof exp.durationMinutes !== 'number' ||
        !Number.isFinite(exp.durationMinutes) ||
        isNaN(exp.durationMinutes) ||
        exp.durationMinutes <= 0
      ) {
        errors.push(
          `Pengalaman Belajar '${exp.id || i + 1}' memiliki alokasi waktu (durationMinutes) tidak valid: ${String(exp.durationMinutes)}. Harus berupa bilangan positif terhingga (> 0).`
        );
        isExperienceValid = false;
      }
    }

    // Validate linked TP IDs (strictly canonical, no dangling references)
    if (exp.linkedTpIds && Array.isArray(exp.linkedTpIds)) {
      for (const linkedId of exp.linkedTpIds) {
        if (!plan.tpIds || !plan.tpIds.includes(linkedId)) {
          errors.push(
            `Pengalaman Belajar '${exp.id || i + 1}' merujuk TP ID '${linkedId}' yang tidak terdaftar dalam perencanaan ini (dangling TP reference).`
          );
          isExperienceValid = false;
        }
      }
    }

    if (isExperienceValid) {
      validExpCount++;
    }
  }

  // Legacy learning steps evaluation
  const openingSteps = plan.learningSteps?.opening || [];
  const coreSteps = plan.learningSteps?.core || [];
  const closingSteps = plan.learningSteps?.closing || [];

  const coreValidCount = coreSteps.filter((s) => s && s.description && s.description.trim().length > 0).length;
  const openingValidCount = openingSteps.filter((s) => s && s.description && s.description.trim().length > 0).length;
  const closingValidCount = closingSteps.filter((s) => s && s.description && s.description.trim().length > 0).length;
  const hasLegacySteps = (openingValidCount + coreValidCount + closingValidCount) > 0;

  // Learning activity check: valid if canonical learning experiences OR valid legacy steps exist
  if (validExpCount > 0) {
    // Canonical 2026 pathway satisfied! Core steps in legacy schema are NOT required.
    if (openingValidCount === 0 && hasLegacySteps) {
      warnings.push('Kegiatan Pendahuluan belum diisi deskripsi aktivitasnya.');
    }
    if (closingValidCount === 0 && hasLegacySteps) {
      warnings.push('Kegiatan Penutup belum diisi deskripsi aktivitasnya.');
    }
  } else if (hasLegacySteps) {
    // Legacy pathway validation
    if (coreValidCount === 0) {
      errors.push('Kegiatan Inti pembelajaran wajib memiliki minimal 1 langkah aktivitas yang terisi deskripsinya (atau sediakan Pengalaman Belajar canonical).');
    }
    if (openingValidCount === 0) {
      warnings.push('Kegiatan Pendahuluan belum diisi deskripsi aktivitasnya.');
    }
    if (closingValidCount === 0) {
      warnings.push('Kegiatan Penutup belum diisi deskripsi aktivitasnya.');
    }
  } else {
    // Neither canonical experiences nor legacy steps exist
    errors.push('Perencanaan Pembelajaran wajib memiliki aktivitas pembelajaran (Pengalaman Belajar canonical 2026 atau Langkah Pembelajaran legacy).');
  }

  // 6. Validate Deep Learning Context (Optional contextual model - NOT mandatory checklist)
  if (plan.deepLearningContext) {
    if (Array.isArray(plan.deepLearningContext.principles)) {
      const validPrinciples: DeepLearningPrinciple[] = ['MINDFUL', 'MEANINGFUL', 'JOYFUL'];
      for (const p of plan.deepLearningContext.principles) {
        if (!validPrinciples.includes(p)) {
          errors.push(`Prinsip Pembelajaran Mendalam '${p}' tidak valid. Pilihan yang sah: MINDFUL (Berkesadaran), MEANINGFUL (Bermakna), JOYFUL (Menggembirakan).`);
        }
      }
      const uniquePrinciples = new Set(plan.deepLearningContext.principles);
      if (uniquePrinciples.size !== plan.deepLearningContext.principles.length) {
        errors.push('Terdapat duplikasi nilai pada prinsip Pembelajaran Mendalam (principles).');
      }
    }
    if (Array.isArray(plan.deepLearningContext.graduateProfileDimensions)) {
      const uniqueDims = new Set(plan.deepLearningContext.graduateProfileDimensions);
      if (uniqueDims.size !== plan.deepLearningContext.graduateProfileDimensions.length) {
        warnings.push('Terdapat duplikasi nilai pada Dimensi Profil Lulusan pada deepLearningContext.');
      }
    }
  }

  // 7. Validate Graduate Profile Dimensions against the shared canonical validator.
  // Fail-closed: blank, non-string, and unknown values are validation errors.
  if (plan.graduateProfileDimensions !== undefined) {
    const dimValidation = validateGraduateProfileDimensions(
      plan.graduateProfileDimensions
    );

    if (!dimValidation.isValid) {
      errors.push(
        dimValidation.error || 'Dimensi Profil Lulusan tidak valid.'
      );
    } else {
      const uniqueDims = new Set(dimValidation.dimensions);
      if (uniqueDims.size !== dimValidation.dimensions.length) {
        warnings.push(
          'Terdapat duplikasi nilai pada Dimensi Profil Lulusan (graduateProfileDimensions).'
        );
      }
    }
  }

  // 8. Validate Assessment Plan (Rencana Asesmen)
  const initialAssessments = plan.assessmentPlan?.initial || [];
  const formativeAssessments = plan.assessmentPlan?.formative || [];
  const summativeAssessments = plan.assessmentPlan?.summative || [];

  const totalAssessmentItems = initialAssessments.length + formativeAssessments.length + summativeAssessments.length;
  if (totalAssessmentItems === 0) {
    errors.push('Rencana Asesmen minimal harus memuat salah satu bentuk penilaian (Awal, Formatif, atau Sumatif).');
  } else {
    const allAssessments = [...initialAssessments, ...formativeAssessments, ...summativeAssessments];
    for (const item of allAssessments) {
      if (item.linkedTpIds && Array.isArray(item.linkedTpIds)) {
        for (const linkedId of item.linkedTpIds) {
          if (!plan.tpIds.includes(linkedId)) {
            errors.push(`Rencana asesmen '${item.type}' merujuk TP ID '${linkedId}' yang tidak terdaftar dalam perencanaan ini.`);
          }
        }
      }
    }
  }

  // 9. Time / JP Allocation Resolution (Strictly from real data)
  const jpResolution = resolveLearningPlanAllocatedJP(plan, {
    atp: context.atp,
    timeAllocations: context.timeAllocations,
  });
  const resolvedAllocatedJP = jpResolution.allocatedJP;

  if (resolvedAllocatedJP === undefined) {
    warnings.push('Alokasi JP belum ditentukan.');
  }

  if (experiences.length > 0) {
    const validPhaseSet = new Set(
      experiences
        .filter((exp) => exp && exp.description && exp.description.trim())
        .map((exp) => exp.phase)
        .filter((phase) => phase === 'UNDERSTAND' || phase === 'APPLY' || phase === 'REFLECT')
    );
    (['UNDERSTAND', 'APPLY', 'REFLECT'] as LearningExperiencePhase[]).forEach((phase) => {
      if (!validPhaseSet.has(phase)) {
        errors.push(`Pengalaman Belajar canonical wajib memuat fase ${phase} (${LEARNING_EXPERIENCE_PHASE_LABELS[phase]}).`);
      }
    });
  }
  (jpResolution.issues || []).forEach((issue) => warnings.push(issue));

  // 10. Lifecycle & Status Validation
  if (plan.status === 'SIAP') {
    if (draftErrors.length > 0) {
      finalizationErrors.push('Status SIAP tidak valid karena masih terdapat kesalahan integritas data draf.');
    }
    if (!plan.confirmedAt) {
      finalizationErrors.push('Status SIAP memerlukan konfirmasi dan penetapan eksplisit dari guru (confirmedAt belum tercatat).');
    }
    if (plan.sourceType === 'AI_DRAFT' && !plan.confirmedAt) {
      finalizationErrors.push('Keluaran draf AI tidak boleh langsung berstatus SIAP tanpa peninjauan guru.');
    }

    // Print-readiness finalization requirements for Kurikulum Merdeka
    if (plan.curriculumType === 'KURIKULUM_MERDEKA' || !plan.curriculumType) {
      if (!plan.initialCompetency || typeof plan.initialCompetency !== 'string' || plan.initialCompetency.trim() === '') {
        finalizationErrors.push('Kompetensi Awal belum diisi.');
      }
      const dimValidation = validateGraduateProfileDimensions(
        plan.graduateProfileDimensions
      );
      if (!dimValidation.isValid) {
        finalizationErrors.push(
          dimValidation.error || 'Dimensi Profil Lulusan belum dipilih.'
        );
      }
      const validResources = (plan.resources || []).filter(
        (r) =>
          r &&
          typeof r === 'object' &&
          ((typeof r.title === 'string' && r.title.trim().length > 0) ||
            (typeof r.source === 'string' && r.source.trim().length > 0))
      );
      if (validResources.length === 0) {
        finalizationErrors.push('Sarana dan prasarana / sumber belajar belum diisi.');
      }
      if (!plan.learningModel || typeof plan.learningModel !== 'string' || plan.learningModel.trim() === '') {
        finalizationErrors.push('Model/praktik pembelajaran belum diisi.');
      }
    }
  }

  const allErrors = [...draftErrors, ...finalizationErrors];

  return {
    valid: allErrors.length === 0,
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings,
    draftErrors,
    finalizationErrors,
    resolvedTPs,
    resolvedATPs,
    resolvedAllocatedJP,
    jpResolutionSource: jpResolution.source,
  };
}

/**
 * Creates an initial empty canonical LearningPlan in DRAFT status.
 * Never fabricates experiences, deep learning principles, or graduate profile dimensions.
 */
export function createEmptyLearningPlan(params: {
  academicSetting: AcademicSetting;
  curriculumType?: CurriculumType;
  tpIds?: string[];
  atpItemIds?: string[];
  context?: { tp?: TPData | null; atp?: ATPData | null };
}): LearningPlan {
  const { academicSetting, curriculumType, tpIds = [], atpItemIds = [], context } = params;
  const now = new Date().toISOString();

  const objectives = resolveLearningPlanObjectives({ tpIds, tp: context?.tp, curriculumType }).objectives;

  return {
    id: `lp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    academicSettingId: academicSetting.id,
    curriculumType,
    sourceType: 'MANUAL',
    status: 'DRAFT',
    tpIds,
    atpItemIds,
    title: objectives.length > 0 ? `Modul Ajar: ${objectives[0].materialScope || objectives[0].code || 'Topik Pembelajaran'}` : '',
    topic: objectives.length > 0 ? (objectives[0].materialScope || '') : '',
    objectives,
    learningExperiences: [],
    learningSteps: {
      opening: [],
      core: [],
      closing: [],
    },
    assessmentPlan: {
      initial: [],
      formative: [],
      summative: [],
    },
    resources: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates an AI Draft LearningPlan. Always sets sourceType: 'AI_DRAFT' and status: 'DRAFT'.
 * Preserves teacher/draft data without fabricating missing experiences/principles/dimensions.
 */
export function createAIDraftLearningPlan(params: {
  academicSetting: AcademicSetting;
  curriculumType?: CurriculumType;
  tpIds: string[];
  atpItemIds?: string[];
  aiDraft: Partial<LearningPlan>;
  context?: { tp?: TPData | null; atp?: ATPData | null };
}): LearningPlan {
  const { academicSetting, curriculumType, tpIds, atpItemIds = [], aiDraft, context } = params;
  const now = new Date().toISOString();

  const objectives = resolveLearningPlanObjectives({ tpIds, tp: context?.tp, curriculumType }).objectives;
  const normalizedAssessmentPlan = normalizeAIAssessmentPlan(aiDraft.assessmentPlan, tpIds);
  const normalizedDeepLearningContext = normalizeDeepLearningContext(aiDraft.deepLearningContext);
  const normalizedResources = normalizeAIResources(aiDraft.resources);

  return {
    id: `lp-ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    academicSettingId: academicSetting.id,
    curriculumType,
    sourceType: 'AI_DRAFT',
    status: 'DRAFT',
    tpIds,
    atpItemIds,
    title: aiDraft.title || (objectives.length > 0 ? `Draf Modul Ajar: ${objectives[0].materialScope || objectives[0].code || 'Topik'}` : 'Draf Modul Ajar'),
    topic: aiDraft.topic || (objectives.length > 0 ? objectives[0].materialScope : ''),
    objectives,
    learningExperiences: Array.isArray(aiDraft.learningExperiences)
      ? aiDraft.learningExperiences.map((exp, idx) => {
          const normPhase = normalizeLearningExperiencePhase(exp.phase) || exp.phase;
          return {
            id: `exp-ai-${idx + 1}-${Date.now().toString(36)}`,
            phase: normPhase as LearningExperiencePhase,
            description: exp.description || '',
            durationMinutes:
              typeof exp.durationMinutes === 'number' &&
              Number.isFinite(exp.durationMinutes) &&
              !isNaN(exp.durationMinutes) &&
              exp.durationMinutes > 0
                ? exp.durationMinutes
                : undefined,
            linkedTpIds: Array.isArray(exp.linkedTpIds) ? exp.linkedTpIds : undefined,
          };
        })
      : [],
    deepLearningContext: normalizedDeepLearningContext,
    graduateProfileDimensions: Array.isArray(aiDraft.graduateProfileDimensions) ? aiDraft.graduateProfileDimensions : undefined,
    learningSteps: {
      opening: aiDraft.learningSteps?.opening || [],
      core: aiDraft.learningSteps?.core || [],
      closing: aiDraft.learningSteps?.closing || [],
    },
    assessmentPlan: {
      initial: normalizedAssessmentPlan.initial,
      formative: normalizedAssessmentPlan.formative,
      summative: normalizedAssessmentPlan.summative,
    },
    resources: normalizedResources,
    differentiation: aiDraft.differentiation,
    meaningfulUnderstanding: aiDraft.meaningfulUnderstanding,
    triggerQuestions: aiDraft.triggerQuestions,
    reflection: normalizeAIReflection(aiDraft.reflection),
    enrichmentPlan: aiDraft.enrichmentPlan,
    remedialPlan: aiDraft.remedialPlan,
    initialCompetency: aiDraft.initialCompetency,
    targetStudents: aiDraft.targetStudents,
    learningModel: aiDraft.learningModel,
    p3Dimensions: aiDraft.p3Dimensions,
    allocatedJP: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Confirms a LearningPlan as SIAP after rigorous validation.
 */
export function confirmLearningPlan(
  plan: LearningPlan,
  context: {
    academicSetting?: AcademicSetting | null;
    tp?: TPData | null;
    atp?: ATPData | null;
    k13Analysis?: K13Analysis | null;
    timeAllocations?: TimeAllocation[] | null;
    assessmentCriteria?: AssessmentCriterion[] | null;
  }
): { success: boolean; plan: LearningPlan; validation: LearningPlanValidationResult } {
  // First evaluate validation without the status check
  const candidatePlan: LearningPlan = {
    ...plan,
    status: 'SIAP',
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validation = validateLearningPlan(candidatePlan, context);

  if (!validation.valid) {
    return {
      success: false,
      plan: {
        ...plan,
        status: 'PERLU_DILENGKAPI',
        confirmedAt: undefined,
        updatedAt: new Date().toISOString(),
      },
      validation,
    };
  }

  return {
    success: true,
    plan: candidatePlan,
    validation,
  };
}

/**
 * Determines whether a change to a LearningPlan is pedagogically substantive.
 * Substantive edits invalidate SIAP status and revert the plan to DRAFT.
 */
export function isSubstantiveLearningPlanChange(oldPlan: LearningPlan, newPlan: LearningPlan): boolean {
  if (JSON.stringify(oldPlan.tpIds || []) !== JSON.stringify(newPlan.tpIds || [])) return true;
  if (JSON.stringify(oldPlan.atpItemIds || []) !== JSON.stringify(newPlan.atpItemIds || [])) return true;
  if (JSON.stringify(oldPlan.kktpCriterionIds || []) !== JSON.stringify(newPlan.kktpCriterionIds || [])) return true;
  if ((oldPlan.title || '') !== (newPlan.title || '')) return true;
  if ((oldPlan.topic || '') !== (newPlan.topic || '')) return true;
  if (JSON.stringify(oldPlan.objectives || []) !== JSON.stringify(newPlan.objectives || [])) return true;
  if (JSON.stringify(oldPlan.learningExperiences || []) !== JSON.stringify(newPlan.learningExperiences || [])) return true;
  if (JSON.stringify(oldPlan.learningSteps || {}) !== JSON.stringify(newPlan.learningSteps || {})) return true;
  if (JSON.stringify(oldPlan.deepLearningContext || {}) !== JSON.stringify(newPlan.deepLearningContext || {})) return true;
  if (JSON.stringify(oldPlan.graduateProfileDimensions || []) !== JSON.stringify(newPlan.graduateProfileDimensions || [])) return true;
  if (JSON.stringify(oldPlan.assessmentPlan || {}) !== JSON.stringify(newPlan.assessmentPlan || {})) return true;
  if (JSON.stringify(oldPlan.resources || []) !== JSON.stringify(newPlan.resources || [])) return true;
  if (JSON.stringify(oldPlan.differentiation || {}) !== JSON.stringify(newPlan.differentiation || {})) return true;
  if ((oldPlan.meaningfulUnderstanding || '') !== (newPlan.meaningfulUnderstanding || '')) return true;
  if (JSON.stringify(oldPlan.triggerQuestions || []) !== JSON.stringify(newPlan.triggerQuestions || [])) return true;
  if (JSON.stringify(oldPlan.reflection || {}) !== JSON.stringify(newPlan.reflection || {})) return true;
  if ((oldPlan.enrichmentPlan || '') !== (newPlan.enrichmentPlan || '')) return true;
  if ((oldPlan.remedialPlan || '') !== (newPlan.remedialPlan || '')) return true;
  if (oldPlan.allocatedJP !== newPlan.allocatedJP) return true;
  return false;
}

/**
 * Automatically invalidates SIAP status if underlying dependencies (TP/ATP) were deleted or changed.
 */
export function invalidatePlanIfDependenciesChanged(
  plan: LearningPlan,
  context: {
    academicSetting?: AcademicSetting | null;
    tp?: TPData | null;
    atp?: ATPData | null;
    k13Analysis?: K13Analysis | null;
  }
): { plan: LearningPlan; isInvalidated: boolean; reason?: string } {
  if (plan.status !== 'SIAP') {
    return { plan, isInvalidated: false };
  }

  const validation = validateLearningPlan(plan, context);
  if (!validation.valid) {
    return {
      plan: {
        ...plan,
        status: 'PERLU_DILENGKAPI',
        confirmedAt: undefined,
        updatedAt: new Date().toISOString(),
      },
      isInvalidated: true,
      reason: `Status diturunkan ke PERLU_DILENGKAPI karena dependency berubah:\n${validation.errors.join('\n')}`,
    };
  }

  return { plan, isInvalidated: false };
}

/**
 * Migrates legacy learning plans without fabricating non-existent pedagogical facts.
 */
export function migrateLegacyLearningPlan(
  legacy: any,
  academicSettingId: string,
  curriculumType?: CurriculumType
): LearningPlan {
  const now = new Date().toISOString();
  const rawId = legacy?.id || `lp-migrated-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Parse objectives safely
  const objectives: LearningPlan['objectives'] = [];
  if (Array.isArray(legacy?.objectives)) {
    for (let i = 0; i < legacy.objectives.length; i++) {
      const obj = legacy.objectives[i];
      if (typeof obj === 'string') {
        objectives.push({
          id: `obj-${i + 1}`,
          statement: obj,
        });
      } else if (obj && typeof obj === 'object') {
        objectives.push({
          id: obj.id || `obj-${i + 1}`,
          tpId: obj.tpId,
          code: obj.code,
          statement: obj.statement || obj.description || '',
          materialScope: obj.materialScope || obj.contentScope,
        });
      }
    }
  }

  // Parse steps safely
  const opening: LearningPlan['learningSteps']['opening'] = [];
  const core: LearningPlan['learningSteps']['core'] = [];
  const closing: LearningPlan['learningSteps']['closing'] = [];

  if (Array.isArray(legacy?.learningSteps)) {
    for (let i = 0; i < legacy.learningSteps.length; i++) {
      const s = legacy.learningSteps[i];
      const stepItem = {
        id: s.id || `step-${i + 1}`,
        stepName: s.stepName || 'Kegiatan Inti',
        description: s.description || '',
        durationMinutes: typeof s.durationMinutes === 'number' ? s.durationMinutes : undefined,
      };
      const nameLower = (s.stepName || '').toLowerCase();
      if (nameLower.includes('awal') || nameLower.includes('pendahuluan')) {
        opening.push(stepItem);
      } else if (nameLower.includes('tutup') || nameLower.includes('penutup') || nameLower.includes('akhir')) {
        closing.push(stepItem);
      } else {
        core.push(stepItem);
      }
    }
  } else if (legacy?.learningSteps && typeof legacy.learningSteps === 'object') {
    if (Array.isArray(legacy.learningSteps.opening)) opening.push(...legacy.learningSteps.opening);
    if (Array.isArray(legacy.learningSteps.core)) core.push(...legacy.learningSteps.core);
    if (Array.isArray(legacy.learningSteps.closing)) closing.push(...legacy.learningSteps.closing);
  }

  // Parse assessments safely
  const initialAssessments: LearningPlan['assessmentPlan']['initial'] = [];
  const formativeAssessments: LearningPlan['assessmentPlan']['formative'] = [];
  const summativeAssessments: LearningPlan['assessmentPlan']['summative'] = [];

  if (Array.isArray(legacy?.assessmentPlan)) {
    for (let i = 0; i < legacy.assessmentPlan.length; i++) {
      const a = legacy.assessmentPlan[i];
      const item = {
        id: a.id || `asm-${i + 1}`,
        type: ((a.type || 'FORMATIVE').toUpperCase() as 'INITIAL' | 'FORMATIVE' | 'SUMMATIVE'),
        technique: a.technique,
        instrument: a.instrument,
        linkedTpIds: Array.isArray(a.linkedTpIds) ? a.linkedTpIds : [],
        description: a.description || a.instrument || a.technique,
      };
      if (item.type === 'INITIAL') initialAssessments.push(item);
      else if (item.type === 'SUMMATIVE') summativeAssessments.push(item);
      else formativeAssessments.push(item);
    }
  } else if (legacy?.assessmentPlan && typeof legacy.assessmentPlan === 'object') {
    if (Array.isArray(legacy.assessmentPlan.initial)) initialAssessments.push(...legacy.assessmentPlan.initial);
    if (Array.isArray(legacy.assessmentPlan.formative)) formativeAssessments.push(...legacy.assessmentPlan.formative);
    if (Array.isArray(legacy.assessmentPlan.summative)) summativeAssessments.push(...legacy.assessmentPlan.summative);
  }

  return {
    id: rawId,
    academicSettingId: legacy?.academicSettingId || academicSettingId,
    curriculumType: legacy?.curriculumType || curriculumType,
    sourceType: 'MIGRATED',
    status: 'DRAFT', // Migrated plans always require teacher review
    tpIds: Array.isArray(legacy?.tpIds) ? legacy.tpIds : [],
    atpItemIds: Array.isArray(legacy?.atpItemIds) ? legacy.atpItemIds : [],
    kktpCriterionIds: Array.isArray(legacy?.kktpCriterionIds) ? legacy.kktpCriterionIds : [],
    timeAllocationIds: Array.isArray(legacy?.timeAllocationIds) ? legacy.timeAllocationIds : [],
    title: legacy?.title || '',
    topic: legacy?.topic || '',
    objectives,
    learningSteps: {
      opening,
      core,
      closing,
    },
    learningExperiences: Array.isArray(legacy?.learningExperiences)
      ? legacy.learningExperiences.map((exp: any, idx: number) => ({
          id: exp.id || `exp-${idx + 1}`,
          phase: exp.phase,
          description: exp.description || '',
          linkedTpIds: Array.isArray(exp.linkedTpIds) ? exp.linkedTpIds : undefined,
          durationMinutes:
            typeof exp.durationMinutes === 'number' &&
            Number.isFinite(exp.durationMinutes) &&
            !isNaN(exp.durationMinutes) &&
            exp.durationMinutes > 0
              ? exp.durationMinutes
              : undefined,
        }))
      : undefined,
    deepLearningContext: legacy?.deepLearningContext,
    graduateProfileDimensions: Array.isArray(legacy?.graduateProfileDimensions) ? legacy.graduateProfileDimensions : undefined,
    assessmentPlan: {
      initial: initialAssessments,
      formative: formativeAssessments,
      summative: summativeAssessments,
    },
    resources: Array.isArray(legacy?.resources) ? legacy.resources.map((r: any, idx: number) => (typeof r === 'string' ? { id: `res-${idx + 1}`, title: r } : r)) : [],
    differentiation: legacy?.differentiation,
    meaningfulUnderstanding: legacy?.meaningfulUnderstanding,
    triggerQuestions: Array.isArray(legacy?.triggerQuestions) ? legacy.triggerQuestions : [],
    reflection: legacy?.reflection,
    enrichmentPlan: legacy?.enrichmentPlan,
    remedialPlan: legacy?.remedialPlan,
    initialCompetency: legacy?.initialCompetency,
    targetStudents: legacy?.targetStudents,
    learningModel: legacy?.learningModel,
    p3Dimensions: Array.isArray(legacy?.p3Dimensions) ? legacy.p3Dimensions : [],
    allocatedJP: typeof legacy?.allocatedJP === 'number' ? legacy.allocatedJP : undefined,
    createdAt: legacy?.createdAt || now,
    updatedAt: now,
  };
}
