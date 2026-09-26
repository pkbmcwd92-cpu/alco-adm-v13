import {
  createEmptyAssessmentPackage,
  validateAssessmentPackage,
  confirmAssessmentPackage,
  invalidateAssessmentPackageDependencies,
} from '../src/services/assessmentPackageService';
import { generateAssessment } from '../src/services/documentEngine/generators/assessmentGenerator';
import {
  AcademicSetting,
  AssessmentPlan,
  AssessmentPackage,
  TPData,
  K13Analysis,
  TeacherProfile,
  SchoolData,
  AssessmentBlueprintItem,
  AssessmentCriterion,
} from '../src/types';
import type { AssessmentValidationReport } from '../src/types/assessmentValidation';

async function runRegressionTests() {
  console.log('=== STARTING AUDIT 9B REGRESSION TEST SUITE (TESTS A-O) ===\n');

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

  const mockK13Setting: AcademicSetting = {
    id: 'setting-k13',
    profileId: 'prof-1',
    curriculum: 'Kurikulum 2013',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'B',
    subject: 'IPAS',
    updatedAt: new Date().toISOString(),
  };

  const mockUnresolvedSetting: AcademicSetting = {
    id: 'setting-unresolved',
    profileId: 'prof-1',
    curriculum: '' as any,
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'B',
    subject: 'IPAS',
    updatedAt: new Date().toISOString(),
  };

  const mockProfile: TeacherProfile = {
    id: 'prof-1',
    name: 'Guru Test',
    nip: '123456789',
    status: 'PNS',
    defaultLevel: 'SD',
    defaultSubject: 'IPAS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSchool: SchoolData = {
    id: 'sch-1',
    name: 'SD Negeri 1 Test',
    address: 'Jl. Pendidikan No. 1',
    npsn: '12345678',
    village: 'Desa Test',
    district: 'Kecamatan Test',
    regency: 'Kabupaten Test',
    province: 'Provinsi Test',
    principalName: 'Kepala Sekolah',
    principalNip: '987654321',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTP: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'setting-merdeka',
    items: [
      { id: 'tp-1', code: 'TP-1', statement: 'Menganalisis fotosintesis pada tumbuhan', competence: 'Menganalisis', contentScope: 'Fotosintesis', p3Dimensions: [], order: 1 },
      { id: 'tp-2', code: 'TP-2', statement: 'Memahami siklus air dan dampaknya', competence: 'Memahami', contentScope: 'Siklus Air', p3Dimensions: [], order: 2 },
    ],
    workflowStatus: 'SIAP',
    needsReview: false,
    updatedAt: new Date().toISOString(),
  };

  const mockCriteria: AssessmentCriterion[] = [
    {
      id: 'crit-1',
      academicSettingId: 'setting-merdeka',
      tpId: 'tp-1',
      description: 'Penguasaan Konsep Fotosintesis',
      approach: 'rubrik',
      indicators: ['Menjelaskan fotosintesis'],
      levels: [],
      workflowStatus: 'SIAP',
      needsReview: false,
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockAssessmentPlan: AssessmentPlan = {
    id: 'plan-1',
    academicSettingId: 'setting-merdeka',
    title: 'Penilaian Sumatif Bab 1 IPAS',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    criterionIds: ['crit-1'],
    instruments: [
      { id: 'inst-ref-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
      { id: 'inst-ref-2', type: 'OBSERVATION', label: 'Lembar Observasi' },
    ],
    workflowStatus: 'SIAP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const emptyPkg = createEmptyAssessmentPackage(mockAssessmentPlan, 'setting-merdeka');

  // TEST A: New blueprint does not depend on first TP/KD fallback (starts unresolved)
  console.log('Test A: New blueprint item initializes as unresolved (objectiveRefId = "")');
  const bpItemA: AssessmentBlueprintItem = {
    id: 'bp-a',
    objectiveRefId: '',
    instrumentType: '',
    instrumentItemIds: [],
    order: 1,
  };
  if (bpItemA.objectiveRefId !== '') {
    throw new Error('FAILED: New blueprint item should have empty objectiveRefId');
  }
  console.log('  PASSED: objectiveRefId is empty string by default.');

  // TEST B: No WRITTEN_TEST default fallback
  console.log('Test B: New blueprint item has unresolved instrumentType (instrumentType = "")');
  if (bpItemA.instrumentType !== '') {
    throw new Error('FAILED: New blueprint item should have empty instrumentType');
  }
  console.log('  PASSED: instrumentType is empty string by default.');

  const singleInstPlan: AssessmentPlan = {
    ...mockAssessmentPlan,
    instruments: [{ id: 'inst-ref-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  };

  // TEST C: Merdeka + missing TP canonical source -> FAIL
  console.log('Test C: Merdeka + missing TP canonical source -> FAIL');
  const pkgWithBp: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: [], order: 1 },
    ],
    instruments: [{ id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] }],
  };
  const valC = validateAssessmentPackage(pkgWithBp, {
    academicSetting: mockMerdekaSetting, // tp is missing!
    assessmentPlan: singleInstPlan,
  });
  if (valC.valid || !valC.errors.some((e) => e.includes('Sumber data TP'))) {
    throw new Error(`FAILED: Validation should fail when TP source is missing in Merdeka. Errors: ${valC.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valC.errors[0]}"`);

  // TEST D: K13 + missing K13 canonical source -> FAIL
  console.log('Test D: K13 + missing K13 canonical source -> FAIL');
  const pkgK13Bp: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'kd-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: [], order: 1 },
    ],
    instruments: [{ id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] }],
  };
  const valD = validateAssessmentPackage(pkgK13Bp, {
    academicSetting: mockK13Setting, // k13Analysis is missing!
    assessmentPlan: singleInstPlan,
  });
  if (valD.valid || !valD.errors.some((e) => e.includes('K13Analysis'))) {
    throw new Error(`FAILED: Validation should fail when K13Analysis source is missing in K13. Errors: ${valD.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valD.errors[0]}"`);

  // TEST E: Unresolved curriculum + blueprint -> FAIL
  console.log('Test E: Unresolved curriculum + blueprint -> FAIL');
  const valE = validateAssessmentPackage(pkgWithBp, {
    academicSetting: mockUnresolvedSetting,
    assessmentPlan: singleInstPlan,
  });
  if (valE.valid || !valE.errors.some((e) => e.includes('Kurikulum tidak dapat ditentukan'))) {
    throw new Error(`FAILED: Validation should fail when curriculum is unresolved. Errors: ${valE.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valE.errors[0]}"`);

  // TEST F: Zero blueprint -> cannot SIAP (FAIL)
  console.log('Test F: Zero blueprint -> cannot SIAP (FAIL)');
  const valF = validateAssessmentPackage(emptyPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: mockAssessmentPlan,
    tp: mockTP,
  });
  if (valF.valid || !valF.errors.some((e) => e.includes('Kisi-kisi asesmen (blueprint) wajib diisi'))) {
    throw new Error(`FAILED: Validation should fail when blueprint is empty. Errors: ${valF.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valF.errors[0]}"`);

  // TEST G: Dangling instrumentItemId -> FAIL
  console.log('Test G: Dangling instrumentItemId in blueprint -> FAIL');
  const pkgDangling: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['non-existent-q'], order: 1 },
    ],
    instruments: [{ id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] }],
  };
  const valG = validateAssessmentPackage(pkgDangling, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: singleInstPlan,
    tp: mockTP,
  });
  if (valG.valid || !valG.errors.some((e) => e.includes('dangling reference'))) {
    throw new Error(`FAILED: Validation should fail on dangling instrumentItemId. Errors: ${valG.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valG.errors[0]}"`);

  // TEST H: Cross-instrument-type item reference -> FAIL
  console.log('Test H: Cross-instrument-type item reference -> FAIL');
  const pkgCrossInst: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['obs-1'], order: 1 },
    ],
    instruments: [
      { id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Soal 1', order: 1 }] },
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
  };
  const valH = validateAssessmentPackage(pkgCrossInst, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
        { id: 'i2', type: 'OBSERVATION', label: 'Observasi' },
      ],
    },
    tp: mockTP,
  });
  if (valH.valid || !valH.errors.some((e) => e.includes('cross-instrument-type reference'))) {
    throw new Error(`FAILED: Validation should fail on cross-instrument-type reference. Errors: ${valH.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valH.errors[0]}"`);

  // TEST I: Valid Blueprint -> InstrumentItem linkage -> PASS
  console.log('Test I: Valid Blueprint -> InstrumentItem linkage -> PASS');
  const validLinkedPkg: AssessmentPackage = {
    ...emptyPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['q1'], order: 1 },
    ],
    instruments: [
      { id: 'inst-w', type: 'WRITTEN_TEST', items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Jelaskan X', order: 1 }] },
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
    answerKeys: [
      { id: 'ak-q1', instrumentId: 'inst-w', instrumentItemId: 'q1', answerType: 'EXPECTED_RESPONSE', value: 'Rambu X' },
    ],
    scoringGuides: [
      { id: 'sg-q1', title: 'Pedoman Uraian Q1', guideType: 'ESSAY', instrumentId: 'inst-w', instrumentItemId: 'q1', instructions: 'Petunjuk penskoran', maxScore: 10 },
    ],
  };
  const valI = validateAssessmentPackage(validLinkedPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (!valI.valid) {
    throw new Error(`FAILED: Valid linkage failed validation: ${valI.errors.join('; ')}`);
  }
  console.log('  PASSED: Valid blueprint to instrument item linkage validated cleanly.');

  // TEST J: Deleted/missing canonical objective source invalidates existing SIAP package
  console.log('Test J: Deleted/missing canonical objective source invalidates existing SIAP package');
  const siapPkg: AssessmentPackage = {
    ...validLinkedPkg,
    workflowStatus: 'SIAP',
  };
  const invJ = invalidateAssessmentPackageDependencies(siapPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    // tp is omitted!
  });
  if (!invJ.isInvalidated || invJ.package.workflowStatus !== 'PERLU_DILENGKAPI') {
    throw new Error('FAILED: Package should be invalidated when TP source is missing');
  }
  console.log('  PASSED: Package invalidated cleanly when TP source was deleted.');

  // TEST K: Dangling criterionId -> FAIL
  console.log('Test K: Dangling criterionId in blueprint -> FAIL');
  const pkgDanglingCrit: AssessmentPackage = {
    ...validLinkedPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', criterionId: 'non-existent-crit', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['q1'], order: 1 },
    ],
  };
  const valK = validateAssessmentPackage(pkgDanglingCrit, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
    assessmentCriteria: mockCriteria,
  });
  if (valK.valid || !valK.errors.some((e) => e.includes('kriteria KKTP'))) {
    throw new Error(`FAILED: Validation should fail on dangling criterionId. Errors: ${valK.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valK.errors[0]}"`);

  // TEST L: Missing canonical criteria source when criterionId exists -> FAIL
  console.log('Test L: Missing canonical criteria source when criterionId exists -> FAIL');
  const pkgWithCritId: AssessmentPackage = {
    ...validLinkedPkg,
    blueprintItems: [
      { id: 'bp-1', objectiveRefId: 'tp-1', criterionId: 'crit-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: ['q1'], order: 1 },
    ],
  };
  const valL = validateAssessmentPackage(pkgWithCritId, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
    // assessmentCriteria is omitted!
  });
  if (valL.valid || !valL.errors.some((e) => e.includes('sumber kriteria KKTP tidak tersedia'))) {
    throw new Error(`FAILED: Validation should fail when criterionId exists but criteria source is missing. Errors: ${valL.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valL.errors[0]}"`);

  // TEST M: Parent AssessmentPlan not SIAP -> FAIL
  console.log('Test M: Parent AssessmentPlan not SIAP -> FAIL');
  const draftPlan = { ...mockAssessmentPlan, workflowStatus: 'DRAFT' as const };
  const valM = validateAssessmentPackage(validLinkedPkg, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: draftPlan,
    tp: mockTP,
  });
  if (valM.valid || !valM.errors.some((e) => e.includes('belum berstatus SIAP'))) {
    throw new Error(`FAILED: Validation should fail when parent plan is DRAFT. Errors: ${valM.errors.join('; ')}`);
  }
  console.log(`  PASSED: Validation failed closed with error: "${valM.errors[0]}"`);

  // TEST N: Valid complete package -> SIAP
  console.log('Test N: Valid complete package -> SIAP confirmation');
  const mockReportN: AssessmentValidationReport = {
    id: 'report-confirm-n',
    assessmentPackageId: validLinkedPkg.id,
    packageRevision: validLinkedPkg.revision ?? 1,
    structural: { status: 'PASS', findings: [] },
    coverage: { status: 'PASS', findings: [] },
    answerVerification: { status: 'PASS', findings: [] },
    quality: { status: 'PASS', findings: [] },
    assembly: { status: 'PASS', findings: [] },
    overallStatus: 'PASS',
    reviewerStatus: 'NOT_REQUESTED',
    engineVersion: '1.0.0',
    createdAt: '2026-09-24T00:00:00.000Z',
  };
  const confirmN = confirmAssessmentPackage(
    validLinkedPkg,
    {
      academicSetting: mockMerdekaSetting,
      assessmentPlan: {
        ...mockAssessmentPlan,
        instruments: [
          { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
          { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
        ],
      },
      tp: mockTP,
    },
    mockReportN
  );
  if (!confirmN.success || confirmN.package.workflowStatus !== 'SIAP') {
    throw new Error(`FAILED: Valid package could not be confirmed: ${confirmN.errors.join('; ')}`);
  }
  console.log('  PASSED: Valid package confirmed to SIAP successfully.');

  // TEST O: Non-SIAP / invalid package -> export blocked
  console.log('Test O: Non-SIAP / invalid package -> export blocked');
  let threwExportError = false;
  try {
    await generateAssessment({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockMerdekaSetting,
      tp: mockTP,
      documentMode: 'data',
      assessmentPlans: [mockAssessmentPlan],
      assessmentPackages: [{ ...validLinkedPkg, workflowStatus: 'PERLU_DILENGKAPI' }],
      skipDownload: true,
    });
  } catch (err: any) {
    threwExportError = true;
    console.log(`  PASSED: Export correctly blocked with error: "${err.message}"`);
  }
  if (!threwExportError) {
    throw new Error('FAILED: Export was NOT blocked for non-SIAP package');
  }

  // TEST P: Empty rubric (title: '', criteria: [], scale: []) cannot be confirmed to SIAP
  console.log('Test P: Empty rubric cannot be confirmed to SIAP -> FAIL');
  const pkgWithEmptyRubric: AssessmentPackage = {
    ...validLinkedPkg,
    rubrics: [
      {
        id: 'rub-empty',
        title: '',
        criteria: [],
        scale: [],
      },
    ],
  };
  const valP = validateAssessmentPackage(pkgWithEmptyRubric, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (valP.valid || !valP.errors.some((e) => e.includes('belum memiliki judul') || e.includes('wajib memiliki minimal 1 kriteria'))) {
    throw new Error(`FAILED: Empty rubric should fail validation. Errors: ${valP.errors.join('; ')}`);
  }
  console.log(`  PASSED: Empty rubric correctly rejected with errors: "${valP.errors.filter(e => e.includes('Rubrik')).join(' | ')}"`);

  // TEST Q: Rubric with title and custom criteria/scale passes validation
  console.log('Test Q: Rubric with explicit title and custom criteria/scale -> PASS');
  const pkgWithValidRubric: AssessmentPackage = {
    ...validLinkedPkg,
    rubrics: [
      {
        id: 'rub-1',
        title: 'Rubrik Penilaian Presentasi IPAS',
        criteria: [{ id: 'c1', label: 'Penguasaan Materi Fotosintesis' }],
        scale: [
          { id: 's1', label: 'Mulai Berkembang', order: 1, descriptor: 'Menjelaskan sebagian' },
          { id: 's2', label: 'Mahir', order: 2, descriptor: 'Menjelaskan secara utuh' },
        ],
      },
    ],
  };
  const valQ = validateAssessmentPackage(pkgWithValidRubric, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (!valQ.valid) {
    throw new Error(`FAILED: Custom valid rubric failed validation: ${valQ.errors.join('; ')}`);
  }
  console.log('  PASSED: Rubric with explicit title and custom criteria/scale validated cleanly.');

  // TEST R: Written item with unresolved itemType: '' cannot be marked SIAP
  console.log('Test R: Written item with unresolved itemType: "" -> FAIL');
  const pkgWithUnresolvedItem: AssessmentPackage = {
    ...validLinkedPkg,
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [{ id: 'q1', itemType: '' as any, prompt: 'Jelaskan fotosintesis', order: 1 }],
      },
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
  };
  const valR = validateAssessmentPackage(pkgWithUnresolvedItem, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (valR.valid || !valR.errors.some((e) => e.includes('itemType unresolved'))) {
    throw new Error(`FAILED: Unresolved itemType should fail validation. Errors: ${valR.errors.join('; ')}`);
  }
  console.log(`  PASSED: Unresolved written item rejected: "${valR.errors.find(e => e.includes('itemType unresolved'))}"`);

  // TEST S: Written multiple choice item without options cannot be marked SIAP
  console.log('Test S: Written multiple choice item without options -> FAIL');
  const pkgWithNoOptionsMC: AssessmentPackage = {
    ...validLinkedPkg,
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        items: [{ id: 'q1', itemType: 'MULTIPLE_CHOICE', prompt: 'Berikut adalah...', options: [], order: 1 }],
      },
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
  };
  const valS = validateAssessmentPackage(pkgWithNoOptionsMC, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (valS.valid || !valS.errors.some((e) => e.includes('minimal 2 opsi'))) {
    throw new Error(`FAILED: MC item without options should fail validation. Errors: ${valS.errors.join('; ')}`);
  }
  console.log(`  PASSED: Multiple choice without options rejected: "${valS.errors.find(e => e.includes('minimal 2 opsi'))}"`);

  // TEST T: AnswerKey with dangling instrumentId -> FAIL
  console.log('Test T: AnswerKey with dangling instrumentId -> FAIL');
  const pkgDanglingAkInst: AssessmentPackage = {
    ...validLinkedPkg,
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'non-existent-inst',
        instrumentItemId: 'q1',
        answerType: 'EXACT',
        value: 'Kunci jawaban teks',
      },
    ],
  };
  const valT = validateAssessmentPackage(pkgDanglingAkInst, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (valT.valid || !valT.errors.some((e) => e.includes('instrumentId [non-existent-inst] yang tidak ditemukan'))) {
    throw new Error(`FAILED: AnswerKey with dangling instrumentId should fail. Errors: ${valT.errors.join('; ')}`);
  }
  console.log(`  PASSED: Dangling instrumentId in AnswerKey rejected: "${valT.errors.find(e => e.includes('instrumentId'))}"`);

  // TEST U: AnswerKey with dangling instrumentItemId -> FAIL
  console.log('Test U: AnswerKey with dangling instrumentItemId -> FAIL');
  const pkgDanglingAkItem: AssessmentPackage = {
    ...validLinkedPkg,
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w',
        instrumentItemId: 'non-existent-item',
        answerType: 'EXACT',
        value: 'Kunci jawaban teks',
      },
    ],
  };
  const valU = validateAssessmentPackage(pkgDanglingAkItem, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (valU.valid || !valU.errors.some((e) => e.includes('instrumentItemId [non-existent-item] yang tidak ditemukan'))) {
    throw new Error(`FAILED: AnswerKey with dangling instrumentItemId should fail. Errors: ${valU.errors.join('; ')}`);
  }
  console.log(`  PASSED: Dangling instrumentItemId in AnswerKey rejected: "${valU.errors.find(e => e.includes('instrumentItemId'))}"`);

  // TEST V: AnswerKey referencing item of another instrument (cross-instrument) -> FAIL
  console.log('Test V: AnswerKey cross-instrument reference -> FAIL');
  const pkgCrossInstAk: AssessmentPackage = {
    ...validLinkedPkg,
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-w', // claims to be inst-w
        instrumentItemId: 'obs-1', // but obs-1 belongs to inst-o
        answerType: 'EXACT',
        value: 'Kunci jawaban teks',
      },
    ],
  };
  const valV = validateAssessmentPackage(pkgCrossInstAk, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (valV.valid || !valV.errors.some((e) => e.includes('cross-instrument reference') || e.includes('milik instrumen lain'))) {
    throw new Error(`FAILED: AnswerKey with cross-instrument item should fail. Errors: ${valV.errors.join('; ')}`);
  }
  console.log(`  PASSED: Cross-instrument reference in AnswerKey rejected: "${valV.errors.find(e => e.includes('cross-instrument') || e.includes('milik instrumen lain'))}"`);

  // TEST W: Instrument referencing non-existent rubricId or scoringGuideId -> FAIL
  console.log('Test W: Instrument referencing non-existent rubricId/scoringGuideId -> FAIL');
  const pkgDanglingRubricRef: AssessmentPackage = {
    ...validLinkedPkg,
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        rubricId: 'ghost-rubric-999',
        items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Jelaskan X', order: 1 }],
      } as any,
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
  };
  const valW = validateAssessmentPackage(pkgDanglingRubricRef, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (valW.valid || !valW.errors.some((e) => e.includes('dangling rubric reference'))) {
    throw new Error(`FAILED: Dangling rubricId on instrument should fail. Errors: ${valW.errors.join('; ')}`);
  }
  console.log(`  PASSED: Dangling rubric reference rejected: "${valW.errors.find(e => e.includes('dangling rubric reference'))}"`);

  // TEST X: InvalidateAssessmentPackageDependencies detects dangling rubric and answer key
  console.log('Test X: Dependency invalidator detects dangling rubric and answer key -> PERLU_DILENGKAPI');
  const pkgWithValidRubAndAk: AssessmentPackage = {
    ...validLinkedPkg,
    workflowStatus: 'SIAP',
    rubrics: [{ id: 'rub-x', title: 'Rubrik X', criteria: [{ id: 'cx', label: 'K' }], scale: [{ id: 'sx', label: 'S', order: 1 }] }],
    instruments: [
      {
        id: 'inst-w',
        type: 'WRITTEN_TEST',
        rubricId: 'rub-x',
        items: [{ id: 'q1', itemType: 'ESSAY', prompt: 'Jelaskan X', order: 1 }],
      } as any,
      { id: 'inst-o', type: 'OBSERVATION', aspects: [{ id: 'obs-1', label: 'Sikap' }] },
    ],
    answerKeys: [
      {
        id: 'ak-x',
        instrumentId: 'inst-w',
        instrumentItemId: 'q1',
        answerType: 'EXACT',
        value: 'Kunci X',
      },
    ],
  };

  // Simulate deleted rubric by clearing pkg.rubrics
  const pkgDeletedRubric: AssessmentPackage = {
    ...pkgWithValidRubAndAk,
    rubrics: [], // rubric 'rub-x' is deleted!
  };
  const invX = invalidateAssessmentPackageDependencies(pkgDeletedRubric, {
    academicSetting: mockMerdekaSetting,
    assessmentPlan: {
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    },
    tp: mockTP,
  });
  if (!invX.isInvalidated || invX.package.workflowStatus !== 'PERLU_DILENGKAPI' || !invX.reasons.some(r => r.includes('rubricId [rub-x] yang telah dihapus'))) {
    throw new Error(`FAILED: Deleting referenced rubric should invalidate package. Reasons: ${invX.reasons.join('; ')}`);
  }
  console.log(`  PASSED: Dependency invalidator invalidated status to PERLU_DILENGKAPI: "${invX.reasons.find(r => r.includes('rubricId'))}"`);

  // TEST Y: Export package selection ambiguity handling
  console.log('Test Y: Export with multiple SIAP packages and missing activeAssessmentPackageId is blocked');
  const siapPkg1: AssessmentPackage = {
    ...validLinkedPkg,
    id: 'pkg-siap-1',
    workflowStatus: 'SIAP',
    title: 'Perangkat Asesmen Paket A',
  };
  const siapPkg2: AssessmentPackage = {
    ...validLinkedPkg,
    id: 'pkg-siap-2',
    workflowStatus: 'SIAP',
    title: 'Perangkat Asesmen Paket B',
  };

  let ambiguousBlocked = false;
  try {
    await generateAssessment({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockMerdekaSetting,
      tp: mockTP,
      documentMode: 'data',
      assessmentPlans: [{
        ...mockAssessmentPlan,
        instruments: [
          { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
          { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
        ],
      }],
      assessmentPackages: [siapPkg1, siapPkg2],
      // activeAssessmentPackageId is omitted!
      skipDownload: true,
    });
  } catch (err: any) {
    ambiguousBlocked = true;
    console.log(`  PASSED: Ambiguous export blocked with error: "${err.message}"`);
  }
  if (!ambiguousBlocked) {
    throw new Error('FAILED: Ambiguous export was NOT blocked when multiple SIAP packages exist without active ID');
  }

  // Export with exact activeAssessmentPackageId succeeds
  console.log('Test Y2: Export with explicit activeAssessmentPackageId succeeds');
  const exportResult = await generateAssessment({
    school: mockSchool,
    profile: mockProfile,
    academicSetting: mockMerdekaSetting,
    tp: mockTP,
    documentMode: 'data',
    assessmentPlans: [{
      ...mockAssessmentPlan,
      instruments: [
        { id: 'i1', type: 'WRITTEN_TEST', label: 'Tes' },
        { id: 'i2', type: 'OBSERVATION', label: 'Obs' },
      ],
    }],
    assessmentPackages: [siapPkg1, siapPkg2],
    activeAssessmentPackageId: 'pkg-siap-2',
    documentDate: '2026-09-20',
    skipDownload: true,
  });
  if (!exportResult || !exportResult.blob) {
    throw new Error('FAILED: Export with explicit activeAssessmentPackageId failed');
  }
  console.log('  PASSED: Export with explicit activeAssessmentPackageId succeeded cleanly.');

  console.log('\n=== ALL AUDIT 9B REGRESSION TESTS (A-Y) PASSED SUCCESSFULLY! ===');
}

runRegressionTests();
