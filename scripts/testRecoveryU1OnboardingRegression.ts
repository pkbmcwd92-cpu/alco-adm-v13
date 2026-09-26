import assert from 'node:assert';

// Mock localStorage in Node.js environment
const memoryStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = value;
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    },
  };
}

import {
  saveAcademicSetting,
  createWorkspace,
  loadAppStorage,
  saveAppStorage,
  saveProfile,
} from '../src/services/storage';
import {
  getCurriculumTypeFromSetting,
  isK13,
} from '../src/services/curriculumRouter';
import {
  buildAdministrationContext,
  validateWorkflowDependencies,
} from '../src/services/workflowEngine';
import { getSubjectJP } from '../src/services/jpEngine';
import { lookupOfficialWeeklyJP } from '../src/services/curriculumRules';
import { getPhaseFromGrade } from '../src/data/curriculumDefaults';
import { AcademicSetting, TeacherProfile } from '../src/types';

console.log('=== RUNNING RECOVERY U1.1 ONBOARDING CONTRACT HARDENING REGRESSION ===\n');

let passedTests = 0;
let totalTests = 0;

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

// Reset storage to a clean state for testing
function setupCleanStorage() {
  saveAppStorage({
    profiles: [],
    schools: [],
    academicSettings: [],
    workspaces: [],
    activeProfileId: '',
    activeWorkspaceId: '',
    cps: [],
    cpAnalyses: [],
    tps: [],
    atps: [],
    k13Analyses: [],
    k13KKMs: [],
  } as any);
}

// Case U1.1-A: Zero-profile state does not crash validateWorkflowDependencies and fails closed
runTest('Case U1.1-A: Zero-profile state fails closed without throwing', () => {
  const result = validateWorkflowDependencies({
    profile: undefined,
    school: undefined,
    academicSetting: undefined,
  });

  assert.strictEqual(result.stepStates.profile.isComplete, false, 'Profile step must not be complete');
  assert.strictEqual(result.stepStates.academic.isBlocked, true, 'Academic step must be blocked without profile');
  assert.strictEqual(result.stepStates.cp.isBlocked, true, 'Downstream CP must be blocked');
});

// Case U1.1-B: Zero-profile state prevents new workspace creation
runTest('Case U1.1-B: createWorkspace throws when profile does not exist', () => {
  setupCleanStorage();
  assert.throws(
    () => {
      createWorkspace({
        profileId: 'non-existent-id',
        setting: {
          subject: 'Matematika',
        },
      });
    },
    /tidak ditemukan/,
    'Should throw error when profile does not exist'
  );

  assert.throws(
    () => {
      createWorkspace({
        profileId: '',
        setting: {
          subject: 'Matematika',
        },
      });
    },
    /tidak ditemukan/,
    'Should throw error when profileId is empty and no active profile exists'
  );
});

// Case U1.1-C: Unresolved curriculum evaluates to undefined, never guessing KURIKULUM_MERDEKA
runTest('Case U1.1-C: Unresolved curriculum does not default to Merdeka', () => {
  assert.strictEqual(getCurriculumTypeFromSetting(undefined), undefined);
  assert.strictEqual(getCurriculumTypeFromSetting(null as any), undefined);
  assert.strictEqual(getCurriculumTypeFromSetting({ curriculum: '' }), undefined);
  assert.strictEqual(getCurriculumTypeFromSetting({ curriculum: 'Kurikulum Internasional' }), undefined);
  assert.strictEqual(getCurriculumTypeFromSetting({ curriculum: 'Custom Syllabus' }), undefined);

  // Exact canonical names
  assert.strictEqual(getCurriculumTypeFromSetting({ curriculum: 'Kurikulum Merdeka' }), 'KURIKULUM_MERDEKA');
  assert.strictEqual(getCurriculumTypeFromSetting({ curriculum: 'Kurikulum 2013' }), 'K13');
  assert.strictEqual(getCurriculumTypeFromSetting({ curriculumType: 'K13' }), 'K13');
  assert.strictEqual(getCurriculumTypeFromSetting({ curriculumType: 'KURIKULUM_MERDEKA' }), 'KURIKULUM_MERDEKA');
});

