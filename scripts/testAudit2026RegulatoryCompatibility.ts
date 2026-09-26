import {
  validateLearningPlan,
  createEmptyLearningPlan,
  createAIDraftLearningPlan,
  migrateLegacyLearningPlan,
  LEARNING_EXPERIENCE_PHASE_LABELS,
  DEEP_LEARNING_PRINCIPLE_LABELS,
} from '../src/services/learningPlanService';
import { generateModulAjar } from '../src/services/documentEngine/generators/modulAjarGenerator';
import {
  LearningPlan,
  AcademicSetting,
  TPData,
  ATPData,
  SchoolData,
  TeacherProfile,
} from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('====================================================');
console.log('RUNNING REGULATORY COMPATIBILITY 2026 REGRESSION TEST');
console.log('====================================================\n');

const mockSchool: SchoolData = {
  id: 'school-1',
  name: 'SMA Negeri 1 Edukasi',
  npsn: '12345678',
  address: 'Jl. Pendidikan No. 1',
  village: 'Sukamaju',
  district: 'Cibadak',
  regency: 'Bandung',
  province: 'Jawa Barat',
  principalName: 'Kepala Sekolah, M.Pd',
  principalNip: '197501012000011001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockProfile: TeacherProfile = {
  id: 'prof-1',
  name: 'Guru Teladan, S.Kom',
  nip: '198501012010011001',
  status: 'PNS',
  defaultSubject: 'Informatika',
  defaultLevel: 'SMA',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const fixedIsoDate = '2026-07-20T08:00:00.000Z';

const mockSetting: AcademicSetting = {
  id: 'setting-2026',
  profileId: 'prof-1',
  subject: 'Informatika',
  level: 'SMA',
  grade: 'Kelas 10',
  phase: 'Fase E',
  semester: '1 (Ganjil)',
  academicYear: '2025/2026',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  updatedAt: fixedIsoDate,
};

const mockTP: TPData = {
  id: 'tpdata-2026',
  academicSettingId: 'setting-2026',
  workflowStatus: 'SIAP',
  needsReview: false,
  items: [
    {
      id: 'tp-inf-01',
      code: 'TP-10.1',
      statement: 'Memahami konsep dasar algoritma dan pemrograman prosedural.',
      contentScope: 'Algoritma dan Pemrograman',
      competence: 'Memahami konsep',
      order: 1,
    },
    {
      id: 'tp-inf-02',
      code: 'TP-10.2',
      statement: 'Menerapkan struktur kontrol percabangan dan perulangan dalam kode program.',
      contentScope: 'Struktur Kontrol',
      competence: 'Menerapkan struktur',
      order: 2,
    },
  ],
  updatedAt: fixedIsoDate,
};

const mockATP: ATPData = {
  id: 'atpdata-2026',
  academicSettingId: 'setting-2026',
  tpId: 'tpdata-2026',
  basedOnTpUpdatedAt: fixedIsoDate,
  workflowStatus: 'SIAP',
  needsReview: false,
  items: [
    {
      id: 'atp-inf-01',
      tpId: 'tp-inf-01',
      stepNumber: 1,
      materialScope: 'Algoritma dan Pemrograman',
      jp: 4,
    },
    {
      id: 'atp-inf-02',
      tpId: 'tp-inf-02',
      stepNumber: 2,
      materialScope: 'Struktur Kontrol',
      jp: 4,
    },
  ],
  updatedAt: fixedIsoDate,
};

// ----------------------------------------------------
// 1. TERMINOLOGY CONSTANTS
// ----------------------------------------------------
console.log('1. Testing Terminology & Display Constants');
assert(LEARNING_EXPERIENCE_PHASE_LABELS.UNDERSTAND === 'Memahami', 'UNDERSTAND mapped to Memahami');
assert(LEARNING_EXPERIENCE_PHASE_LABELS.APPLY === 'Mengaplikasi', 'APPLY mapped to Mengaplikasi');
assert(LEARNING_EXPERIENCE_PHASE_LABELS.REFLECT === 'Merefleksi', 'REFLECT mapped to Merefleksi');
assert(DEEP_LEARNING_PRINCIPLE_LABELS.MINDFUL === 'Berkesadaran', 'MINDFUL mapped to Berkesadaran');
assert(DEEP_LEARNING_PRINCIPLE_LABELS.MEANINGFUL === 'Bermakna', 'MEANINGFUL mapped to Bermakna');
assert(DEEP_LEARNING_PRINCIPLE_LABELS.JOYFUL === 'Menggembirakan', 'JOYFUL mapped to Menggembirakan');

// ----------------------------------------------------
// 2. VALIDATOR - CANONICAL LEARNING EXPERIENCES
// ----------------------------------------------------
console.log('\n2. Testing validateLearningPlan with Canonical 2026 Learning Experiences');

const planWithExperiences: LearningPlan = {
  id: 'plan-2026-01',
  academicSettingId: 'setting-2026',
  curriculumType: 'KURIKULUM_MERDEKA',
  sourceType: 'MANUAL',
  status: 'DRAFT',
  tpIds: ['tp-inf-01'],
  atpItemIds: ['atp-inf-01'],
  objectives: [
    {
      id: 'tp-inf-01',
      tpId: 'tp-inf-01',
      statement: 'Memahami konsep dasar algoritma dan pemrograman prosedural.',
    },
  ],
  learningExperiences: [
    {
      id: 'exp-01',
      phase: 'UNDERSTAND',
      description: 'Murid menyimak penjelasan analogi algoritma dalam kehidupan sehari-hari.',
      durationMinutes: 20,
    },
    {
      id: 'exp-02',
      phase: 'APPLY',
      description: 'Murid menyusun diagram alir (flowchart) untuk solusi permasalahan sederhana.',
      durationMinutes: 45,
    },
    {
      id: 'exp-03',
      phase: 'REFLECT',
      description: 'Murid merefleksikan hambatan yang dialami saat menyusun logika algoritma.',
      durationMinutes: 15,
    },
  ],
  assessmentPlan: {
    formative: [
      {
        id: 'asm-01',
        type: 'FORMATIVE',
        linkedTpIds: ['tp-inf-01'],
        description: 'Observasi rubrik penyusunan flowchart.',
      },
    ],
  },
  graduateProfileDimensions: ['Penalaran Kritis', 'Kemandirian'],
  deepLearningContext: {
    principles: ['MINDFUL', 'MEANINGFUL', 'JOYFUL'],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const res1 = validateLearningPlan(planWithExperiences, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res1.valid === true, 'Plan with 2026 canonical LearningExperiences is valid without legacy core steps');
assert(res1.errors.length === 0, 'No errors in valid 2026 canonical plan');

// ----------------------------------------------------
// 3. VALIDATOR - REJECT INVALID EXPERIENCES
// ----------------------------------------------------
console.log('\n3. Testing validateLearningPlan Error Handling for Malformed Experiences');

const malformedExpPlan: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-malformed-exp',
  learningExperiences: [
    {
      id: '',
      phase: 'UNDERSTAND',
      description: 'Kegiatan A',
    },
    {
      id: 'exp-dup',
      phase: 'INVALID_PHASE' as any,
      description: '',
    },
    {
      id: 'exp-dup',
      phase: 'APPLY',
      description: 'Deskripsi valid',
      linkedTpIds: ['tp-non-existent'],
    },
  ],
};

const res2 = validateLearningPlan(malformedExpPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res2.valid === false, 'Validator rejects plan with malformed experiences');
assert(res2.errors.some((e) => e.includes('ID kosong')), 'Detects empty experience ID');
assert(res2.errors.some((e) => e.includes('duplikasi ID')), 'Detects duplicate experience ID');
assert(res2.errors.some((e) => e.includes('fase tidak sah')), 'Detects invalid experience phase');
assert(res2.errors.some((e) => e.includes('deskripsi kosong')), 'Detects empty experience description');
assert(res2.errors.some((e) => e.includes('dangling TP reference')), 'Detects dangling TP reference in experience');

// ----------------------------------------------------
// 4. VALIDATOR - DEEP LEARNING CONTEXT & DUPLICATE DIMENSIONS
// ----------------------------------------------------
console.log('\n4. Testing validateLearningPlan Deep Learning Context & Graduate Profile Dimensions');

const invalidContextPlan: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-invalid-dl',
  deepLearningContext: {
    principles: ['MINDFUL', 'MINDFUL', 'UNKNOWN_PRINCIPLE' as any],
  },
  graduateProfileDimensions: ['Kemandirian', 'Kemandirian'],
};

const res3 = validateLearningPlan(invalidContextPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res3.errors.some((e) => e.includes('Prinsip Pembelajaran Mendalam')), 'Detects invalid deep learning principle');
assert(res3.errors.some((e) => e.includes('duplikasi nilai pada prinsip')), 'Detects duplicate deep learning principles');
assert(res3.warnings.some((w) => w.includes('duplikasi nilai pada Dimensi Profil Lulusan')), 'Warns on duplicate graduate profile dimensions');

// ----------------------------------------------------
// 5. VALIDATOR - LEGACY BACKWARD COMPATIBILITY
// ----------------------------------------------------
console.log('\n5. Testing Legacy Backward Compatibility');

const legacyPlan: LearningPlan = {
  id: 'plan-legacy-01',
  academicSettingId: 'setting-2026',
  curriculumType: 'KURIKULUM_MERDEKA',
  sourceType: 'MANUAL',
  status: 'DRAFT',
  tpIds: ['tp-inf-01'],
  atpItemIds: ['atp-inf-01'],
  objectives: [
    {
      id: 'tp-inf-01',
      tpId: 'tp-inf-01',
      statement: 'Memahami konsep dasar algoritma dan pemrograman prosedural.',
    },
  ],
  learningSteps: {
    opening: [{ id: 's1', description: 'Guru membuka kelas dengan salam.' }],
    core: [{ id: 's2', description: 'Siswa mempraktikkan pseudocode.' }],
    closing: [{ id: 's3', description: 'Guru memberikan umpan balik.' }],
  },
  assessmentPlan: {
    formative: [{ id: 'a1', type: 'FORMATIVE', description: 'Latihan mandiri', linkedTpIds: ['tp-inf-01'] }],
  },
  p3Dimensions: ['Bernalar Kritis'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const res4 = validateLearningPlan(legacyPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res4.valid === true, 'Legacy plan with learningSteps and p3Dimensions is valid');
assert(res4.errors.length === 0, 'Legacy plan has no validation errors');

// Empty activity check
const emptyActivityPlan: LearningPlan = {
  ...legacyPlan,
  id: 'plan-empty-act',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [],
};
const res5 = validateLearningPlan(emptyActivityPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(res5.valid === false, 'Rejects plan when neither experiences nor legacy steps exist');
assert(res5.errors.some((e) => e.includes('wajib memiliki aktivitas pembelajaran')), 'Appropriate error message for empty learning activity');

// ----------------------------------------------------
// 6. FACTORY FUNCTIONS (createEmptyLearningPlan & createAIDraftLearningPlan)
// ----------------------------------------------------
console.log('\n6. Testing Factory Functions (No Auto-Fabrication)');

const emptyPlan = createEmptyLearningPlan({
  academicSetting: mockSetting,
  curriculumType: 'KURIKULUM_MERDEKA',
  tpIds: ['tp-inf-01'],
  context: { tp: mockTP },
});
assert(emptyPlan.sourceType === 'MANUAL', 'createEmptyLearningPlan sets sourceType MANUAL');
assert(emptyPlan.status === 'DRAFT', 'createEmptyLearningPlan sets status DRAFT');
assert(Array.isArray(emptyPlan.learningExperiences) && emptyPlan.learningExperiences.length === 0, 'learningExperiences is empty array');
assert(emptyPlan.deepLearningContext === undefined, 'deepLearningContext is not fabricated');
assert(emptyPlan.graduateProfileDimensions === undefined, 'graduateProfileDimensions is not fabricated');

const aiDraftPlan = createAIDraftLearningPlan({
  academicSetting: mockSetting,
  curriculumType: 'KURIKULUM_MERDEKA',
  tpIds: ['tp-inf-01'],
  aiDraft: {
    learningExperiences: [
      { id: 'ai-exp-1', phase: 'UNDERSTAND', description: 'Memahami konsep' },
    ],
    deepLearningContext: { principles: ['MINDFUL'] },
    graduateProfileDimensions: ['Mandiri'],
  },
  context: { tp: mockTP },
});
assert(aiDraftPlan.sourceType === 'AI_DRAFT', 'createAIDraftLearningPlan sets sourceType AI_DRAFT');
assert(aiDraftPlan.status === 'DRAFT', 'createAIDraftLearningPlan sets status DRAFT');
assert(aiDraftPlan.learningExperiences?.length === 1, 'Preserves provided experiences in AI draft');
assert(aiDraftPlan.deepLearningContext?.principles?.[0] === 'MINDFUL', 'Preserves provided deepLearningContext in AI draft');
assert(aiDraftPlan.graduateProfileDimensions?.[0] === 'Mandiri', 'Preserves provided graduateProfileDimensions in AI draft');

// ----------------------------------------------------
// 7. MIGRATION (migrateLegacyLearningPlan)
// ----------------------------------------------------
console.log('\n7. Testing migrateLegacyLearningPlan');

const legacyRaw = {
  id: 'old-plan-1',
  objectives: ['Tujuan legacy 1'],
  learningSteps: [
    { id: 'step-1', stepName: 'Kegiatan Pendahuluan', description: 'Apersepsi' },
    { id: 'step-2', stepName: 'Kegiatan Inti', description: 'Eksplorasi' },
  ],
  assessmentPlan: [{ type: 'FORMATIVE', instrument: 'Rubrik' }],
  p3Dimensions: ['Gotong Royong'],
};

const migrated = migrateLegacyLearningPlan(legacyRaw, 'setting-2026');
assert(migrated.sourceType === 'MIGRATED', 'Migrated plan has sourceType MIGRATED');
assert(migrated.status === 'DRAFT', 'Migrated plan has status DRAFT');
assert(migrated.learningSteps.opening?.length === 1, 'Preserves legacy opening step');
assert(migrated.learningSteps.core?.length === 1, 'Preserves legacy core step');
assert(migrated.learningExperiences === undefined, 'Does NOT fabricate canonical learningExperiences from legacy steps');
assert(migrated.graduateProfileDimensions === undefined, 'Does NOT fabricate graduateProfileDimensions from p3Dimensions');
assert(migrated.p3Dimensions?.[0] === 'Gotong Royong', 'Preserves legacy p3Dimensions');

// ----------------------------------------------------
// 8. HARDENED REGRESSION TEST CASES (AA through AR)
// ----------------------------------------------------
console.log('\n8. Testing Hardened Regression Test Cases (AA through AR)');

// AA. Duplicate experience ID tidak dihitung sebagai valid experience
const planWithDuplicateExp: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dup-exp',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-unique-1', phase: 'UNDERSTAND', description: 'Deskripsi valid 1' },
    { id: 'exp-dup-1', phase: 'APPLY', description: 'Deskripsi 2' },
    { id: 'exp-dup-1', phase: 'REFLECT', description: 'Deskripsi 3' },
  ],
};
const resAA = validateLearningPlan(planWithDuplicateExp, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAA.valid === false, 'Case AA: Duplicate experience ID fails validation');
assert(resAA.errors.some((e) => e.includes('duplikasi ID')), 'Case AA: Reports duplicate ID error');
// Verify that valid unique experience is counted (1), but duplicate is rejected and does not increment validExpCount inappropriately
const planWithOnlyDuplicateExps: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dup-all',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-same', phase: 'UNDERSTAND', description: 'A' },
    { id: 'exp-same', phase: 'APPLY', description: 'B' },
  ],
};
const resAA2 = validateLearningPlan(planWithOnlyDuplicateExps, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAA2.valid === false, 'Case AA2: Plan with duplicate IDs fails validation');
assert(resAA2.errors.some((e) => e.includes('duplikasi ID')), 'Case AA2: Detects duplicate experience ID');

