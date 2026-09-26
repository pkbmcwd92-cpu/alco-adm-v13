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
  saveCPAnalysisV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';
import { CPData, CPAnalysisData } from '../src/types';

console.log('=== RUNNING AUDIT: MERDEKA V5 CP ANALYSIS RUNTIME PERSISTENCE ===\n');

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
  marker: 'V3_SENTINEL_IMMUTABLE_CP_ANALYSIS_TEST',
  checksum: 'cpa-v5-sentinel-777',
  timestamp: 1718000000000,
  workspaces: [{ id: 'legacy-w1', academicSettingId: 'as-1' }],
});
mockStorage.setItem(V3_STORAGE_KEY, v3Sentinel);

// Initialize fresh V5 state
resetStorageV5();

const testSchool = createSchoolV5({
  name: 'SD Negeri Karanganyar 01',
  npsn: '20262001',
  address: 'Jl. Pendidikan No. 45',
  village: 'Karanganyar',
  district: 'Cerdas',
  regency: 'Kota Belajar',
  province: 'Jawa Barat',
  principalName: 'Bambang Sudarsono, M.Pd.',
  principalNip: '197305101998031002',
});

const testProfile = createProfileV5({
  name: 'Dewi Lestari, S.Pd.',
  nip: '199004152016012003',
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

let activeCPA: CPData;
let savedAnalysisA: CPAnalysisData;

runTest('1. CP must exist before canonical CP Analysis save', () => {
  const runtime = getRuntimeContextV5();
  // Before CP is saved, runtime has no persisted CP
  assert.strictEqual(
    runtime.annualData?.cp,
    undefined,
    'Before saving CP, runtime.annualData.cp must be undefined'
  );

  // App source contract: handleSaveCPAnalysis checks runtimeContext.annualData?.cp
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');
  assert.ok(
    appSource.includes('runtimeContext.annualData?.cp') &&
    appSource.includes('!persistedCP'),
    'App.tsx must guard that CP exists before saving CP Analysis'
  );
});

runTest('2. Save analysis under YearPlan A -> runtime A returns exact analysis', () => {
  // First persist CP for YearPlan A
  const cpPayloadA: CPData = {
    id: `cp-${yearPlanA.id}`,
    academicSettingId: yearPlanA.id,
    generalDescription: 'Capaian Pembelajaran PJOK Kelas 2',
    elements: [
      {
        id: 'elem-1',
        name: 'Terampil Bergerak',
        content: 'Peserta didik mempraktikkan keterampilan gerak fundamental.',
      },
    ],
    updatedAt: '2026-07-15T08:00:00.000Z',
  };
  activeCPA = saveCPV5(yearPlanA.id, cpPayloadA);

  // Create canonical CP Analysis for YearPlan A
  const rawAnalysisA: CPAnalysisData = {
    id: '',
    academicSettingId: '',
    cpId: '',
    generalSummary: 'Analisis elemen gerak dasar PJOK',
    items: [
      {
        id: 'ana-item-1',
        elementId: 'elem-1',
        elementName: 'Terampil Bergerak',
        cpText: 'Peserta didik mempraktikkan keterampilan gerak fundamental.',
        cpCompetence: 'Mempraktikkan, mengidentifikasi',
        materialScope: 'Pola gerak dasar lokomotor',
        meaningfulUnderstanding: 'Peserta didik menyadari pentingnya gerak tubuh.',
        suggestedTp: 'Peserta didik mampu melakukan gerak dasar lokomotor secara konsisten.',
        order: 1,
      },
    ],
    generatedBy: 'TEACHER',
    workflowStatus: 'SIAP',
    basedOnCpUpdatedAt: '',
    updatedAt: '2026-07-16T09:00:00.000Z',
  };

  // Normalization per contract
  const canonicalAnalysisA: CPAnalysisData = {
    ...rawAnalysisA,
    id: rawAnalysisA.id && rawAnalysisA.id.trim() ? rawAnalysisA.id : `cpanalysis-${yearPlanA.id}`,
    academicSettingId: yearPlanA.id,
    cpId: activeCPA.id,
    basedOnCpUpdatedAt: activeCPA.updatedAt,
  };

  savedAnalysisA = saveCPAnalysisV5(yearPlanA.id, canonicalAnalysisA);
  const runtime = getRuntimeContextV5();

  assert.ok(runtime.annualData?.cpAnalysis, 'Runtime must return cpAnalysis for active YearPlan A');
  assert.deepStrictEqual(
    runtime.annualData?.cpAnalysis,
    savedAnalysisA,
    'Runtime cpAnalysis must exactly match savedAnalysisA'
  );
});

runTest('3. Stable non-empty analysis ID', () => {
  assert.ok(savedAnalysisA.id, 'Saved analysis must have non-empty ID');
  assert.strictEqual(
    savedAnalysisA.id,
    `cpanalysis-${yearPlanA.id}`,
    'Saved analysis ID must be cpanalysis-${activeYearPlan.id}'
  );
});

runTest('4. academicSettingId === YearPlan A id', () => {
  assert.strictEqual(
    savedAnalysisA.academicSettingId,
    yearPlanA.id,
    'academicSettingId must match YearPlan A ID'
  );
  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.annualData?.cpAnalysis?.academicSettingId,
    yearPlanA.id
  );
});

runTest('5. cpId === active CP id', () => {
  assert.strictEqual(
    savedAnalysisA.cpId,
    activeCPA.id,
    'Analysis cpId must reference active CP id'
  );
  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.annualData?.cpAnalysis?.cpId,
    activeCPA.id
  );
});

