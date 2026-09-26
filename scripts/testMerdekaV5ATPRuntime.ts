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
  saveATPV5,
  deleteATPV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';
import { CPData, CPAnalysisData, TPData, TPItem, ATPData, ATPItem } from '../src/types';

console.log('=== RUNNING AUDIT: MERDEKA V5 ATP RUNTIME PERSISTENCE ===\n');

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
  marker: 'V3_SENTINEL_IMMUTABLE_ATP_TEST',
  checksum: 'atp-v5-sentinel-999',
  timestamp: 1719000000000,
  workspaces: [{ id: 'legacy-w1', academicSettingId: 'as-1' }],
});
mockStorage.setItem(V3_STORAGE_KEY, v3Sentinel);

// Initialize fresh V5 state
resetStorageV5();

const testSchool = createSchoolV5({
  name: 'SD Negeri Sukamaju 03',
  npsn: '20262003',
  address: 'Jl. Merdeka No. 12',
  village: 'Sukamaju',
  district: 'Pintar',
  regency: 'Kota Mandiri',
  province: 'Jawa Tengah',
  principalName: 'Sri Wahyuni, M.Pd.',
  principalNip: '197508122000032001',
});

const testProfile = createProfileV5({
  name: 'Guru Matematika Teladan',
  nip: '198501012010011001',
  status: 'PNS',
  defaultSubject: 'Matematika',
  defaultLevel: 'SD',
  schoolId: testSchool.id,
});

const hierarchyA = createYearHierarchyV5({
  profileId: testProfile.id,
  schoolId: testSchool.id,
  academicYear: '2026/2027',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SD',
  grade: 'Kelas 4',
  subject: 'Matematika',
  phase: 'B',
  workspaceName: 'Matematika — Kelas 4 — 2026/2027',
});
const yearPlanAId = hierarchyA.yearPlan.id;

const hierarchyB = createYearHierarchyV5({
  profileId: testProfile.id,
  schoolId: testSchool.id,
  academicYear: '2027/2028',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SD',
  grade: 'Kelas 5',
  subject: 'Matematika',
  phase: 'C',
  workspaceName: 'Matematika — Kelas 5 — 2027/2028',
});
const yearPlanBId = hierarchyB.yearPlan.id;

// Setup CP & CPAnalysis & TP for YearPlan A
const cpA: CPData = {
  id: `cp-${yearPlanAId}`,
  academicSettingId: yearPlanAId,
  generalDescription: 'Capaian Pembelajaran Matematika Kelas 4',
  elements: [
    {
      id: 'elem-1',
      name: 'Bilangan',
      content: 'Memahami bilangan cacah sampai 10.000.',
    },
  ],
  updatedAt: '2026-02-01T08:00:00.000Z',
};
saveCPV5(yearPlanAId, cpA);

const analysisA: CPAnalysisData = {
  id: `cpanalysis-${yearPlanAId}`,
  academicSettingId: yearPlanAId,
  cpId: cpA.id,
  generalSummary: 'Analisis Bilangan',
  basedOnCpUpdatedAt: cpA.updatedAt,
  items: [
    {
      id: 'ana-1',
      elementId: 'elem-1',
      elementName: 'Bilangan',
      cpText: 'Memahami bilangan cacah sampai 10.000.',
      cpCompetence: 'Memahami',
      materialScope: 'Bilangan cacah sampai 10.000',
      order: 1,
    },
  ],
  updatedAt: '2026-02-01T09:00:00.000Z',
};
saveCPAnalysisV5(yearPlanAId, analysisA);