// AA3. Duplicate experience where first is duplicate of second with no other valid experiences and no legacy steps
// When all experiences have errors / invalid IDs and no legacy steps, activity requirement must fail
const planAllMalformedExps: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-all-malformed',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: '', phase: 'UNDERSTAND', description: 'No ID' },
  ],
};
const resAA3 = validateLearningPlan(planAllMalformedExps, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAA3.valid === false, 'Case AA3: All malformed experiences fail validation');
assert(resAA3.errors.some((e) => e.includes('wajib memiliki aktivitas pembelajaran')), 'Case AA3: Activity requirement fails when only malformed experiences present');

// AB. Dangling linkedTpId tidak dihitung sebagai valid experience
const planWithDanglingTpExp: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dangling-tp',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-dang-1', phase: 'UNDERSTAND', description: 'Deskripsi valid', linkedTpIds: ['tp-not-exist'] },
  ],
};
const resAB = validateLearningPlan(planWithDanglingTpExp, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAB.valid === false, 'Case AB: Dangling linkedTpId fails validation');
assert(resAB.errors.some((e) => e.includes('dangling TP reference')), 'Case AB: Reports dangling TP reference');
assert(resAB.errors.some((e) => e.includes('wajib memiliki aktivitas pembelajaran')), 'Case AB: Invalid experience does not fulfill activity requirement');

