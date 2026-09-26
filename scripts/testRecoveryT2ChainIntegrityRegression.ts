/**
 * Recovery T2 Canonical Readiness & Semantic Invalidation Regression
 */

const memoryStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = value;
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
    },
  };
}

import assert from 'assert';
import { APP_BUILD_ID } from '../src/config/buildInfo';
import {
  classifyCPAnalysisChange,
  classifyCPChange,
  classifyATPChange,
  classifyAssessmentCriteriaChange,
  classifyTPChange,
  getChangedAssessmentCriterionIds,
  getChangedTPItemIds,
  validateATPDataWorkflow,
  validateATPReferences,
  validateKKTPData,
} from '../src/services/cpWorkflowService';
import { validateLearningPlan } from '../src/services/learningPlanService';
import {
  deriveAutoDraftAssessmentPlan,
  generateAutoDraftPlansFromCanonicalContext,
  validateAssessmentPlan,
} from '../src/services/assessmentPlanService';
import { validateAssessmentPackage } from '../src/services/assessmentPackageService';
import { resolveAssessmentGenerationSpec } from '../src/services/assessmentGenerationSpecService';
import { validateDocumentRequirements } from '../src/services/documentEngine';
import {
  loadAppStorage,
  saveAppStorage,
  saveCP,
  saveCPAnalysis,
  saveTP,
  saveATP,
  saveAssessmentCriteria,
  saveAssessmentCriterion,
  deleteAssessmentCriterion,
  saveAssessmentPlan,
  deleteAssessmentPlan,
} from '../src/services/storage';
import {
  AcademicSetting,
  AppStorageState,
  AssessmentCriterion,
  AssessmentPackage,
  AssessmentPlan,
  ATPData,
  CPAnalysisData,
  CPData,
  LearningPlan,
  TPData,
} from '../src/types';

const setting: AcademicSetting = {
  id: 'set-t2',
  profileId: 'prof-t2',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  academicYear: '2026/2027',
  semester: '1 (Ganjil)',
  level: 'SMP',
  grade: 'Kelas 7',
  subject: 'Matematika',
  phase: 'D',
  updatedAt: '2026-09-22T00:00:00.000Z',
};

const readyTP: TPData = {
  id: 'tp-t2',
  academicSettingId: setting.id,
  workspaceId: 'ws-t2',
  subjectCode: 'MAT',
  phase: 'D',
  workflowStatus: 'SIAP',
  needsReview: false,
  updatedAt: '2026-09-22T01:00:00.000Z',
  items: [
    {
      id: 'tp-item-1',
      code: 'TP.1',
      statement: 'Peserta didik memahami operasi bilangan bulat.',
      competence: 'Memahami',
      contentScope: 'Bilangan bulat',
      order: 1,
    },
  ],
};

const readyATP: ATPData = {
  id: 'atp-t2',
  academicSettingId: setting.id,
  workspaceId: 'ws-t2',
  tpId: readyTP.id,
  subjectCode: 'MAT',
  phase: 'D',
  workflowStatus: 'SIAP',
  needsReview: false,
  basedOnTpUpdatedAt: readyTP.updatedAt,
  updatedAt: '2026-09-22T02:00:00.000Z',
  items: [
    {
      id: 'atp-item-1',
      stepNumber: 1,
      tpId: 'tp-item-1',
      tpCode: 'TP.1',
      tpStatement: 'Peserta didik memahami operasi bilangan bulat.',
      allocatedJP: 4,
      jp: 4,
    },
  ],
};

const readyCriterion: AssessmentCriterion = {
  id: 'crit-t2',
  academicSettingId: setting.id,
  workspaceId: 'ws-t2',
  tpId: 'tp-item-1',
  description: 'Menjelaskan operasi bilangan bulat dengan benar.',
  approach: 'deskripsi',
  indicators: ['Menjelaskan operasi penjumlahan dan pengurangan bilangan bulat.'],
  levels: [
    { level: 'Baik', label: 'Baik', description: 'Mampu menjelaskan dengan tepat.' },
  ],
  workflowStatus: 'SIAP',
  needsReview: false,
  updatedAt: '2026-09-22T03:00:00.000Z',
};