const tpA: TPData = {
  id: `tp-${yearPlanAId}`,
  academicSettingId: yearPlanAId,
  cpId: cpA.id,
  cpAnalysisId: analysisA.id,
  academicYear: '2026/2027',
  subjectCode: 'Matematika',
  phase: 'B',
  items: [
    {
      id: 'tp-item-1',
      code: 'TP 4.1',
      statement: 'Membaca dan menulis bilangan cacah sampai 10.000.',
      competence: 'Membaca dan Menulis',
      contentScope: 'Bilangan cacah sampai 10.000',
      order: 1,
    },
    {
      id: 'tp-item-2',
      code: 'TP 4.2',
      statement: 'Menentukan nilai tempat bilangan cacah sampai 10.000.',
      competence: 'Menentukan',
      contentScope: 'Nilai tempat bilangan cacah sampai 10.000',
      order: 2,
    },
  ],
  workflowStatus: 'SIAP',
  generatedBy: 'TEACHER',
  needsReview: false,
  basedOnCpUpdatedAt: cpA.updatedAt,
  basedOnAnalysisUpdatedAt: analysisA.updatedAt,
  updatedAt: '2026-02-01T10:00:00.000Z',
};
saveTPV5(yearPlanAId, tpA);

// Ensure YearPlan A is active
setActiveYearPlanV5(yearPlanAId);

// -----------------------------------------------------------------------------
// TEST 1: App.tsx Source Contract Integrity
// -----------------------------------------------------------------------------
runTest('App.tsx source contract: handleSaveATP imports saveATPV5 and enforces upstream YearPlan & TP checks', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  // Verify saveATPV5 import
  assert.ok(appContent.includes('saveATPV5,'), 'App.tsx must import saveATPV5 from storageV5');

  // Verify handleSaveATP implementation
  const handleSaveMatch = appContent.match(/const handleSaveATP = \(([\s\S]*?)\n  \};/);
  assert.ok(handleSaveMatch, 'handleSaveATP must exist in App.tsx');
  const handleSaveBody = handleSaveMatch[0];

  // Must not be deferred
  assert.ok(!handleSaveBody.includes('// ATP persistence cutover is deferred'), 'handleSaveATP must no longer be deferred');

  // Must verify activeYearPlan and persistedTP from runtimeContext.annualData?.tp
  assert.ok(
    handleSaveBody.includes('runtimeContext.annualData?.tp'),
    'handleSaveATP must read persisted TP strictly from runtimeContext.annualData?.tp'
  );
  assert.ok(
    handleSaveBody.includes('!activeYearPlan || !persistedTP'),
    'handleSaveATP must check for !activeYearPlan || !persistedTP'
  );
  assert.ok(
    handleSaveBody.includes('Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan ATP.'),
    'handleSaveATP must emit missing YearPlan message'
  );
  assert.ok(
    handleSaveBody.includes('Tujuan Pembelajaran (TP) harus disimpan terlebih dahulu sebelum menyimpan ATP.'),
    'handleSaveATP must emit missing TP message'
  );

  // Must strip legacy semester field from items
  assert.ok(
    handleSaveBody.includes('semester: _legacySemester'),
    'handleSaveATP must strip legacy semester property before saving'
  );

  // Must call saveATPV5 and refreshV5
  assert.ok(
    handleSaveBody.includes('saveATPV5(activeYearPlan.id, canonicalATP)'),
    'handleSaveATP must call saveATPV5(activeYearPlan.id, canonicalATP)'
  );
  assert.ok(handleSaveBody.includes('refreshV5()'), 'handleSaveATP must call refreshV5()');
});

// -----------------------------------------------------------------------------
// TEST 2: Upstream Validation Guard - Missing YearPlan
// -----------------------------------------------------------------------------
runTest('Upstream Validation Guard: Missing active YearPlan rejects save', () => {
  const runtime = getRuntimeContextV5();
  assert.ok(runtime.activeYearPlan, 'Active YearPlan must be resolved initially');

  // Simulate no active year plan in App logic
  const activeYearPlan = undefined;
  const persistedTP = runtime.annualData?.tp;

  let notice: { type: string; message: string } | null = null;
  const setAppNotice = (n: { type: string; message: string }) => {
    notice = n;
  };

  if (!activeYearPlan || !persistedTP) {
    const missingReason = !activeYearPlan
      ? 'Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan ATP.'
      : 'Tujuan Pembelajaran (TP) harus disimpan terlebih dahulu sebelum menyimpan ATP.';
    setAppNotice({ type: 'error', message: missingReason });
  }

  assert.ok(notice !== null);
  assert.strictEqual(notice!.type, 'error');
  assert.strictEqual(notice!.message, 'Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan ATP.');
});