// AC. Semua experiences invalid + tidak ada legacy steps → activity requirement gagal
const planAllInvalidExp: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-all-invalid',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: '', phase: 'UNDERSTAND', description: 'Tanpa ID' },
    { id: 'exp-2', phase: 'INVALID' as any, description: 'Fase salah' },
    { id: 'exp-3', phase: 'APPLY', description: '' }, // Deskripsi kosong
    { id: 'exp-4', phase: 'REFLECT', description: 'Valid tapi duration minus', durationMinutes: -10 },
  ],
};
const resAC = validateLearningPlan(planAllInvalidExp, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAC.valid === false, 'Case AC: All invalid experiences fails validation');
assert(resAC.errors.some((e) => e.includes('wajib memiliki aktivitas pembelajaran')), 'Case AC: Fails activity requirement when all experiences invalid');

// AD. durationMinutes = 0 → invalid
const planDurationZero: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-zero',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-z', phase: 'UNDERSTAND', description: 'Zero duration', durationMinutes: 0 },
  ],
};
const resAD = validateLearningPlan(planDurationZero, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAD.valid === false, 'Case AD: durationMinutes = 0 is invalid');
assert(resAD.errors.some((e) => e.includes('durationMinutes') && e.includes('tidak valid')), 'Case AD: Reports invalid durationMinutes for 0');
assert(resAD.errors.some((e) => e.includes('wajib memiliki aktivitas pembelajaran')), 'Case AD: durationMinutes = 0 does not count as valid experience');

