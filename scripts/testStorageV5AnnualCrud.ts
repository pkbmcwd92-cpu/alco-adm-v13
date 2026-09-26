import assert from 'node:assert';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  createYearHierarchyV5,
  getAnnualDataV5,
  saveCPV5,
  saveCPAnalysisV5,
  saveTPV5,
  saveATPV5,
  saveCurriculumContextV5,
  saveAnnualJPReferenceV5,
  deleteCPV5,
  deleteCPAnalysisV5,
  deleteTPV5,
  deleteATPV5,
  deleteCurriculumContextV5,
  deleteAnnualJPReferenceV5,
} from '../src/services/storageV5';
import {
  TeacherProfile,
  SchoolData,
  CPData,
  CPAnalysisData,
  TPData,
  ATPData,
  CurriculumContextLock,
  AnnualJPReference,
} from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 ANNUAL SCOPED CRUD ===\n');

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

// Helper to seed profile and school
function seedProfileAndSchool(): { profile: TeacherProfile; school: SchoolData } {
  const profile: TeacherProfile = {
    id: 'prof-101',
    name: 'Budi Santoso, M.Pd.',
    nip: '198001012005011002',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SMA',
    schoolId: 'sch-101',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };

  const school: SchoolData = {
    id: 'sch-101',
    name: 'SMA Negeri 1 Surabaya',
    npsn: '20501001',
    address: 'Jl. Wijaya Kusuma No. 48',
    village: 'Ketabang',
    district: 'Genteng',
    regency: 'Kota Surabaya',
    province: 'Jawa Timur',
    principalName: 'Dra. Endang Sulistyowati',
    principalNip: '196805121992032005',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };

  const state = createInitialStorageV5();
  state.profiles.push(profile);
  state.schools.push(school);
  saveStorageV5(state);

  return { profile, school };
}

// Sample data fixtures
const sampleCP: CPData = {
  id: 'cp-1',
  academicSettingId: 'set-legacy-cp',
  generalDescription: 'Peserta didik mampu memahami operasi aljabar dan geometri analitik.',
  elements: [
    {
      id: 'elem-1',
      name: 'Aljabar',
      content: 'Pemahaman fungsi aljabar.',
    },
  ],
  updatedAt: '2026-07-05T00:00:00Z',
};

const sampleCPAnalysis: CPAnalysisData = {
  id: 'cpa-1',
  academicSettingId: 'set-legacy-cpa',
  items: [
    {
      id: 'item-1',
      elementName: 'Aljabar',
      cpCompetence: 'Memahami',
      materialScope: 'Fungsi Kuadrat',
      order: 1,
    },
  ],
  updatedAt: '2026-07-05T00:00:00Z',
};

const sampleTP: TPData = {
  id: 'tp-1',
  academicSettingId: 'set-legacy-tp',
  items: [
    {
      id: 'tp-item-1',
      code: 'TP 10.1',
      statement: 'Menjelaskan grafik fungsi kuadrat',
      competence: 'Menjelaskan',
      contentScope: 'Fungsi Kuadrat',
      order: 1,
    },
  ],
  updatedAt: '2026-07-05T00:00:00Z',
};

const sampleATP: ATPData = {
  id: 'atp-1',
  academicSettingId: 'set-legacy-atp',
  items: [
    {
      id: 'atp-item-1',
      stepNumber: 1,
      allocatedJP: 12,
    },
  ],
  updatedAt: '2026-07-05T00:00:00Z',
};

const sampleCurriculumContext: CurriculumContextLock = {
  curriculumType: 'KURIKULUM_MERDEKA',
  academicYear: '2026/2027',
  cpVersion: 'BSKAP 032/H/KR/2024',
  lockedAt: '2026-07-05T00:00:00Z',
};

const sampleAnnualJP: AnnualJPReference = {
  officialAnnualJP: 144,
  referenceWeeklyEquivalentJP: 4,
};

// =========================================================================
// TEST 1: Annual getter on fresh hierarchy returns undefined for unpopulated values
// =========================================================================
runTest('1. Annual getter: Fresh hierarchy returns YearPlan and undefined for unpopulated annual values', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  const annualData = getAnnualDataV5(h.yearPlan.id);
  assert.deepStrictEqual(annualData.yearPlan, h.yearPlan);
  assert.strictEqual(annualData.cp, undefined);
  assert.strictEqual(annualData.cpAnalysis, undefined);
  assert.strictEqual(annualData.tp, undefined);
  assert.strictEqual(annualData.atp, undefined);
  assert.strictEqual(annualData.curriculumContext, undefined);
  assert.strictEqual(annualData.annualJPReference, undefined);
});

