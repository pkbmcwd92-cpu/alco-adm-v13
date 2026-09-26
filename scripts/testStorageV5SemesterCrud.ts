import assert from 'node:assert';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  createYearHierarchyV5,
  getSemesterDataV5,
  saveSemesterJPSettingV5,
  saveAcademicCalendarV5,
  saveTimeAllocationV5,
  saveLearningPlansV5,
  saveAssessmentCriteriaV5,
  saveAssessmentPlansV5,
  saveAssessmentPackagesV5,
  saveRosterV5,
  saveAttendanceV5,
  saveGradeV5,
  saveRemedialV5,
  saveEnrichmentV5,
  deleteSemesterJPSettingV5,
  deleteAcademicCalendarV5,
  deleteTimeAllocationV5,
  deleteLearningPlansV5,
  deleteAssessmentCriteriaV5,
  deleteAssessmentPlansV5,
  deleteAssessmentPackagesV5,
  deleteRosterV5,
  deleteAttendanceV5,
  deleteGradeV5,
  deleteRemedialV5,
  deleteEnrichmentV5,
  saveCPV5,
  getAnnualDataV5,
} from '../src/services/storageV5';
import {
  TeacherProfile,
  SchoolData,
  SemesterJPSetting,
  SemesterCalendarEntry,
  TimeAllocation,
  LearningPlan,
  AssessmentCriterion,
  AssessmentPlan,
  AssessmentPackage,
  Student,
  SemesterAttendanceEntry,
  SemesterGradeEntry,
  RemedialRecord,
  EnrichmentRecord,
  CPData,
} from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 SEMESTER SCOPED CRUD ===\n');

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
    id: 'prof-sem-1',
    name: 'Siti Aminah, S.Pd.',
    nip: '198203152006042001',
    status: 'PNS',
    defaultSubject: 'Biologi',
    defaultLevel: 'SMA',
    schoolId: 'sch-sem-1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };

  const school: SchoolData = {
    id: 'sch-sem-1',
    name: 'SMA Negeri 2 Bandung',
    npsn: '20210002',
    address: 'Jl. Cihampelas No. 12',
    village: 'Tamansari',
    district: 'Bandung Wetan',
    regency: 'Kota Bandung',
    province: 'Jawa Barat',
    principalName: 'Drs. H. Ahmad',
    principalNip: '196501011990011002',
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
function createSampleCalendar(): SemesterCalendarEntry {
  return {
    calendar: {
      id: 'cal-1',
      academicSettingId: 'set-sem-cal',
      academicYear: '2026/2027',
      semester: '1',
      startDate: '2026-07-15',
      endDate: '2026-12-20',
      schoolDaysPerWeek: 5,
      sourceName: 'Disdik Jabar',
      sourceAuthority: 'Dinas Pendidikan Provinsi Jawa Barat',
      sourceDocumentNumber: '422/123-Disdik',
      resolutionStatus: 'RESOLVED',
      isOverridden: false,
      reviewStatus: 'CONFIRMED',
      updatedAt: '2026-07-15T00:00:00Z',
    },
    days: [
      {
        id: 'day-1',
        academicCalendarId: 'cal-1',
        date: '2026-08-17',
        status: 'HOLIDAY',
        category: 'NATIONAL_HOLIDAY',
        notes: 'HUT Kemerdekaan RI',
      },
    ],
  };
}

function createSampleTimeAllocations(): TimeAllocation[] {
  return [
    {
      id: 'ta-1',
      academicSettingId: 'set-sem-ta',
      tpId: 'tp-1',
      semester: 1,
      jp: 12,
      allocatedJP: 12,
      notes: 'Keanekaragaman Hayati',
    },
  ];
}

function createSampleLearningPlans(): LearningPlan[] {
  return [
    {
      id: 'lp-1',
      academicSettingId: 'set-sem-lp',
      sourceType: 'MANUAL',
      status: 'SIAP',
      tpIds: ['tp-1'],
      atpItemIds: [],
      objectives: [
        {
          id: 'obj-1',
          statement: 'Memahami keanekaragaman hayati',
        },
      ],
      learningSteps: {
        opening: [{ id: 'step-1', description: 'Pendahuluan 15 menit' }],
        core: [{ id: 'step-2', description: 'Eksplorasi materi 60 menit' }],
        closing: [{ id: 'step-3', description: 'Penutup dan kuis 15 menit' }],
      },
      assessmentPlan: {},
      createdAt: '2026-07-20T00:00:00Z',
      updatedAt: '2026-07-20T00:00:00Z',
    },
  ];
}

function createSampleCriteria(): AssessmentCriterion[] {
  return [
    {
      id: 'crit-1',
      academicSettingId: 'set-sem-crit',
      tpId: 'tp-1',
      description: 'Pemahaman Konsep Ekosistem',
      approach: 'rubrik',
      criterionMode: 'RUBRIC',
      indicators: ['Menjelaskan komponen ekosistem'],
      levels: [
        { level: 'Perlu Bimbingan', label: 'PB', description: 'Belum memahami' },
        { level: 'Cukup', label: 'C', description: 'Cukup memahami' },
        { level: 'Baik', label: 'B', description: 'Memahami dengan baik' },
        { level: 'Sangat Baik', label: 'SB', description: 'Sangat menguasai' },
      ],
      updatedAt: '2026-07-20T00:00:00Z',
    },
  ];
}

function createSampleAssessmentPlans(): AssessmentPlan[] {
  return [
    {
      id: 'plan-1',
      academicSettingId: 'set-sem-plan',
      title: 'Rencana Asesmen Biologi Semester 1',
      purpose: 'SUMMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [],
      workflowStatus: 'SIAP',
      createdAt: '2026-07-20T00:00:00Z',
      updatedAt: '2026-07-20T00:00:00Z',
    },
  ];
}

function createSampleAssessmentPackage(): AssessmentPackage {
  return {
    id: 'pkg-bio-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'set-sem-pkg',
    title: 'Paket Asesmen Keanekaragaman Hayati',
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-1',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-w-1'],
        order: 1,
        cognitiveDemand: 'APPLY',
        evidenceType: 'KNOWLEDGE_RESPONSE',
        stimulusType: 'SCENARIO',
        difficultyTarget: 'MODERATE',
      },
    ],
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        title: 'Tes Tertulis Keanekaragaman Hayati',
        items: [
          {
            id: 'item-w-1',
            blueprintItemId: 'bp-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Manakah yang termasuk flora endemik Indonesia Timur?',
            options: [
              { id: 'opt-a', label: 'A', text: 'Matoa' },
              { id: 'opt-b', label: 'B', text: 'Rafflesia Arnoldii' },
            ],
            order: 1,
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'key-1',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-w-1',
        answerType: 'OPTION',
        value: 'opt-a',
      },
    ],
    scoringGuides: [
      {
        id: 'guide-1',
        title: 'Panduan Pilihan Ganda',
        guideType: 'OBJECTIVE',
        maxScore: 100,
      },
    ],
    rubrics: [],
    workflowStatus: 'SIAP',
    createdAt: '2026-07-25T00:00:00Z',
    updatedAt: '2026-07-25T00:00:00Z',
  };
}

