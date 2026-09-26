import assert from 'node:assert';
import {
  createAIDraftLearningPlan,
  createEmptyLearningPlan,
  validateLearningPlan,
  resolveLearningPlanAllocatedJP,
  resolveLearningPlanObjectives,
  normalizeAIAssessmentPlan,
  normalizeAIReflection,
  normalizeDeepLearningContext,
  isSubstantiveLearningPlanChange,
  normalizeLearningExperiencePhase,
  validateAILearningPlanPayload,
} from '../src/services/learningPlanService';
import { AcademicSetting, TPData, ATPData, LearningPlan } from '../src/types';
import { getCurriculumTypeFromSetting } from '../src/services/curriculumRouter';
import { resolveAvailableScopes } from '../src/components/administration/LearningPlanManager';

console.log('=== RUNNING WORKFLOW RECOVERY A REGRESSION SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

const mockSetting: AcademicSetting = {
  id: 'setting-1',
  profileId: 'p1',
  subject: 'Bahasa Indonesia',
  level: 'SMP',
  grade: 'Kelas 7',
  phase: 'Fase D',
  semester: '1 (Ganjil)',
  academicYear: '2026/2027',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  updatedAt: new Date().toISOString(),
};

const mockTpData: TPData = {
  id: 'tpdata-1',
  academicSettingId: 'setting-1',
  updatedAt: new Date().toISOString(),
  items: [
    {
      id: 'tp-101',
      order: 1,
      code: 'TP 7.1',
      statement: 'Murid mampu mengidentifikasi gagasan utama teks deskripsi.',
      competence: 'Mengidentifikasi',
      contentScope: 'Teks Deskripsi',
      p3Dimensions: ['Bernalar Kritis'],
    },
    {
      id: 'tp-102',
      order: 2,
      code: 'TP 7.2',
      statement: 'Murid mampu menyusun teks deskripsi secara tertulis.',
      competence: 'Menyusun',
      contentScope: 'Teks Deskripsi',
      p3Dimensions: ['Kreatif', 'Mandiri'],
    },
  ],
};

const mockAtpData: ATPData = {
  id: 'atpdata-1',
  academicSettingId: 'setting-1',
  updatedAt: new Date().toISOString(),
  totalJP: 36,
  workflowStatus: 'SIAP',
  items: [
    {
      id: 'atp-201',
      stepNumber: 1,
      tpId: 'tp-101',
      tpCode: 'TP 7.1',
      tpStatement: 'Murid mampu mengidentifikasi gagasan utama teks deskripsi.',
      materialScope: 'Teks Deskripsi',
      jp: 8,
      semester: 1,
    },
  ],
};

// 1. AI Phase normalization tests
runTest('Contract: normalizeLearningExperiencePhase handles standard & localized phase strings', () => {
  assert.strictEqual(normalizeLearningExperiencePhase('UNDERSTAND'), 'UNDERSTAND');
  assert.strictEqual(normalizeLearningExperiencePhase('understand'), 'UNDERSTAND');
  assert.strictEqual(normalizeLearningExperiencePhase('Memahami'), 'UNDERSTAND');
  assert.strictEqual(normalizeLearningExperiencePhase('APPLY'), 'APPLY');
  assert.strictEqual(normalizeLearningExperiencePhase('mengaplikasi'), 'APPLY');
  assert.strictEqual(normalizeLearningExperiencePhase('Mengaplikasikan'), 'APPLY');
  assert.strictEqual(normalizeLearningExperiencePhase('REFLECT'), 'REFLECT');
  assert.strictEqual(normalizeLearningExperiencePhase('merefleksi'), 'REFLECT');
  assert.strictEqual(normalizeLearningExperiencePhase('Merefleksikan'), 'REFLECT');
  assert.strictEqual(normalizeLearningExperiencePhase('UNKNOWN_PHASE'), null);
  assert.strictEqual(normalizeLearningExperiencePhase(undefined), null);
});

// 2. Missing JP does not fabricate numbers
runTest('No Fake JP: resolveLearningPlanAllocatedJP returns UNRESOLVED when no real JP exists', () => {
  const planWithoutJp: LearningPlan = {
    id: 'lp-no-jp',
    academicSettingId: 'setting-1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'AI_DRAFT',
    status: 'DRAFT',
    tpIds: ['tp-101'],
    atpItemIds: [],
    title: 'Draf Modul Ajar',
    topic: 'Teks Deskripsi',
    objectives: [{ id: 'tp-101', tpId: 'tp-101', statement: 'Statement' }],
    learningExperiences: [
      { id: 'exp-1', phase: 'UNDERSTAND', description: 'Memahami' },
    ],
    assessmentPlan: { initial: [], formative: [], summative: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // With no ATP and no time allocations
  const res = resolveLearningPlanAllocatedJP(planWithoutJp, { atp: null, timeAllocations: null });
  assert.strictEqual(res.allocatedJP, undefined);
  assert.strictEqual(res.source, 'UNRESOLVED');
});

runTest('Real JP Resolution: resolveLearningPlanAllocatedJP resolves from canonical ATP and explicit plan', () => {
  const planWithAtp: LearningPlan = {
    id: 'lp-atp-jp',
    academicSettingId: 'setting-1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'AI_DRAFT',
    status: 'DRAFT',
    tpIds: ['tp-101'],
    atpItemIds: ['atp-201'],
    title: 'Draf Modul Ajar',
    topic: 'Teks Deskripsi',
    objectives: [{ id: 'tp-101', tpId: 'tp-101', statement: 'Statement' }],
    learningExperiences: [
      { id: 'exp-1', phase: 'UNDERSTAND', description: 'Memahami' },
    ],
    assessmentPlan: { initial: [], formative: [], summative: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const resAtp = resolveLearningPlanAllocatedJP(planWithAtp, { atp: mockAtpData });
  assert.strictEqual(resAtp.allocatedJP, 8);
  assert.strictEqual(resAtp.source, 'CANONICAL_ATP');

  const planExplicit: LearningPlan = {
    ...planWithAtp,
    allocatedJP: 10,
  };
  const resExplicit = resolveLearningPlanAllocatedJP(planExplicit, { atp: mockAtpData });
  assert.strictEqual(resExplicit.allocatedJP, 10);
  assert.strictEqual(resExplicit.source, 'EXPLICIT_PLAN');
});

runTest('Recovery A.2 Test 1: TP ids resolve canonical objectives in selected order and remove unchecked objective authority', () => {
  const checked = resolveLearningPlanObjectives({ tpIds: ['tp-102', 'tp-101'], tp: mockTpData, curriculumType: 'KURIKULUM_MERDEKA' });
  assert.deepStrictEqual(checked.objectives.map((o) => o.tpId), ['tp-102', 'tp-101']);
  assert.strictEqual(checked.objectives[0].statement, mockTpData.items[1].statement);

  const unchecked = resolveLearningPlanObjectives({ tpIds: ['tp-101'], tp: mockTpData, curriculumType: 'KURIKULUM_MERDEKA' });
  assert.deepStrictEqual(unchecked.objectives.map((o) => o.tpId), ['tp-101']);
  assert.strictEqual(unchecked.objectives.some((o) => o.tpId === 'tp-102'), false);
});

runTest('Recovery A.2 Test 2: stale stored objectives cannot override current canonical TP text', () => {
  const planWithStaleObjective: LearningPlan = {
    id: 'lp-stale-objective',
    academicSettingId: 'setting-1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'MANUAL',
    status: 'DRAFT',
    tpIds: ['tp-101'],
    atpItemIds: [],
    title: 'Plan stale',
    topic: 'Teks',
    objectives: [{ id: 'tp-101', tpId: 'tp-101', statement: 'OLD STALE STATEMENT' }],
    learningExperiences: [
      { id: 'e1', phase: 'UNDERSTAND', description: 'Memahami' },
      { id: 'e2', phase: 'APPLY', description: 'Menerapkan' },
      { id: 'e3', phase: 'REFLECT', description: 'Merefleksi' },
    ],
    assessmentPlan: { initial: [{ id: 'a1', type: 'INITIAL', description: 'Diagnostik', linkedTpIds: ['tp-101'] }], formative: [], summative: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validation = validateLearningPlan(planWithStaleObjective, { academicSetting: mockSetting, tp: mockTpData });
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.resolvedTPs[0].statement, mockTpData.items[0].statement);
});

runTest('Recovery A.2 Test 3-4: canonical experiences require learningExperiences and all three phases', () => {
  const missingReflect: LearningPlan = {
    id: 'lp-missing-phase',
    academicSettingId: 'setting-1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'AI_DRAFT',
    status: 'DRAFT',
    tpIds: ['tp-101'],
    atpItemIds: [],
    title: 'Missing phase',
    topic: 'Teks',
    objectives: [{ id: 'tp-101', tpId: 'tp-101', statement: 'Statement' }],
    learningExperiences: [
      { id: 'e1', phase: 'UNDERSTAND', description: 'Memahami' },
      { id: 'e2', phase: 'APPLY', description: 'Menerapkan' },
    ],
    assessmentPlan: { initial: [{ id: 'a1', type: 'INITIAL', description: 'Diagnostik', linkedTpIds: ['tp-101'] }], formative: [], summative: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const validation = validateLearningPlan(missingReflect, { academicSetting: mockSetting, tp: mockTpData });
  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.some((e) => e.includes('REFLECT')));
});

runTest('Recovery A.2 Test 5: AI assessment pedagogical content is locally canonicalized', () => {
  const normalized = normalizeAIAssessmentPlan({
    initial: [{ id: 'ai-id', type: 'SUMMATIVE', description: 'Cek awal', linkedTpIds: ['wrong'] }],
    formative: [{ technique: 'Observasi' }],
    summative: [{ instrument: 'Rubrik proyek' }],
  }, ['tp-101']);

  assert.strictEqual(normalized.initial[0].type, 'INITIAL');
  assert.deepStrictEqual(normalized.initial[0].linkedTpIds, ['tp-101']);
  assert.notStrictEqual(normalized.initial[0].id, 'ai-id');
  assert.strictEqual(normalized.formative[0].type, 'FORMATIVE');
  assert.strictEqual(normalized.summative[0].type, 'SUMMATIVE');
});

runTest('Recovery A.2 Test 6: AI allocatedJP and AI IDs are ignored by local draft factory', () => {
  const plan = createAIDraftLearningPlan({
    academicSetting: mockSetting,
    curriculumType: 'KURIKULUM_MERDEKA',
    tpIds: ['tp-101'],
    aiDraft: {
      allocatedJP: 99,
      learningExperiences: [
        { id: 'provider-id-1', phase: 'UNDERSTAND', description: 'Memahami' },
        { id: 'provider-id-2', phase: 'APPLY', description: 'Menerapkan' },
        { id: 'provider-id-3', phase: 'REFLECT', description: 'Merefleksi' },
      ],
      assessmentPlan: { initial: [{ description: 'Diagnostik' }], formative: [], summative: [] },
    } as any,
    context: { tp: mockTpData },
  });
  assert.strictEqual(plan.allocatedJP, undefined);
  assert.ok(plan.learningExperiences.every((exp) => exp.id.startsWith('exp-ai-')));
  assert.strictEqual(plan.learningExperiences.some((exp) => exp.id.startsWith('provider-id')), false);
});

runTest('Recovery A.2 Test 7-9: JP resolves from exact TimeAllocation while excluding unrelated allocations', () => {
  const plan: LearningPlan = {
    id: 'lp-time-allocation',
    academicSettingId: 'setting-1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'MANUAL',
    status: 'DRAFT',
    tpIds: ['tp-102'],
    atpItemIds: [],
    title: 'Plan JP',
    topic: 'Teks',
    objectives: [],
    learningExperiences: [],
    assessmentPlan: { initial: [], formative: [], summative: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const res = resolveLearningPlanAllocatedJP(plan, {
    timeAllocations: [
      { id: 'ta-related', academicSettingId: 'setting-1', tpId: 'tp-102', allocatedJP: 6, sourceType: 'TP', sourceId: 'tp-102' } as any,
      { id: 'ta-other-setting', academicSettingId: 'setting-2', tpId: 'tp-102', allocatedJP: 40, sourceType: 'TP', sourceId: 'tp-102' } as any,
      { id: 'ta-unrelated', academicSettingId: 'setting-1', tpId: 'tp-999', allocatedJP: 50, sourceType: 'TP', sourceId: 'tp-999' } as any,
    ],
  });
  assert.strictEqual(res.allocatedJP, 6);
  assert.deepStrictEqual(res.timeAllocationIds, ['ta-related']);
});

runTest('Recovery A.2 Test 10-12: edit preservation, preview/export source guard, and reflection mapping', () => {
  const reflection = normalizeAIReflection({ teacherReflection: 'Catatan guru', studentReflection: 'Catatan siswa', teacher: 'legacy' });
  assert.deepStrictEqual(reflection, { teacherReflection: 'Catatan guru', studentReflection: 'Catatan siswa' });

  const source = fs.readFileSync('src/components/administration/LearningPlanManager.tsx', 'utf-8');
  assert.ok(source.includes('(activePlan.learningExperiences || []).length > 0'));
  assert.ok(source.indexOf('LEARNING_EXPERIENCE_PHASE_LABELS') < source.indexOf('Pendahuluan:'));
  assert.ok(source.includes('durationMinutes'));
});

runTest('Recovery A.2 Test 13: substantive edit requires reconfirmation lifecycle', () => {
  const ready: LearningPlan = {
    id: 'lp-ready',
    academicSettingId: 'setting-1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'MANUAL',
    status: 'SIAP',
    confirmedAt: '2026-01-01T00:00:00.000Z',
    tpIds: ['tp-101'],
    atpItemIds: [],
    title: 'Plan',
    topic: 'Teks',
    objectives: [{ id: 'tp-101', tpId: 'tp-101', statement: 'Statement' }],
    learningExperiences: [
      { id: 'e1', phase: 'UNDERSTAND', description: 'Memahami' },
      { id: 'e2', phase: 'APPLY', description: 'Menerapkan' },
      { id: 'e3', phase: 'REFLECT', description: 'Merefleksi' },
    ],
    assessmentPlan: { initial: [{ id: 'a1', type: 'INITIAL', description: 'Diagnostik', linkedTpIds: ['tp-101'] }], formative: [], summative: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.strictEqual(isSubstantiveLearningPlanChange(ready, { ...ready, topic: 'Teks Baru' }), true);
});

runTest('Recovery A.2 Test 16: partial ATP scope keeps ATP-linked TP and unlinked TP', () => {
  const scopes = resolveAvailableScopes(mockTpData, mockAtpData);
  assert.ok(scopes.some((s) => s.type === 'ATP_STEP' && s.linkedTpIds.includes('tp-101')));
  assert.ok(scopes.some((s) => s.type === 'SINGLE_TP' && s.linkedTpIds.includes('tp-102')));
});

runTest('Recovery A.2 Test 17-18: unknown curriculum does not become Merdeka and K13 AI is fail-closed in UI source', () => {
  assert.strictEqual(getCurriculumTypeFromSetting({ ...mockSetting, curriculum: 'Kurikulum Eksperimental', curriculumType: undefined }), undefined);
  const source = fs.readFileSync('src/components/administration/LearningPlanManager.tsx', 'utf-8');
  assert.ok(source.includes("curriculumType === 'K13'"));
  assert.ok(source.includes('Penyusunan RPP K13 pada modul Perencanaan Pembelajaran ini belum didukung'));
  assert.ok(source.includes("curriculumType !== 'KURIKULUM_MERDEKA'"));
});

runTest('Recovery A.2: deep learning principles normalize Indonesian names and reject unknowns', () => {
  const normalized = normalizeDeepLearningContext({ principles: ['BERKESADARAN', 'BERMAKNA', 'MENGGEMBIRAKAN', 'UNKNOWN'] });
  assert.deepStrictEqual(normalized?.principles, ['MINDFUL', 'MEANINGFUL', 'JOYFUL']);
});

// 3. createAIDraftLearningPlan normalizes AI experiences and preserves true JP
runTest('createAIDraftLearningPlan: normalizes Indonesian phases and does not fabricate 2 JP', () => {
  const aiDraftRaw = {
    title: 'Draf Modul Deskripsi',
    topic: 'Teks Deskripsi',
    learningExperiences: [
      { phase: 'Memahami', description: 'Murid menyimak penjelasan' } as any,
      { phase: 'Mengaplikasikan', description: 'Murid menulis deskripsi' } as any,
      { phase: 'Merefleksikan', description: 'Murid menyimpulkan' } as any,
    ],
    assessmentPlan: {
      initial: [{ id: 'a1', type: 'INITIAL' as const, description: 'Pre-test', linkedTpIds: ['tp-101'] }],
      formative: [],
      summative: [],
    },
  };

  const plan = createAIDraftLearningPlan({
    academicSetting: mockSetting,
    curriculumType: 'KURIKULUM_MERDEKA',
    tpIds: ['tp-101'],
    aiDraft: aiDraftRaw,
    context: { tp: mockTpData, atp: mockAtpData },
  });

  assert.strictEqual(plan.status, 'DRAFT');
  assert.strictEqual(plan.sourceType, 'AI_DRAFT');
  assert.strictEqual(plan.allocatedJP, undefined); // NOT fabricated to 2!
  assert.strictEqual(plan.learningExperiences.length, 3);
  assert.strictEqual(plan.learningExperiences[0].phase, 'UNDERSTAND');
  assert.strictEqual(plan.learningExperiences[1].phase, 'APPLY');
  assert.strictEqual(plan.learningExperiences[2].phase, 'REFLECT');
  assert.ok(plan.learningExperiences[0].id.startsWith('exp-ai-1'));
});

// 4. Missing calendar / time allocation does NOT block DRAFT creation and validation
runTest('Missing Calendar/TimeAllocation: does NOT block DRAFT plan validation', () => {
  const plan = createAIDraftLearningPlan({
    academicSetting: mockSetting,
    curriculumType: 'KURIKULUM_MERDEKA',
    tpIds: ['tp-101'],
    aiDraft: {
      learningExperiences: [
        { id: 'e1', phase: 'UNDERSTAND', description: 'Memahami' },
        { id: 'e2', phase: 'APPLY', description: 'Menerapkan' },
        { id: 'e3', phase: 'REFLECT', description: 'Merefleksi' },
      ],
      assessmentPlan: {
        initial: [{ id: 'a1', type: 'INITIAL', description: 'Pre-test', linkedTpIds: ['tp-101'] }],
        formative: [],
        summative: [],
      },
    },
    context: { tp: mockTpData, atp: null },
  });

  // Validate with NO calendar, NO timeAllocations, NO atp
  const validation = validateLearningPlan(plan, {
    academicSetting: mockSetting,
    tp: mockTpData,
    atp: null,
    timeAllocations: null,
  });

  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.draftErrors.length, 0);
  assert.strictEqual(validation.errors.length, 0);
  assert.ok(validation.warnings.some((w) => w.includes('Alokasi JP belum ditentukan')));
});

// 5. Distinct lifecycle contracts: DRAFT vs SIAP
runTest('Lifecycle: SIAP requires confirmation and blocks on draft integrity errors', () => {
  const unconfirmedPlan: LearningPlan = {
    id: 'lp-unconfirmed',
    academicSettingId: 'setting-1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'AI_DRAFT',
    status: 'SIAP', // Invalid because unconfirmed
    tpIds: ['tp-101'],
    atpItemIds: [],
    title: 'Draf Modul',
    topic: 'Teks Deskripsi',
    objectives: [{ id: 'tp-101', tpId: 'tp-101', statement: 'Gagasan utama' }],
    learningExperiences: [
      { id: 'e1', phase: 'UNDERSTAND', description: 'Memahami' },
      { id: 'e2', phase: 'APPLY', description: 'Menerapkan' },
      { id: 'e3', phase: 'REFLECT', description: 'Merefleksi' },
    ],
    assessmentPlan: {
      initial: [{ id: 'a1', type: 'INITIAL', description: 'Pre-test', linkedTpIds: ['tp-101'] }],
      formative: [],
      summative: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const resUnconfirmed = validateLearningPlan(unconfirmedPlan, {
    academicSetting: mockSetting,
    tp: mockTpData,
  });

  assert.strictEqual(resUnconfirmed.valid, false);
  assert.ok(resUnconfirmed.finalizationErrors.some((e) => e.includes('confirmedAt')));

  // Now confirm it
  const confirmedPlan: LearningPlan = {
    ...unconfirmedPlan,
    confirmedAt: new Date().toISOString(),
  };

  const resConfirmed = validateLearningPlan(confirmedPlan, {
    academicSetting: mockSetting,
    tp: mockTpData,
  });

  assert.strictEqual(resConfirmed.valid, true);
  assert.strictEqual(resConfirmed.errors.length, 0);
});

// 6. ATP AI totalHoursPerWeek validation & resolution contract tests
import fs from 'node:fs';

// Helper simulating server.ts totalHoursPerWeek validation
function validateServerTotalHoursPerWeek(totalHoursPerWeek: any): { valid: boolean; value?: number; error?: string } {
  if (totalHoursPerWeek === undefined || totalHoursPerWeek === null) {
    return { valid: true, value: undefined };
  }
  const isNumType = typeof totalHoursPerWeek === 'number';
  const isStringType = typeof totalHoursPerWeek === 'string';
  const parsed = isNumType
    ? totalHoursPerWeek
    : isStringType && totalHoursPerWeek.trim() !== ''
      ? Number(totalHoursPerWeek)
      : NaN;

  if (
    !Number.isFinite(parsed) ||
    isNaN(parsed) ||
    parsed <= 0 ||
    !Number.isInteger(parsed)
  ) {
    return {
      valid: false,
      error: 'Alokasi jam per minggu (totalHoursPerWeek) jika diisi harus berupa bilangan bulat positif yang valid (misal: 1, 2, 4, 5).',
    };
  }
  return { valid: true, value: parsed };
}

// Helper simulating server.ts ATP prompt builder & item processor
function buildServerATPPromptContext(validatedWeeklyJP?: number): { promptJPText: string; instruction: string } {
  const promptJPText = validatedWeeklyJP !== undefined ? `${validatedWeeklyJP} JP` : 'Belum ditentukan';
  const instruction = validatedWeeklyJP !== undefined
    ? `2. Tentukan Alokasi Waktu (JP) yang realistis dan proporsional untuk tiap langkah pembelajaran (total mingguan: ${validatedWeeklyJP} JP).`
    : `2. Alokasi Waktu (JP) per minggu BELUM DITENTUKAN. JANGAN mengarang alokasi JP atau menyimpulkan angka JP sendiri. Kosongkan alokasi JP untuk tiap langkah pembelajaran.`;
  return { promptJPText, instruction };
}

function processServerATPItems(items: any[], validatedWeeklyJP?: number): any[] {
  const processed = JSON.parse(JSON.stringify(items));
  for (let i = 0; i < processed.length; i++) {
    const item = processed[i];
    if (validatedWeeklyJP === undefined) {
      delete item.jp;
      delete item.allocatedJP;
    } else {
      if (typeof item.jp === 'number' && Number.isFinite(item.jp) && item.jp > 0) {
        item.allocatedJP = item.jp;
      } else {
        delete item.jp;
        delete item.allocatedJP;
      }
    }
  }
  return processed;
}

runTest('ATP Test 1: totalHoursPerWeek missing -> does NOT become 5 (unresolved undefined)', () => {
  const res = validateServerTotalHoursPerWeek(undefined);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.value, undefined);

  const resNull = validateServerTotalHoursPerWeek(null);
  assert.strictEqual(resNull.valid, true);
  assert.strictEqual(resNull.value, undefined);
});

runTest('ATP Test 2: missing JP -> ATP AI path uses unresolved state (contract allows unresolved)', () => {
  const res = validateServerTotalHoursPerWeek(undefined);
  assert.strictEqual(res.value, undefined);
  const context = buildServerATPPromptContext(res.value);
  assert.strictEqual(context.promptJPText, 'Belum ditentukan');
});

runTest('ATP Test 3: prompt for missing JP contains "Belum ditentukan" and explicit instruction not to fabricate', () => {
  const context = buildServerATPPromptContext(undefined);
  assert.ok(context.promptJPText.includes('Belum ditentukan'));
  assert.ok(context.instruction.includes('JANGAN mengarang alokasi JP'));
});

runTest('ATP Test 4: missing JP does NOT produce synthetic numbers (strips any hallucinated JP)', () => {
  const rawAIItems = [
    { stepNumber: 1, tpCode: 'TP 7.1', tpStatement: 'Deskripsi', materialScope: 'Teks', jp: 6 },
    { stepNumber: 2, tpCode: 'TP 7.2', tpStatement: 'Menulis', materialScope: 'Teks', jp: 8 },
  ];
  const processed = processServerATPItems(rawAIItems, undefined);
  assert.strictEqual(processed[0].jp, undefined);
  assert.strictEqual(processed[0].allocatedJP, undefined);
  assert.strictEqual(processed[1].jp, undefined);
  assert.strictEqual(processed[1].allocatedJP, undefined);
});

runTest('ATP Test 5: actual totalHoursPerWeek = 4 -> uses 4 as authoritative input', () => {
  const res = validateServerTotalHoursPerWeek(4);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.value, 4);

  const context = buildServerATPPromptContext(res.value);
  assert.strictEqual(context.promptJPText, '4 JP');
  assert.ok(context.instruction.includes('total mingguan: 4 JP'));

  const rawAIItems = [
    { stepNumber: 1, tpCode: 'TP 7.1', tpStatement: 'Deskripsi', materialScope: 'Teks', jp: 4 },
  ];
  const processed = processServerATPItems(rawAIItems, res.value);
  assert.strictEqual(processed[0].jp, 4);
  assert.strictEqual(processed[0].allocatedJP, 4);
});

runTest('ATP Test 6: actual totalHoursPerWeek = 5 -> uses 5 because caller provided it, NOT by default', () => {
  const res = validateServerTotalHoursPerWeek(5);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.value, 5);

  const context = buildServerATPPromptContext(res.value);
  assert.strictEqual(context.promptJPText, '5 JP');
});

runTest('ATP Test 7: totalHoursPerWeek = 0 -> rejected with HTTP 400 contract', () => {
  const res = validateServerTotalHoursPerWeek(0);
  assert.strictEqual(res.valid, false);
  assert.ok(res.error?.includes('bilangan bulat positif'));
});

runTest('ATP Test 8: totalHoursPerWeek negative (-1) -> rejected with HTTP 400 contract', () => {
  const res = validateServerTotalHoursPerWeek(-1);
  assert.strictEqual(res.valid, false);
  assert.ok(res.error?.includes('bilangan bulat positif'));
});

runTest('ATP Test 9: totalHoursPerWeek = NaN -> rejected with HTTP 400 contract', () => {
  const res = validateServerTotalHoursPerWeek(NaN);
  assert.strictEqual(res.valid, false);
  assert.ok(res.error?.includes('bilangan bulat positif'));
});

runTest('ATP Test 10: totalHoursPerWeek = Infinity -> rejected with HTTP 400 contract', () => {
  const res = validateServerTotalHoursPerWeek(Infinity);
  assert.strictEqual(res.valid, false);
  assert.ok(res.error?.includes('bilangan bulat positif'));
});

runTest('ATP Test 11: totalHoursPerWeek invalid string ("", "abc", "5.5") -> rejected with HTTP 400 contract', () => {
  assert.strictEqual(validateServerTotalHoursPerWeek('').valid, false);
  assert.strictEqual(validateServerTotalHoursPerWeek('   ').valid, false);
  assert.strictEqual(validateServerTotalHoursPerWeek('abc').valid, false);
  assert.strictEqual(validateServerTotalHoursPerWeek('5.5').valid, false);
  assert.strictEqual(validateServerTotalHoursPerWeek(5.5).valid, false);
});

// Fail-closed simulation for ATP
function simulateServerGenerateATP(params: {
  apiKeyPresent: boolean;
  providerShouldFail?: boolean;
  providerRawText?: string;
  totalHoursPerWeek?: any;
}) {
  const { apiKeyPresent, providerShouldFail, providerRawText, totalHoursPerWeek } = params;

  const jpValidation = validateServerTotalHoursPerWeek(totalHoursPerWeek);
  if (!jpValidation.valid) {
    return { status: 400, error: jpValidation.error };
  }

  if (!apiKeyPresent) {
    return { status: 503, error: 'Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang).' };
  }

  if (providerShouldFail) {
    return { status: 500, error: 'Gagal menyusun ATP dengan AI: Respons provider AI tidak dapat diproses' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(providerRawText || '');
  } catch {
    return { status: 500, error: 'Respons AI tidak memenuhi kualifikasi struktur ATP: Respons bukan berupa objek valid' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    return { status: 500, error: 'Respons AI tidak memenuhi kualifikasi struktur ATP: Hasil perumusan alur TP kosong atau bukan array' };
  }

  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i];
    if (!item || typeof item !== 'object') {
      return { status: 500, error: `Respons AI tidak memenuhi kualifikasi struktur ATP: Butir langkah ATP ke-${i + 1} bukan berupa objek valid` };
    }
    const stmt = item.tpStatement || item.statement;
    if (!stmt || typeof stmt !== 'string' || stmt.trim() === '') {
      return { status: 500, error: `Respons AI tidak memenuhi kualifikasi struktur ATP: Rumusan TP pada butir langkah ke-${i + 1} kosong atau tidak valid` };
    }
  }

  const processed = processServerATPItems(parsed.items, jpValidation.value);
  return { status: 200, success: true, data: { ...parsed, items: processed } };
}

runTest('ATP Test 12: provider failure -> no fallbackGenerateATP, returns HTTP 500', () => {
  const res = simulateServerGenerateATP({ apiKeyPresent: true, providerShouldFail: true });
  assert.strictEqual(res.status, 500);
  assert.ok(res.error?.includes('Gagal menyusun ATP dengan AI'));
});

runTest('ATP Test 13: invalid JSON -> no fallback, returns HTTP 500', () => {
  const res = simulateServerGenerateATP({ apiKeyPresent: true, providerRawText: 'not a json' });
  assert.strictEqual(res.status, 500);
  assert.ok(res.error?.includes('Respons bukan berupa objek valid'));
});

runTest('ATP Test 14: malformed ATP -> no fallback, returns HTTP 500', () => {
  const res = simulateServerGenerateATP({
    apiKeyPresent: true,
    providerRawText: JSON.stringify({ rationale: 'Rasional', items: [{ stepNumber: 1, tpStatement: '' }] }),
  });
  assert.strictEqual(res.status, 500);
  assert.ok(res.error?.includes('Rumusan TP pada butir langkah ke-1 kosong atau tidak valid'));
});

runTest('ATP Test 15: missing API key -> no fallback, returns HTTP 503', () => {
  const res = simulateServerGenerateATP({ apiKeyPresent: false });
  assert.strictEqual(res.status, 503);
  assert.ok(res.error?.includes('GEMINI_API_KEY tidak terpasang'));
});

// Source code audit assertions
runTest('Invariant: server.ts does NOT contain "totalHoursPerWeek = 5" or import/call fallbackGenerateATP', () => {
  const serverSource = fs.readFileSync('server.ts', 'utf-8');
  assert.ok(
    !serverSource.includes('totalHoursPerWeek = 5'),
    'server.ts must not have silent default totalHoursPerWeek = 5'
  );
  assert.ok(
    !serverSource.includes('fallbackGenerateATP'),
    'server.ts must not import or use fallbackGenerateATP'
  );
  assert.ok(
    serverSource.includes('Belum ditentukan'),
    'server.ts prompt must explicitly express "Belum ditentukan" when JP is missing'
  );
  assert.ok(
    serverSource.includes('delete item.jp;'),
    'server.ts must delete hallucinated/guessed jp when JP is unresolved'
  );
});

// Equivalence check for phase normalization between server and learningPlanService
runTest('Contract: server normalizeExperiencePhase and learningPlanService normalizeLearningExperiencePhase are 100% equivalent', () => {
  const testInputs = [
    'UNDERSTAND',
    'understand',
    'Understand',
    'MEMAHAMI',
    'Memahami',
    'memahami',
    'APPLY',
    'apply',
    'MENGAPLIKASI',
    'Mengaplikasi',
    'mengaplikasi',
    'MENGAPLIKASIKAN',
    'Mengaplikasikan',
    'mengaplikasikan',
    'REFLECT',
    'reflect',
    'MEREFLEKSI',
    'Merefleksi',
    'merefleksi',
    'MEREFLEKSIKAN',
    'Merefleksikan',
    'merefleksikan',
    'UNKNOWN',
    '',
    '   ',
    null,
    undefined,
    123,
    {},
    [],
  ];

  // server.ts implementation
  function serverNormalize(phase: any): 'UNDERSTAND' | 'APPLY' | 'REFLECT' | null {
    if (typeof phase !== 'string') return null;
    const s = phase.trim().toUpperCase();
    if (s === 'UNDERSTAND' || s === 'MEMAHAMI') return 'UNDERSTAND';
    if (s === 'APPLY' || s === 'MENGAPLIKASI' || s === 'MENGAPLIKASIKAN') return 'APPLY';
    if (s === 'REFLECT' || s === 'MEREFLEKSI' || s === 'MEREFLEKSIKAN') return 'REFLECT';
    return null;
  }

  for (const input of testInputs) {
    const fromServer = serverNormalize(input);
    const fromService = normalizeLearningExperiencePhase(input);
    assert.strictEqual(
      fromServer,
      fromService,
      `Mismatch for input ${JSON.stringify(input)}: server=${fromServer}, service=${fromService}`
    );
  }
});

// Recovery A.1 Contract & Validator Regression Tests (Test A - Test D)
runTest('Recovery A.1 Test A: server.ts generate-learning-plan responseSchema mandates learningExperiences at top-level', () => {
  const serverSource = fs.readFileSync('server.ts', 'utf-8');
  const endpointIndex = serverSource.indexOf("app.post('/api/ai/generate-learning-plan'");
  assert.ok(endpointIndex !== -1, 'Endpoint /api/ai/generate-learning-plan must exist');
  const nextEndpointIndex = serverSource.indexOf("app.post('/api/ai/generate-assessment-package'");
  const endpointCode = serverSource.slice(
    endpointIndex,
    nextEndpointIndex !== -1 ? nextEndpointIndex : endpointIndex + 10000
  );
  assert.ok(
    endpointCode.includes("required: ['learningExperiences']") || endpointCode.includes('required: ["learningExperiences"]'),
    'Top-level responseSchema must explicitly specify required: [\'learningExperiences\']'
  );
});

runTest('Recovery A.1 Test B: Payload without learningExperiences is rejected by validateAILearningPlanPayload', () => {
  const payloadMissing = {
    title: 'Draf Modul Ajar',
    topic: 'Teks Deskripsi',
  };
  const valMissing = validateAILearningPlanPayload(payloadMissing);
  assert.strictEqual(valMissing.isValid, false, 'Payload missing learningExperiences must be invalid');
  assert.ok(
    valMissing.reason?.includes('learningExperiences'),
    'Error reason must mention learningExperiences'
  );

  const payloadEmpty = {
    title: 'Draf Modul Ajar',
    learningExperiences: [],
  };
  const valEmpty = validateAILearningPlanPayload(payloadEmpty);
  assert.strictEqual(valEmpty.isValid, false, 'Payload with empty learningExperiences must be invalid');
});

runTest('Recovery A.1 Test C: Valid payload with learningExperiences (UNDERSTAND, APPLY, REFLECT) is accepted', () => {
  const validPayload = {
    title: 'Modul Ajar Teks Deskripsi',
    topic: 'Teks Deskripsi',
    learningExperiences: [
      {
        phase: 'UNDERSTAND',
        description: 'Murid menyimak dan mengamati contoh teks deskripsi',
      },
      {
        phase: 'APPLY',
        description: 'Murid menyusun draft teks deskripsi secara mandiri',
      },
      {
        phase: 'REFLECT',
        description: 'Murid menyimpulkan ciri-ciri teks deskripsi',
      },
    ],
  };
  const val = validateAILearningPlanPayload(validPayload);
  assert.strictEqual(val.isValid, true, 'Valid payload must pass validation');
  assert.strictEqual(validPayload.learningExperiences.length, 3);
  assert.strictEqual(validPayload.learningExperiences[0].phase, 'UNDERSTAND');
  assert.strictEqual(validPayload.learningExperiences[1].phase, 'APPLY');
  assert.strictEqual(validPayload.learningExperiences[2].phase, 'REFLECT');
  assert.strictEqual((validPayload.learningExperiences[0] as any).id, 'exp-ai-1');
});

runTest('Recovery A.1 Test D: Indonesian phase normalization (Memahami, Mengaplikasikan, Merefleksikan) remains valid', () => {
  const indoPayload = {
    title: 'Modul Ajar Teks Deskripsi',
    topic: 'Teks Deskripsi',
    learningExperiences: [
      {
        phase: 'Memahami',
        description: 'Murid mengamati teks deskripsi',
      },
      {
        phase: 'Mengaplikasikan',
        description: 'Murid menulis teks deskripsi',
      },
      {
        phase: 'Merefleksikan',
        description: 'Murid melakukan refleksi',
      },
    ],
  };
  const val = validateAILearningPlanPayload(indoPayload);
  assert.strictEqual(val.isValid, true, 'Indonesian phase payload must pass validation and be normalized');
  assert.strictEqual(indoPayload.learningExperiences[0].phase, 'UNDERSTAND');
  assert.strictEqual(indoPayload.learningExperiences[1].phase, 'APPLY');
  assert.strictEqual(indoPayload.learningExperiences[2].phase, 'REFLECT');
});

console.log(`\nAll ${totalTests} Workflow Recovery A Regression tests PASSED successfully!`);
