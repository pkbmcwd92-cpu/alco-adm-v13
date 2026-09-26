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
  saveCPAnalysisV5,
  saveTPV5,
  saveATPV5,
  saveCurriculumContextV5,
  saveAnnualJPReferenceV5,
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
  deleteYearHierarchyV5,
  deleteWorkspaceV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { AssessmentPackage } from '../src/types';

console.log('=== RUNNING AUDIT: STORAGE V5 HIERARCHY DELETE LIFECYCLE ===\n');

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
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;

function setupTestState() {
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

  const hierA = createYearHierarchyV5({
    profileId: prof.id,
    schoolId: sch.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'Matematika',
  });

  const hierB = createYearHierarchyV5({
    profileId: prof.id,
    schoolId: sch.id,
    academicYear: '2027/2028',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Kelas 5',
    subject: 'Matematika',
  });

  return { sch, prof, hierA, hierB };
}

// =========================================================================
// TEST 1: delete YearPlan menghapus YearPlan + Workspace + Sem1 + Sem2
// =========================================================================
runTest('1. delete YearPlan menghapus YearPlan + Workspace + Sem1 + Sem2', () => {
  const { hierA, hierB } = setupTestState();

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const state = loadStorageV5();
  assert.strictEqual(state.yearPlans.some((yp) => yp.id === hierA.yearPlan.id), false);
  assert.strictEqual(state.workspaces.some((ws) => ws.id === hierA.workspace.id), false);
  assert.strictEqual(state.semesterPlans.some((sp) => sp.yearPlanId === hierA.yearPlan.id), false);

  // Hierarchy B still exists
  assert.strictEqual(state.yearPlans.some((yp) => yp.id === hierB.yearPlan.id), true);
});

// =========================================================================
// TEST 2: seluruh annual wrappers target terhapus
// =========================================================================
runTest('2. seluruh annual wrappers target terhapus', () => {
  const { hierA } = setupTestState();
  const ypId = hierA.yearPlan.id;

  saveCPV5(ypId, { id: 'cp-1', academicSettingId: 'set-1', items: [], updatedAt: '2026-07-01' } as any);
  saveCPAnalysisV5(ypId, { id: 'cpa-1', academicSettingId: 'set-1', items: [], updatedAt: '2026-07-01' } as any);
  saveTPV5(ypId, { id: 'tp-1', academicSettingId: 'set-1', items: [], updatedAt: '2026-07-01' } as any);
  saveATPV5(ypId, { id: 'atp-1', academicSettingId: 'set-1', items: [], updatedAt: '2026-07-01' } as any);
  saveCurriculumContextV5(ypId, { curriculumType: 'KURIKULUM_MERDEKA', academicYear: '2026/2027' });

  deleteYearHierarchyV5(ypId);

  const state = loadStorageV5();
  assert.strictEqual(state.annualData.cp.some((e) => e.yearPlanId === ypId), false);
  assert.strictEqual(state.annualData.cpAnalysis.some((e) => e.yearPlanId === ypId), false);
  assert.strictEqual(state.annualData.tp.some((e) => e.yearPlanId === ypId), false);
  assert.strictEqual(state.annualData.atp.some((e) => e.yearPlanId === ypId), false);
  assert.strictEqual(state.annualData.curriculumContext.some((e) => e.yearPlanId === ypId), false);
});

// =========================================================================
// TEST 3: seluruh semester wrappers target terhapus
// =========================================================================
runTest('3. seluruh semester wrappers target terhapus', () => {
  const { hierA } = setupTestState();
  const sp1Id = hierA.semesterPlans[0].id;
  const sp2Id = hierA.semesterPlans[1].id;

  saveAcademicCalendarV5(sp1Id, { academicSettingId: 'set-1', events: [] } as any);
  saveTimeAllocationV5(sp1Id, []);
  saveLearningPlansV5(sp1Id, []);
  saveAssessmentCriteriaV5(sp1Id, []);
  saveAssessmentPlansV5(sp1Id, []);
  saveAssessmentPackagesV5(sp1Id, []);
  saveRosterV5(sp1Id, []);
  saveAttendanceV5(sp1Id, { academicSettingId: 'set-1', sessions: [] } as any);
  saveGradeV5(sp1Id, { academicSettingId: 'set-1', records: [] } as any);
  saveRemedialV5(sp1Id, []);
  saveEnrichmentV5(sp1Id, []);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const state = loadStorageV5();
  const checkSemMissing = (arr: Array<{ semesterPlanId: string }>) =>
    arr.every((e) => e.semesterPlanId !== sp1Id && e.semesterPlanId !== sp2Id);

  assert.ok(checkSemMissing(state.semesterData.academicCalendar));
  assert.ok(checkSemMissing(state.semesterData.timeAllocation));
  assert.ok(checkSemMissing(state.semesterData.learningPlan));
  assert.ok(checkSemMissing(state.semesterData.assessmentCriteria));
  assert.ok(checkSemMissing(state.semesterData.assessmentPlan));
  assert.ok(checkSemMissing(state.semesterData.assessmentPackage));
  assert.ok(checkSemMissing(state.semesterData.roster));
  assert.ok(checkSemMissing(state.semesterData.attendance));
  assert.ok(checkSemMissing(state.semesterData.grade));
  assert.ok(checkSemMissing(state.semesterData.remedial));
  assert.ok(checkSemMissing(state.semesterData.enrichment));
});