function createSampleRoster(): Student[] {
  return [
    {
      id: 'std-1',
      academicSettingId: 'set-sem-std',
      nisn: '0051234567',
      name: 'Aditya Pratama',
      gender: 'L',
    },
    {
      id: 'std-2',
      academicSettingId: 'set-sem-std',
      nisn: '0051234568',
      name: 'Bella Saphira',
      gender: 'P',
    },
  ];
}

function createSampleAttendance(): SemesterAttendanceEntry {
  return {
    sessions: [
      {
        id: 'sess-1',
        academicSettingId: 'set-sem-att',
        date: '2026-07-21',
        meetingNumber: 1,
        topic: 'Pengenalan Keanekaragaman Hayati',
        createdAt: '2026-07-21T00:00:00Z',
      },
    ],
    records: [
      {
        id: 'rec-1',
        sessionId: 'sess-1',
        studentId: 'std-1',
        status: 'H',
      },
      {
        id: 'rec-2',
        sessionId: 'sess-1',
        studentId: 'std-2',
        status: 'H',
      },
    ],
  };
}

function createSampleGrade(): SemesterGradeEntry {
  return {
    assessments: [
      {
        id: 'ass-1',
        academicSettingId: 'set-sem-grd',
        tpId: 'tp-1',
        title: 'Sumatif 1 Biologi',
        type: 'sumatif_lingkup_materi',
        maxScore: 100,
        date: '2026-09-10',
        createdAt: '2026-09-10T00:00:00Z',
      },
    ],
    results: [
      {
        id: 'res-1',
        assessmentId: 'ass-1',
        studentId: 'std-1',
        score: 85,
        status: 'tercapai',
      },
      {
        id: 'res-2',
        assessmentId: 'ass-1',
        studentId: 'std-2',
        score: 92,
        status: 'sangat_baik',
      },
    ],
  };
}

