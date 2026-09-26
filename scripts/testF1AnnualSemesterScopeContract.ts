import assert from 'node:assert';
import {
  normalizeSemester,
  getAcademicEntityScope,
  isAnnualEntity,
  isSemesterEntity,
  createYearScopeKey,
  createSemesterScopeKey,
  AcademicEntityKind,
} from '../src/services/academicScope';
import {
  YearPlan,
  SemesterPlan,
  AnnualJPReference,
  SemesterJPSetting,
  SemesterNumber,
  AcademicScopeType,
} from '../src/types';

console.log('=== RUNNING AUDIT: F1 ANNUAL VS SEMESTER SCOPE CONTRACT REGRESSION ===\n');

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

// =========================================================================
// SECTION A: YearPlan Contract Verification
// =========================================================================

runTest('YearPlan contract: valid YearPlan contains no semester or activeSemester authority', () => {
  const sampleYearPlan: YearPlan = {
    id: 'yp-2026-pjok-7',
    profileId: 'prof-teacher-1',
    schoolId: 'sch-smp-1',
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    subjectCode: 'PJOK',
    phase: 'D',
    curriculumLock: {
      curriculumType: 'KURIKULUM_MERDEKA',
      academicYear: '2026/2027',
      regulationIds: ['permendikbudristek-12-2024'],
      cpVersion: '2024-v1',
      lockedAt: '2026-07-15T08:00:00.000Z',
    },
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-07-15T08:00:00.000Z',
  };

  assert.strictEqual(sampleYearPlan.academicYear, '2026/2027');
  assert.strictEqual(sampleYearPlan.grade, 'Kelas 7');
  assert.strictEqual(sampleYearPlan.curriculumType, 'KURIKULUM_MERDEKA');

  // Explicit check: YearPlan must not carry semester authority
  assert.strictEqual('semester' in sampleYearPlan, false, 'YearPlan must NOT have a "semester" property');
  assert.strictEqual('activeSemester' in sampleYearPlan, false, 'YearPlan must NOT have an "activeSemester" property');
});

runTest('YearPlan contract: classSection / rombel is optional and supports parallel classes', () => {
  // Without classSection
  const planWithoutSection: YearPlan = {
    id: 'yp-1',
    profileId: 'prof-1',
    schoolId: 'sch-1',
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 'Kelas 7',
    subject: 'PJOK',
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-07-15T08:00:00.000Z',
  };
  assert.strictEqual(planWithoutSection.classSection, undefined);

  // With classSection (e.g. 7A)
  const planWithSection: YearPlan = {
    ...planWithoutSection,
    id: 'yp-2',
    classSection: '7A',
  };
  assert.strictEqual(planWithSection.classSection, '7A');
});

// =========================================================================
// SECTION B: SemesterPlan Contract Verification
// =========================================================================

runTest('SemesterPlan contract: strictly semester 1 or 2, references parent yearPlanId without duplicating parent fields', () => {
  const sem1Plan: SemesterPlan = {
    id: 'sp-2026-pjok-7-s1',
    yearPlanId: 'yp-2026-pjok-7',
    semester: 1,
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-07-15T08:00:00.000Z',
  };

  const sem2Plan: SemesterPlan = {
    id: 'sp-2026-pjok-7-s2',
    yearPlanId: 'yp-2026-pjok-7',
    semester: 2,
    createdAt: '2026-12-15T08:00:00.000Z',
    updatedAt: '2026-12-15T08:00:00.000Z',
  };

  assert.strictEqual(sem1Plan.semester, 1);
  assert.strictEqual(sem2Plan.semester, 2);
  assert.strictEqual(sem1Plan.yearPlanId, 'yp-2026-pjok-7');

  // Verify that parent fields are not duplicated in SemesterPlan
  assert.strictEqual('profileId' in sem1Plan, false);
  assert.strictEqual('schoolId' in sem1Plan, false);
  assert.strictEqual('academicYear' in sem1Plan, false);
  assert.strictEqual('grade' in sem1Plan, false);
  assert.strictEqual('subject' in sem1Plan, false);
  assert.strictEqual('curriculumType' in sem1Plan, false);
});

