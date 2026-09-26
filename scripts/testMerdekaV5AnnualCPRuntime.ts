import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  createProfileV5,
  createSchoolV5,
  createYearHierarchyV5,
  setActiveYearPlanV5,
  saveCPV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';
import { CPData } from '../src/types';

console.log('=== RUNNING AUDIT: MERDEKA V5 ANNUAL CP RUNTIME PERSISTENCE (E.4.1B.2.1A) ===\n');

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

// Setup immutable V3 sentinel
const v3Sentinel = JSON.stringify({
  marker: 'V3_SENTINEL_IMMUTABLE_CP_TEST',
  checksum: 'cp-v5-sentinel-999',
  timestamp: 1718000000000,
  workspaces: [{ id: 'legacy-w1', academicSettingId: 'as-1' }],
});
mockStorage.setItem(V3_STORAGE_KEY, v3Sentinel);

// Initialize fresh V5 state
resetStorageV5();

const testSchool = createSchoolV5({
  name: 'SD Negeri Nusantara 01',
  npsn: '20261001',
  address: 'Jl. Merdeka Belajar No. 1',
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

// Create YearPlan A
const hierarchyA = createYearHierarchyV5({
  profileId: testProfile.id,
  schoolId: testSchool.id,
  academicYear: '2026/2027',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SD',
  grade: 'Kelas 2',
  subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
  documentDate: '2026-07-13',
});
const yearPlanA = hierarchyA.yearPlan;

// Set active YearPlan A
setActiveYearPlanV5(yearPlanA.id);

// CP Data for YearPlan A
const cpPayloadA: CPData = {
  id: '',
  academicSettingId: '',
  generalDescription: 'Capaian Pembelajaran PJOK Fase A untuk Kelas 2.',
  elements: [
    {
      id: 'elem-1',
      name: 'Terampil Bergerak',
      content: 'Peserta didik mempraktikkan keterampilan gerak fundamental.',
    },
    {
      id: 'elem-2',
      name: 'Belajar Melalui Gerak',
      content: 'Peserta didik menerapkan perilaku hidup sehat dan aktif.',
    },
  ],
  updatedAt: '2026-07-15T08:00:00.000Z',
};

// Normalize CP A according to App specification:
// - stable ID: cp-${yearPlanA.id}
// - academicSettingId: yearPlanA.id
const normalizedCPA: CPData = {
  ...cpPayloadA,
  id: cpPayloadA.id && cpPayloadA.id.trim() ? cpPayloadA.id : `cp-${yearPlanA.id}`,
  academicSettingId: yearPlanA.id,
};

let savedCPA: CPData;

runTest('1. Save CP under YearPlan A -> runtime A returns exact CP', () => {
  savedCPA = saveCPV5(yearPlanA.id, normalizedCPA);
  const runtime = getRuntimeContextV5();

  assert.ok(runtime.annualData, 'Runtime must have annualData for active YearPlan A');
  assert.ok(runtime.annualData.cp, 'Runtime must have CP for active YearPlan A');
  assert.deepStrictEqual(
    runtime.annualData.cp,
    savedCPA,
    'Runtime CP must exactly match the saved CP'
  );
  assert.strictEqual(
    runtime.annualData.cp.generalDescription,
    cpPayloadA.generalDescription
  );
  assert.strictEqual(runtime.annualData.cp.elements.length, 2);
});

runTest('2. Saved CP has non-empty stable ID', () => {
  assert.ok(savedCPA.id, 'Saved CP must have an ID');
  assert.strictEqual(
    savedCPA.id,
    `cp-${yearPlanA.id}`,
    'Saved CP must have stable ID formatted as cp-${activeYearPlan.id}'
  );
});

runTest('3. Compatibility academicSettingId equals YearPlan A ID', () => {
  assert.strictEqual(
    savedCPA.academicSettingId,
    yearPlanA.id,
    'academicSettingId must equal active YearPlan A ID'
  );
  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.annualData?.cp?.academicSettingId,
    yearPlanA.id,
    'Runtime CP academicSettingId must equal active YearPlan A ID'
  );
});

runTest('4. Saving CP again to same YearPlan replaces/upserts same annual CP and does not create duplicate wrapper', () => {
  const updatedCPA: CPData = {
    ...savedCPA,
    generalDescription: 'Updated Capaian Pembelajaran PJOK Fase A.',
    elements: [
      ...savedCPA.elements,
      {
        id: 'elem-3',
        name: 'Bergaya Hidup Aktif',
        content: 'Peserta didik berpartisipasi dalam aktivitas fisik secara teratur.',
      },
    ],
    updatedAt: '2026-07-16T10:00:00.000Z',
  };

  // Re-save to the same YearPlan A
  saveCPV5(yearPlanA.id, updatedCPA);

  const state = loadStorageV5();
  const entriesForA = state.annualData.cp.filter((e) => e.yearPlanId === yearPlanA.id);
  assert.strictEqual(
    entriesForA.length,
    1,
    'Exactly 1 annualData.cp wrapper must exist for YearPlan A (no duplicate entries)'
  );
  assert.strictEqual(
    state.annualData.cp.length,
    1,
    'Total annualData.cp entries must remain 1'
  );
  assert.strictEqual(
    entriesForA[0].value.elements.length,
    3,
    'Value must be updated in place'
  );

  const runtime = getRuntimeContextV5();
  assert.strictEqual(runtime.annualData?.cp?.elements.length, 3);
  assert.strictEqual(
    runtime.annualData?.cp?.id,
    `cp-${yearPlanA.id}`,
    'Stable ID must not be regenerated on subsequent saves'
  );
});

let yearPlanB: any;
let savedCPB: CPData;

runTest('5. Create YearPlan B with different CP -> A and B remain isolated', () => {
  const hierarchyB = createYearHierarchyV5({
    profileId: testProfile.id,
    schoolId: testSchool.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'Matematika',
    documentDate: '2026-07-14',
  });
  yearPlanB = hierarchyB.yearPlan;

  const cpPayloadB: CPData = {
    id: '',
    academicSettingId: '',
    generalDescription: 'Capaian Pembelajaran Matematika Fase B untuk Kelas 4.',
    elements: [
      {
        id: 'elem-b1',
        name: 'Bilangan',
        content: 'Peserta didik menunjukkan pemahaman pecahan dan bilangan desimal.',
      },
    ],
    updatedAt: '2026-07-17T09:00:00.000Z',
  };

  const normalizedCPB: CPData = {
    ...cpPayloadB,
    id: `cp-${yearPlanB.id}`,
    academicSettingId: yearPlanB.id,
  };

  savedCPB = saveCPV5(yearPlanB.id, normalizedCPB);

  const state = loadStorageV5();
  assert.strictEqual(state.annualData.cp.length, 2, 'Must have exactly 2 CP entries in storage');

  const entryA = state.annualData.cp.find((e) => e.yearPlanId === yearPlanA.id);
  const entryB = state.annualData.cp.find((e) => e.yearPlanId === yearPlanB.id);

  assert.ok(entryA, 'Entry for YearPlan A must exist');
  assert.ok(entryB, 'Entry for YearPlan B must exist');

  assert.strictEqual(entryA?.value.generalDescription, 'Updated Capaian Pembelajaran PJOK Fase A.');
  assert.strictEqual(entryB?.value.generalDescription, 'Capaian Pembelajaran Matematika Fase B untuk Kelas 4.');
  assert.strictEqual(entryA?.value.elements.length, 3);
  assert.strictEqual(entryB?.value.elements.length, 1);
});

runTest('6. Switching active YearPlan: A returns CP A, B returns CP B', () => {
  // Switch to YearPlan A
  setActiveYearPlanV5(yearPlanA.id);
  const runtimeA = getRuntimeContextV5();
  assert.strictEqual(runtimeA.activeYearPlan?.id, yearPlanA.id);
  assert.strictEqual(runtimeA.annualData?.cp?.generalDescription, 'Updated Capaian Pembelajaran PJOK Fase A.');
  assert.strictEqual(runtimeA.annualData?.cp?.elements.length, 3);
  assert.strictEqual(runtimeA.annualData?.cp?.id, `cp-${yearPlanA.id}`);

  // Switch to YearPlan B
  setActiveYearPlanV5(yearPlanB.id);
  const runtimeB = getRuntimeContextV5();
  assert.strictEqual(runtimeB.activeYearPlan?.id, yearPlanB.id);
  assert.strictEqual(runtimeB.annualData?.cp?.generalDescription, 'Capaian Pembelajaran Matematika Fase B untuk Kelas 4.');
  assert.strictEqual(runtimeB.annualData?.cp?.elements.length, 1);
  assert.strictEqual(runtimeB.annualData?.cp?.id, `cp-${yearPlanB.id}`);
});

runTest('7. activeSemesterPlanId remains undefined throughout CP operations', () => {
  const state = loadStorageV5();
  assert.strictEqual(
    state.activeSemesterPlanId,
    undefined,
    'Storage activeSemesterPlanId must remain undefined during all CP operations'
  );

  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.activeSemesterPlan,
    undefined,
    'Runtime activeSemesterPlan must remain undefined during all CP operations'
  );
});