const readyLearningPlan: LearningPlan = {
  id: 'lp-t2',
  academicSettingId: setting.id,
  curriculumType: 'KURIKULUM_MERDEKA',
  title: 'Rencana Pembelajaran TP.1',
  status: 'SIAP',
  sourceType: 'MANUAL',
  topic: 'Bilangan bulat',
  allocatedJP: 4,
  tpIds: ['tp-item-1'],
  atpItemIds: ['atp-item-1'],
  objectives: [{ id: 'obj-1', tpId: 'tp-item-1', code: 'TP.1', statement: 'Memahami operasi bilangan bulat.' }],
  learningSteps: {
    core: [{ id: 'act-1', title: 'Latihan', description: 'Diskusi dan latihan.', durationMinutes: 160 }],
  },
  assessmentPlan: {
    formative: [{ id: 'assess-1', type: 'FORMATIVE', linkedTpIds: ['tp-item-1'], description: 'Cek pemahaman.' }],
  },
  resources: [{ id: 'res-1', title: 'Buku siswa' }],
  createdAt: '2026-09-22T04:00:00.000Z',
  updatedAt: '2026-09-22T04:00:00.000Z',
  confirmedAt: '2026-09-22T04:30:00.000Z',
};

const readyAssessmentPlan: AssessmentPlan = {
  id: 'ap-t2',
  academicSettingId: setting.id,
  workspaceId: 'ws-t2',
  title: 'Asesmen TP.1',
  purpose: 'FORMATIVE',
  timing: 'POST',
  scopeType: 'TP',
  tpIds: ['tp-item-1'],
  criterionIds: ['crit-t2'],
  instruments: [{ id: 'inst-ref-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  workflowStatus: 'SIAP',
  needsReview: false,
  createdAt: '2026-09-22T05:00:00.000Z',
  updatedAt: '2026-09-22T05:00:00.000Z',
  confirmedAt: '2026-09-22T05:30:00.000Z',
};

const readyPackage: AssessmentPackage = {
  id: 'pkg-t2',
  assessmentPlanId: readyAssessmentPlan.id,
  academicSettingId: setting.id,
  workspaceId: 'ws-t2',
  title: 'Perangkat Asesmen TP.1',
  blueprintItems: [
    {
      id: 'bp-1',
      objectiveRefId: 'tp-item-1',
      criterionId: 'crit-t2',
      instrumentType: 'WRITTEN_TEST',
      instrumentItemIds: ['wi-1'],
      order: 1,
    },
  ],
  instruments: [
    {
      id: 'inst-1',
      type: 'WRITTEN_TEST',
      title: 'Tes Tertulis',
      instructions: 'Jawab pertanyaan berikut.',
      items: [
        {
          id: 'wi-1',
          blueprintItemId: 'bp-1',
          itemType: 'SHORT_ANSWER',
          prompt: 'Jelaskan operasi bilangan bulat.',
          order: 1,
        },
      ],
    },
  ],
  answerKeys: [],
  scoringGuides: [],
  rubrics: [],
  workflowStatus: 'SIAP',
  needsReview: false,
  createdAt: '2026-09-22T06:00:00.000Z',
  updatedAt: '2026-09-22T06:00:00.000Z',
};

const reviewedTP: TPData = { ...readyTP, needsReview: true, reviewReason: 'CP berubah.' };
const staleATP: ATPData = { ...readyATP, basedOnTpUpdatedAt: '2026-09-21T00:00:00.000Z' };
const reviewedCriterion: AssessmentCriterion = { ...readyCriterion, needsReview: true, reviewReason: 'TP berubah.' };
const reviewedPlan: AssessmentPlan = { ...readyAssessmentPlan, needsReview: true, reviewReason: 'KKTP berubah.' };

assert.strictEqual(APP_BUILD_ID, 'T2.1.1-20260922-1', 'T2.1.1 build fingerprint must be set');

assert.strictEqual(
  classifyTPChange(readyTP, { ...readyTP, workflowStatus: 'DRAFT', needsReview: true, reviewReason: 'Sync status only' }),
  'NON_SUBSTANTIVE',
  'TP status/review-only save must be non-substantive'
);
assert.strictEqual(
  classifyTPChange(readyTP, { ...readyTP, items: [{ ...readyTP.items[0], statement: 'Peserta didik menerapkan operasi bilangan bulat.' }] }),
  'SUBSTANTIVE',
  'TP pedagogical content change must be substantive'
);
assert.strictEqual(
  classifyATPChange(readyATP, { ...readyATP, workflowStatus: 'DRAFT', reviewReason: 'Status sync' }),
  'NON_SUBSTANTIVE',
  'ATP status-only save must be non-substantive'
);
assert.strictEqual(
  classifyAssessmentCriteriaChange([readyCriterion], [{ ...readyCriterion, indicators: ['Indikator substantif baru.'] }]),
  'SUBSTANTIVE',
  'KKTP criteria content change must be substantive'
);

assert.strictEqual(validateATPReferences(readyATP, reviewedTP).isSiap, false, 'ATP must reject TP that still needs review');
assert.strictEqual(validateATPReferences(staleATP, readyTP).isSiap, false, 'ATP must reject stale basedOnTpUpdatedAt');
assert.strictEqual(validateKKTPData([readyCriterion], reviewedTP, setting).isSiap, false, 'KKTP must reject TP that still needs review');

assert.strictEqual(
  validateLearningPlan(readyLearningPlan, { academicSetting: setting, tp: reviewedTP, atp: readyATP }).isValid,
  false,
  'LearningPlan must reject upstream TP that still needs review'
);
assert.strictEqual(
  validateLearningPlan(readyLearningPlan, { academicSetting: setting, tp: readyTP, atp: staleATP }).isValid,
  false,
  'LearningPlan must reject stale ATP runtime validation'
);
assert.strictEqual(
  validateAssessmentPlan(readyAssessmentPlan, {
    academicSetting: setting,
    tp: reviewedTP,
    assessmentCriteria: [readyCriterion],
  }).valid,
  false,
  'AssessmentPlan must reject TP that still needs review'
);
assert.strictEqual(
  validateAssessmentPlan(readyAssessmentPlan, {
    academicSetting: setting,
    tp: readyTP,
    assessmentCriteria: [reviewedCriterion],
  }).valid,
  false,
  'AssessmentPlan must reject KKTP that still needs review'
);
assert.strictEqual(
  validateAssessmentPackage(readyPackage, {
    academicSetting: setting,
    assessmentPlan: reviewedPlan,
    tp: readyTP,
    assessmentCriteria: [readyCriterion],
  }).valid,
  false,
  'AssessmentPackage must reject parent AssessmentPlan that still needs review'
);
assert.strictEqual(
  validateAssessmentPackage(readyPackage, {
    academicSetting: setting,
    assessmentPlan: readyAssessmentPlan,
    tp: readyTP,
    assessmentCriteria: [reviewedCriterion],
  }).valid,
  false,
  'AssessmentPackage must reject KKTP that still needs review'
);

const readyCP: CPData = {
  id: 'cp-t21',
  academicSettingId: setting.id,
  cpId: 'cp-src-t21',
  cpVersion: 'v1',
  regulationIds: ['reg-1'],
  generalDescription: 'Capaian pembelajaran fase D untuk bilangan.',
  source: {
    id: 'src-cp',
    title: 'CP Matematika',
    institution: 'Kemdikbud',
    documentYear: '2026',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    verificationStatus: 'VERIFIED',
    versionCode: 'v1',
  },
  elements: [{ id: 'el-1', name: 'Bilangan', content: 'Memahami dan menerapkan bilangan bulat.' }],
  updatedAt: '2026-09-22T00:00:00.000Z',
};

const readyAnalysis: CPAnalysisData = {
  id: 'analysis-t21',
  academicSettingId: setting.id,
  cpId: readyCP.id,
  cpVersion: readyCP.cpVersion,
  basedOnCpUpdatedAt: readyCP.updatedAt,
  items: [{
    id: 'analysis-item-1',
    elementId: 'el-1',
    elementName: 'Bilangan',
    cpCompetence: 'Memahami',
    materialScope: 'Bilangan bulat',
    meaningfulUnderstanding: 'Bilangan digunakan untuk menyatakan kuantitas.',
    suggestedTp: 'Memahami operasi bilangan bulat.',
    order: 1,
  }],
  updatedAt: '2026-09-22T00:10:00.000Z',
};

function seedState(overrides: Partial<AppStorageState> = {}) {
  saveAppStorage({
    version: 3,
    profiles: [],
    schools: [],
    workspaces: [{ id: 'ws-t2', profileId: 'prof-t2', academicSettingId: setting.id, name: 'WS', createdAt: 't0', updatedAt: 't0' }],
    academicSettings: [setting],
    cps: [],
    cpAnalyses: [],
    tps: [],
    atps: [],
    documents: [],
    students: [],
    academicCalendars: [],
    effectiveDays: [],
    timeAllocations: [],
    attendanceSessions: [],
    attendanceRecords: [],
    assessmentCriteria: [],
    assessments: [],
    assessmentResults: [],
    remedialRecords: [],
    enrichmentRecords: [],
    k13Analyses: [],
    k13KKMs: [],
    learningPlans: [],
    assessmentPlans: [],
    assessmentPackages: [],
    ...overrides,
  } as AppStorageState);
}

assert.strictEqual(classifyCPChange(readyCP, { ...readyCP, updatedAt: 'metadata-only' }), 'NON_SUBSTANTIVE', 'CP timestamp-only change is non-substantive');
assert.strictEqual(classifyCPChange(readyCP, { ...readyCP, generalDescription: 'Capaian pembelajaran fase D berubah.' }), 'SUBSTANTIVE', 'CP text change is substantive');
assert.strictEqual(classifyCPAnalysisChange(readyAnalysis, { ...readyAnalysis, generatedAt: 'metadata-only' }), 'NON_SUBSTANTIVE', 'CP Analysis metadata-only change is non-substantive');
assert.strictEqual(classifyCPAnalysisChange(readyAnalysis, { ...readyAnalysis, items: [{ ...readyAnalysis.items[0], materialScope: 'Bilangan rasional' }] }), 'SUBSTANTIVE', 'CP Analysis material scope change is substantive');

seedState({ cps: [readyCP], cpAnalyses: [readyAnalysis], tps: [readyTP] });
saveCP({ ...readyCP, updatedAt: 'metadata-only' });
let state = loadAppStorage();
assert.strictEqual(state.cps[0].updatedAt, readyCP.updatedAt, 'CP no-op preserves updatedAt');
assert.strictEqual(state.cpAnalyses[0].needsReview, undefined, 'CP no-op does not mark CPAnalysis review');
assert.strictEqual(state.tps[0].needsReview, false, 'CP no-op does not mark TP review');

saveCP({ ...readyCP, generalDescription: 'Capaian pembelajaran fase D berubah.' });
state = loadAppStorage();
assert.strictEqual(state.cpAnalyses[0].needsReview, true, 'CP substantive change marks CPAnalysis review');
assert.strictEqual(state.tps[0].needsReview, true, 'CP substantive change marks TP review');

seedState({ cpAnalyses: [readyAnalysis], tps: [readyTP] });
saveCPAnalysis({ ...readyAnalysis, generatedAt: 'metadata-only' });
state = loadAppStorage();
assert.strictEqual(state.cpAnalyses[0].updatedAt, readyAnalysis.updatedAt, 'CP Analysis no-op preserves updatedAt');
assert.strictEqual(state.tps[0].needsReview, false, 'CP Analysis no-op does not mark TP review');

saveCPAnalysis({ ...readyAnalysis, items: [{ ...readyAnalysis.items[0], cpCompetence: 'Menerapkan' }] });
state = loadAppStorage();
assert.strictEqual(state.tps[0].needsReview, true, 'CP Analysis substantive change marks TP review');

const tpThree: TPData = {
  ...readyTP,
  items: [
    readyTP.items[0],
    { ...readyTP.items[0], id: 'tp-item-2', code: 'TP.2', statement: 'Peserta didik memahami pecahan.', order: 2 },
    { ...readyTP.items[0], id: 'tp-item-3', code: 'TP.3', statement: 'Peserta didik memahami rasio.', order: 3 },
  ],
};
const changedTpOne: TPData = {
  ...tpThree,
  items: tpThree.items.map((item) => item.id === 'tp-item-1' ? { ...item, statement: 'Peserta didik menerapkan operasi bilangan bulat.' } : item),
};
assert.deepStrictEqual([...getChangedTPItemIds(tpThree, changedTpOne)], ['tp-item-1'], 'Only substantively changed TP item is returned');

const lpA = { ...readyLearningPlan, id: 'lp-a', tpIds: ['tp-item-1'], atpItemIds: ['atp-item-1'] };
const lpB = { ...readyLearningPlan, id: 'lp-b', tpIds: ['tp-item-3'], atpItemIds: ['atp-item-3'] };
const lpC = { ...readyLearningPlan, id: 'lp-c', tpIds: ['tp-item-3'], atpItemIds: [] };
const lpD = { ...readyLearningPlan, id: 'lp-d', tpIds: ['tp-item-1'], atpItemIds: [] };
const critA = { ...readyCriterion, id: 'crit-a', tpId: 'tp-item-1' };
const critB = { ...readyCriterion, id: 'crit-b', tpId: 'tp-item-3' };
const planA = { ...readyAssessmentPlan, id: 'plan-a', tpIds: ['tp-item-1'], criterionIds: ['crit-a'] };
const planB = { ...readyAssessmentPlan, id: 'plan-b', tpIds: ['tp-item-3'], criterionIds: ['crit-b'] };
seedState({
  tps: [tpThree],
  atps: [{ ...readyATP, items: [{ ...readyATP.items[0], tpId: 'tp-item-1' }] }],
  learningPlans: [lpA, lpB, lpC, lpD],
  assessmentCriteria: [critA, critB],
  assessmentPlans: [planA, planB],
  assessmentPackages: [
    { ...readyPackage, id: 'pkg-a', assessmentPlanId: 'plan-a', blueprintItems: [{ ...readyPackage.blueprintItems[0], objectiveRefId: 'tp-item-1', criterionId: 'crit-a' }] },
    { ...readyPackage, id: 'pkg-b', assessmentPlanId: 'plan-b', blueprintItems: [{ ...readyPackage.blueprintItems[0], objectiveRefId: 'tp-item-3', criterionId: 'crit-b' }] },
  ],
});
saveTP(changedTpOne);
state = loadAppStorage();
assert.strictEqual(state.learningPlans.find((p) => p.id === 'lp-a')?.status, 'PERLU_DILENGKAPI', 'Changed TP invalidates ATP-linked LearningPlan A');
assert.strictEqual(state.learningPlans.find((p) => p.id === 'lp-b')?.status, 'PERLU_DILENGKAPI', 'Changed TP invalidates ATP-linked LearningPlan B via stale ATP');
assert.strictEqual(state.learningPlans.find((p) => p.id === 'lp-c')?.status, 'SIAP', 'Unchanged TP leaves TP-only LearningPlan C intact');
assert.strictEqual(state.learningPlans.find((p) => p.id === 'lp-d')?.status, 'PERLU_DILENGKAPI', 'Changed TP invalidates matching TP-only LearningPlan D');
assert.strictEqual(state.assessmentCriteria.find((c) => c.id === 'crit-a')?.needsReview, true, 'Changed TP invalidates matching KKTP');
assert.strictEqual(state.assessmentCriteria.find((c) => c.id === 'crit-b')?.needsReview, false, 'Unchanged TP leaves unrelated KKTP intact');
assert.strictEqual(state.assessmentPlans.find((p) => p.id === 'plan-a')?.workflowStatus, 'PERLU_DILENGKAPI', 'Changed TP invalidates matching AssessmentPlan');
assert.strictEqual(state.assessmentPlans.find((p) => p.id === 'plan-b')?.workflowStatus, 'SIAP', 'Unchanged TP leaves unrelated AssessmentPlan intact');
assert.strictEqual(state.assessmentPackages.find((p) => p.id === 'pkg-a')?.workflowStatus, 'PERLU_DILENGKAPI', 'Changed TP invalidates matching package');
assert.strictEqual(state.assessmentPackages.find((p) => p.id === 'pkg-b')?.workflowStatus, 'SIAP', 'Unchanged TP leaves unrelated package intact');

seedState({ tps: [tpThree], learningPlans: [lpA], assessmentCriteria: [critA], assessmentPlans: [planA], assessmentPackages: [readyPackage] });
saveTP({ ...tpThree, workflowStatus: 'DRAFT', needsReview: true, reviewReason: 'status only', basedOnCpUpdatedAt: 'lineage-only' });
state = loadAppStorage();
assert.strictEqual(state.tps[0].updatedAt, tpThree.updatedAt, 'TP status-only save preserves updatedAt');
assert.strictEqual(state.learningPlans[0].status, 'SIAP', 'TP status-only save does not invalidate LearningPlan');
assert.strictEqual(state.assessmentCriteria[0].needsReview, false, 'TP status-only save does not invalidate KKTP');
assert.strictEqual(state.assessmentPlans[0].workflowStatus, 'SIAP', 'TP status-only save does not invalidate AssessmentPlan');
assert.strictEqual(state.assessmentPackages[0].workflowStatus, 'SIAP', 'TP status-only save does not invalidate package');

assert.strictEqual(validateATPDataWorkflow(staleATP, readyTP).isSiap, false, 'ATP validator blocks stale lineage timestamp');
seedState({ tps: [readyTP], atps: [staleATP] });
saveATP({ ...staleATP, rationale: 'ordinary save' });
state = loadAppStorage();
assert.strictEqual(state.atps[0].basedOnTpUpdatedAt, staleATP.basedOnTpUpdatedAt, 'Ordinary ATP save does not refresh lineage timestamp');
assert.strictEqual(validateATPDataWorkflow({ ...readyATP, needsReview: false, basedOnTpUpdatedAt: readyTP.updatedAt }, readyTP).isSiap, true, 'Explicit confirmation candidate with current lineage can become SIAP');

assert.strictEqual(validateKKTPData([readyCriterion], { ...readyTP, workflowStatus: 'DRAFT' }, setting).isSiap, false, 'KKTP blocks DRAFT TP');
assert.strictEqual(validateKKTPData([readyCriterion], { ...readyTP, workflowStatus: 'PERLU_DILENGKAPI' }, setting).isSiap, false, 'KKTP blocks PERLU_DILENGKAPI TP');
assert.strictEqual(validateKKTPData([readyCriterion], reviewedTP, setting).isSiap, false, 'KKTP blocks TP needsReview');
assert.strictEqual(validateKKTPData([readyCriterion], readyTP, setting).isSiap, true, 'KKTP allows SIAP TP with valid criteria');

assert.deepStrictEqual([...getChangedAssessmentCriterionIds([critA, critB], [{ ...critA, indicators: ['Substantive new indicator'] }, critB])], ['crit-a'], 'Only substantively changed criterion is returned');
seedState({ assessmentCriteria: [critA, critB], assessmentPlans: [planA, planB], assessmentPackages: [
  { ...readyPackage, id: 'pkg-a', assessmentPlanId: 'plan-a', blueprintItems: [{ ...readyPackage.blueprintItems[0], criterionId: 'crit-a' }] },
  { ...readyPackage, id: 'pkg-b', assessmentPlanId: 'plan-b', blueprintItems: [{ ...readyPackage.blueprintItems[0], criterionId: 'crit-b' }] },
] });
saveAssessmentCriteria([{ ...critA, indicators: ['Substantive new indicator'] }, critB]);
state = loadAppStorage();
assert.strictEqual(state.assessmentPlans.find((p) => p.id === 'plan-a')?.workflowStatus, 'PERLU_DILENGKAPI', 'Changed KKTP invalidates matching AssessmentPlan');
assert.strictEqual(state.assessmentPlans.find((p) => p.id === 'plan-b')?.workflowStatus, 'SIAP', 'Unchanged KKTP leaves unrelated AssessmentPlan intact');
assert.strictEqual(state.assessmentPackages.find((p) => p.id === 'pkg-a')?.workflowStatus, 'PERLU_DILENGKAPI', 'Changed KKTP invalidates matching package');
assert.strictEqual(state.assessmentPackages.find((p) => p.id === 'pkg-b')?.workflowStatus, 'SIAP', 'Unchanged KKTP leaves unrelated package intact');

seedState({ assessmentCriteria: [critA], assessmentPlans: [planA], assessmentPackages: [readyPackage] });
saveAssessmentCriterion({ ...critA, indicators: ['Changed through single save'] });
state = loadAppStorage();
assert.strictEqual(state.assessmentPlans[0].workflowStatus, 'PERLU_DILENGKAPI', 'saveAssessmentCriterion uses canonical invalidation path');
seedState({ assessmentCriteria: [critA], assessmentPlans: [planA], assessmentPackages: [readyPackage] });
deleteAssessmentCriterion('crit-a');
state = loadAppStorage();
assert.strictEqual(state.assessmentPlans[0].workflowStatus, 'PERLU_DILENGKAPI', 'deleteAssessmentCriterion uses canonical invalidation path');

assert.strictEqual(validateAssessmentPlan(readyAssessmentPlan, { academicSetting: setting, tp: readyTP }).valid, false, 'AssessmentPlan blocks missing criteria source');
assert.strictEqual(validateAssessmentPlan(readyAssessmentPlan, { academicSetting: setting, tp: readyTP, assessmentCriteria: [{ ...readyCriterion, workflowStatus: 'DRAFT' }] }).valid, false, 'AssessmentPlan blocks DRAFT criterion');
assert.strictEqual(validateAssessmentPlan(readyAssessmentPlan, { academicSetting: setting, tp: readyTP, assessmentCriteria: [reviewedCriterion] }).valid, false, 'AssessmentPlan blocks criterion needsReview');

assert.strictEqual(generateAutoDraftPlansFromCanonicalContext({ academicSetting: setting, tp: { ...readyTP, workflowStatus: 'DRAFT' }, existingPlans: [] }).length, 0, 'Auto-draft service blocks DRAFT TP');
assert.strictEqual(generateAutoDraftPlansFromCanonicalContext({ academicSetting: setting, tp: reviewedTP, existingPlans: [] }).length, 0, 'Auto-draft service blocks TP needsReview');
assert.strictEqual(generateAutoDraftPlansFromCanonicalContext({ academicSetting: setting, tp: readyTP, assessmentCriteria: [readyCriterion], existingPlans: [] })[0]?.workflowStatus, 'DRAFT', 'Auto-draft service creates DRAFT only when TP is ready');
assert.strictEqual(deriveAutoDraftAssessmentPlan({ academicSetting: setting, tp: reviewedTP }).status, 'CANNOT_DRAFT', 'deriveAutoDraftAssessmentPlan blocks TP needsReview');

seedState({ assessmentPlans: [readyAssessmentPlan], assessmentPackages: [readyPackage] });
saveAssessmentPlan({ ...readyAssessmentPlan, timing: 'DURING' });
state = loadAppStorage();
assert.strictEqual(state.assessmentPackages[0].workflowStatus, 'PERLU_DILENGKAPI', 'Substantive AssessmentPlan edit invalidates dependent package');
seedState({ assessmentPlans: [readyAssessmentPlan], assessmentPackages: [readyPackage] });
deleteAssessmentPlan(readyAssessmentPlan.id);
state = loadAppStorage();
assert.strictEqual(state.assessmentPackages[0].workflowStatus, 'PERLU_DILENGKAPI', 'Deleting AssessmentPlan preserves and invalidates dependent package');

assert.strictEqual(resolveAssessmentGenerationSpec({ assessmentPlan: reviewedPlan, academicSetting: setting, tp: readyTP, assessmentCriteria: [readyCriterion] }).resolution.status, 'BLOCKED', 'GenerationSpec blocks AssessmentPlan needsReview');
assert.strictEqual(resolveAssessmentGenerationSpec({ assessmentPlan: readyAssessmentPlan, academicSetting: setting, tp: { ...readyTP, workflowStatus: 'DRAFT' }, assessmentCriteria: [readyCriterion] }).resolution.status, 'BLOCKED', 'GenerationSpec blocks TP not SIAP');
assert.strictEqual(resolveAssessmentGenerationSpec({ assessmentPlan: readyAssessmentPlan, academicSetting: setting, tp: reviewedTP, assessmentCriteria: [readyCriterion] }).resolution.status, 'BLOCKED', 'GenerationSpec blocks TP needsReview');
assert.strictEqual(resolveAssessmentGenerationSpec({ assessmentPlan: readyAssessmentPlan, academicSetting: setting, tp: readyTP, assessmentCriteria: [{ ...readyCriterion, workflowStatus: 'DRAFT' }] }).resolution.status, 'BLOCKED', 'GenerationSpec blocks DRAFT criterion');
assert.strictEqual(resolveAssessmentGenerationSpec({ assessmentPlan: readyAssessmentPlan, academicSetting: setting, tp: readyTP, assessmentCriteria: [reviewedCriterion] }).resolution.status, 'BLOCKED', 'GenerationSpec blocks criterion needsReview');
assert.strictEqual(resolveAssessmentGenerationSpec({ assessmentPlan: readyAssessmentPlan, academicSetting: setting, tp: readyTP, assessmentCriteria: [] }).resolution.status, 'BLOCKED', 'GenerationSpec blocks missing criterion');

const docContext = {
  profile: { id: 'prof-t2', name: 'Guru T2', schoolId: 'school-t2', status: 'PNS', createdAt: 't0', updatedAt: 't0' } as any,
  school: { id: 'school-t2', name: 'Sekolah T2', createdAt: 't0', updatedAt: 't0' } as any,
  academicSetting: setting,
  tp: readyTP,
  assessmentCriteria: [readyCriterion],
  documentMode: 'data' as const,
};
assert.strictEqual(validateDocumentRequirements('KKTP', { ...docContext, assessmentCriteria: [{ ...readyCriterion, workflowStatus: 'DRAFT' }] } as any).isValid, false, 'KKTP export blocks DRAFT criterion');
assert.strictEqual(validateDocumentRequirements('KKTP', { ...docContext, assessmentCriteria: [reviewedCriterion] } as any).isValid, false, 'KKTP export blocks criterion needsReview');
assert.strictEqual(validateDocumentRequirements('KKTP', { ...docContext, tp: reviewedTP } as any).isValid, false, 'KKTP export blocks TP needsReview');
assert.strictEqual(validateDocumentRequirements('KKTP', docContext as any).isValid, true, 'KKTP export allows all canonical ready data');
assert.strictEqual(validateDocumentRequirements('KKTP', { ...docContext, documentMode: 'blank' } as any).isValid, true, 'KKTP blank template export remains allowed');

console.log('Recovery T2 chain integrity regression passed.');
