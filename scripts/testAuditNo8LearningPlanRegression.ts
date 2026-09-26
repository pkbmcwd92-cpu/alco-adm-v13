import {
  createEmptyLearningPlan,
  createAIDraftLearningPlan,
  invalidatePlanIfDependenciesChanged,
  validateLearningPlan,
} from '../src/services/learningPlanService';
import { generateModulAjar } from '../src/services/documentEngine/generators/modulAjarGenerator';
import { generatePdfDocument } from '../src/services/documentEngine/renderers/pdf/pdfDocGenerators';
import { validateDocumentRequirements } from '../src/services/documentEngine';
import { AcademicSetting, TPData, ATPData, LearningPlan, SchoolData, TeacherProfile } from '../src/types';

async function runRegressionSuite() {
  console.log('=== RUNNING AUDIT NO. 8 REGRESSION SUITE ===\n');
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

  const mockSchool: SchoolData = {
    id: 's1',
    name: 'SMP Demo',
    npsn: '12345678',
    address: 'Jl. Demo',
    village: 'Kel',
    district: 'Kec',
    regency: 'Kota',
    province: 'Prov',
    principalName: 'Kepsek',
    principalNip: '-',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProfile: TeacherProfile = {
    id: 'p1',
    name: 'Guru Demo',
    nip: '-',
    status: 'PNS',
    defaultSubject: 'Informatika',
    defaultLevel: 'SMP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSetting: AcademicSetting = {
    id: 'setting-1',
    profileId: 'p1',
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
    id: 'tpdata-1',
    academicSettingId: 'setting-1',
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'tp-101',
        order: 1,
        code: 'TP 7.1',
        statement: 'Memahami konsep dasar algoritma dan pemograman.',
        competence: 'Memahami',
        contentScope: 'Algoritma Pemrograman',
        p3Dimensions: ['Bernalar Kritis'],
      },
      {
        id: 'tp-102',
        order: 2,
        code: 'TP 7.2',
        statement: 'Menerapkan struktur kontrol keputusan dalam program.',
        competence: 'Menerapkan',
        contentScope: 'Pemrograman Python',
        p3Dimensions: ['Mandiri', 'Kreatif'],
      },
    ],
    workflowStatus: 'SIAP',
    needsReview: false,
  };

  const mockAtpData: ATPData = {
    id: 'atpdata-1',
    academicSettingId: 'setting-1',
    updatedAt: new Date().toISOString(),
    totalJP: 36,
    workflowStatus: 'SIAP',
    needsReview: false,
    basedOnTpUpdatedAt: mockTpData.updatedAt,
    items: [
      {
        id: 'atp-201',
        stepNumber: 1,
        tpId: 'tp-101',
        tpCode: 'TP 7.1',
        tpStatement: 'Memahami konsep dasar algoritma dan pemograman.',
        materialScope: 'Algoritma Pemrograman',
        jp: 12,
        semester: 1,
      },
      {
        id: 'atp-202',
        stepNumber: 2,
        tpId: 'tp-102',
        tpCode: 'TP 7.2',
        tpStatement: 'Menerapkan struktur kontrol keputusan dalam program.',
        materialScope: 'Pemrograman Python',
        jp: 24,
        semester: 1,
      },
    ],
  };

  // Test 1: HAPUS FIRST-ITEM AUTO SELECTION
  console.log('--- Test 1: Hapus First-Item Auto Selection ---');
  const emptyPlan = createEmptyLearningPlan({
    academicSetting: mockSetting,
    curriculumType: 'KURIKULUM_MERDEKA',
    tpIds: [],
    atpItemIds: [],
    context: { tp: mockTpData, atp: mockAtpData },
  });
  assert(
    emptyPlan.tpIds.length === 0 && emptyPlan.atpItemIds.length === 0,
    'createEmptyLearningPlan must NOT auto-select first TP/ATP',
    `tpIds length=${emptyPlan.tpIds.length}`
  );

  // Test 2: HAPUS FABRICATED AI CONTENT
  console.log('\n--- Test 2: Hapus Fabricated AI Content ---');
  const aiPlan = createAIDraftLearningPlan({
    academicSetting: mockSetting,
    curriculumType: 'KURIKULUM_MERDEKA',
    tpIds: [],
    atpItemIds: [],
    aiDraft: {},
    context: { tp: mockTpData, atp: mockAtpData },
  });
  assert(
    aiPlan.status === 'DRAFT' && !aiPlan.learningModel && !aiPlan.targetStudents,
    'createAIDraftLearningPlan must start as DRAFT with no hardcoded PBL or target students',
    `learningModel=${aiPlan.learningModel}`
  );

  // Test 3: STRICT FINAL EXPORT GUARD
  console.log('\n--- Test 3: Strict Final Export Guard ---');
  let exportThrew = false;
  try {
    await generateModulAjar({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      learningPlans: [emptyPlan], // Status DRAFT
      tp: mockTpData,
      atp: mockAtpData,
    });
  } catch (err: any) {
    exportThrew = true;
  }
  assert(
    exportThrew,
    'DOCX Generator must block export when LearningPlan is DRAFT'
  );

  let pdfExportThrew = false;
  try {
    await generatePdfDocument('MODUL_AJAR', {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      learningPlans: [emptyPlan], // Status DRAFT
      tp: mockTpData,
      atp: mockAtpData,
    });
  } catch (err: any) {
    pdfExportThrew = true;
  }
  assert(
    pdfExportThrew,
    'PDF Generator must block export when LearningPlan is DRAFT'
  );

  // Test 4: NO SYNTHETIC PLAN CREATION IN GENERATOR
  console.log('\n--- Test 4: No Synthetic Plan Creation in Generator ---');
  let missingPlanThrew = false;
  try {
    await generateModulAjar({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      learningPlans: [], // NO PLAN
      tp: mockTpData,
      atp: mockAtpData,
    });
  } catch (err: any) {
    missingPlanThrew = true;
  }
  assert(
    missingPlanThrew,
    'Generator must throw error when LearningPlan is missing (no synthetic fallback)'
  );

  // Test 5: DEPENDENCY INVALIDATION
  console.log('\n--- Test 5: Dependency Invalidation ---');
  const validSiapPlan: LearningPlan = {
    ...emptyPlan,
    status: 'SIAP',
    confirmedAt: new Date().toISOString(),
    tpIds: ['tp-101'],
    atpItemIds: ['atp-201'],
    topic: 'Pengenalan Algoritma',
    allocatedJP: 6,
    initialCompetency: 'Siswa dapat mengoperasikan komputer',
    graduateProfileDimensions: ['Penalaran Kritis'],
    resources: [{ id: 'r1', title: 'Buku Siswa Informatika' }],
    learningModel: 'Pembelajaran Kontekstual',
    p3Dimensions: ['Bernalar Kritis'],
    learningSteps: {
      opening: [{ id: 's1', description: 'Apersepsi' }],
      core: [{ id: 's2', description: 'Latihan Logika' }],
      closing: [{ id: 's3', description: 'Refleksi' }],
    },
    learningExperiences: [
      { id: 'e1', phase: 'UNDERSTAND', description: 'Mengamati contoh algoritma sederhana', durationMinutes: 20 },
      { id: 'e2', phase: 'APPLY', description: 'Menyusun langkah algoritma', durationMinutes: 50 },
      { id: 'e3', phase: 'REFLECT', description: 'Merefleksi hasil latihan', durationMinutes: 20 },
    ],
    assessmentPlan: {
      initial: [{ id: 'a1', type: 'INITIAL', description: 'Pre-test', linkedTpIds: ['tp-101'] }],
      formative: [{ id: 'a2', type: 'FORMATIVE', description: 'Kuis', linkedTpIds: ['tp-101'] }],
      summative: [{ id: 'a3', type: 'SUMMATIVE', description: 'Tes Akhir', linkedTpIds: ['tp-101'] }],
    },
  };

  const beforeDeletionValidation = validateLearningPlan(validSiapPlan, {
    academicSetting: mockSetting,
    tp: mockTpData,
    atp: mockAtpData,
  });
  assert(
    beforeDeletionValidation.valid === true,
    'Dependency invalidation fixture must be valid before dependency deletion',
    beforeDeletionValidation.errors.join(' | ')
  );

  // Now simulate deleted TP (remove tp-101 from context)
  const modifiedTpData: TPData = {
    ...mockTpData,
    items: [mockTpData.items[1]], // Only tp-102 left
  };

  const reval = invalidatePlanIfDependenciesChanged(validSiapPlan, {
    academicSetting: mockSetting,
    tp: modifiedTpData,
    atp: mockAtpData,
  });

  assert(
    reval.isInvalidated && reval.plan.status === 'PERLU_DILENGKAPI',
    'Plan status must revert to PERLU_DILENGKAPI when referenced TP is removed',
    `status=${reval.plan.status}`
  );

  // Test 6: VALIDATE DOCUMENT REQUIREMENTS INTEGRITY
  console.log('\n--- Test 6: Document Requirements Validation Guard ---');
  const docValDraft = validateDocumentRequirements('MODUL_AJAR', {
    school: mockSchool,
    profile: mockProfile,
    academicSetting: mockSetting,
    learningPlans: [emptyPlan],
  });
  assert(
    !docValDraft.isValid && docValDraft.missingFields.some((f) => f.includes('SIAP')),
    'validateDocumentRequirements must report invalid status for DRAFT plan'
  );

  console.log(`\n==========================================`);
  console.log(`TOTAL PASSED: ${passedCount}`);
  console.log(`TOTAL FAILED: ${failedCount}`);
  console.log(`==========================================`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runRegressionSuite();
