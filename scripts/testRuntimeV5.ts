import assert from 'node:assert';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  createProfileV5,
  createSchoolV5,
  setActiveProfileV5,
  createYearHierarchyV5,
  setActiveYearPlanV5,
  setActiveSemesterPlanV5,
  saveTPV5,
  saveRosterV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';
import { Student, TPData } from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 RUNTIME READ MODEL ===\n');

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

// Mock localStorage in node environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public readCount = 0;
  public writeCount = 0;

  resetCounts(): void {
    this.readCount = 0;
    this.writeCount = 0;
  }

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
    this.resetCounts();
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

// Helper to create a valid SchoolData fixture
function createTestSchool(name: string, npsn = '10000001') {
  return createSchoolV5({
    name,
    npsn,
    address: 'Jl. Merdeka No. 1',
    village: 'Kampung Melayu',
    district: 'Jatinegara',
    regency: 'Jakarta Timur',
    province: 'DKI Jakarta',
    principalName: 'Drs. Kepala Sekolah',
    principalNip: '197001011995011001',
  });
}

// Helper to create a valid TeacherProfile fixture
function createTestProfile(name: string, schoolId?: string) {
  return createProfileV5({
    name,
    nip: '198501012010011001',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SD',
    schoolId,
  });
}

// Reset storage before tests
resetStorageV5();

// =========================================================================
// TEST 1: Empty V5 state returns valid empty RuntimeContextV5
// =========================================================================
runTest('1. Empty V5 state -> context valid', () => {
  resetStorageV5();

  const ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.activeProfile, undefined);
  assert.strictEqual(ctx.activeSchool, undefined);
  assert.strictEqual(ctx.activeYearPlan, undefined);
  assert.strictEqual(ctx.activeWorkspace, undefined);
  assert.deepStrictEqual(ctx.yearPlansForActiveProfile, []);
  assert.deepStrictEqual(ctx.workspacesForActiveProfile, []);
  assert.deepStrictEqual(ctx.semesterPlansForActiveYear, []);
  assert.strictEqual(ctx.activeSemesterPlan, undefined);
  assert.strictEqual(ctx.annualData, undefined);
  assert.strictEqual(ctx.semesterData, undefined);
  assert.strictEqual(ctx.curriculumRuntimeStatus, 'NO_YEAR_PLAN');
});

// =========================================================================
// TEST 2: Profile aktif tanpa YearPlan
// =========================================================================
runTest('2. Profile aktif tanpa YearPlan', () => {
  resetStorageV5();
  const school = createTestSchool('SD Negeri 1', '20000001');
  const profile = createTestProfile('Guru Murni', school.id);

  setActiveProfileV5(profile.id);

  const ctx = getRuntimeContextV5();
  assert.ok(ctx.activeProfile);
  assert.strictEqual(ctx.activeProfile.id, profile.id);
  assert.ok(ctx.activeSchool);
  assert.strictEqual(ctx.activeSchool.id, school.id);
  assert.strictEqual(ctx.activeYearPlan, undefined);
  assert.strictEqual(ctx.activeWorkspace, undefined);
  assert.deepStrictEqual(ctx.yearPlansForActiveProfile, []);
  assert.deepStrictEqual(ctx.workspacesForActiveProfile, []);
  assert.strictEqual(ctx.curriculumRuntimeStatus, 'NO_YEAR_PLAN');
});

// =========================================================================
// TEST 3: YearPlan aktif resolves Profile/School/Workspace
// =========================================================================
runTest('3. YearPlan aktif resolves Profile/School/Workspace', () => {
  resetStorageV5();
  const school = createTestSchool('SD Merdeka', '20000002');
  const profile = createTestProfile('Budi Raharjo', school.id);

  const hier = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '4',
    subject: 'IPAS',
  });

  setActiveYearPlanV5(hier.yearPlan.id);

  const ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.activeProfile?.id, profile.id);
  assert.strictEqual(ctx.activeSchool?.id, school.id);
  assert.strictEqual(ctx.activeYearPlan?.id, hier.yearPlan.id);
  assert.strictEqual(ctx.activeWorkspace?.id, hier.workspace.id);
});