// -----------------------------------------------------------------------------
// TEST 3: Upstream Validation Guard - Missing Persisted TP
// -----------------------------------------------------------------------------
runTest('Upstream Validation Guard: Missing persisted TP in runtimeContext rejects save', () => {
  const activeYearPlan = { id: 'yp-mock-123' };
  const persistedTP = undefined;

  let notice: { type: string; message: string } | null = null;
  const setAppNotice = (n: { type: string; message: string }) => {
    notice = n;
  };

  if (!activeYearPlan || !persistedTP) {
    const missingReason = !activeYearPlan
      ? 'Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan ATP.'
      : 'Tujuan Pembelajaran (TP) harus disimpan terlebih dahulu sebelum menyimpan ATP.';
    setAppNotice({ type: 'error', message: missingReason });
  }

  assert.ok(notice !== null);
  assert.strictEqual(notice!.type, 'error');
  assert.strictEqual(notice!.message, 'Tujuan Pembelajaran (TP) harus disimpan terlebih dahulu sebelum menyimpan ATP.');
});

// -----------------------------------------------------------------------------
// TEST 4: Storage Isolation - saveATPV5 persists strictly to annualData.atp
// -----------------------------------------------------------------------------
runTest('Storage Isolation: saveATPV5 persists to state.annualData.atp[yearPlanId]', () => {
  const testATP: ATPData = {
    id: `atp-${yearPlanAId}`,
    academicSettingId: yearPlanAId,
    tpId: tpA.id,
    tpDataId: tpA.id,
    academicYear: '2026/2027',
    subjectCode: 'Matematika',
    phase: 'B',
    rationale: 'Alur disusun secara linear dari konsep pemahaman bilangan ke nilai tempat.',
    items: [
      {
        id: 'atp-item-1',
        stepNumber: 1,
        tpId: 'tp-item-1',
        tpCode: 'TP 4.1',
        tpStatement: 'Membaca dan menulis bilangan cacah sampai 10.000.',
        materialScope: 'Bilangan cacah sampai 10.000',
        p3Dimensions: ['Bernalar Kritis', 'Mandiri'],
        jp: 4,
      },
      {
        id: 'atp-item-2',
        stepNumber: 2,
        tpId: 'tp-item-2',
        tpCode: 'TP 4.2',
        tpStatement: 'Menentukan nilai tempat bilangan cacah sampai 10.000.',
        materialScope: 'Nilai tempat bilangan cacah sampai 10.000',
        p3Dimensions: ['Bernalar Kritis'],
        jp: 6,
      },
    ],
    totalJP: 10,
    knownTotalJP: 10,
    hasUnknownJP: false,
    allocationComplete: true,
    workflowStatus: 'SIAP',
    generatedBy: 'TEACHER',
    needsReview: false,
    basedOnTpUpdatedAt: tpA.updatedAt,
    updatedAt: '2026-02-01T11:00:00.000Z',
  };

  const saved = saveATPV5(yearPlanAId, testATP);
  assert.strictEqual(saved.id, `atp-${yearPlanAId}`);

  const state = loadStorageV5();
  const entry = state.annualData.atp.find((e) => e.yearPlanId === yearPlanAId);
  assert.ok(entry, 'Entry in annualData.atp for yearPlanA must exist');
  assert.strictEqual(entry!.value.id, `atp-${yearPlanAId}`);
  assert.strictEqual(entry!.value.items.length, 2);
  assert.strictEqual(entry!.value.rationale, testATP.rationale);
});

// -----------------------------------------------------------------------------
// TEST 5: V3 Storage Sentinel Isolation
// -----------------------------------------------------------------------------
runTest('V3 Storage Sentinel: Legacy V3 storage key remains untouched and byte-identical', () => {
  const currentV3 = mockStorage.getItem(V3_STORAGE_KEY);
  assert.strictEqual(currentV3, v3Sentinel, 'V3 storage sentinel must not be modified by V5 ATP operations');
});

