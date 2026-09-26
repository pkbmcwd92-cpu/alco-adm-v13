import assert from 'node:assert';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  createYearHierarchyV5,
  getYearPlanV5,
  getSemesterPlansForYearV5,
  setActiveYearPlanV5,
  setActiveSemesterPlanV5,
  renameWorkspaceV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import {
  TeacherProfile,
  SchoolData,
} from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 HIERARCHY CRUD LAYER ===\n');

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

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
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

// Helper to seed standard teacher profile and school
function seedStandardProfileAndSchool(): { profile: TeacherProfile; school: SchoolData } {
  const profile: TeacherProfile = {
    id: 'prof-guru-1',
    name: 'Ahmad Dahlan, S.Pd.',
    nip: '198501012010011001',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SMP',
    schoolId: 'sch-smp-1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };

  const school: SchoolData = {
    id: 'sch-smp-1',
    name: 'SMP Negeri 1 Bandung',
    npsn: '20210001',
    address: 'Jl. Merdeka No. 1',
    village: 'Babakan Ciamis',
    district: 'Sumur Bandung',
    regency: 'Kota Bandung',
    province: 'Jawa Barat',
    principalName: 'Drs. H. Mulyadi, M.Pd.',
    principalNip: '196501011990011001',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };

  const state = createInitialStorageV5();
  state.profiles.push(profile);
  state.schools.push(school);
  saveStorageV5(state);

  return { profile, school };
}

// =========================================================================
// TEST 1: Create Hierarchy: 1 YearPlan + 1 Workspace + 2 SemesterPlan
// =========================================================================
runTest('1. Create hierarchy: 1 YearPlan + 1 Workspace + 2 SemesterPlan created atomically', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  const res = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    classSection: '7A',
    subject: 'Matematika',
    subjectCode: 'MAT-7',
    phase: 'D',
    workspaceName: 'Matematika 7A 2026/2027',
    documentDate: '2026-07-15',
  });

  assert(res.yearPlan, 'YearPlan must be returned');
  assert(res.workspace, 'Workspace must be returned');
  assert.strictEqual(res.semesterPlans.length, 2, 'Must create exactly 2 SemesterPlans');

  const state = loadStorageV5();
  assert.strictEqual(state.yearPlans.length, 1);
  assert.strictEqual(state.workspaces.length, 1);
  assert.strictEqual(state.semesterPlans.length, 2);

  // Validate YearPlan has no semester
  const yp = res.yearPlan;
  assert.strictEqual(yp.profileId, profile.id);
  assert.strictEqual(yp.schoolId, school.id);
  assert.strictEqual(yp.academicYear, '2026/2027');
  assert.strictEqual((yp as any).semester, undefined, 'YearPlan must NOT contain semester');
  assert.strictEqual((yp as any).activeSemester, undefined, 'YearPlan must NOT contain activeSemester');

  // Validate Workspace
  const ws = res.workspace;
  assert.strictEqual(ws.yearPlanId, yp.id);
  assert.strictEqual(ws.profileId, profile.id);
  assert.strictEqual(ws.schoolId, school.id);
  assert.strictEqual(ws.name, 'Matematika 7A 2026/2027');
  assert.strictEqual(ws.documentDate, '2026-07-15');
  assert.strictEqual((ws as any).academicSettingId, undefined, 'Workspace must NOT contain academicSettingId');
  assert.strictEqual((ws as any).semester, undefined, 'Workspace must NOT contain semester');

  // Validate SemesterPlan 1 & 2 share parent yearPlanId
  const [sp1, sp2] = res.semesterPlans;
  assert.strictEqual(sp1.yearPlanId, yp.id);
  assert.strictEqual(sp1.semester, 1);
  assert.strictEqual(sp2.yearPlanId, yp.id);
  assert.strictEqual(sp2.semester, 2);
  assert((sp1 as any).profileId === undefined, 'SemesterPlan must derive profileId from parent YearPlan');
  assert((sp1 as any).schoolId === undefined, 'SemesterPlan must derive schoolId from parent YearPlan');
  assert((sp1 as any).academicYear === undefined, 'SemesterPlan must derive academicYear from parent YearPlan');

  // Validate Active pointers: Semester must be strictly undefined
  assert.strictEqual(state.activeProfileId, profile.id);
  assert.strictEqual(state.activeYearPlanId, yp.id);
  assert.strictEqual(state.activeWorkspaceId, ws.id);
  assert.strictEqual(state.activeSemesterPlanId, undefined, 'activeSemesterPlanId must remain undefined on creation');
});

