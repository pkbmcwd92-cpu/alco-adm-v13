import assert from 'node:assert';
import {
  createInitialStorageV5,
  validateStorageStateV5,
  serializeBackupV5,
  parseBackupV5,
} from '../src/services/storageV5';
import { AppStorageStateV5 } from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 RELATIONAL INTEGRITY GATE ===\n');

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

function createValidTestState(): AppStorageStateV5 {
  const state = createInitialStorageV5();

  state.profiles.push({
    id: 'prof-1',
    name: 'Budi Santoso',
    nip: '198501012010011001',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SMP',
    schoolId: 'sch-1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });

  state.schools.push({
    id: 'sch-1',
    name: 'SMP Negeri 1 Jakarta',
    npsn: '20101010',
    address: 'Jl. Pemuda No. 1',
    village: 'Rawamangun',
    district: 'Pulo Gadung',
    regency: 'Jakarta Timur',
    province: 'DKI Jakarta',
    principalName: 'Drs. H. Ahmad',
    principalNip: '196501011990011001',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });

  state.yearPlans.push({
    id: 'yp-1',
    profileId: 'prof-1',
    schoolId: 'sch-1',
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    subject: 'Matematika',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });

  state.workspaces.push({
    id: 'ws-1',
    profileId: 'prof-1',
    schoolId: 'sch-1',
    yearPlanId: 'yp-1',
    name: 'Matematika Kelas 7',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });

  state.semesterPlans.push(
    {
      id: 'sp-1',
      yearPlanId: 'yp-1',
      semester: 1,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    },
    {
      id: 'sp-2',
      yearPlanId: 'yp-1',
      semester: 2,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    }
  );

  return state;
}

// =========================================================================
// TEST 1: Valid hierarchy passes validation
// =========================================================================
runTest('1. Valid State: Complete canonical hierarchy passes validateStorageStateV5', () => {
  const state = createValidTestState();
  const validated = validateStorageStateV5(state);
  assert.strictEqual(validated.yearPlans.length, 1);
  assert.strictEqual(validated.workspaces.length, 1);
  assert.strictEqual(validated.semesterPlans.length, 2);
});

// =========================================================================
// TEST 2: Root ID Uniqueness
// =========================================================================
runTest('2. Root ID Uniqueness: Rejects duplicate IDs in profiles, schools, workspaces, yearPlans, semesterPlans', () => {
  // Duplicate profile ID
  const dupProf = createValidTestState();
  dupProf.profiles.push({ ...dupProf.profiles[0] });
  assert.throws(() => validateStorageStateV5(dupProf), /Duplicate ID "prof-1" found in "profiles"/i);

  // Duplicate school ID
  const dupSch = createValidTestState();
  dupSch.schools.push({ ...dupSch.schools[0] });
  assert.throws(() => validateStorageStateV5(dupSch), /Duplicate ID "sch-1" found in "schools"/i);

  // Duplicate workspace ID
  const dupWs = createValidTestState();
  dupWs.workspaces.push({ ...dupWs.workspaces[0], id: 'ws-1' });
  assert.throws(() => validateStorageStateV5(dupWs), /Duplicate ID "ws-1" found in "workspaces"/i);

  // Duplicate yearPlan ID
  const dupYp = createValidTestState();
  dupYp.yearPlans.push({ ...dupYp.yearPlans[0] });
  assert.throws(() => validateStorageStateV5(dupYp), /Duplicate ID "yp-1" found in "yearPlans"/i);

  // Duplicate semesterPlan ID
  const dupSp = createValidTestState();
  dupSp.semesterPlans.push({ ...dupSp.semesterPlans[0] });
  assert.throws(() => validateStorageStateV5(dupSp), /Duplicate ID "sp-1" found in "semesterPlans"/i);
});

// =========================================================================
// TEST 3: YearPlan Relational Integrity
// =========================================================================
runTest('3. YearPlan Relations: Enforces existence of profileId, schoolId, and profile.schoolId equality', () => {
  // Non-existent profileId
  const badProf = createValidTestState();
  badProf.yearPlans[0].profileId = 'prof-non-existent';
  assert.throws(() => validateStorageStateV5(badProf), /references non-existent profileId/i);

  // Non-existent schoolId
  const badSch = createValidTestState();
  badSch.yearPlans[0].schoolId = 'sch-non-existent';
  assert.throws(() => validateStorageStateV5(badSch), /references non-existent schoolId/i);

  // Profile school mismatch
  const mismatchSch = createValidTestState();
  mismatchSch.schools.push({
    id: 'sch-2',
    name: 'SMP Negeri 2 Jakarta',
    npsn: '20101011',
    address: 'Jl. Pemuda No. 2',
    village: 'Rawamangun',
    district: 'Pulo Gadung',
    regency: 'Jakarta Timur',
    province: 'DKI Jakarta',
    principalName: 'Drs. H. Ahmad',
    principalNip: '196501011990011001',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });
  mismatchSch.yearPlans[0].schoolId = 'sch-2'; // profile has schoolId = 'sch-1'
  assert.throws(() => validateStorageStateV5(mismatchSch), /profile school mismatch/i);
});

// =========================================================================
// TEST 4: Workspace Relational Integrity
// =========================================================================
runTest('4. Workspace Relations: Enforces 1 YearPlan ↔ 1 Workspace and matching profileId / schoolId', () => {
  // Non-existent yearPlanId
  const badYp = createValidTestState();
  badYp.workspaces[0].yearPlanId = 'yp-non-existent';
  assert.throws(() => validateStorageStateV5(badYp), /references non-existent yearPlanId/i);

  // Workspace profileId mismatch
  const badWsProf = createValidTestState();
  badWsProf.workspaces[0].profileId = 'prof-other';
  assert.throws(() => validateStorageStateV5(badWsProf), /profileId "prof-other" does not match parent YearPlan/i);

  // Workspace schoolId mismatch (explicit test)
  const badWsSch = createValidTestState();
  badWsSch.workspaces[0].schoolId = 'sch-other';
  assert.throws(() => validateStorageStateV5(badWsSch), /schoolId "sch-other" does not match parent YearPlan schoolId/i);

  // Missing workspace for YearPlan
  const missingWs = createValidTestState();
  missingWs.workspaces = [];
  assert.throws(() => validateStorageStateV5(missingWs), /YearPlan "yp-1" does not have a matching Workspace/i);

  // Duplicate workspace for same YearPlan
  const dupWs = createValidTestState();
  dupWs.workspaces.push({
    id: 'ws-2',
    profileId: 'prof-1',
    schoolId: 'sch-1',
    yearPlanId: 'yp-1',
    name: 'Duplicate Workspace',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });
  assert.throws(() => validateStorageStateV5(dupWs), /has duplicate Workspaces/i);
});

// =========================================================================
// TEST 5: SemesterPlan Relational Integrity
// =========================================================================
runTest('5. SemesterPlan Relations: Enforces 1 YearPlan ↔ exactly 1 Sem 1 & 1 Sem 2', () => {
  // Non-existent yearPlanId
  const badYp = createValidTestState();
  badYp.semesterPlans[0].yearPlanId = 'yp-non-existent';
  assert.throws(() => validateStorageStateV5(badYp), /Parent YearPlan "yp-non-existent" not found/i);

  // Invalid semester value
  const badSemVal = createValidTestState();
  (badSemVal.semesterPlans[0] as any).semester = 3;
  assert.throws(() => validateStorageStateV5(badSemVal), /must be exactly number 1 or 2/i);

  // Missing Semester 1
  const noSem1 = createValidTestState();
  noSem1.semesterPlans = noSem1.semesterPlans.filter((sp) => sp.semester !== 1);
  assert.throws(() => validateStorageStateV5(noSem1), /must have exactly 1 SemesterPlan for Semester 1/i);

  // Missing Semester 2
  const noSem2 = createValidTestState();
  noSem2.semesterPlans = noSem2.semesterPlans.filter((sp) => sp.semester !== 2);
  assert.throws(() => validateStorageStateV5(noSem2), /must have exactly 1 SemesterPlan for Semester 2/i);

  // Duplicate Semester 1
  const dupSem1 = createValidTestState();
  dupSem1.semesterPlans.push({
    id: 'sp-3',
    yearPlanId: 'yp-1',
    semester: 1,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });
  assert.throws(() => validateStorageStateV5(dupSem1), /must have exactly 1 SemesterPlan for Semester 1/i);

  // Duplicate Semester 2
  const dupSem2 = createValidTestState();
  dupSem2.semesterPlans.push({
    id: 'sp-4',
    yearPlanId: 'yp-1',
    semester: 2,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });
  assert.throws(() => validateStorageStateV5(dupSem2), /must have exactly 1 SemesterPlan for Semester 2/i);
});

// =========================================================================
// TEST 6: Year Scoped Entries Integrity
// =========================================================================
runTest('6. Year Scoped Entries: Enforces existing yearPlanId and max 1 entry per yearPlanId per collection', () => {
  // Invalid yearPlanId
  const badAnnual = createValidTestState();
  badAnnual.annualJPReferences.push({
    yearPlanId: 'yp-non-existent',
    value: {
      officialAnnualJP: 108,
      referenceWeeklyEquivalentJP: 3,
      regulationReference: 'Permendikbudristek 12/2024',
    },
  });
  assert.throws(() => validateStorageStateV5(badAnnual), /references non-existent yearPlanId "yp-non-existent"/i);

  // Duplicate yearPlanId entry in annualData.tp
  const dupTp = createValidTestState();
  dupTp.annualData.tp.push(
    {
      yearPlanId: 'yp-1',
      value: {
        id: 'tp-1',
        academicSettingId: 'set-1',
        items: [],
        updatedAt: '2026-07-01T00:00:00Z',
      },
    },
    {
      yearPlanId: 'yp-1',
      value: {
        id: 'tp-2',
        academicSettingId: 'set-1',
        items: [],
        updatedAt: '2026-07-01T00:00:00Z',
      },
    }
  );
  assert.throws(() => validateStorageStateV5(dupTp), /Duplicate entry for yearPlanId "yp-1" in collection "annualData.tp"/i);
});

// =========================================================================
// TEST 7: Semester Scoped Entries Integrity & SemesterJP Strict Matching
// =========================================================================
runTest('7. Semester Scoped Entries: Enforces existing semesterPlanId, max 1 entry per collection, and semesterJPSettings inner ID match', () => {
  // Invalid semesterPlanId
  const badSem = createValidTestState();
  badSem.semesterData.learningPlan.push({
    semesterPlanId: 'sp-non-existent',
    value: [],
  });
  assert.throws(() => validateStorageStateV5(badSem), /references non-existent semesterPlanId "sp-non-existent"/i);

  // Duplicate entry in semesterData.roster
  const dupRoster = createValidTestState();
  dupRoster.semesterData.roster.push(
    { semesterPlanId: 'sp-1', value: [] },
    { semesterPlanId: 'sp-1', value: [] }
  );
  assert.throws(() => validateStorageStateV5(dupRoster), /Duplicate entry for semesterPlanId "sp-1" in collection "semesterData.roster"/i);

  // semesterJPSettings inner semesterPlanId missing
  const missingJPId = createValidTestState();
  missingJPId.semesterJPSettings.push({
    semesterPlanId: 'sp-1',
    value: { actualScheduledWeeklyJP: 3 } as any,
  });
  assert.throws(() => validateStorageStateV5(missingJPId), /semesterJPSettings inner semesterPlanId/i);

  // semesterJPSettings inner semesterPlanId undefined
  const undefJPId = createValidTestState();
  undefJPId.semesterJPSettings.push({
    semesterPlanId: 'sp-1',
    value: { semesterPlanId: undefined, actualScheduledWeeklyJP: 3 } as any,
  });
  assert.throws(() => validateStorageStateV5(undefJPId), /semesterJPSettings inner semesterPlanId/i);

  // semesterJPSettings inner semesterPlanId empty string
  const emptyJPId = createValidTestState();
  emptyJPId.semesterJPSettings.push({
    semesterPlanId: 'sp-1',
    value: { semesterPlanId: '', actualScheduledWeeklyJP: 3, source: 'SCHOOL_SCHEDULE' },
  });
  assert.throws(() => validateStorageStateV5(emptyJPId), /semesterJPSettings inner semesterPlanId/i);

  // semesterJPSettings inner semesterPlanId mismatch
  const mismatchJP = createValidTestState();
  mismatchJP.semesterJPSettings.push({
    semesterPlanId: 'sp-1',
    value: {
      semesterPlanId: 'sp-mismatch',
      actualScheduledWeeklyJP: 3,
      source: 'SCHOOL_SCHEDULE',
    },
  });
  assert.throws(() => validateStorageStateV5(mismatchJP), /semesterJPSettings inner semesterPlanId "sp-mismatch" does not match outer semesterPlanId "sp-1"/i);

  // semesterJPSettings valid inner semesterPlanId === outer semesterPlanId passes
  const validJP = createValidTestState();
  validJP.semesterJPSettings.push({
    semesterPlanId: 'sp-1',
    value: {
      semesterPlanId: 'sp-1',
      actualScheduledWeeklyJP: 3,
      source: 'SCHOOL_SCHEDULE',
    },
  });
  const validatedJP = validateStorageStateV5(validJP);
  assert.strictEqual(validatedJP.semesterJPSettings.length, 1);
});

// =========================================================================
// TEST 8: Active Context Pointer Validation
// =========================================================================
runTest('8. Active Context Pointers: Validates existence and relationship cross-checks', () => {
  // 1. activeProfile only → PASS
  const stateProfileOnly = createValidTestState();
  stateProfileOnly.activeProfileId = 'prof-1';
  stateProfileOnly.activeYearPlanId = undefined;
  stateProfileOnly.activeWorkspaceId = undefined;
  stateProfileOnly.activeSemesterPlanId = undefined;
  assert.doesNotThrow(() => validateStorageStateV5(stateProfileOnly));

  // 2. activeWorkspace tanpa activeYear → THROW
  const stateWsNoYear = createValidTestState();
  stateWsNoYear.activeProfileId = 'prof-1';
  stateWsNoYear.activeWorkspaceId = 'ws-1';
  stateWsNoYear.activeYearPlanId = undefined;
  stateWsNoYear.activeSemesterPlanId = undefined;
  assert.throws(() => validateStorageStateV5(stateWsNoYear), /requires activeYearPlanId/i);

  // 3. activeSemester tanpa activeYear → THROW
  const stateSemNoYear = createValidTestState();
  stateSemNoYear.activeProfileId = 'prof-1';
  stateSemNoYear.activeSemesterPlanId = 'sp-1';
  stateSemNoYear.activeYearPlanId = undefined;
  stateSemNoYear.activeWorkspaceId = undefined;
  assert.throws(() => validateStorageStateV5(stateSemNoYear), /requires activeYearPlanId/i);

  // 4. activeYear tanpa activeProfile → THROW
  const stateYearNoProf = createValidTestState();
  stateYearNoProf.activeProfileId = undefined;
  stateYearNoProf.activeYearPlanId = 'yp-1';
  stateYearNoProf.activeWorkspaceId = 'ws-1';
  stateYearNoProf.activeSemesterPlanId = undefined;
  assert.throws(() => validateStorageStateV5(stateYearNoProf), /requires activeProfileId/i);

  // 5. activeYear tanpa activeWorkspace → THROW
  const stateYearNoWs = createValidTestState();
  stateYearNoWs.activeProfileId = 'prof-1';
  stateYearNoWs.activeYearPlanId = 'yp-1';
  stateYearNoWs.activeWorkspaceId = undefined;
  stateYearNoWs.activeSemesterPlanId = undefined;
  assert.throws(() => validateStorageStateV5(stateYearNoWs), /requires activeWorkspaceId/i);

  // 6. canonical profile + year + workspace → PASS
  const stateCanonicalYP = createValidTestState();
  stateCanonicalYP.activeProfileId = 'prof-1';
  stateCanonicalYP.activeYearPlanId = 'yp-1';
  stateCanonicalYP.activeWorkspaceId = 'ws-1';
  stateCanonicalYP.activeSemesterPlanId = undefined;
  assert.doesNotThrow(() => validateStorageStateV5(stateCanonicalYP));

  // 7. canonical profile + year + workspace + semester → PASS
  const stateCanonicalAll = createValidTestState();
  stateCanonicalAll.activeProfileId = 'prof-1';
  stateCanonicalAll.activeYearPlanId = 'yp-1';
  stateCanonicalAll.activeWorkspaceId = 'ws-1';
  stateCanonicalAll.activeSemesterPlanId = 'sp-1';
  assert.doesNotThrow(() => validateStorageStateV5(stateCanonicalAll));
});

// =========================================================================
// TEST 9: serializeBackupV5 Validation Gate
// =========================================================================
runTest('9. serializeBackupV5 Gate: Throws on invalid state before producing JSON', () => {
  const invalidState = createValidTestState();
  invalidState.semesterPlans = []; // break semester plan relation

  assert.throws(() => serializeBackupV5(invalidState), /must have exactly 1 SemesterPlan/i);
});

// =========================================================================
// TEST 10: YearPlan shape strictness checks
// =========================================================================
runTest('10. YearPlan shape strictness checks', () => {
  // curriculumType missing
  const state1 = createValidTestState();
  delete (state1.yearPlans[0] as any).curriculumType;
  assert.throws(() => validateStorageStateV5(state1), /yearPlan.curriculumType must be exactly/i);

  // curriculumType invalid
  const state2 = createValidTestState();
  (state2.yearPlans[0] as any).curriculumType = 'K2013';
  assert.throws(() => validateStorageStateV5(state2), /yearPlan.curriculumType must be exactly/i);

  // containing forbidden semester field
  const state3 = createValidTestState();
  (state3.yearPlans[0] as any).semester = 1;
  assert.throws(() => validateStorageStateV5(state3), /forbidden legacy field "semester"/i);

  // containing forbidden activeSemester field
  const state4 = createValidTestState();
  (state4.yearPlans[0] as any).activeSemester = 1;
  assert.throws(() => validateStorageStateV5(state4), /forbidden legacy field "activeSemester"/i);

  // containing forbidden academicSettingId field
  const state5 = createValidTestState();
  (state5.yearPlans[0] as any).academicSettingId = 'some-id';
  assert.throws(() => validateStorageStateV5(state5), /forbidden legacy field "academicSettingId"/i);
});

// =========================================================================
// TEST 11: Workspace shape strictness checks
// =========================================================================
runTest('11. Workspace shape strictness checks', () => {
  // Workspace with academicSettingId
  const state1 = createValidTestState();
  (state1.workspaces[0] as any).academicSettingId = 'some-id';
  assert.throws(() => validateStorageStateV5(state1), /forbidden legacy field "academicSettingId"/i);

  // Workspace with semester
  const state2 = createValidTestState();
  (state2.workspaces[0] as any).semester = 1;
  assert.throws(() => validateStorageStateV5(state2), /forbidden legacy field "semester"/i);

  // Workspace missing yearPlanId
  const state3 = createValidTestState();
  delete (state3.workspaces[0] as any).yearPlanId;
  assert.throws(() => validateStorageStateV5(state3), /Field "workspace.yearPlanId" must be a non-empty string/i);
});

// =========================================================================
// TEST 12: SemesterPlan shape and duplication strictness checks
// =========================================================================
runTest('12. SemesterPlan shape and duplication strictness checks', () => {
  // semester "1" string
  const state1 = createValidTestState();
  (state1.semesterPlans[0] as any).semester = "1";
  assert.throws(() => validateStorageStateV5(state1), /semesterPlan.semester must be exactly number 1 or 2/i);

  // semester "2" string
  const state2 = createValidTestState();
  (state2.semesterPlans[1] as any).semester = "2";
  assert.throws(() => validateStorageStateV5(state2), /semesterPlan.semester must be exactly number 1 or 2/i);

  // semester 3
  const state3 = createValidTestState();
  (state3.semesterPlans[0] as any).semester = 3;
  assert.throws(() => validateStorageStateV5(state3), /semesterPlan.semester must be exactly number 1 or 2/i);

  // containing duplicated academicYear
  const state4 = createValidTestState();
  (state4.semesterPlans[0] as any).academicYear = '2026/2027';
  assert.throws(() => validateStorageStateV5(state4), /duplicated parent authority field "academicYear"/i);

  // containing duplicated profileId
  const state5 = createValidTestState();
  (state5.semesterPlans[0] as any).profileId = 'prof-1';
  assert.throws(() => validateStorageStateV5(state5), /duplicated parent authority field "profileId"/i);
});

// =========================================================================
// TEST 13: Active pointer strict types and non-empty checks
// =========================================================================
runTest('13. Active pointer strict types and non-empty checks', () => {
  // activeYearPlanId as non-string
  const state1 = createValidTestState();
  (state1 as any).activeYearPlanId = 123;
  assert.throws(() => validateStorageStateV5(state1), /must be a non-empty string/i);

  // activeWorkspaceId as empty string
  const state2 = createValidTestState();
  (state2 as any).activeWorkspaceId = "   ";
  assert.throws(() => validateStorageStateV5(state2), /must be a non-empty string/i);

  // activeSemesterPlanId as empty string
  const state3 = createValidTestState();
  (state3 as any).activeSemesterPlanId = "";
  assert.throws(() => validateStorageStateV5(state3), /must be a non-empty string/i);
});

// =========================================================================
// TEST 14: Scoped wrapper value shape checks
// =========================================================================
runTest('14. Scoped wrapper value shape checks', () => {
  // YearScopedEntry without value
  const state1 = createValidTestState();
  state1.annualData.cp.push({ yearPlanId: 'yp-1', value: null as any });
  assert.throws(() => validateStorageStateV5(state1), /value must exist and be a non-null object/i);

  // SemesterScopedEntry without value
  const state2 = createValidTestState();
  state2.semesterData.academicCalendar.push({ semesterPlanId: 'sp-1', value: undefined as any });
  assert.throws(() => validateStorageStateV5(state2), /is missing a value/i);

  // assessmentPackage value non-array
  const state3 = createValidTestState();
  state3.semesterData.assessmentPackage.push({ semesterPlanId: 'sp-1', value: { notAnArray: true } as any });
  assert.throws(() => validateStorageStateV5(state3), /value must be an array/i);
});

// =========================================================================
// TEST 15: Complex valid AssessmentPackage survives save/load and serialize/parse roundtrip
// =========================================================================
runTest('15. Complex valid AssessmentPackage survives save/load and serialize/parse roundtrip', () => {
  const state = createValidTestState();
  const pkgValue = [
    {
      id: 'pkg-1',
      name: 'Package 1',
      blueprint: { title: 'BP 1' },
      instrument: { questions: [] },
      scoringGuide: { rubrics: [] }
    }
  ];
  state.semesterData.assessmentPackage.push({
    semesterPlanId: 'sp-1',
    value: pkgValue as any
  });

  const validated = validateStorageStateV5(state);
  assert.deepStrictEqual(validated.semesterData.assessmentPackage[0].value, pkgValue);

  const serialized = serializeBackupV5(state);
  const parsed = parseBackupV5(serialized);
  assert.deepStrictEqual(parsed.semesterData.assessmentPackage[0].value, pkgValue);
});

// =========================================================================
// TEST 16: Mismatched legacy inner academicSettingId remains preserved and does NOT become SSOT
// =========================================================================
runTest('16. Mismatched legacy inner academicSettingId remains preserved without becoming SSOT', () => {
  const state = createValidTestState();
  const innerValue = {
    academicSettingId: 'mismatched-inner-id', // different from outer semesterPlanId 'sp-1'
    someOtherData: 'hello'
  };
  state.semesterData.academicCalendar.push({
    semesterPlanId: 'sp-1',
    value: innerValue as any
  });

  const validated = validateStorageStateV5(state);
  assert.deepStrictEqual(validated.semesterData.academicCalendar[0].value, innerValue);
});

// =========================================================================
// TEST 17: parseBackupV5 validates exportedAt string and parseability
// =========================================================================
runTest('17. parseBackupV5 validates exportedAt string and parseability', () => {
  const validState = createValidTestState();
  const validBackup = {
    app: 'Administrasi Guru AI',
    schemaVersion: 5,
    exportedAt: '2026-09-26T00:00:00.000Z',
    data: validState
  };

  assert.doesNotThrow(() => parseBackupV5(JSON.stringify(validBackup)));

  const invalidBackup1 = {
    ...validBackup,
    exportedAt: ''
  };
  assert.throws(() => parseBackupV5(JSON.stringify(invalidBackup1)), /must be a valid non-empty ISO date string/i);

  const invalidBackup2 = {
    ...validBackup,
    exportedAt: 'not-a-date'
  };
  assert.throws(() => parseBackupV5(JSON.stringify(invalidBackup2)), /must be a parseable valid date string/i);
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 RELATIONAL INTEGRITY TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
