import assert from 'node:assert';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  validateStorageStateV5,
  createSchoolV5,
  createProfileV5,
  createYearHierarchyV5,
  saveCPV5,
  saveTPV5,
  saveAnnualJPReferenceV5,
  saveSemesterJPSettingV5,
  saveAcademicCalendarV5,
  saveLearningPlansV5,
  saveAssessmentPackagesV5,
  saveRosterV5,
  savePrincipalHistoryV5,
  duplicateYearHierarchyV5,
  duplicateWorkspaceV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { AssessmentPackage, PrincipalHistory } from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 HIERARCHY DUPLICATE LIFECYCLE ===\n');

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
  public readCount = 0;
  public writeCount = 0;

  resetCounts(): void {
    this.readCount = 0;
    this.writeCount = 0;
  }

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
    this.resetCounts();
  }

  get length(): number {
    return this.store.size;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;

function setupTestSource() {
  resetStorageV5();

  const sch = createSchoolV5({
    name: 'SDN 01 Menteng',
    npsn: '10000001',
    address: 'Jl. Menteng',
    village: 'Menteng',
    district: 'Menteng',
    regency: 'Jakarta Pusat',
    province: 'DKI Jakarta',
    principalName: 'Drs. Ahmad',
    principalNip: '196501011990011001',
  });

  const prof = createProfileV5({
    name: 'Budi Santoso',
    nip: '198501012010011001',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SD',
    schoolId: sch.id,
  });

  const ph: PrincipalHistory = {
    id: 'ph-1',
    schoolId: sch.id,
    name: 'Drs. Ahmad',
    nip: '196501011990011001',
    startDate: '2024-01-01',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  savePrincipalHistoryV5(ph);

  const hier = createYearHierarchyV5({
    profileId: prof.id,
    schoolId: sch.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'Matematika',
    workspaceName: 'Matematika Kelas 4',
    documentDate: '2026-07-15',
  });

  return { sch, prof, ph, hier };
}

// =========================================================================
// TEST 1: duplicate YearPlan menghasilkan YearPlan ID baru
// =========================================================================
runTest('1. duplicate YearPlan menghasilkan YearPlan ID baru', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.notStrictEqual(dup.yearPlan.id, hier.yearPlan.id);
  assert.ok(dup.yearPlan.id.startsWith('yp-'));
});

// =========================================================================
// TEST 2: menghasilkan Workspace baru
// =========================================================================
runTest('2. menghasilkan Workspace baru', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.notStrictEqual(dup.workspace.id, hier.workspace.id);
  assert.strictEqual(dup.workspace.yearPlanId, dup.yearPlan.id);
  assert.ok(dup.workspace.id.startsWith('ws-'));
});

// =========================================================================
// TEST 3: menghasilkan tepat Sem1 + Sem2 baru
// =========================================================================
runTest('3. menghasilkan tepat Sem1 + Sem2 baru', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.strictEqual(dup.semesterPlans.length, 2);
  assert.strictEqual(dup.semesterPlans[0].semester, 1);
  assert.strictEqual(dup.semesterPlans[1].semester, 2);
  assert.notStrictEqual(dup.semesterPlans[0].id, hier.semesterPlans[0].id);
  assert.notStrictEqual(dup.semesterPlans[1].id, hier.semesterPlans[1].id);
});

// =========================================================================
// TEST 4: source hierarchy tetap byte-for-byte
// =========================================================================
runTest('4. source hierarchy tetap byte-for-byte', () => {
  const { hier } = setupTestSource();
  const stateBefore = loadStorageV5();
  const sourceYPBefore = stateBefore.yearPlans.find((yp) => yp.id === hier.yearPlan.id);
  const sourceWSBefore = stateBefore.workspaces.find((ws) => ws.id === hier.workspace.id);

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const stateAfter = loadStorageV5();
  const sourceYPAfter = stateAfter.yearPlans.find((yp) => yp.id === hier.yearPlan.id);
  const sourceWSAfter = stateAfter.workspaces.find((ws) => ws.id === hier.workspace.id);

  assert.deepStrictEqual(sourceYPAfter, sourceYPBefore);
  assert.deepStrictEqual(sourceWSAfter, sourceWSBefore);
});