// AE. durationMinutes < 0 → invalid
const planDurationNegative: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-neg',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-neg', phase: 'UNDERSTAND', description: 'Negative duration', durationMinutes: -15 },
  ],
};
const resAE = validateLearningPlan(planDurationNegative, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAE.valid === false, 'Case AE: durationMinutes < 0 is invalid');
assert(resAE.errors.some((e) => e.includes('durationMinutes') && e.includes('tidak valid')), 'Case AE: Reports invalid durationMinutes for negative');

// AF. durationMinutes = NaN → invalid
const planDurationNaN: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-nan',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-nan', phase: 'UNDERSTAND', description: 'NaN duration', durationMinutes: NaN },
  ],
};
const resAF = validateLearningPlan(planDurationNaN, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAF.valid === false, 'Case AF: durationMinutes = NaN is invalid');
assert(resAF.errors.some((e) => e.includes('durationMinutes') && e.includes('tidak valid')), 'Case AF: Reports invalid durationMinutes for NaN');

// AG. durationMinutes = Infinity → invalid
const planDurationInf: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-inf',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-inf', phase: 'UNDERSTAND', description: 'Infinity duration', durationMinutes: Infinity },
  ],
};
const resAG = validateLearningPlan(planDurationInf, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAG.valid === false, 'Case AG: durationMinutes = Infinity is invalid');
assert(resAG.errors.some((e) => e.includes('durationMinutes') && e.includes('tidak valid')), 'Case AG: Reports invalid durationMinutes for Infinity');