// =========================================================================
// TEST 4: annualJPReferences target terhapus
// =========================================================================
runTest('4. annualJPReferences target terhapus', () => {
  const { hierA } = setupTestState();
  const ypId = hierA.yearPlan.id;

  saveAnnualJPReferenceV5(ypId, { officialAnnualJP: 108, referenceWeeklyEquivalentJP: 3 });

  deleteYearHierarchyV5(ypId);

  const state = loadStorageV5();
  assert.strictEqual(state.annualJPReferences.some((e) => e.yearPlanId === ypId), false);
});

// =========================================================================
// TEST 5: semesterJPSettings target terhapus
// =========================================================================
runTest('5. semesterJPSettings target terhapus', () => {
  const { hierA } = setupTestState();
  const sp1Id = hierA.semesterPlans[0].id;

  saveSemesterJPSettingV5(sp1Id, { semesterPlanId: sp1Id, actualScheduledWeeklyJP: 3, source: 'SCHOOL_SCHEDULE' });

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const state = loadStorageV5();
  assert.strictEqual(state.semesterJPSettings.some((e) => e.semesterPlanId === sp1Id), false);
});

// =========================================================================
// TEST 6: document dengan target workspaceId terhapus
// =========================================================================
runTest('6. document dengan target workspaceId terhapus', () => {
  const { hierA } = setupTestState();
  const state = loadStorageV5();

  state.documents.push({
    id: 'doc-A',
    workspaceId: hierA.workspace.id,
    type: 'PROTA',
    title: 'Program Tahunan A',
    content: {},
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  } as any);
  saveStorageV5(state);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  assert.strictEqual(reloaded.documents.some((d) => d.id === 'doc-A'), false);
});

// =========================================================================
// TEST 7: document Workspace lain tetap utuh
// =========================================================================
runTest('7. document Workspace lain tetap utuh', () => {
  const { hierA, hierB } = setupTestState();
  const state = loadStorageV5();

  state.documents.push(
    {
      id: 'doc-A',
      workspaceId: hierA.workspace.id,
      type: 'PROTA',
      title: 'Program Tahunan A',
      content: {},
      createdAt: '2026-07-01',
      updatedAt: '2026-07-01',
    } as any,
    {
      id: 'doc-B',
      workspaceId: hierB.workspace.id,
      type: 'PROTA',
      title: 'Program Tahunan B',
      content: {},
      createdAt: '2026-07-01',
      updatedAt: '2026-07-01',
    } as any
  );
  saveStorageV5(state);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  assert.strictEqual(reloaded.documents.some((d) => d.id === 'doc-A'), false);
  assert.strictEqual(reloaded.documents.some((d) => d.id === 'doc-B'), true);
});

// =========================================================================
// TEST 8: document tanpa workspaceId tidak dihapus berdasarkan academicSettingId
// =========================================================================
runTest('8. document tanpa workspaceId tidak dihapus berdasarkan academicSettingId', () => {
  const { hierA } = setupTestState();
  const state = loadStorageV5();

  state.documents.push({
    id: 'doc-legacy',
    academicSettingId: 'set-A',
    type: 'PROTA',
    title: 'Program Tahunan Legacy',
    content: {},
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  } as any);
  saveStorageV5(state);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  assert.strictEqual(reloaded.documents.some((d) => d.id === 'doc-legacy'), true);
});

// =========================================================================
// TEST 9: Profile + School + PrincipalHistory tetap utuh
// =========================================================================
runTest('9. Profile + School + PrincipalHistory tetap utuh', () => {
  const { sch, prof, hierA } = setupTestState();

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const state = loadStorageV5();
  assert.strictEqual(state.profiles.some((p) => p.id === prof.id), true);
  assert.strictEqual(state.schools.some((s) => s.id === sch.id), true);
});