function createSampleRemedial(): RemedialRecord[] {
  return [
    {
      id: 'rem-1',
      academicSettingId: 'set-sem-rem',
      studentId: 'std-1',
      tpId: 'tp-1',
      reason: 'Analisis kesulitan belajar',
      intervention: 'Bimbingan perorangan',
      date: '2026-09-15',
      status: 'completed',
      updatedAt: '2026-09-15T00:00:00Z',
    },
  ];
}

function createSampleEnrichment(): EnrichmentRecord[] {
  return [
    {
      id: 'enr-1',
      academicSettingId: 'set-sem-enr',
      studentId: 'std-2',
      tpId: 'tp-1',
      activity: 'Proyek mini riset flora lokal',
      date: '2026-09-16',
      status: 'completed',
      updatedAt: '2026-09-16T00:00:00Z',
    },
  ];
}

// =========================================================================
// TEST 1: Fresh SemesterPlan returns undefined for unpopulated values
// =========================================================================
runTest('1. Fresh SemesterPlan: Returns SemesterPlan, parent YearPlan, and undefined for unpopulated collections', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const sem1 = h.semesterPlans[0];
  const res = getSemesterDataV5(sem1.id);

  assert.deepStrictEqual(res.semesterPlan, sem1);
  assert.deepStrictEqual(res.yearPlan, h.yearPlan);
  assert.strictEqual(res.semesterJPSetting, undefined);
  assert.strictEqual(res.academicCalendar, undefined);
  assert.strictEqual(res.timeAllocation, undefined);
  assert.strictEqual(res.learningPlan, undefined);
  assert.strictEqual(res.assessmentCriteria, undefined);
  assert.strictEqual(res.assessmentPlan, undefined);
  assert.strictEqual(res.assessmentPackage, undefined);
  assert.strictEqual(res.roster, undefined);
  assert.strictEqual(res.attendance, undefined);
  assert.strictEqual(res.grade, undefined);
  assert.strictEqual(res.remedial, undefined);
  assert.strictEqual(res.enrichment, undefined);
});

// =========================================================================
// TEST 2: Save all semester collections lossless
// =========================================================================
runTest('2. Save all semester collections: Persists all 12 semester collections losslessly', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const spId = h.semesterPlans[0].id;

  const jpSetting: SemesterJPSetting = {
    semesterPlanId: spId,
    actualScheduledWeeklyJP: 4,
    source: 'SCHOOL_SCHEDULE',
  };
  const calendar = createSampleCalendar();
  const allocs = createSampleTimeAllocations();
  const lps = createSampleLearningPlans();
  const crits = createSampleCriteria();
  const plans = createSampleAssessmentPlans();
  const pkgs = [createSampleAssessmentPackage()];
  const roster = createSampleRoster();
  const attendance = createSampleAttendance();
  const grade = createSampleGrade();
  const remedial = createSampleRemedial();
  const enrichment = createSampleEnrichment();

  saveSemesterJPSettingV5(spId, jpSetting);
  saveAcademicCalendarV5(spId, calendar);
  saveTimeAllocationV5(spId, allocs);
  saveLearningPlansV5(spId, lps);
  saveAssessmentCriteriaV5(spId, crits);
  saveAssessmentPlansV5(spId, plans);
  saveAssessmentPackagesV5(spId, pkgs);
  saveRosterV5(spId, roster);
  saveAttendanceV5(spId, attendance);
  saveGradeV5(spId, grade);
  saveRemedialV5(spId, remedial);
  saveEnrichmentV5(spId, enrichment);

  const reloaded = getSemesterDataV5(spId);
  assert.deepStrictEqual(reloaded.semesterJPSetting, jpSetting);
  assert.deepStrictEqual(reloaded.academicCalendar, calendar);
  assert.deepStrictEqual(reloaded.timeAllocation, allocs);
  assert.deepStrictEqual(reloaded.learningPlan, lps);
  assert.deepStrictEqual(reloaded.assessmentCriteria, crits);
  assert.deepStrictEqual(reloaded.assessmentPlan, plans);
  assert.deepStrictEqual(reloaded.assessmentPackage, pkgs);
  assert.deepStrictEqual(reloaded.roster, roster);
  assert.deepStrictEqual(reloaded.attendance, attendance);
  assert.deepStrictEqual(reloaded.grade, grade);
  assert.deepStrictEqual(reloaded.remedial, remedial);
  assert.deepStrictEqual(reloaded.enrichment, enrichment);
});