// AG2. durationMinutes = -Infinity → invalid
const planDurationNegInf: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-neginf',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-neginf', phase: 'UNDERSTAND', description: '-Infinity duration', durationMinutes: -Infinity },
  ],
};
const resAG2 = validateLearningPlan(planDurationNegInf, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAG2.valid === false, 'Case AG2: durationMinutes = -Infinity is invalid');
assert(resAG2.errors.some((e) => e.includes('durationMinutes') && e.includes('tidak valid')), 'Case AG2: Reports invalid durationMinutes for -Infinity');
assert(resAG2.errors.some((e) => e.includes('wajib memiliki aktivitas pembelajaran')), 'Case AG2: -Infinity duration does not count as valid experience');

// AG3. durationMinutes = '45' as any (raw non-number runtime input) → invalid
const planDurationString: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-string',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-str', phase: 'UNDERSTAND', description: 'String duration', durationMinutes: '45' as any },
  ],
};
const resAG3 = validateLearningPlan(planDurationString, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAG3.valid === false, "Case AG3: durationMinutes = '45' string is invalid");
assert(resAG3.errors.some((e) => e.includes('durationMinutes') && e.includes('tidak valid')), 'Case AG3: Reports invalid durationMinutes for string input');

// AH. positive finite duration → valid
const planDurationPositive: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-pos',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-pos-1', phase: 'UNDERSTAND', description: 'Valid positive duration understand', durationMinutes: 45 },
    { id: 'exp-pos-2', phase: 'APPLY', description: 'Valid positive duration apply', durationMinutes: 45 },
    { id: 'exp-pos-3', phase: 'REFLECT', description: 'Valid positive duration reflect', durationMinutes: 15 },
  ],
};
const resAH = validateLearningPlan(planDurationPositive, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAH.valid === true, 'Case AH: positive finite duration is valid');
assert(resAH.errors.length === 0, 'Case AH: No errors on positive finite duration');

