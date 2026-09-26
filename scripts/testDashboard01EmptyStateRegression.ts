import assert from 'node:assert';
import fs from 'node:fs';
import {
  getInitialState,
  loadAppStorage,
  getProfileWorkspace,
  saveProfile,
  deleteProfile,
  createSchool,
  createWorkspace,
  duplicateWorkspace,
  saveK13KKM,
  saveAppStorage,
  generateWorkspaceName,
} from '../src/services/storage';
import { TeacherProfile, SchoolData, K13KKM } from '../src/types';

console.log('=== TEST SUITE: Dashboard 01 — Zero Profile & Unresolved Workspace Creation Regression ===');

// Mock localStorage for Node environment
const memoryStore: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => memoryStore[key] || null,
  setItem: (key: string, val: string) => {
    memoryStore[key] = val;
  },
  removeItem: (key: string) => {
    delete memoryStore[key];
  },
  clear: () => {
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
  },
};

// Reset storage
localStorage.clear();

// TEST 1: Clean Initial State
console.log('\n[TEST 1] Verifying getInitialState returns clean empty collections...');
const initial = getInitialState();
assert.strictEqual(initial.profiles.length, 0, 'profiles must be empty array');
assert.strictEqual(initial.schools.length, 0, 'schools must be empty array');
assert.strictEqual(initial.workspaces.length, 0, 'workspaces must be empty array');
assert.strictEqual(initial.academicSettings.length, 0, 'academicSettings must be empty array');
assert.strictEqual(initial.cps.length, 0, 'cps must be empty array');
assert.strictEqual(initial.tps.length, 0, 'tps must be empty array');
assert.strictEqual(initial.atps.length, 0, 'atps must be empty array');
assert.strictEqual(initial.documents.length, 0, 'documents must be empty array');
assert.strictEqual(initial.students.length, 0, 'students must be empty array');
assert.strictEqual(initial.activeProfileId, '', 'activeProfileId must be empty string');
assert.strictEqual(initial.activeWorkspaceId, '', 'activeWorkspaceId must be empty string');
console.log('✓ TEST 1 PASSED');

// TEST 2: Zero Profile State & Unresolved Academic Context
console.log('\n[TEST 2] Verifying getProfileWorkspace on 0 profiles returns status NO_PROFILE with NO synthetic context...');
const storageBefore = JSON.stringify(loadAppStorage());

const emptyWs = getProfileWorkspace('', '');
assert.ok(emptyWs, 'must return ProfileWorkspaceData object');
assert.strictEqual(emptyWs.status, 'NO_PROFILE', 'status must be NO_PROFILE');
assert.strictEqual(emptyWs.profile, undefined, 'profile must be undefined');
assert.strictEqual(emptyWs.workspace, undefined, 'workspace must be undefined');
assert.strictEqual(emptyWs.school, undefined, 'school must be undefined');
assert.strictEqual(emptyWs.academicSetting, undefined, 'academicSetting must be undefined');
assert.strictEqual(emptyWs.context, undefined, 'context must be undefined');
assert.strictEqual(emptyWs.cp, undefined, 'cp must be undefined');
assert.strictEqual(emptyWs.tp, undefined, 'tp must be undefined');
assert.strictEqual(emptyWs.atp, undefined, 'atp must be undefined');
assert.strictEqual(emptyWs.students.length, 0, 'students must be empty');

const storageAfter = JSON.stringify(loadAppStorage());
assert.strictEqual(storageBefore, storageAfter, 'getProfileWorkspace() on 0 profiles MUST NOT mutate storage or generate synthetic data');
console.log('✓ TEST 2 PASSED');

// TEST 3: Invalid Explicit Profile ID Fail Behavior
console.log('\n[TEST 3] Verifying explicit invalid profileId fails explicitly...');
assert.throws(
  () => {
    createWorkspace({
      profileId: 'non-existent-profile-id',
      setting: {
        grade: '',
        subject: '',
      },
    });
  },
  (err: Error) => {
    return err.message.includes('non-existent-profile-id');
  },
  'Should throw explicit error for invalid profileId'
);
console.log('✓ TEST 3 PASSED');

