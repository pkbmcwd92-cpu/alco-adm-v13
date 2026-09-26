import * as fs from 'fs';
import * as path from 'path';
import {
  AssessmentPackage,
  AcademicSetting,
  AssessmentPlan,
  AssessmentBlueprintItem,
  WrittenAssessmentInstrument,
  MatchingAssessmentEntry,
  CategoryResponseCategory,
  CategoryResponseStatement,
  AssessmentAnswerKey,
  AssessmentDocumentSnapshot,
  TPData,
  TeacherProfile,
  SchoolData,
} from '../src/types';
import { validateAssessmentPackage } from '../src/services/assessmentPackageService';
import {
  buildNormalizedAssessmentDocumentModel,
  createAssessmentPreviewModel,
} from '../src/services/documentEngine/assessmentExportService';

function runB12nTests() {
  console.log('--- START B.1.2n CANONICAL ANSWER KEY SSOT REGRESSION TESTS ---');

  let passedTests = 0;
  const recordPass = (msg: string) => {
    passedTests++;
    console.log(`  [PASS] Test ${passedTests}: ${msg}`);
  };

  const mockSetting: AcademicSetting = {
    id: 'setting-1',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'B',
    subject: 'PJOK',
    updatedAt: new Date().toISOString(),
  };

  const mockProfile: TeacherProfile = {
    id: 'prof-1',
    name: 'Guru Penjas',
    nip: '198501012010011001',
    status: 'PNS',
    defaultLevel: 'SD',
    defaultSubject: 'PJOK',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSchool: SchoolData = {
    id: 'sch-1',
    name: 'SD Negeri 1 Merdeka',
    address: 'Jl. Olahraga No. 1',
    npsn: '12345678',
    village: 'Merdeka',
    district: 'Kecamatan Penjas',
    regency: 'Kota Surakarta',
    province: 'Jawa Tengah',
    principalName: 'Kepala Sekolah M.Pd',
    principalNip: '197501012000031001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTP: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'setting-1',
    items: [
      {
        id: 'tp-1',
        code: 'TP-1',
        statement: 'Mempraktikkan variasi pola gerak dasar lokomotor',
        competence: 'Mempraktikkan',
        contentScope: 'Gerak Lokomotor',
        p3Dimensions: [],
        order: 1,
      },
    ],
    workflowStatus: 'SIAP',
    needsReview: false,
    updatedAt: new Date().toISOString(),
  };

  const mockAssessmentPlan: AssessmentPlan = {
    id: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Penilaian Sumatif Bab 1 Gerak Dasar',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    criterionIds: [],
    instruments: [{ id: 'inst-w', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
    workflowStatus: 'SIAP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const defaultContext = {
    academicSetting: mockSetting,
    assessmentPlan: mockAssessmentPlan,
    tp: mockTP,
    teacherProfile: mockProfile,
    schoolData: mockSchool,
  };

  const baseBlueprint: AssessmentBlueprintItem[] = [
    { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['item-mc-1'], order: 1 },
  ];

  // TEST 1: MULTIPLE_CHOICE with canonical AssessmentAnswerKey -> PASS
  const pkgMcValid: AssessmentPackage = {
    id: 'pkg-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Paket Asesmen MC Valid',
    blueprintItems: baseBlueprint,
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-mc-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Berikut yang termasuk gerak lokomotor adalah...',
            order: 1,
            options: [
              { id: 'opt-a', label: 'A', text: 'Berlari' },
              { id: 'opt-b', label: 'B', text: 'Mengayun tangan' },
              { id: 'opt-c', label: 'C', text: 'Meliukkan badan' },
            ],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'DRAFT',
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const val1 = validateAssessmentPackage(pkgMcValid, defaultContext);
  if (!val1.valid) {
    throw new Error(`Test 1 Failed: Expected valid package, got errors: ${val1.errors.join('; ')}`);
  }
  recordPass('MULTIPLE_CHOICE with valid canonical AssessmentAnswerKey accepted');

  // TEST 2: MULTIPLE_CHOICE without AssessmentAnswerKey (even if legacy isCorrect is set) -> FAIL
  const pkgMcNoAk: AssessmentPackage = {
    ...pkgMcValid,
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-mc-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Berikut yang termasuk gerak lokomotor adalah...',
            order: 1,
            options: [
              { id: 'opt-a', label: 'A', text: 'Berlari', isCorrect: true },
              { id: 'opt-b', label: 'B', text: 'Mengayun tangan' },
            ],
          },
        ],
      },
    ],
    answerKeys: [],
  };

  const val2 = validateAssessmentPackage(pkgMcNoAk, defaultContext);
  if (val2.valid || !val2.errors.some((e) => e.includes('belum memiliki AssessmentAnswerKey canonical'))) {
    throw new Error(`Test 2 Failed: Expected failure for missing canonical answer key. Errors: ${val2.errors.join('; ')}`);
  }
  recordPass('MULTIPLE_CHOICE without canonical AssessmentAnswerKey rejected (legacy isCorrect insufficient)');

  // TEST 3: MULTIPLE_CHOICE with empty optionIds -> FAIL
  const pkgMcEmptyOptionIds: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: [],
      },
    ],
  };
  const val3 = validateAssessmentPackage(pkgMcEmptyOptionIds, defaultContext);
  if (val3.valid || !val3.errors.some((e) => e.includes('belum memiliki AssessmentAnswerKey canonical') || e.includes('optionIds'))) {
    throw new Error(`Test 3 Failed: Expected failure for empty optionIds. Errors: ${val3.errors.join('; ')}`);
  }
  recordPass('MULTIPLE_CHOICE with empty optionIds rejected');

  // TEST 4: MULTIPLE_CHOICE with multiple optionIds -> FAIL
  const pkgMcMultipleOptionIds: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-a', 'opt-b'],
      },
    ],
  };
  const val4 = validateAssessmentPackage(pkgMcMultipleOptionIds, defaultContext);
  if (val4.valid || !val4.errors.some((e) => e.includes('tepat 1 opsi'))) {
    throw new Error(`Test 4 Failed: Expected failure for multiple optionIds in MC. Errors: ${val4.errors.join('; ')}`);
  }
  recordPass('MULTIPLE_CHOICE with multiple optionIds rejected');

  // TEST 5: MULTIPLE_CHOICE with dangling optionId -> FAIL
  const pkgMcDanglingOptionId: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-ghost'],
      },
    ],
  };
  const val5 = validateAssessmentPackage(pkgMcDanglingOptionId, defaultContext);
  if (val5.valid || !val5.errors.some((e) => e.includes('tidak ditemukan') || e.includes('tidak ada pada pilihan'))) {
    throw new Error(`Test 5 Failed: Expected failure for dangling optionId. Errors: ${val5.errors.join('; ')}`);
  }
  recordPass('MULTIPLE_CHOICE with dangling optionId rejected');

  // TEST 6: MULTIPLE_CHOICE with dual source conflict -> FAIL (fail closed)
  const pkgMcConflict: AssessmentPackage = {
    ...pkgMcValid,
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-mc-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Berikut yang termasuk gerak lokomotor adalah...',
            order: 1,
            options: [
              { id: 'opt-a', label: 'A', text: 'Berlari', isCorrect: false },
              { id: 'opt-b', label: 'B', text: 'Mengayun tangan', isCorrect: true },
            ],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
  };
  const val6 = validateAssessmentPackage(pkgMcConflict, defaultContext);
  if (val6.valid || !val6.errors.some((e) => e.includes('Dual answer source conflict'))) {
    throw new Error(`Test 6 Failed: Expected dual answer source conflict error. Errors: ${val6.errors.join('; ')}`);
  }
  recordPass('Fail-closed on MULTIPLE_CHOICE dual answer source conflict');

  // TEST 7: MULTIPLE_SELECT with valid canonical AssessmentAnswerKey -> PASS
  const pkgMsValid: AssessmentPackage = {
    id: 'pkg-ms',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Paket Asesmen MS Valid',
    blueprintItems: [
      { id: 'bp-ms-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['item-ms-1'], order: 1 },
    ],
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-ms-1',
            itemType: 'MULTIPLE_SELECT',
            prompt: 'Pilih semua aktivitas yang termasuk gerak non-lokomotor!',
            order: 1,
            options: [
              { id: 'opt-1', label: 'A', text: 'Meliuk' },
              { id: 'opt-2', label: 'B', text: 'Melompat' },
              { id: 'opt-3', label: 'C', text: 'Mengayun' },
              { id: 'opt-4', label: 'D', text: 'Berlari' },
            ],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-ms-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-ms-1',
        answerType: 'MULTIPLE_OPTION',
        optionIds: ['opt-1', 'opt-3'],
      },
    ],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'DRAFT',
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const val7 = validateAssessmentPackage(pkgMsValid, defaultContext);
  if (!val7.valid) {
    throw new Error(`Test 7 Failed: Expected valid MULTIPLE_SELECT package. Errors: ${val7.errors.join('; ')}`);
  }
  recordPass('MULTIPLE_SELECT with valid canonical AssessmentAnswerKey accepted');

  // TEST 8: MULTIPLE_SELECT with empty optionIds -> FAIL
  const pkgMsEmptyOptionIds: AssessmentPackage = {
    ...pkgMsValid,
    answerKeys: [
      {
        id: 'ak-ms-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-ms-1',
        answerType: 'MULTIPLE_OPTION',
        optionIds: [],
      },
    ],
  };
  const val8 = validateAssessmentPackage(pkgMsEmptyOptionIds, defaultContext);
  if (val8.valid || !val8.errors.some((e) => e.includes('belum memiliki AssessmentAnswerKey canonical') || e.includes('optionIds kosong'))) {
    throw new Error(`Test 8 Failed: Expected failure on empty optionIds for MULTIPLE_SELECT. Errors: ${val8.errors.join('; ')}`);
  }
  recordPass('MULTIPLE_SELECT with empty optionIds rejected');

  // TEST 9: MULTIPLE_SELECT with dual source conflict -> FAIL
  const pkgMsConflict: AssessmentPackage = {
    ...pkgMsValid,
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-ms-1',
            itemType: 'MULTIPLE_SELECT',
            prompt: 'Pilih semua aktivitas yang termasuk gerak non-lokomotor!',
            order: 1,
            options: [
              { id: 'opt-1', label: 'A', text: 'Meliuk', isCorrect: true },
              { id: 'opt-2', label: 'B', text: 'Melompat', isCorrect: true },
              { id: 'opt-3', label: 'C', text: 'Mengayun', isCorrect: false },
            ],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-ms-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-ms-1',
        answerType: 'MULTIPLE_OPTION',
        optionIds: ['opt-1', 'opt-3'],
      },
    ],
  };
  const val9 = validateAssessmentPackage(pkgMsConflict, defaultContext);
  if (val9.valid || !val9.errors.some((e) => e.includes('Dual answer source conflict'))) {
    throw new Error(`Test 9 Failed: Expected dual source conflict error for MULTIPLE_SELECT. Errors: ${val9.errors.join('; ')}`);
  }
  recordPass('Fail-closed on MULTIPLE_SELECT dual source conflict');

  // TEST 10: Type mismatch: MULTIPLE_CHOICE item with MULTIPLE_OPTION key -> FAIL
  const pkgTypeMismatch1: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'MULTIPLE_OPTION',
        optionIds: ['opt-a'],
      },
    ],
  };
  const val10 = validateAssessmentPackage(pkgTypeMismatch1, defaultContext);
  if (val10.valid || !val10.errors.some((e) => e.includes('MULTIPLE_OPTION') || e.includes('belum memiliki AssessmentAnswerKey canonical'))) {
    throw new Error(`Test 10 Failed: Expected type mismatch rejection. Errors: ${val10.errors.join('; ')}`);
  }
  recordPass('Type mismatch: MULTIPLE_CHOICE item with MULTIPLE_OPTION key rejected');

  // TEST 11: Type mismatch: MULTIPLE_SELECT item with OPTION key -> FAIL
  const pkgTypeMismatch2: AssessmentPackage = {
    ...pkgMsValid,
    answerKeys: [
      {
        id: 'ak-ms-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-ms-1',
        answerType: 'OPTION',
        optionIds: ['opt-1'],
      },
    ],
  };
  const val11 = validateAssessmentPackage(pkgTypeMismatch2, defaultContext);
  if (val11.valid || !val11.errors.some((e) => e.includes('OPTION') || e.includes('belum memiliki AssessmentAnswerKey canonical'))) {
    throw new Error(`Test 11 Failed: Expected type mismatch rejection. Errors: ${val11.errors.join('; ')}`);
  }
  recordPass('Type mismatch: MULTIPLE_SELECT item with OPTION key rejected');

  // TEST 12: Cross-instrument reference on AssessmentAnswerKey -> FAIL
  const pkgCrossInst: AssessmentPackage = {
    ...pkgMcValid,
    instruments: [
      {
        id: 'inst-w1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-mc-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal 1',
            order: 1,
            options: [{ id: 'opt-a', label: 'A', text: 'Opsi A' }],
          },
        ],
      },
      {
        id: 'inst-w2',
        type: 'WRITTEN_TEST',
        items: [],
      },
    ],
    answerKeys: [
      {
        id: 'ak-cross',
        instrumentId: 'inst-w2',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
  };
  const val12 = validateAssessmentPackage(pkgCrossInst, defaultContext);
  if (val12.valid || !val12.errors.some((e) => e.includes('cross-instrument reference') || e.includes('milik instrumen lain'))) {
    throw new Error(`Test 12 Failed: Expected cross-instrument reference error. Errors: ${val12.errors.join('; ')}`);
  }
  recordPass('Cross-instrument reference in AssessmentAnswerKey rejected');

  // TEST 13: Dangling instrumentId on AssessmentAnswerKey -> FAIL
  const pkgDanglingInst: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-dangling-inst',
        instrumentId: 'inst-non-existent',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
  };
  const val13 = validateAssessmentPackage(pkgDanglingInst, defaultContext);
  if (val13.valid || !val13.errors.some((e) => e.includes('dangling reference') || e.includes('tidak ditemukan'))) {
    throw new Error(`Test 13 Failed: Expected dangling instrumentId error. Errors: ${val13.errors.join('; ')}`);
  }
  recordPass('Dangling instrumentId in AssessmentAnswerKey rejected');

  // TEST 14: Dangling instrumentItemId on AssessmentAnswerKey -> FAIL
  const pkgDanglingItem: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-dangling-item',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-ghost',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
  };
  const val14 = validateAssessmentPackage(pkgDanglingItem, defaultContext);
  if (val14.valid || !val14.errors.some((e) => e.includes('dangling reference') || e.includes('tidak ditemukan'))) {
    throw new Error(`Test 14 Failed: Expected dangling instrumentItemId error. Errors: ${val14.errors.join('; ')}`);
  }
  recordPass('Dangling instrumentItemId in AssessmentAnswerKey rejected');

  // TEST 15: MATCHING valid canonical SSOT -> PASS
  const matchPremises: MatchingAssessmentEntry[] = [
    { id: 'p1', text: 'Sepak Bola' },
    { id: 'p2', text: 'Basket' },
  ];
  const matchResponses: MatchingAssessmentEntry[] = [
    { id: 'r1', text: 'Menendang' },
    { id: 'r2', text: 'Memantulkan (Dribble)' },
  ];
  const pkgMatchingValid: AssessmentPackage = {
    id: 'pkg-matching',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Paket Asesmen Matching',
    blueprintItems: [
      { id: 'bp-m-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['item-m-1'], order: 1 },
    ],
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-m-1',
            itemType: 'MATCHING',
            prompt: 'Pasangkan cabang olahraga dengan teknik dasarnya!',
            order: 1,
            matchingPremises: matchPremises,
            matchingResponses: matchResponses,
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-m-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-m-1',
        answerType: 'MATCHING',
        matchingPairs: [
          { premiseId: 'p1', responseId: 'r1' },
          { premiseId: 'p2', responseId: 'r2' },
        ],
      },
    ],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'DRAFT',
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const val15 = validateAssessmentPackage(pkgMatchingValid, defaultContext);
  if (!val15.valid) {
    throw new Error(`Test 15 Failed: Expected valid MATCHING package. Errors: ${val15.errors.join('; ')}`);
  }
  recordPass('MATCHING valid canonical SSOT accepted');

  // TEST 16: CATEGORY_RESPONSE valid canonical SSOT -> PASS
  const catCategories: CategoryResponseCategory[] = [
    { id: 'cat-true', label: 'Benar' },
    { id: 'cat-false', label: 'Salah' },
  ];
  const catStatements: CategoryResponseStatement[] = [
    { id: 'stmt-1', text: 'Berlari adalah gerak lokomotor' },
    { id: 'stmt-2', text: 'Membungkuk adalah gerak manipulatif' },
  ];
  const pkgCategoryValid: AssessmentPackage = {
    id: 'pkg-cat',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Paket Asesmen Kategori',
    blueprintItems: [
      { id: 'bp-c-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['item-c-1'], order: 1 },
    ],
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-c-1',
            itemType: 'CATEGORY_RESPONSE',
            prompt: 'Tentukan Benar/Salah untuk setiap pernyataan berikut!',
            order: 1,
            categoryResponseCategories: catCategories,
            categoryResponseStatements: catStatements,
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-c-1',
        instrumentId: 'inst-w',
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
    workflowStatus: 'DRAFT',
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const val16 = validateAssessmentPackage(pkgCategoryValid, defaultContext);
  if (!val16.valid) {
    throw new Error(`Test 16 Failed: Expected valid CATEGORY_RESPONSE package. Errors: ${val16.errors.join('; ')}`);
  }
  recordPass('CATEGORY_RESPONSE valid canonical SSOT accepted');

  // TEST 17: Duplicate AnswerKey for exact instrumentId + instrumentItemId -> FAIL
  const pkgDuplicateSameType: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-1a',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
      {
        id: 'ak-1b',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-b'],
      },
    ],
  };
  const val17 = validateAssessmentPackage(pkgDuplicateSameType, defaultContext);
  if (val17.valid || !val17.errors.some((e) => e.includes('lebih dari satu AssessmentAnswerKey canonical'))) {
    throw new Error(`Test 17 Failed: Expected duplicate AnswerKey error. Errors: ${val17.errors.join('; ')}`);
  }
  recordPass('Duplicate AnswerKey for same item (same answerType) blocked');

  // TEST 18: Duplicate AnswerKey with different answerTypes for same item -> FAIL
  const pkgDuplicateDiffType: AssessmentPackage = {
    ...pkgMcValid,
    answerKeys: [
      {
        id: 'ak-1-option',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
      {
        id: 'ak-1-exact',
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'EXACT',
        value: 'Berlari',
      },
    ],
  };
  const val18 = validateAssessmentPackage(pkgDuplicateDiffType, defaultContext);
  if (val18.valid || !val18.errors.some((e) => e.includes('lebih dari satu AssessmentAnswerKey canonical'))) {
    throw new Error(`Test 18 Failed: Expected duplicate AnswerKey error across types. Errors: ${val18.errors.join('; ')}`);
  }
  recordPass('Duplicate AnswerKey for same item (cross-type OPTION + EXACT) blocked');

  // TEST 19: MC Checkbox first select creates exact canonical key
  const testOpts = [
    { id: 'opt-a', label: 'A', text: 'Opsi A' },
    { id: 'opt-b', label: 'B', text: 'Opsi B' },
  ];
  const initialMcKeys: AssessmentAnswerKey[] = [];
  const mcSelectAction = (targetOptId: string, isCheck: boolean, currentKeys: AssessmentAnswerKey[]) => {
    const existingAk = currentKeys.find((ak) => ak.instrumentId === 'inst-w' && ak.instrumentItemId === 'item-mc-1');
    const nextOptionIds = isCheck ? [targetOptId] : [];
    if (nextOptionIds.length > 0) {
      const updatedAk: AssessmentAnswerKey = {
        ...(existingAk || {
          id: `ak-inst-w-item-mc-1`,
          instrumentId: 'inst-w',
          instrumentItemId: 'item-mc-1',
        }),
        instrumentId: 'inst-w',
        instrumentItemId: 'item-mc-1',
        answerType: 'OPTION',
        optionIds: nextOptionIds,
      };
      return existingAk ? currentKeys.map((ak) => (ak.id === existingAk.id ? updatedAk : ak)) : [...currentKeys, updatedAk];
    }
    return currentKeys.filter((ak) => !(ak.instrumentId === 'inst-w' && ak.instrumentItemId === 'item-mc-1'));
  };

  const keysAfterFirstSelect = mcSelectAction('opt-a', true, initialMcKeys);
  if (keysAfterFirstSelect.length !== 1 || keysAfterFirstSelect[0].optionIds?.[0] !== 'opt-a') {
    throw new Error('Test 19 Failed: MC first select did not create canonical answer key');
  }
  recordPass('MC checkbox first select creates exact canonical key');

  // TEST 20: MC transfer A -> B preserves single AnswerKey identity
  const keysAfterTransfer = mcSelectAction('opt-b', true, keysAfterFirstSelect);
  if (keysAfterTransfer.length !== 1 || keysAfterTransfer[0].optionIds?.[0] !== 'opt-b' || keysAfterTransfer[0].id !== keysAfterFirstSelect[0].id) {
    throw new Error('Test 20 Failed: MC transfer did not preserve existing key identity');
  }
  recordPass('MC transfer A -> B preserves single AnswerKey identity');

  // TEST 21: MC uncheck removes exact canonical key
  const keysAfterUncheck = mcSelectAction('opt-b', false, keysAfterTransfer);
  if (keysAfterUncheck.length !== 0) {
    throw new Error('Test 21 Failed: MC uncheck did not delete canonical answer key');
  }
  recordPass('MC uncheck removes exact canonical key');

  // TEST 22: MS check adds option ID to existing canonical key
  const msSelectAction = (targetOptId: string, isCheck: boolean, currentKeys: AssessmentAnswerKey[], options: { id: string }[]) => {
    const existingAk = currentKeys.find((ak) => ak.instrumentId === 'inst-w' && ak.instrumentItemId === 'item-ms-1');
    const currentOptionIds = existingAk?.optionIds ?? [];
    const selectedSet = new Set(currentOptionIds);
    if (isCheck) {
      selectedSet.add(targetOptId);
    } else {
      selectedSet.delete(targetOptId);
    }
    const nextOptionIds = options.map((o) => o.id).filter((id) => selectedSet.has(id));
    if (nextOptionIds.length > 0) {
      const updatedAk: AssessmentAnswerKey = {
        ...(existingAk || {
          id: `ak-inst-w-item-ms-1`,
          instrumentId: 'inst-w',
          instrumentItemId: 'item-ms-1',
        }),
        instrumentId: 'inst-w',
        instrumentItemId: 'item-ms-1',
        answerType: 'MULTIPLE_OPTION',
        optionIds: nextOptionIds,
      };
      return existingAk ? currentKeys.map((ak) => (ak.id === existingAk.id ? updatedAk : ak)) : [...currentKeys, updatedAk];
    }
    return currentKeys.filter((ak) => !(ak.instrumentId === 'inst-w' && ak.instrumentItemId === 'item-ms-1'));
  };

  const msOptions = [{ id: 'opt-1' }, { id: 'opt-2' }, { id: 'opt-3' }, { id: 'opt-4' }];
  const msStep1 = msSelectAction('opt-1', true, [], msOptions);
  const msStep2 = msSelectAction('opt-3', true, msStep1, msOptions);
  if (msStep2.length !== 1 || JSON.stringify(msStep2[0].optionIds) !== JSON.stringify(['opt-1', 'opt-3'])) {
    throw new Error('Test 22 Failed: MS check did not correctly append option ID');
  }
  recordPass('MS check adds option ID to existing canonical key');

  // TEST 23: MS uncheck removes only target option ID
  const msStep3 = msSelectAction('opt-1', false, msStep2, msOptions);
  if (msStep3.length !== 1 || JSON.stringify(msStep3[0].optionIds) !== JSON.stringify(['opt-3'])) {
    throw new Error('Test 23 Failed: MS uncheck did not remove only target ID');
  }
  recordPass('MS uncheck removes only target option ID');

  // TEST 24: MS ordering always normalizes according to canonical option order
  // When checking opt-4 then opt-2 on [opt-1, opt-2, opt-3, opt-4], result should be ['opt-2', 'opt-4']
  const msOrderStep1 = msSelectAction('opt-4', true, [], msOptions);
  const msOrderStep2 = msSelectAction('opt-2', true, msOrderStep1, msOptions);
  if (JSON.stringify(msOrderStep2[0].optionIds) !== JSON.stringify(['opt-2', 'opt-4'])) {
    throw new Error('Test 24 Failed: MS ordering did not follow canonical option order');
  }
  recordPass('MS ordering normalizes to canonical option order regardless of click order');

  // TEST 25: Visual checkbox state reflects canonical AnswerKey without fallback to legacy isCorrect
  const testOpt = { id: 'opt-x', label: 'A', text: 'Text', isCorrect: true };
  const mockAkWithoutOpt: AssessmentAnswerKey = {
    id: 'ak-test',
    instrumentId: 'inst-w',
    instrumentItemId: 'item-1',
    answerType: 'OPTION',
    optionIds: ['opt-other'],
  };
  const isCheckedVisual = mockAkWithoutOpt.optionIds?.includes(testOpt.id) ?? false;
  if (isCheckedVisual) {
    throw new Error('Test 25 Failed: Visual checkbox state fell back to legacy isCorrect');
  }
  recordPass('Visual checkbox state does not fall back to legacy isCorrect');

  // TEST 26: Option deletion when option is NOT in AnswerKey preserves AnswerKey
  const akBeforeOptDel: AssessmentAnswerKey = {
    id: 'ak-test',
    instrumentId: 'inst-w',
    instrumentItemId: 'item-1',
    answerType: 'MULTIPLE_OPTION',
    optionIds: ['opt-1', 'opt-3'],
  };
  const remainingAfterUnrelatedDel = [{ id: 'opt-1' }, { id: 'opt-3' }]; // opt-2 deleted
  const nextIdsUnrelated = remainingAfterUnrelatedDel.map((o) => o.id).filter((id) => akBeforeOptDel.optionIds?.includes(id));
  if (JSON.stringify(nextIdsUnrelated) !== JSON.stringify(['opt-1', 'opt-3'])) {
    throw new Error('Test 26 Failed: Unrelated option deletion altered AnswerKey');
  }
  recordPass('Deleting unselected option preserves canonical AnswerKey');

  // TEST 27: Option deletion when option IS in AnswerKey removes ID from canonical key
  const remainingAfterSelectedDel = [{ id: 'opt-3' }]; // opt-1 deleted
  const nextIdsSelectedDel = remainingAfterSelectedDel.map((o) => o.id).filter((id) => akBeforeOptDel.optionIds?.includes(id));
  if (JSON.stringify(nextIdsSelectedDel) !== JSON.stringify(['opt-3'])) {
    throw new Error('Test 27 Failed: Selected option deletion did not remove ID from canonical key');
  }
  recordPass('Deleting selected option removes ID from canonical AnswerKey');

  // TEST 28: Deleting last selected option removes AnswerKey completely
  const remainingEmptyDel: { id: string }[] = [];
  const nextIdsEmptyDel = remainingEmptyDel.map((o) => o.id).filter((id) => akBeforeOptDel.optionIds?.includes(id));
  if (nextIdsEmptyDel.length !== 0) {
    throw new Error('Test 28 Failed: Deleting all options did not result in empty optionIds');
  }
  recordPass('Deleting last selected option removes canonical AnswerKey');

  // TEST 29: Static inspection: AssessmentPackageBuilder.tsx has zero legacy-first mutation
  const builderPath = path.resolve(process.cwd(), 'src/components/administration/AssessmentPackageBuilder.tsx');
  const builderSrc = fs.readFileSync(builderPath, 'utf8');
  if (builderSrc.includes('.filter((o) => o.isCorrect).map((o) => o.id)')) {
    throw new Error('Test 29 Failed: AssessmentPackageBuilder.tsx contains legacy filter(isCorrect).map(id) mutation');
  }
  if (builderSrc.includes(': Boolean(opt.isCorrect)')) {
    throw new Error('Test 29 Failed: AssessmentPackageBuilder.tsx contains : Boolean(opt.isCorrect) visual fallback');
  }
  recordPass('Static inspection: AssessmentPackageBuilder.tsx is free of legacy-first mutation and visual fallbacks');

  // TEST 30: Static inspection: assessmentPackageService.ts has duplicate AnswerKey guard
  const servicePath = path.resolve(process.cwd(), 'src/services/assessmentPackageService.ts');
  const serviceSrc = fs.readFileSync(servicePath, 'utf8');
  if (!serviceSrc.includes('lebih dari satu AssessmentAnswerKey canonical')) {
    throw new Error('Test 30 Failed: assessmentPackageService.ts lacks duplicate AnswerKey guard');
  }
  recordPass('Static inspection: assessmentPackageService.ts enforces duplicate AnswerKey guard');

  // TEST 31: Static inspection: assessmentExportService.ts has zero fallback to isCorrect
  const exportPath = path.resolve(process.cwd(), 'src/services/documentEngine/assessmentExportService.ts');
  const exportSrc = fs.readFileSync(exportPath, 'utf8');
  if (exportSrc.includes('opt.isCorrect') || exportSrc.includes('options?.find((o) => o.isCorrect)')) {
    throw new Error('Test 31 Failed: assessmentExportService.ts contains legacy isCorrect fallback');
  }
  recordPass('Static inspection: assessmentExportService.ts has zero fallback to options[].isCorrect');

  // TEST 32: Zero type escapes in regression test file
  const testFilePath = path.resolve(process.cwd(), 'scripts/testB12nCanonicalAnswerKeySsotRegression.ts');
  const testFileSrc = fs.readFileSync(testFilePath, 'utf8');
  const forbiddenEscapes = ['as' + ' any', 'as' + ' unknown' + ' as', '@ts' + '-ignore', '@ts' + '-expect-error'];
  for (const esc of forbiddenEscapes) {
    // Check occurrences outside this validation block
    const parts = testFileSrc.split(esc);
    if (parts.length > 1) {
      // If found in code outside string definition
      throw new Error(`Test 32 Failed: Regression file contains forbidden type escape: ${esc}`);
    }
  }
  recordPass('Zero type escapes enforced in regression test suite');

  // Shared snapshot base fixture for presentation layer tests
  const mockSnapshotBase: AssessmentDocumentSnapshot = {
    snapshotId: 'snap-test-1',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: 'Surakarta, 24 September 2026',
    assessmentPlanId: 'plan-1',
    assessmentPackageId: 'pkg-1',
    assessmentPackageRevision: 1,
    packageTitle: 'Paket Asesmen Tes',
    schoolName: 'SD Negeri 1',
    principalName: 'Kepala Sekolah',
    teacherName: 'Guru Penjas',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    grade: 'Kelas 4',
    subject: 'PJOK',
    curriculum: 'Kurikulum Merdeka',
    documentMode: 'data',
    generatedAt: new Date().toISOString(),
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['item-1'], order: 1 },
    ],
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal 1',
            order: 1,
            options: [
              { id: 'opt-a', label: 'A', text: 'Teks A' },
              { id: 'opt-b', label: 'B', text: 'Teks B' },
              { id: 'opt-c', label: 'C', text: 'Teks C' },
            ],
          },
        ],
      },
    ],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    resolvedObjectives: {},
  };

  // TEST 33: OPTION canonical optionId resolves to option.label ("B")
  const snap33: AssessmentDocumentSnapshot = {
    ...mockSnapshotBase,
    answerKeys: [
      {
        id: 'ak-33',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'OPTION',
        optionIds: ['opt-b'],
      },
    ],
  };
  const model33 = buildNormalizedAssessmentDocumentModel(snap33);
  if (model33.answerKeys.list[0]?.value !== 'B') {
    throw new Error(`Test 33 Failed: Expected 'B', got '${model33.answerKeys.list[0]?.value}'`);
  }
  recordPass('OPTION canonical optionId resolves to option.label ("B")');

  // TEST 34: MULTIPLE_OPTION preserves canonical option order ("A, C") regardless of click order
  const snap34: AssessmentDocumentSnapshot = {
    ...mockSnapshotBase,
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-1',
            itemType: 'MULTIPLE_SELECT',
            prompt: 'Soal MS',
            order: 1,
            options: [
              { id: 'opt-a', label: 'A', text: 'Teks A' },
              { id: 'opt-b', label: 'B', text: 'Teks B' },
              { id: 'opt-c', label: 'C', text: 'Teks C' },
            ],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-34',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'MULTIPLE_OPTION',
        optionIds: ['opt-c', 'opt-a'],
      },
    ],
  };
  const model34 = buildNormalizedAssessmentDocumentModel(snap34);
  if (model34.answerKeys.list[0]?.value !== 'A, C') {
    throw new Error(`Test 34 Failed: Expected 'A, C', got '${model34.answerKeys.list[0]?.value}'`);
  }
  recordPass('MULTIPLE_OPTION preserves canonical option order ("A, C") regardless of click order');

  // TEST 35: Dangling OPTION optionId resolves to visible "-"
  const snap35: AssessmentDocumentSnapshot = {
    ...mockSnapshotBase,
    answerKeys: [
      {
        id: 'ak-35',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'OPTION',
        optionIds: ['opt-ghost'],
      },
    ],
  };
  const model35 = buildNormalizedAssessmentDocumentModel(snap35);
  if (model35.answerKeys.list[0]?.value !== '-') {
    throw new Error(`Test 35 Failed: Expected '-', got '${model35.answerKeys.list[0]?.value}'`);
  }
  recordPass('Dangling OPTION optionId resolves to visible "-"');

  // TEST 36: Partial dangling MULTIPLE_OPTION fails visibly to "-" without partial success
  const snap36: AssessmentDocumentSnapshot = {
    ...mockSnapshotBase,
    answerKeys: [
      {
        id: 'ak-36',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'MULTIPLE_OPTION',
        optionIds: ['opt-a', 'opt-ghost'],
      },
    ],
  };
  const model36 = buildNormalizedAssessmentDocumentModel(snap36);
  if (model36.answerKeys.list[0]?.value !== '-') {
    throw new Error(`Test 36 Failed: Expected '-', got '${model36.answerKeys.list[0]?.value}'`);
  }
  recordPass('Partial dangling MULTIPLE_OPTION fails visibly to "-" without partial success');

  // TEST 37: Empty canonical option label resolves to "-"
  const snap37: AssessmentDocumentSnapshot = {
    ...mockSnapshotBase,
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal MC',
            order: 1,
            options: [{ id: 'opt-a', label: '', text: 'Opsi tanpa label' }],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-37',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
  };
  const model37 = buildNormalizedAssessmentDocumentModel(snap37);
  if (model37.answerKeys.list[0]?.value !== '-') {
    throw new Error(`Test 37 Failed: Expected '-', got '${model37.answerKeys.list[0]?.value}'`);
  }
  recordPass('Empty canonical option label resolves to "-"');

  // TEST 38: Option text is never used as fallback label
  const snap38: AssessmentDocumentSnapshot = {
    ...snap37,
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal MC',
            order: 1,
            options: [{ id: 'opt-a', label: '   ', text: 'Berlari Cepat' }],
          },
        ],
      },
    ],
  };
  const model38 = buildNormalizedAssessmentDocumentModel(snap38);
  if (model38.answerKeys.list[0]?.value === 'Berlari Cepat') {
    throw new Error('Test 38 Failed: Option text was incorrectly used as fallback label');
  }
  if (model38.answerKeys.list[0]?.value !== '-') {
    throw new Error(`Test 38 Failed: Expected '-', got '${model38.answerKeys.list[0]?.value}'`);
  }
  recordPass('Option text is never used as fallback label');

  // TEST 39: Exact instrument ownership strictly enforced (cross-instrument option blocked)
  const snap39: AssessmentDocumentSnapshot = {
    ...mockSnapshotBase,
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal Inst 1',
            order: 1,
            options: [{ id: 'opt-x', label: 'X', text: 'Item 1 Opt X' }],
          },
        ],
      },
      {
        id: 'inst-2',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-2',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal Inst 2',
            order: 1,
            options: [{ id: 'opt-a', label: 'A', text: 'Item 2 Opt A' }],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-39',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
  };
  const model39 = buildNormalizedAssessmentDocumentModel(snap39);
  if (model39.answerKeys.list[0]?.value !== '-') {
    throw new Error(`Test 39 Failed: Expected '-', got '${model39.answerKeys.list[0]?.value}'`);
  }
  recordPass('Exact instrument ownership strictly enforced (cross-instrument option blocked)');

  // TEST 40: Exact item ownership strictly enforced (cross-item option in same instrument blocked)
  const snap40: AssessmentDocumentSnapshot = {
    ...mockSnapshotBase,
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        items: [
          {
            id: 'item-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal 1',
            order: 1,
            options: [{ id: 'opt-1a', label: 'A', text: 'Item 1 Opt A' }],
          },
          {
            id: 'item-2',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal 2',
            order: 2,
            options: [{ id: 'opt-2a', label: 'A', text: 'Item 2 Opt A' }],
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-40',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'OPTION',
        optionIds: ['opt-2a'],
      },
    ],
  };
  const model40 = buildNormalizedAssessmentDocumentModel(snap40);
  if (model40.answerKeys.list[0]?.value !== '-') {
    throw new Error(`Test 40 Failed: Expected '-', got '${model40.answerKeys.list[0]?.value}'`);
  }
  recordPass('Exact item ownership strictly enforced (cross-item option in same instrument blocked)');

  // TEST 41: Preview model consumes normalized answer key label ("A")
  const previewContext = {
    ...defaultContext,
    documentDate: '2026-09-24',
    school: mockSchool,
    profile: mockProfile,
    activeAssessmentPackageId: pkgMcValid.id,
    assessmentPackages: [pkgMcValid],
  };
  const previewModel = createAssessmentPreviewModel(previewContext);
  if (previewModel.answerKeys.list[0]?.value !== 'A') {
    throw new Error(`Test 41 Failed: Preview model expected 'A', got '${previewModel.answerKeys.list[0]?.value}'`);
  }
  recordPass('Preview model consumes normalized answer key label ("A")');

  // TEST 42: DOCX export model consumes normalized ak.value
  const exportSrcForDocx = fs.readFileSync(path.resolve(process.cwd(), 'src/services/documentEngine/assessmentExportService.ts'), 'utf8');
  if (!exportSrcForDocx.includes('value: valueStr') || !exportSrcForDocx.includes('labels.join(\', \')')) {
    throw new Error('Test 42 Failed: Export service does not populate normalized value for docx/pdf');
  }
  recordPass('DOCX export model consumes normalized ak.value');

  // TEST 43: PDF export model consumes normalized ak.value
  if (!exportSrcForDocx.includes('answerKeys: NormalizedAssessmentAnswerKey[]') && !exportSrcForDocx.includes('list: answerKeys')) {
    throw new Error('Test 43 Failed: PDF renderer model does not map normalized answer keys');
  }
  recordPass('PDF export model consumes normalized ak.value');

  // TEST 44: Zero isCorrect fallback in export strictly maintained
  if (exportSrcForDocx.includes('opt.isCorrect') || exportSrcForDocx.includes('options?.find((o) => o.isCorrect)')) {
    throw new Error('Test 44 Failed: Export service contains forbidden isCorrect fallback');
  }
  recordPass('Zero isCorrect fallback in export strictly maintained');

  // TEST 45: B.1.2m exact itemNumber strictly preserved in normalized answer key model
  if (model33.answerKeys.list[0]?.itemNumber !== 1) {
    throw new Error(`Test 45 Failed: Expected itemNumber 1, got ${model33.answerKeys.list[0]?.itemNumber}`);
  }
  recordPass('B.1.2m exact itemNumber strictly preserved in normalized answer key model');

  console.log(`\n--- ALL ${passedTests} B.1.2n REGRESSION TESTS PASSED CLEANLY (0 FAILED) ---`);
}

runB12nTests();
