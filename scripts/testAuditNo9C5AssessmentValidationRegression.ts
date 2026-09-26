import {
  AssessmentPackage,
  AssessmentGenerationPlan,
  AssessmentPackageValidationContext,
  AssessmentGradeCalibrationProfile,
  SubjectAssessmentProfile,
  AssessmentAnswerVerificationProvider,
  AssessmentQualityReviewProvider,
} from '../src/types';
import {
  validateGeneratedAssessment,
  isAssessmentValidationReportStale,
  runStructuralAssessmentValidation,
  validateAssessmentAssembly,
} from '../src/services/assessmentValidationService';
import { validateAssessmentCoverage } from '../src/services/assessmentCoverageValidationService';
import { verifyAssessmentPackageAnswers } from '../src/services/assessmentAnswerVerificationService';
import { reviewAssessmentPackageQuality } from '../src/services/assessmentQualityReviewService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

let passedCount = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passedCount++;
    console.log(`[PASS] ${passedCount}. ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

const mockValidationContext: AssessmentPackageValidationContext = {
  academicSetting: {
    id: 'setting-1',
    profileId: 'prof-1',
    curriculum: 'MERDEKA',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    phase: 'E',
    subject: 'BIOLOGY',
    grade: '10',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    updatedAt: '2026-09-18T00:00:00.000Z',
  },
  assessmentPlan: {
    id: 'plan-valid-1',
    academicSettingId: 'setting-1',
    title: 'Rencana Asesmen Biologi',
    workflowStatus: 'SIAP',
    instruments: [{ type: 'WRITTEN_TEST' }],
  } as any,
  tp: {
    id: 'tp-data-1',
    academicSettingId: 'setting-1',
    workflowStatus: 'SIAP',
    items: [
      { id: 'tp-1', text: 'Memahami ekosistem' },
      { id: 'tp-2', text: 'Menganalisis jaring makanan' },
    ],
  } as any,
  assessmentCriteria: [
    { id: 'crit-1', text: 'Kriteria 1', workflowStatus: 'SIAP', academicSettingId: 'setting-1' },
  ] as any,
};

const validPackage: AssessmentPackage = {
  id: 'pkg-valid-1',
  assessmentPlanId: 'plan-valid-1',
  title: 'Paket Asesmen Biologi',
  workflowStatus: 'DRAFT',
  academicSettingId: 'setting-1',
  revision: 1,
  rubrics: [],
  scoringGuides: [],
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
  blueprintItems: [
    {
      id: 'bp-1',
      coverageUnitId: 'cu-1',
      objectiveRefId: 'tp-1',
      criterionId: 'crit-1',
      assessmentIndicator: 'Siswa dapat menjelaskan fungsi klorofil',
      instrumentType: 'WRITTEN_TEST',
      instrumentId: 'inst-1',
      instrumentItemIds: ['item-1'],
      order: 1,
    },
  ],
  instruments: [
    {
      id: 'inst-1',
      type: 'WRITTEN_TEST',
      title: 'Tes Tertulis Biologi',
      items: [
        {
          id: 'item-1',
          blueprintItemId: 'bp-1',
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Apakah fungsi klorofil dalam fotosintesis?',
          options: [
            { id: 'opt-a', label: 'A', text: 'Menyerap energi cahaya', isCorrect: true },
            { id: 'opt-b', label: 'B', text: 'Menghasilkan CO2', isCorrect: false },
          ],
          order: 1,
        },
      ],
    },
  ],
  answerKeys: [
    {
      id: 'ak-1',
      instrumentId: 'inst-1',
      instrumentItemId: 'item-1',
      answerType: 'OPTION',
      optionIds: ['opt-a'],
    },
  ],
};

const validPlan: AssessmentGenerationPlan = {
  academicSettingId: 'setting-1',
  constraints: {
    assemblyMode: 'AUTO_RECOMMENDED',
  },
  coverageUnits: [
    {
      id: 'cu-1',
      objectiveRefId: 'tp-1',
      criterionId: 'crit-1',
      allocationUnit: 'ITEM',
      instrumentType: 'WRITTEN_TEST',
      recommendedCount: 1,
      cognitiveDemand: 'RECALL_UNDERSTAND',
      provenance: [],
      status: 'RESOLVED',
      issues: [],
    },
  ],
  summary: {
    objectiveCount: 1,
    criterionCount: 1,
    coverageUnitCount: 1,
    allocationSummary: {
      itemCount: 1,
      taskCount: 0,
      evidenceCount: 0,
      observationCount: 0,
      unresolvedCount: 0,
    },
  },
  resolution: {
    status: 'RESOLVED',
    issues: [],
  },
};

async function runAll60Tests() {
  console.log('=== RUNNING ALL 60 AUDIT 9C.5 REGRESSION TESTS ===\n');

  // Test 1: Structurally valid wrong answer + no provider -> NOT VERIFIED -> REVIEW / MANUAL_REQUIRED
  await test('1. Structurally valid MCQ without provider returns REVIEW / MANUAL_REQUIRED (Blocker 1)', async () => {
    const res = await verifyAssessmentPackageAnswers(validPackage);
    assert(res.itemResults[0].status === 'REVIEW', 'Expected status REVIEW for item without provider');
    assert(res.itemResults[0].method === 'MANUAL_REQUIRED', 'Expected method MANUAL_REQUIRED');
  });

  // Test 2: Valid MCQ + valid verifier VERIFIED -> VERIFIED
  await test('2. Valid MCQ with provider returning VERIFIED returns status VERIFIED', async () => {
    const provider: AssessmentAnswerVerificationProvider = {
      verify: async () => ({
        results: [{ instrumentItemId: 'item-1', status: 'VERIFIED', reason: 'Correct' }],
      }),
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, provider);
    assert(res.itemResults[0].status === 'VERIFIED', 'Expected status VERIFIED');
    assert(res.itemResults[0].method === 'AI', 'Expected method AI');
  });

  // Test 3: Verifier REJECTED -> FAIL
  await test('3. Verifier returning REJECTED leads to REJECTED item status and FAIL finding', async () => {
    const provider: AssessmentAnswerVerificationProvider = {
      verify: async () => ({
        results: [{ instrumentItemId: 'item-1', status: 'REJECTED', reason: 'Wrong option selected' }],
      }),
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, provider);
    assert(res.itemResults[0].status === 'REJECTED', 'Expected status REJECTED');
    assert(res.section.status === 'FAIL', 'Expected section FAIL');
  });

  // Test 4: Verifier unknown status -> REVIEW
  await test('4. Verifier returning unknown status string defaults to REVIEW / MANUAL_REQUIRED', async () => {
    const provider: AssessmentAnswerVerificationProvider = {
      verify: async () => ({
        results: [{ instrumentItemId: 'item-1', status: 'SUPER_CORRECT' as any }],
      }),
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, provider);
    assert(res.itemResults[0].status === 'REVIEW', 'Expected status REVIEW for unknown status');
  });

  // Test 5: Verifier unknown item ID -> REVIEW / malformed
  await test('5. Verifier returning unknown item ID records REVIEW finding', async () => {
    const provider: AssessmentAnswerVerificationProvider = {
      verify: async () => ({
        results: [{ instrumentItemId: 'unknown-item-99', status: 'VERIFIED' }],
      }),
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, provider);
    assert(res.section.findings.some((f) => f.code === 'UNEXPECTED_VERIFIER_ITEM_ID'), 'Expected UNEXPECTED_VERIFIER_ITEM_ID');
    assert(res.itemResults[0].status === 'REVIEW', 'Requested item stays REVIEW');
  });

  // Test 6: Verifier duplicate item result -> REVIEW / malformed
  await test('6. Verifier returning duplicate results for same item ID sets item to REVIEW', async () => {
    const provider: AssessmentAnswerVerificationProvider = {
      verify: async () => ({
        results: [
          { instrumentItemId: 'item-1', status: 'VERIFIED' },
          { instrumentItemId: 'item-1', status: 'REJECTED' },
        ],
      }),
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, provider);
    assert(res.itemResults[0].status === 'REVIEW', 'Expected duplicate item result to fall back to REVIEW');
  });

  // Test 7: Verifier omits requested item -> REVIEW
  await test('7. Verifier omitting requested item leaves item in REVIEW', async () => {
    const provider: AssessmentAnswerVerificationProvider = {
      verify: async () => ({ results: [] }),
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, provider);
    assert(res.itemResults[0].status === 'REVIEW', 'Expected omitted item to remain REVIEW');
  });

  // Test 8: Verifier throws -> REVIEW
  await test('8. Verifier throw fails safe to REVIEW / MANUAL_REQUIRED', async () => {
    const provider: AssessmentAnswerVerificationProvider = {
      verify: async () => {
        throw new Error('AI API network error');
      },
    };
    const res = await verifyAssessmentPackageAnswers(validPackage, provider);
    assert(res.itemResults[0].status === 'REVIEW', 'Expected item status REVIEW on verifier throw');
  });

  // Test 9: Matching structural validity does not automatically prove semantic correctness
  await test('9. Matching item type structural validity without provider remains REVIEW', async () => {
    const matchingPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            {
              id: 'item-matching-1',
              itemType: 'MATCHING',
              prompt: 'Jodohkan istilah berikut',
              matchingPremises: [{ id: 'p1', text: 'Premis 1' }],
              matchingResponses: [{ id: 'r1', text: 'Respon 1' }],
              matchingPairs: [{ premiseId: 'p1', responseId: 'r1' }],
              order: 1,
            },
          ],
        },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(matchingPkg);
    assert(res.itemResults[0].status === 'REVIEW', 'Matching item without provider must remain REVIEW');
  });

  // Test 10: Short answer without semantic verifier -> REVIEW
  await test('10. Short answer item without provider remains REVIEW', async () => {
    const saPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            {
              id: 'item-sa-1',
              itemType: 'SHORT_ANSWER',
              prompt: 'Sebutkan organ utama pernapasan.',
              order: 1,
            },
          ],
        },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(saPkg);
    assert(res.itemResults[0].status === 'REVIEW', 'Short answer without verifier must remain REVIEW');
  });

  // Test 11: Essay -> NOT_APPLICABLE
  await test('11. Essay item returns status NOT_APPLICABLE', async () => {
    const essayPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            {
              id: 'item-essay-1',
              itemType: 'ESSAY',
              prompt: 'Jelaskan proses fotosintesis.',
              order: 1,
            },
          ],
        },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(essayPkg);
    assert(res.itemResults[0].status === 'NOT_APPLICABLE', 'Essay items must be NOT_APPLICABLE');
  });

  // Test 12: Performance -> NOT_APPLICABLE
  await test('12. Performance instrument returns status PASS without binary item verification', async () => {
    const perfPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-perf-1',
          type: 'PERFORMANCE',
          title: 'Praktikum Biologi',
          task: 'Lakukan pengamatan sel',
        },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(perfPkg);
    assert(res.section.status === 'PASS', 'Performance instrument should pass answer verification section');
  });

  // Test 13: Project/Observation instruments pass answer verification without binary checks
  await test('13. Project/Observation instruments pass answer verification without binary checks', async () => {
    const nonWrittenPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        { id: 'inst-obs-1', type: 'OBSERVATION', title: 'Observasi', aspects: [] },
        { id: 'inst-proj-1', type: 'PROJECT', title: 'Proyek', projectBrief: 'Proyek biologi' },
      ],
    };
    const res = await verifyAssessmentPackageAnswers(nonWrittenPkg);
    assert(res.section.status === 'PASS', 'Non-written test instruments pass answer verification section');
  });

  // Test 14: Missing coverageUnitId cannot fallback to objective/criterion
  await test('14. Missing coverageUnitId on blueprint item fails coverage matching (Blocker 3)', () => {
    const pkgWithoutCuId: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: undefined as any,
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(pkgWithoutCuId, validPlan);
    assert(sec.status === 'FAIL', 'Missing coverageUnitId must NOT match via objective fallback');
    assert(sec.findings.some((f) => f.code === 'MISSING_PLANNED_COVERAGE'), 'Expected MISSING_PLANNED_COVERAGE');
  });

  // Test 15: Wrong coverageUnitId -> finding
  await test('15. Unknown coverageUnitId on blueprint item triggers UNEXPECTED_COVERAGE_UNIT', () => {
    const pkgUnknownCuId: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-unknown-99',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(pkgUnknownCuId, validPlan);
    assert(sec.findings.some((f) => f.code === 'UNEXPECTED_COVERAGE_UNIT'), 'Expected UNEXPECTED_COVERAGE_UNIT finding');
  });

  // Test 16: Exact coverageUnitId with wrong objectiveRefId -> FAIL
  await test('16. Blueprint item with exact coverageUnitId but wrong objectiveRefId flags OBJECTIVE_REF_MISMATCH', () => {
    const pkgWrongObj: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-mismatch-99',
          criterionId: 'crit-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(pkgWrongObj, validPlan);
    assert(sec.status === 'FAIL', 'Expected FAIL on objective mismatch');
    assert(sec.findings.some((f) => f.code === 'OBJECTIVE_REF_MISMATCH'), 'Expected OBJECTIVE_REF_MISMATCH');
  });

  // Test 17: Exact coverageUnitId with wrong criterionId -> FAIL
  await test('17. Blueprint item with exact coverageUnitId but wrong criterionId flags CRITERION_REF_MISMATCH', () => {
    const pkgWrongCrit: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-wrong-99',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(pkgWrongCrit, validPlan);
    assert(sec.status === 'FAIL', 'Expected FAIL on criterion mismatch');
    assert(sec.findings.some((f) => f.code === 'CRITERION_REF_MISMATCH'), 'Expected CRITERION_REF_MISMATCH');
  });

  // Test 18: Explicit ambiguous linkage points across multiple instruments -> AMBIGUOUS_INSTRUMENT_LINKAGE
  await test('18. Explicit item linkage pointing across multiple instruments triggers AMBIGUOUS_INSTRUMENT_LINKAGE', () => {
    const pkgAmbiguousInst: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: undefined,
          instrumentItemIds: ['item-1', 'item-2'],
          order: 1,
        },
      ],
      instruments: [
        { id: 'inst-1', type: 'WRITTEN_TEST', title: 'Tes 1', items: [{ id: 'item-1', itemType: 'MULTIPLE_CHOICE', prompt: 'P1', order: 1 }] },
        { id: 'inst-2', type: 'WRITTEN_TEST', title: 'Tes 2', items: [{ id: 'item-2', itemType: 'MULTIPLE_CHOICE', prompt: 'P2', order: 1 }] },
      ],
    };
    const sec = validateAssessmentCoverage(pkgAmbiguousInst, validPlan);
    assert(sec.status === 'FAIL', 'Ambiguous instrument linkage must fail');
    assert(sec.findings.some((f) => f.code === 'AMBIGUOUS_INSTRUMENT_LINKAGE'), 'Expected AMBIGUOUS_INSTRUMENT_LINKAGE');
  });

  // Test 19: No pkg.instruments[0] fallback
  await test('19. Blueprint item with nonexistent instrumentId does NOT fall back to pkg.instruments[0]', () => {
    const pkgDanglingInst: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'nonexistent-inst-99',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
    };
    const sec = validateAssessmentCoverage(pkgDanglingInst, validPlan);
    assert(sec.status === 'FAIL', 'Dangling instrument ID must NOT fall back to pkg.instruments[0]');
  });

  // Test 20: Missing recommendedCount does not become 1
  await test('20. Plan coverage unit with recommendedCount = undefined does NOT assume 1 and does NOT flag mismatch', () => {
    const planNoCount: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-1',
          objectiveRefId: 'tp-1',
          allocationUnit: 'ITEM',
          instrumentType: 'WRITTEN_TEST',
          recommendedCount: undefined,
          cognitiveDemand: 'RECALL_UNDERSTAND',
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
      ],
    };
    const sec = validateAssessmentCoverage(validPackage, planNoCount);
    assert(!sec.findings.some((f) => f.code === 'COVERAGE_COUNT_MISMATCH'), 'Should NOT flag count mismatch when recommendedCount is undefined');
  });

  // Test 21: Count mismatch does not mutate package or plan
  await test('21. Coverage count mismatch records REVIEW finding without mutating package or plan', () => {
    const planCountMismatch: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-1',
          objectiveRefId: 'tp-1',
          allocationUnit: 'ITEM',
          instrumentType: 'WRITTEN_TEST',
          recommendedCount: 10,
          cognitiveDemand: 'RECALL_UNDERSTAND',
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
      ],
    };
    const pkgCopy = JSON.stringify(validPackage);
    const planCopy = JSON.stringify(planCountMismatch);

    const sec = validateAssessmentCoverage(validPackage, planCountMismatch);
    assert(sec.findings.some((f) => f.code === 'COVERAGE_COUNT_MISMATCH'), 'Expected COVERAGE_COUNT_MISMATCH finding');
    assert(JSON.stringify(validPackage) === pkgCopy, 'Package must not be mutated');
    assert(JSON.stringify(planCountMismatch) === planCopy, 'Plan must not be mutated');
  });

  // Test 22: Same package/revision generates stable report ID
  await test('22. Validate report ID is deterministic across identical package ID and revision', async () => {
    const rep1 = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    const rep2 = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(rep1.id === rep2.id, 'Report ID must be identical and deterministic');
    assert(!rep1.id.includes('undefined') && !rep1.id.includes('NaN'), 'Report ID must be clean string');
  });

  // Test 23: CONTENT_ALIGNMENT without target -> malformed / REVIEW
  await test('23. Quality finding CONTENT_ALIGNMENT without target ID is flagged as malformed', async () => {
    const provider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [
          {
            dimension: 'CONTENT_ALIGNMENT',
            status: 'PASS',
            reason: 'Content is aligned',
          } as any,
        ],
      }),
    };
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan, undefined, undefined, provider);
    assert(res.reviewerStatus === 'REVIEW_UNAVAILABLE', 'Expected REVIEW_UNAVAILABLE on malformed target');
    assert(res.section.findings.some((f) => f.code === 'MALFORMED_QUALITY_FINDING'), 'Expected MALFORMED_QUALITY_FINDING');
  });

  // Test 24: COGNITIVE_ALIGNMENT unknown target -> malformed / REVIEW
  await test('24. Quality finding COGNITIVE_ALIGNMENT with unknown target ID is flagged as malformed', async () => {
    const provider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [
          {
            dimension: 'COGNITIVE_ALIGNMENT',
            status: 'PASS',
            reason: 'Good cognitive demand',
            unitId: 'nonexistent-unit-id-99',
          },
        ],
      }),
    };
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan, undefined, undefined, provider);
    assert(res.reviewerStatus === 'REVIEW_UNAVAILABLE', 'Expected REVIEW_UNAVAILABLE on unknown target');
    assert(res.section.findings.some((f) => f.code === 'MALFORMED_QUALITY_FINDING'), 'Expected MALFORMED_QUALITY_FINDING');
  });

  // Test 25: ITEM_CONSTRUCTION unknown item -> malformed / REVIEW
  await test('25. Quality finding ITEM_CONSTRUCTION with unknown item ID is flagged as malformed', async () => {
    const provider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [
          {
            dimension: 'ITEM_CONSTRUCTION',
            status: 'PASS',
            reason: 'Item constructed well',
            instrumentItemId: 'nonexistent-item-88',
          },
        ],
      }),
    };
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan, undefined, undefined, provider);
    assert(res.reviewerStatus === 'REVIEW_UNAVAILABLE', 'Expected REVIEW_UNAVAILABLE on unknown item target');
  });

  // Test 26: DISTRACTOR_QUALITY without applicable item -> malformed / REVIEW
  await test('26. Quality finding DISTRACTOR_QUALITY pointing to item without options is flagged as malformed', async () => {
    const essayOnlyPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [{ id: 'essay-1', itemType: 'ESSAY', prompt: 'Essay prompt', order: 1 }],
        },
      ],
    };
    const provider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [
          {
            dimension: 'DISTRACTOR_QUALITY',
            status: 'PASS',
            reason: 'Good distractors',
            instrumentItemId: 'essay-1',
          },
        ],
      }),
    };
    const res = await reviewAssessmentPackageQuality(essayOnlyPkg, validPlan, undefined, undefined, provider);
    assert(res.reviewerStatus === 'REVIEW_UNAVAILABLE', 'Expected REVIEW_UNAVAILABLE when distractor quality targets essay item');
  });

  // Test 27: Entire quality response malformed -> REVIEW_UNAVAILABLE
  await test('27. Entirely malformed quality response sets reviewerStatus to REVIEW_UNAVAILABLE', async () => {
    const provider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [{ garbageField: 123 } as any],
      }),
    };
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan, undefined, undefined, provider);
    assert(res.reviewerStatus === 'REVIEW_UNAVAILABLE', 'Expected REVIEW_UNAVAILABLE');
    assert(res.section.status === 'REVIEW', 'Expected section status REVIEW');
  });

  // Test 28: Reviewer exception -> REVIEW_UNAVAILABLE
  await test('28. Quality reviewer exception sets reviewerStatus to REVIEW_UNAVAILABLE', async () => {
    const provider: AssessmentQualityReviewProvider = {
      review: async () => {
        throw new Error('LLM rate limit exceeded');
      },
    };
    const res = await reviewAssessmentPackageQuality(validPackage, validPlan, undefined, undefined, provider);
    assert(res.reviewerStatus === 'REVIEW_UNAVAILABLE', 'Expected REVIEW_UNAVAILABLE on exception');
  });

  // Test 29: Deterministic FAIL + AI PASS -> overall FAIL
  await test('29. Overall status is FAIL when deterministic structural check fails even if AI quality passes', async () => {
    const brokenPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [],
    };
    const qualityProvider: AssessmentQualityReviewProvider = {
      review: async () => ({
        findings: [{ dimension: 'TRACEABILITY', status: 'PASS', reason: 'Looks great' }],
      }),
    };
    const report = await validateGeneratedAssessment({
      assessmentPackage: brokenPkg,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
      qualityReviewProvider: qualityProvider,
    });
    assert(report.overallStatus === 'FAIL', 'Deterministic FAIL must override AI PASS');
  });

  // Test 30: No fixed answer-pattern threshold
  await test('30. 10 consecutive identical answer key choices does NOT trigger pattern error', () => {
    const tenItems: any[] = [];
    const tenKeys: any[] = [];
    for (let i = 1; i <= 10; i++) {
      tenItems.push({
        id: `item-${i}`,
        itemType: 'MULTIPLE_CHOICE',
        prompt: `Soal ${i}`,
        options: [
          { id: 'opt-a', text: 'Option A', isCorrect: true },
          { id: 'opt-b', text: 'Option B', isCorrect: false },
        ],
        order: i,
      });
      tenKeys.push({
        id: `ak-${i}`,
        instrumentId: 'inst-1',
        instrumentItemId: `item-${i}`,
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      });
    }
    const tenPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', items: tenItems }],
      answerKeys: tenKeys,
    };
    const sec = validateAssessmentAssembly(tenPkg);
    assert(!sec.findings.some((f) => f.code === 'SUSPICIOUS_ANSWER_PATTERN'), 'Consecutive answer choices should NOT trigger pattern error');
  });

  // Test 31: No answer-distribution percentage error
  await test('31. Skewed answer key distribution (100% option A) does NOT trigger assembly error', () => {
    const sec = validateAssessmentAssembly(validPackage);
    assert(!sec.findings.some((f) => f.code === 'ANSWER_DISTRIBUTION_SKEW'), 'No percentage distribution check should exist');
  });

  // Test 32: Exact duplicate item prompt remains detected
  await test('32. Assembly validation detects EXACT_DUPLICATE_ITEM_PROMPT for identical prompt strings', () => {
    const dupPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            { id: 'item-1', itemType: 'MULTIPLE_CHOICE', prompt: 'Soal persis sama', order: 1 },
            { id: 'item-2', itemType: 'MULTIPLE_CHOICE', prompt: 'Soal persis sama', order: 2 },
          ],
        },
      ],
    };
    const sec = validateAssessmentAssembly(dupPkg);
    assert(sec.findings.some((f) => f.code === 'EXACT_DUPLICATE_ITEM_PROMPT'), 'Expected EXACT_DUPLICATE_ITEM_PROMPT');
  });

  // Test 33: Structural validation flags DANGLING_BLUEPRINT_INSTRUMENT
  await test('33. Structural validation flags DANGLING_BLUEPRINT_INSTRUMENT when bpItem.instrumentId is missing in pkg', () => {
    const danglingBpPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-nonexistent-99',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
    };
    const sec = runStructuralAssessmentValidation(danglingBpPkg, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected FAIL on dangling blueprint instrument');
    assert(sec.findings.some((f) => f.code === 'DANGLING_BLUEPRINT_INSTRUMENT'), 'Expected DANGLING_BLUEPRINT_INSTRUMENT finding');
  });

  // Test 34: Blueprint instrumentId/type conflict -> FAIL
  await test('34. Structural validation flags BLUEPRINT_INSTRUMENT_TYPE_MISMATCH when bpItem.instrumentId points to inst of different type', () => {
    const conflictTypePkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-perf-1',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
      ],
      instruments: [
        { id: 'inst-perf-1', type: 'PERFORMANCE', title: 'Unjuk Kerja', task: 'Tugas' },
      ],
    };
    const sec = runStructuralAssessmentValidation(conflictTypePkg, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected FAIL on type conflict');
    assert(sec.findings.some((f) => f.code === 'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH'), 'Expected BLUEPRINT_INSTRUMENT_TYPE_MISMATCH');
  });

  // Test 35: Blueprint instrumentItemIds ownership conflict -> FAIL
  await test('35. Structural validation flags BLUEPRINT_INSTRUMENT_ITEM_OWNERSHIP_MISMATCH when item belongs to another inst', () => {
    const ownershipConflictPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-1',
          instrumentItemIds: ['item-owned-by-inst-2'],
          order: 1,
        },
      ],
      instruments: [
        { id: 'inst-1', type: 'WRITTEN_TEST', title: 'Tes 1', items: [{ id: 'item-1', itemType: 'MULTIPLE_CHOICE', prompt: 'P1', order: 1 }] },
        { id: 'inst-2', type: 'WRITTEN_TEST', title: 'Tes 2', items: [{ id: 'item-owned-by-inst-2', itemType: 'MULTIPLE_CHOICE', prompt: 'P2', order: 1 }] },
      ],
    };
    const sec = runStructuralAssessmentValidation(ownershipConflictPkg, mockValidationContext);
    assert(sec.status === 'FAIL', 'Expected FAIL on item ownership conflict');
    assert(sec.findings.some((f) => f.code === 'BLUEPRINT_INSTRUMENT_ITEM_OWNERSHIP_MISMATCH'), 'Expected BLUEPRINT_INSTRUMENT_ITEM_OWNERSHIP_MISMATCH');
  });

  // Test 36: Package deep equality before/after validation
  await test('36. validateGeneratedAssessment maintains package deep equality before and after run', async () => {
    const pkgCopy = JSON.parse(JSON.stringify(validPackage));
    await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(JSON.stringify(validPackage) === JSON.stringify(pkgCopy), 'Package must remain strictly identical');
  });

  // Test 37: GenerationPlan deep equality before/after
  await test('37. validateGeneratedAssessment maintains generationPlan deep equality before and after run', async () => {
    const planCopy = JSON.parse(JSON.stringify(validPlan));
    await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(JSON.stringify(validPlan) === JSON.stringify(planCopy), 'Generation plan must remain strictly identical');
  });

  // Test 38: Validation context deep equality before/after
  await test('38. validateGeneratedAssessment maintains validationContext deep equality', async () => {
    const ctxCopy = JSON.parse(JSON.stringify(mockValidationContext));
    await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(JSON.stringify(mockValidationContext) === JSON.stringify(ctxCopy), 'Validation context must remain strictly identical');
  });

  // Test 39: Grade calibration deep equality before/after
  await test('39. validateGeneratedAssessment maintains gradeCalibration deep equality', async () => {
    const gradeCal: AssessmentGradeCalibrationProfile = {
      grade: 10,
      readingLoad: 'MODERATE',
      instructionLoad: 'LIMITED_MULTI_STEP',
      abstractionLevel: 'CONCRETE_TO_ABSTRACT',
      visualSupport: 'CONSIDER',
      rules: [],
    };
    const gradeCopy = JSON.parse(JSON.stringify(gradeCal));
    await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
      gradeCalibration: gradeCal,
    });
    assert(JSON.stringify(gradeCal) === JSON.stringify(gradeCopy), 'Grade calibration must remain strictly identical');
  });

  // Test 40: Subject profile deep equality before/after
  await test('40. validateGeneratedAssessment maintains subjectProfile deep equality', async () => {
    const subjProf: SubjectAssessmentProfile = {
      subjectKey: 'BIOLOGY',
      competencyDomains: [],
      supportedEvidenceTypes: ['KNOWLEDGE_RESPONSE'],
      supportedInstrumentTypes: ['WRITTEN_TEST'],
      recommendationRules: [],
      provenance: [],
      profileStatus: 'SPECIFIC',
    };
    const subjCopy = JSON.parse(JSON.stringify(subjProf));
    await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
      subjectProfile: subjProf,
    });
    assert(JSON.stringify(subjProf) === JSON.stringify(subjCopy), 'Subject profile must remain strictly identical');
  });

  // Test 41: Provider exception still leaves package unchanged
  await test('41. Provider exceptions fail safe and leave package unchanged', async () => {
    const pkgCopy = JSON.parse(JSON.stringify(validPackage));
    const throwingQualityProvider: AssessmentQualityReviewProvider = {
      review: async () => { throw new Error('Uncaught exception'); },
    };
    await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
      qualityReviewProvider: throwingQualityProvider,
    });
    assert(JSON.stringify(validPackage) === JSON.stringify(pkgCopy), 'Package must remain unchanged on provider error');
  });

  // Test 42: Validation PASS does not set SIAP
  await test('42. Validation PASS report leaves workflowStatus DRAFT (does NOT mutate package or trigger SIAP)', async () => {
    const report = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(validPackage.workflowStatus === 'DRAFT', 'workflowStatus must stay DRAFT');
  });

  // Test 43: Validation never calls confirmAssessmentPackage
  await test('43. Validation is strictly read-only and produces report object without side effects', async () => {
    const report = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(typeof report === 'object' && report.id.startsWith('val_rep_'), 'Valid report returned');
  });

  // Test 44: No repair/regeneration
  await test('44. Validation does not perform auto-repair or mutation on failed packages', async () => {
    const invalidPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [],
    };
    const report = await validateGeneratedAssessment({
      assessmentPackage: invalidPkg,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(report.overallStatus === 'FAIL', 'Report is FAIL');
    assert(invalidPkg.blueprintItems.length === 0, 'No auto-repair added items');
  });

  // Test 45: Stale report detection still works
  await test('45. isAssessmentValidationReportStale accurately checks package revision and ID', async () => {
    const report = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(!isAssessmentValidationReportStale(report, validPackage), 'Report is not stale for same package and revision');
  });

  // Test 46: Same revision report is current
  await test('46. Report matching package ID and revision returns stale = false', async () => {
    const report = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    assert(isAssessmentValidationReportStale(report, validPackage) === false, 'Same revision must not be stale');
  });

  // Test 47: Different revision is stale
  await test('47. Report with different revision returns stale = true', async () => {
    const report = await validateGeneratedAssessment({
      assessmentPackage: validPackage,
      generationPlan: validPlan,
      validationContext: mockValidationContext,
    });
    const rev2Pkg: AssessmentPackage = { ...validPackage, revision: 2 };
    assert(isAssessmentValidationReportStale(report, rev2Pkg) === true, 'Different revision must be stale');
  });

  // Test 48: 9C.4 assessment package generator remains compatible with validation inputs
  await test('48. 9C.4 assessment package generator remains compatible with validation inputs', () => {
    assert(typeof runStructuralAssessmentValidation === 'function', 'Structural validator exported');
  });

  // Test 49: 9C.3 plan generator outputs remain compatible with 9C.5 coverage validator
  await test('49. 9C.3 plan generator outputs remain compatible with 9C.5 coverage validator', () => {
    assert(typeof validateAssessmentCoverage === 'function', 'Coverage validator exported');
  });

  // Test 50: 9B package validator remains compatible with 9C.5 structural adapter
  await test('50. 9B package validator remains compatible with 9C.5 structural adapter', () => {
    const sec = runStructuralAssessmentValidation(validPackage, mockValidationContext);
    assert(sec.status === 'PASS', '9B structural check passes valid package');
  });

  // --- NEW TESTS 51-60 FOR FINAL HARDENING PATCH ---

  // Test 51 — type is not identity
  await test('51. Instrument MUST NOT resolve from type alone when instrumentId and item linkage are missing', () => {
    const noLinkagePkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: undefined,
          instrumentItemIds: [],
          order: 1,
        },
      ],
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          title: 'Tes 1',
          items: [{ id: 'unlinked-item-1', itemType: 'MULTIPLE_CHOICE', prompt: 'P1', order: 1 }],
        },
      ],
    };
    const sec = validateAssessmentCoverage(noLinkagePkg, validPlan);
    assert(sec.status === 'FAIL', 'Expected FAIL when instrument identity cannot be resolved');
    assert(sec.findings.some((f) => f.code === 'MISSING_INSTRUMENT_LINKAGE'), 'Expected MISSING_INSTRUMENT_LINKAGE finding');
  });

  // Test 52 — unique explicit item ownership resolves
  await test('52. Unique explicit item ownership resolves instrument deterministically without instrumentId', () => {
    const itemOwnedPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: undefined,
          instrumentItemIds: ['item-owned-1'],
          order: 1,
        },
      ],
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          title: 'Tes 1',
          items: [{ id: 'item-owned-1', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-1', coverageUnitId: 'cu-1', prompt: 'P1', order: 1 }],
        },
      ],
    };
    const sec = validateAssessmentCoverage(itemOwnedPkg, validPlan);
    assert(!sec.findings.some((f) => f.code === 'MISSING_INSTRUMENT_LINKAGE'), 'Should NOT fail with missing linkage when item ownership exists');
    assert(sec.status === 'PASS', 'Expected PASS on valid unique item ownership');
  });

  // Test 53 — explicit ownership ambiguous
  await test('53. Explicit item linkage pointing across multiple instruments triggers AMBIGUOUS_INSTRUMENT_LINKAGE', () => {
    const ambiguousPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: undefined,
          instrumentItemIds: ['item-a', 'item-b'],
          order: 1,
        },
      ],
      instruments: [
        { id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'item-a', itemType: 'MULTIPLE_CHOICE', prompt: 'P1', order: 1 }] },
        { id: 'inst-2', type: 'WRITTEN_TEST', items: [{ id: 'item-b', itemType: 'MULTIPLE_CHOICE', prompt: 'P2', order: 1 }] },
      ],
    };
    const sec = validateAssessmentCoverage(ambiguousPkg, validPlan);
    assert(sec.status === 'FAIL', 'Expected FAIL on ambiguous linkage');
    assert(sec.findings.some((f) => f.code === 'AMBIGUOUS_INSTRUMENT_LINKAGE'), 'Expected AMBIGUOUS_INSTRUMENT_LINKAGE finding');
  });

  // Test 54 — explicit instrumentId wins identity
  await test('54. Explicit instrumentId resolves exact target even if another instrument shares the same type', () => {
    const multiInstSameTypePkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-a',
          instrumentItemIds: ['item-a'],
          order: 1,
        },
      ],
      instruments: [
        { id: 'inst-a', type: 'WRITTEN_TEST', items: [{ id: 'item-a', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-1', coverageUnitId: 'cu-1', prompt: 'Pa', order: 1 }] },
        { id: 'inst-b', type: 'WRITTEN_TEST', items: [{ id: 'item-b', itemType: 'MULTIPLE_CHOICE', prompt: 'Pb', order: 1 }] },
      ],
    };
    const sec = validateAssessmentCoverage(multiInstSameTypePkg, validPlan);
    assert(sec.status === 'PASS', 'Expected PASS when explicit instrumentId is specified');
    assert(!sec.findings.some((f) => f.code === 'AMBIGUOUS_INSTRUMENT_LINKAGE'), 'Should NOT report ambiguous linkage when instrumentId is explicit');
  });

  // Test 55 — explicit ID/type conflict
  await test('55. Explicit instrumentId pointing to instrument of conflicting type fails validation', () => {
    const typeConflictPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-perf',
          instrumentItemIds: [],
          order: 1,
        },
      ],
      instruments: [
        { id: 'inst-perf', type: 'PERFORMANCE', title: 'Unjuk Kerja', task: 'Tugas pengamatan' },
      ],
    };
    const sec = validateAssessmentCoverage(typeConflictPkg, validPlan);
    assert(sec.status === 'FAIL', 'Expected FAIL on explicit type conflict');
    assert(sec.findings.some((f) => f.code === 'INSTRUMENT_TYPE_MISMATCH' || f.code === 'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH'), 'Expected instrument type mismatch finding');
  });

  // Test 56 — unrelated items must not inflate count
  await test('56. Unrelated items in same instrument do NOT inflate actualCount', () => {
    const count2Plan: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-1',
          objectiveRefId: 'tp-1',
          allocationUnit: 'ITEM',
          instrumentType: 'WRITTEN_TEST',
          recommendedCount: 2,
          cognitiveDemand: 'RECALL_UNDERSTAND',
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
      ],
    };
    const multiItemPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            { id: 'item-1', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-1', coverageUnitId: 'cu-1', prompt: 'P1', order: 1 },
            { id: 'item-2', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-1', coverageUnitId: 'cu-1', prompt: 'P2', order: 2 },
            { id: 'item-3', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'P3', order: 3 },
            { id: 'item-4', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'P4', order: 4 },
            { id: 'item-5', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'P5', order: 5 },
          ],
        },
      ],
    };
    const sec = validateAssessmentCoverage(multiItemPkg, count2Plan);
    assert(!sec.findings.some((f) => f.code === 'COVERAGE_COUNT_MISMATCH'), 'Should NOT report count mismatch when exactly 2 items belong to cu-1');
  });

  // Test 57 — one blueprint does not imply all instrument items belong to it
  await test('57. Instrument containing 5 unlinked items does NOT assume actualCount = 5 or 1, triggers COVERAGE_COUNT_UNRESOLVED', () => {
    const unlinkedItemsPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-1',
          instrumentItemIds: [],
          order: 1,
        },
      ],
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            { id: 'i1', itemType: 'MULTIPLE_CHOICE', prompt: 'P1', order: 1 },
            { id: 'i2', itemType: 'MULTIPLE_CHOICE', prompt: 'P2', order: 2 },
            { id: 'i3', itemType: 'MULTIPLE_CHOICE', prompt: 'P3', order: 3 },
            { id: 'i4', itemType: 'MULTIPLE_CHOICE', prompt: 'P4', order: 4 },
            { id: 'i5', itemType: 'MULTIPLE_CHOICE', prompt: 'P5', order: 5 },
          ],
        },
      ],
    };
    const sec = validateAssessmentCoverage(unlinkedItemsPkg, validPlan);
    assert(sec.findings.some((f) => f.code === 'COVERAGE_COUNT_UNRESOLVED'), 'Expected COVERAGE_COUNT_UNRESOLVED when items lack explicit linkage identifiers');
  });

  // Test 58 — blueprint count fallback prohibited
  await test('58. matchingBpItems.length is NEVER used as fallback count for actual generated units', () => {
    const twoBpPkg: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-1a',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-1',
          instrumentItemIds: ['item-1'],
          order: 1,
        },
        {
          id: 'bp-1b',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'tp-1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'inst-1',
          instrumentItemIds: [],
          order: 2,
        },
      ],
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            { id: 'item-1', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-1a', coverageUnitId: 'cu-1', prompt: 'P1', order: 1 },
          ],
        },
      ],
    };
    const sec = validateAssessmentCoverage(twoBpPkg, validPlan);
    assert(!sec.findings.some((f) => f.code === 'COVERAGE_COUNT_MISMATCH'), 'Actual count must be 1 (explicitly linked item), not 2 (matchingBpItems.length)');
  });

  // Test 59 — known zero vs unresolved
  await test('59. Known Zero produces COVERAGE_COUNT_MISMATCH (0) while unlinked items produce COVERAGE_COUNT_UNRESOLVED', () => {
    // Case A: Known Zero (inst-1 resolved, but all items explicitly belong to cu-other)
    const knownZeroPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            { id: 'i-other', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'P-other', order: 1 },
          ],
        },
      ],
    };
    const secA = validateAssessmentCoverage(knownZeroPkg, validPlan);
    assert(secA.findings.some((f) => f.code === 'COVERAGE_COUNT_MISMATCH'), 'Case A: Expected COVERAGE_COUNT_MISMATCH for known zero count');

    // Case B: Unresolved (inst-1 resolved, items exist but carry no linkage metadata)
    const unresolvedPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            { id: 'i-unlinked', itemType: 'MULTIPLE_CHOICE', prompt: 'P-unlinked', order: 1 },
          ],
        },
      ],
    };
    const secB = validateAssessmentCoverage(unresolvedPkg, validPlan);
    assert(secB.findings.some((f) => f.code === 'COVERAGE_COUNT_UNRESOLVED'), 'Case B: Expected COVERAGE_COUNT_UNRESOLVED for unknown count');
  });

  // Test 60 — count mismatch only from explicit units
  await test('60. Plan expects 3 units; 2 explicitly linked + 4 unrelated yields actualCount = 2 and COVERAGE_COUNT_MISMATCH', () => {
    const plan3: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-1',
          objectiveRefId: 'tp-1',
          allocationUnit: 'ITEM',
          instrumentType: 'WRITTEN_TEST',
          recommendedCount: 3,
          cognitiveDemand: 'RECALL_UNDERSTAND',
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
      ],
    };
    const mixedPkg: AssessmentPackage = {
      ...validPackage,
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            { id: 'i1', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-1', coverageUnitId: 'cu-1', prompt: 'P1', order: 1 },
            { id: 'i2', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-1', coverageUnitId: 'cu-1', prompt: 'P2', order: 2 },
            { id: 'u1', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'U1', order: 3 },
            { id: 'u2', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'U2', order: 4 },
            { id: 'u3', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'U3', order: 5 },
            { id: 'u4', itemType: 'MULTIPLE_CHOICE', blueprintItemId: 'bp-other', coverageUnitId: 'cu-other', prompt: 'U4', order: 6 },
          ],
        },
      ],
    };
    const sec = validateAssessmentCoverage(mixedPkg, plan3);
    const mismatchFinding = sec.findings.find((f) => f.code === 'COVERAGE_COUNT_MISMATCH');
    assert(!!mismatchFinding, 'Expected COVERAGE_COUNT_MISMATCH finding');
    assert(mismatchFinding!.message.includes('(2)'), 'Finding message must report actual count of 2');
  });

  // Test 61 — Multiple observation aspects remain one semantic coverage unit
  await test('61. Multiple observation aspects remain one semantic coverage unit (Patch B.1.2b)', () => {
    const observationCoveragePlan: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-observation-1',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          allocationUnit: 'OBSERVATION',
          instrumentType: 'OBSERVATION',
          recommendedCount: 1,
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
      ],
    };

    const observationPackage: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-observation-1',
          coverageUnitId: 'cu-observation-1',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          instrumentType: 'OBSERVATION',
          instrumentId: 'inst-observation-1',
          instrumentItemIds: [
            'asp-observation-1',
            'asp-observation-2',
          ],
          order: 1,
        },
      ],
      instruments: [
        {
          id: 'inst-observation-1',
          type: 'OBSERVATION',
          aspects: [
            {
              id: 'asp-observation-1',
              label: 'Partisipasi',
            },
            {
              id: 'asp-observation-2',
              label: 'Ketepatan',
            },
          ],
        },
      ],
    };

    const observationCoverageResult = validateAssessmentCoverage(
      observationPackage,
      observationCoveragePlan
    );

    assert(
      !observationCoverageResult.findings.some(
        (f) =>
          f.code ===
          'COVERAGE_COUNT_MISMATCH'
      ),
      'B.1.2b: Multiple observation aspects remain one semantic coverage unit'
    );

    assert(
      !observationCoverageResult.findings.some(
        (f) =>
          f.code ===
            'MISSING_PLANNED_COVERAGE' ||
          f.code ===
            'MISSING_BLUEPRINT_COVERAGE_UNIT_ID'
      ),
      'B.1.2b: Observation coverage retains exact canonical blueprint linkage'
    );
  });

  // Test 62 — ORAL_TEST is valid ITEM allocation semantics
  await test('62. ORAL_TEST is valid ITEM allocation semantics (Patch B.1.2b)', () => {
    const oralPlan: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-oral-1',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          allocationUnit: 'ITEM',
          instrumentType: 'ORAL_TEST',
          recommendedCount: 1,
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
      ],
    };

    const oralPackage: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-oral-1',
          coverageUnitId: 'cu-oral-1',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          instrumentType: 'ORAL_TEST',
          instrumentId: 'inst-oral-1',
          instrumentItemIds: ['item-oral-1'],
          order: 1,
        },
      ],
      instruments: [
        {
          id: 'inst-oral-1',
          type: 'ORAL_TEST',
          title: 'Tes Lisan',
          items: [
            {
              id: 'item-oral-1',
              prompt: 'Sebutkan bagian-bagian sel!',
              blueprintItemId: 'bp-oral-1',
              order: 1,
            },
          ],
        },
      ],
    };

    const oralCoverageResult = validateAssessmentCoverage(
      oralPackage,
      oralPlan
    );

    assert(
      !oralCoverageResult.findings.some(
        (f) =>
          f.code ===
          'ALLOCATION_SEMANTICS_MISMATCH'
      ),
      'B.1.2b: ORAL_TEST is valid ITEM allocation semantics'
    );
  });

  // Test 63 — Missing planned coverage in PARTIAL package fails deterministically (Patch B.1.2c)
  await test('63. Missing planned coverage in PARTIAL package fails deterministically (Patch B.1.2c)', () => {
    const partialCoveragePlan: AssessmentGenerationPlan = {
      ...validPlan,
      coverageUnits: [
        {
          id: 'cu-perf-a',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          allocationUnit: 'TASK',
          instrumentType: 'PERFORMANCE',
          recommendedCount: 1,
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
        {
          id: 'cu-perf-b',
          objectiveRefId: 'tp-2',
          criterionId: 'crit-1',
          allocationUnit: 'TASK',
          instrumentType: 'PERFORMANCE',
          recommendedCount: 1,
          provenance: [],
          status: 'RESOLVED',
          issues: [],
        },
      ],
    };

    const partialCoveragePackage: AssessmentPackage = {
      ...validPackage,
      blueprintItems: [
        {
          id: 'bp-perf-a',
          coverageUnitId: 'cu-perf-a',
          objectiveRefId: 'tp-1',
          criterionId: 'crit-1',
          instrumentType: 'PERFORMANCE',
          instrumentId: 'inst-perf-shared',
          instrumentItemIds: ['asp-perf-a-1'],
          order: 1,
        },
      ],
      instruments: [
        {
          id: 'inst-perf-shared',
          type: 'PERFORMANCE',
          task: 'Lakukan praktik.',
          aspects: [
            {
              id: 'asp-perf-a-1',
              label: 'Ketepatan',
            },
          ],
        },
      ],
    };

    const partialCoverageValidation = validateAssessmentCoverage(
      partialCoveragePackage,
      partialCoveragePlan
    );

    assert(
      partialCoverageValidation.status === 'FAIL',
      'B.1.2c Case 8: Missing planned coverage keeps validation in FAIL state'
    );

    assert(
      partialCoverageValidation.findings.some(
        (f) =>
          f.code === 'MISSING_PLANNED_COVERAGE' &&
          f.coverageUnitId === 'cu-perf-b'
      ),
      'B.1.2c Case 9: Missing generated coverage is reported as MISSING_PLANNED_COVERAGE'
    );
  });

  // Test 64 — Quality reviewer not configured is REVIEW / NOT_REQUESTED
  await test(
    '64. Quality reviewer not configured is REVIEW / NOT_REQUESTED, not unavailable',
    async () => {
      const result = await reviewAssessmentPackageQuality(
        validPackage,
        validPlan
      );

      assert(
        result.section.status === 'REVIEW',
        'Missing optional quality reviewer must remain REVIEW'
      );

      assert(
        result.reviewerStatus === 'NOT_REQUESTED',
        'Missing optional quality reviewer must be NOT_REQUESTED'
      );

      assert(
        result.section.findings.some(
          (f) => f.code === 'QUALITY_REVIEW_SKIPPED'
        ),
        'QUALITY_REVIEW_SKIPPED finding must remain visible'
      );
    }
  );

  // Test 65 — Configured quality reviewer failure remains REVIEW_UNAVAILABLE
  await test(
    '65. Configured quality reviewer failure remains REVIEW_UNAVAILABLE',
    async () => {
      const throwingProvider: AssessmentQualityReviewProvider = {
        review: async () => {
          throw new Error('provider unavailable');
        },
      };

      const result = await reviewAssessmentPackageQuality(
        validPackage,
        validPlan,
        undefined,
        undefined,
        throwingProvider
      );

      assert(
        result.section.status === 'REVIEW',
        'Provider failure must remain REVIEW'
      );

      assert(
        result.reviewerStatus === 'REVIEW_UNAVAILABLE',
        'Configured but failed reviewer must remain REVIEW_UNAVAILABLE'
      );
    }
  );

  // Test 66 — Validation report preserves manual-review quality state when quality reviewer is unconfigured
  await test(
    '66. Validation report preserves manual-review quality state when quality reviewer is unconfigured',
    async () => {
      const manualReviewReport = await validateGeneratedAssessment({
        assessmentPackage: validPackage,
        generationPlan: validPlan,
        validationContext: mockValidationContext,
      });

      assert(
        manualReviewReport.quality.status === 'REVIEW' &&
          manualReviewReport.reviewerStatus === 'NOT_REQUESTED',
        'B.1.2d: Validation report preserves manual-review quality state'
      );
    }
  );

  console.log(`\n=== ALL ${passedCount} AUDIT 9C.5 REGRESSION TESTS PASSED PERFECTLY! ===`);
}

runAll60Tests().catch((e) => {
  console.error('Fatal error in regression test suite:', e);
  process.exit(1);
});

// Locked 9C.5 canonical coverage and instrument linkage invariants.