// =========================================================================
// TEST 3: Upsert without duplicate wrappers
// =========================================================================
runTest('3. Upsert without duplicates: Saving roster twice replaces value without adding extra wrappers', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const spId = h.semesterPlans[0].id;
  const initialRoster = createSampleRoster();

  saveRosterV5(spId, initialRoster);
  let state = loadStorageV5();
  assert.strictEqual(state.semesterData.roster.length, 1);

  const updatedRoster: Student[] = [
    ...initialRoster,
    {
      id: 'std-3',
      academicSettingId: 'set-sem-std',
      nisn: '0051234569',
      name: 'Charlie Daniel',
      gender: 'L',
    },
  ];

  saveRosterV5(spId, updatedRoster);
  state = loadStorageV5();
  assert.strictEqual(state.semesterData.roster.length, 1, 'Wrapper count must remain 1');
  assert.strictEqual(state.semesterData.roster[0].value.length, 3, 'Value updated to 3 students');
  assert.deepStrictEqual(getSemesterDataV5(spId).roster, updatedRoster);
});

// =========================================================================
// TEST 4: Semester 1 vs Semester 2 isolation
// =========================================================================
runTest('4. Semester 1 vs Semester 2 isolation: Updating Semester 1 does not mutate Semester 2', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const sem1Id = h.semesterPlans[0].id;
  const sem2Id = h.semesterPlans[1].id;

  const roster1 = createSampleRoster();
  const roster2: Student[] = [
    { id: 'std-201', academicSettingId: 'set-sem-std', nisn: '0060000001', name: 'Zahra Annisa', gender: 'P' },
  ];

  saveRosterV5(sem1Id, roster1);
  saveRosterV5(sem2Id, roster2);

  // Update Semester 1
  const updatedRoster1: Student[] = [
    ...roster1,
    { id: 'std-104', academicSettingId: 'set-sem-std', nisn: '0051234570', name: 'Dian Sastro', gender: 'P' },
  ];
  saveRosterV5(sem1Id, updatedRoster1);

  // Assert Semester 2 remains byte-for-byte untouched
  const res2 = getSemesterDataV5(sem2Id);
  assert.deepStrictEqual(res2.roster, roster2, 'Semester 2 roster must remain byte-for-byte intact');
});

// =========================================================================
// TEST 5: Two YearPlan isolation
// =========================================================================
runTest('5. Two YearPlan isolation: Updating SemesterPlan in YearPlan A does not mutate YearPlan B', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const hA = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const hB = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 11',
    subject: 'Biologi',
  });

  const spA = hA.semesterPlans[0].id;
  const spB = hB.semesterPlans[0].id;

  const rosterA = createSampleRoster();
  const rosterB: Student[] = [
    { id: 'std-b1', academicSettingId: 'set-sem-std', nisn: '0070000001', name: 'Bambang Tri', gender: 'L' },
  ];

  saveRosterV5(spA, rosterA);
  saveRosterV5(spB, rosterB);

  // Update YearPlan A's semester
  saveRosterV5(spA, []);

  // Assert YearPlan B's semester remains untouched
  assert.deepStrictEqual(getSemesterDataV5(spB).roster, rosterB);
});

// =========================================================================
// TEST 6: Legacy inner academicSettingId mismatch stored lossless
// =========================================================================
runTest('6. Legacy inner academicSettingId mismatch: Preserved losslessly based on outer semesterPlanId', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const spId = h.semesterPlans[0].id;
  const legacyCalendar = createSampleCalendar();
  legacyCalendar.calendar.academicSettingId = 'bogus-legacy-setting-id';

  saveAcademicCalendarV5(spId, legacyCalendar);

  const res = getSemesterDataV5(spId);
  assert.deepStrictEqual(res.academicCalendar, legacyCalendar);
  assert.strictEqual(res.academicCalendar?.calendar.academicSettingId, 'bogus-legacy-setting-id');
});

