/**
 * Test Suite: Audit No. 6 — KKTP V7 Regression Tests
 *
 * Validates:
 * 1. Canonical TP Reference Resolution (Exact tpId, Legacy unique, Ambiguous, Dangling)
 * 2. No Fabricated Indicators, Levels, or Scores (No fake 75, no "Baik (Tuntas)", no fake indicator strings)
 * 3. Approach-specific Validation (rubrik, deskripsi, skala_interval, legacy_kkm)
 * 4. Workflow Lifecycle: DRAFT -> PERLU_DILENGKAPI -> SIAP (AI produces DRAFT)
 * 5. Upstream TP Invalidation & Stale Detection (basedOnTpUpdatedAt)
 * 6. Document Export Integrity & Guards
 */

import {
  resolveCriterionTPReference,
  validateKKTPCriterion,
  validateKKTPData,
  calculateLegacyKKM,
  isValidKkmAspect,
} from '../src/services/cpWorkflowService';
import {
  AssessmentCriterion,
  TPItem,
  AcademicSetting,
  SchoolData,
  TeacherProfile,
} from '../src/types';
import { generateKKTP, generatePenetapanKKM } from '../src/services/documentEngine';

console.log('===========================================================');
console.log('🧪 RUNNING TEST SUITE: Audit No. 6 — KKTP V7 Regression Tests');
console.log('===========================================================');

