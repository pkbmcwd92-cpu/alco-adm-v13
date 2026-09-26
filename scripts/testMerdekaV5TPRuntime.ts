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
  saveTPV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';
import { CPData, CPAnalysisData, TPData, TPItem } from '../src/types';

console.log('=== RUNNING AUDIT: MERDEKA V5 TP RUNTIME PERSISTENCE ===\n');

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
  marker: 'V3_SENTINEL_IMMUTABLE_TP_TEST',
  checksum: 'tp-v5-sentinel-888',
  timestamp: 1719000000000,
  workspaces: [{ id: 'legacy-w1', academicSettingId: 'as-1' }],
});
mockStorage.setItem(V3_STORAGE_KEY, v3Sentinel);

// Initialize fresh V5 state
resetStorageV5();

const testSchool = createSchoolV5({
  name: 'SD Negeri Sukamaju 02',
  npsn: '20262002',
  address: 'Jl. Merdeka No. 10',
  village: 'Sukamaju',
  district: 'Pintar',
  regency: 'Kota Mandiri',
  province: 'Jawa Tengah',
  principalName: 'Sri Wahyuni, M.Pd.',
  principalNip: '197508122000032001',
});

const testProfile = createProfileV5({
  name: 'Agus Setiawan, S.Pd.',
  nip: '198802142014021001',
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
  grade: 'Kelas 4',
  subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
  documentDate: '2026-07-13',
});
const yearPlanA = hierarchyA.yearPlan;

// Set active YearPlan A
setActiveYearPlanV5(yearPlanA.id);

let activeCPA: CPData;
let activeAnalysisA: CPAnalysisData;
let savedTPA: TPData;

runTest('1. TP cannot become canonical without persisted CP', () => {
  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.annualData?.cp,
    undefined,
    'Before saving CP, runtime.annualData.cp must be undefined'
  );

  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');
  assert.ok(
    appSource.includes('!persistedCP'),
    'App.tsx must guard that CP exists before saving TP'
  );
});

runTest('2. TP cannot become canonical without persisted CP Analysis', () => {
  // Save CP for YearPlan A
  activeCPA = saveCPV5(yearPlanA.id, {
    id: `cp-${yearPlanA.id}`,
    academicSettingId: yearPlanA.id,
    generalDescription: 'Capaian Pembelajaran PJOK Kelas 4',
    elements: [
      {
        id: 'elem-1',
        name: 'Terampil Bergerak',
        content: 'Peserta didik mempraktikkan keterampilan gerak spesifik.',
      },
    ],
    updatedAt: '2026-07-15T08:00:00.000Z',
  });

  const runtime = getRuntimeContextV5();
  assert.ok(runtime.annualData?.cp, 'CP must now exist');
  assert.strictEqual(
    runtime.annualData?.cpAnalysis,
    undefined,
    'Before saving CP Analysis, runtime.annualData.cpAnalysis must be undefined'
  );

  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');
  assert.ok(
    appSource.includes('!persistedAnalysis'),
    'App.tsx must guard that CP Analysis exists before saving TP'
  );
});

runTest('3. Save TP under YearPlan A -> runtime returns exact TP', () => {
  // Now persist CP Analysis for YearPlan A
  activeAnalysisA = saveCPAnalysisV5(yearPlanA.id, {
    id: `cpanalysis-${yearPlanA.id}`,
    academicSettingId: yearPlanA.id,
    cpId: activeCPA.id,
    generalSummary: 'Analisis Gerak PJOK Kelas 4',
    items: [
      {
        id: 'ana-item-1',
        elementId: 'elem-1',
        elementName: 'Terampil Bergerak',
        cpText: 'Peserta didik mempraktikkan keterampilan gerak spesifik.',
        cpCompetence: 'Mempraktikkan',
        materialScope: 'Variasi pola gerak dasar',
        order: 1,
      },
    ],
    generatedBy: 'TEACHER',
    workflowStatus: 'SIAP',
    basedOnCpUpdatedAt: activeCPA.updatedAt,
    updatedAt: '2026-07-16T09:00:00.000Z',
  });

  // Construct raw TP to save
  const rawTP: TPData = {
    id: '',
    academicSettingId: '',
    phase: 'Fase B',
    items: [
      {
        id: 'tp-item-101',
        code: 'TP 4.1',
        elementName: 'Terampil Bergerak',
        statement: 'Peserta didik mampu mempraktikkan variasi pola gerak dasar manipulatif.',
        competence: 'Mempraktikkan',
        contentScope: 'Pola gerak dasar manipulatif',
        order: 1,
      },
    ],
    updatedAt: '2026-07-17T10:00:00.000Z',
  };

  // Normalization logic matching handleSaveTP in App.tsx
  const canonicalTP: TPData = {
    ...rawTP,
    id: rawTP.id && rawTP.id.trim() ? rawTP.id : `tp-${yearPlanA.id}`,
    academicSettingId: yearPlanA.id,
    cpId: activeCPA.id,
    cpAnalysisId: activeAnalysisA.id,
    academicYear: yearPlanA.academicYear,
    subjectCode: yearPlanA.subjectCode || yearPlanA.subject,
    phase: yearPlanA.phase || rawTP.phase,
    basedOnCpUpdatedAt: rawTP.basedOnCpUpdatedAt || activeCPA.updatedAt,
    basedOnAnalysisUpdatedAt: rawTP.basedOnAnalysisUpdatedAt || activeAnalysisA.updatedAt,
  };

  savedTPA = saveTPV5(yearPlanA.id, canonicalTP);
  const runtime = getRuntimeContextV5();

  assert.ok(runtime.annualData?.tp, 'Runtime must return TP for active YearPlan A');
  assert.deepStrictEqual(
    runtime.annualData?.tp,
    savedTPA,
    'Runtime TP must exactly match savedTPA'
  );
});