// =========================================================================
// TEST 7: Invalid SemesterPlan throws
// =========================================================================
runTest('7. Invalid SemesterPlan: Operations throw on non-existent semesterPlanId', () => {
  mockStorage.clear();
  seedProfileAndSchool();

  const bogusId = 'sp-ghost-123';

  assert.throws(() => getSemesterDataV5(bogusId), /SemesterPlan with ID "sp-ghost-123" not found/i);
  assert.throws(
    () => saveSemesterJPSettingV5(bogusId, { semesterPlanId: bogusId, actualScheduledWeeklyJP: 4, source: 'SCHOOL_SCHEDULE' }),
    /SemesterPlan with ID "sp-ghost-123" not found/i
  );
  assert.throws(() => saveAcademicCalendarV5(bogusId, createSampleCalendar()), /SemesterPlan with ID "sp-ghost-123" not found/i);
  assert.throws(() => saveRosterV5(bogusId, createSampleRoster()), /SemesterPlan with ID "sp-ghost-123" not found/i);
  assert.throws(() => deleteRosterV5(bogusId), /SemesterPlan with ID "sp-ghost-123" not found/i);
});

// =========================================================================
// TEST 8: Orphan SemesterPlan without parent YearPlan throws
// =========================================================================
runTest('8. Orphan SemesterPlan: Throws when parent YearPlan is missing from state', () => {
  mockStorage.clear();
  seedProfileAndSchool();

  const state = createInitialStorageV5();
  state.semesterPlans.push({
    id: 'sp-orphan-1',
    yearPlanId: 'yp-missing-parent',
    semester: 1,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });
  assert.throws(
    () => saveStorageV5(state),
    /Parent YearPlan "yp-missing-parent" not found for SemesterPlan "sp-orphan-1"/i
  );
});

// =========================================================================
// TEST 9: SemesterJPSetting outer/inner ID mismatch throws
// =========================================================================
runTest('9. SemesterJPSetting ID mismatch: Throws if inner semesterPlanId does not match outer parameter', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const spId = h.semesterPlans[0].id;
  const mismatchedSetting: SemesterJPSetting = {
    semesterPlanId: 'sp-different-id',
    actualScheduledWeeklyJP: 4,
    source: 'SCHOOL_SCHEDULE',
  };

  assert.throws(
    () => saveSemesterJPSettingV5(spId, mismatchedSetting),
    /SemesterJPSetting inner semesterPlanId "sp-different-id" does not match outer semesterPlanId/i
  );
});

// =========================================================================
// TEST 10: AssessmentPackage sentinel survives deepStrictEqual
// =========================================================================
runTest('10. AssessmentPackage sentinel: Complex AssessmentPackage survives save -> get intact and deepStrictEqual', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const spId = h.semesterPlans[0].id;
  const pkg = createSampleAssessmentPackage();

  saveAssessmentPackagesV5(spId, [pkg]);

  const fetched = getSemesterDataV5(spId);
  assert(fetched.assessmentPackage !== undefined);
  assert.strictEqual(fetched.assessmentPackage.length, 1);
  assert.deepStrictEqual(fetched.assessmentPackage[0], pkg);
  assert.strictEqual(fetched.assessmentPackage[0].blueprintItems[0].cognitiveDemand, 'APPLY');
  assert.strictEqual(fetched.assessmentPackage[0].answerKeys[0].value, 'opt-a');
});