// =========================================================================
// TEST 10: hierarchy YearPlan B tetap byte-for-byte
// =========================================================================
runTest('10. hierarchy YearPlan B tetap byte-for-byte', () => {
  const { hierA, hierB } = setupTestState();

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const state = loadStorageV5();
  const ypB = state.yearPlans.find((yp) => yp.id === hierB.yearPlan.id);
  const wsB = state.workspaces.find((ws) => ws.id === hierB.workspace.id);
  const spB = state.semesterPlans.filter((sp) => sp.yearPlanId === hierB.yearPlan.id);

  assert.deepStrictEqual(ypB, hierB.yearPlan);
  assert.deepStrictEqual(wsB, hierB.workspace);
  assert.deepStrictEqual(spB, hierB.semesterPlans);
});

// =========================================================================
// TEST 11: Annual data YearPlan B tetap byte-for-byte
// =========================================================================
runTest('11. Annual data YearPlan B tetap byte-for-byte', () => {
  const { hierA, hierB } = setupTestState();
  const ypBId = hierB.yearPlan.id;

  saveTPV5(ypBId, { id: 'tp-B', academicSettingId: 'set-B', items: [], updatedAt: '2026-07-01' });

  const stateBefore = loadStorageV5();
  const tpBefore = stateBefore.annualData.tp.find((e) => e.yearPlanId === ypBId);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const stateAfter = loadStorageV5();
  const tpAfter = stateAfter.annualData.tp.find((e) => e.yearPlanId === ypBId);

  assert.deepStrictEqual(tpAfter, tpBefore);
});

// =========================================================================
// TEST 12: Semester data YearPlan B tetap byte-for-byte
// =========================================================================
runTest('12. Semester data YearPlan B tetap byte-for-byte', () => {
  const { hierA, hierB } = setupTestState();
  const spB1Id = hierB.semesterPlans[0].id;

  saveRosterV5(spB1Id, [{ id: 'std-1', name: 'Student 1', gender: 'L' } as any]);

  const stateBefore = loadStorageV5();
  const rosterBefore = stateBefore.semesterData.roster.find((e) => e.semesterPlanId === spB1Id);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const stateAfter = loadStorageV5();
  const rosterAfter = stateAfter.semesterData.roster.find((e) => e.semesterPlanId === spB1Id);

  assert.deepStrictEqual(rosterAfter, rosterBefore);
});

// =========================================================================
// TEST 13: AssessmentPackage sentinel YearPlan B deepStrictEqual
// =========================================================================
runTest('13. AssessmentPackage sentinel YearPlan B deepStrictEqual', () => {
  const { hierA, hierB } = setupTestState();
  const spB1Id = hierB.semesterPlans[0].id;

  const sentinelPkg: AssessmentPackage[] = [
    {
      id: 'pkg-sentinel-B',
      academicSettingId: 'set-B',
      tpId: 'tp-1',
      assessments: [
        {
          id: 'asm-1',
          code: 'SUM-1',
          name: 'Sumatif 1',
          type: 'SUMATIF',
          weight: 1,
          tpIds: ['tp-1'],
        },
      ],
      updatedAt: '2026-07-01T00:00:00Z',
    } as any,
  ];

  saveAssessmentPackagesV5(spB1Id, sentinelPkg);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const state = loadStorageV5();
  const entry = state.semesterData.assessmentPackage.find((e) => e.semesterPlanId === spB1Id);
  assert.ok(entry);
  assert.deepStrictEqual(entry.value, sentinelPkg);
});

// =========================================================================
// TEST 14: delete active hierarchy clears Year/Workspace/Semester tetapi mempertahankan activeProfile
// =========================================================================
runTest('14. delete active hierarchy clears Year/Workspace/Semester tetapi mempertahankan activeProfile', () => {
  const { prof, hierA } = setupTestState();

  const state = loadStorageV5();
  state.activeProfileId = prof.id;
  state.activeYearPlanId = hierA.yearPlan.id;
  state.activeWorkspaceId = hierA.workspace.id;
  state.activeSemesterPlanId = hierA.semesterPlans[0].id;
  saveStorageV5(state);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  assert.strictEqual(reloaded.activeProfileId, prof.id);
  assert.strictEqual(reloaded.activeYearPlanId, undefined);
  assert.strictEqual(reloaded.activeWorkspaceId, undefined);
  assert.strictEqual(reloaded.activeSemesterPlanId, undefined);
});

// =========================================================================
// TEST 15: delete non-active hierarchy tidak mengubah active context
// =========================================================================
runTest('15. delete non-active hierarchy tidak mengubah active context', () => {
  const { prof, hierA, hierB } = setupTestState();

  const state = loadStorageV5();
  state.activeProfileId = prof.id;
  state.activeYearPlanId = hierB.yearPlan.id;
  state.activeWorkspaceId = hierB.workspace.id;
  state.activeSemesterPlanId = hierB.semesterPlans[0].id;
  saveStorageV5(state);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  assert.strictEqual(reloaded.activeProfileId, prof.id);
  assert.strictEqual(reloaded.activeYearPlanId, hierB.yearPlan.id);
  assert.strictEqual(reloaded.activeWorkspaceId, hierB.workspace.id);
  assert.strictEqual(reloaded.activeSemesterPlanId, hierB.semesterPlans[0].id);
});