// =========================================================================
// TEST 4 & 5: yearPlansForActiveProfile & workspacesForActiveProfile
// =========================================================================
runTest('4 & 5. yearPlansForActiveProfile and workspacesForActiveProfile are correct', () => {
  resetStorageV5();
  const school = createTestSchool('SD Pembina', '20000003');
  const profileA = createTestProfile('Profile A', school.id);
  const profileB = createTestProfile('Profile B', school.id);

  const hierA1 = createYearHierarchyV5({
    profileId: profileA.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '1',
    subject: 'Matematika',
  });

  const hierA2 = createYearHierarchyV5({
    profileId: profileA.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '2',
    subject: 'Matematika',
  });

  const hierB = createYearHierarchyV5({
    profileId: profileB.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '3',
    subject: 'Matematika',
  });

  setActiveProfileV5(profileA.id);

  const ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.yearPlansForActiveProfile.length, 2);
  assert.ok(ctx.yearPlansForActiveProfile.some((yp) => yp.id === hierA1.yearPlan.id));
  assert.ok(ctx.yearPlansForActiveProfile.some((yp) => yp.id === hierA2.yearPlan.id));
  assert.ok(!ctx.yearPlansForActiveProfile.some((yp) => yp.id === hierB.yearPlan.id));

  assert.strictEqual(ctx.workspacesForActiveProfile.length, 2);
  assert.ok(ctx.workspacesForActiveProfile.some((ws) => ws.id === hierA1.workspace.id));
  assert.ok(ctx.workspacesForActiveProfile.some((ws) => ws.id === hierA2.workspace.id));
  assert.ok(!ctx.workspacesForActiveProfile.some((ws) => ws.id === hierB.workspace.id));
});

// =========================================================================
// TEST 6 & 7 & 12: Sem1 + Sem2 tersedia, tanpa activeSemester -> semesterData undefined, tidak auto-select Semester 1
// =========================================================================
runTest('6, 7 & 12. Sem1 + Sem2 available, no activeSemester -> semesterData undefined and no auto-select Sem 1', () => {
  resetStorageV5();
  const school = createTestSchool('SD Inti', '20000004');
  const profile = createTestProfile('Siti Rahma', school.id);

  const hier = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '4',
    subject: 'Bahasa Indonesia',
  });

  // Explicitly set active YearPlan (this clears activeSemesterPlan)
  setActiveYearPlanV5(hier.yearPlan.id);

  const ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.semesterPlansForActiveYear.length, 2);
  assert.strictEqual(ctx.activeSemesterPlan, undefined);
  assert.strictEqual(ctx.semesterData, undefined);
});

// =========================================================================
// TEST 8 & 9: Active Sem1 -> data Sem1 saja, Sem1/Sem2 isolation
// =========================================================================
runTest('8 & 9. Active Sem1 -> Sem1 data only, Sem1/Sem2 isolation', () => {
  resetStorageV5();
  const school = createTestSchool('SD Utama', '20000005');
  const profile = createTestProfile('Ahmad Hadi', school.id);

  const hier = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '5',
    subject: 'Pancasila',
  });

  const [sem1, sem2] = hier.semesterPlans;

  const roster1: Student[] = [{ id: 's1', name: 'Siswa Sem1', academicSettingId: sem1.id }];
  const roster2: Student[] = [{ id: 's2', name: 'Siswa Sem2', academicSettingId: sem2.id }];

  saveRosterV5(sem1.id, roster1);
  saveRosterV5(sem2.id, roster2);

  // Activate Sem 1
  setActiveSemesterPlanV5(sem1.id);
  let ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.activeSemesterPlan?.id, sem1.id);
  assert.deepStrictEqual(ctx.semesterData?.roster, roster1);

  // Activate Sem 2
  setActiveSemesterPlanV5(sem2.id);
  ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.activeSemesterPlan?.id, sem2.id);
  assert.deepStrictEqual(ctx.semesterData?.roster, roster2);
});