// AI. missing durationMinutes → tetap valid jika field lain valid
const planNoDuration: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-dur-none',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-none-1', phase: 'UNDERSTAND', description: 'No duration specified understand' },
    { id: 'exp-none-2', phase: 'APPLY', description: 'No duration specified apply' },
    { id: 'exp-none-3', phase: 'REFLECT', description: 'No duration specified reflect' },
  ],
};
const resAI = validateLearningPlan(planNoDuration, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAI.valid === true, 'Case AI: missing durationMinutes is valid when other fields valid');
assert(resAI.errors.length === 0, 'Case AI: No errors on missing durationMinutes');

// AJ. migration duration = -10 → undefined
const migratedNegative = migrateLegacyLearningPlan({
  id: 'mig-neg',
  learningExperiences: [
    { id: 'exp-1', phase: 'UNDERSTAND', description: 'Exp 1', durationMinutes: -10 },
  ],
}, 'setting-2026');
assert(migratedNegative.learningExperiences?.[0]?.durationMinutes === undefined, 'Case AJ: migration duration = -10 becomes undefined');

// AK. migration duration = NaN → undefined
const migratedNaN = migrateLegacyLearningPlan({
  id: 'mig-nan',
  learningExperiences: [
    { id: 'exp-1', phase: 'UNDERSTAND', description: 'Exp 1', durationMinutes: NaN },
  ],
}, 'setting-2026');
assert(migratedNaN.learningExperiences?.[0]?.durationMinutes === undefined, 'Case AK: migration duration = NaN becomes undefined');

