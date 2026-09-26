import {
  createEmptyAssessmentPackage,
  validateAssessmentPackage,
  confirmAssessmentPackage,
  invalidateAssessmentPackageDependencies,
} from '../src/services/assessmentPackageService';
import {
  AcademicSetting,
  AssessmentPlan,
  AssessmentPackage,
  TPData,
  AssessmentBlueprintItem,
  AssessmentCriterion,
  WrittenAssessmentInstrument,
  WrittenAssessmentItem,
} from '../src/types';
import type { AssessmentValidationReport } from '../src/types/assessmentValidation';

async function runRegressionTests() {
  console.log('=== STARTING AUDIT 9C.1 SCHEMA FOUNDATION REGRESSION TEST SUITE ===\n');

  const mockMerdekaSetting: AcademicSetting = {
    id: 'setting-merdeka',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'B',
    subject: 'IPAS',
    updatedAt: new Date().toISOString(),
  };

  const mockTP: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'setting-merdeka',
    workflowStatus: 'SIAP',
    needsReview: false,
    items: [
      {
        id: 'tp-1',
        code: 'TP-1',
        statement: 'Menganalisis fotosintesis pada tumbuhan hijau',
        competence: 'Menganalisis',
        contentScope: 'Fotosintesis',
        p3Dimensions: [],
        order: 1,
      },
      {
        id: 'tp-2',
        code: 'TP-2',
        statement: 'Memahami siklus air dan dampaknya bagi bumi',
        competence: 'Memahami',
        contentScope: 'Siklus Air',
        p3Dimensions: [],
        order: 2,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockCriteria: AssessmentCriterion[] = [
    {
      id: 'crit-1',
      academicSettingId: 'setting-merdeka',
      tpId: 'tp-1',
      description: 'Kriteria Penguasaan Fotosintesis',
      approach: 'rubrik',
      indicators: ['Menjelaskan fotosintesis'],
      levels: [],
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockPlan: AssessmentPlan = {
    id: 'plan-1',
    academicSettingId: 'setting-merdeka',
    title: 'Rencana Asesmen IPAS Bab 1',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    workflowStatus: 'SIAP',
    tpIds: ['tp-1', 'tp-2'],
    criterionIds: ['crit-1'],
    instruments: [
      { id: 'pi-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
    ],
    needsReview: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string, errors?: string[]) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
      if (errors && errors.length > 0) {
        console.error(`   Errors:`, errors);
      }
      failed++;
    }
  }

  // ==========================================
  // CASE A: Backward Compatibility - Legacy 9B Package
  // ==========================================
  console.log('\n--- Case A: Legacy 9B Package Compatibility ---');
  const legacyPkg: AssessmentPackage = {
    id: 'pkg-legacy-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-merdeka',
    title: 'Paket Asesmen IPAS Format 9B',
    workflowStatus: 'DRAFT',
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-1',
        assessmentIndicator: 'Peserta didik dapat menjelaskan proses fotosintesis',
        materialOrContext: 'Tumbuhan',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-legacy-1'],
        order: 1,
      },
    ],
    instruments: [
      {
        id: 'inst-w-1',
        type: 'WRITTEN_TEST',
        instructions: 'Kerjakan soal dengan teliti',
        items: [
          {
            id: 'item-legacy-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Klorofil berperan penting dalam proses...',
            options: [
              { id: 'opt-1', label: 'A', text: 'Fotosintesis', isCorrect: true },
              { id: 'opt-2', label: 'B', text: 'Respirasi', isCorrect: false },
            ],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
    answerKeys: [
      {
        id: 'ak-legacy-1',
        instrumentId: 'inst-w-1',
        instrumentItemId: 'item-legacy-1',
        answerType: 'OPTION',
        optionIds: ['opt-1'],
        value: 'A',
      },
    ],
    scoringGuides: [],
    rubrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const valA = validateAssessmentPackage(legacyPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(valA.valid, 'Case A: Legacy 9B package without 9C metadata passes validation without regression', undefined, valA.errors);
  const mockReportA: AssessmentValidationReport = {
    id: 'report-legacy-1',
    assessmentPackageId: legacyPkg.id,
    packageRevision: legacyPkg.revision ?? 1,
    structural: { status: 'PASS', findings: [] },
    coverage: { status: 'PASS', findings: [] },
    answerVerification: { status: 'PASS', findings: [] },
    quality: { status: 'PASS', findings: [] },
    assembly: { status: 'PASS', findings: [] },
    overallStatus: 'PASS',
    reviewerStatus: 'NOT_REQUESTED',
    engineVersion: '1.0.0',
    createdAt: new Date().toISOString(),
  };
  const confA = confirmAssessmentPackage(
    legacyPkg,
    {
      academicSetting: mockMerdekaSetting,
      assessmentPlan: mockPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    },
    mockReportA
  );
  assert(confA.success && confA.package.workflowStatus === 'SIAP', 'Case A: Legacy 9B package can be confirmed to SIAP', undefined, confA.errors);

  // ==========================================
  // CASE B: Extension - Valid MATCHING Question
  // ==========================================
  console.log('\n--- Case B: Valid MATCHING (Menjodohkan) Item ---');
  const validMatchingPkg: AssessmentPackage = {
    id: 'pkg-matching-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-merdeka',
    title: 'Paket Asesmen Menjodohkan',
    workflowStatus: 'DRAFT',
    blueprintItems: [
      {
        id: 'bp-m-1',
        objectiveRefId: 'tp-1',
        assessmentIndicator: 'Menjodohkan organ tumbuhan dan fungsinya',
        materialOrContext: 'Organ Tumbuhan',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-m-1'],
        order: 1,
      },
    ],
    instruments: [
      {
        id: 'inst-w-m',
        type: 'WRITTEN_TEST',
        instructions: 'Jodohkan kolom kiri dengan kolom kanan',
        items: [
          {
            id: 'item-m-1',
            itemType: 'MATCHING',
            prompt: 'Jodohkan bagian organ tumbuhan berikut dengan fungsinya:',
            matchingPremises: [
              { id: 'p-1', text: 'Daun' },
              { id: 'p-2', text: 'Akar' },
            ],
            matchingResponses: [
              { id: 'r-1', text: 'Menyerap air dan zat hara' },
              { id: 'r-2', text: 'Tempat berlangsungnya fotosintesis' },
            ],
            matchingPairs: [
              { premiseId: 'p-1', responseId: 'r-2' },
              { premiseId: 'p-2', responseId: 'r-1' },
            ],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
    answerKeys: [
      {
        id: 'ak-m-1',
        instrumentId: 'inst-w-m',
        instrumentItemId: 'item-m-1',
        answerType: 'MATCHING',
        matchingPairs: [
          { premiseId: 'p-1', responseId: 'r-2' },
          { premiseId: 'p-2', responseId: 'r-1' },
        ],
      },
    ],
    scoringGuides: [],
    rubrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const valB = validateAssessmentPackage(validMatchingPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(valB.valid, 'Case B: Valid MATCHING item with premises, responses, and pairs passes validation', undefined, valB.errors);

  // ==========================================
  // CASE C: Fail-Closed - MATCHING Missing Premise or Response
  // ==========================================
  console.log('\n--- Case C: Fail-Closed MATCHING Empty Premises or Responses ---');
  const emptyPremisePkg: AssessmentPackage = {
    ...validMatchingPkg,
    instruments: [
      {
        id: 'inst-w-m',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-m-1',
            itemType: 'MATCHING',
            prompt: 'Soal tanpa premis',
            matchingPremises: [],
            matchingResponses: [{ id: 'r-1', text: 'Respon 1' }],
            matchingPairs: [],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const valC = validateAssessmentPackage(emptyPremisePkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(!valC.valid && valC.errors.some((e) => e.includes('minimal 1 premis')), 'Case C: Empty premises in MATCHING fails closed');

  // ==========================================
  // CASE D: Fail-Closed - MATCHING Dangling Premise ID
  // ==========================================
  console.log('\n--- Case D: Fail-Closed MATCHING Dangling Premise ID ---');
  const danglingPremisePkg: AssessmentPackage = {
    ...validMatchingPkg,
    instruments: [
      {
        id: 'inst-w-m',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-m-1',
            itemType: 'MATCHING',
            prompt: 'Soal dengan premiseId tidak terdaftar',
            matchingPremises: [{ id: 'p-real', text: 'Premis Asli' }],
            matchingResponses: [{ id: 'r-real', text: 'Respon Asli' }],
            matchingPairs: [{ premiseId: 'p-ghost', responseId: 'r-real' }],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const valD = validateAssessmentPackage(danglingPremisePkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valD.valid && valD.errors.some((e) => e.includes('dangling premise reference')),
    'Case D: Dangling premiseId in matchingPairs is rejected'
  );

  // ==========================================
  // CASE E: Fail-Closed - MATCHING Dangling Response ID
  // ==========================================
  console.log('\n--- Case E: Fail-Closed MATCHING Dangling Response ID ---');
  const danglingResponsePkg: AssessmentPackage = {
    ...validMatchingPkg,
    instruments: [
      {
        id: 'inst-w-m',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-m-1',
            itemType: 'MATCHING',
            prompt: 'Soal dengan responseId tidak terdaftar',
            matchingPremises: [{ id: 'p-real', text: 'Premis Asli' }],
            matchingResponses: [{ id: 'r-real', text: 'Respon Asli' }],
            matchingPairs: [{ premiseId: 'p-real', responseId: 'r-ghost' }],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const valE = validateAssessmentPackage(danglingResponsePkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valE.valid && valE.errors.some((e) => e.includes('dangling response reference')),
    'Case E: Dangling responseId in matchingPairs is rejected'
  );

  // ==========================================
  // CASE F: Extension - Valid CATEGORY_RESPONSE Question
  // ==========================================
  console.log('\n--- Case F: Valid CATEGORY_RESPONSE Item ---');
  const validCategoryPkg: AssessmentPackage = {
    id: 'pkg-cat-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-merdeka',
    title: 'Paket Asesmen Kategori',
    workflowStatus: 'DRAFT',
    blueprintItems: [
      {
        id: 'bp-c-1',
        objectiveRefId: 'tp-1',
        assessmentIndicator: 'Mengidentifikasi kebenaran pernyataan terkait fotosintesis',
        materialOrContext: 'Fotosintesis',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-c-1'],
        order: 1,
      },
    ],
    instruments: [
      {
        id: 'inst-w-c',
        type: 'WRITTEN_TEST',
        instructions: 'Tentukan Benar atau Salah untuk tiap pernyataan',
        items: [
          {
            id: 'item-c-1',
            itemType: 'CATEGORY_RESPONSE',
            prompt: 'Tentukan Benar atau Salah untuk setiap pernyataan berikut mengenai fotosintesis:',
            categoryResponseCategories: [
              { id: 'cat-true', label: 'Benar' },
              { id: 'cat-false', label: 'Salah' },
            ],
            categoryResponseStatements: [
              { id: 'stmt-1', text: 'Fotosintesis menghasilkan gas oksigen.', correctCategoryId: 'cat-true' },
              { id: 'stmt-2', text: 'Tumbuhan berfotosintesis hanya pada malam hari.', correctCategoryId: 'cat-false' },
            ],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
    answerKeys: [
      {
        id: 'ak-c-1',
        instrumentId: 'inst-w-c',
        instrumentItemId: 'item-c-1',
        answerType: 'CATEGORY_RESPONSE',
        categoryAnswers: [
          { statementId: 'stmt-1', categoryId: 'cat-true' },
          { statementId: 'stmt-2', categoryId: 'cat-false' },
        ],
      },
    ],
    scoringGuides: [],
    rubrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const valF = validateAssessmentPackage(validCategoryPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(valF.valid, 'Case F: Valid CATEGORY_RESPONSE with categories and statements passes validation', undefined, valF.errors);

  // ==========================================
  // CASE G: Fail-Closed - CATEGORY_RESPONSE < 2 Categories
  // ==========================================
  console.log('\n--- Case G: Fail-Closed CATEGORY_RESPONSE < 2 Categories ---');
  const singleCategoryPkg: AssessmentPackage = {
    ...validCategoryPkg,
    instruments: [
      {
        id: 'inst-w-c',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-c-1',
            itemType: 'CATEGORY_RESPONSE',
            prompt: 'Soal hanya 1 kategori',
            categoryResponseCategories: [{ id: 'cat-only', label: 'Satu' }],
            categoryResponseStatements: [{ id: 'stmt-1', text: 'Pernyataan 1', correctCategoryId: 'cat-only' }],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const valG = validateAssessmentPackage(singleCategoryPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(!valG.valid && valG.errors.some((e) => e.includes('minimal 2 pilihan kategori')), 'Case G: Less than 2 categories is rejected');

  // ==========================================
  // CASE H: Fail-Closed - CATEGORY_RESPONSE Dangling Category ID
  // ==========================================
  console.log('\n--- Case H: Fail-Closed CATEGORY_RESPONSE Dangling Category ID ---');
  const danglingCategoryPkg: AssessmentPackage = {
    ...validCategoryPkg,
    instruments: [
      {
        id: 'inst-w-c',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-c-1',
            itemType: 'CATEGORY_RESPONSE',
            prompt: 'Soal dengan correctCategoryId palsu',
            categoryResponseCategories: [
              { id: 'cat-1', label: 'Benar' },
              { id: 'cat-2', label: 'Salah' },
            ],
            categoryResponseStatements: [
              { id: 'stmt-1', text: 'Pernyataan 1', correctCategoryId: 'cat-ghost' },
            ],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const valH = validateAssessmentPackage(danglingCategoryPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valH.valid && valH.errors.some((e) => e.includes('dangling category reference')),
    'Case H: Dangling correctCategoryId in statement is rejected'
  );

  // ==========================================
  // CASE I: Fail-Closed - CATEGORY_RESPONSE Unassigned Category in Statement
  // ==========================================
  console.log('\n--- Case I: Fail-Closed CATEGORY_RESPONSE Unassigned Category ---');
  const unassignedCategoryPkg: AssessmentPackage = {
    ...validCategoryPkg,
    instruments: [
      {
        id: 'inst-w-c',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-c-1',
            itemType: 'CATEGORY_RESPONSE',
            prompt: 'Soal tanpa kunci kategori',
            categoryResponseCategories: [
              { id: 'cat-1', label: 'Benar' },
              { id: 'cat-2', label: 'Salah' },
            ],
            categoryResponseStatements: [
              { id: 'stmt-1', text: 'Pernyataan 1', correctCategoryId: '' },
            ],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
    answerKeys: [],
  };
  const valI = validateAssessmentPackage(unassignedCategoryPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valI.valid && valI.errors.some((e) => e.includes('belum menentukan kategori jawaban')),
    'Case I: Statement with no category answer key is rejected'
  );

  // ==========================================
  // CASE J: SHORT_ANSWER Response Mode
  // ==========================================
  console.log('\n--- Case J: SHORT_ANSWER Response Mode ---');
  const shortAnswerValidPkg: AssessmentPackage = {
    ...legacyPkg,
    instruments: [
      {
        id: 'inst-w-sa',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-sa-1',
            itemType: 'SHORT_ANSWER',
            responseMode: 'COMPLETION',
            prompt: 'Zat hijau daun pada tumbuhan disebut _____',
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
    answerKeys: [
      {
        id: 'ak-sa-1',
        instrumentId: 'inst-w-sa',
        instrumentItemId: 'item-sa-1',
        answerType: 'EXACT',
        value: 'Klorofil',
      },
    ],
    blueprintItems: [
      {
        id: 'bp-sa-1',
        objectiveRefId: 'tp-1',
        assessmentIndicator: 'Menuliskan istilah zat hijau daun',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-sa-1'],
        order: 1,
      },
    ],
  };

  const valJValid = validateAssessmentPackage(shortAnswerValidPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(valJValid.valid, 'Case J.1: SHORT_ANSWER with valid responseMode passes validation', undefined, valJValid.errors);

  const shortAnswerInvalidPkg: AssessmentPackage = {
    ...shortAnswerValidPkg,
    instruments: [
      {
        id: 'inst-w-sa',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-sa-1',
            itemType: 'SHORT_ANSWER',
            responseMode: 'INVALID_MODE' as any,
            prompt: 'Zat hijau daun pada tumbuhan disebut _____',
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const valJInvalid = validateAssessmentPackage(shortAnswerInvalidPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(!valJInvalid.valid && valJInvalid.errors.some((e) => e.includes('responseMode tidak valid')), 'Case J.2: Invalid responseMode is rejected');

  // ==========================================
  // CASE K: Extension - AssessmentBlueprintItem 9C Metadata
  // ==========================================
  console.log('\n--- Case K: Blueprint Item 9C Metadata Fields ---');
  const metadataBpPkg: AssessmentPackage = {
    ...legacyPkg,
    blueprintItems: [
      {
        id: 'bp-meta-1',
        objectiveRefId: 'tp-1',
        assessmentIndicator: 'Menganalisis reaksi fotosintesis dengan diagram',
        materialOrContext: 'Biokimia Tumbuhan',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-legacy-1'],
        order: 1,
        cognitiveDemand: 'ANALYZE_REASON',
        difficultyTarget: 'MODERATE',
        stimulusType: 'DIAGRAM',
        evidenceType: 'PRODUCT',
        recommendedItemCount: 2,
        estimatedMinutes: 10,
      },
    ],
  };
  const valK = validateAssessmentPackage(metadataBpPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(valK.valid, 'Case K: Blueprint item with complete 9C metadata fields passes validation', undefined, valK.errors);

  // ==========================================
  // CASE L: Range Validation - Negative Blueprint Item Count / Minutes
  // ==========================================
  console.log('\n--- Case L: Negative Blueprint Metadata Range Checks ---');
  const negativeBpPkg: AssessmentPackage = {
    ...legacyPkg,
    blueprintItems: [
      {
        id: 'bp-neg-1',
        objectiveRefId: 'tp-1',
        assessmentIndicator: 'Indikator valid',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-legacy-1'],
        order: 1,
        recommendedItemCount: -5,
        estimatedMinutes: -10,
      },
    ],
  };
  const valL = validateAssessmentPackage(negativeBpPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valL.valid &&
      valL.errors.some((e) => e.includes('recommendedItemCount tidak valid')) &&
      valL.errors.some((e) => e.includes('estimatedMinutes tidak valid')),
    'Case L: Negative recommendedItemCount and estimatedMinutes are rejected'
  );

  // ==========================================
  // CASE M: No Fake Pedagogical Defaults Principle
  // ==========================================
  console.log('\n--- Case M: Empty Package Creation Has No Fabricated Defaults ---');
  const freshPkg = createEmptyAssessmentPackage(mockPlan, 'setting-merdeka');
  assert(freshPkg.blueprintItems.length === 0, 'Case M.1: Blueprint starts completely empty');
  assert(freshPkg.instruments.length === 0, 'Case M.2: Instruments start empty without fabricated items');
  assert(freshPkg.rubrics.length === 0, 'Case M.3: Rubrics start empty without arbitrary descriptors');
  assert(freshPkg.answerKeys.length === 0, 'Case M.4: Answer keys start empty');

  // ==========================================
  // CASE N: Dependency Invalidation - MATCHING on Deleted Premise
  // ==========================================
  console.log('\n--- Case N: Dependency Invalidation on Mutated MATCHING ---');
  const mutatedMatchingPkg: AssessmentPackage = {
    ...validMatchingPkg,
    workflowStatus: 'SIAP',
    instruments: [
      {
        id: 'inst-w-m',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-m-1',
            itemType: 'MATCHING',
            prompt: 'Soal menjodohkan premis terhapus',
            // Notice: p-1 was removed, but pair still has premiseId 'p-1'
            matchingPremises: [{ id: 'p-2', text: 'Akar' }],
            matchingResponses: [
              { id: 'r-1', text: 'Menyerap air' },
              { id: 'r-2', text: 'Tempat fotosintesis' },
            ],
            matchingPairs: [{ premiseId: 'p-1', responseId: 'r-2' }],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const invN = invalidateAssessmentPackageDependencies(mutatedMatchingPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    invN.isInvalidated && invN.package.workflowStatus === 'PERLU_DILENGKAPI',
    'Case N: Mutated MATCHING with deleted premise causes fail-closed package invalidation'
  );

  // ==========================================
  // CASE O: Dependency Invalidation - CATEGORY_RESPONSE on Deleted Category
  // ==========================================
  console.log('\n--- Case O: Dependency Invalidation on Mutated CATEGORY_RESPONSE ---');
  const mutatedCategoryPkg: AssessmentPackage = {
    ...validCategoryPkg,
    workflowStatus: 'SIAP',
    instruments: [
      {
        id: 'inst-w-c',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-c-1',
            itemType: 'CATEGORY_RESPONSE',
            prompt: 'Soal kategori dengan categoryId terhapus',
            // Notice: cat-false was removed
            categoryResponseCategories: [{ id: 'cat-true', label: 'Benar' }],
            categoryResponseStatements: [
              { id: 'stmt-1', text: 'Pernyataan 1', correctCategoryId: 'cat-true' },
              { id: 'stmt-2', text: 'Pernyataan 2', correctCategoryId: 'cat-false' },
            ],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
  };
  const invO = invalidateAssessmentPackageDependencies(mutatedCategoryPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    invO.isInvalidated && invO.package.workflowStatus === 'PERLU_DILENGKAPI',
    'Case O: Mutated CATEGORY_RESPONSE with deleted category causes fail-closed invalidation'
  );

  // ==========================================
  // CASE P: Answer Key MATCHING Referential Integrity
  // ==========================================
  console.log('\n--- Case P: Answer Key MATCHING Dangling Reference ---');
  const badAnswerKeyMatchingPkg: AssessmentPackage = {
    ...validMatchingPkg,
    answerKeys: [
      {
        id: 'ak-bad-m',
        instrumentId: 'inst-w-m',
        instrumentItemId: 'item-m-1',
        answerType: 'MATCHING',
        matchingPairs: [{ premiseId: 'p-1', responseId: 'r-nonexistent' }],
      },
    ],
  };
  const valP = validateAssessmentPackage(badAnswerKeyMatchingPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valP.valid && valP.errors.some((e) => e.includes('Kunci jawaban') && e.includes('dangling reference')),
    'Case P: Answer key with dangling responseId is rejected'
  );

  // ==========================================
  // CASE Q: Answer Key CATEGORY_RESPONSE Referential Integrity
  // ==========================================
  console.log('\n--- Case Q: Answer Key CATEGORY_RESPONSE Dangling Reference ---');
  const badAnswerKeyCategoryPkg: AssessmentPackage = {
    ...validCategoryPkg,
    answerKeys: [
      {
        id: 'ak-bad-c',
        instrumentId: 'inst-w-c',
        instrumentItemId: 'item-c-1',
        answerType: 'CATEGORY_RESPONSE',
        categoryAnswers: [{ statementId: 'stmt-1', categoryId: 'cat-nonexistent' }],
      },
    ],
  };
  const valQ = validateAssessmentPackage(badAnswerKeyCategoryPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valQ.valid && valQ.errors.some((e) => e.includes('Kunci jawaban') && e.includes('dangling reference')),
    'Case Q: Answer key with dangling categoryId is rejected'
  );

  // ==========================================
  // CASE R: Answer Key MATCHING Duplicate Premise Pairing Rejected
  // ==========================================
  console.log('\n--- Case R: Answer Key MATCHING Duplicate Premise Pairing ---');
  const dupPremisePairPkg: AssessmentPackage = {
    ...validMatchingPkg,
    answerKeys: [
      {
        id: 'ak-dup-m',
        instrumentId: 'inst-w-m',
        instrumentItemId: 'item-m-1',
        answerType: 'MATCHING',
        matchingPairs: [
          { premiseId: 'p-1', responseId: 'r-1' },
          { premiseId: 'p-1', responseId: 'r-2' },
        ],
      },
    ],
  };
  const valR = validateAssessmentPackage(dupPremisePairPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valR.valid && valR.errors.some((e) => e.includes('duplikat pemasangan untuk premiseId')),
    'Case R: Answer key with duplicate premise pairing is rejected'
  );

  // ==========================================
  // CASE S: Answer Key CATEGORY_RESPONSE Duplicate Statement Assignment Rejected
  // ==========================================
  console.log('\n--- Case S: Answer Key CATEGORY_RESPONSE Duplicate Statement Assignment ---');
  const dupStmtAssignPkg: AssessmentPackage = {
    ...validCategoryPkg,
    answerKeys: [
      {
        id: 'ak-dup-c',
        instrumentId: 'inst-w-c',
        instrumentItemId: 'item-c-1',
        answerType: 'CATEGORY_RESPONSE',
        categoryAnswers: [
          { statementId: 'stmt-1', categoryId: 'cat-true' },
          { statementId: 'stmt-1', categoryId: 'cat-false' },
        ],
      },
    ],
  };
  const valS = validateAssessmentPackage(dupStmtAssignPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    !valS.valid && valS.errors.some((e) => e.includes('duplikat penugasan kategori untuk statementId')),
    'Case S: Answer key with duplicate statement assignment is rejected'
  );

  // ==========================================
  // CASE T: Pure SSOT - Item Has No Answer Fields, Only AnswerKey Has Canonical Answer
  // ==========================================
  console.log('\n--- Case T: Pure SSOT Validation ---');
  const pureSSOTMatchingPkg: AssessmentPackage = {
    ...validMatchingPkg,
    instruments: [
      {
        id: 'inst-w-m',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-m-1',
            itemType: 'MATCHING',
            prompt: 'Soal matching tanpa field answer pada item',
            matchingPremises: [
              { id: 'p-1', text: 'Daun' },
              { id: 'p-2', text: 'Akar' },
            ],
            matchingResponses: [
              { id: 'r-1', text: 'Fotosintesis' },
              { id: 'r-2', text: 'Menyerap air' },
            ],
            order: 1,
          },
        ],
      } as WrittenAssessmentInstrument,
    ],
    answerKeys: [
      {
        id: 'ak-pure-m',
        instrumentId: 'inst-w-m',
        instrumentItemId: 'item-m-1',
        answerType: 'MATCHING',
        matchingPairs: [
          { premiseId: 'p-1', responseId: 'r-1' },
          { premiseId: 'p-2', responseId: 'r-2' },
        ],
      },
    ],
  };
  const valT = validateAssessmentPackage(pureSSOTMatchingPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockPlan,
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  assert(
    valT.valid && valT.errors.length === 0,
    'Case T: Pure SSOT validation succeeds with canonical answers exclusively in AssessmentAnswerKey'
  );

  console.log(`\n=== REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
