import assert from 'node:assert';
import {
  createInitialStorageV5,
  serializeBackupV5,
  parseBackupV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import {
  AppStorageStateV5,
  YearScopedEntry,
  SemesterScopedEntry,
  YearPlan,
  SemesterPlan,
  AdministrationWorkspaceV5,
  AssessmentPackage,
  CPData,
  TPData,
  ATPData,
  LearningPlan,
} from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 CONTRACT FOUNDATION ===\n');

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
// TEST 1: Storage Key and Schema Version constants
// =========================================================================
runTest('1. Storage Key and Schema Version: Exact key and schemaVersion: 5', () => {
  assert.strictEqual(STORAGE_KEY_V5, 'administrasi_guru_ai_storage_v5');

  const initial = createInitialStorageV5();
  assert.strictEqual(initial.schemaVersion, 5);
  assert.strictEqual('version' in initial, false, 'V5 state must use schemaVersion, not version');
});

// =========================================================================
// TEST 2: Initial State Structure and Collections
// =========================================================================
runTest('2. Initial State Structure: Contains all required annual, semester, and root collections without dual JP SSOT', () => {
  const state = createInitialStorageV5();

  // Root collections
  assert(Array.isArray(state.profiles), 'profiles must be an array');
  assert(Array.isArray(state.schools), 'schools must be an array');
  assert(Array.isArray(state.principalHistories), 'principalHistories must be an array');
  assert(Array.isArray(state.workspaces), 'workspaces must be an array');
  assert(Array.isArray(state.yearPlans), 'yearPlans must be an array');
  assert(Array.isArray(state.semesterPlans), 'semesterPlans must be an array');
  assert(Array.isArray(state.annualJPReferences), 'annualJPReferences must be an array');
  assert(Array.isArray(state.semesterJPSettings), 'semesterJPSettings must be an array');
  assert(Array.isArray(state.documents), 'documents must be an array');

  // Annual data store
  assert(Array.isArray(state.annualData.cp), 'annualData.cp must be an array');
  assert(Array.isArray(state.annualData.cpAnalysis), 'annualData.cpAnalysis must be an array');
  assert(Array.isArray(state.annualData.tp), 'annualData.tp must be an array');
  assert(Array.isArray(state.annualData.atp), 'annualData.atp must be an array');
  assert(Array.isArray(state.annualData.curriculumContext), 'annualData.curriculumContext must be an array');

  // Strict: No dual Annual JP SSOT in annualData
  assert.strictEqual(
    'annualJPReference' in state.annualData,
    false,
    'annualData.annualJPReference must be removed to avoid dual SSOT'
  );

  // Semester data store
  assert(Array.isArray(state.semesterData.academicCalendar), 'semesterData.academicCalendar must be an array');
  assert(Array.isArray(state.semesterData.timeAllocation), 'semesterData.timeAllocation must be an array');
  assert(Array.isArray(state.semesterData.learningPlan), 'semesterData.learningPlan must be an array');
  assert(Array.isArray(state.semesterData.assessmentCriteria), 'semesterData.assessmentCriteria must be an array');
  assert(Array.isArray(state.semesterData.assessmentPlan), 'semesterData.assessmentPlan must be an array');
  assert(Array.isArray(state.semesterData.assessmentPackage), 'semesterData.assessmentPackage must be an array');
  assert(Array.isArray(state.semesterData.roster), 'semesterData.roster must be an array');
  assert(Array.isArray(state.semesterData.attendance), 'semesterData.attendance must be an array');
  assert(Array.isArray(state.semesterData.grade), 'semesterData.grade must be an array');
  assert(Array.isArray(state.semesterData.remedial), 'semesterData.remedial must be an array');
  assert(Array.isArray(state.semesterData.enrichment), 'semesterData.enrichment must be an array');
});

// =========================================================================
// TEST 3: YearPlan, SemesterPlan, & AdministrationWorkspaceV5 Hierarchy
// =========================================================================
runTest('3. YearPlan & Workspace Hierarchy: AdministrationWorkspaceV5 references yearPlanId without academicSettingId or semester', () => {
  const sampleYearPlan: YearPlan = {
    id: 'yp-2026-pjok-7',
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

  assert.strictEqual('semester' in sampleYearPlan, false, 'YearPlan must not have semester property');
  assert.strictEqual('activeSemester' in sampleYearPlan, false, 'YearPlan must not have activeSemester property');

  const sampleSemesterPlan: SemesterPlan = {
    id: 'sp-2026-pjok-7-sem1',
    yearPlanId: 'yp-2026-pjok-7',
    semester: 1,
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-07-15T08:00:00.000Z',
  };

  assert.strictEqual(sampleSemesterPlan.yearPlanId, 'yp-2026-pjok-7');
  assert.strictEqual(sampleSemesterPlan.semester, 1);
  assert.strictEqual('academicYear' in sampleSemesterPlan, false, 'SemesterPlan must NOT duplicate academicYear');
  assert.strictEqual('subject' in sampleSemesterPlan, false, 'SemesterPlan must NOT duplicate subject');
  assert.strictEqual('grade' in sampleSemesterPlan, false, 'SemesterPlan must NOT duplicate grade');

  // AdministrationWorkspaceV5 check
  const sampleWorkspaceV5: AdministrationWorkspaceV5 = {
    id: 'ws-100',
    profileId: 'prof-1',
    schoolId: 'sch-1',
    yearPlanId: 'yp-2026-pjok-7',
    name: 'PJOK Kelas 7 — 2026/2027',
    documentDate: '2026-07-15',
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-07-15T08:00:00.000Z',
  };

  assert.strictEqual(sampleWorkspaceV5.yearPlanId, 'yp-2026-pjok-7');
  assert.strictEqual('academicSettingId' in sampleWorkspaceV5, false, 'Workspace V5 must NOT have academicSettingId');
  assert.strictEqual('semester' in sampleWorkspaceV5, false, 'Workspace V5 must NOT have semester');
  assert.strictEqual('activeSemester' in sampleWorkspaceV5, false, 'Workspace V5 must NOT have activeSemester');
});

// =========================================================================
// TEST 4: Scoped Entry Types: YearScopedEntry & SemesterScopedEntry
// =========================================================================
runTest('4. Scoped Entries: YearScopedEntry and SemesterScopedEntry enforce scoping keys', () => {
  const yearEntry: YearScopedEntry<{ title: string }> = {
    yearPlanId: 'yp-1',
    value: { title: 'Annual Target' },
  };
  assert.strictEqual(yearEntry.yearPlanId, 'yp-1');
  assert.strictEqual(yearEntry.value.title, 'Annual Target');

  const semEntry: SemesterScopedEntry<{ hours: number }> = {
    semesterPlanId: 'sp-1',
    value: { hours: 36 },
  };
  assert.strictEqual(semEntry.semesterPlanId, 'sp-1');
  assert.strictEqual(semEntry.value.hours, 36);
});

// =========================================================================
// TEST 5: Serialization & Envelope Format
// =========================================================================
runTest('5. Serialization: Wraps state into canonical V5 envelope', () => {
  const state = createInitialStorageV5();
  state.profiles.push({
    id: 'prof-1',
    name: 'Budi Santoso',
    nip: '198501012010011001',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SMP',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });

  const serialized = serializeBackupV5(state);
  const parsed = JSON.parse(serialized);

  assert.strictEqual(parsed.app, 'Administrasi Guru AI');
  assert.strictEqual(parsed.schemaVersion, 5);
  assert(typeof parsed.exportedAt === 'string');
  assert.strictEqual(parsed.data.schemaVersion, 5);
  assert.strictEqual(parsed.data.profiles.length, 1);
  assert.strictEqual(parsed.data.profiles[0].name, 'Budi Santoso');
});

// =========================================================================
// TEST 6: Strict Rejection of Incomplete Payloads, Legacy Versions & Malformed Envelopes
// =========================================================================
runTest('6. Validation & Rejection: Rejects incomplete V5 payloads, legacy versions, and malformed envelopes', () => {
  // Wrong schemaVersion (e.g. 4 or 3)
  const legacyV4 = JSON.stringify({
    app: 'Administrasi Guru AI',
    schemaVersion: 4,
    exportedAt: '2026-09-25T10:00:00Z',
    data: { schemaVersion: 4 },
  });
  assert.throws(
    () => parseBackupV5(legacyV4),
    /Unsupported schemaVersion/i,
    'Must throw on non-5 schemaVersion'
  );

  // Incomplete data: only { schemaVersion: 5 }
  const incompleteData = JSON.stringify({
    app: 'Administrasi Guru AI',
    schemaVersion: 5,
    exportedAt: '2026-09-25T10:00:00Z',
    data: { schemaVersion: 5 },
  });
  assert.throws(
    () => parseBackupV5(incompleteData),
    /must be an array/i,
    'Must throw when root collections are missing'
  );

  // Missing profiles
  const missingProfiles = JSON.stringify({
    app: 'Administrasi Guru AI',
    schemaVersion: 5,
    exportedAt: '2026-09-25T10:00:00Z',
    data: {
      schemaVersion: 5,
      schools: [],
      principalHistories: [],
      workspaces: [],
      yearPlans: [],
      semesterPlans: [],
      annualJPReferences: [],
      semesterJPSettings: [],
      documents: [],
      annualData: { cp: [], cpAnalysis: [], tp: [], atp: [], curriculumContext: [] },
      semesterData: {
        academicCalendar: [],
        timeAllocation: [],
        learningPlan: [],
        assessmentCriteria: [],
        assessmentPlan: [],
        assessmentPackage: [],
        roster: [],
        attendance: [],
        grade: [],
        remedial: [],
        enrichment: [],
      },
    },
  });
  assert.throws(
    () => parseBackupV5(missingProfiles),
    /data\.profiles.*must be an array/i,
    'Must throw when profiles is missing'
  );

  // Missing annualData
  const missingAnnualData = JSON.stringify({
    app: 'Administrasi Guru AI',
    schemaVersion: 5,
    exportedAt: '2026-09-25T10:00:00Z',
    data: {
      schemaVersion: 5,
      profiles: [],
      schools: [],
      principalHistories: [],
      workspaces: [],
      yearPlans: [],
      semesterPlans: [],
      annualJPReferences: [],
      semesterJPSettings: [],
      documents: [],
      semesterData: {
        academicCalendar: [],
        timeAllocation: [],
        learningPlan: [],
        assessmentCriteria: [],
        assessmentPlan: [],
        assessmentPackage: [],
        roster: [],
        attendance: [],
        grade: [],
        remedial: [],
        enrichment: [],
      },
    },
  });
  assert.throws(
    () => parseBackupV5(missingAnnualData),
    /data\.annualData.*must be an object/i,
    'Must throw when annualData is missing'
  );

  // Missing semesterData.assessmentPackage
  const missingAssessmentPkg = JSON.stringify({
    app: 'Administrasi Guru AI',
    schemaVersion: 5,
    exportedAt: '2026-09-25T10:00:00Z',
    data: {
      schemaVersion: 5,
      profiles: [],
      schools: [],
      principalHistories: [],
      workspaces: [],
      yearPlans: [],
      semesterPlans: [],
      annualJPReferences: [],
      semesterJPSettings: [],
      documents: [],
      annualData: { cp: [], cpAnalysis: [], tp: [], atp: [], curriculumContext: [] },
      semesterData: {
        academicCalendar: [],
        timeAllocation: [],
        learningPlan: [],
        assessmentCriteria: [],
        assessmentPlan: [],
        roster: [],
        attendance: [],
        grade: [],
        remedial: [],
        enrichment: [],
      },
    },
  });
  assert.throws(
    () => parseBackupV5(missingAssessmentPkg),
    /data\.semesterData\.assessmentPackage.*must be an array/i,
    'Must throw when assessmentPackage collection is missing'
  );

  // Invalid exportedAt (empty string)
  const invalidExportedAt = JSON.stringify({
    app: 'Administrasi Guru AI',
    schemaVersion: 5,
    exportedAt: '',
    data: createInitialStorageV5(),
  });
  assert.throws(
    () => parseBackupV5(invalidExportedAt),
    /exportedAt.*must be a valid non-empty/i,
    'Must throw on empty exportedAt'
  );

  // Wrong app identifier
  const wrongApp = JSON.stringify({
    app: 'Other App',
    schemaVersion: 5,
    exportedAt: '2026-09-25T10:00:00Z',
    data: createInitialStorageV5(),
  });
  assert.throws(
    () => parseBackupV5(wrongApp),
    /Invalid backup application identifier/i,
    'Must throw on incorrect app name'
  );

  // Malformed JSON
  assert.throws(() => parseBackupV5('{ not valid json'), /Malformed JSON/i);
});

// =========================================================================
// TEST 7: Lossless Round-Trip across all collections
// =========================================================================
runTest('7. Lossless Round-Trip: Complete canonical state survives serialize -> parse with exact deep equality', () => {
  const fullState: AppStorageStateV5 = {
    schemaVersion: 5,
    activeProfileId: 'prof-100',
    activeYearPlanId: 'yp-100',
    activeSemesterPlanId: 'sp-100',
    activeWorkspaceId: 'ws-100',
    profiles: [
      {
        id: 'prof-100',
        name: 'Siti Rahmawati, M.Pd.',
        nip: '198705122011012003',
        status: 'PNS',
        defaultSubject: 'Informatika',
        defaultLevel: 'SMA',
        schoolId: 'sch-100',
        createdAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-10T08:00:00Z',
      },
    ],
    schools: [
      {
        id: 'sch-100',
        name: 'SMA Negeri 1 Nusantara',
        npsn: '20101010',
        address: 'Jl. Merdeka No. 45',
        village: 'Kalisari',
        district: 'Pasar Rebo',
        regency: 'Kota Jakarta Timur',
        province: 'DKI Jakarta',
        principalName: 'Dr. H. Ahmad Fauzi, M.Pd.',
        principalNip: '197001011995011001',
        createdAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-10T08:00:00Z',
      },
    ],
    principalHistories: [
      {
        id: 'ph-1',
        schoolId: 'sch-100',
        name: 'Dr. H. Ahmad Fauzi, M.Pd.',
        nip: '197001011995011001',
        startDate: '2024-01-01',
        isActive: true,
        createdAt: '2026-07-10T08:00:00Z',
      },
    ],
    workspaces: [
      {
        id: 'ws-100',
        profileId: 'prof-100',
        schoolId: 'sch-100',
        yearPlanId: 'yp-100',
        name: 'Informatika Kelas 10 — 2026/2027',
        documentDate: '2026-07-15',
        createdAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-10T08:00:00Z',
      },
    ],
    yearPlans: [
      {
        id: 'yp-100',
        profileId: 'prof-100',
        schoolId: 'sch-100',
        academicYear: '2026/2027',
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 'Kelas 10',
        subject: 'Informatika',
        phase: 'E',
        createdAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-10T08:00:00Z',
      },
    ],
    semesterPlans: [
      {
        id: 'sp-100',
        yearPlanId: 'yp-100',
        semester: 1,
        createdAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-10T08:00:00Z',
      },
      {
        id: 'sp-200',
        yearPlanId: 'yp-100',
        semester: 2,
        createdAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-10T08:00:00Z',
      },
    ],
    annualJPReferences: [
      {
        yearPlanId: 'yp-100',
        value: {
          officialAnnualJP: 108,
          referenceWeeklyEquivalentJP: 3,
          regulationReference: 'Permendikbudristek 12/2024 Lampiran II',
        },
      },
    ],
    semesterJPSettings: [
      {
        semesterPlanId: 'sp-100',
        value: {
          semesterPlanId: 'sp-100',
          actualScheduledWeeklyJP: 3,
          source: 'SCHOOL_SCHEDULE',
        },
      },
    ],
    annualData: {
      cp: [
        {
          yearPlanId: 'yp-100',
          value: {
            id: 'cp-100',
            academicSettingId: 'set-100',
            generalDescription: 'Capaian Pembelajaran Informatika Fase E',
            elements: [{ id: 'elem-1', name: 'Berpikir Komputasional', content: 'Memahami algoritma' }],
            updatedAt: '2026-07-10T08:00:00Z',
          },
        },
      ],
      cpAnalysis: [],
      tp: [
        {
          yearPlanId: 'yp-100',
          value: {
            id: 'tp-100',
            academicSettingId: 'set-100',
            items: [
              {
                id: 'tp-item-1',
                code: 'TP 10.1',
                statement: 'Menerapkan algoritma pencarian standar.',
                competence: 'Menerapkan',
                contentScope: 'Algoritma Pencarian',
                order: 1,
              },
            ],
            updatedAt: '2026-07-10T08:00:00Z',
          },
        },
      ],
      atp: [
        {
          yearPlanId: 'yp-100',
          value: {
            id: 'atp-100',
            academicSettingId: 'set-100',
            items: [
              {
                id: 'atp-item-1',
                stepNumber: 1,
                tpId: 'tp-item-1',
                allocatedJP: 6,
              },
            ],
            updatedAt: '2026-07-10T08:00:00Z',
          },
        },
      ],
      curriculumContext: [
        {
          yearPlanId: 'yp-100',
          value: {
            curriculumType: 'KURIKULUM_MERDEKA',
            academicYear: '2026/2027',
            regulationIds: ['permendikbudristek-12-2024'],
          },
        },
      ],
    },
    semesterData: {
      academicCalendar: [
        {
          semesterPlanId: 'sp-100',
          value: {
            calendar: {
              id: 'cal-100',
              academicSettingId: 'set-100',
              academicYear: '2026/2027',
              semester: '1 (Ganjil)',
              startDate: '2026-07-13',
              endDate: '2026-12-18',
              schoolDaysPerWeek: 5,
              sourceType: 'REGIONAL_EDUCATION_CALENDAR',
              workflowStatus: 'AUTO_RESOLVED',
              updatedAt: '2026-07-10T08:00:00Z',
            },
            days: [
              {
                id: 'day-1',
                academicCalendarId: 'cal-100',
                date: '2026-08-17',
                status: 'HOLIDAY',
                notes: 'HUT RI Ke-81',
              },
            ],
          },
        },
      ],
      timeAllocation: [
        {
          semesterPlanId: 'sp-100',
          value: [
            {
              id: 'alloc-1',
              academicSettingId: 'set-100',
              tpId: 'tp-item-1',
              jp: 6,
              weekNumber: 1,
            },
          ],
        },
      ],
      learningPlan: [
        {
          semesterPlanId: 'sp-100',
          value: [
            {
              id: 'lp-100',
              academicSettingId: 'set-100',
              sourceType: 'MANUAL',
              status: 'SIAP',
              tpIds: ['tp-item-1'],
              atpItemIds: ['atp-item-1'],
              objectives: [
                {
                  id: 'obj-1',
                  tpId: 'tp-item-1',
                  statement: 'Menerapkan algoritma pencarian standar.',
                },
              ],
              assessmentPlan: {},
              createdAt: '2026-07-10T08:00:00Z',
              updatedAt: '2026-07-10T08:00:00Z',
            },
          ],
        },
      ],
      assessmentCriteria: [],
      assessmentPlan: [],
      assessmentPackage: [],
      roster: [
        {
          semesterPlanId: 'sp-100',
          value: [
            {
              id: 'std-1',
              academicSettingId: 'set-100',
              name: 'Ahmad Dahlan',
              nisn: '0012345678',
              gender: 'L',
            },
          ],
        },
      ],
      attendance: [],
      grade: [],
      remedial: [],
      enrichment: [],
    },
    documents: [
      {
        id: 'doc-100',
        type: 'MODUL_AJAR',
        title: 'Modul Ajar Informatika Pertemuan 1',
        status: 'completed',
        fileName: 'Modul_Ajar_Informatika_10.docx',
      },
    ],
  };

  const serialized = serializeBackupV5(fullState);
  const parsed = parseBackupV5(serialized);

  assert.deepStrictEqual(parsed, fullState, 'Parsed V5 backup must exactly equal original state');
});

// =========================================================================
// TEST 8: AssessmentPackage Sentinel Invariant (Internal structure is untouched)
// =========================================================================
runTest('8. AssessmentPackage Invariant: Complex AssessmentPackage survives intact inside SemesterScopedEntry<AssessmentPackage[]>', () => {
  const sampleAssessmentPackage: AssessmentPackage = {
    id: 'pkg-inf-01',
    assessmentPlanId: 'plan-inf-01',
    academicSettingId: 'set-100',
    title: 'Paket Asesmen Sumatif Bab Algoritma',
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-item-1',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['w-item-1'],
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
        title: 'Tes Tertulis Algoritma',
        items: [
          {
            id: 'w-item-1',
            blueprintItemId: 'bp-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Manakah algoritma yang memiliki kompleksitas O(log n)?',
            options: [
              { id: 'opt-a', label: 'A', text: 'Linear Search' },
              { id: 'opt-b', label: 'B', text: 'Binary Search' },
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
        instrumentItemId: 'w-item-1',
        answerType: 'OPTION',
        value: 'opt-b',
      },
    ],
    scoringGuides: [
      {
        id: 'guide-1',
        title: 'Panduan Penskoran Pilihan Ganda',
        guideType: 'OBJECTIVE',
        maxScore: 100,
      },
    ],
    rubrics: [],
    workflowStatus: 'SIAP',
    createdAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
  };

  const state = createInitialStorageV5();
  state.profiles.push({
    id: 'prof-100',
    name: 'Siti Rahmawati',
    nip: '198705122011012003',
    status: 'PNS',
    defaultSubject: 'Informatika',
    defaultLevel: 'SMA',
    schoolId: 'sch-100',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.schools.push({
    id: 'sch-100',
    name: 'SMA Negeri 1 Nusantara',
    npsn: '20101010',
    address: 'Jl. Merdeka No. 45',
    village: 'Kalisari',
    district: 'Pasar Rebo',
    regency: 'Kota Jakarta Timur',
    province: 'DKI Jakarta',
    principalName: 'Dr. H. Ahmad Fauzi',
    principalNip: '197001011995011001',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.yearPlans.push({
    id: 'yp-100',
    profileId: 'prof-100',
    schoolId: 'sch-100',
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Informatika',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.workspaces.push({
    id: 'ws-100',
    profileId: 'prof-100',
    schoolId: 'sch-100',
    yearPlanId: 'yp-100',
    name: 'Informatika Kelas 10',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.semesterPlans.push(
    {
      id: 'sp-100',
      yearPlanId: 'yp-100',
      semester: 1,
      createdAt: '2026-07-10T08:00:00Z',
      updatedAt: '2026-07-10T08:00:00Z',
    },
    {
      id: 'sp-200',
      yearPlanId: 'yp-100',
      semester: 2,
      createdAt: '2026-07-10T08:00:00Z',
      updatedAt: '2026-07-10T08:00:00Z',
    }
  );

  state.semesterData.assessmentPackage.push({
    semesterPlanId: 'sp-100',
    value: [sampleAssessmentPackage],
  });

  const serialized = serializeBackupV5(state);
  const parsed = parseBackupV5(serialized);

  const restoredPackage = parsed.semesterData.assessmentPackage[0].value[0] as AssessmentPackage;
  assert.deepStrictEqual(
    restoredPackage,
    sampleAssessmentPackage,
    'AssessmentPackage internals must remain 100% byte-for-byte identical after round-trip'
  );
  assert.strictEqual(restoredPackage.blueprintItems[0].cognitiveDemand, 'APPLY');
  assert.strictEqual(restoredPackage.answerKeys[0].value, 'opt-b');
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 CONTRACT TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