// =========================================================================
// TEST 5: target memakai Profile source
// =========================================================================
runTest('5. target memakai Profile source', () => {
  const { prof, hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.strictEqual(dup.yearPlan.profileId, prof.id);
  assert.strictEqual(dup.workspace.profileId, prof.id);
});

// =========================================================================
// TEST 6: target memakai School source
// =========================================================================
runTest('6. target memakai School source', () => {
  const { sch, hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.strictEqual(dup.yearPlan.schoolId, sch.id);
  assert.strictEqual(dup.workspace.schoolId, sch.id);
});

// =========================================================================
// TEST 7: target default identity sama dengan source kecuali ID/timestamp
// =========================================================================
runTest('7. target default identity sama dengan source kecuali ID/timestamp', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.strictEqual(dup.yearPlan.grade, hier.yearPlan.grade);
  assert.strictEqual(dup.yearPlan.subject, hier.yearPlan.subject);
  assert.strictEqual(dup.yearPlan.curriculumType, hier.yearPlan.curriculumType);
  assert.strictEqual(dup.yearPlan.level, hier.yearPlan.level);
  assert.strictEqual(dup.workspace.documentDate, hier.workspace.documentDate);
});

// =========================================================================
// TEST 8: duplicate tanpa override exact identity → FAIL karena tuple collision
// =========================================================================
runTest('8. duplicate tanpa override exact identity → FAIL karena tuple collision', () => {
  const { hier } = setupTestSource();

  assert.throws(() => {
    duplicateYearHierarchyV5(hier.yearPlan.id);
  }, /Duplicate YearPlan/i);
});

// =========================================================================
// TEST 9: override classSection membuat valid hierarchy baru
// =========================================================================
runTest('9. override classSection membuat valid hierarchy baru', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { classSection: '4A' });

  assert.strictEqual(dup.yearPlan.classSection, '4A');
});

// =========================================================================
// TEST 10: override academicYear membuat hierarchy baru
// =========================================================================
runTest('10. override academicYear membuat hierarchy baru', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2028/2029' });

  assert.strictEqual(dup.yearPlan.academicYear, '2028/2029');
});

// =========================================================================
// TEST 11: override grade + subject diterapkan
// =========================================================================
runTest('11. override grade + subject diterapkan', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, {
    grade: 'Kelas 5',
    subject: 'IPA',
  });

  assert.strictEqual(dup.yearPlan.grade, 'Kelas 5');
  assert.strictEqual(dup.yearPlan.subject, 'IPA');
});

// =========================================================================
// TEST 12: duplicate final tuple yang sudah ada → FAIL
// =========================================================================
runTest('12. duplicate final tuple yang sudah ada → FAIL', () => {
  const { hier } = setupTestSource();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.throws(() => {
    duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });
  }, /Duplicate YearPlan/i);
});

// =========================================================================
// TEST 13: duplicateWorkspaceV5() menghasilkan hierarchy baru
// =========================================================================
runTest('13. duplicateWorkspaceV5() menghasilkan hierarchy baru, bukan Workspace kedua pada source YearPlan', () => {
  const { hier } = setupTestSource();

  const dup = duplicateWorkspaceV5(hier.workspace.id, { academicYear: '2027/2028' });

  assert.notStrictEqual(dup.workspace.id, hier.workspace.id);
  assert.notStrictEqual(dup.yearPlan.id, hier.yearPlan.id);
});

// =========================================================================
// TEST 14: target YearPlan memiliki tepat 1 Workspace
// =========================================================================
runTest('14. target YearPlan memiliki tepat 1 Workspace', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  const targetWS = state.workspaces.filter((ws) => ws.yearPlanId === dup.yearPlan.id);
  assert.strictEqual(targetWS.length, 1);
});

// =========================================================================
// TEST 15: source YearPlan tetap tepat 1 Workspace
// =========================================================================
runTest('15. source YearPlan tetap tepat 1 Workspace', () => {
  const { hier } = setupTestSource();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  const sourceWS = state.workspaces.filter((ws) => ws.yearPlanId === hier.yearPlan.id);
  assert.strictEqual(sourceWS.length, 1);
});

