import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAssessmentGenerationSpec } from '../src/services/assessmentGenerationSpecService';
import { resolveAssessmentGenerationPlan } from '../src/services/assessmentGenerationPlanService';
import type {
  AcademicSetting,
  AssessmentCriterion,
  AssessmentPlan,
  TPData,
  TPItem,
  AssessmentInstrumentType,
} from '../src/types';

console.log('=== B.1.2k MULTI-CRITERIA EVIDENCE RECOMMENDATION REGRESSION SUITE ===');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`  [FAIL] ${name}:`, errorMsg);
    failed++;
  }
}

function createAcademicSetting(overrides?: Partial<AcademicSetting>): AcademicSetting {
  return {
    id: 'setting-1',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'Fase B',
    subject: 'PJOK',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

function createTPItem(id: string, overrides?: Partial<TPItem>): TPItem {
  return {
    id,
    code: `TP-${id}`,
    statement: `Mempraktikkan gerak dasar lari sprint dan lompat untuk ${id}`,
    competence: 'Mempraktikkan',
    contentScope: 'gerak dasar lari',
    order: 1,
    ...overrides,
  };
}

function createTPData(items: TPItem[], overrides?: Partial<TPData>): TPData {
  return {
    id: 'tp-data-1',
    academicSettingId: 'setting-1',
    workflowStatus: 'SIAP',
    needsReview: false,
    items,
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

function createCriterion(id: string, tpId: string, description: string, overrides?: Partial<AssessmentCriterion>): AssessmentCriterion {
  return {
    id,
    academicSettingId: 'setting-1',
    tpId,
    description,
    approach: 'deskripsi',
    indicators: [description],
    levels: [],
    workflowStatus: 'SIAP',
    needsReview: false,
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

function createAssessmentPlan(params: {
  tpIds: string[];
  criterionIds: string[];
  instrumentTypes: AssessmentInstrumentType[];
  overrides?: Partial<AssessmentPlan>;
}): AssessmentPlan {
  return {
    id: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Rencana Asesmen Kanonikal',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: params.tpIds,
    criterionIds: params.criterionIds,
    instruments: params.instrumentTypes.map((type, idx) => ({
      id: `inst-${idx + 1}`,
      type,
      label: `Instrumen ${type}`,
    })),
    workflowStatus: 'SIAP',
    needsReview: false,
    revision: 1,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...params.overrides,
  };
}

function runTests() {
  const specServicePath = path.resolve('src/services/assessmentGenerationSpecService.ts');
  const specServiceContent = fs.readFileSync(specServicePath, 'utf8');

  const planServicePath = path.resolve('src/services/assessmentGenerationPlanService.ts');
  const planServiceContent = fs.readFileSync(planServicePath, 'utf8');

  const mapperServicePath = path.resolve('src/services/assessmentEvidenceMapperService.ts');
  const mapperServiceContent = fs.readFileSync(mapperServicePath, 'utf8');

  const regressionFilePath = path.resolve('scripts/testB12kMultiCriteriaEvidenceRecommendationRegression.ts');
  const regressionContent = fs.readFileSync(regressionFilePath, 'utf8');

  // ----------------------------------------------------
  // TEST 1 — NO FIRST-CRITERION FIND
  // ----------------------------------------------------
  test('TEST 1: Production spec service does not use resolvedCriteria.find for recommendation generation', () => {
    assert.strictEqual(
      specServiceContent.includes('resolvedCriteria.find('),
      false,
      'Must not use resolvedCriteria.find for evidence recommendation mapping'
    );
  });

  // ----------------------------------------------------
  // TEST 2 — MULTI-CRITERIA EXPANSION
  // ----------------------------------------------------
  test('TEST 2: Objective with 2 criteria expands to 2 evidence recommendations', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Mempraktikkan awalan lari');
    const c2 = createCriterion('C-2', 'TP-1', 'Mempraktikkan ayunan tangan');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1', 'C-2'],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2],
    });

    assert.strictEqual(spec.evidenceRecommendations.length, 2, 'Should generate 2 recommendations for 2 criteria');
    assert.strictEqual(spec.evidenceRecommendations[0].objectiveRefId, 'TP-1');
    assert.strictEqual(spec.evidenceRecommendations[0].criterionId, 'C-1');
    assert.strictEqual(spec.evidenceRecommendations[1].objectiveRefId, 'TP-1');
    assert.strictEqual(spec.evidenceRecommendations[1].criterionId, 'C-2');
  });

  // ----------------------------------------------------
  // TEST 3 — EXACT CRITERION IDS
  // ----------------------------------------------------
  test('TEST 3: Criterion IDs match exactly and contain no undefined for resolved criteria', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Kriteria satu');
    const c2 = createCriterion('C-2', 'TP-1', 'Kriteria dua');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1', 'C-2'],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2],
    });

    const critIds = spec.evidenceRecommendations
      .filter((r) => r.objectiveRefId === 'TP-1')
      .map((r) => r.criterionId);

    assert.deepStrictEqual(critIds, ['C-1', 'C-2']);
    assert.strictEqual(critIds.includes(undefined), false, 'No criterionId should be undefined');
  });

  // ----------------------------------------------------
  // TEST 4 — THREE CRITERIA
  // ----------------------------------------------------
  test('TEST 4: Objective with 3 criteria expands to 3 evidence recommendations', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Kriteria satu');
    const c2 = createCriterion('C-2', 'TP-1', 'Kriteria dua');
    const c3 = createCriterion('C-3', 'TP-1', 'Kriteria tiga');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1', 'C-2', 'C-3'],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2, c3],
    });

    assert.strictEqual(spec.evidenceRecommendations.length, 3, 'Should generate 3 recommendations');
    const critIds = spec.evidenceRecommendations.map((r) => r.criterionId);
    assert.deepStrictEqual(critIds, ['C-1', 'C-2', 'C-3']);
  });

  // ----------------------------------------------------
  // TEST 5 — OBJECTIVE WITHOUT CRITERION
  // ----------------------------------------------------
  test('TEST 5: Objective without criteria produces exactly 1 objective-level recommendation with undefined criterionId', () => {
    const setting = createAcademicSetting();
    const tp2 = createTPItem('TP-2');
    const tpData = createTPData([tp2]);
    const plan = createAssessmentPlan({
      tpIds: ['TP-2'],
      criterionIds: [],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [],
    });

    assert.strictEqual(spec.evidenceRecommendations.length, 1);
    assert.strictEqual(spec.evidenceRecommendations[0].objectiveRefId, 'TP-2');
    assert.strictEqual(spec.evidenceRecommendations[0].criterionId, undefined);
  });

  // ----------------------------------------------------
  // TEST 6 — MULTIPLE OBJECTIVES
  // ----------------------------------------------------
  test('TEST 6: Multiple objectives (TP-1 with 2 criteria, TP-2 with 1 criterion) produce 3 recommendations', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tp2 = createTPItem('TP-2');
    const tpData = createTPData([tp1, tp2]);
    const c1 = createCriterion('C-1', 'TP-1', 'Kriteria TP-1 A');
    const c2 = createCriterion('C-2', 'TP-1', 'Kriteria TP-1 B');
    const c3 = createCriterion('C-3', 'TP-2', 'Kriteria TP-2 A');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1', 'TP-2'],
      criterionIds: ['C-1', 'C-2', 'C-3'],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2, c3],
    });

    assert.strictEqual(spec.evidenceRecommendations.length, 3);
    assert.deepStrictEqual(
      spec.evidenceRecommendations.map((r) => ({ obj: r.objectiveRefId, crit: r.criterionId })),
      [
        { obj: 'TP-1', crit: 'C-1' },
        { obj: 'TP-1', crit: 'C-2' },
        { obj: 'TP-2', crit: 'C-3' },
      ]
    );
  });

  // ----------------------------------------------------
  // TEST 7 — DETERMINISTIC ORDER
  // ----------------------------------------------------
  test('TEST 7: Recommendation order strictly matches resolvedObjectives order then criteria order', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tp2 = createTPItem('TP-2');
    const tpData = createTPData([tp1, tp2]);
    const c1 = createCriterion('C-1', 'TP-1', 'Kriteria 1');
    const c2 = createCriterion('C-2', 'TP-1', 'Kriteria 2');
    const c3 = createCriterion('C-3', 'TP-2', 'Kriteria 3');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1', 'TP-2'],
      criterionIds: ['C-1', 'C-2', 'C-3'],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2, c3],
    });

    assert.strictEqual(spec.evidenceRecommendations[0].objectiveRefId, 'TP-1');
    assert.strictEqual(spec.evidenceRecommendations[0].criterionId, 'C-1');
    assert.strictEqual(spec.evidenceRecommendations[1].objectiveRefId, 'TP-1');
    assert.strictEqual(spec.evidenceRecommendations[1].criterionId, 'C-2');
    assert.strictEqual(spec.evidenceRecommendations[2].objectiveRefId, 'TP-2');
    assert.strictEqual(spec.evidenceRecommendations[2].criterionId, 'C-3');
  });

  // ----------------------------------------------------
  // TEST 8 — PLAN DOES NOT PRODUCE FALSE NOT_FOUND
  // ----------------------------------------------------
  test('TEST 8: Generation Plan does not emit EVIDENCE_RECOMMENDATION_NOT_FOUND for C-1 or C-2', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Mempraktikkan start jongkok');
    const c2 = createCriterion('C-2', 'TP-1', 'Mempraktikkan ayunan lengan');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1', 'C-2'],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2],
    });

    const genPlan = resolveAssessmentGenerationPlan({ generationSpec: spec });
    assert.ok(genPlan.coverageUnits.length > 0, 'Should generate coverage units');

    const notFoundIssues = genPlan.resolution.issues.filter((i) => i.code === 'EVIDENCE_RECOMMENDATION_NOT_FOUND');
    assert.strictEqual(
      notFoundIssues.length,
      0,
      'Must not have EVIDENCE_RECOMMENDATION_NOT_FOUND when both criteria have recommendations'
    );

    const unitNotFoundIssues = genPlan.coverageUnits.flatMap((u) =>
      u.issues.filter((i) => i.code === 'EVIDENCE_RECOMMENDATION_NOT_FOUND')
    );
    assert.strictEqual(unitNotFoundIssues.length, 0, 'No coverage unit should have EVIDENCE_RECOMMENDATION_NOT_FOUND');
  });

  // ----------------------------------------------------
  // TEST 9 — COVERAGE STILL MULTI-INSTRUMENT
  // ----------------------------------------------------
  test('TEST 9: Multi-instrument coverage generates 4 coverage units for 1 TP × 2 criteria × 2 instruments', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Kriteria A');
    const c2 = createCriterion('C-2', 'TP-1', 'Kriteria B');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1', 'C-2'],
      instrumentTypes: ['WRITTEN_TEST', 'PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2],
    });

    const genPlan = resolveAssessmentGenerationPlan({ generationSpec: spec });
    assert.strictEqual(genPlan.coverageUnits.length, 4, 'Should generate 4 coverage units (1 TP × 2 Criteria × 2 Instruments)');
  });

  // ----------------------------------------------------
  // TEST 10 — CONFIRMED PLAN WINS
  // ----------------------------------------------------
  test('TEST 10: Confirmed planned instruments are preserved in coverage units and not dropped by recommendation', () => {
    const setting = createAcademicSetting();
    const tp1 = createTPItem('TP-1');
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Kriteria A');
    const c2 = createCriterion('C-2', 'TP-1', 'Kriteria B');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1', 'C-2'],
      instrumentTypes: ['WRITTEN_TEST', 'PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1, c2],
    });

    const genPlan = resolveAssessmentGenerationPlan({ generationSpec: spec });
    const plannedTypesInUnits = genPlan.coverageUnits.map((u) => u.instrumentType);
    assert.ok(plannedTypesInUnits.includes('WRITTEN_TEST'), 'Must contain WRITTEN_TEST');
    assert.ok(plannedTypesInUnits.includes('PERFORMANCE'), 'Must contain PERFORMANCE');
  });

  // ----------------------------------------------------
  // TEST 11 — NO FAKE INSTRUMENT FALLBACK
  // ----------------------------------------------------
  test('TEST 11: Production source contains no fake instrument fallback overriding canonical plan', () => {
    assert.strictEqual(
      specServiceContent.includes('recommendedInstrumentTypes[0] as'),
      false,
      'Spec service must not replace canonical instruments with recommendation index 0'
    );
    assert.strictEqual(
      planServiceContent.includes('recommendedInstrumentTypes[0] as'),
      false,
      'Plan service must not replace canonical instruments with recommendation index 0'
    );
  });

  // ----------------------------------------------------
  // TEST 12 — CRITERION CONTEXT ON MISMATCH ISSUE
  // ----------------------------------------------------
  test('TEST 12: INSTRUMENT_RECOMMENDATION_MISMATCH issue includes both objectiveRefId and criterionId', () => {
    const setting = createAcademicSetting({ subject: 'PJOK' });
    const tp1 = createTPItem('TP-1', {
      statement: 'Mempraktikkan gerak dasar lari cepat dan lompat jauh',
    });
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Mempraktikkan ayunan lengan');
    // PJOK psychomotor recommends PERFORMANCE / OBSERVATION.
    // Planning WRITTEN_TEST creates a mismatch.
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1'],
      instrumentTypes: ['WRITTEN_TEST'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1],
    });

    const mismatchIssue = spec.resolution.issues.find((i) => i.code === 'INSTRUMENT_RECOMMENDATION_MISMATCH');
    assert.ok(mismatchIssue, 'Mismatch issue must be generated');
    assert.strictEqual(mismatchIssue.objectiveRefId, 'TP-1');
    assert.strictEqual(mismatchIssue.criterionId, 'C-1');
  });

  // ----------------------------------------------------
  // TEST 13 — CRITERION CONTEXT ON AMBIGUOUS ISSUE
  // ----------------------------------------------------
  test('TEST 13: EVIDENCE_RECOMMENDATION_AMBIGUOUS issue carries criterionId when criterion exists', () => {
    // A generic subject or non-matching trigger keywords leads to confidence: 'NEEDS_TEACHER_REVIEW'
    const setting = createAcademicSetting({ subject: 'Prakarya' });
    const tp1 = createTPItem('TP-1', {
      statement: 'Mengapresiasi karya kerajinan bahan lunak',
    });
    const tpData = createTPData([tp1]);
    const c1 = createCriterion('C-1', 'TP-1', 'Mengidentifikasi karakteristik bahan');
    const plan = createAssessmentPlan({
      tpIds: ['TP-1'],
      criterionIds: ['C-1'],
      instrumentTypes: ['PERFORMANCE'],
    });

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: setting,
      assessmentPlan: plan,
      tp: tpData,
      assessmentCriteria: [c1],
    });

    const ambigIssue = spec.resolution.issues.find((i) => i.code === 'EVIDENCE_RECOMMENDATION_AMBIGUOUS');
    assert.ok(ambigIssue, 'Ambiguous recommendation issue must be generated');
    assert.strictEqual(ambigIssue.objectiveRefId, 'TP-1');
    assert.strictEqual(ambigIssue.criterionId, 'C-1');
  });

  // ----------------------------------------------------
  // TEST 14 — MAPPER UNCHANGED
  // ----------------------------------------------------
  test('TEST 14: assessmentEvidenceMapperService maintains exact objectiveRefId and criterionId contract', () => {
    assert.ok(
      mapperServiceContent.includes('objectiveRefId: objective.id,'),
      'Mapper must set objectiveRefId from objective.id'
    );
    assert.ok(
      mapperServiceContent.includes('criterionId: criterion?.id,'),
      'Mapper must set criterionId from criterion?.id'
    );
  });

  // ----------------------------------------------------
  // TEST 15 — GENERATION PLAN CONTRACT UNCHANGED
  // ----------------------------------------------------
  test('TEST 15: assessmentGenerationPlanService preserves Objective × Criterion × Planned Instrument contract', () => {
    assert.ok(
      planServiceContent.includes('for (const obj of objectives)'),
      'Plan service iterates over objectives'
    );
    assert.ok(
      planServiceContent.includes('for (const targetCritId of critTargets)'),
      'Plan service iterates over critTargets'
    );
    assert.ok(
      planServiceContent.includes('plannedInstrument'),
      'Plan service loops over planned instruments'
    );
  });

  // ----------------------------------------------------
  // TEST 16 — UNKNOWN INSTRUMENT BEHAVIOR UNCHANGED
  // ----------------------------------------------------
  test('TEST 16: UNKNOWN_INSTRUMENT_TYPE is retained with severity BLOCKING', () => {
    assert.ok(
      planServiceContent.includes("code: 'UNKNOWN_INSTRUMENT_TYPE'"),
      'Plan service must validate UNKNOWN_INSTRUMENT_TYPE'
    );
    assert.ok(
      planServiceContent.includes("severity: 'BLOCKING'"),
      'UNKNOWN_INSTRUMENT_TYPE severity must remain BLOCKING'
    );
  });

  // ----------------------------------------------------
  // TEST 17 — NO TYPE ESCAPE
  // ----------------------------------------------------
  test('TEST 17: Canonical typing enforced with zero type escapes in spec expansion and regression suite', () => {
    const forbiddenTokens = ['as' + ' any', 'as' + ' unknown' + ' as', '@ts-' + 'ignore', '@ts-' + 'expect-error'];

    for (const token of forbiddenTokens) {
      assert.strictEqual(
        regressionContent.includes(token),
        false,
        `Regression test must not contain forbidden type escape "${token}"`
      );
    }

    // Verify the recommendation expansion block in spec service contains no type escapes
    const expansionBlockStart = specServiceContent.indexOf('const evidenceRecommendations = resolvedObjectives.flatMap');
    const expansionBlockEnd = specServiceContent.indexOf('const sourceContext: AssessmentSourceContext[]');
    assert.ok(expansionBlockStart > -1 && expansionBlockEnd > expansionBlockStart, 'Expansion block found');
    const expansionBlock = specServiceContent.slice(expansionBlockStart, expansionBlockEnd);

    for (const token of forbiddenTokens) {
      assert.strictEqual(
        expansionBlock.includes(token),
        false,
        `Recommendation expansion block must not contain "${token}"`
      );
    }
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