// =========================================================================
// TEST 10 & 11: Annual data from active YearPlan & no fallback to other hierarchy
// =========================================================================
runTest('10 & 11. Annual data comes from active YearPlan without fallback', () => {
  resetStorageV5();
  const school = createTestSchool('SD Teladan', '20000006');
  const profile = createTestProfile('Dewi Lestari', school.id);

  const hierA = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '1',
    subject: 'Seni Musik',
  });

  const hierB = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '2',
    subject: 'Seni Rupa',
  });

  const tpA: TPData = {
    id: 'tp-a',
    academicSettingId: 'set-a',
    items: [{ id: 'item-a', code: 'TP 1', statement: 'TP A', competence: 'Mahi', contentScope: 'A', order: 1 }],
    updatedAt: new Date().toISOString(),
  };

  const tpB: TPData = {
    id: 'tp-b',
    academicSettingId: 'set-b',
    items: [{ id: 'item-b', code: 'TP 2', statement: 'TP B', competence: 'Mahi', contentScope: 'B', order: 1 }],
    updatedAt: new Date().toISOString(),
  };

  saveTPV5(hierA.yearPlan.id, tpA);
  saveTPV5(hierB.yearPlan.id, tpB);

  setActiveYearPlanV5(hierA.yearPlan.id);
  let ctx = getRuntimeContextV5();
  assert.deepStrictEqual(ctx.annualData?.tp, tpA);

  setActiveYearPlanV5(hierB.yearPlan.id);
  ctx = getRuntimeContextV5();
  assert.deepStrictEqual(ctx.annualData?.tp, tpB);
});

// =========================================================================
// TEST 13 & 14: Curriculum runtime status (K13 -> K13_DEFERRED, Merdeka -> READY)
// =========================================================================
runTest('13 & 14. Curriculum runtime status (K13 -> K13_DEFERRED, Merdeka -> READY)', () => {
  resetStorageV5();
  const school = createTestSchool('SD Nusantara', '20000007');
  const profile = createTestProfile('Bambang Sukarno', school.id);

  const hierK13 = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'K13',
    level: 'SD',
    grade: '6',
    subject: 'Tematik',
  });

  setActiveYearPlanV5(hierK13.yearPlan.id);
  let ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.curriculumRuntimeStatus, 'K13_DEFERRED');

  const hierMerdeka = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '4',
    subject: 'IPAS',
  });

  setActiveYearPlanV5(hierMerdeka.yearPlan.id);
  ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.curriculumRuntimeStatus, 'READY');
});

// =========================================================================
// TEST 15 & 16: Exactly 1 V5 read and 0 writes
// =========================================================================
runTest('15 & 16. getRuntimeContextV5 performs exactly 1 read and 0 writes', () => {
  resetStorageV5();
  const school = createTestSchool('SD Cendekia', '20000008');
  const profile = createTestProfile('Eko Prasetyo', school.id);
  const hier = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2025/2026',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: '3',
    subject: 'Bahasa Indonesia',
  });

  setActiveYearPlanV5(hier.yearPlan.id);

  mockStorage.resetCounts();
  const ctx = getRuntimeContextV5();
  assert.ok(ctx);

  assert.strictEqual(mockStorage.readCount, 1);
  assert.strictEqual(mockStorage.writeCount, 0);
});

// =========================================================================
// TEST 17: Legacy V3 sentinel tidak dibaca/ditulis
// =========================================================================
runTest('17. Legacy V3 storage key is completely untouched and unread', () => {
  resetStorageV5();
  mockStorage.setItem('administrasi_guru_ai_storage_v3', JSON.stringify({ legacy: true }));
  mockStorage.resetCounts();

  const ctx = getRuntimeContextV5();
  assert.ok(ctx);

  assert.strictEqual(mockStorage.readCount, 1); // Only STORAGE_KEY_V5
  assert.strictEqual(mockStorage.writeCount, 0);
  assert.strictEqual(
    mockStorage.getItem('administrasi_guru_ai_storage_v3'),
    JSON.stringify({ legacy: true })
  );
});

// =========================================================================
// TEST 18: First-run canonical behavior
// =========================================================================
runTest('18. First-run: Empty storage initializes canonical V5 state with exactly 1 read and 1 write', () => {
  mockStorage.clear();
  assert.strictEqual(mockStorage.getItem(STORAGE_KEY_V5), null);

  mockStorage.resetCounts();
  const ctx = getRuntimeContextV5();

  assert.strictEqual(mockStorage.readCount, 1);
  assert.strictEqual(mockStorage.writeCount, 1);

  assert.strictEqual(ctx.curriculumRuntimeStatus, 'NO_YEAR_PLAN');
  assert.strictEqual(ctx.activeProfile, undefined);
  assert.strictEqual(ctx.activeYearPlan, undefined);
  assert.strictEqual(ctx.activeWorkspace, undefined);
  assert.strictEqual(ctx.activeSemesterPlan, undefined);
  assert.strictEqual(ctx.annualData, undefined);
  assert.strictEqual(ctx.semesterData, undefined);
});

console.log(`\n========================================`);
console.log(`ALL V5 RUNTIME READ MODEL TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