// =========================================================================
// TEST 16: target Semester 1/2 IDs berbeda dari source
// =========================================================================
runTest('16. target Semester 1/2 IDs berbeda dari source', () => {
  const { hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.notStrictEqual(dup.semesterPlans[0].id, hier.semesterPlans[0].id);
  assert.notStrictEqual(dup.semesterPlans[1].id, hier.semesterPlans[1].id);
});

// =========================================================================
// TEST 17: active context berpindah ke target YearPlan/Workspace
// =========================================================================
runTest('17. active context berpindah ke target YearPlan/Workspace', () => {
  const { prof, hier } = setupTestSource();

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.activeProfileId, prof.id);
  assert.strictEqual(state.activeYearPlanId, dup.yearPlan.id);
  assert.strictEqual(state.activeWorkspaceId, dup.workspace.id);
});

// =========================================================================
// TEST 18: activeSemesterPlanId === undefined
// =========================================================================
runTest('18. activeSemesterPlanId === undefined', () => {
  const { hier } = setupTestSource();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.activeSemesterPlanId, undefined);
});

// =========================================================================
// TEST 19: tidak auto-select Semester 1
// =========================================================================
runTest('19. tidak auto-select Semester 1', () => {
  const { hier } = setupTestSource();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.activeSemesterPlanId, undefined);
});

// =========================================================================
// TEST 20: annualData source tidak dicopy
// =========================================================================
runTest('20. annualData source tidak dicopy', () => {
  const { hier } = setupTestSource();
  const sourceYPId = hier.yearPlan.id;

  saveCPV5(sourceYPId, { id: 'cp-1', academicSettingId: 'set-1', items: [], updatedAt: '2026-07-01' } as any);
  saveTPV5(sourceYPId, { id: 'tp-1', academicSettingId: 'set-1', items: [], updatedAt: '2026-07-01' } as any);

  const dup = duplicateYearHierarchyV5(sourceYPId, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.annualData.cp.some((e) => e.yearPlanId === dup.yearPlan.id), false);
  assert.strictEqual(state.annualData.tp.some((e) => e.yearPlanId === dup.yearPlan.id), false);
});

// =========================================================================
// TEST 21: annualJPReference tidak dicopy
// =========================================================================
runTest('21. annualJPReference tidak dicopy', () => {
  const { hier } = setupTestSource();
  const sourceYPId = hier.yearPlan.id;

  saveAnnualJPReferenceV5(sourceYPId, { officialAnnualJP: 108, referenceWeeklyEquivalentJP: 3 });

  const dup = duplicateYearHierarchyV5(sourceYPId, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.annualJPReferences.some((e) => e.yearPlanId === dup.yearPlan.id), false);
});

// =========================================================================
// TEST 22: semesterJPSetting tidak dicopy
// =========================================================================
runTest('22. semesterJPSetting tidak dicopy', () => {
  const { hier } = setupTestSource();
  const sp1Id = hier.semesterPlans[0].id;

  saveSemesterJPSettingV5(sp1Id, { semesterPlanId: sp1Id, actualScheduledWeeklyJP: 3, source: 'SCHOOL_SCHEDULE' });

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.semesterJPSettings.some((e) => e.semesterPlanId === dup.semesterPlans[0].id), false);
});

// =========================================================================
// TEST 23: roster tidak dicopy
// =========================================================================
runTest('23. roster tidak dicopy', () => {
  const { hier } = setupTestSource();
  const sp1Id = hier.semesterPlans[0].id;

  saveRosterV5(sp1Id, [{ id: 'std-1', name: 'Student 1', gender: 'L' } as any]);

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.semesterData.roster.some((e) => e.semesterPlanId === dup.semesterPlans[0].id), false);
});

// =========================================================================
// TEST 24: AcademicCalendar tidak dicopy
// =========================================================================
runTest('24. AcademicCalendar tidak dicopy', () => {
  const { hier } = setupTestSource();
  const sp1Id = hier.semesterPlans[0].id;

  saveAcademicCalendarV5(sp1Id, { academicSettingId: 'set-1', events: [] } as any);

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.semesterData.academicCalendar.some((e) => e.semesterPlanId === dup.semesterPlans[0].id), false);
});