// AL. migration duration = Infinity → undefined
const migratedInf = migrateLegacyLearningPlan({
  id: 'mig-inf',
  learningExperiences: [
    { id: 'exp-1', phase: 'UNDERSTAND', description: 'Exp 1', durationMinutes: Infinity },
  ],
}, 'setting-2026');
assert(migratedInf.learningExperiences?.[0]?.durationMinutes === undefined, 'Case AL: migration duration = Infinity becomes undefined');

// AL2. migration duration = -Infinity → undefined
const migratedNegInf = migrateLegacyLearningPlan({
  id: 'mig-neginf',
  learningExperiences: [
    { id: 'exp-1', phase: 'UNDERSTAND', description: 'Exp 1', durationMinutes: -Infinity },
  ],
}, 'setting-2026');
assert(migratedNegInf.learningExperiences?.[0]?.durationMinutes === undefined, 'Case AL2: migration duration = -Infinity becomes undefined');

// AL3. migration duration = '45' as any → undefined
const migratedStr = migrateLegacyLearningPlan({
  id: 'mig-str',
  learningExperiences: [
    { id: 'exp-1', phase: 'UNDERSTAND', description: 'Exp 1', durationMinutes: '45' as any },
  ],
}, 'setting-2026');
assert(migratedStr.learningExperiences?.[0]?.durationMinutes === undefined, 'Case AL3: migration duration = string becomes undefined');

// AM. migration valid positive duration → preserved
const migratedPos = migrateLegacyLearningPlan({
  id: 'mig-pos',
  learningExperiences: [
    { id: 'exp-1', phase: 'UNDERSTAND', description: 'Exp 1', durationMinutes: 60 },
  ],
}, 'setting-2026');
assert(migratedPos.learningExperiences?.[0]?.durationMinutes === 60, 'Case AM: migration valid positive duration is preserved');

// AN. tidak ada fabricated duration setelah migration
const migratedNoDur = migrateLegacyLearningPlan({
  id: 'mig-nodur',
  learningExperiences: [
    { id: 'exp-1', phase: 'UNDERSTAND', description: 'Exp 1' },
  ],
}, 'setting-2026');
assert(migratedNoDur.learningExperiences?.[0]?.durationMinutes === undefined, 'Case AN: No fabricated duration after migration');

// AO. canonical experience tetap memungkinkan plan tanpa learningSteps.core
const planCanonicalNoCore: LearningPlan = {
  ...planWithExperiences,
  id: 'plan-no-core',
  learningSteps: { opening: [], core: [], closing: [] },
  learningExperiences: [
    { id: 'exp-can-1', phase: 'UNDERSTAND', description: 'Memahami konsep' },
    { id: 'exp-can-2', phase: 'APPLY', description: 'Menerapkan konsep' },
    { id: 'exp-can-3', phase: 'REFLECT', description: 'Merefleksi konsep' },
  ],
};
const resAO = validateLearningPlan(planCanonicalNoCore, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAO.valid === true, 'Case AO: Canonical experience allows plan without learningSteps.core');
assert(resAO.errors.length === 0, 'Case AO: Zero errors on valid canonical experiences without core steps');