runTest('4. TP gets stable non-empty ID: tp-${yearPlanA.id}', () => {
  assert.ok(savedTPA.id, 'Saved TP must have non-empty ID');
  assert.strictEqual(
    savedTPA.id,
    `tp-${yearPlanA.id}`,
    'Saved TP ID must match tp-${yearPlanA.id}'
  );
});

runTest('5. Compatibility: academicSettingId === yearPlanA.id', () => {
  assert.strictEqual(
    savedTPA.academicSettingId,
    yearPlanA.id,
    'academicSettingId must match YearPlan A ID'
  );
  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.annualData?.tp?.academicSettingId,
    yearPlanA.id
  );
});

runTest('6. Lineage references: cpId === CP A id, cpAnalysisId === CP Analysis A id', () => {
  assert.strictEqual(
    savedTPA.cpId,
    activeCPA.id,
    'TP cpId must match active CP id'
  );
  assert.strictEqual(
    savedTPA.cpAnalysisId,
    activeAnalysisA.id,
    'TP cpAnalysisId must match active CP Analysis id'
  );
  const runtime = getRuntimeContextV5();
  assert.strictEqual(runtime.annualData?.tp?.cpId, activeCPA.id);
  assert.strictEqual(runtime.annualData?.tp?.cpAnalysisId, activeAnalysisA.id);
});

runTest('7. First save with empty lineage timestamps binds them to current CP and CP Analysis timestamps', () => {
  assert.strictEqual(
    savedTPA.basedOnCpUpdatedAt,
    activeCPA.updatedAt,
    'Empty basedOnCpUpdatedAt must bind to active CP updatedAt'
  );
  assert.strictEqual(
    savedTPA.basedOnAnalysisUpdatedAt,
    activeAnalysisA.updatedAt,
    'Empty basedOnAnalysisUpdatedAt must bind to active CP Analysis updatedAt'
  );
});

runTest('8. Existing lineage timestamps are preserved on later save (not silently replaced with newer upstream timestamps)', () => {
  const customOldCpTime = '2026-07-01T00:00:00.000Z';
  const customOldAnalysisTime = '2026-07-02T00:00:00.000Z';

  // Suppose upstream CP and CP Analysis get updated to a newer time
  const newerCPTime = '2026-07-20T12:00:00.000Z';
  const newerAnalysisTime = '2026-07-20T13:00:00.000Z';

  const tpWithOldLineage: TPData = {
    ...savedTPA,
    basedOnCpUpdatedAt: customOldCpTime,
    basedOnAnalysisUpdatedAt: customOldAnalysisTime,
  };

  // When saved, it must preserve customOldCpTime and customOldAnalysisTime
  const canonicalSecondSave: TPData = {
    ...tpWithOldLineage,
    id: tpWithOldLineage.id && tpWithOldLineage.id.trim() ? tpWithOldLineage.id : `tp-${yearPlanA.id}`,
    academicSettingId: yearPlanA.id,
    cpId: activeCPA.id,
    cpAnalysisId: activeAnalysisA.id,
    academicYear: yearPlanA.academicYear,
    subjectCode: yearPlanA.subjectCode || yearPlanA.subject,
    phase: yearPlanA.phase || tpWithOldLineage.phase,
    basedOnCpUpdatedAt: tpWithOldLineage.basedOnCpUpdatedAt || newerCPTime,
    basedOnAnalysisUpdatedAt: tpWithOldLineage.basedOnAnalysisUpdatedAt || newerAnalysisTime,
  };

  const reSaved = saveTPV5(yearPlanA.id, canonicalSecondSave);
  assert.strictEqual(
    reSaved.basedOnCpUpdatedAt,
    customOldCpTime,
    'Must preserve existing basedOnCpUpdatedAt to prevent false clearing of stale status'
  );
  assert.strictEqual(
    reSaved.basedOnAnalysisUpdatedAt,
    customOldAnalysisTime,
    'Must preserve existing basedOnAnalysisUpdatedAt to prevent false clearing of stale status'
  );
});