// =========================================================================
// TEST 25: LearningPlan tidak dicopy
// =========================================================================
runTest('25. LearningPlan tidak dicopy', () => {
  const { hier } = setupTestSource();
  const sp1Id = hier.semesterPlans[0].id;

  saveLearningPlansV5(sp1Id, []);

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.semesterData.learningPlan.some((e) => e.semesterPlanId === dup.semesterPlans[0].id), false);
});

// =========================================================================
// TEST 26: AssessmentPackage tidak dicopy
// =========================================================================
runTest('26. AssessmentPackage tidak dicopy', () => {
  const { hier } = setupTestSource();
  const sp1Id = hier.semesterPlans[0].id;

  const pkg: AssessmentPackage[] = [
    {
      id: 'pkg-1',
      academicSettingId: 'set-1',
      assessments: [],
      updatedAt: '2026-07-01T00:00:00Z',
    } as any,
  ];

  saveAssessmentPackagesV5(sp1Id, pkg);

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  assert.strictEqual(state.semesterData.assessmentPackage.some((e) => e.semesterPlanId === dup.semesterPlans[0].id), false);
});

// =========================================================================
// TEST 27: source AssessmentPackage deepStrictEqual
// =========================================================================
runTest('27. source AssessmentPackage deepStrictEqual', () => {
  const { hier } = setupTestSource();
  const sp1Id = hier.semesterPlans[0].id;

  const pkg: AssessmentPackage[] = [
    {
      id: 'pkg-1',
      academicSettingId: 'set-1',
      assessments: [],
      updatedAt: '2026-07-01T00:00:00Z',
    } as any,
  ];

  saveAssessmentPackagesV5(sp1Id, pkg);

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  const entry = state.semesterData.assessmentPackage.find((e) => e.semesterPlanId === sp1Id);
  assert.ok(entry);
  assert.deepStrictEqual(entry.value, pkg);
});

// =========================================================================
// TEST 28: documents tidak dicopy
// =========================================================================
runTest('28. documents tidak dicopy', () => {
  const { hier } = setupTestSource();

  const stateBefore = loadStorageV5();
  stateBefore.documents.push({
    id: 'doc-source',
    workspaceId: hier.workspace.id,
    type: 'PROTA',
    title: 'Program Tahunan',
    content: {},
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  } as any);
  saveStorageV5(stateBefore);

  const dup = duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const stateAfter = loadStorageV5();
  assert.strictEqual(stateAfter.documents.some((d) => d.workspaceId === dup.workspace.id), false);
});

// =========================================================================
// TEST 29: PrincipalHistory deepStrictEqual
// =========================================================================
runTest('29. PrincipalHistory deepStrictEqual', () => {
  const { ph, hier } = setupTestSource();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const state = loadStorageV5();
  const phAfter = state.principalHistories.find((p) => p.id === ph.id);
  assert.deepStrictEqual(phAfter, ph);
});

// =========================================================================
// TEST 30: invalid source YearPlan → THROW, state unchanged
// =========================================================================
runTest('30. invalid source YearPlan → THROW, state unchanged', () => {
  setupTestSource();
  const stateBefore = loadStorageV5();

  assert.throws(() => {
    duplicateYearHierarchyV5('yp-non-existent');
  }, /Source YearPlan with ID "yp-non-existent" not found/i);

  const stateAfter = loadStorageV5();
  assert.deepStrictEqual(stateAfter, stateBefore);
});

// =========================================================================
// TEST 31: invalid source Workspace → THROW, state unchanged
// =========================================================================
runTest('31. invalid source Workspace → THROW, state unchanged', () => {
  setupTestSource();
  const stateBefore = loadStorageV5();

  assert.throws(() => {
    duplicateWorkspaceV5('ws-non-existent');
  }, /Workspace with ID "ws-non-existent" not found/i);

  const stateAfter = loadStorageV5();
  assert.deepStrictEqual(stateAfter, stateBefore);
});

