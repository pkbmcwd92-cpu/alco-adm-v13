import {
  createEmptyLearningPlan,
  createAIDraftLearningPlan,
  validateLearningPlan,
  confirmLearningPlan,
} from '../src/services/learningPlanService';
import { generateModulAjar } from '../src/services/documentEngine/generators/modulAjarGenerator';
import { formatDocumentDate } from '../src/services/documentDateService';
import {
  CANONICAL_GRADUATE_PROFILE_DIMENSIONS,
  isCanonicalGraduateProfileDimension,
  validateGraduateProfileDimensions,
} from '../src/constants/graduateProfileDimensions';
import { APP_BUILD_ID } from '../src/config/buildInfo';
import { AcademicSetting, TPData, ATPData, LearningPlan, SchoolData, TeacherProfile } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

async function runM111RegressionSuite() {
  console.log('=== RUNNING M1.1.1 MODUL AJAR CANONICAL VALIDATION & DOCX PRIVACY REGRESSION SUITE ===\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
      failedCount++;
    }
  }

  // 1. Build ID verification
  console.log('--- Check 1: Build ID ---');
  assert(APP_BUILD_ID === 'M1.1.1-20260923-1', `Build ID must be M1.1.1-20260923-1 (Actual: ${APP_BUILD_ID})`);

  const mockSchool: SchoolData = {
    id: 's-m1',
    name: 'SMP Negeri 1 Nusantara',
    npsn: '10293847',
    address: 'Jl. Pendidikan No. 45',
    village: 'Merdeka',
    district: 'Pusat',
    regency: 'Kota Nusantara',
    province: 'Jawa',
    principalName: 'Dra. Hj. Siti Aminah, M.Pd.',
    principalNip: '197001011995032001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProfile: TeacherProfile = {
    id: 'p-m1',
    name: 'Budi Santoso, S.Pd., Gr.',
    nip: '198505152010011012',
    status: 'PNS',
    defaultSubject: 'Informatika',
    defaultLevel: 'SMP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSetting: AcademicSetting = {
    id: 'setting-m1',
    profileId: 'p-m1',
    subject: 'Informatika',
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
    id: 'tpdata-m1',
    academicSettingId: 'setting-m1',
    updatedAt: new Date().toISOString(),
    workflowStatus: 'SIAP',
    needsReview: false,
    items: [
      {
        id: 'tp-1',
        order: 1,
        code: 'TP 7.1',
        statement: 'Memahami konsep dasar algoritma dan representasi flowchart.',
        competence: 'Memahami',
        contentScope: 'Algoritma & Pemrograman',
        p3Dimensions: ['Penalaran Kritis'],
      },
    ],
  };

  const mockAtpData: ATPData = {
    id: 'atpdata-m1',
    academicSettingId: 'setting-m1',
    updatedAt: new Date().toISOString(),
    totalJP: 24,
    workflowStatus: 'SIAP',
    needsReview: false,
    basedOnTpUpdatedAt: mockTpData.updatedAt,
    items: [
      {
        id: 'atp-1',
        stepNumber: 1,
        tpId: 'tp-1',
        tpCode: 'TP 7.1',
        tpStatement: 'Memahami konsep dasar algoritma dan representasi flowchart.',
        materialScope: 'Algoritma & Pemrograman',
        jp: 6,
        semester: 1,
      },
    ],
  };

  // Check 2: Validation blocks SIAP if print-readiness fields are missing
  console.log('\n--- Check 2: Print-readiness Finalization Gate ---');
  const incompleteSiapPlan: LearningPlan = {
    id: 'lp-inc',
    academicSettingId: 'setting-m1',
    curriculumType: 'KURIKULUM_MERDEKA',
    sourceType: 'AI_DRAFT',
    status: 'SIAP',
    confirmedAt: new Date().toISOString(),
    tpIds: ['tp-1'],
    atpItemIds: ['atp-1'],
    title: 'Modul Ajar Algoritma',
    topic: 'Algoritma & Pemrograman',
    objectives: [
      {
        id: 'obj-1',
        tpId: 'tp-1',
        code: 'TP 7.1',
        statement: 'Memahami konsep dasar algoritma dan representasi flowchart.',
        materialScope: 'Algoritma & Pemrograman',
      },
    ],
    learningExperiences: [
      { id: 'e1', phase: 'UNDERSTAND', description: 'Mempelajari konsep flowchart', durationMinutes: 20 },
      { id: 'e2', phase: 'APPLY', description: 'Membuat diagram alir aktivitas sehari-hari', durationMinutes: 50 },
      { id: 'e3', phase: 'REFLECT', description: 'Merefleksi kejelasan algoritma', durationMinutes: 20 },
    ],
    assessmentPlan: {
      initial: [{ id: 'a1', type: 'INITIAL', description: 'Pertanyaan pemantik', linkedTpIds: ['tp-1'] }],
      formative: [{ id: 'a2', type: 'FORMATIVE', description: 'Observasi diagram alir', linkedTpIds: ['tp-1'] }],
      summative: [{ id: 'a3', type: 'SUMMATIVE', description: 'Tes tertulis', linkedTpIds: ['tp-1'] }],
    },
    // Missing: initialCompetency, graduateProfileDimensions, resources, learningModel
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const incompleteVal = validateLearningPlan(incompleteSiapPlan, {
    academicSetting: mockSetting,
    tp: mockTpData,
    atp: mockAtpData,
  });

  assert(
    !incompleteVal.valid &&
      incompleteVal.finalizationErrors.some((e) => e.includes('Kompetensi Awal')) &&
      incompleteVal.finalizationErrors.some((e) => e.includes('Dimensi Profil Lulusan')) &&
      incompleteVal.finalizationErrors.some((e) => e.includes('Sarana')) &&
      incompleteVal.finalizationErrors.some((e) => e.includes('Model/praktik')),
    'validateLearningPlan must block SIAP when print-readiness fields are missing',
    incompleteVal.finalizationErrors.join(' | ')
  );

  // Check 3: M1.1-B Canonical 8 Graduate Profile Dimensions Validation
  console.log('\n--- Check 3: M1.1-B Canonical Graduate Profile Dimensions Validation ---');
  assert(
    CANONICAL_GRADUATE_PROFILE_DIMENSIONS.length === 8,
    'Canonical graduate profile dimensions count must be exactly 8'
  );

  assert(
    isCanonicalGraduateProfileDimension('Penalaran Kritis') &&
      isCanonicalGraduateProfileDimension('Kemandirian') &&
      isCanonicalGraduateProfileDimension('Keimanan dan Ketakwaan terhadap Tuhan Yang Maha Esa') &&
      isCanonicalGraduateProfileDimension('Kewargaan') &&
      isCanonicalGraduateProfileDimension('Kreativitas') &&
      isCanonicalGraduateProfileDimension('Kolaborasi') &&
      isCanonicalGraduateProfileDimension('Kesehatan') &&
      isCanonicalGraduateProfileDimension('Komunikasi'),
    'All 8 canonical dimensions are recognized'
  );

  // Reject unknown values (fail-closed, no auto correction)
  const unknownValidation = validateGraduateProfileDimensions(['Berpikir Hebat']);
  assert(
    !unknownValidation.isValid &&
      unknownValidation.invalidDimensions.includes('Berpikir Hebat') &&
      unknownValidation.error?.includes('Berpikir Hebat'),
    'Unknown dimension ["Berpikir Hebat"] is rejected by canonical validator'
  );

  const mixedValidation = validateGraduateProfileDimensions(['Penalaran Kritis', 'Profil Pelajar Pancasila']);
  assert(
    !mixedValidation.isValid &&
      mixedValidation.invalidDimensions.includes('Profil Pelajar Pancasila'),
    'Mixed array containing non-canonical value is rejected'
  );

  const validDimensionsResult = validateGraduateProfileDimensions(['Penalaran Kritis', 'Kemandirian']);
  assert(
    validDimensionsResult.isValid &&
      validDimensionsResult.dimensions.length === 2 &&
      validDimensionsResult.invalidDimensions.length === 0,
    'Valid canonical dimensions array passes validation'
  );

  const emptyDimensionsResult = validateGraduateProfileDimensions([]);
  assert(
    !emptyDimensionsResult.isValid,
    'Empty graduateProfileDimensions array is rejected'
  );

  const blankDimensionResult = validateGraduateProfileDimensions([
    'Penalaran Kritis',
    '',
  ]);
  assert(
    !blankDimensionResult.isValid &&
      blankDimensionResult.error?.includes('butir ke-2'),
    'Blank dimension item is rejected instead of silently dropped'
  );

  const whitespaceDimensionResult = validateGraduateProfileDimensions([
    'Penalaran Kritis',
    '   ',
  ]);
  assert(
    !whitespaceDimensionResult.isValid &&
      whitespaceDimensionResult.error?.includes('butir ke-2'),
    'Whitespace-only dimension item is rejected instead of silently dropped'
  );

  const nonStringDimensionResult = validateGraduateProfileDimensions([
    'Penalaran Kritis',
    123,
  ] as any);
  assert(
    !nonStringDimensionResult.isValid &&
      nonStringDimensionResult.error?.includes('butir ke-2'),
    'Non-string dimension item is rejected instead of silently dropped'
  );

  const nullDimensionResult = validateGraduateProfileDimensions([
    'Penalaran Kritis',
    null,
  ] as any);
  assert(
    !nullDimensionResult.isValid &&
      nullDimensionResult.error?.includes('butir ke-2'),
    'Null dimension item is rejected instead of silently dropped'
  );

  const undefinedDimensionResult = validateGraduateProfileDimensions([
    'Penalaran Kritis',
    undefined,
  ] as any);
  assert(
    !undefinedDimensionResult.isValid &&
      undefinedDimensionResult.error?.includes('butir ke-2'),
    'Undefined dimension item is rejected instead of silently dropped'
  );

  const trimmedDimensionResult = validateGraduateProfileDimensions([
    ' Penalaran Kritis ',
  ]);
  assert(
    trimmedDimensionResult.isValid &&
      trimmedDimensionResult.dimensions[0] === 'Penalaran Kritis',
    'Outer whitespace is safely trimmed for a canonical dimension'
  );

  // LearningPlan validator draft error with invalid dimension
  const draftWithInvalidDim: LearningPlan = {
    ...incompleteSiapPlan,
    status: 'DRAFT',
    graduateProfileDimensions: ['Penalaran Kritis', 'Dimensi Palsu'],
  };
  const draftVal = validateLearningPlan(draftWithInvalidDim, { academicSetting: mockSetting });
  assert(
    draftVal.errors.some((e) => e.includes('Dimensi Profil Lulusan tidak valid: Dimensi Palsu')),
    'Draft with non-canonical dimension produces explicit validation error'
  );

  const draftWithMalformedDim: LearningPlan = {
    ...incompleteSiapPlan,
    status: 'DRAFT',
    graduateProfileDimensions: ['Penalaran Kritis', 123] as any,
  };

  const malformedDraftVal = validateLearningPlan(
    draftWithMalformedDim,
    { academicSetting: mockSetting }
  );

  assert(
    malformedDraftVal.errors.some(
      (error) =>
        error.includes('Dimensi Profil Lulusan') &&
        error.includes('butir ke-2')
    ),
    'LearningPlan validator rejects malformed graduateProfileDimensions through shared validator'
  );

  // Check 4: Complete Print-Ready Plan passes validation
  console.log('\n--- Check 4: Complete Print-Ready Plan passes validation ---');
  const completeSiapPlan: LearningPlan = {
    ...incompleteSiapPlan,
    id: 'lp-complete',
    initialCompetency: 'Murid diharapkan telah mengenal konsep instruksi berurutan dalam kehidupan sehari-hari.',
    graduateProfileDimensions: ['Penalaran Kritis', 'Kemandirian'],
    resources: [
      { id: 'r1', title: 'Buku Siswa Informatika Kelas VII', source: 'Kemendikbudristek' },
      { id: 'r2', title: 'Lembar Kerja Aktivitas Algoritma' },
    ],
    learningModel: 'Pembelajaran Kontekstual melalui demonstrasi, pemecahan masalah bertahap, dan refleksi mandiri.',
    meaningfulUnderstanding: 'Algoritma membantu menyelesaikan masalah terstruktur secara logis dan terurut.',
    triggerQuestions: ['Bagaimana komputer dapat mengikuti instruksi dengan tepat?'],
  };

  const completeVal = validateLearningPlan(completeSiapPlan, {
    academicSetting: mockSetting,
    tp: mockTpData,
    atp: mockAtpData,
  });

  assert(
    completeVal.valid,
    'validateLearningPlan must pass for complete print-ready SIAP plan',
    completeVal.errors.join(' | ')
  );

  // Check 5: DOCX Generation produces valid file
  console.log('\n--- Check 5: DOCX Export Output ---');

  const docxResult = await generateModulAjar({
    school: mockSchool,
    profile: mockProfile,
    academicSetting: mockSetting,
    learningPlans: [completeSiapPlan],
    tp: mockTpData,
    atp: mockAtpData,
    documentDate: '2030-01-15',
    skipDownload: true,
  });

  assert(
    docxResult.success &&
      !!docxResult.blob &&
      docxResult.fileName.endsWith('.docx'),
    'DOCX Generator generates valid Modul Ajar document blob',
    `fileName: ${docxResult.fileName}`
  );

  // E3: Date Format check
  assert(
    formatDocumentDate('2030-01-15') === '15 Januari 2030',
    'Canonical document date formats deterministic future date'
  );

  // Check 6: Deterministic DOCX privacy source regression
  console.log('\n--- Check 6: DOCX Export Privacy Source Guard & Document Date Guards ---');

  const docxGeneratorPath = path.join(
    process.cwd(),
    'src/services/documentEngine/generators/modulAjarGenerator.ts'
  );

  const docxGeneratorSource = fs.readFileSync(
    docxGeneratorPath,
    'utf-8'
  );

  // E1 & E2 Source guards
  assert(
    docxGeneratorSource.includes('context.documentDate'),
    'Modul Ajar signoff must use canonical context.documentDate'
  );

  assert(
    !docxGeneratorSource.includes('context.workspace?.documentDate || context.snapshot?.documentDate'),
    'Modul Ajar must not resolve document date independently'
  );

  // Ignore comments so documentation words do not create false positives.
  const executableDocxSource = docxGeneratorSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const forbiddenDocxTokens = [
    'AI_DRAFT',
    'Status Dokumen',
    'Status Rencana',
    'Jumlah Murid',
    'Jumlah Siswa',
    'Administrasi Guru AI',
    'generatedBy',
    'sourceType',
  ];

  for (const token of forbiddenDocxTokens) {
    assert(
      !executableDocxSource.includes(token),
      `DOCX Modul Ajar production renderer must not expose forbidden token: ${token}`
    );
  }

  console.log(`\n==========================================`);
  console.log(`TOTAL PASSED: ${passedCount}`);
  console.log(`TOTAL FAILED: ${failedCount}`);
  console.log(`==========================================`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runM111RegressionSuite();