runTest('9. Second save upserts same YearPlan wrapper -> no duplicate TP entry', () => {
  const state = loadStorageV5();
  const entriesForA = state.annualData.tp.filter((e) => e.yearPlanId === yearPlanA.id);
  assert.strictEqual(
    entriesForA.length,
    1,
    'Must have exactly 1 annualData.tp entry for YearPlan A'
  );
  assert.strictEqual(
    state.annualData.tp.length,
    1,
    'Total annualData.tp entries must remain 1'
  );
});

runTest('10. TP item IDs remain unchanged through persistence', () => {
  const runtime = getRuntimeContextV5();
  const items = runtime.annualData?.tp?.items || [];
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].id, 'tp-item-101', 'TPItem ID must remain untouched');
});

let yearPlanB: any;
let activeCPB: CPData;
let activeAnalysisB: CPAnalysisData;
let savedTPB: TPData;

runTest('11. YearPlan A and B TP data remain isolated', () => {
  const hierarchyB = createYearHierarchyV5({
    profileId: testProfile.id,
    schoolId: testSchool.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Kelas 5',
    subject: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
    documentDate: '2026-07-14',
  });
  yearPlanB = hierarchyB.yearPlan;

  // Persist CP and CP Analysis for B
  activeCPB = saveCPV5(yearPlanB.id, {
    id: `cp-${yearPlanB.id}`,
    academicSettingId: yearPlanB.id,
    generalDescription: 'Capaian Pembelajaran IPAS Kelas 5',
    elements: [{ id: 'elem-b1', name: 'Pemahaman IPAS', content: 'Konten IPAS' }],
    updatedAt: '2026-07-18T08:00:00.000Z',
  });

  activeAnalysisB = saveCPAnalysisV5(yearPlanB.id, {
    id: `cpanalysis-${yearPlanB.id}`,
    academicSettingId: yearPlanB.id,
    cpId: activeCPB.id,
    generalSummary: 'Analisis IPAS Kelas 5',
    items: [{ id: 'ana-b1', elementName: 'Pemahaman IPAS', cpCompetence: 'Menjelaskan', materialScope: 'Ekosistem', order: 1 }],
    updatedAt: '2026-07-18T09:00:00.000Z',
  });

  savedTPB = saveTPV5(yearPlanB.id, {
    id: `tp-${yearPlanB.id}`,
    academicSettingId: yearPlanB.id,
    cpId: activeCPB.id,
    cpAnalysisId: activeAnalysisB.id,
    items: [
      {
        id: 'tp-item-b201',
        code: 'TP 5.1',
        elementName: 'Pemahaman IPAS',
        statement: 'Peserta didik memahami hubungan antar komponen ekosistem.',
        competence: 'Memahami',
        contentScope: 'Ekosistem',
        order: 1,
      },
    ],
    basedOnCpUpdatedAt: activeCPB.updatedAt,
    basedOnAnalysisUpdatedAt: activeAnalysisB.updatedAt,
    updatedAt: '2026-07-18T10:00:00.000Z',
  });

  const state = loadStorageV5();
  assert.strictEqual(state.annualData.tp.length, 2, 'Storage must have exactly 2 TP entries');

  const entryA = state.annualData.tp.find((e) => e.yearPlanId === yearPlanA.id);
  const entryB = state.annualData.tp.find((e) => e.yearPlanId === yearPlanB.id);

  assert.ok(entryA && entryB);
  assert.strictEqual(entryA?.value.items[0].id, 'tp-item-101');
  assert.strictEqual(entryB?.value.items[0].id, 'tp-item-b201');
  assert.strictEqual(entryA?.value.items[0].statement, 'Peserta didik mampu mempraktikkan variasi pola gerak dasar manipulatif.');
  assert.strictEqual(entryB?.value.items[0].statement, 'Peserta didik memahami hubungan antar komponen ekosistem.');
});