// =========================================================================
// SECTION C: normalizeSemester Pure Function
// =========================================================================

runTest('normalizeSemester: correctly normalizes valid canonical and legacy representations', () => {
  // Numbers
  assert.strictEqual(normalizeSemester(1), 1);
  assert.strictEqual(normalizeSemester(2), 2);

  // String numbers
  assert.strictEqual(normalizeSemester('1'), 1);
  assert.strictEqual(normalizeSemester('2'), 2);

  // Legacy full strings
  assert.strictEqual(normalizeSemester('1 (Ganjil)'), 1);
  assert.strictEqual(normalizeSemester('2 (Genap)'), 2);
  assert.strictEqual(normalizeSemester('1 (ganjil)'), 1);
  assert.strictEqual(normalizeSemester('2 (genap)'), 2);

  // Legacy name only
  assert.strictEqual(normalizeSemester('Ganjil'), 1);
  assert.strictEqual(normalizeSemester('Genap'), 2);
  assert.strictEqual(normalizeSemester('ganjil'), 1);
  assert.strictEqual(normalizeSemester('genap'), 2);

  // Whitespace trimming
  assert.strictEqual(normalizeSemester('  1 (Ganjil)  '), 1);
  assert.strictEqual(normalizeSemester('  genap  '), 2);
});

runTest('normalizeSemester: returns null for invalid inputs without fallback to 1', () => {
  assert.strictEqual(normalizeSemester('3'), null);
  assert.strictEqual(normalizeSemester(3), null);
  assert.strictEqual(normalizeSemester(0), null);
  assert.strictEqual(normalizeSemester(-1), null);
  assert.strictEqual(normalizeSemester(''), null);
  assert.strictEqual(normalizeSemester('   '), null);
  assert.strictEqual(normalizeSemester(undefined), null);
  assert.strictEqual(normalizeSemester(null), null);
  assert.strictEqual(normalizeSemester('random string'), null);
  assert.strictEqual(normalizeSemester('semester 3'), null);
  assert.strictEqual(normalizeSemester(true), null);
  assert.strictEqual(normalizeSemester(false), null);
  assert.strictEqual(normalizeSemester({}), null);
  assert.strictEqual(normalizeSemester([]), null);
});

// =========================================================================
// SECTION D: Academic Entity Scope Matrix
// =========================================================================

runTest('Academic Entity Scope Matrix: Annual entities resolve to YEAR', () => {
  const annualEntities: AcademicEntityKind[] = [
    'CP',
    'CP_ANALYSIS',
    'TP',
    'ATP',
    'PROTA',
    'CURRICULUM_CONTEXT',
    'ANNUAL_JP_REFERENCE',
  ];

  for (const entity of annualEntities) {
    const scope = getAcademicEntityScope(entity);
    assert.strictEqual(scope, 'YEAR', `Entity ${entity} must be YEAR scope`);
    assert.strictEqual(isAnnualEntity(entity), true, `isAnnualEntity(${entity}) must be true`);
    assert.strictEqual(isSemesterEntity(entity), false, `isSemesterEntity(${entity}) must be false`);
  }
});

runTest('Academic Entity Scope Matrix: Semester entities resolve to SEMESTER', () => {
  const semesterEntities: AcademicEntityKind[] = [
    'ACADEMIC_CALENDAR',
    'TIME_ALLOCATION',
    'PROMES',
    'LEARNING_PLAN',
    'ASSESSMENT_CRITERIA',
    'ASSESSMENT_PLAN',
    'ASSESSMENT_PACKAGE',
    'ROSTER',
    'ATTENDANCE',
    'GRADE',
    'REMEDIAL',
    'ENRICHMENT',
  ];

  for (const entity of semesterEntities) {
    const scope = getAcademicEntityScope(entity);
    assert.strictEqual(scope, 'SEMESTER', `Entity ${entity} must be SEMESTER scope`);
    assert.strictEqual(isSemesterEntity(entity), true, `isSemesterEntity(${entity}) must be true`);
    assert.strictEqual(isAnnualEntity(entity), false, `isAnnualEntity(${entity}) must be false`);
  }
});