const mockSchool: SchoolData = {
  id: 'sch-1',
  name: 'SD Nusantara',
  npsn: '12345678',
  address: 'Jl. Merdeka',
  village: 'Gambir',
  district: 'Gambir',
  regency: 'Jakarta Pusat',
  province: 'DKI',
  principalName: 'Drs. Supriyanto',
  principalNip: '19700101',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockProfile: TeacherProfile = {
  id: 'prof-1',
  name: 'Guru Penggerak',
  nip: '19800101',
  status: 'PNS',
  schoolId: 'sch-1',
  defaultSubject: 'Matematika',
  defaultLevel: 'SD',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAcademic: AcademicSetting = {
  id: 'acad-1',
  profileId: 'prof-1',
  curriculum: 'Kurikulum Merdeka',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  subject: 'Matematika',
  grade: 'Kelas 4',
  phase: 'Fase B',
  level: 'SD',
  totalHoursPerWeek: 4,
  updatedAt: new Date().toISOString(),
};

const canonicalTPs: TPItem[] = [
  {
    id: 'tp-101',
    code: 'TP.1',
    statement: 'Memahami konsep dasar pecahan senilai',
    contentScope: 'Pecahan',
    competence: 'Memahami',
    p3Dimensions: [],
    order: 1,
  },
  {
    id: 'tp-102',
    code: 'TP.2',
    statement: 'Menyelesaikan masalah kontekstual terkait pecahan senilai',
    contentScope: 'Pecahan kontekstual',
    competence: 'Menyelesaikan masalah',
    p3Dimensions: [],
    order: 2,
  },
];

// --- 1. Canonical TP Reference Resolver Tests ---
console.log('--- 1. Canonical TP Reference Resolver Tests ---');

// Test 1a: Exact tpId match
const exactCriterion: AssessmentCriterion = {
  id: 'crit-1',
  academicSettingId: 'acad-1',
  tpId: 'tp-101',
  description: 'Kriteria TP 1',
  approach: 'rubrik',
  indicators: [],
  updatedAt: new Date().toISOString(),
  levels: [{ level: 'Baik', label: 'Baik', description: 'Memahami pecahan senilai' }],
};
const res1a = resolveCriterionTPReference(exactCriterion, canonicalTPs);
if (res1a.status === 'RESOLVED_REFERENCE' && res1a.canonicalTPItem?.id === 'tp-101') {
  console.log('✅ Exact tpId matches -> RESOLVED_REFERENCE');
} else {
  console.error('❌ Exact tpId resolution failed:', res1a);
  process.exit(1);
}

// Test 1b: Legacy unique tpCode match
const legacyCodeCrit = {
  id: 'crit-2',
  academicSettingId: 'acad-1',
  tpId: '',
  tpCode: 'TP.2',
  description: 'Kriteria TP 2',
  approach: 'deskripsi' as const,
  indicators: ['Mampu menyelesaikan masalah kontekstual'],
  levels: [],
  updatedAt: new Date().toISOString(),
};
const res1b = resolveCriterionTPReference(legacyCodeCrit as any, canonicalTPs);
if (res1b.status === 'LEGACY_MIGRATED' && res1b.canonicalTPItem?.id === 'tp-102') {
  console.log('✅ Unique legacy tpCode matches -> LEGACY_MIGRATED');
} else {
  console.error('❌ Unique legacy tpCode resolution failed:', res1b);
  process.exit(1);
}

// Test 1c: Legacy unique tpStatement match
const legacyStmtCrit = {
  id: 'crit-3',
  academicSettingId: 'acad-1',
  tpId: '',
  tpStatement: 'Memahami konsep dasar pecahan senilai',
  description: 'Kriteria TP 1 by statement',
  approach: 'rubrik' as const,
  indicators: [],
  updatedAt: new Date().toISOString(),
  levels: [{ level: 'Baik', label: 'Baik', description: 'Sesuai' }],
};
const res1c = resolveCriterionTPReference(legacyStmtCrit as any, canonicalTPs);
if (res1c.status === 'LEGACY_MIGRATED' && res1c.canonicalTPItem?.id === 'tp-101') {
  console.log('✅ Unique legacy tpStatement matches -> LEGACY_MIGRATED');
} else {
  console.error('❌ Unique legacy tpStatement resolution failed:', res1c);
  process.exit(1);
}

// Test 1d: Duplicate code -> AMBIGUOUS_REFERENCE (never silently picks first)
const duplicateTPs: TPItem[] = [
  { id: 'tp-dup-1', code: 'TP.X', statement: 'Statement 1', contentScope: 'M1', competence: 'C1', p3Dimensions: [], order: 1 },
  { id: 'tp-dup-2', code: 'TP.X', statement: 'Statement 2', contentScope: 'M2', competence: 'C2', p3Dimensions: [], order: 2 },
];
const dupCrit = {
  id: 'crit-dup',
  academicSettingId: 'acad-1',
  tpId: '',
  tpCode: 'TP.X',
  description: 'Crit dup',
  approach: 'rubrik' as const,
  indicators: [],
  levels: [],
  updatedAt: new Date().toISOString(),
};
const res1d = resolveCriterionTPReference(dupCrit as any, duplicateTPs);
if (res1d.status === 'AMBIGUOUS_REFERENCE' && !res1d.canonicalTPItem) {
  console.log('✅ Duplicate tpCode -> AMBIGUOUS_REFERENCE (did not pick match #0)');
} else {
  console.error('❌ Duplicate tpCode resolution failed:', res1d);
  process.exit(1);
}

// Test 1e: Dangling reference -> DANGLING_REFERENCE
const danglingCrit: AssessmentCriterion = {
  id: 'crit-dang',
  academicSettingId: 'acad-1',
  tpId: 'tp-nonexistent-999',
  description: 'Crit dangling',
  approach: 'rubrik',
  indicators: [],
  levels: [],
  updatedAt: new Date().toISOString(),
};
const res1e = resolveCriterionTPReference(danglingCrit, canonicalTPs);
if (res1e.status === 'DANGLING_REFERENCE' && !res1e.canonicalTPItem) {
  console.log('✅ Missing tpId in canonical list -> DANGLING_REFERENCE');
} else {
  console.error('❌ Dangling reference resolution failed:', res1e);
  process.exit(1);
}

// --- 2. Approach Validation & Passing Threshold Rules ---
console.log('--- 2. Approach Validation & Passing Threshold Rules ---');

// Test 2a: Rubrik requires levels with non-empty descriptions
const invalidRubrikCrit: AssessmentCriterion = {
  id: 'crit-r-inv',
  academicSettingId: 'acad-1',
  tpId: 'tp-101',
  description: 'Rubrik invalid',
  approach: 'rubrik',
  indicators: [],
  levels: [], // Empty!
  updatedAt: new Date().toISOString(),
};
const valRubrikInv = validateKKTPCriterion(invalidRubrikCrit, canonicalTPs);
if (!valRubrikInv.isValid && valRubrikInv.issues.some((i) => i.includes('kategori level performa'))) {
  console.log('✅ Rubrik without levels rejected');
} else {
  console.error('❌ Rubrik empty levels was not rejected:', valRubrikInv);
  process.exit(1);
}

// Test 2b: Merdeka approaches must NOT require passingScore 75
const validRubrikCrit: AssessmentCriterion = {
  id: 'crit-r-val',
  academicSettingId: 'acad-1',
  tpId: 'tp-101',
  description: 'Rubrik valid',
  approach: 'rubrik',
  passingThreshold: null, // Correct for Merdeka!
  indicators: [],
  updatedAt: new Date().toISOString(),
  levels: [
    { level: 'Perlu Bimbingan', label: 'Perlu Bimbingan', description: 'Belum memahami' },
    { level: 'Cukup', label: 'Cukup', description: 'Cukup memahami' },
    { level: 'Baik', label: 'Baik', description: 'Memahami dengan baik' },
  ],
};
const valRubrikVal = validateKKTPCriterion(validRubrikCrit, canonicalTPs);
if (valRubrikVal.isValid && valRubrikVal.issues.length === 0) {
  console.log('✅ Rubrik with null passingThreshold is completely valid in Merdeka');
} else {
  console.error('❌ Valid Merdeka rubrik rejected:', valRubrikVal);
  process.exit(1);
}

// Test 2c: Legacy KKM requires passingThreshold
const legacyKKMCritNoScore: AssessmentCriterion = {
  id: 'crit-kkm-no',
  academicSettingId: 'acad-1',
  tpId: 'tp-101',
  description: 'KKM without score',
  approach: 'legacy_kkm',
  passingThreshold: null,
  indicators: [],
  levels: [],
  updatedAt: new Date().toISOString(),
};
const valKkmNo = validateKKTPCriterion(legacyKKMCritNoScore, canonicalTPs);
if (!valKkmNo.isValid && valKkmNo.issues.some((i) => i.includes('KKM belum dihitung'))) {
  console.log('✅ legacy_kkm without passingThreshold correctly rejected');
} else {
  console.error('❌ legacy_kkm without score was not rejected:', valKkmNo);
  process.exit(1);
}

// Test 2d: Legacy KKM with null inputs (NO DATA > FAKE DATA)
const kkmNullCalc = calculateLegacyKKM(null, null, null);
if (kkmNullCalc === null) {
  console.log('✅ calculateLegacyKKM(null, null, null) returns null');
} else {
  console.error('❌ calculateLegacyKKM(null, null, null) returned:', kkmNullCalc);
  process.exit(1);
}

const legacyKKMCritNull: AssessmentCriterion = {
  id: 'crit-kkm-null',
  academicSettingId: 'acad-1',
  tpId: 'tp-101',
  description: 'KKM with null inputs',
  approach: 'legacy_kkm',
  kompleksitas: null,
  dayaDukung: null,
  intake: null,
  passingThreshold: kkmNullCalc,
  indicators: [],
  levels: [],
  workflowStatus: 'SIAP',
  updatedAt: new Date().toISOString(),
};
const valKkmNull = validateKKTPCriterion(legacyKKMCritNull, canonicalTPs);
if (!valKkmNull.isValid && valKkmNull.status !== 'SIAP' && valKkmNull.status === 'PERLU_DILENGKAPI') {
  console.log('✅ legacy_kkm with null inputs -> status ≠ SIAP (PERLU_DILENGKAPI)');
} else {
  console.error('❌ legacy_kkm with null inputs incorrectly accepted as SIAP:', valKkmNull);
  process.exit(1);
}

// Test 2e: Legacy KKM with partial inputs
const kkmPartialCalc1 = calculateLegacyKKM(75, null, null);
const kkmPartialCalc2 = calculateLegacyKKM(75, 80, null);
if (kkmPartialCalc1 === null && kkmPartialCalc2 === null) {
  console.log('✅ calculateLegacyKKM with partial inputs returns null');
} else {
  console.error('❌ calculateLegacyKKM with partial inputs failed:', { kkmPartialCalc1, kkmPartialCalc2 });
  process.exit(1);
}

const legacyKKMCritPartial: AssessmentCriterion = {
  id: 'crit-kkm-part',
  academicSettingId: 'acad-1',
  tpId: 'tp-101',
  description: 'KKM with partial inputs',
  approach: 'legacy_kkm',
  kompleksitas: 75,
  dayaDukung: 80,
  intake: null,
  passingThreshold: kkmPartialCalc2,
  indicators: [],
  levels: [],
  workflowStatus: 'SIAP',
  updatedAt: new Date().toISOString(),
};
const valKkmPartial = validateKKTPCriterion(legacyKKMCritPartial, canonicalTPs);
if (!valKkmPartial.isValid && valKkmPartial.status !== 'SIAP') {
  console.log('✅ legacy_kkm with partial inputs -> status ≠ SIAP');
} else {
  console.error('❌ legacy_kkm with partial inputs incorrectly accepted:', valKkmPartial);
  process.exit(1);
}

// Test 2f: Legacy KKM with complete inputs
const kkmCompleteCalc = calculateLegacyKKM(70, 80, 75);
if (kkmCompleteCalc === 75) {
  console.log('✅ calculateLegacyKKM(70, 80, 75) correctly calculates 75');
} else {
  console.error('❌ calculateLegacyKKM(70, 80, 75) failed:', kkmCompleteCalc);
  process.exit(1);
}

const legacyKKMCritComplete: AssessmentCriterion = {
  id: 'crit-kkm-complete',
  academicSettingId: 'acad-1',
  tpId: 'tp-101',
  description: 'KKM with complete inputs',
  approach: 'legacy_kkm',
  kompleksitas: 70,
  dayaDukung: 80,
  intake: 75,
  passingThreshold: kkmCompleteCalc,
  indicators: ['Mampu menyelesaikan latihan dasar'],
  levels: [],
  workflowStatus: 'SIAP',
  updatedAt: new Date().toISOString(),
};
const valKkmComplete = validateKKTPCriterion(legacyKKMCritComplete, canonicalTPs);
if (valKkmComplete.isValid && valKkmComplete.status === 'SIAP') {
  console.log('✅ legacy_kkm with complete inputs -> isValid = true and status = SIAP');
} else {
  console.error('❌ legacy_kkm with complete inputs failed validation:', valKkmComplete);
  process.exit(1);
}

// --- 3. Upstream TP Invalidation & Workflow Status ---
console.log('--- 3. Upstream TP Invalidation & Workflow Status ---');

const baseTpTime = '2026-03-01T10:00:00.000Z';
const updatedTpTime = '2026-03-05T12:00:00.000Z';

const siapCrit: AssessmentCriterion = {
  ...validRubrikCrit,
  workflowStatus: 'SIAP',
  needsReview: false,
  basedOnTpUpdatedAt: baseTpTime,
};

// When TP is updated after basedOnTpUpdatedAt
const staleValidation = validateKKTPCriterion(siapCrit, canonicalTPs, undefined, updatedTpTime);
if (!staleValidation.isValid && staleValidation.issues.some((i) => i.includes('diperbarui'))) {
  console.log('✅ Criterion detected as STALE when upstream TP updated');
} else {
  console.error('❌ Stale criterion not detected:', staleValidation);
  process.exit(1);
}

const mockTPData = {
  id: 'tp-data-1',
  academicSettingId: 'acad-1',
  items: canonicalTPs,
  workflowStatus: 'SIAP' as const,
  needsReview: false,
  updatedAt: updatedTpTime,
};

// Overall KKTP validation
const kktpDataRes = validateKKTPData([siapCrit], mockTPData, mockAcademic);
if (kktpDataRes.status === 'PERLU_DILENGKAPI' && !kktpDataRes.isSiap) {
  console.log('✅ Overall KKTP status downgraded to PERLU_DILENGKAPI when criterion is stale');
} else {
  console.error('❌ Overall KKTP validation failed for stale criterion:', kktpDataRes);
  process.exit(1);
}

// --- 4. Export Guards ---
console.log('--- 4. Export Guards ---');

// Test 4a: KKTP export blocked if TP is empty
let kktpExportBlocked = false;
try {
  await generateKKTP({
    school: mockSchool,
    profile: mockProfile,
    academicSetting: mockAcademic,
    tp: { id: 'tp-data', academicSettingId: 'acad-1', items: [], updatedAt: new Date().toISOString() },
    assessmentCriteria: [],
  });
} catch (e: any) {
  if (e.message.includes('Tujuan Pembelajaran (TP) belum tersedia')) {
    kktpExportBlocked = true;
  }
}
if (kktpExportBlocked) {
  console.log('✅ generateKKTP throws error when TP is empty (no fake TP rows generated)');
} else {
  console.error('❌ generateKKTP did not throw when TP is empty');
  process.exit(1);
}

// Test 4b: K13 KKM export blocked if items/kkmTotal are empty/missing
let k13ExportBlocked = false;
try {
  await generatePenetapanKKM({
    school: mockSchool,
    profile: mockProfile,
    academicSetting: { ...mockAcademic, curriculum: 'Kurikulum 2013' },
    k13KKM: { id: 'k13-1', academicSettingId: 'acad-1', kkmTotal: 75, items: [], updatedAt: new Date().toISOString() },
  });
} catch (e: any) {
  if (e.message.includes('belum tersedia')) {
    k13ExportBlocked = true;
  }
}
if (k13ExportBlocked) {
  console.log('✅ generatePenetapanKKM throws error when items are empty (no fake KD row generated)');
} else {
  console.error('❌ generatePenetapanKKM did not throw when items are empty');
  process.exit(1);
}

console.log('===========================================================');
console.log('🎉 ALL AUDIT NO. 6 — KKTP V7 REGRESSION TESTS PASSED 100%!');
console.log('===========================================================');
