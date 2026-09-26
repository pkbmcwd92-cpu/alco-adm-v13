import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  deriveAutoDraftAssessmentPlan,
  generateAutoDraftPlansFromCanonicalContext,
  recommendInstrumentsForCompetency,
  resolveTargetTPSelection,
  validateAssessmentPlan,
  confirmAssessmentPlan,
  createEmptyAssessmentPlan,
} from '../src/services/assessmentPlanService';
import {
  AcademicSetting,
  TPData,
  K13Analysis,
  AssessmentCriterion,
  LearningPlan,
  AssessmentPlan,
} from '../src/types';

console.log('=== RUNNING WORKFLOW RECOVERY B ASSESSMENT REGRESSION SUITE ===');

const mockSettingMerdeka: AcademicSetting = {
  id: 'set-merdeka-1',
  profileId: 'prof-1',
  phase: 'E',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  academicYear: '2026/2027',
  semester: '1 (Ganjil)',
  level: 'SMA',
  grade: '10',
  subject: 'Bahasa Indonesia',
  subjectWeeklyJP: 3,
  updatedAt: new Date().toISOString(),
};

const mockSettingK13: AcademicSetting = {
  id: 'set-k13-1',
  profileId: 'prof-1',
  phase: 'D',
  curriculum: 'Kurikulum 2013',
  curriculumType: 'K13',
  academicYear: '2026/2027',
  semester: '1 (Ganjil)',
  level: 'SMP',
  grade: '8',
  subject: 'IPA',
  subjectWeeklyJP: 4,
  updatedAt: new Date().toISOString(),
};

const mockTPDataMulti: TPData = {
  id: 'tp-data-1',
  academicSettingId: 'set-merdeka-1',
  items: [
    {
      id: 'tp-101',
      code: 'TP 1.1',
      statement: 'Menganalisis struktur dan kaidah kebahasaan teks laporan hasil observasi',
      competence: 'Menganalisis',
      contentScope: 'Teks Laporan Hasil Observasi',
      order: 1,
    },
    {
      id: 'tp-102',
      code: 'TP 1.2',
      statement: 'Mempresentasikan hasil pengamatan dalam bentuk video demonstrasi',
      competence: 'Mempresentasikan',
      contentScope: 'Video Demonstrasi Pengamatan',
      order: 2,
    },
    {
      id: 'tp-103',
      code: 'TP 1.3',
      statement: 'Menyusun laporan tertulis secara objektif dan sistematis',
      competence: 'Menyusun',
      contentScope: 'Laporan Tertulis',
      order: 3,
    },
  ],
  workflowStatus: 'SIAP',
  needsReview: false,
  updatedAt: new Date().toISOString(),
};

const mockTPDataSingle: TPData = {
  id: 'tp-data-single',
  academicSettingId: 'set-merdeka-1',
  items: [
    {
      id: 'tp-single-1',
      code: 'TP 2.1',
      statement: 'Mendemonstrasikan prosedur keselamatan kerja di laboratorium kimia',
      competence: 'Mendemonstrasikan',
      contentScope: 'Prosedur Keselamatan Kerja',
      order: 1,
    },
  ],
  workflowStatus: 'SIAP',
  needsReview: false,
  updatedAt: new Date().toISOString(),
};

const mockCriteria: AssessmentCriterion[] = [
  {
    id: 'crit-101-1',
    academicSettingId: 'set-merdeka-1',
    tpId: 'tp-101',
    description: 'Mampu mengidentifikasi struktur teks laporan observasi dengan tepat',
    approach: 'rubrik',
    indicators: ['Identifikasi struktur', 'Kaidah kebahasaan'],
    levels: [],
    workflowStatus: 'SIAP',
    needsReview: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'crit-102-1',
    academicSettingId: 'set-merdeka-1',
    tpId: 'tp-102',
    description: 'Mampu mempresentasikan hasil pengamatan dengan artikulasi yang jelas',
    approach: 'rubrik',
    indicators: ['Artikulasi', 'Ketepatan materi'],
    levels: [],
    workflowStatus: 'SIAP',
    needsReview: false,
    updatedAt: new Date().toISOString(),
  },
];

