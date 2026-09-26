import assert from 'node:assert';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  createProfileV5,
  updateProfileV5,
  deleteProfileV5,
  setActiveProfileV5,
  createSchoolV5,
  updateSchoolV5,
  savePrincipalHistoryV5,
  setActivePrincipalV5,
  createYearHierarchyV5,
  setActiveYearPlanV5,
  deleteWorkspaceV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';

console.log('=== RUNNING AUDIT: MERDEKA V5 APP SHELL CONTRACT (E.4.1B.1) ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

// Mock localStorage in Node environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public readCount = 0;
  public writeCount = 0;

  getItem(key: string): string | null {
    this.readCount++;
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.writeCount++;
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.readCount = 0;
    this.writeCount = 0;
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;

const V3_STORAGE_KEY = 'administrasi_guru_ai_storage_v3';

// Setup fresh state before tests
resetStorageV5();

const testSchool = createSchoolV5({
  name: 'SD Negeri 01 Merdeka',
  npsn: '20260001',
  address: 'Jl. Merdeka Belajar No. 10',
  village: 'Pendidikan',
  district: 'Cerdas',
  regency: 'Kota Belajar',
  province: 'Jawa Barat',
  principalName: 'Dr. H. Sutrisno, M.Pd.',
  principalNip: '197508152000031001',
});

const testProfile = createProfileV5({
  name: 'Ahmad Fauzi, S.Pd.',
  nip: '198803122015021002',
  status: 'PNS',
  defaultSubject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
  defaultLevel: 'SD',
  schoolId: testSchool.id,
});

runTest('1. New Merdeka administration creation creates exactly: 1 YearPlan, 1 Workspace, 2 SemesterPlans', () => {
  const result = createYearHierarchyV5({
    profileId: testProfile.id,
    schoolId: testSchool.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Kelas 2',
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    documentDate: '2026-07-13',
  });

  assert.ok(result.yearPlan, 'YearPlan must be returned');
  assert.ok(result.workspace, 'Workspace must be returned');
  assert.strictEqual(result.semesterPlans.length, 2, 'Exactly 2 SemesterPlans must be returned');

  const state = loadStorageV5();
  const yearPlans = state.yearPlans.filter((yp) => yp.id === result.yearPlan.id);
  const workspaces = state.workspaces.filter((ws) => ws.id === result.workspace.id);
  const semesterPlans = state.semesterPlans.filter((sp) => sp.yearPlanId === result.yearPlan.id);

  assert.strictEqual(yearPlans.length, 1, 'Exactly 1 YearPlan persisted');
  assert.strictEqual(workspaces.length, 1, 'Exactly 1 Workspace persisted');
  assert.strictEqual(semesterPlans.length, 2, 'Exactly 2 SemesterPlans persisted');
});

runTest('2. SemesterPlans are: semester 1, semester 2, both reference same YearPlan', () => {
  const state = loadStorageV5();
  const activeYP = state.yearPlans[0];
  const semesterPlans = state.semesterPlans.filter((sp) => sp.yearPlanId === activeYP.id);

  assert.strictEqual(semesterPlans.length, 2);
  const sem1 = semesterPlans.find((sp) => sp.semester === 1);
  const sem2 = semesterPlans.find((sp) => sp.semester === 2);

  assert.ok(sem1, 'SemesterPlan for Semester 1 must exist');
  assert.ok(sem2, 'SemesterPlan for Semester 2 must exist');
  assert.strictEqual(sem1.yearPlanId, activeYP.id, 'Semester 1 references YearPlan');
  assert.strictEqual(sem2.yearPlanId, activeYP.id, 'Semester 2 references YearPlan');
});

runTest('3. YearPlan contains no semester, activeSemester, academicSettingId', () => {
  const state = loadStorageV5();
  const yp = state.yearPlans[0] as any;

  assert.strictEqual('semester' in yp, false, 'YearPlan must not have "semester"');
  assert.strictEqual('activeSemester' in yp, false, 'YearPlan must not have "activeSemester"');
  assert.strictEqual('academicSettingId' in yp, false, 'YearPlan must not have "academicSettingId"');
  assert.strictEqual(yp.semester, undefined);
  assert.strictEqual(yp.activeSemester, undefined);
  assert.strictEqual(yp.academicSettingId, undefined);
});

runTest('4. Workspace contains no semester, activeSemester, academicSettingId', () => {
  const state = loadStorageV5();
  const ws = state.workspaces[0] as any;

  assert.strictEqual('semester' in ws, false, 'Workspace must not have "semester"');
  assert.strictEqual('activeSemester' in ws, false, 'Workspace must not have "activeSemester"');
  assert.strictEqual('academicSettingId' in ws, false, 'Workspace must not have "academicSettingId"');
  assert.strictEqual(ws.semester, undefined);
  assert.strictEqual(ws.activeSemester, undefined);
  assert.strictEqual(ws.academicSettingId, undefined);
});

runTest('5. Creation leaves: activeSemesterPlanId === undefined', () => {
  const state = loadStorageV5();
  assert.strictEqual(
    state.activeSemesterPlanId,
    undefined,
    'activeSemesterPlanId must strictly be undefined after annual hierarchy creation'
  );

  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.activeSemesterPlan,
    undefined,
    'runtimeContext.activeSemesterPlan must be undefined'
  );
  assert.strictEqual(runtime.semesterData, undefined, 'runtimeContext.semesterData must be undefined');
});

runTest('6. Selecting annual workspace/YearPlan does not default Semester 1', () => {
  const state = loadStorageV5();
  const yp = state.yearPlans[0];

  setActiveYearPlanV5(yp.id);

  const updatedState = loadStorageV5();
  assert.strictEqual(
    updatedState.activeSemesterPlanId,
    undefined,
    'Selecting annual YearPlan must never default or auto-select Semester 1'
  );

  const runtime = getRuntimeContextV5();
  assert.strictEqual(runtime.activeSemesterPlan, undefined);
});

runTest('7. Generated/default workspace name contains: subject + grade + academicYear', () => {
  const state = loadStorageV5();
  const ws = state.workspaces[0];
  const yp = state.yearPlans[0];

  assert.ok(ws.name.includes(yp.subject), `Workspace name "${ws.name}" must contain subject "${yp.subject}"`);
  assert.ok(ws.name.includes(yp.grade), `Workspace name "${ws.name}" must contain grade "${yp.grade}"`);
  assert.ok(ws.name.includes(yp.academicYear), `Workspace name "${ws.name}" must contain academicYear "${yp.academicYear}"`);
});

runTest('8. Generated/default workspace name contains no: Sem 1, Sem 2, Semester 1, Semester 2', () => {
  const state = loadStorageV5();
  const ws = state.workspaces[0];

  assert.strictEqual(/Sem 1/i.test(ws.name), false, 'Workspace name must not contain "Sem 1"');
  assert.strictEqual(/Sem 2/i.test(ws.name), false, 'Workspace name must not contain "Sem 2"');
  assert.strictEqual(/Semester 1/i.test(ws.name), false, 'Workspace name must not contain "Semester 1"');
  assert.strictEqual(/Semester 2/i.test(ws.name), false, 'Workspace name must not contain "Semester 2"');
});

runTest('9. Profile/School shell operations use V5 state and do not mutate legacy V3 key', () => {
  // Set byte-for-byte immutable V3 sentinel
  const v3Sentinel = JSON.stringify({
    marker: 'V3_SENTINEL_IMMUTABLE_TEST',
    checksum: 'abc-123-xyz-789',
    timestamp: 1718000000000,
    profiles: [{ id: 'legacy-p1', name: 'Legacy Teacher' }],
    schools: [{ id: 'legacy-s1', name: 'Legacy School' }],
    workspaces: [{ id: 'legacy-w1', academicSettingId: 'as-1' }],
  });
  mockStorage.setItem(V3_STORAGE_KEY, v3Sentinel);

  // Perform multiple V5 operations across profile, school, principal, year hierarchy
  const p2 = createProfileV5({
    name: 'Siti Nurhaliza, S.Pd.',
    nip: '199201012020012001',
    status: 'PPPK',
    defaultSubject: 'Matematika',
    defaultLevel: 'SD',
  });

  const s2 = createSchoolV5({
    name: 'SD Negeri 02 Merdeka Mandiri',
    npsn: '20260002',
    address: 'Jl. Merdeka No. 20',
    village: 'Mandiri',
    district: 'Pintar',
    regency: 'Kota Belajar',
    province: 'Jawa Barat',
    principalName: 'Budi Raharjo, M.Pd.',
    principalNip: '197001011995011002',
  });

  updateProfileV5(p2.id, { schoolId: s2.id });
  setActiveProfileV5(p2.id);

  savePrincipalHistoryV5({
    id: `ph-test-${Date.now()}`,
    schoolId: s2.id,
    name: 'Budi Raharjo, M.Pd.',
    nip: '197001011995011002',
    startDate: '2024-01-01',
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  const h2 = createYearHierarchyV5({
    profileId: p2.id,
    schoolId: s2.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Kelas 4',
    classSection: '4A',
    subject: 'Matematika',
    documentDate: '2026-07-14',
  });

  setActiveYearPlanV5(h2.yearPlan.id);

  // Cleanly delete hierarchy
  deleteWorkspaceV5(h2.workspace.id);

  // V3 sentinel check: must remain byte-for-byte unchanged!
  const currentV3 = mockStorage.getItem(V3_STORAGE_KEY);
  assert.strictEqual(
    currentV3,
    v3Sentinel,
    'Legacy V3 storage key must remain strictly byte-for-byte unchanged after V5 shell operations'
  );
});

runTest('10. Duplicate annual identity remains rejected by canonical V5 rules', () => {
  // Attempt to create duplicate hierarchy with same (profileId, schoolId, academicYear, grade, classSection, subject)
  assert.throws(
    () => {
      createYearHierarchyV5({
        profileId: testProfile.id,
        schoolId: testSchool.id,
        academicYear: '2026/2027',
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SD',
        grade: 'Kelas 2',
        subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
        documentDate: '2026-07-13',
      });
    },
    (err: any) => {
      return (
        err instanceof Error &&
        err.message.includes('Duplicate YearPlan') &&
        err.message.includes('A YearPlan already exists')
      );
    },
    'Duplicate YearPlan creation must be rejected by V5 rules'
  );
});

console.log(`\n========================================`);
console.log(`MERDEKA V5 APP SHELL CONTRACT: ALL ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`========================================\n`);