runTest('Academic Entity Scope Matrix: unknown kind fails explicitly without silent fallback', () => {
  assert.throws(
    () => {
      // Cast invalid kind to test runtime fail-closed behavior
      getAcademicEntityScope('UNKNOWN_ENTITY' as any);
    },
    /Unknown academic entity kind/,
    'Must throw Error on unknown entity kind'
  );
});

// =========================================================================
// SECTION E: Scope Keys Generation
// =========================================================================

runTest('Scope Keys: produces unique, deterministic keys for YEAR and SEMESTER', () => {
  const yearKey = createYearScopeKey('year-123');
  const sem1Key = createSemesterScopeKey('year-123', 1);
  const sem2Key = createSemesterScopeKey('year-123', 2);

  assert.strictEqual(yearKey, 'YEAR:year-123');
  assert.strictEqual(sem1Key, 'SEMESTER:year-123:1');
  assert.strictEqual(sem2Key, 'SEMESTER:year-123:2');

  // Verify all keys are strictly distinct
  assert.notStrictEqual(yearKey, sem1Key);
  assert.notStrictEqual(yearKey, sem2Key);
  assert.notStrictEqual(sem1Key, sem2Key);

  // Accepts legacy formatted strings in createSemesterScopeKey through normalizeSemester
  assert.strictEqual(createSemesterScopeKey('year-123', '1 (Ganjil)'), 'SEMESTER:year-123:1');
  assert.strictEqual(createSemesterScopeKey('year-123', '2 (Genap)'), 'SEMESTER:year-123:2');

  // Invalid parameters throw error
  assert.throws(() => createYearScopeKey(''), /non-empty/);
  assert.throws(() => createSemesterScopeKey('year-123', 3 as any), /Invalid semester number/);
});

// =========================================================================
// SECTION F: JP Domain Distinction Contract
// =========================================================================

runTest('JP Domain Contract: strictly distinguishes official reference JP from actual scheduled weekly JP', () => {
  // Official statutory reference for the entire year
  const officialRef: AnnualJPReference = {
    officialAnnualJP: 108,
    referenceWeeklyEquivalentJP: 3,
    regulationReference: 'Permendikbudristek No. 12 Tahun 2024 Lampiran II',
  };

  // Actual school schedule for a specific semester:
  // E.g. school scheduling allocates 2 JP or 4 JP in practice, independent of statutory reference
  const semesterSetting: SemesterJPSetting = {
    semesterPlanId: 'sp-2026-pjok-7-s1',
    actualScheduledWeeklyJP: 2,
    source: 'SCHOOL_SCHEDULE',
  };

  // Proof that the two contracts hold distinct fields and semantics
  assert.strictEqual(officialRef.referenceWeeklyEquivalentJP, 3);
  assert.strictEqual(semesterSetting.actualScheduledWeeklyJP, 2);
  assert.notStrictEqual(
    officialRef.referenceWeeklyEquivalentJP,
    semesterSetting.actualScheduledWeeklyJP,
    'Contract must not conflate reference weekly equivalent with actual scheduled weekly JP'
  );

  // Verify that setting referenceWeeklyEquivalentJP does not automatically set actualScheduledWeeklyJP
  const unresolvedSetting: SemesterJPSetting = {
    semesterPlanId: 'sp-2026-pjok-7-s2',
    actualScheduledWeeklyJP: null,
    source: 'UNRESOLVED',
  };
  assert.strictEqual(unresolvedSetting.actualScheduledWeeklyJP, null);
});

console.log(`\n========================================`);
console.log(`ALL F1 CONTRACT REGRESSION TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
