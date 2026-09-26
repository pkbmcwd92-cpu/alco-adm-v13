import {
  createEmptyAssessmentPlan,
  createAIDraftAssessmentPlan,
  validateAssessmentPlan,
  confirmAssessmentPlan,
  invalidateAssessmentPlanDependencies,
  migrateLegacyAssessment,
  AssessmentPlanValidationContext,
} from '../src/services/assessmentPlanService';
import { resolveAssessmentAlias } from '../src/services/assessmentTypeResolver';
import { AssessmentPlan, Assessment, AcademicSetting, TPData, K13Analysis } from '../src/types';

function runTests() {
  console.log('=== RUNNING AUDIT 9A ASSESSMENT MASTER REGRESSION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Mock Context
  const mockAcademicSetting: AcademicSetting = {
    id: 'setting-1',
    curriculum: 'Kurikulum Merdeka',
    level: 'SD',
    grade: '4',
    phase: 'Fase B',
    subject: 'IPAS',
    semester: '1 (Ganjil)',
    academicYear: '2025/2026',
    profileId: 'prof-1',
    updatedAt: new Date().toISOString(),
  };

  const mockTpData: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'setting-1',
    items: [
      { id: 'tp-1', code: 'TP.1', statement: 'Memahami wujud zat', competence: 'Memahami', contentScope: 'Wujud Zat', p3Dimensions: [], order: 1 },
      { id: 'tp-2', code: 'TP.2', statement: 'Menganalisis perubahan wujud zat', competence: 'Menganalisis', contentScope: 'Perubahan Wujud Zat', p3Dimensions: [], order: 2 },
    ],
    workflowStatus: 'SIAP',
    needsReview: false,
    updatedAt: new Date().toISOString(),
  };

  const mockK13Analysis: K13Analysis = {
    id: 'k13-1',
    academicSettingId: 'setting-1',
    items: [
      { id: 'kd-3.1', skl: 'SKL-1', ki: 'KI-3', kd: '3.1', indikator: 'Indikator 3.1', materi: 'Memahami sifat bunyi', kegiatan: 'Diskusi' },
    ],
    updatedAt: new Date().toISOString(),
  };

  const validContext: AssessmentPlanValidationContext = {
    academicSetting: mockAcademicSetting,
    tp: mockTpData,
  };

  // -------------------------------------------------------------
  // TEST 1: Canonical Model Initialization (No Auto-Selection)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Model Initialization & Default Empty Selection ---');
  const emptyPlan = createEmptyAssessmentPlan({
    academicSettingId: mockAcademicSetting.id,
    title: 'Tes Format 1',
  });

  assert(emptyPlan.tpIds.length === 0, 'Initial tpIds must be strictly empty (NO auto-selection of tp.items[0])');
  assert(emptyPlan.instruments.length === 0, 'Initial instruments must be strictly empty');
  assert(emptyPlan.workflowStatus === 'DRAFT', 'Initial workflowStatus must be DRAFT');

  // -------------------------------------------------------------
  // TEST 2: Operational Alias Resolver (resolveAssessmentAlias)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Operational Alias Resolver ---');

  const resUts = resolveAssessmentAlias('PTS / UTS');
  assert(
    resUts.status === 'RESOLVED' && resUts.purpose === 'SUMMATIVE' && resUts.timing === 'MID_SEMESTER' && resUts.scopeType === 'SEMESTER',
    'PTS / UTS resolves to SUMMATIVE + MID_SEMESTER + SEMESTER'
  );

  const resPas = resolveAssessmentAlias('PAS / SAS');
  assert(
    resPas.status === 'RESOLVED' && resPas.purpose === 'SUMMATIVE' && resPas.timing === 'END_SEMESTER' && resPas.scopeType === 'SEMESTER',
    'PAS / SAS resolves to SUMMATIVE + END_SEMESTER + SEMESTER'
  );

  const resPre = resolveAssessmentAlias('Pre-test Diagnostik');
  assert(
    resPre.status === 'RESOLVED' && resPre.purpose === 'FORMATIVE' && resPre.timing === 'PRE' && resPre.scopeType === 'TP',
    'Pre-test resolves to FORMATIVE + PRE + TP'
  );

  const resUhContext = resolveAssessmentAlias('Ulangan Harian 1', { tpCount: 1 });
  assert(
    resUhContext.status === 'RESOLVED' && resUhContext.scopeType === 'TP',
    'Ulangan Harian with tpCount = 1 resolves to TP scope'
  );

  const resUhAmbiguous = resolveAssessmentAlias('Ulangan Harian');
  assert(
    resUhAmbiguous.status === 'AMBIGUOUS',
    'Ulangan Harian without tpCount context resolves to AMBIGUOUS (No first match forcing)'
  );

  const resUk = resolveAssessmentAlias('UK 1');
  assert(resUk.status === 'AMBIGUOUS', 'UK term is resolved as AMBIGUOUS');

  // -------------------------------------------------------------
  // TEST 3: Multi-TP & Canonical ID Matching
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Multi-TP & Canonical ID Matching ---');

  const multiTpPlan: AssessmentPlan = {
    ...emptyPlan,
    title: 'Sumatif Lintas TP',
    scopeType: 'MULTI_TP',
    tpIds: ['tp-1', 'tp-2'],
    instruments: [{ id: 'i1', type: 'WRITTEN_TEST' }],
  };

  const valMulti = validateAssessmentPlan(multiTpPlan, validContext);
  assert(valMulti.valid, 'MULTI_TP scope with 2 valid TPs passes validation');

  const invalidMultiTpPlan: AssessmentPlan = {
    ...multiTpPlan,
    tpIds: ['tp-1'], // Only 1 TP for MULTI_TP scope
  };
  const valInvalidMulti = validateAssessmentPlan(invalidMultiTpPlan, validContext);
  assert(!valInvalidMulti.valid, 'MULTI_TP scope with only 1 TP fails validation');

  const danglingTpPlan: AssessmentPlan = {
    ...multiTpPlan,
    tpIds: ['tp-fictional-999'],
  };
  const valDangling = validateAssessmentPlan(danglingTpPlan, validContext);
  assert(!valDangling.valid, 'Fictional/Dangling TP ID fails validation (ID > Text match enforced)');

  // -------------------------------------------------------------
  // TEST 4: Validator & Export / SIAP Guard
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Validator & SIAP Status Guards ---');

  const planNoInstruments: AssessmentPlan = {
    ...emptyPlan,
    title: 'Tes Tanpa Instrumen',
    tpIds: ['tp-1'],
    instruments: [],
  };

  const confirmResultNoInst = confirmAssessmentPlan(planNoInstruments, validContext);
  assert(!confirmResultNoInst.success, 'Plan without instruments cannot be confirmed SIAP');

  const validPlan: AssessmentPlan = {
    ...emptyPlan,
    title: 'Asesmen Sumatif TP 1',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  };

  const confirmValid = confirmAssessmentPlan(validPlan, validContext);
  assert(confirmValid.success && confirmValid.plan.workflowStatus === 'SIAP', 'Valid plan can be confirmed SIAP');

  // -------------------------------------------------------------
  // TEST 5: Proactive Dependency Invalidation
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Proactive Dependency Invalidation ---');

  const readyPlan: AssessmentPlan = {
    ...validPlan,
    workflowStatus: 'SIAP',
  };

  // Simulate TP deletion in context
  const contextWithoutTp1: AssessmentPlanValidationContext = {
    academicSetting: mockAcademicSetting,
    tp: {
      ...mockTpData,
      items: [
        { id: 'tp-2', code: 'TP.2', statement: 'Menganalisis perubahan wujud zat', competence: 'Menganalisis', contentScope: 'Perubahan Wujud Zat', p3Dimensions: [], order: 2 }, // tp-1 removed
      ],
    },
  };

  const invalResult = invalidateAssessmentPlanDependencies(readyPlan, contextWithoutTp1);
  assert(invalResult.isInvalidated, 'Plan is invalidated when upstream TP dependency is deleted');
  assert(invalResult.plan.workflowStatus === 'PERLU_DILENGKAPI', 'Invalidated plan degrades from SIAP to PERLU_DILENGKAPI');
  assert(invalResult.plan.needsReview === true, 'Invalidated plan flags needsReview = true');

  // -------------------------------------------------------------
  // TEST 6: Legacy Assessment Migration (No Fake Instrument & No Fake Scoring Data)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Legacy Assessment Migration ---');

  const legacyAssessment: Assessment = {
    id: 'asm-legacy-1',
    academicSettingId: 'setting-1',
    tpId: 'tp-1',
    type: 'formatif',
    title: 'Formatif Harian 1',
    date: '2025-08-10',
    maxScore: 100,
    passingScore: 75,
    createdAt: new Date().toISOString(),
  };

  const migratedPlan1 = migrateLegacyAssessment(legacyAssessment, validContext, []);
  assert(migratedPlan1.id === 'asp-migrated-asm-legacy-1', 'Legacy assessment migrated with canonical ID');
  assert(migratedPlan1.purpose === 'FORMATIVE', 'Legacy type "formatif" mapped to purpose "FORMATIVE"');
  assert(migratedPlan1.tpIds.includes('tp-1'), 'Legacy tpId preserved in canonical tpIds array');
  assert(migratedPlan1.instruments.length === 0, 'Legacy migration produces NO fake instruments (instruments.length === 0)');
  assert(migratedPlan1.workflowStatus === 'PERLU_DILENGKAPI', 'Legacy migration without instrument defaults to PERLU_DILENGKAPI');
  assert(migratedPlan1.needsReview === true, 'Legacy migration flags needsReview === true');

  // No fake scoring fields on AssessmentPlan
  const migratedAny = migratedPlan1 as any;
  assert(
    migratedAny.passingScore === undefined && migratedAny.maxScore === undefined && migratedAny.score === undefined,
    'Legacy migration does NOT attach passingScore, maxScore, or score to canonical AssessmentPlan'
  );

  // Idempotency check
  const migratedPlan2 = migrateLegacyAssessment(legacyAssessment, validContext, [migratedPlan1]);
  assert(migratedPlan2 === migratedPlan1, 'Migration is idempotent (returns existing migrated plan)');

  // -------------------------------------------------------------
  // TEST 7: Alias Resolver Has No Default Instruments
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Alias Resolver Has No Default Instruments ---');

  const aliasesToTest = [
    'Pre-test',
    'Post-test',
    'Formatif',
    'PTS',
    'UTS',
    'PAS',
    'SAS',
    'PAT',
    'Ujian Sekolah',
  ];

  let hasNoDefaultInstruments = true;
  aliasesToTest.forEach((alias) => {
    const res = resolveAssessmentAlias(alias, { tpCount: 1 });
    if ((res as any).defaultInstruments !== undefined) {
      hasNoDefaultInstruments = false;
    }
  });
  assert(hasNoDefaultInstruments, 'None of the alias resolver results produce defaultInstruments');

  // -------------------------------------------------------------
  // TEST 8: Curriculum Isolation, Missing Source, & Unresolved Context
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Curriculum Isolation & Missing Canonical Source ---');

  // Missing Canonical Source in Merdeka
  const missingSourceContext: AssessmentPlanValidationContext = {
    academicSetting: mockAcademicSetting,
    tp: undefined, // TP source unavailable
  };
  const planWithTp: AssessmentPlan = {
    ...emptyPlan,
    title: 'Asesmen TP 1',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    instruments: [{ id: 'i1', type: 'WRITTEN_TEST' }],
  };
  const valMissingSource = validateAssessmentPlan(planWithTp, missingSourceContext);
  assert(!valMissingSource.valid, 'Missing canonical Merdeka TP source causes validation FAIL');

  // Unresolved Curriculum Context
  const unresolvedCurrContext: AssessmentPlanValidationContext = {
    academicSetting: undefined,
  };
  const valUnresolvedCurr = validateAssessmentPlan(planWithTp, unresolvedCurrContext);
  assert(!valUnresolvedCurr.valid, 'Unresolved curriculum context causes validation FAIL');

  // Curriculum Isolation: Merdeka context with only K13 source available
  const merdekaContextWithK13Only: AssessmentPlanValidationContext = {
    academicSetting: { ...mockAcademicSetting, curriculum: 'Kurikulum Merdeka' },
    k13Analysis: mockK13Analysis, // K13 source provided, but curriculum is Merdeka!
  };
  const valIsoMerdeka = validateAssessmentPlan(
    { ...planWithTp, tpIds: ['kd-3.1'] },
    merdekaContextWithK13Only
  );
  assert(!valIsoMerdeka.valid, 'Merdeka plan cannot validate against K13 KD source (Curriculum Isolation)');

  // Curriculum Isolation: K13 context with only Merdeka source available
  const k13ContextWithMerdekaOnly: AssessmentPlanValidationContext = {
    academicSetting: { ...mockAcademicSetting, curriculum: '2013' },
    tp: mockTpData, // Merdeka source provided, but curriculum is K13!
  };
  const valIsoK13 = validateAssessmentPlan(
    { ...planWithTp, tpIds: ['tp-1'] },
    k13ContextWithMerdekaOnly
  );
  assert(!valIsoK13.valid, 'K13 plan cannot validate against Merdeka TP source (Curriculum Isolation)');

  // -------------------------------------------------------------
  // TEST 9: Valid Merdeka & K13 Flow
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Valid Merdeka & K13 Flow ---');

  const validMerdekaPlan: AssessmentPlan = {
    ...emptyPlan,
    title: 'Asesmen Sumatif Merdeka',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  };
  const confirmMerdeka = confirmAssessmentPlan(validMerdekaPlan, validContext);
  assert(confirmMerdeka.success && confirmMerdeka.plan.workflowStatus === 'SIAP', 'Valid Merdeka plan can become SIAP');

  const k13Context: AssessmentPlanValidationContext = {
    academicSetting: { ...mockAcademicSetting, curriculum: '2013' },
    k13Analysis: mockK13Analysis,
  };
  const validK13Plan: AssessmentPlan = {
    ...emptyPlan,
    title: 'Penilaian Harian KD 3.1',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['kd-3.1'],
    instruments: [{ id: 'inst-k13', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  };
  const confirmK13 = confirmAssessmentPlan(validK13Plan, k13Context);
  assert(confirmK13.success && confirmK13.plan.workflowStatus === 'SIAP', 'Valid K13 plan can become SIAP');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