// =========================================================================
// TEST 2: Duplicate exact YearPlan identity is rejected
// =========================================================================
runTest('2. Duplicate exact YearPlan: Rejects duplicate identity tuple without silently reusing', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    classSection: '7A',
    subject: 'Matematika',
  });

  // Attempt duplicate with exact same tuple
  assert.throws(
    () => {
      createYearHierarchyV5({
        profileId: profile.id,
        schoolId: school.id,
        academicYear: '2026/2027',
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade: 'Kelas 7',
        classSection: '7A',
        subject: 'Matematika',
      });
    },
    /Duplicate YearPlan/i,
    'Must throw duplicate YearPlan error'
  );

  // Different classSection is allowed
  const diffSection = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    classSection: '7B',
    subject: 'Matematika',
  });
  assert(diffSection.yearPlan.id !== undefined);
});

// =========================================================================
// TEST 3: Invalid profile/school relationship is rejected
// =========================================================================
runTest('3. Profile/School validation: Rejects non-existent profile/school and profile.schoolId mismatch', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  // Non-existent profile
  assert.throws(
    () => {
      createYearHierarchyV5({
        profileId: 'prof-ghost',
        schoolId: school.id,
        academicYear: '2026/2027',
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade: 'Kelas 7',
        subject: 'IPA',
      });
    },
    /Profile with ID "prof-ghost" not found/i
  );

  // Non-existent school
  assert.throws(
    () => {
      createYearHierarchyV5({
        profileId: profile.id,
        schoolId: 'sch-ghost',
        academicYear: '2026/2027',
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade: 'Kelas 7',
        subject: 'IPA',
      });
    },
    /School with ID "sch-ghost" not found/i
  );

  // Add another school
  const state = loadStorageV5();
  state.schools.push({
    id: 'sch-smp-2',
    name: 'SMP Negeri 2 Bandung',
    npsn: '20210002',
    address: 'Jl. Sunda No. 2',
    village: 'Kebon Pisang',
    district: 'Sumur Bandung',
    regency: 'Kota Bandung',
    province: 'Jawa Barat',
    principalName: 'Dra. Hj. Nunung',
    principalNip: '196601011991012001',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });
  saveStorageV5(state);

  // Profile schoolId mismatch (profile.schoolId is sch-smp-1, but requested sch-smp-2)
  assert.throws(
    () => {
      createYearHierarchyV5({
        profileId: profile.id,
        schoolId: 'sch-smp-2',
        academicYear: '2026/2027',
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade: 'Kelas 7',
        subject: 'IPA',
      });
    },
    /Profile school mismatch/i
  );
});

// =========================================================================
// TEST 4: getYearPlanV5 & getSemesterPlansForYearV5
// =========================================================================
runTest('4. Getters: getYearPlanV5 & getSemesterPlansForYearV5 return expected hierarchy entities', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  const created = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 8',
    subject: 'Bahasa Indonesia',
  });

  const fetchedYp = getYearPlanV5(created.yearPlan.id);
  assert.deepStrictEqual(fetchedYp, created.yearPlan);

  const nonExistentYp = getYearPlanV5('yp-fake');
  assert.strictEqual(nonExistentYp, undefined);

  const semesterPlans = getSemesterPlansForYearV5(created.yearPlan.id);
  assert.strictEqual(semesterPlans.length, 2);
  assert.strictEqual(semesterPlans[0].semester, 1);
  assert.strictEqual(semesterPlans[1].semester, 2);
});