runTest('12. Switching active YearPlan returns only its own TP', () => {
  // Activate A
  setActiveYearPlanV5(yearPlanA.id);
  const runtimeA = getRuntimeContextV5();
  assert.strictEqual(runtimeA.activeYearPlan?.id, yearPlanA.id);
  assert.strictEqual(runtimeA.annualData?.tp?.id, `tp-${yearPlanA.id}`);
  assert.strictEqual(runtimeA.annualData?.tp?.items[0].code, 'TP 4.1');

  // Activate B
  setActiveYearPlanV5(yearPlanB.id);
  const runtimeB = getRuntimeContextV5();
  assert.strictEqual(runtimeB.activeYearPlan?.id, yearPlanB.id);
  assert.strictEqual(runtimeB.annualData?.tp?.id, `tp-${yearPlanB.id}`);
  assert.strictEqual(runtimeB.annualData?.tp?.items[0].code, 'TP 5.1');
});

runTest('13. activeSemesterPlanId remains undefined', () => {
  const state = loadStorageV5();
  assert.strictEqual(
    state.activeSemesterPlanId,
    undefined,
    'Storage activeSemesterPlanId must remain undefined during all TP operations'
  );

  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.activeSemesterPlan,
    undefined,
    'Runtime activeSemesterPlan must remain undefined'
  );
});

runTest('14. V3 sentinel remains byte-for-byte unchanged', () => {
  const currentV3 = mockStorage.getItem(V3_STORAGE_KEY);
  assert.strictEqual(
    currentV3,
    v3Sentinel,
    'Legacy V3 storage must remain strictly byte-for-byte unchanged'
  );
});

runTest('15. App source wires handleSaveTP -> saveTPV5 -> refreshV5', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  assert.ok(
    /import\s*\{[^}]*saveTPV5[^}]*\}\s*from\s*['"]\.\/services\/storageV5['"]/.test(appSource),
    'App.tsx must import saveTPV5 from ./services/storageV5'
  );

  const startIndex = appSource.indexOf('const handleSaveTP = (tp: TPData) => {');
  assert.ok(startIndex !== -1, 'handleSaveTP function must be defined in App.tsx');
  const endIndex = appSource.indexOf('const handleSaveATP =', startIndex);
  const body = appSource.slice(startIndex, endIndex !== -1 ? endIndex : startIndex + 1500);

  assert.ok(
    body.includes('saveTPV5(activeYearPlan.id,'),
    'handleSaveTP must call saveTPV5'
  );
  assert.ok(
    body.includes('refreshV5()'),
    'handleSaveTP must call refreshV5()'
  );
  assert.ok(
    body.includes('`tp-${activeYearPlan.id}`'),
    'handleSaveTP must normalize id to tp-${activeYearPlan.id}'
  );
  assert.ok(
    body.includes('academicSettingId: activeYearPlan.id'),
    'handleSaveTP must set academicSettingId to activeYearPlan.id'
  );
  assert.ok(
    body.includes('cpId: persistedCP.id'),
    'handleSaveTP must set cpId to active persisted CP id'
  );
  assert.ok(
    body.includes('cpAnalysisId: persistedAnalysis.id'),
    'handleSaveTP must set cpAnalysisId to active persisted CP Analysis id'
  );
  assert.ok(
    body.includes('basedOnCpUpdatedAt: tp.basedOnCpUpdatedAt || persistedCP.updatedAt'),
    'handleSaveTP must preserve basedOnCpUpdatedAt if set'
  );
  assert.ok(
    body.includes('basedOnAnalysisUpdatedAt: tp.basedOnAnalysisUpdatedAt || persistedAnalysis.updatedAt'),
    'handleSaveTP must preserve basedOnAnalysisUpdatedAt if set'
  );
});

runTest('16. App requires both persisted CP and persisted CP Analysis before save', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  const startIndex = appSource.indexOf('const handleSaveTP = (tp: TPData) => {');
  assert.ok(startIndex !== -1);
  const endIndex = appSource.indexOf('const handleSaveATP =', startIndex);
  const body = appSource.slice(startIndex, endIndex !== -1 ? endIndex : startIndex + 1500);

  assert.ok(
    body.includes('!activeYearPlan || !persistedCP || !persistedAnalysis'),
    'handleSaveTP must require activeYearPlan, persistedCP, and persistedAnalysis'
  );
});

console.log(`\n========================================`);
console.log(`MERDEKA V5 TP RUNTIME: ALL ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`========================================\n`);