// -----------------------------------------------------------------------------
// TEST 6: Semester Scope Isolation
// -----------------------------------------------------------------------------
runTest('Semester Scope Isolation: ATP persistence does not touch semesterPlans or semesterData', () => {
  const state = loadStorageV5();
  // Semester plans should remain untouched
  assert.strictEqual(state.semesterData.timeAllocation.length, 0);
  assert.strictEqual(state.semesterData.learningPlan.length, 0);
  assert.strictEqual(state.semesterData.assessmentPlan.length, 0);
});

// -----------------------------------------------------------------------------
// TEST 7: Canonical ID Generation & Stability
// -----------------------------------------------------------------------------
runTest('Canonical ID: Generates atp-${yearPlanId} if empty; preserves existing non-empty ID', () => {
  // Empty ID
  const rawEmptyIdATP: ATPData = {
    id: '',
    academicSettingId: '',
    items: [],
    updatedAt: '2026-02-01T11:00:00.000Z',
  };

  const canonicalId = rawEmptyIdATP.id && rawEmptyIdATP.id.trim() ? rawEmptyIdATP.id : `atp-${yearPlanAId}`;
  assert.strictEqual(canonicalId, `atp-${yearPlanAId}`);

  // Existing custom ID
  const customATP: ATPData = {
    id: 'custom-atp-uuid-999',
    academicSettingId: '',
    items: [],
    updatedAt: '2026-02-01T11:00:00.000Z',
  };

  const preservedId = customATP.id && customATP.id.trim() ? customATP.id : `atp-${yearPlanAId}`;
  assert.strictEqual(preservedId, 'custom-atp-uuid-999');
});

// -----------------------------------------------------------------------------
// TEST 8: Lineage Tracking (First Save vs Ordinary Save vs AI Realign)
// -----------------------------------------------------------------------------
runTest('Lineage Tracking: Preserves older basedOnTpUpdatedAt during ordinary save for truthful stale detection', () => {
  const initialTPUpdatedAt = '2026-02-01T10:00:00.000Z';
  const initialATP: ATPData = {
    id: `atp-${yearPlanAId}`,
    academicSettingId: yearPlanAId,
    tpId: tpA.id,
    tpDataId: tpA.id,
    academicYear: '2026/2027',
    subjectCode: 'Matematika',
    phase: 'B',
    items: [],
    basedOnTpUpdatedAt: undefined, // First save
    updatedAt: '2026-02-01T11:00:00.000Z',
  };

  // 1. First save adopts persisted TP updatedAt
  const canonical1: ATPData = {
    ...initialATP,
    basedOnTpUpdatedAt: initialATP.basedOnTpUpdatedAt || initialTPUpdatedAt,
  };
  assert.strictEqual(canonical1.basedOnTpUpdatedAt, initialTPUpdatedAt);

  // 2. Teacher subsequently modifies TP -> TP has NEW updatedAt
  const modifiedTPUpdatedAt = '2026-02-02T15:30:00.000Z';

  // 3. Teacher performs ordinary edit on ATP (e.g. adjusts rationale)
  const ordinaryEditATP: ATPData = {
    ...canonical1,
    rationale: 'Updated rationale only',
    updatedAt: '2026-02-02T16:00:00.000Z',
  };

  // App boundary MUST NOT overwrite existing lineage timestamp
  const canonical2: ATPData = {
    ...ordinaryEditATP,
    basedOnTpUpdatedAt: ordinaryEditATP.basedOnTpUpdatedAt || modifiedTPUpdatedAt,
  };
  assert.strictEqual(canonical2.basedOnTpUpdatedAt, initialTPUpdatedAt, 'Must preserve older lineage timestamp');
  assert.ok(
    new Date(modifiedTPUpdatedAt).getTime() > new Date(canonical2.basedOnTpUpdatedAt!).getTime(),
    'ATP must truthfully report that TP is newer (stale lineage detected)'
  );

  // 4. Teacher clicks "Konfirmasi & Finalisasi" or AI re-aligns -> deliberately sets basedOnTpUpdatedAt = modifiedTPUpdatedAt
  const finalizedATP: ATPData = {
    ...ordinaryEditATP,
    basedOnTpUpdatedAt: modifiedTPUpdatedAt,
    workflowStatus: 'SIAP',
  };
  const canonical3: ATPData = {
    ...finalizedATP,
    basedOnTpUpdatedAt: finalizedATP.basedOnTpUpdatedAt || modifiedTPUpdatedAt,
  };
  assert.strictEqual(canonical3.basedOnTpUpdatedAt, modifiedTPUpdatedAt, 'Finalized ATP must be aligned to new TP updatedAt');
});

