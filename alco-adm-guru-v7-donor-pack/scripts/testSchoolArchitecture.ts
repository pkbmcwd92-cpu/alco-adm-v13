/**
 * Automated Acceptance Tests for School Management Architecture v3.1
 * 
 * Verifies Scenarios A through G:
 * - Skenario A: Profil Baru
 * - Skenario B: Sekolah Baru
 * - Skenario C: Ganti Sekolah
 * - Skenario D: Ubah Data Sekolah
 * - Skenario E: Multiple Profile
 * - Skenario F: Dua Profil Sekolah Sama
 * - Skenario G: Legacy Data Recovery
 */

import {
  loadAppStorage,
  saveAppStorage,
  getProfileWorkspace,
  saveProfile,
  createSchool,
  updateSchool,
  createWorkspace,
  setActiveProfileId,
  getSchools,
  getSchoolById,
} from '../src/services/storage';
import { TeacherProfile, SchoolData } from '../src/types';

// Mock localStorage in Node.js environment
const memoryStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = value;
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    },
  };
}

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName} ${detail ? `(${detail})` : ''}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${testName}`);
  }
}

async function runAcceptanceTests() {
  console.log('===============================================================');
  console.log('🏛️ RUNNING ACCEPTANCE TESTS: School Management v3.1 Architecture');
  console.log('===============================================================\n');

  // Reset storage to clean state
  localStorage.clear();
  const initialStorage = loadAppStorage();
  const initialSchool = initialStorage.schools[0];
  const initialProfile = initialStorage.profiles[0];

  assert(Boolean(initialSchool), 'Setup: Initial school exists');
  assert(Boolean(initialProfile), 'Setup: Initial profile exists');
  assert(initialProfile.schoolId === initialSchool.id, 'Setup: Initial profile points to initial school');
  assert((initialStorage as any).activeSchoolId === undefined, 'Setup v4: activeSchoolId is purged from initial state');
  assert(!initialStorage.teacherSchoolAssignments || initialStorage.teacherSchoolAssignments.length === 0, 'Setup v4: No initial assignments generated in getInitialState()');

  // -------------------------------------------------------------
  // Skenario A: Profil Baru
  // -------------------------------------------------------------
  console.log('\n--- Skenario A: Profil Baru ---');
  const profileA: TeacherProfile = {
    id: 'prof-test-a',
    name: 'Guru Skenario A',
    nip: '199001012015011001',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SD',
    schoolId: initialSchool.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveProfile(profileA);
  const stateAfterA = loadAppStorage();
  const savedProfileA = stateAfterA.profiles.find((p) => p.id === profileA.id);

  assert(savedProfileA !== undefined, 'Skenario A.1: Profil baru tersimpan');
  assert(savedProfileA?.schoolId === initialSchool.id, 'Skenario A.2: TeacherProfile.schoolId === school.id');

  // Buat workspace untuk profil A
  const wsA = createWorkspace({
    profileId: profileA.id,
    schoolId: profileA.schoolId!,
    setting: {
      level: 'SD',
      grade: 'Kelas 5',
      subject: 'Matematika',
      semester: '1 (Ganjil)',
      academicYear: '2026/2027',
    },
  });

  const workspaceDataA = getProfileWorkspace(profileA.id, wsA.id);
  assert(workspaceDataA.workspace.schoolId === initialSchool.id, 'Skenario A.3: Workspace baru otomatis memiliki schoolId sama');
  assert(workspaceDataA.school.id === initialSchool.id, 'Skenario A.4: Resolved school context berasal dari profile.schoolId');

  // -------------------------------------------------------------
  // Skenario B: Sekolah Baru (Tambah SchoolData TIDAK otomatis mengganti sekolah utama)
  // -------------------------------------------------------------
  console.log('\n--- Skenario B: Sekolah Baru ---');
  const newSchoolData = createSchool({
    name: 'SDIT Al-Falah Skenario B',
    npsn: '20998877',
    address: 'Jl. Melati No. 10',
    village: 'Sukamaju',
    district: 'Cilodong',
    regency: 'Kota Depok',
    province: 'Jawa Barat',
    principalName: 'H. Muhammad Yusuf, M.Pd.I.',
    principalNip: '197508102000031002',
    verificationStatus: 'verified',
  });

  assert(Boolean(newSchoolData.id), 'Skenario B.1: SchoolData baru dibuat dengan ID unik');
  assert(newSchoolData.id.startsWith('sch-'), 'Skenario B.2: Format ID sekolah valid');

  // VERIFIKASI KRUSIAL v4: Tambah SchoolData TIDAK mengganti sekolah utama profil
  const stateImmediatelyAfterCreate = loadAppStorage();
  const profACheckBeforeSwitch = stateImmediatelyAfterCreate.profiles.find((p) => p.id === profileA.id);
  assert(profACheckBeforeSwitch?.schoolId === initialSchool.id, 'Skenario B.3: Tambah SchoolData TIDAK mengganti sekolah utama profil');

  // Pergantian Sekolah Utama HANYA melalui saveProfile({ ...profile, schoolId: selectedSchoolId })
  saveProfile({
    ...savedProfileA!,
    schoolId: newSchoolData.id,
  });

  const stateAfterB = loadAppStorage();
  const updatedProfileA = stateAfterB.profiles.find((p) => p.id === profileA.id);
  assert(updatedProfileA?.schoolId === newSchoolData.id, 'Skenario B.4: TeacherProfile.schoolId === newSchool.id');

  const wsDataB = getProfileWorkspace(profileA.id, wsA.id);
  assert(wsDataB.workspace.schoolId === newSchoolData.id, 'Skenario B.5: AdministrationWorkspace.schoolId disinkronkan ke newSchool.id');
  assert(wsDataB.school.name === 'SDIT Al-Falah Skenario B', 'Skenario B.6: Context school ter-update ke sekolah baru');

  // -------------------------------------------------------------
  // Skenario C: Ganti Sekolah
  // -------------------------------------------------------------
  console.log('\n--- Skenario C: Ganti Sekolah ---');
  // Buat sekolah kedua
  const school2 = createSchool({
    name: 'SMP Negeri 45 Skenario C',
    npsn: '20112233',
    address: 'Jl. Veteran No. 5',
    village: 'Kebayoran Baru',
    district: 'Kebayoran Baru',
    regency: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    principalName: 'Dra. Endang Purwanti, M.Pd.',
    principalNip: '197004151996022001',
  });

  // Profil A ganti ke Sekolah 2
  saveProfile({
    ...updatedProfileA!,
    schoolId: school2.id,
  });

  const stateAfterC = loadAppStorage();
  const profileAfterC = stateAfterC.profiles.find((p) => p.id === profileA.id);
  assert(profileAfterC?.schoolId === school2.id, 'Skenario C.1: TeacherProfile.schoolId === Sekolah 2');

  const wsDataC = getProfileWorkspace(profileA.id, wsA.id);
  assert(wsDataC.workspace.schoolId === school2.id, 'Skenario C.2: Workspace milik Profil A otomatis sinkron ke Sekolah 2');
  assert(wsDataC.school.id === school2.id, 'Skenario C.3: Resolved school === Sekolah 2');
  assert(wsDataC.school.name === 'SMP Negeri 45 Skenario C', 'Skenario C.4: Nama sekolah sinkron ke Sekolah 2');

  // -------------------------------------------------------------
  // Skenario D: Ubah Data Sekolah
  // -------------------------------------------------------------
  console.log('\n--- Skenario D: Ubah Data Sekolah ---');
  const countSchoolsBeforeD = getSchools().length;

  const updatedSchool2 = updateSchool(school2.id, {
    name: 'SMP Negeri 45 Unggulan Jakarta',
    principalName: 'Dr. Endang Purwanti, M.Pd. (Gelar Diperbarui)',
  });

  const countSchoolsAfterD = getSchools().length;
  assert(countSchoolsBeforeD === countSchoolsAfterD, 'Skenario D.1: Tidak membuat sekolah baru (jumlah sekolah tetap)');
  assert(updatedSchool2.id === school2.id, 'Skenario D.2: ID Sekolah 2 tetap identik');
  assert(updatedSchool2.name === 'SMP Negeri 45 Unggulan Jakarta', 'Skenario D.3: SchoolData Sekolah 2 berubah');

  const wsDataD = getProfileWorkspace(profileA.id, wsA.id);
  assert(wsDataD.profile.schoolId === school2.id, 'Skenario D.4: Profil tetap terhubung ke Sekolah 2');
  assert(wsDataD.workspace.schoolId === school2.id, 'Skenario D.5: Workspace tetap terhubung ke Sekolah 2');
  assert(wsDataD.school.name === 'SMP Negeri 45 Unggulan Jakarta', 'Skenario D.6: Resolved workspace langsung menampilkan nama baru');

  // -------------------------------------------------------------
  // Skenario E: Multiple Profile
  // -------------------------------------------------------------
  console.log('\n--- Skenario E: Multiple Profile ---');
  // Profil A di Sekolah 2
  // Buat Profil B di Sekolah 1 (initialSchool)
  const profileB: TeacherProfile = {
    id: 'prof-test-b',
    name: 'Guru Skenario E (Profil B)',
    nip: '198802022012012002',
    status: 'PPPK',
    defaultSubject: 'Bahasa Indonesia',
    defaultLevel: 'SD',
    schoolId: initialSchool.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveProfile(profileB);

  // Buat workspace untuk Profil B
  const wsB = createWorkspace({
    profileId: profileB.id,
    schoolId: profileB.schoolId!,
    setting: {
      level: 'SD',
      grade: 'Kelas 2',
      subject: 'Bahasa Indonesia',
      semester: '1 (Ganjil)',
      academicYear: '2026/2027',
    },
  });

  // Switch ke Profil B
  setActiveProfileId(profileB.id);
  const wsDataForB = getProfileWorkspace(profileB.id, wsB.id);
  assert(wsDataForB.profile.id === profileB.id, 'Skenario E.1: Active Profile === Profil B');
  assert(wsDataForB.school.id === initialSchool.id, 'Skenario E.2: Active School === Sekolah 1 (Milik Profil B)');

  // Switch kembali ke Profil A
  setActiveProfileId(profileA.id);
  const wsDataForA = getProfileWorkspace(profileA.id, wsA.id);
  assert(wsDataForA.profile.id === profileA.id, 'Skenario E.3: Active Profile === Profil A');
  assert(wsDataForA.school.id === school2.id, 'Skenario E.4: Active School === Sekolah 2 (Milik Profil A)');
  assert(wsDataForA.school.id !== wsDataForB.school.id, 'Skenario E.5: Sekolah Profil A dan B independen dan tidak bocor');

  // -------------------------------------------------------------
  // Skenario F: Dua Profil Sekolah Sama
  // -------------------------------------------------------------
  console.log('\n--- Skenario F: Dua Profil Sekolah Sama ---');
  // Atur Profil B agar juga di Sekolah 2
  saveProfile({
    ...profileB,
    schoolId: school2.id,
  });

  // Perbarui data Sekolah 2
  updateSchool(school2.id, {
    address: 'Jl. Boulevard Raya No. 99, Kebayoran Baru',
  });

  const wsCheckA = getProfileWorkspace(profileA.id, wsA.id);
  const wsCheckB = getProfileWorkspace(profileB.id, wsB.id);

  assert(wsCheckA.school.id === school2.id, 'Skenario F.1: Profil A melihat Sekolah 2');
  assert(wsCheckB.school.id === school2.id, 'Skenario F.2: Profil B melihat Sekolah 2');
  assert(wsCheckA.school.address === 'Jl. Boulevard Raya No. 99, Kebayoran Baru', 'Skenario F.3: Profil A melihat alamat baru');
  assert(wsCheckB.school.address === 'Jl. Boulevard Raya No. 99, Kebayoran Baru', 'Skenario F.4: Profil B melihat alamat baru yang sama');

  // -------------------------------------------------------------
  // Skenario G: Legacy Data Recovery
  // -------------------------------------------------------------
  console.log('\n--- Skenario G: Legacy Data Recovery ---');
  // Simulasikan data lawas / corrupted di localStorage tanpa schoolId
  const rawLegacyState = {
    version: 3,
    activeProfileId: 'prof-legacy-1',
    activeWorkspaceId: 'ws-legacy-1',
    activeSchoolId: 'sch-legacy-unused',
    profiles: [
      {
        id: 'prof-legacy-1',
        name: 'Guru Tanpa SchoolId',
        nip: '197001011990011001',
        status: 'PNS',
        defaultSubject: 'PJOK',
        defaultLevel: 'SD',
        // schoolId sengaja dihilangkan (undefined / missing)
      },
      {
        id: 'prof-legacy-2',
        name: 'Guru Kedua Tanpa SchoolId',
        nip: '197001011990011002',
        status: 'PNS',
        defaultSubject: 'Seni Budaya',
        defaultLevel: 'SD',
        schoolId: '', // sengaja string kosong
      },
    ],
    schools: [
      {
        id: 'sch-master-1',
        name: 'SD Negeri Karang Tengah 1',
        npsn: '20607151',
        principalName: 'H. Suryadi, S.Pd.',
        principalNip: '196501011985011001',
      },
    ],
    workspaces: [
      {
        id: 'ws-legacy-1',
        profileId: 'prof-legacy-1',
        // schoolId sengaja kosong / salah
        schoolId: '',
        academicSettingId: 'acad-legacy-1',
        name: 'Administrasi PJOK',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    academicSettings: [
      {
        id: 'acad-legacy-1',
        profileId: 'prof-legacy-1',
        academicYear: '2026/2027',
        semester: '1 (Ganjil)',
        level: 'SD',
        grade: 'Kelas 4',
        subject: 'PJOK',
        phase: 'Fase B',
        curriculum: 'Kurikulum Merdeka',
        totalHoursPerWeek: 3,
        updatedAt: new Date().toISOString(),
      },
    ],
    cps: [],
    tps: [],
    atps: [],
    documents: [],
  };

  localStorage.setItem('administrasi_guru_ai_storage_v3', JSON.stringify(rawLegacyState));

  // Muat ulang melalui loadAppStorage
  const recoveredStorage = loadAppStorage();

  const recoveredProfile1 = recoveredStorage.profiles.find((p) => p.id === 'prof-legacy-1');
  const recoveredProfile2 = recoveredStorage.profiles.find((p) => p.id === 'prof-legacy-2');
  const recoveredWorkspace1 = recoveredStorage.workspaces.find((w) => w.id === 'ws-legacy-1');

  assert(Boolean(recoveredProfile1?.schoolId), 'Skenario G.1: Profil 1 otomatis diberi schoolId valid');
  assert(recoveredProfile1?.schoolId === 'sch-master-1', 'Skenario G.2: Profil 1 schoolId diarahkan ke master school valid');
  assert(Boolean(recoveredProfile2?.schoolId), 'Skenario G.3: Profil 2 otomatis diberi schoolId valid');
  assert(Boolean(recoveredWorkspace1?.schoolId), 'Skenario G.4: Workspace otomatis diberi schoolId valid');
  assert(recoveredWorkspace1?.schoolId === 'sch-master-1', 'Skenario G.5: Workspace sinkron dengan profile.schoolId');

  const resolvedLegacy = getProfileWorkspace('prof-legacy-1', 'ws-legacy-1');
  assert(resolvedLegacy.school.id === 'sch-master-1', 'Skenario G.6: Resolved context school valid dan tidak undefined');
  assert(resolvedLegacy.workspace.schoolId === 'sch-master-1', 'Skenario G.7: Tidak ada workspace dengan schoolId kosong');

  console.log('\n===============================================================');
  console.log('🎉 ALL ACCEPTANCE SCENARIOS (A-G) PASSED SUCCESSFULLY!');
  console.log('===============================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