runTest('8. V3 sentinel remains byte-for-byte unchanged', () => {
  const currentV3 = mockStorage.getItem(V3_STORAGE_KEY);
  assert.strictEqual(
    currentV3,
    v3Sentinel,
    'Legacy V3 storage must remain strictly byte-for-byte unchanged throughout CP operations'
  );
});

runTest('9. App source wires handleSaveCP -> saveCPV5 and refreshV5', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  // Verify saveCPV5 is imported from storageV5
  assert.ok(
    /import\s*\{[^}]*saveCPV5[^}]*\}\s*from\s*['"]\.\/services\/storageV5['"]/.test(appSource),
    'App.tsx must import saveCPV5 from ./services/storageV5'
  );

  // Verify handleSaveCP implementation
  assert.ok(
    appSource.includes('const handleSaveCP = (cp: CPData) => {'),
    'App.tsx must declare handleSaveCP'
  );
  assert.ok(
    appSource.includes('!activeYearPlan'),
    'handleSaveCP must require activeYearPlan'
  );
  assert.ok(
    appSource.includes('saveCPV5(activeYearPlan.id,'),
    'handleSaveCP must call saveCPV5 with activeYearPlan.id'
  );
  assert.ok(
    appSource.includes('refreshV5()'),
    'handleSaveCP must call refreshV5 after saving'
  );
  assert.ok(
    appSource.includes('`cp-${activeYearPlan.id}`'),
    'handleSaveCP must assign stable ID cp-${activeYearPlan.id}'
  );
  assert.ok(
    appSource.includes('academicSettingId: activeYearPlan.id'),
    'handleSaveCP must set academicSettingId to activeYearPlan.id'
  );
});

runTest('10. handleSaveCPAnalysis remains uncoupled/no-op in this task', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  assert.ok(
    appSource.includes('const handleSaveCPAnalysis = (analysis: CPAnalysisData) => {'),
    'App.tsx must define handleSaveCPAnalysis'
  );

  // Extract handleSaveCPAnalysis body
  const match = appSource.match(/const handleSaveCPAnalysis = \(analysis: CPAnalysisData\) => \{([\s\S]*?)\};/);
  assert.ok(match, 'handleSaveCPAnalysis function must exist in App.tsx');
  const body = match[1];

  assert.strictEqual(
    body.includes('saveCPAnalysisV5'),
    false,
    'handleSaveCPAnalysis must NOT call saveCPAnalysisV5 in this task'
  );
  assert.strictEqual(
    body.includes('saveStorageV5'),
    false,
    'handleSaveCPAnalysis must NOT modify storage in this task'
  );
});

console.log(`\n========================================`);
console.log(`MERDEKA V5 ANNUAL CP RUNTIME: ALL ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`========================================\n`);