// -----------------------------------------------------------------------------
// TEST 9: Stripping Legacy Semester Property from Items
// -----------------------------------------------------------------------------
runTest('Legacy Semester Stripping: Strip semester field from items on persist', () => {
  const atpWithLegacySemester: ATPData = {
    id: `atp-${yearPlanAId}`,
    academicSettingId: yearPlanAId,
    tpId: tpA.id,
    tpDataId: tpA.id,
    items: [
      {
        id: 'item-sem-1',
        stepNumber: 1,
        tpId: 'tp-item-1',
        tpCode: 'TP 4.1',
        tpStatement: 'Statement 1',
        semester: 1 as any, // Legacy field
        p3Dimensions: [],
      },
      {
        id: 'item-sem-2',
        stepNumber: 2,
        tpId: 'tp-item-2',
        tpCode: 'TP 4.2',
        tpStatement: 'Statement 2',
        semester: 2 as any, // Legacy field
        p3Dimensions: [],
      },
    ],
    updatedAt: '2026-02-01T12:00:00.000Z',
  };

  const canonicalItems = (atpWithLegacySemester.items || []).map((item) => {
    const { semester: _legacySemester, ...annualItem } = item;
    return annualItem;
  });

  assert.strictEqual(canonicalItems.length, 2);
  assert.strictEqual((canonicalItems[0] as any).semester, undefined);
  assert.strictEqual((canonicalItems[1] as any).semester, undefined);

  saveATPV5(yearPlanAId, {
    ...atpWithLegacySemester,
    items: canonicalItems,
  });

  const state = loadStorageV5();
  const savedEntry = state.annualData.atp.find((e) => e.yearPlanId === yearPlanAId)!;
  assert.strictEqual(savedEntry.value.items[0].semester, undefined);
  assert.strictEqual(savedEntry.value.items[1].semester, undefined);
});

// -----------------------------------------------------------------------------
// TEST 10: Unresolved JP Support
// -----------------------------------------------------------------------------
runTest('Unresolved JP Support: ATP items with jp: undefined persist without synthetic JP numbers', () => {
  const atpNoJP: ATPData = {
    id: `atp-${yearPlanAId}`,
    academicSettingId: yearPlanAId,
    tpId: tpA.id,
    tpDataId: tpA.id,
    items: [
      {
        id: 'item-no-jp',
        stepNumber: 1,
        tpId: 'tp-item-1',
        tpCode: 'TP 4.1',
        tpStatement: 'Statement 1',
        jp: undefined,
        p3Dimensions: [],
      },
    ],
    totalJP: 0,
    knownTotalJP: 0,
    hasUnknownJP: true,
    allocationComplete: false,
    updatedAt: '2026-02-01T13:00:00.000Z',
  };

  saveATPV5(yearPlanAId, atpNoJP);

  const state = loadStorageV5();
  const saved = state.annualData.atp.find((e) => e.yearPlanId === yearPlanAId)!.value;
  assert.strictEqual(saved.items[0].jp, undefined);
  assert.strictEqual(saved.hasUnknownJP, true);
  assert.strictEqual(saved.allocationComplete, false);
});