// =========================================================================
// TEST 11: Delete all semester collections leaves hierarchy intact
// =========================================================================
runTest('11. Delete all: Cleans semester wrappers while leaving YearPlan, Workspace, and SemesterPlan intact', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const spId = h.semesterPlans[0].id;

  saveSemesterJPSettingV5(spId, { semesterPlanId: spId, actualScheduledWeeklyJP: 4, source: 'SCHOOL_SCHEDULE' });
  saveAcademicCalendarV5(spId, createSampleCalendar());
  saveTimeAllocationV5(spId, createSampleTimeAllocations());
  saveLearningPlansV5(spId, createSampleLearningPlans());
  saveAssessmentCriteriaV5(spId, createSampleCriteria());
  saveAssessmentPlansV5(spId, createSampleAssessmentPlans());
  saveAssessmentPackagesV5(spId, [createSampleAssessmentPackage()]);
  saveRosterV5(spId, createSampleRoster());
  saveAttendanceV5(spId, createSampleAttendance());
  saveGradeV5(spId, createSampleGrade());
  saveRemedialV5(spId, createSampleRemedial());
  saveEnrichmentV5(spId, createSampleEnrichment());

  // Execute all deletions
  deleteSemesterJPSettingV5(spId);
  deleteAcademicCalendarV5(spId);
  deleteTimeAllocationV5(spId);
  deleteLearningPlansV5(spId);
  deleteAssessmentCriteriaV5(spId);
  deleteAssessmentPlansV5(spId);
  deleteAssessmentPackagesV5(spId);
  deleteRosterV5(spId);
  deleteAttendanceV5(spId);
  deleteGradeV5(spId);
  deleteRemedialV5(spId);
  deleteEnrichmentV5(spId);

  // Repeated delete is no-op
  deleteRosterV5(spId);

  const state = loadStorageV5();
  assert.strictEqual(state.yearPlans.length, 1, 'YearPlan must remain intact');
  assert.strictEqual(state.workspaces.length, 1, 'Workspace must remain intact');
  assert.strictEqual(state.semesterPlans.length, 2, 'SemesterPlans must remain intact');

  const res = getSemesterDataV5(spId);
  assert.strictEqual(res.semesterJPSetting, undefined);
  assert.strictEqual(res.academicCalendar, undefined);
  assert.strictEqual(res.timeAllocation, undefined);
  assert.strictEqual(res.learningPlan, undefined);
  assert.strictEqual(res.assessmentCriteria, undefined);
  assert.strictEqual(res.assessmentPlan, undefined);
  assert.strictEqual(res.assessmentPackage, undefined);
  assert.strictEqual(res.roster, undefined);
  assert.strictEqual(res.attendance, undefined);
  assert.strictEqual(res.grade, undefined);
  assert.strictEqual(res.remedial, undefined);
  assert.strictEqual(res.enrichment, undefined);
});

// =========================================================================
// TEST 12: Annual state byte-for-byte unchanged by semester operations
// =========================================================================
runTest('12. Annual state isolation: Semester CRUD operations do not alter annualData or annualJPReferences', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const sampleCP: CPData = {
    id: 'cp-annual-1',
    academicSettingId: 'set-annual-1',
    generalDescription: 'CP Biologi Kelas 10',
    elements: [{ id: 'elem-1', name: 'Pemahaman Biologi', content: 'Materi Biologi dasar' }],
    updatedAt: '2026-07-01T00:00:00Z',
  };
  saveCPV5(h.yearPlan.id, sampleCP);

  const annualSnapshotBefore = JSON.parse(JSON.stringify(loadStorageV5().annualData));
  const annualJPSnapshotBefore = JSON.parse(JSON.stringify(loadStorageV5().annualJPReferences));

  const spId = h.semesterPlans[0].id;
  saveRosterV5(spId, createSampleRoster());
  saveGradeV5(spId, createSampleGrade());
  deleteRosterV5(spId);

  const stateAfter = loadStorageV5();
  assert.deepStrictEqual(stateAfter.annualData, annualSnapshotBefore, 'annualData must remain byte-for-byte identical');
  assert.deepStrictEqual(stateAfter.annualJPReferences, annualJPSnapshotBefore, 'annualJPReferences must remain byte-for-byte identical');
  assert.deepStrictEqual(getAnnualDataV5(h.yearPlan.id).cp, sampleCP);
});

// =========================================================================
// TEST 13: Save/load persistence roundtrip deepStrictEqual
// =========================================================================
runTest('13. Persistence roundtrip: Semester state save -> load matches with exact deepStrictEqual', () => {
  mockStorage.clear();
  const { profile, school } = seedProfileAndSchool();

  const h = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Biologi',
  });

  const spId = h.semesterPlans[0].id;
  saveRosterV5(spId, createSampleRoster());
  saveAcademicCalendarV5(spId, createSampleCalendar());

  const state1 = loadStorageV5();
  saveStorageV5(state1);
  const state2 = loadStorageV5();

  assert.deepStrictEqual(state2, state1);
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 SEMESTER CRUD TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