// AP. legacy-only plan tetap backward-compatible
const resAP = validateLearningPlan(legacyPlan, {
  academicSetting: mockSetting,
  tp: mockTP,
  atp: mockATP,
});
assert(resAP.valid === true, 'Case AP: legacy-only plan remains backward-compatible');
assert(resAP.errors.length === 0, 'Case AP: Zero errors on valid legacy plan');

// ----------------------------------------------------
// 9. DOCUMENT GENERATOR (generateModulAjar)
// ----------------------------------------------------
console.log('\n9. Testing Document Generator (generateModulAjar)');

async function runDocGenTests() {
  const ready2026Plan: LearningPlan = {
    ...planWithExperiences,
    status: 'SIAP',
    confirmedAt: new Date().toISOString(),
  };

  const docResult = await generateModulAjar({
    school: mockSchool,
    profile: mockProfile,
    academicSetting: mockSetting,
    tp: mockTP,
    atp: mockATP,
    learningPlans: [ready2026Plan],
    activeLearningPlanId: ready2026Plan.id,
    documentMode: 'blank', // Use blank mode to test doc children generation without requiring full SIAP validation chain
    skipDownload: true,
  });

  assert(docResult.fileName.includes('Modul_Ajar') || docResult.title.includes('MODUL AJAR'), 'generateModulAjar returns valid document metadata');
  assert(docResult.success === true, 'generateModulAjar produces successful result');

  // AQ. Output document canonical headings verification
  // Verify document generation produces proper Indonesian heading text structure and extracts docx tree text
  const docObj = docResult.document;
  assert(docObj !== undefined, 'Case AQ: Document object is returned in GeneratedDocumentResult');

  // Deep recursive extraction of all string values in docx tree
  function extractAllStrings(obj: any, found: string[] = []): string[] {
    if (!obj) return found;
    if (typeof obj === 'string') {
      found.push(obj);
      return found;
    }
    if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        // Skip large schema URLs or namespace definitions
        if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('urn:'))) {
          continue;
        }
        extractAllStrings(obj[key], found);
      }
    }
    return found;
  }

  const allDocTexts = extractAllStrings(docObj);
  const fullDocumentText = allDocTexts.join('\n');

  // Must contain canonical Indonesian headings
  assert(allDocTexts.some((t) => t.includes('Memahami')), 'Case AQ: Generated document contains "Memahami"');
  assert(allDocTexts.some((t) => t.includes('Mengaplikasi')), 'Case AQ: Generated document contains "Mengaplikasi"');
  assert(allDocTexts.some((t) => t.includes('Merefleksi')), 'Case AQ: Generated document contains "Merefleksi"');
  assert(allDocTexts.some((t) => t === 'A. Memahami'), 'Case AQ: Generated document contains section heading "A. Memahami"');
  assert(allDocTexts.some((t) => t === 'B. Mengaplikasi'), 'Case AQ: Generated document contains section heading "B. Mengaplikasi"');
  assert(allDocTexts.some((t) => t === 'C. Merefleksi'), 'Case AQ: Generated document contains section heading "C. Merefleksi"');

  // Must NOT contain old English suffixes in headings
  assert(!fullDocumentText.includes('Memahami (Understand)'), 'Case AQ: Generated document does NOT contain "Memahami (Understand)"');
  assert(!fullDocumentText.includes('Mengaplikasi (Apply)'), 'Case AQ: Generated document does NOT contain "Mengaplikasi (Apply)"');
  assert(!fullDocumentText.includes('Merefleksi (Reflect)'), 'Case AQ: Generated document does NOT contain "Merefleksi (Reflect)"');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('ALL REGULATORY COMPATIBILITY 2026 REGRESSION TESTS PASSED!');
  }
}

runDocGenTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