// =========================================================================
// TEST 2: Save all annual collections & verify persistence
// =========================================================================
runTest('2. Save all annual collections: Persists all 6 annual collections losslessly', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  const savedCP = saveCPV5(h.yearPlan.id, sampleCP);
  const savedCPA = saveCPAnalysisV5(h.yearPlan.id, sampleCPAnalysis);
  const savedTP = saveTPV5(h.yearPlan.id, sampleTP);
  const savedATP = saveATPV5(h.yearPlan.id, sampleATP);
  const savedCC = saveCurriculumContextV5(h.yearPlan.id, sampleCurriculumContext);
  const savedJP = saveAnnualJPReferenceV5(h.yearPlan.id, sampleAnnualJP);

  assert.deepStrictEqual(savedCP, sampleCP);
  assert.deepStrictEqual(savedCPA, sampleCPAnalysis);
  assert.deepStrictEqual(savedTP, sampleTP);
  assert.deepStrictEqual(savedATP, sampleATP);
  assert.deepStrictEqual(savedCC, sampleCurriculumContext);
  assert.deepStrictEqual(savedJP, sampleAnnualJP);

  const reloaded = getAnnualDataV5(h.yearPlan.id);
  assert.deepStrictEqual(reloaded.cp, sampleCP);
  assert.deepStrictEqual(reloaded.cpAnalysis, sampleCPAnalysis);
  assert.deepStrictEqual(reloaded.tp, sampleTP);
  assert.deepStrictEqual(reloaded.atp, sampleATP);
  assert.deepStrictEqual(reloaded.curriculumContext, sampleCurriculumContext);
  assert.deepStrictEqual(reloaded.annualJPReference, sampleAnnualJP);

  const state = loadStorageV5();
  assert.strictEqual(state.annualData.cp.length, 1);
  assert.strictEqual(state.annualData.cpAnalysis.length, 1);
  assert.strictEqual(state.annualData.tp.length, 1);
  assert.strictEqual(state.annualData.atp.length, 1);
  assert.strictEqual(state.annualData.curriculumContext.length, 1);
  assert.strictEqual(state.annualJPReferences.length, 1);
});

// =========================================================================
// TEST 3: Upsert without duplicates
// =========================================================================
runTest('3. Upsert without duplicates: Saving TP twice replaces value without adding duplicate wrappers', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  saveTPV5(h.yearPlan.id, sampleTP);
  let state = loadStorageV5();
  assert.strictEqual(state.annualData.tp.length, 1);
  assert.strictEqual(state.annualData.tp[0].value.items.length, 1);

  const updatedTP: TPData = {
    ...sampleTP,
    items: [
      ...sampleTP.items,
      {
        id: 'tp-item-2',
        code: 'TP 10.2',
        statement: 'Menganalisis diskriminan fungsi kuadrat',
        competence: 'Menganalisis',
        contentScope: 'Fungsi Kuadrat',
        order: 2,
      },
    ],
  };

  saveTPV5(h.yearPlan.id, updatedTP);
  state = loadStorageV5();
  assert.strictEqual(state.annualData.tp.length, 1, 'Wrapper array length must remain 1');
  assert.strictEqual(state.annualData.tp[0].value.items.length, 2, 'Value must be updated to second version');
  assert.deepStrictEqual(getAnnualDataV5(h.yearPlan.id).tp, updatedTP);
});

// =========================================================================
// TEST 4: Two YearPlan isolation
// =========================================================================
runTest('4. Two YearPlan isolation: Updating YearPlan A does not mutate YearPlan B', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const hA = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  const hB = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 11',
    subject: 'Matematika',
  });

  const tpA: TPData = { ...sampleTP, id: 'tp-A' };
  const tpB: TPData = { ...sampleTP, id: 'tp-B' };

  saveTPV5(hA.yearPlan.id, tpA);
  saveTPV5(hB.yearPlan.id, tpB);

  // Update YearPlan A
  const tpAUpdated: TPData = {
    ...tpA,
    items: [{ id: 'tp-item-A-new', code: 'TP 10.X', statement: 'Statement A Updated', competence: 'C', contentScope: 'S', order: 1 }],
  };
  saveTPV5(hA.yearPlan.id, tpAUpdated);

  // Assert YearPlan B is completely unchanged
  const resB = getAnnualDataV5(hB.yearPlan.id);
  assert.deepStrictEqual(resB.tp, tpB, 'YearPlan B data must remain byte-for-byte intact');
});

// =========================================================================
// TEST 5: Outer scope authority
// =========================================================================
runTest('5. Outer scope authority: Matches by outer YearScopedEntry.yearPlanId regardless of legacy inner fields', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  const legacyMismatchTP: TPData = {
    ...sampleTP,
    academicSettingId: 'completely-bogus-legacy-id',
  };

  saveTPV5(h.yearPlan.id, legacyMismatchTP);

  const fetched = getAnnualDataV5(h.yearPlan.id);
  assert.deepStrictEqual(fetched.tp, legacyMismatchTP);
  assert.strictEqual(fetched.tp?.academicSettingId, 'completely-bogus-legacy-id', 'Inner legacy value preserved unmutated');
});