runTest('6. basedOnCpUpdatedAt === active CP updatedAt', () => {
  assert.strictEqual(
    savedAnalysisA.basedOnCpUpdatedAt,
    activeCPA.updatedAt,
    'basedOnCpUpdatedAt must reference active CP updatedAt'
  );
  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.annualData?.cpAnalysis?.basedOnCpUpdatedAt,
    activeCPA.updatedAt
  );
});

runTest('7. Second save upserts same YearPlan wrapper -> no duplicate CP Analysis entry', () => {
  const updatedAnalysisA: CPAnalysisData = {
    ...savedAnalysisA,
    generalSummary: 'Updated ringkasan analisis CP',
    items: [
      ...savedAnalysisA.items,
      {
        id: 'ana-item-2',
        elementName: 'Elemen Tambahan',
        cpText: 'Konten tambahan',
        cpCompetence: 'Memahami',
        materialScope: 'Ruang gerak',
        order: 2,
      },
    ],
    updatedAt: '2026-07-17T11:00:00.000Z',
  };

  saveCPAnalysisV5(yearPlanA.id, updatedAnalysisA);

  const state = loadStorageV5();
  const entriesForA = state.annualData.cpAnalysis.filter((e) => e.yearPlanId === yearPlanA.id);
  assert.strictEqual(
    entriesForA.length,
    1,
    'Must have exactly 1 annualData.cpAnalysis wrapper for YearPlan A'
  );
  assert.strictEqual(
    state.annualData.cpAnalysis.length,
    1,
    'Total annualData.cpAnalysis length must remain 1'
  );
  assert.strictEqual(
    entriesForA[0].value.items.length,
    2,
    'Items must be updated in-place'
  );
  assert.strictEqual(
    entriesForA[0].value.id,
    `cpanalysis-${yearPlanA.id}`,
    'Analysis ID must remain stable across saves'
  );
});

let yearPlanB: any;
let activeCPB: CPData;
let savedAnalysisB: CPAnalysisData;

runTest('8. YearPlan A/B analyses remain isolated', () => {
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

  // Save CP for YearPlan B
  activeCPB = saveCPV5(yearPlanB.id, {
    id: `cp-${yearPlanB.id}`,
    academicSettingId: yearPlanB.id,
    generalDescription: 'Capaian Pembelajaran Matematika Kelas 4',
    elements: [
      {
        id: 'elem-b1',
        name: 'Bilangan',
        content: 'Peserta didik memahami konsep pecahan.',
      },
    ],
    updatedAt: '2026-07-18T08:00:00.000Z',
  });

  // Save CP Analysis for YearPlan B
  savedAnalysisB = saveCPAnalysisV5(yearPlanB.id, {
    id: `cpanalysis-${yearPlanB.id}`,
    academicSettingId: yearPlanB.id,
    cpId: activeCPB.id,
    generalSummary: 'Analisis Matematika Bilangan',
    items: [
      {
        id: 'ana-item-b1',
        elementId: 'elem-b1',
        elementName: 'Bilangan',
        cpText: 'Peserta didik memahami konsep pecahan.',
        cpCompetence: 'Memahami, mengurutkan',
        materialScope: 'Pecahan senilai',
        order: 1,
      },
    ],
    generatedBy: 'TEACHER',
    workflowStatus: 'SIAP',
    basedOnCpUpdatedAt: activeCPB.updatedAt,
    updatedAt: '2026-07-18T10:00:00.000Z',
  });

  const state = loadStorageV5();
  assert.strictEqual(
    state.annualData.cpAnalysis.length,
    2,
    'Storage must contain exactly 2 cpAnalysis entries'
  );

  const entryA = state.annualData.cpAnalysis.find((e) => e.yearPlanId === yearPlanA.id);
  const entryB = state.annualData.cpAnalysis.find((e) => e.yearPlanId === yearPlanB.id);

  assert.ok(entryA, 'Entry for YearPlan A must exist');
  assert.ok(entryB, 'Entry for YearPlan B must exist');

  assert.strictEqual(entryA?.value.generalSummary, 'Updated ringkasan analisis CP');
  assert.strictEqual(entryB?.value.generalSummary, 'Analisis Matematika Bilangan');
  assert.strictEqual(entryA?.value.items.length, 2);
  assert.strictEqual(entryB?.value.items.length, 1);
});

