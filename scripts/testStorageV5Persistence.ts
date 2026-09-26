import assert from 'node:assert';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import {
  AppStorageStateV5,
  AssessmentPackage,
  YearPlan,
  SemesterPlan,
  AdministrationWorkspaceV5,
} from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 PERSISTENCE LAYER ===\n');

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

// =========================================================================
// TEST 1: Missing V5 key initializes, persists, and returns initial state
// =========================================================================
runTest('1. Missing V5 key: Initializes, saves to storage, and returns canonical empty state', () => {
  mockStorage.clear();
  assert.strictEqual(mockStorage.getItem(STORAGE_KEY_V5), null);

  const state = loadStorageV5();
  assert.strictEqual(state.schemaVersion, 5);
  assert.deepStrictEqual(state, createInitialStorageV5());

  // Must be persisted immediately to localStorage under STORAGE_KEY_V5
  const persistedRaw = mockStorage.getItem(STORAGE_KEY_V5);
  assert(persistedRaw !== null, 'V5 key must be created in localStorage');
  const persistedParsed = JSON.parse(persistedRaw!);
  assert.strictEqual(persistedParsed.schemaVersion, 5);
  assert.deepStrictEqual(persistedParsed, createInitialStorageV5());
});

// =========================================================================
// TEST 2: Save and Load Round-Trip
// =========================================================================
runTest('2. Save & Load: State saved to localStorage loads back with exact deep equality', () => {
  mockStorage.clear();

  const customState: AppStorageStateV5 = {
    schemaVersion: 5,
    activeProfileId: 'prof-1',
    activeYearPlanId: 'yp-1',
    activeSemesterPlanId: 'sp-1',
    activeWorkspaceId: 'ws-1',
    profiles: [
      {
        id: 'prof-1',
        name: 'Dr. Siti Nurhaliza',
        nip: '198203152006042001',
        status: 'PNS',
        defaultSubject: 'Matematika',
        defaultLevel: 'SMA',
        schoolId: 'sch-1',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ],
    schools: [
      {
        id: 'sch-1',
        name: 'SMA Negeri 1 Jakarta',
        npsn: '20101010',
        address: 'Jl. Budi Utomo No. 7',
        village: 'Pasar Baru',
        district: 'Sawah Besar',
        regency: 'Kota Jakarta Pusat',
        province: 'DKI Jakarta',
        principalName: 'Drs. H. Mulyadi, M.Pd.',
        principalNip: '196501011990011001',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ],
    principalHistories: [],
    workspaces: [
      {
        id: 'ws-1',
        profileId: 'prof-1',
        schoolId: 'sch-1',
        yearPlanId: 'yp-1',
        name: 'Matematika Kelas 10 — 2026/2027',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ],
    yearPlans: [
      {
        id: 'yp-1',
        profileId: 'prof-1',
        schoolId: 'sch-1',
        academicYear: '2026/2027',
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 'Kelas 10',
        subject: 'Matematika',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ],
    semesterPlans: [
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
      },
    ],
    annualJPReferences: [
      {
        yearPlanId: 'yp-1',
        value: {
          officialAnnualJP: 144,
          referenceWeeklyEquivalentJP: 4,
        },
      },
    ],
    semesterJPSettings: [
      {
        semesterPlanId: 'sp-1',
        value: {
          semesterPlanId: 'sp-1',
          actualScheduledWeeklyJP: 4,
          source: 'SCHOOL_SCHEDULE',
        },
      },
    ],
    annualData: {
      cp: [],
      cpAnalysis: [],
      tp: [
        {
          yearPlanId: 'yp-1',
          value: {
            id: 'tp-1',
            academicSettingId: 'set-1',
            items: [
              {
                id: 'tp-item-1',
                code: 'TP 10.1',
                statement: 'Memahami fungsi kuadrat',
                competence: 'Memahami',
                contentScope: 'Fungsi Kuadrat',
                order: 1,
              },
            ],
            updatedAt: '2026-07-01T00:00:00Z',
          },
        },
      ],
      atp: [],
      curriculumContext: [],
    },
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
    documents: [],
  };

  saveStorageV5(customState);
  const loadedState = loadStorageV5();

  assert.deepStrictEqual(loadedState, customState, 'Loaded state must deepStrictEqual saved state');
});

// =========================================================================
// TEST 3: Invalid JSON in localStorage throws and preserves raw data
// =========================================================================
runTest('3. Corrupted JSON: loadStorageV5 throws without overwriting raw localStorage data', () => {
  mockStorage.clear();
  const corruptedRaw = '{ not valid json syntax ...';
  mockStorage.setItem(STORAGE_KEY_V5, corruptedRaw);

  assert.throws(
    () => loadStorageV5(),
    /Corrupted V5 storage payload/i,
    'Must throw on malformed JSON'
  );

  // Raw data in localStorage must remain untouched (not wiped or reset silently)
  assert.strictEqual(
    mockStorage.getItem(STORAGE_KEY_V5),
    corruptedRaw,
    'Corrupted raw data must not be overwritten silently'
  );
});

// =========================================================================
// TEST 4: Invalid Schema in localStorage throws and preserves raw data
// =========================================================================
runTest('4. Invalid Schema: loadStorageV5 throws on invalid schema without resetting silently', () => {
  mockStorage.clear();
  // State with missing annualData or wrong schemaVersion
  const invalidSchema = JSON.stringify({
    schemaVersion: 4,
    profiles: [],
  });
  mockStorage.setItem(STORAGE_KEY_V5, invalidSchema);

  assert.throws(
    () => loadStorageV5(),
    /Invalid schemaVersion: expected 5/i,
    'Must throw on schemaVersion !== 5'
  );

  assert.strictEqual(
    mockStorage.getItem(STORAGE_KEY_V5),
    invalidSchema,
    'Invalid schema data must remain untouched in localStorage'
  );

  // Missing semesterData.assessmentPackage
  const missingCollection = JSON.stringify({
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
      // assessmentPackage missing
      roster: [],
      attendance: [],
      grade: [],
      remedial: [],
      enrichment: [],
    },
  });
  mockStorage.setItem(STORAGE_KEY_V5, missingCollection);

  assert.throws(
    () => loadStorageV5(),
    /semesterData\.assessmentPackage.*must be an array/i,
    'Must throw on missing required collections'
  );

  assert.strictEqual(
    mockStorage.getItem(STORAGE_KEY_V5),
    missingCollection,
    'Incomplete collection payload must remain untouched in localStorage'
  );
});

// =========================================================================
// TEST 5: Reset V5 Storage
// =========================================================================
runTest('5. Reset V5: resetStorageV5 writes and returns canonical empty state', () => {
  mockStorage.clear();
  saveStorageV5({
    ...createInitialStorageV5(),
    activeProfileId: 'prof-99',
    profiles: [
      {
        id: 'prof-99',
        name: 'Guru Test',
        nip: '12345',
        status: 'PNS',
        defaultSubject: 'Math',
        defaultLevel: 'SMA',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ],
  });

  const resetResult = resetStorageV5();
  assert.strictEqual(resetResult.schemaVersion, 5);
  assert.strictEqual(resetResult.activeProfileId, undefined);
  assert.deepStrictEqual(resetResult, createInitialStorageV5());

  const loadedAfterReset = loadStorageV5();
  assert.deepStrictEqual(loadedAfterReset, createInitialStorageV5());
});

// =========================================================================
// TEST 6: Legacy V3 key isolation
// =========================================================================
runTest('6. Legacy Key Isolation: Legacy V3 key is completely ignored and untouched when loading/saving V5', () => {
  mockStorage.clear();
  const legacyV3Key = 'administrasi_guru_ai_storage_v3';
  const legacyV3Data = JSON.stringify({
    version: 3,
    activeProfileId: 'legacy-prof-1',
    profiles: [{ id: 'legacy-prof-1', name: 'Guru Lama' }],
  });

  mockStorage.setItem(legacyV3Key, legacyV3Data);

  // V5 key does not exist yet
  assert.strictEqual(mockStorage.getItem(STORAGE_KEY_V5), null);

  // loadStorageV5 must create a brand new V5 initial state without migrating or reading V3
  const v5State = loadStorageV5();
  assert.strictEqual(v5State.schemaVersion, 5);
  assert.strictEqual(v5State.profiles.length, 0, 'Must NOT migrate legacy profiles');

  // Legacy key must remain untouched
  assert.strictEqual(
    mockStorage.getItem(legacyV3Key),
    legacyV3Data,
    'Legacy V3 key must remain 100% untouched'
  );

  // Modifying and saving V5 state must NOT write to V3
  v5State.profiles.push({
    id: 'v5-prof-1',
    name: 'Guru Baru V5',
    nip: '199001012020011001',
    status: 'PNS',
    defaultSubject: 'Fisika',
    defaultLevel: 'SMA',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });
  saveStorageV5(v5State);

  assert.strictEqual(
    mockStorage.getItem(legacyV3Key),
    legacyV3Data,
    'Legacy V3 key must remain unchanged after saving V5'
  );

  const reloadedV5 = loadStorageV5();
  assert.strictEqual(reloadedV5.profiles[0].name, 'Guru Baru V5');
});

// =========================================================================
// TEST 7: Complex AssessmentPackage Sentinel survives Persistence intact
// =========================================================================
runTest('7. AssessmentPackage Sentinel: Survives saveStorageV5 -> loadStorageV5 losslessly', () => {
  mockStorage.clear();

  const complexPackage: AssessmentPackage = {
    id: 'pkg-mat-01',
    assessmentPlanId: 'plan-mat-01',
    academicSettingId: 'set-100',
    title: 'Asesmen Sumatif Eksponen',
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-mat-1',
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
        title: 'Tes Tertulis Eksponen',
        items: [
          {
            id: 'w-item-1',
            blueprintItemId: 'bp-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Hasil dari 2^3 x 2^4 adalah...',
            options: [
              { id: 'opt-a', label: 'A', text: '64' },
              { id: 'opt-b', label: 'B', text: '128' },
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
    createdAt: '2026-07-25T08:00:00.000Z',
    updatedAt: '2026-07-25T08:00:00.000Z',
  };

  const state = createInitialStorageV5();
  state.profiles.push({
    id: 'prof-1',
    name: 'Siti Rahmawati',
    nip: '198705122011012003',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SMA',
    schoolId: 'sch-1',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.schools.push({
    id: 'sch-1',
    name: 'SMA Negeri 1',
    npsn: '20101010',
    address: 'Jl. Merdeka No. 45',
    village: 'Kalisari',
    district: 'Pasar Rebo',
    regency: 'Kota Jakarta Timur',
    province: 'DKI Jakarta',
    principalName: 'Dr. Ahmad',
    principalNip: '197001011995011001',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.yearPlans.push({
    id: 'yp-1',
    profileId: 'prof-1',
    schoolId: 'sch-1',
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Matematika',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.workspaces.push({
    id: 'ws-1',
    profileId: 'prof-1',
    schoolId: 'sch-1',
    yearPlanId: 'yp-1',
    name: 'Matematika Kelas 10',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
  });
  state.semesterPlans.push(
    {
      id: 'sp-1',
      yearPlanId: 'yp-1',
      semester: 1,
      createdAt: '2026-07-10T08:00:00Z',
      updatedAt: '2026-07-10T08:00:00Z',
    },
    {
      id: 'sp-2',
      yearPlanId: 'yp-1',
      semester: 2,
      createdAt: '2026-07-10T08:00:00Z',
      updatedAt: '2026-07-10T08:00:00Z',
    }
  );

  state.semesterData.assessmentPackage.push({
    semesterPlanId: 'sp-1',
    value: [complexPackage],
  });

  saveStorageV5(state);
  const loaded = loadStorageV5();

  const restoredPackage = loaded.semesterData.assessmentPackage[0].value[0];
  assert.deepStrictEqual(
    restoredPackage,
    complexPackage,
    'AssessmentPackage must be 100% byte-for-byte identical after persistence'
  );
  assert.strictEqual(restoredPackage.blueprintItems[0].cognitiveDemand, 'APPLY');
  assert.strictEqual(restoredPackage.answerKeys[0].value, 'opt-b');
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 PERSISTENCE TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