// =========================================================================
// TEST 6: Invalid YearPlan throws on save/get/delete
// =========================================================================
runTest('6. Invalid YearPlan: Operations throw on non-existent yearPlanId', () => {
  mockStorage.clear();
  seedProfileAndSchool();

  assert.throws(() => getAnnualDataV5('yp-ghost'), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => saveCPV5('yp-ghost', sampleCP), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => saveCPAnalysisV5('yp-ghost', sampleCPAnalysis), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => saveTPV5('yp-ghost', sampleTP), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => saveATPV5('yp-ghost', sampleATP), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => saveCurriculumContextV5('yp-ghost', sampleCurriculumContext), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => saveAnnualJPReferenceV5('yp-ghost', sampleAnnualJP), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => deleteCPV5('yp-ghost'), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => deleteCPAnalysisV5('yp-ghost'), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => deleteTPV5('yp-ghost'), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => deleteATPV5('yp-ghost'), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => deleteCurriculumContextV5('yp-ghost'), /YearPlan with ID "yp-ghost" not found/i);
  assert.throws(() => deleteAnnualJPReferenceV5('yp-ghost'), /YearPlan with ID "yp-ghost" not found/i);
});

// =========================================================================
// TEST 7: Annual JP single SSOT
// =========================================================================
runTest('7. Annual JP single SSOT: Stored strictly in annualJPReferences without dual writing to annualData', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  saveAnnualJPReferenceV5(h.yearPlan.id, sampleAnnualJP);

  const state = loadStorageV5();
  assert.strictEqual(state.annualJPReferences.length, 1);
  assert.strictEqual((state.annualData as any).annualJPReference, undefined, 'annualJPReference must NOT exist in annualData');

  // Update Annual JP
  const updatedJP: AnnualJPReference = {
    officialAnnualJP: 180,
    referenceWeeklyEquivalentJP: 5,
  };
  saveAnnualJPReferenceV5(h.yearPlan.id, updatedJP);

  const stateAfter = loadStorageV5();
  assert.strictEqual(stateAfter.annualJPReferences.length, 1, 'Must not duplicate entries');
  assert.deepStrictEqual(stateAfter.annualJPReferences[0].value, updatedJP);
});

// =========================================================================
// TEST 8: Delete annual entries
// =========================================================================
runTest('8. Delete: Removes wrappers cleanly while preserving YearPlan, Workspaces, and SemesterPlan', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  saveCPV5(h.yearPlan.id, sampleCP);
  saveCPAnalysisV5(h.yearPlan.id, sampleCPAnalysis);
  saveTPV5(h.yearPlan.id, sampleTP);
  saveATPV5(h.yearPlan.id, sampleATP);
  saveCurriculumContextV5(h.yearPlan.id, sampleCurriculumContext);
  saveAnnualJPReferenceV5(h.yearPlan.id, sampleAnnualJP);

  // Snapshot before deletions
  const stateBefore = loadStorageV5();
  const semesterDataSnapshot = JSON.parse(JSON.stringify(stateBefore.semesterData));

  // Deletions
  deleteCPV5(h.yearPlan.id);
  deleteCPAnalysisV5(h.yearPlan.id);
  deleteTPV5(h.yearPlan.id);
  deleteATPV5(h.yearPlan.id);
  deleteCurriculumContextV5(h.yearPlan.id);
  deleteAnnualJPReferenceV5(h.yearPlan.id);

  // Repeated delete is no-op
  deleteTPV5(h.yearPlan.id);

  const stateAfter = loadStorageV5();
  assert.strictEqual(stateAfter.yearPlans.length, 1, 'YearPlan must not be deleted');
  assert.strictEqual(stateAfter.workspaces.length, 1, 'Workspace must not be deleted');
  assert.strictEqual(stateAfter.semesterPlans.length, 2, 'SemesterPlans must not be deleted');
  assert.deepStrictEqual(stateAfter.semesterData, semesterDataSnapshot, 'SemesterData must remain byte-for-byte unchanged');

  const annualAfter = getAnnualDataV5(h.yearPlan.id);
  assert.strictEqual(annualAfter.cp, undefined);
  assert.strictEqual(annualAfter.cpAnalysis, undefined);
  assert.strictEqual(annualAfter.tp, undefined);
  assert.strictEqual(annualAfter.atp, undefined);
  assert.strictEqual(annualAfter.curriculumContext, undefined);
  assert.strictEqual(annualAfter.annualJPReference, undefined);
});

// =========================================================================
// TEST 9: Persistence Roundtrip
// =========================================================================
runTest('9. Persistence: Full annual state save -> load preserves exact deepStrictEqual', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
  });

  saveCPV5(h.yearPlan.id, sampleCP);
  saveCPAnalysisV5(h.yearPlan.id, sampleCPAnalysis);
  saveTPV5(h.yearPlan.id, sampleTP);
  saveATPV5(h.yearPlan.id, sampleATP);
  saveCurriculumContextV5(h.yearPlan.id, sampleCurriculumContext);
  saveAnnualJPReferenceV5(h.yearPlan.id, sampleAnnualJP);

  const state1 = loadStorageV5();
  saveStorageV5(state1);
  const state2 = loadStorageV5();

  assert.deepStrictEqual(state2, state1);
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 ANNUAL CRUD TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