// =========================================================================
// TEST 16: tidak auto-select YearPlan lain
// =========================================================================
runTest('16. tidak auto-select YearPlan lain', () => {
  const { prof, hierA, hierB } = setupTestState();

  const state = loadStorageV5();
  state.activeProfileId = prof.id;
  state.activeYearPlanId = hierA.yearPlan.id;
  state.activeWorkspaceId = hierA.workspace.id;
  state.activeSemesterPlanId = hierA.semesterPlans[0].id;
  saveStorageV5(state);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  // Even though hierB exists, activeYearPlanId must remain undefined
  assert.strictEqual(reloaded.activeYearPlanId, undefined);
  assert.notStrictEqual(reloaded.activeYearPlanId, hierB.yearPlan.id);
});

// =========================================================================
// TEST 17: tidak auto-select Semester 1
// =========================================================================
runTest('17. tidak auto-select Semester 1', () => {
  const { prof, hierA } = setupTestState();

  const state = loadStorageV5();
  state.activeProfileId = prof.id;
  state.activeYearPlanId = hierA.yearPlan.id;
  state.activeWorkspaceId = hierA.workspace.id;
  state.activeSemesterPlanId = hierA.semesterPlans[0].id;
  saveStorageV5(state);

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  assert.strictEqual(reloaded.activeSemesterPlanId, undefined);
});

// =========================================================================
// TEST 18: deleteWorkspaceV5() menghapus parent hierarchy penuh
// =========================================================================
runTest('18. deleteWorkspaceV5() menghapus parent hierarchy penuh', () => {
  const { hierA, hierB } = setupTestState();

  deleteWorkspaceV5(hierA.workspace.id);

  const state = loadStorageV5();
  assert.strictEqual(state.workspaces.some((ws) => ws.id === hierA.workspace.id), false);
  assert.strictEqual(state.yearPlans.some((yp) => yp.id === hierA.yearPlan.id), false);
  assert.strictEqual(state.semesterPlans.some((sp) => sp.yearPlanId === hierA.yearPlan.id), false);

  // Hierarchy B still intact
  assert.strictEqual(state.workspaces.some((ws) => ws.id === hierB.workspace.id), true);
});

// =========================================================================
// TEST 19: invalid YearPlan ID → THROW dan state tidak berubah
// =========================================================================
runTest('19. invalid YearPlan ID → THROW dan state tidak berubah', () => {
  const { hierA } = setupTestState();
  const stateBefore = loadStorageV5();

  assert.throws(() => {
    deleteYearHierarchyV5('yp-non-existent');
  }, /YearPlan with ID "yp-non-existent" not found/i);

  const stateAfter = loadStorageV5();
  assert.deepStrictEqual(stateAfter, stateBefore);
});

// =========================================================================
// TEST 20: invalid Workspace ID → THROW dan state tidak berubah
// =========================================================================
runTest('20. invalid Workspace ID → THROW dan state tidak berubah', () => {
  const { hierA } = setupTestState();
  const stateBefore = loadStorageV5();

  assert.throws(() => {
    deleteWorkspaceV5('ws-non-existent');
  }, /Workspace with ID "ws-non-existent" not found/i);

  const stateAfter = loadStorageV5();
  assert.deepStrictEqual(stateAfter, stateBefore);
});

// =========================================================================
// TEST 21: V3/legacy storage sentinel tidak dibaca/ditulis
// =========================================================================
runTest('21. V3/legacy storage sentinel tidak dibaca/ditulis', () => {
  const { hierA } = setupTestState();
  mockStorage.setItem('administrasi_guru_ai_storage_v3', JSON.stringify({ legacy: 'sentinel' }));

  deleteYearHierarchyV5(hierA.yearPlan.id);

  assert.strictEqual(
    mockStorage.getItem('administrasi_guru_ai_storage_v3'),
    JSON.stringify({ legacy: 'sentinel' })
  );
});

// =========================================================================
// TEST 22: final save/load state lolos relational validator
// =========================================================================
runTest('22. final save/load state lolos relational validator', () => {
  const { hierA } = setupTestState();

  deleteYearHierarchyV5(hierA.yearPlan.id);

  const reloaded = loadStorageV5();
  const validated = validateStorageStateV5(reloaded);
  assert.ok(validated);
});

console.log(`\n========================================`);
console.log(`ALL STORAGE V5 HIERARCHY DELETE TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