// Case U1.1-D: isK13 returns false for unresolved/unknown curriculum
runTest('Case U1.1-D: isK13 is false for unknown curriculum', () => {
  assert.strictEqual(isK13(undefined), false);
  assert.strictEqual(isK13({ curriculum: 'Unknown' }), false);
  assert.strictEqual(isK13({ curriculum: '' }), false);
  assert.strictEqual(isK13({ curriculum: 'Kurikulum Merdeka' }), false);
  assert.strictEqual(isK13({ curriculum: 'Kurikulum 2013' }), true);
});

// Case U1.1-E: buildAdministrationContext sets status UNRESOLVED when curriculum is missing
runTest('Case U1.1-E: buildAdministrationContext fail-closed on unknown curriculum', () => {
  const ctx = buildAdministrationContext({
    academicSetting: {
      id: 'acad-1',
      profileId: 'prof-1',
      curriculum: 'Kurikulum Tidak Dikenal',
      level: 'SMP',
      grade: 'Kelas 7',
      subject: 'Matematika',
      academicYear: '2026/2027',
      semester: '1 (Ganjil)',
    } as any,
    profile: { id: 'prof-1', name: 'Guru Test', schoolId: 'sch-1' } as any,
    school: { id: 'sch-1', name: 'SMP Negeri 1' } as any,
  });

  assert.strictEqual(ctx.curriculumResolutionStatus, 'UNRESOLVED');
  assert.strictEqual(ctx.curriculumType, undefined);
  assert.ok(ctx.unresolvedReason?.includes('Kurikulum'), 'unresolvedReason must cite curriculum');
});

// Case U1.1-F: Phase derivation fails closed without assuming SD or defaults
runTest('Case U1.1-F: getPhaseFromGrade returns empty string for missing or invalid level/grade', () => {
  assert.strictEqual(getPhaseFromGrade('', ''), '');
  assert.strictEqual(getPhaseFromGrade('SD', ''), '');
  assert.strictEqual(getPhaseFromGrade('', 'Kelas 1'), '');
  assert.strictEqual(getPhaseFromGrade('PAUD', 'Kelas 1'), '', 'Unknown level must not map to phase');
  assert.strictEqual(getPhaseFromGrade('SD', 'Kelas 1'), 'Fase A');
  assert.strictEqual(getPhaseFromGrade('SD', 'Kelas 4'), 'Fase B');
  assert.strictEqual(getPhaseFromGrade('SMP', 'Kelas 7'), 'Fase D');
  assert.strictEqual(getPhaseFromGrade('SMA', 'Kelas 10'), 'Fase E');
  assert.strictEqual(getPhaseFromGrade('SMA', 'Kelas 11'), 'Fase F');
  assert.strictEqual(getPhaseFromGrade('SMK', 'Kelas 10'), 'Fase E');
});

// Case U1.1-G: Save failure propagation on orphan AcademicSetting
runTest('Case U1.1-G: saveAcademicSetting returns false for orphan setting', () => {
  setupCleanStorage();
  const orphanSetting: AcademicSetting = {
    id: 'orphan-setting-99',
    profileId: 'p1',
    curriculum: 'Kurikulum Merdeka',
    level: 'SD',
    grade: 'Kelas 1',
    phase: 'Fase A',
    subject: 'Bahasa Indonesia',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    updatedAt: new Date().toISOString(),
  };

  const result = saveAcademicSetting(orphanSetting);
  assert.strictEqual(result, false, 'Saving an orphan setting without a linked workspace must return false');

  const storage = loadAppStorage();
  assert.strictEqual(storage.academicSettings.length, 0, 'Orphan setting must not be saved in storage');
});