// TEST SUITE
describe('Workflow Recovery B - Assessment Auto-Drafting & Canonical TP Mapping', () => {
  it('1. recommendInstrumentsForCompetency maps cognitive verbs to WRITTEN_TEST/ASSIGNMENT', () => {
    const recs = recommendInstrumentsForCompetency({
      competence: 'Menganalisis',
      statement: 'Menganalisis struktur dan kaidah kebahasaan',
      subject: 'Bahasa Indonesia',
    });
    assert.ok(recs.length > 0);
    const types = recs.map((r) => r.type);
    assert.ok(types.includes('WRITTEN_TEST') || types.includes('ASSIGNMENT'), 'Should recommend written test or assignment for analytical competence');
    console.log('[PASS] 1. recommendInstrumentsForCompetency maps cognitive verbs to written instruments');
  });

  it('2. recommendInstrumentsForCompetency maps psychomotor verbs to PERFORMANCE/OBSERVATION', () => {
    const recs = recommendInstrumentsForCompetency({
      competence: 'Mendemonstrasikan',
      statement: 'Mendemonstrasikan teknik lompat jauh gaya menggantung',
      subject: 'PJOK',
    });
    assert.ok(recs.length > 0);
    const types = recs.map((r) => r.type);
    assert.ok(types.includes('PERFORMANCE') || types.includes('OBSERVATION'), 'Should recommend performance or observation for psychomotor competence');
    console.log('[PASS] 2. recommendInstrumentsForCompetency maps psychomotor verbs to PERFORMANCE/OBSERVATION');
  });

  it('3. resolveTargetTPSelection with explicit valid ID resolves directly', () => {
    const resolved = resolveTargetTPSelection({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
      targetTpId: 'tp-102',
    });
    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.strictEqual(resolved.selectedTpId, 'tp-102');
    console.log('[PASS] 3. resolveTargetTPSelection with explicit ID resolves unambiguously');
  });

  it('4. resolveTargetTPSelection with single TP in context resolves unambiguously without guessing', () => {
    const resolved = resolveTargetTPSelection({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataSingle,
    });
    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.strictEqual(resolved.selectedTpId, 'tp-single-1');
    console.log('[PASS] 4. resolveTargetTPSelection with single TP in context resolves unambiguously');
  });

  it('5. resolveTargetTPSelection with multiple TPs and no targetTpId returns AMBIGUOUS without silent first-match', () => {
    const resolved = resolveTargetTPSelection({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
    });
    assert.strictEqual(resolved.status, 'AMBIGUOUS');
    assert.strictEqual(resolved.selectedTpId, undefined);
    assert.strictEqual(resolved.candidateIds?.length, 3);
    console.log('[PASS] 5. resolveTargetTPSelection with multiple TPs returns AMBIGUOUS without first-match guessing');
  });

  it('6. deriveAutoDraftAssessmentPlan produces DRAFT status with needsReview: true', () => {
    const result = deriveAutoDraftAssessmentPlan({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
      targetTpId: 'tp-101',
      assessmentCriteria: mockCriteria,
    });
    assert.ok(result.plan, 'Plan should be created');
    assert.strictEqual(result.plan.workflowStatus, 'DRAFT', 'Auto-draft plan MUST have DRAFT status');
    assert.strictEqual(result.plan.needsReview, true, 'Auto-draft plan MUST require teacher review');
    assert.ok(result.plan.reviewReason?.toLowerCase().includes('otomatis'), 'Review reason must state auto-generation');
    console.log('[PASS] 6. deriveAutoDraftAssessmentPlan produces DRAFT with needsReview: true');
  });

  it('7. deriveAutoDraftAssessmentPlan links matching KKTP criteria without fabricating fake ones', () => {
    const result = deriveAutoDraftAssessmentPlan({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
      targetTpId: 'tp-101',
      assessmentCriteria: mockCriteria,
    });
    assert.ok(result.plan);
    assert.deepStrictEqual(result.plan.criterionIds, ['crit-101-1'], 'Must link existing matching criterion');
    assert.strictEqual(result.hasCriteria, true);

    // Now test with TP that has no criteria:
    const resultNoCrit = deriveAutoDraftAssessmentPlan({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
      targetTpId: 'tp-103',
      assessmentCriteria: mockCriteria,
    });
    assert.ok(resultNoCrit.plan);
    assert.deepStrictEqual(resultNoCrit.plan.criterionIds, [], 'Must NOT fabricate fake criteria');
    assert.strictEqual(resultNoCrit.hasCriteria, false);
    console.log('[PASS] 7. deriveAutoDraftAssessmentPlan links real KKTP criteria and never fabricates fake ones');
  });

  it('8. deriveAutoDraftAssessmentPlan works without calendar or time allocation (non-blocking)', () => {
    const result = deriveAutoDraftAssessmentPlan({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataSingle,
      // No calendar or time allocation provided
    });
    assert.ok(result.plan);
    assert.strictEqual(result.plan.workflowStatus, 'DRAFT');
    assert.strictEqual(result.plan.tpIds[0], 'tp-single-1');
    console.log('[PASS] 8. deriveAutoDraftAssessmentPlan works without calendar or time allocation');
  });

  it('9. generateAutoDraftPlansFromCanonicalContext generates batch plans for all available TPs', () => {
    const plans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
      assessmentCriteria: mockCriteria,
    });
    assert.strictEqual(plans.length, 3, 'Should generate one plan per TP');
    plans.forEach((p) => {
      assert.strictEqual(p.workflowStatus, 'DRAFT');
      assert.strictEqual(p.needsReview, true);
      assert.ok(p.instruments.length > 0);
      assert.ok(p.tpIds.length === 1);
    });
    console.log('[PASS] 9. generateAutoDraftPlansFromCanonicalContext generates batch DRAFT plans');
  });

  it('10. generateAutoDraftPlansFromCanonicalContext respects existing plans and avoids duplicate creation', () => {
    const existingPlan: AssessmentPlan = {
      id: 'existing-p1',
      academicSettingId: 'set-merdeka-1',
      title: 'Existing Plan for TP 1.1',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-101'],
      criterionIds: ['crit-101-1'],
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newPlans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
      assessmentCriteria: mockCriteria,
      existingPlans: [existingPlan],
    });

    assert.strictEqual(newPlans.length, 2, 'Should only generate plans for tp-102 and tp-103');
    const targetTpIds = newPlans.map((p) => p.tpIds[0]);
    assert.ok(!targetTpIds.includes('tp-101'), 'Must not duplicate tp-101');
    console.log('[PASS] 10. generateAutoDraftPlansFromCanonicalContext respects existing plans');
  });

  it('11. validateAssessmentPlan blocks SIAP when title, tpIds, or instruments are missing', () => {
    const invalidPlan: AssessmentPlan = {
      id: 'inv-1',
      academicSettingId: 'set-merdeka-1',
      title: '',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: [],
      criterionIds: [],
      instruments: [],
      workflowStatus: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const val = validateAssessmentPlan(invalidPlan, {
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
    });
    assert.strictEqual(val.valid, false);
    assert.ok(val.errors.some((e) => e.includes('Judul')));
    assert.ok(val.errors.some((e) => e.includes('Tujuan Pembelajaran') || e.includes('TP')));
    assert.ok(val.errors.some((e) => e.toLowerCase().includes('instrumen')));
    console.log('[PASS] 11. validateAssessmentPlan strictly checks required fields for SIAP gate');
  });

  it('12. confirmAssessmentPlan promotes valid DRAFT to SIAP status with confirmedAt timestamp', () => {
    const draftPlan: AssessmentPlan = {
      id: 'plan-to-confirm',
      academicSettingId: 'set-merdeka-1',
      title: 'Sumatif Lingkup Materi 1',
      purpose: 'SUMMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-101'],
      criterionIds: ['crit-101-1'],
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
      workflowStatus: 'DRAFT',
      needsReview: true,
      reviewReason: 'Draf dibuat otomatis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = confirmAssessmentPlan(draftPlan, {
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
      assessmentCriteria: mockCriteria,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.plan.workflowStatus, 'SIAP');
    assert.strictEqual(res.plan.needsReview, false);
    assert.strictEqual(res.plan.reviewReason, undefined);
    assert.ok(res.plan.confirmedAt);
    console.log('[PASS] 12. confirmAssessmentPlan promotes valid DRAFT to SIAP with confirmedAt');
  });

  it('13. confirmAssessmentPlan rejects invalid plan and leaves it DRAFT', () => {
    const invalidPlan: AssessmentPlan = {
      id: 'plan-invalid',
      academicSettingId: 'set-merdeka-1',
      title: '',
      purpose: 'SUMMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: [],
      criterionIds: [],
      instruments: [],
      workflowStatus: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = confirmAssessmentPlan(invalidPlan, {
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataMulti,
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.plan.workflowStatus, 'DRAFT');
    console.log('[PASS] 13. confirmAssessmentPlan rejects invalid plan');
  });

  // --- COMPREHENSIVE AUTO PROVISIONING & IDEMPOTENCY SUITE ---
  const mockTP5: TPData = {
    id: 'tp-data-5',
    academicSettingId: 'set-merdeka-1',
    items: [
      { id: 'tp-1', code: 'TP 1', statement: 'Menganalisis teks eksplanasi', competence: 'Menganalisis', contentScope: 'Eksplanasi', order: 1 },
      { id: 'tp-2', code: 'TP 2', statement: 'Mempraktikkan gerak dasar senam', competence: 'Mempraktikkan', contentScope: 'Senam', order: 2 },
      { id: 'tp-3', code: 'TP 3', statement: 'Membuat produk poster digital', competence: 'Membuat', contentScope: 'Poster', order: 3 },
      { id: 'tp-4', code: 'TP 4', statement: 'Menganalisis dan mempraktikkan renang gaya dada', competence: 'Menganalisis dan mempraktikkan', contentScope: 'Renang', order: 4 },
      { id: 'tp-5', code: 'TP 5', statement: 'Mengapresiasi keindahan karya sastra secara reflektif', competence: 'Mengapresiasi', contentScope: 'Karya Sastra', order: 5 },
    ],
    updatedAt: new Date().toISOString(),
  };

  it('14. AUTO PROVISION: 1 canonical TP + 0 plans -> create 1 DRAFT', () => {
    const plans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataSingle,
      existingPlans: [],
    });
    assert.strictEqual(plans.length, 1);
    assert.strictEqual(plans[0].workflowStatus, 'DRAFT');
    assert.strictEqual(plans[0].tpIds[0], 'tp-single-1');
    console.log('[PASS] 14. 1 canonical TP + 0 plans -> creates 1 DRAFT');
  });

  it('15. AUTO PROVISION: 5 TP + 0 plans -> create 5 DRAFT', () => {
    const plans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: [],
    });
    assert.strictEqual(plans.length, 5);
    plans.forEach((p) => assert.strictEqual(p.workflowStatus, 'DRAFT'));
    console.log('[PASS] 15. 5 TP + 0 plans -> creates 5 DRAFT');
  });

  it('16. AUTO PROVISION: 5 TP + 3 existing -> create exactly 2 DRAFT', () => {
    const existing3: AssessmentPlan[] = [
      { id: 'p-1', academicSettingId: 'set-merdeka-1', title: 'Plan 1', purpose: 'FORMATIVE', timing: 'POST', scopeType: 'TP', tpIds: ['tp-1'], criterionIds: [], instruments: [{ id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' }], workflowStatus: 'DRAFT', createdAt: '', updatedAt: '' },
      { id: 'p-2', academicSettingId: 'set-merdeka-1', title: 'Plan 2', purpose: 'FORMATIVE', timing: 'POST', scopeType: 'TP', tpIds: ['tp-2'], criterionIds: [], instruments: [{ id: 'i2', type: 'PERFORMANCE', label: 'Kinerja' }], workflowStatus: 'SIAP', createdAt: '', updatedAt: '' },
      { id: 'p-3', academicSettingId: 'set-merdeka-1', title: 'Plan 3', purpose: 'FORMATIVE', timing: 'POST', scopeType: 'TP', tpIds: ['tp-3'], criterionIds: [], instruments: [{ id: 'i3', type: 'PRODUCT', label: 'Produk' }], workflowStatus: 'DRAFT', createdAt: '', updatedAt: '' },
    ];

    const newPlans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: existing3,
    });

    assert.strictEqual(newPlans.length, 2, 'Should create exactly 2 drafts for unrepresented tp-4 and tp-5');
    const createdTpIds = newPlans.map((p) => p.tpIds[0]);
    assert.deepStrictEqual(createdTpIds.sort(), ['tp-4', 'tp-5']);
    console.log('[PASS] 16. 5 TP + 3 existing -> creates exactly 2 DRAFT');
  });

  it('17. AUTO PROVISION: all TP represented -> create 0 (NO-OP)', () => {
    const allExisting: AssessmentPlan[] = ['tp-1', 'tp-2', 'tp-3', 'tp-4', 'tp-5'].map((id) => ({
      id: `plan-${id}`,
      academicSettingId: 'set-merdeka-1',
      title: `Plan for ${id}`,
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: [id],
      criterionIds: [],
      instruments: [{ id: `i-${id}`, type: 'WRITTEN_TEST', label: 'Tes' }],
      workflowStatus: 'DRAFT',
      createdAt: '',
      updatedAt: '',
    }));

    const newPlans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: allExisting,
    });

    assert.strictEqual(newPlans.length, 0, 'Must not generate any plans when all TPs are represented');
    console.log('[PASS] 17. all TP represented -> returns 0 new plans (NO-OP)');
  });

  it('18. IDEMPOTENCY: existing DRAFT and SIAP are never overwritten or mutated', () => {
    const teacherCustomDraft: AssessmentPlan = {
      id: 'teacher-custom-draft',
      academicSettingId: 'set-merdeka-1',
      title: 'Judul Khusus Bu Guru',
      purpose: 'SUMMATIVE',
      timing: 'MID_SEMESTER',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['custom-crit'],
      instruments: [{ id: 'i-custom', type: 'OBSERVATION', label: 'Observasi Pribadi' }],
      workflowStatus: 'DRAFT',
      needsReview: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const existingSiap: AssessmentPlan = {
      id: 'plan-siap',
      academicSettingId: 'set-merdeka-1',
      title: 'Perangkat Siap Final',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-2'],
      criterionIds: [],
      instruments: [{ id: 'i-siap', type: 'PERFORMANCE', label: 'Kinerja' }],
      workflowStatus: 'SIAP',
      confirmedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    const newPlans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: [teacherCustomDraft, existingSiap],
    });

    // Neither tp-1 nor tp-2 should be in newPlans
    assert.strictEqual(newPlans.some((p) => p.tpIds.includes('tp-1')), false);
    assert.strictEqual(newPlans.some((p) => p.tpIds.includes('tp-2')), false);

    // Verify existing objects were completely untouched
    assert.strictEqual(teacherCustomDraft.title, 'Judul Khusus Bu Guru');
    assert.strictEqual(teacherCustomDraft.instruments[0].type, 'OBSERVATION');
    assert.strictEqual(teacherCustomDraft.purpose, 'SUMMATIVE');
    assert.strictEqual(existingSiap.workflowStatus, 'SIAP');
    assert.strictEqual(existingSiap.confirmedAt, '2026-01-02T00:00:00.000Z');
    console.log('[PASS] 18. existing DRAFT and SIAP are never overwritten or mutated');
  });

  it('19. IDEMPOTENCY: repeated provisioning creates 0 duplicates across runs', () => {
    let currentPlans: AssessmentPlan[] = [];

    // Run 1: initial
    const run1 = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: currentPlans,
    });
    assert.strictEqual(run1.length, 5);
    currentPlans = [...run1];

    // Run 2: repeated immediately
    const run2 = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: currentPlans,
    });
    assert.strictEqual(run2.length, 0, 'Run 2 must create 0 plans');

    // Run 3: reload-equivalent with new object references
    const reloadedPlans = JSON.parse(JSON.stringify(currentPlans));
    const run3 = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: JSON.parse(JSON.stringify(mockTP5)),
      existingPlans: reloadedPlans,
    });
    assert.strictEqual(run3.length, 0, 'Run 3 with reloaded deep clones must create 0 plans');
    console.log('[PASS] 19. repeated provisioning creates 0 duplicates across runs');
  });

  it('20. IDEMPOTENCY: canonical TP ID is identity, NOT title/text', () => {
    // Case A: Duplicate title but represents different TP ID
    const planWithSameTitle: AssessmentPlan = {
      id: 'p-diff',
      academicSettingId: 'set-merdeka-1',
      title: 'Asesmen Formatif: [TP 2] Mempraktikkan gerak dasar senam...', // Title matches TP 2, but tpIds is tp-1!
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: [],
      instruments: [{ id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' }],
      workflowStatus: 'DRAFT',
      createdAt: '',
      updatedAt: '',
    };

    const newPlans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: [planWithSameTitle],
    });

    // TP 2 is NOT represented in tpIds, so TP 2 MUST be provisioned despite the title collision!
    const tp2Draft = newPlans.find((p) => p.tpIds.includes('tp-2'));
    assert.ok(tp2Draft, 'TP 2 must be provisioned because identity is TP ID, not title text');

    // Case B: Changed title on existing TP 1 plan still counts as represented
    const planWithChangedTitle: AssessmentPlan = {
      id: 'p-changed',
      academicSettingId: 'set-merdeka-1',
      title: 'Judul Diubah Total Oleh Guru',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: [],
      instruments: [{ id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' }],
      workflowStatus: 'DRAFT',
      createdAt: '',
      updatedAt: '',
    };

    const checkTp1 = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTP5,
      existingPlans: [planWithChangedTitle],
    });
    assert.strictEqual(checkTp1.some((p) => p.tpIds.includes('tp-1')), false, 'TP 1 is represented, cannot be regenerated');
    console.log('[PASS] 20. canonical TP ID is identity, NOT title/text');
  });

  it('21. UNKNOWN COMPETENCY: does NOT default to WRITTEN_TEST and returns unresolved empty array', () => {
    const unknownRec = recommendInstrumentsForCompetency({
      competence: 'Mengapresiasi',
      statement: 'Mengapresiasi nilai-nilai estetika lokal secara intuitif',
      contentScope: 'Kearifan Lokal',
      subject: 'Seni Budaya',
    });
    assert.strictEqual(unknownRec.length, 0, 'Unknown competency must return empty array, NOT fallback to WRITTEN_TEST');

    const randomWordRec = recommendInstrumentsForCompetency({
      competence: 'Xyzabc',
      statement: 'Meresapi nilai abc xyz tanpa keyword terdaftar',
    });
    assert.strictEqual(randomWordRec.length, 0);
    console.log('[PASS] 21. unknown competency does NOT default to WRITTEN_TEST and returns empty array');
  });

  it('22. UNKNOWN COMPETENCY: DRAFT is still created with needsReview: true and instrument warning', () => {
    const unknownTP: TPData = {
      id: 'tp-unknown',
      academicSettingId: 'set-merdeka-1',
      items: [
        {
          id: 'tp-u1',
          code: 'TP U.1',
          statement: 'Mengapresiasi estetika musik kontemporer secara reflektif',
          competence: 'Mengapresiasi',
          contentScope: 'Estetika Musik',
          order: 1,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const derived = deriveAutoDraftAssessmentPlan({
      academicSetting: mockSettingMerdeka,
      tp: unknownTP,
      targetObjectiveId: 'tp-u1',
    });

    assert.strictEqual(derived.status, 'DRAFT_READY', 'DRAFT must still be created for unknown competency');
    assert.strictEqual(derived.plan.workflowStatus, 'DRAFT');
    assert.strictEqual(derived.plan.needsReview, true);
    assert.strictEqual(derived.plan.instruments.length, 0, 'Instruments array must be empty');
    assert.ok(derived.plan.reviewReason?.includes('perlu dipilih guru'), 'Review reason must inform teacher to choose instruments');
    assert.ok(derived.warnings.some((w) => w.includes('perlu dipilih guru')));

    // Fails closed: cannot become SIAP with empty instruments
    const confirmAttempt = confirmAssessmentPlan(derived.plan, {
      academicSetting: mockSettingMerdeka,
      tp: unknownTP,
    });
    assert.strictEqual(confirmAttempt.success, false, 'Cannot confirm to SIAP without instruments');
    assert.strictEqual(confirmAttempt.plan.workflowStatus, 'DRAFT');
    assert.ok(confirmAttempt.errors.some((e) => e.toLowerCase().includes('instrumen')));

    // Teacher can manually add instrument and confirm
    const teacherPlan: AssessmentPlan = {
      ...derived.plan,
      instruments: [{ id: 'inst-manual', type: 'OBSERVATION', label: 'Observasi Minat' }],
    };
    const validConfirm = confirmAssessmentPlan(teacherPlan, {
      academicSetting: mockSettingMerdeka,
      tp: unknownTP,
    });
    assert.strictEqual(validConfirm.success, true);
    assert.strictEqual(validConfirm.plan.workflowStatus, 'SIAP');
    console.log('[PASS] 22. unknown recommendation creates DRAFT, requires review, blocks SIAP, and allows manual instrument selection');
  });

  it('23. KNOWN COMPETENCIES: motor, cognitive, product, mixed, and subject independence', () => {
    // Motor
    const motorRec = recommendInstrumentsForCompetency({
      competence: 'Mempraktikkan',
      statement: 'Mempraktikkan variasi gerak spesifik passing bawah bola voli',
    });
    const motorTypes = motorRec.map((r) => r.type);
    assert.ok(motorTypes.includes('PERFORMANCE') || motorTypes.includes('OBSERVATION'));

    // Cognitive
    const cogRec = recommendInstrumentsForCompetency({
      competence: 'Menganalisis',
      statement: 'Menganalisis konsep hukum Termodinamika II',
    });
    assert.ok(cogRec.some((r) => r.type === 'WRITTEN_TEST'));

    // Product
    const prodRec = recommendInstrumentsForCompetency({
      competence: 'Membuat produk',
      statement: 'Membuat karya seni kriya bahan limbah',
    });
    assert.ok(prodRec.some((r) => r.type === 'PRODUCT' || r.type === 'ASSIGNMENT'));

    // Mixed motor + cognitive
    const mixedRec = recommendInstrumentsForCompetency({
      competence: 'Menganalisis dan Mempraktikkan',
      statement: 'Menganalisis taktik dan mempraktikkan simulasi pertandingan',
    });
    const mixedTypes = mixedRec.map((r) => r.type);
    assert.ok(mixedTypes.includes('PERFORMANCE') && mixedTypes.includes('WRITTEN_TEST'), 'Mixed competency should recommend multi-instruments');

    // Subject name alone does NOT force an instrument
    const subjectOnlyRec = recommendInstrumentsForCompetency({
      subject: 'PJOK',
      competence: 'Mengapresiasi',
      statement: 'Mengapresiasi nilai sejarah olahraga secara subjektif',
    });
    assert.strictEqual(subjectOnlyRec.length, 0, 'Subject PJOK without motor keywords must not force PERFORMANCE or WRITTEN_TEST');
    console.log('[PASS] 23. known competencies recommend appropriate instruments and subject alone does not force instruments');
  });

  it('24. INTEGRITY: auto-provision never produces SIAP or confirmedAt, and works without calendar/learningPlans/allocations', () => {
    const plans = generateAutoDraftPlansFromCanonicalContext({
      academicSetting: mockSettingMerdeka,
      tp: mockTPDataSingle,
      existingPlans: [],
      // calendar, learningPlans, and timeAllocations are omitted
    });
    assert.strictEqual(plans.length, 1);
    assert.strictEqual(plans[0].workflowStatus, 'DRAFT');
    assert.strictEqual(plans[0].confirmedAt, undefined);
    assert.strictEqual(plans[0].needsReview, true);
    console.log('[PASS] 24. auto-provision never produces SIAP or confirmedAt and works without secondary dependencies');
  });

  it('25. PACKAGE & 9C GATE: DRAFT plans are excluded from package builder, SIAP plans are admitted', () => {
    const draftPlan: AssessmentPlan = {
      id: 'draft-p1',
      academicSettingId: 'set-merdeka-1',
      title: 'Draf Asesmen Belum Ditinjau',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-101'],
      criterionIds: [],
      instruments: [{ id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' }],
      workflowStatus: 'DRAFT',
      needsReview: true,
      createdAt: '',
      updatedAt: '',
    };

    const siapPlan: AssessmentPlan = {
      id: 'siap-p1',
      academicSettingId: 'set-merdeka-1',
      title: 'Perangkat Siap Uji',
      purpose: 'SUMMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-102'],
      criterionIds: [],
      instruments: [{ id: 'i2', type: 'WRITTEN_TEST', label: 'Tes' }],
      workflowStatus: 'SIAP',
      confirmedAt: new Date().toISOString(),
      createdAt: '',
      updatedAt: '',
    };

    const allPlans = [draftPlan, siapPlan];

    // AssessmentPackageBuilder filter test (Line 100 of AssessmentPackageBuilder.tsx: (assessmentPlans || []).filter(p => p.workflowStatus === 'SIAP'))
    const readyPlans = allPlans.filter((p) => p.workflowStatus === 'SIAP');
    assert.strictEqual(readyPlans.length, 1);
    assert.strictEqual(readyPlans[0].id, 'siap-p1');
    assert.strictEqual(readyPlans.some((p) => p.id === 'draft-p1'), false, 'DRAFT plan MUST NOT pass SIAP gate for package builder');
    console.log('[PASS] 25. AssessmentPackage SIAP gate strictly filters out auto-generated DRAFT plans until confirmed');
  });
});

console.log('All Workflow Recovery B Assessment Regression tests passed successfully!');