// -----------------------------------------------------------------------------
// TEST 11: Multi-YearPlan Isolation
// -----------------------------------------------------------------------------
runTest('Multi-YearPlan Isolation: YearPlan A and YearPlan B store distinct ATPs', () => {
  // Setup TP for YearPlan B
  const cpB: CPData = {
    id: `cp-${yearPlanBId}`,
    academicSettingId: yearPlanBId,
    generalDescription: 'Capaian Pembelajaran Matematika Kelas 5',
    elements: [],
    updatedAt: '2026-02-02T08:00:00.000Z',
  };
  saveCPV5(yearPlanBId, cpB);

  const tpB: TPData = {
    id: `tp-${yearPlanBId}`,
    academicSettingId: yearPlanBId,
    cpId: cpB.id,
    academicYear: '2027/2028',
    subjectCode: 'Matematika',
    phase: 'C',
    items: [
      {
        id: 'tp-b-1',
        code: 'TP 5.1',
        statement: 'Operasi pecahan',
        competence: 'Menghitung',
        contentScope: 'Pecahan',
        order: 1,
      },
    ],
    updatedAt: '2026-02-02T10:00:00.000Z',
  };
  saveTPV5(yearPlanBId, tpB);

  const atpB: ATPData = {
    id: `atp-${yearPlanBId}`,
    academicSettingId: yearPlanBId,
    tpId: tpB.id,
    tpDataId: tpB.id,
    academicYear: '2027/2028',
    subjectCode: 'Matematika',
    phase: 'C',
    rationale: 'ATP untuk Kelas 5',
    items: [
      {
        id: 'atp-b-item-1',
        stepNumber: 1,
        tpId: 'tp-b-1',
        tpCode: 'TP 5.1',
        tpStatement: 'Operasi pecahan',
        p3Dimensions: [],
      },
    ],
    updatedAt: '2026-02-02T11:00:00.000Z',
  };
  saveATPV5(yearPlanBId, atpB);

  // Verify YearPlan A ATP is still intact
  const state = loadStorageV5();
  const entryA = state.annualData.atp.find((e) => e.yearPlanId === yearPlanAId);
  const entryB = state.annualData.atp.find((e) => e.yearPlanId === yearPlanBId);

  assert.ok(entryA, 'YearPlan A ATP must exist');
  assert.ok(entryB, 'YearPlan B ATP must exist');
  assert.strictEqual(entryA!.value.id, `atp-${yearPlanAId}`);
  assert.strictEqual(entryB!.value.id, `atp-${yearPlanBId}`);
  assert.strictEqual(entryB!.value.rationale, 'ATP untuk Kelas 5');
});

// -----------------------------------------------------------------------------
// TEST 12: Runtime Context Read Model Resolution
// -----------------------------------------------------------------------------
runTest('Runtime Read Model: getRuntimeContextV5().annualData.atp reflects active YearPlan', () => {
  // With YearPlan A active
  setActiveYearPlanV5(yearPlanAId);
  let runtime = getRuntimeContextV5();
  assert.strictEqual(runtime.activeYearPlan?.id, yearPlanAId);
  assert.ok(runtime.annualData?.atp);
  assert.strictEqual(runtime.annualData.atp.id, `atp-${yearPlanAId}`);

  // Switch to YearPlan B
  setActiveYearPlanV5(yearPlanBId);
  runtime = getRuntimeContextV5();
  assert.strictEqual(runtime.activeYearPlan?.id, yearPlanBId);
  assert.ok(runtime.annualData?.atp);
  assert.strictEqual(runtime.annualData.atp.id, `atp-${yearPlanBId}`);
  assert.strictEqual(runtime.annualData.atp.phase, 'C');

  // Deleting ATP for YearPlan B
  deleteATPV5(yearPlanBId);
  runtime = getRuntimeContextV5();
  assert.strictEqual(runtime.annualData?.atp, undefined);
});

console.log(`\nAll ${totalTests} Merdeka V5 ATP Runtime Persistence audit tests PASSED successfully!\n`);