// TEST 4: Create Workspace with Empty Academic Fields
console.log('\n[TEST 4] Creating profile and workspace with empty academic fields...');
const school: SchoolData = {
  id: 'sch-test-1',
  name: 'SD Negeri Test 1',
  npsn: '10002000',
  address: 'Jl. Test No. 1',
  village: 'Desa Test',
  district: 'Kec Test',
  regency: 'Kab Test',
  province: 'Prov Test',
  principalName: 'Kepala Test, M.Pd.',
  principalNip: '198001012005011001',
  verificationStatus: 'verified',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const createdSchool = createSchool(school);

const profile: TeacherProfile = {
  id: 'prof-test-1',
  name: 'Budi Santoso, S.Pd.',
  nip: '198501012010011001',
  status: 'PNS',
  defaultSubject: 'Matematika',
  defaultLevel: 'SD',
  schoolId: createdSchool.id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
saveProfile(profile);

const emptyFieldWs = createWorkspace({
  profileId: profile.id,
  setting: {
    curriculum: '',
    academicYear: '',
    semester: '',
    grade: '',
    subject: '',
    totalHoursPerWeek: undefined,
  },
});

assert.ok(emptyFieldWs, 'Workspace created');
assert.strictEqual(emptyFieldWs.profileId, 'prof-test-1', 'Bound to profile.id');
assert.strictEqual(emptyFieldWs.schoolId, createdSchool.id, 'Bound to profile.schoolId');

const stateAfterEmptyWs = loadAppStorage();
const setting = stateAfterEmptyWs.academicSettings.find((s) => s.id === emptyFieldWs.academicSettingId);
assert.ok(setting, 'AcademicSetting exists');

assert.strictEqual(setting.academicYear, '', 'academicYear must be empty string');
assert.strictEqual(setting.semester, '', 'semester must be empty string');
assert.strictEqual(setting.grade, '', 'grade must be empty string');
assert.strictEqual(setting.phase, '', 'phase must be empty string when grade is empty');
assert.strictEqual(setting.totalHoursPerWeek, undefined, 'totalHoursPerWeek must be undefined');
assert.strictEqual(setting.curriculum, '', 'curriculum must be empty string');
assert.strictEqual(setting.curriculumType, undefined, 'curriculumType must be undefined');
assert.strictEqual(setting.subject, 'Matematika', 'Uses profile defaultSubject when setting subject is empty');
assert.strictEqual(setting.level, 'SD', 'Uses profile defaultLevel when setting level is empty');

// Verify student roster is strictly empty (0 students)
const studentsForWs = stateAfterEmptyWs.students.filter((s) => s.academicSettingId === setting.id);
assert.strictEqual(studentsForWs.length, 0, 'Workspace student roster must be 0');
console.log('✓ TEST 4 PASSED');

// TEST 5: Phase Derivation when Valid Level and Grade Provided
console.log('\n[TEST 5] Verifying phase derivation on valid level + grade...');
const validWs = createWorkspace({
  profileId: profile.id,
  setting: {
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'IPAS',
    curriculum: 'Kurikulum Merdeka',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    totalHoursPerWeek: 5,
  },
});
const stateAfterValid = loadAppStorage();
const validSetting = stateAfterValid.academicSettings.find((s) => s.id === validWs.academicSettingId)!;
assert.strictEqual(validSetting.phase, 'Fase B', 'Fase B derived for SD Kelas 4');
assert.strictEqual(validSetting.curriculumType, 'KURIKULUM_MERDEKA', 'curriculumType set to KURIKULUM_MERDEKA');
assert.strictEqual(validSetting.academicYear, '2025/2026', 'academicYear correctly set');
assert.strictEqual(validSetting.totalHoursPerWeek, 5, 'totalHoursPerWeek correctly set');
console.log('✓ TEST 5 PASSED');

// TEST 6: K13 creation must not fabricate KKM defaults
console.log('\n[TEST 6] Verifying K13 workspace creation and read do not fabricate KKM...');
const k13Ws = createWorkspace({
  profileId: profile.id,
  setting: {
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'Matematika',
    curriculum: 'Kurikulum 2013',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
  },
});
const stateAfterK13Create = loadAppStorage();
const k13Setting = stateAfterK13Create.academicSettings.find((s) => s.id === k13Ws.academicSettingId)!;
assert.strictEqual(k13Setting.curriculumType, 'K13', 'Explicit K13 resolves correctly');
assert.strictEqual((stateAfterK13Create.k13KKMs || []).some((k) => k.academicSettingId === k13Setting.id), false, 'K13 create must not create default KKM');
const beforeK13Read = JSON.stringify(loadAppStorage());
const k13Read = getProfileWorkspace(profile.id, k13Ws.id);
const afterK13Read = JSON.stringify(loadAppStorage());
assert.strictEqual(k13Read.k13KKM, undefined, 'K13 read with no KKM remains unresolved');
assert.strictEqual(beforeK13Read, afterK13Read, 'K13 read must not mutate storage or fabricate KKM/KD');
console.log('✓ TEST 6 PASSED');

// TEST 7: Unknown curriculum remains unresolved and creates no curriculum artifacts (including duplication)
console.log('\n[TEST 7] Verifying unknown curriculum stays unresolved on create and duplication...');
const unknownWs = createWorkspace({
  profileId: profile.id,
  setting: {
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'IPAS',
    curriculum: 'Kurikulum Eksperimental Sekolah',
  },
});
const stateAfterUnknown = loadAppStorage();
const unknownSetting = stateAfterUnknown.academicSettings.find((s) => s.id === unknownWs.academicSettingId)!;
assert.strictEqual(unknownSetting.curriculumType, undefined, 'Unknown curriculum must not resolve to Merdeka or K13');
assert.strictEqual(stateAfterUnknown.cps.some((c) => c.academicSettingId === unknownSetting.id), false, 'Unknown curriculum must not create CP');
assert.strictEqual(stateAfterUnknown.tps.some((t) => t.academicSettingId === unknownSetting.id), false, 'Unknown curriculum must not create TP');
assert.strictEqual(stateAfterUnknown.atps.some((a) => a.academicSettingId === unknownSetting.id), false, 'Unknown curriculum must not create ATP');
assert.strictEqual((stateAfterUnknown.k13Analyses || []).some((k) => k.academicSettingId === unknownSetting.id), false, 'Unknown curriculum must not create K13 structures');

// Duplication of unknown curriculum
const duplicatedUnknown = duplicateWorkspace(unknownWs.id, 'Kelas 5', 'IPAS');
assert.ok(duplicatedUnknown, 'Duplicated unknown workspace created');
const stateAfterUnknownDup = loadAppStorage();
const dupUnknownSetting = stateAfterUnknownDup.academicSettings.find((s) => s.id === duplicatedUnknown!.academicSettingId)!;
assert.strictEqual(dupUnknownSetting.curriculumType, undefined, 'Duplicated unknown curriculum must remain undefined');
assert.strictEqual(dupUnknownSetting.curriculum, 'Kurikulum Eksperimental Sekolah', 'Curriculum name preserved without forced conversion');
assert.strictEqual(stateAfterUnknownDup.cps.some((c) => c.academicSettingId === dupUnknownSetting.id), false, 'Duplicated unknown must not create CP');
assert.strictEqual(stateAfterUnknownDup.tps.some((t) => t.academicSettingId === dupUnknownSetting.id), false, 'Duplicated unknown must not create TP');
assert.strictEqual(stateAfterUnknownDup.atps.some((a) => a.academicSettingId === dupUnknownSetting.id), false, 'Duplicated unknown must not create ATP');
assert.strictEqual((stateAfterUnknownDup.k13Analyses || []).some((k) => k.academicSettingId === dupUnknownSetting.id), false, 'Duplicated unknown must not create K13Analysis');
assert.strictEqual((stateAfterUnknownDup.k13KKMs || []).some((k) => k.academicSettingId === dupUnknownSetting.id), false, 'Duplicated unknown must not create K13KKM');
console.log('✓ TEST 7 PASSED');

// TEST 7B: Explicit Merdeka duplication
console.log('\n[TEST 7B] Verifying explicit Merdeka duplication routes to Merdeka only...');
const merdekaDup = duplicateWorkspace(validWs.id, 'Kelas 5', 'IPAS');
assert.ok(merdekaDup, 'Merdeka duplicate workspace created');
const stateAfterMerdekaDup = loadAppStorage();
const merdekaDupSetting = stateAfterMerdekaDup.academicSettings.find((s) => s.id === merdekaDup!.academicSettingId)!;
assert.strictEqual(merdekaDupSetting.curriculumType, 'KURIKULUM_MERDEKA', 'Curriculum type remains KURIKULUM_MERDEKA');
assert.strictEqual(stateAfterMerdekaDup.cps.some((c) => c.academicSettingId === merdekaDupSetting.id), true, 'CP created for Merdeka duplicate');
assert.strictEqual(stateAfterMerdekaDup.tps.some((t) => t.academicSettingId === merdekaDupSetting.id), true, 'TP created for Merdeka duplicate');
assert.strictEqual(stateAfterMerdekaDup.atps.some((a) => a.academicSettingId === merdekaDupSetting.id), true, 'ATP created for Merdeka duplicate');
assert.strictEqual((stateAfterMerdekaDup.k13Analyses || []).some((k) => k.academicSettingId === merdekaDupSetting.id), false, 'Merdeka duplicate must NOT create K13Analysis');
assert.strictEqual((stateAfterMerdekaDup.k13KKMs || []).some((k) => k.academicSettingId === merdekaDupSetting.id), false, 'Merdeka duplicate must NOT create K13KKM');
console.log('✓ TEST 7B PASSED');

// TEST 8: K13 duplication clones legitimate KKM only when source has it
console.log('\n[TEST 8] Verifying K13 duplicate preserves absent vs legitimate KKM...');
const k13CloneNoKkm = duplicateWorkspace(k13Ws.id, 'Kelas 5', 'Matematika');
assert.ok(k13CloneNoKkm, 'K13 clone without source KKM created');
let stateAfterK13Clone = loadAppStorage();
assert.strictEqual((stateAfterK13Clone.k13KKMs || []).some((k) => k.academicSettingId === k13CloneNoKkm!.academicSettingId), false, 'Absent source KKM remains absent in clone');

const legitimateKKM: K13KKM = {
  id: `kkm-${k13Setting.id}`,
  academicSettingId: k13Setting.id,
  kkmMataPelajaran: 82,
  predikatA: 92,
  predikatB: 84,
  predikatC: 76,
  items: [
    {
      id: 'kkm-real-1',
      kd: 'KD hasil input guru',
      indikator: 'Indikator hasil input guru',
      kompleksitas: 80,
      dayaDukung: 82,
      intake: 84,
      kkmIndikator: 82,
    },
  ],
  updatedAt: new Date().toISOString(),
};
saveK13KKM(legitimateKKM);
const k13CloneWithKkm = duplicateWorkspace(k13Ws.id, 'Kelas 6', 'Matematika');
assert.ok(k13CloneWithKkm, 'K13 clone with source KKM created');
stateAfterK13Clone = loadAppStorage();
const clonedKKM = (stateAfterK13Clone.k13KKMs || []).find((k) => k.academicSettingId === k13CloneWithKkm!.academicSettingId);
assert.ok(clonedKKM, `Legitimate source KKM cloned. k13Setting.id=${k13Setting.id}, k13KKMs=${JSON.stringify(stateAfterK13Clone.k13KKMs)}`);
assert.strictEqual(clonedKKM!.kkmMataPelajaran, 82, 'Legitimate KKM value preserved');
assert.strictEqual(clonedKKM!.items.length, 1, 'Legitimate KKM item cloned');
console.log('✓ TEST 8 PASSED');

// TEST 9: Invalid school relationship remains unresolved
console.log('\n[TEST 9] Verifying invalid profile.schoolId does not bind to unrelated school...');
const invalidSchoolProfile: TeacherProfile = {
  id: 'prof-invalid-school',
  name: 'Guru Tanpa Sekolah Valid',
  nip: '',
  status: 'PNS',
  defaultSubject: '',
  defaultLevel: 'SD',
  schoolId: 'missing-school-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
saveProfile(invalidSchoolProfile);
const invalidSchoolState = loadAppStorage();
const savedInvalidSchoolProfile = invalidSchoolState.profiles.find((p) => p.id === invalidSchoolProfile.id)!;
assert.strictEqual(savedInvalidSchoolProfile.schoolId, undefined, 'Invalid schoolId is cleared instead of rebound to another school');
const invalidSchoolWs = getProfileWorkspace(invalidSchoolProfile.id, '');
assert.strictEqual(invalidSchoolWs.school, undefined, 'Invalid school relationship remains unresolved');
console.log('✓ TEST 9 PASSED');

// TEST 10: New workspace UI source must not hardcode canonical academic defaults
console.log('\n[TEST 10] Verifying new-workspace UI source has no implicit canonical defaults...');
const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.ok(!appSource.includes("useState('Kelas 1')"), 'New workspace grade must not initialize to Kelas 1');
assert.ok(!appSource.includes("useState('Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)')"), 'New workspace subject must not initialize to PJOK');
assert.ok(!appSource.includes("useState<'1 (Ganjil)' | '2 (Genap)'>('1 (Ganjil)')"), 'New workspace semester must not initialize to semester 1');
assert.ok(!appSource.includes("useState('2026/2027')"), 'New workspace year must not initialize to 2026/2027');
assert.ok(!appSource.includes('<option value="2026/2027">2026/2027</option>'), 'New workspace year must not use hardcoded year options');
console.log('✓ TEST 10 PASSED');

// TEST 11: generateWorkspaceName Presentational Placeholders
console.log('\n[TEST 11] Verifying generateWorkspaceName display placeholders...');
const unresolvedName = generateWorkspaceName({
  subject: '',
  grade: '',
  semester: '',
  academicYear: '',
});
assert.strictEqual(unresolvedName, 'Mata Pelajaran — Kelas - — Sem - — Tahun Ajaran -');
assert.ok(!unresolvedName.includes('2026/2027'), 'Should not contain 2026/2027 fallback');
console.log('✓ TEST 11 PASSED');

// TEST 11B: Missing level migration test
console.log('\n[TEST 11B] Verifying missing level in migration results in unresolved phase...');
const curStore = loadAppStorage();
const legacySettingId = `acad-legacy-${Date.now()}`;
curStore.academicSettings.push({
  id: legacySettingId,
  profileId: profile.id,
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: '', // Unresolved level
  grade: 'Kelas 1',
  phase: 'Fase A', // Stale/legacy value that shouldn't be derived without level
  subject: 'Matematika',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  updatedAt: new Date().toISOString(),
});
saveAppStorage(curStore);

const reloadedStore = loadAppStorage();
const migratedSetting = reloadedStore.academicSettings.find((s) => s.id === legacySettingId)!;
assert.strictEqual(migratedSetting.level, '', 'Missing level remains unresolved');
assert.strictEqual(migratedSetting.phase, '', 'Phase becomes unresolved when level is missing (must NOT fallback to SD/Fase A)');
console.log('✓ TEST 11B PASSED');

// TEST A: Source guard direct mutation
console.log('\n[TEST A] Verifying getProfileWorkspace does not directly mutate academicSetting.phase...');
const storageSource = fs.readFileSync(
  new URL('../src/services/storage.ts', import.meta.url),
  'utf8'
);

assert.ok(
  !/academicSetting\.phase\s*=/.test(storageSource),
  'getProfileWorkspace must not directly mutate academicSetting.phase'
);
console.log('✓ TEST A PASSED');

// TEST B: Migration valid level + grade
console.log('\n[TEST B] Verifying migration on valid level + grade derives correct phase...');
const legacyStore = loadAppStorage();
const legacySettingIdValid = `acad-legacy-valid-${Date.now()}`;
legacyStore.academicSettings.push({
  id: legacySettingIdValid,
  profileId: profile.id,
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SD',
  grade: 'Kelas 4',
  phase: '', // Empty/stale phase on legacy data
  subject: 'IPAS',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  updatedAt: new Date().toISOString(),
});
saveAppStorage(legacyStore);

// Trigger migration via loadAppStorage()
const reloadedLegacyStore = loadAppStorage();
const migratedValidSetting = reloadedLegacyStore.academicSettings.find((s) => s.id === legacySettingIdValid)!;
assert.strictEqual(migratedValidSetting.level, 'SD', 'Level preserved as SD');
assert.strictEqual(migratedValidSetting.grade, 'Kelas 4', 'Grade preserved as Kelas 4');
assert.strictEqual(migratedValidSetting.phase, 'Fase B', 'Phase derived as Fase B during migration for valid level + grade');
console.log('✓ TEST B PASSED');

// TEST 12: Delete Profile and Return to Zero-Profile
console.log('\n[TEST 12] Deleting profiles and verifying clean return to 0-profile state...');
deleteProfile(invalidSchoolProfile.id);
deleteProfile(profile.id);
const finalState = loadAppStorage();
assert.strictEqual(finalState.profiles.length, 0, 'profiles count is 0');
assert.strictEqual(finalState.workspaces.length, 0, 'workspaces count is 0');
assert.strictEqual(finalState.academicSettings.length, 0, 'academicSettings count is 0');

const finalEmptyWs = getProfileWorkspace('', '');
assert.strictEqual(finalEmptyWs.status, 'NO_PROFILE', 'Returns NO_PROFILE status');
console.log('✓ TEST 12 PASSED');

console.log('\n=== ALL DASHBOARD 01 WORKSPACE REGRESSION TESTS PASSED ===\n');