// =========================================================================
// TEST 5: setActiveYearPlanV5 does NOT auto-select semester & clears invalid active semester
// =========================================================================
runTest('5. setActiveYearPlanV5: Sets active year & workspace pointers without defaulting semester', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  const h1 = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    subject: 'IPA',
  });

  const h2 = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 8',
    subject: 'IPA',
  });

  // Activate semester 2 of hierarchy 2
  setActiveSemesterPlanV5(h2.semesterPlans[1].id);
  let state = loadStorageV5();
  assert.strictEqual(state.activeYearPlanId, h2.yearPlan.id);
  assert.strictEqual(state.activeSemesterPlanId, h2.semesterPlans[1].id);

  // Now switch active YearPlan to h1
  setActiveYearPlanV5(h1.yearPlan.id);
  state = loadStorageV5();
  assert.strictEqual(state.activeYearPlanId, h1.yearPlan.id);
  assert.strictEqual(state.activeProfileId, profile.id);
  assert.strictEqual(state.activeWorkspaceId, h1.workspace.id);
  // activeSemesterPlanId was from h2, so it must be cleared to undefined (NOT defaulted to h1 semester 1)
  assert.strictEqual(state.activeSemesterPlanId, undefined);

  // Activating h1 when its semester is already active retains that semester if it's child
  setActiveSemesterPlanV5(h1.semesterPlans[0].id);
  setActiveYearPlanV5(h1.yearPlan.id);
  state = loadStorageV5();
  assert.strictEqual(state.activeSemesterPlanId, h1.semesterPlans[0].id);
});

// =========================================================================
// TEST 6: setActiveSemesterPlanV5 selects parent YearPlan and Workspace
// =========================================================================
runTest('6. setActiveSemesterPlanV5: Synchronizes parent YearPlan, Profile, and Workspace pointers', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  const h1 = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 9',
    subject: 'Bahasa Inggris',
  });

  setActiveSemesterPlanV5(h1.semesterPlans[1].id);
  const state = loadStorageV5();
  assert.strictEqual(state.activeSemesterPlanId, h1.semesterPlans[1].id);
  assert.strictEqual(state.activeYearPlanId, h1.yearPlan.id);
  assert.strictEqual(state.activeProfileId, profile.id);
  assert.strictEqual(state.activeWorkspaceId, h1.workspace.id);

  // Invalid semester plan id throws
  assert.throws(
    () => setActiveSemesterPlanV5('sp-non-existent'),
    /SemesterPlan with ID "sp-non-existent" not found/i
  );
});

// =========================================================================
// TEST 7: renameWorkspaceV5 only modifies name + updatedAt
// =========================================================================
runTest('7. renameWorkspaceV5: Only modifies name and updatedAt, rejecting invalid id or empty name', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    subject: 'Seni Budaya',
    workspaceName: 'Old Workspace Name',
  });

  const oldWs = h.workspace;
  const oldUpdatedAt = oldWs.updatedAt;

  // Empty name rejected
  assert.throws(() => renameWorkspaceV5(oldWs.id, '  '), /Workspace name cannot be empty/i);

  // Non-existent workspace rejected
  assert.throws(() => renameWorkspaceV5('ws-ghost', 'New Name'), /Workspace with ID "ws-ghost" not found/i);

  // Valid rename
  renameWorkspaceV5(oldWs.id, 'New Workspace Name 2026');

  const state = loadStorageV5();
  const updatedWs = state.workspaces.find((w) => w.id === oldWs.id)!;
  assert.strictEqual(updatedWs.name, 'New Workspace Name 2026');
  assert.strictEqual(updatedWs.id, oldWs.id);
  assert.strictEqual(updatedWs.yearPlanId, oldWs.yearPlanId);
  assert.strictEqual(updatedWs.profileId, oldWs.profileId);
  assert.strictEqual(updatedWs.schoolId, oldWs.schoolId);
});

// =========================================================================
// TEST 8: Save / Load Hierarchy Deep Equality
// =========================================================================
runTest('8. Save/Load hierarchy roundtrip: Persisted hierarchy state matches memory state with deepStrictEqual', () => {
  mockStorage.clear();
  const { profile, school } = seedStandardProfileAndSchool();

  createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    classSection: '7A',
    subject: 'Informatika',
    workspaceName: 'Informatika 7A',
  });

  const loadedState = loadStorageV5();
  assert.strictEqual(loadedState.schemaVersion, 5);
  assert.strictEqual(loadedState.yearPlans.length, 1);
  assert.strictEqual(loadedState.workspaces.length, 1);
  assert.strictEqual(loadedState.semesterPlans.length, 2);

  saveStorageV5(loadedState);
  const reloadedState = loadStorageV5();
  assert.deepStrictEqual(reloadedState, loadedState);
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 HIERARCHY CRUD TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