// =========================================================================
// TEST 32: K13 source → THROW, state unchanged
// =========================================================================
runTest('32. K13 source → THROW, state unchanged', () => {
  const { hier } = setupTestSource();

  const state = loadStorageV5();
  const yp = state.yearPlans.find((y) => y.id === hier.yearPlan.id)!;
  yp.curriculumType = 'K13' as any;
  saveStorageV5(state);

  const stateBefore = loadStorageV5();

  assert.throws(() => {
    duplicateYearHierarchyV5(hier.yearPlan.id);
  }, /K13 hierarchy duplication is not supported/i);

  const stateAfter = loadStorageV5();
  assert.deepStrictEqual(stateAfter, stateBefore);
});

// =========================================================================
// TEST 33: V3 legacy sentinel tidak dibaca/ditulis
// =========================================================================
runTest('33. V3 legacy sentinel tidak dibaca/ditulis', () => {
  const { hier } = setupTestSource();
  mockStorage.setItem('administrasi_guru_ai_storage_v3', JSON.stringify({ legacy: 'sentinel' }));

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.strictEqual(
    mockStorage.getItem('administrasi_guru_ai_storage_v3'),
    JSON.stringify({ legacy: 'sentinel' })
  );
});

// =========================================================================
// TEST 34: final state lolos validateStorageStateV5
// =========================================================================
runTest('34. final state lolos validateStorageStateV5', () => {
  const { hier } = setupTestSource();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const reloaded = loadStorageV5();
  const validated = validateStorageStateV5(reloaded);
  assert.ok(validated);
});

// =========================================================================
// TEST 35: save/load deepStrictEqual
// =========================================================================
runTest('35. save/load deepStrictEqual', () => {
  const { hier } = setupTestSource();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  const savedState = loadStorageV5();
  const jsonStr = JSON.stringify(savedState);
  mockStorage.setItem(STORAGE_KEY_V5, jsonStr);

  const reloaded = loadStorageV5();
  assert.deepStrictEqual(reloaded, savedState);
});

// =========================================================================
// TEST 36: duplicateYearHierarchyV5 success → 1 read, 1 write
// =========================================================================
runTest('36. duplicateYearHierarchyV5 success → 1 read, 1 write', () => {
  const { hier } = setupTestSource();
  mockStorage.resetCounts();

  duplicateYearHierarchyV5(hier.yearPlan.id, { academicYear: '2027/2028' });

  assert.strictEqual(mockStorage.readCount, 1);
  assert.strictEqual(mockStorage.writeCount, 1);
});

// =========================================================================
// TEST 37: duplicateWorkspaceV5 success → 1 read, 1 write
// =========================================================================
runTest('37. duplicateWorkspaceV5 success → 1 read, 1 write', () => {
  const { hier } = setupTestSource();
  mockStorage.resetCounts();

  duplicateWorkspaceV5(hier.workspace.id, { academicYear: '2027/2028' });

  assert.strictEqual(mockStorage.readCount, 1);
  assert.strictEqual(mockStorage.writeCount, 1);
});

// =========================================================================
// TEST 38: invalid workspace → 1 read, 0 write
// =========================================================================
runTest('38. invalid workspace → 1 read, 0 write', () => {
  setupTestSource();
  mockStorage.resetCounts();

  assert.throws(() => {
    duplicateWorkspaceV5('ws-non-existent');
  }, /Workspace with ID "ws-non-existent" not found/i);

  assert.strictEqual(mockStorage.readCount, 1);
  assert.strictEqual(mockStorage.writeCount, 0);
});

// =========================================================================
// TEST 39: duplicate collision → 1 read, 0 write
// =========================================================================
runTest('39. duplicate collision → 1 read, 0 write', () => {
  const { hier } = setupTestSource();
  mockStorage.resetCounts();

  assert.throws(() => {
    duplicateYearHierarchyV5(hier.yearPlan.id);
  }, /Duplicate YearPlan/i);

  assert.strictEqual(mockStorage.readCount, 1);
  assert.strictEqual(mockStorage.writeCount, 0);
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 HIERARCHY DUPLICATE TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