// Case U1.1-H: Save success propagation for workspace setting
runTest('Case U1.1-H: saveAcademicSetting returns true when workspace exists', () => {
  setupCleanStorage();

  // Create valid profile and workspace first
  const profile: TeacherProfile = {
    id: 'prof-valid-1',
    name: 'Budi Guru',
    nip: '19850101',
    status: 'PNS',
    schoolId: 'sch-1',
    defaultLevel: 'SMP',
    defaultSubject: 'Bahasa Indonesia',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveProfile(profile);

  const ws = createWorkspace({
    profileId: profile.id,
    setting: {
      level: 'SMP',
      grade: 'Kelas 7',
      subject: 'Bahasa Indonesia',
    },
  });

  const storage = loadAppStorage();
  const setting = storage.academicSettings.find((s) => s.id === ws.academicSettingId)!;
  assert.ok(setting, 'Setting must exist for newly created workspace');

  const updatedSetting: AcademicSetting = {
    ...setting,
    curriculum: 'Kurikulum Merdeka',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
  };

  const saveResult = saveAcademicSetting(updatedSetting);
  assert.strictEqual(saveResult, true, 'saveAcademicSetting must return true on success');

  const updatedStorage = loadAppStorage();
  const saved = updatedStorage.academicSettings.find((s) => s.id === ws.academicSettingId);
  assert.strictEqual(saved?.curriculumType, 'KURIKULUM_MERDEKA');
  assert.strictEqual(saved?.phase, 'Fase D');
});

// Case U1.1-I: buildAdministrationContext fail-closed on missing mandatory fields
runTest('Case U1.1-I: buildAdministrationContext checks mandatory school, year, semester, level, grade, subject', () => {
  // Missing school
  let ctx = buildAdministrationContext({
    academicSetting: {
      id: 'a1',
      curriculum: 'Kurikulum Merdeka',
      academicYear: '2026/2027',
      semester: '1 (Ganjil)',
      level: 'SMP',
      grade: 'Kelas 7',
      subject: 'Matematika',
    } as any,
  });
  assert.strictEqual(ctx.curriculumResolutionStatus, 'UNRESOLVED');
  assert.ok(ctx.unresolvedReason?.includes('sekolah'));

  // Missing academicYear
  ctx = buildAdministrationContext({
    academicSetting: {
      id: 'a1',
      curriculum: 'Kurikulum Merdeka',
      academicYear: '',
      semester: '1 (Ganjil)',
      level: 'SMP',
      grade: 'Kelas 7',
      subject: 'Matematika',
    } as any,
    school: { id: 's1', name: 'SMP 1' } as any,
  });
  assert.strictEqual(ctx.curriculumResolutionStatus, 'UNRESOLVED');
  assert.ok(ctx.unresolvedReason?.includes('Tahun ajaran'));

  // Missing semester
  ctx = buildAdministrationContext({
    academicSetting: {
      id: 'a1',
      curriculum: 'Kurikulum Merdeka',
      academicYear: '2026/2027',
      semester: '',
      level: 'SMP',
      grade: 'Kelas 7',
      subject: 'Matematika',
    } as any,
    school: { id: 's1', name: 'SMP 1' } as any,
  });
  assert.strictEqual(ctx.curriculumResolutionStatus, 'UNRESOLVED');
  assert.ok(ctx.unresolvedReason?.includes('Semester'));
});

// Case U1.1-J: Deterministic empty containers on Kurikulum Merdeka vs K13
runTest('Case U1.1-J: Deterministic creation of empty CP, TP, ATP containers for Merdeka', () => {
  setupCleanStorage();
  const profile: TeacherProfile = {
    id: 'prof-j-1',
    name: 'Siti Guru',
    nip: '19860101',
    status: 'PNS',
    schoolId: 'sch-1',
    defaultLevel: 'SD',
    defaultSubject: 'IPAS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveProfile(profile);

  // Create workspace with unresolved curriculum initially
  const ws = createWorkspace({
    profileId: profile.id,
    setting: {
      level: 'SD',
      grade: 'Kelas 4',
      subject: 'IPAS',
    },
  });

  let storage = loadAppStorage();
  assert.strictEqual(storage.cps.length, 0, 'No CP container before curriculum is set');
  assert.strictEqual(storage.tps.length, 0, 'No TP container before curriculum is set');
  assert.strictEqual(storage.atps.length, 0, 'No ATP container before curriculum is set');

  // Update curriculum to Kurikulum Merdeka
  const setting = storage.academicSettings.find((s) => s.id === ws.academicSettingId)!;
  saveAcademicSetting({
    ...setting,
    curriculum: 'Kurikulum Merdeka',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
  });

  storage = loadAppStorage();
  assert.strictEqual(storage.cps.length, 1, 'CP container must be created');
  assert.strictEqual(storage.cps[0].elements.length, 0, 'CP container must be empty (no fake data)');
  assert.strictEqual(storage.tps.length, 1, 'TP container must be created');
  assert.strictEqual(storage.tps[0].items.length, 0, 'TP container must be empty (no fake data)');
  assert.strictEqual(storage.atps.length, 1, 'ATP container must be created');
  assert.strictEqual(storage.atps[0].items.length, 0, 'ATP container must be empty (no fake data)');
});

// Case U1.1-K: Switching curriculum preserves existing records
runTest('Case U1.1-K: Switching curriculum preserves existing records without deleting', () => {
  setupCleanStorage();
  const profile: TeacherProfile = {
    id: 'prof-k-1',
    name: 'Ahmad Guru',
    nip: '19870101',
    status: 'PNS',
    schoolId: 'sch-1',
    defaultLevel: 'SMA',
    defaultSubject: 'Fisika',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveProfile(profile);

  const ws = createWorkspace({
    profileId: profile.id,
    setting: {
      curriculum: 'Kurikulum Merdeka',
      level: 'SMA',
      grade: 'Kelas 10',
      subject: 'Fisika',
    },
  });

  let storage = loadAppStorage();
  assert.strictEqual(storage.cps.length, 1);

  // Switch to K13
  const setting = storage.academicSettings.find((s) => s.id === ws.academicSettingId)!;
  saveAcademicSetting({
    ...setting,
    curriculum: 'Kurikulum 2013',
  });

  storage = loadAppStorage();
  // Existing Merdeka CP must NOT be destroyed
  assert.strictEqual(storage.cps.length, 1, 'Existing CP must be preserved');
  // K13 container must be initialized
  assert.strictEqual(storage.k13Analyses.length, 1, 'K13 analysis container must be created');
});

// Case U1.1-L: Unresolved JP engine returns null without fake fallbacks
runTest('Case U1.1-L: JP engine and rules return weeklyJP: null for unresolved inputs', () => {
  // getSubjectJP with unresolved curriculum
  const jp1 = getSubjectJP({
    level: 'SD',
    grade: 'Kelas 1',
    subject: 'Bahasa Indonesia',
    curriculumType: undefined as any,
  });
  assert.strictEqual(jp1.weeklyJP, null, 'weeklyJP must be null for undefined curriculum');
  assert.strictEqual(jp1.isOfficial, false);

  // getSubjectJP with unknown subject
  const jp2 = getSubjectJP({
    level: 'SD',
    grade: 'Kelas 1',
    subject: 'Mata Pelajaran Tidak Ada Di Regulasi',
    curriculumType: 'KURIKULUM_MERDEKA',
  });
  assert.strictEqual(jp2.weeklyJP, null, 'weeklyJP must be null for unknown subject');

  // lookupOfficialWeeklyJP with missing parameters
  const jp3 = lookupOfficialWeeklyJP();
  assert.strictEqual(jp3.weeklyJP, null, 'lookupOfficialWeeklyJP must return weeklyJP: null for missing parameters');

  // lookupOfficialWeeklyJP with valid inputs
  const jp4 = lookupOfficialWeeklyJP('Kurikulum Merdeka', 'SMP', 'Kelas 7', 'Bahasa Indonesia');
  assert.strictEqual(typeof jp4.weeklyJP, 'number', 'lookupOfficialWeeklyJP returns number for valid canonical subject');
  assert.ok(jp4.weeklyJP! > 0);
});

console.log(`\n=== ALL ${passedTests}/${totalTests} RECOVERY U1.1 REGRESSION TESTS PASSED! ===\n`);