runTest('9. Switching active YearPlan resolves only its own CP Analysis', () => {
  // Activate YearPlan A
  setActiveYearPlanV5(yearPlanA.id);
  const runtimeA = getRuntimeContextV5();
  assert.strictEqual(runtimeA.activeYearPlan?.id, yearPlanA.id);
  assert.strictEqual(runtimeA.annualData?.cpAnalysis?.generalSummary, 'Updated ringkasan analisis CP');
  assert.strictEqual(runtimeA.annualData?.cpAnalysis?.id, `cpanalysis-${yearPlanA.id}`);
  assert.strictEqual(runtimeA.annualData?.cpAnalysis?.cpId, activeCPA.id);

  // Activate YearPlan B
  setActiveYearPlanV5(yearPlanB.id);
  const runtimeB = getRuntimeContextV5();
  assert.strictEqual(runtimeB.activeYearPlan?.id, yearPlanB.id);
  assert.strictEqual(runtimeB.annualData?.cpAnalysis?.generalSummary, 'Analisis Matematika Bilangan');
  assert.strictEqual(runtimeB.annualData?.cpAnalysis?.id, `cpanalysis-${yearPlanB.id}`);
  assert.strictEqual(runtimeB.annualData?.cpAnalysis?.cpId, activeCPB.id);
});

runTest('10. activeSemesterPlanId stays undefined', () => {
  const state = loadStorageV5();
  assert.strictEqual(
    state.activeSemesterPlanId,
    undefined,
    'Storage activeSemesterPlanId must remain undefined during all CP Analysis operations'
  );

  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.activeSemesterPlan,
    undefined,
    'Runtime activeSemesterPlan must remain undefined'
  );
});

runTest('11. V3 sentinel unchanged byte-for-byte', () => {
  const currentV3 = mockStorage.getItem(V3_STORAGE_KEY);
  assert.strictEqual(
    currentV3,
    v3Sentinel,
    'Legacy V3 storage must remain strictly byte-for-byte unchanged'
  );
});

runTest('12. App source wires handleSaveCPAnalysis -> saveCPAnalysisV5 -> refreshV5', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  // Verify saveCPAnalysisV5 is imported from ./services/storageV5
  assert.ok(
    /import\s*\{[^}]*saveCPAnalysisV5[^}]*\}\s*from\s*['"]\.\/services\/storageV5['"]/.test(appSource),
    'App.tsx must import saveCPAnalysisV5 from ./services/storageV5'
  );

  const startIndex = appSource.indexOf('const handleSaveCPAnalysis = (analysis: CPAnalysisData) => {');
  assert.ok(startIndex !== -1, 'handleSaveCPAnalysis function must be defined in App.tsx');
  const endIndex = appSource.indexOf('const handleSaveTP =', startIndex);
  const body = appSource.slice(startIndex, endIndex !== -1 ? endIndex : startIndex + 1000);

  assert.ok(
    body.includes('saveCPAnalysisV5(activeYearPlan.id,'),
    'handleSaveCPAnalysis must call saveCPAnalysisV5'
  );
  assert.ok(
    body.includes('refreshV5()'),
    'handleSaveCPAnalysis must call refreshV5()'
  );
  assert.ok(
    body.includes('`cpanalysis-${activeYearPlan.id}`'),
    'handleSaveCPAnalysis must normalize id to cpanalysis-${activeYearPlan.id}'
  );
  assert.ok(
    body.includes('academicSettingId: activeYearPlan.id'),
    'handleSaveCPAnalysis must set academicSettingId to activeYearPlan.id'
  );
  assert.ok(
    body.includes('cpId: persistedCP.id'),
    'handleSaveCPAnalysis must set cpId to active persisted CP id'
  );
  assert.ok(
    body.includes('basedOnCpUpdatedAt: persistedCP.updatedAt'),
    'handleSaveCPAnalysis must set basedOnCpUpdatedAt to active persisted CP updatedAt'
  );
});

console.log(`\n========================================`);
console.log(`MERDEKA V5 CP ANALYSIS RUNTIME: ALL ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`========================================\n`);
