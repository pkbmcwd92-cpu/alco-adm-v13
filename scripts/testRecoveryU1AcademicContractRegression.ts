/**
 * Recovery U1.3.1 Academic Readiness & Context Regression
 * Consolidates U1 academic save/routing protections with final onboarding context gates.
 */

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

import { validateAcademicSettingReadiness } from '../src/services/academicSettingReadiness';
import {
  getCurriculumTypeFromSetting,
  isK13,
  isMerdeka,
} from '../src/services/curriculumRouter';
import {
  buildAdministrationContext,
  validateWorkflowDependencies,
} from '../src/services/workflowEngine';
import { buildActiveContext } from '../src/data/curriculumDefaults';
import { APP_BUILD_ID } from '../src/config/buildInfo';
import { saveAcademicSetting, loadAppStorage, saveAppStorage } from '../src/services/storage';
import {
  AcademicSetting,
  AdministrationWorkspace,
  SchoolData,
  TeacherProfile,
} from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

function cloneSetting(overrides: Partial<AcademicSetting> = {}): AcademicSetting {
  return {
    id: 'set-u131',
    profileId: 'prof-u131',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    level: 'SMP',
    grade: 'Kelas 7',
    subject: 'Informatika',
    phase: 'Fase D',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const mockProfile: TeacherProfile = {
  id: 'prof-u131',
  name: 'Siti Guru',
  nip: '198001012005012001',
  status: 'PNS',
  schoolId: 'sch-u131',
  defaultLevel: 'SD',
  defaultSubject: 'Bahasa Indonesia',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSchool: SchoolData = {
  id: 'sch-u131',
  name: 'SMP Negeri 1',
  address: 'Jl. Merdeka',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as any;

const mockWorkspace: AdministrationWorkspace = {
  id: 'ws-u131',
  profileId: mockProfile.id,
  schoolId: mockSchool.id,
  academicSettingId: 'set-u131',
  name: 'Workspace U1.3.1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

console.log('=== RUNNING RECOVERY U1.3.1 ACADEMIC READINESS & CONTEXT REGRESSION ===\n');

assert(!validateAcademicSettingReadiness(null).valid, 'U1.3.1-A.1: Null setting is invalid');
assert(validateAcademicSettingReadiness(cloneSetting()).valid, 'U1.3.1-A.2: Canonical Merdeka SMP Kelas 7 is valid');
assert(validateAcademicSettingReadiness(cloneSetting({
  curriculum: 'Kurikulum 2013',
  curriculumType: 'K13',
  level: 'SMA',
  grade: 'Kelas 10',
  subject: 'Fisika',
  phase: '',
})).valid, 'U1.3.1-A.3: Canonical K13 SMA Kelas 10 is valid');

['2026', '2026-2027', '2026/2030', 'abc', ''].forEach((academicYear) => {
  assert(!validateAcademicSettingReadiness(cloneSetting({ academicYear })).valid, `U1.3.1-A.year: ${academicYear || '<empty>'} is invalid`);
});
assert(validateAcademicSettingReadiness(cloneSetting({ academicYear: '2026/2027' })).valid, 'U1.3.1-A.year: 2026/2027 is valid');

['1', '2', 'Ganjil', 'Genap', '1xxx', 'abc', ''].forEach((semester) => {
  assert(!validateAcademicSettingReadiness(cloneSetting({ semester: semester as any })).valid, `U1.3.1-A.semester: ${semester || '<empty>'} is invalid`);
});
['1 (Ganjil)', '2 (Genap)'].forEach((semester) => {
  assert(validateAcademicSettingReadiness(cloneSetting({ semester: semester as any })).valid, `U1.3.1-A.semester: ${semester} is valid`);
});

[
  { level: 'SD', grade: 'Kelas 4' },
  { level: 'SMP', grade: 'Kelas 7' },
  { level: 'SMA', grade: 'Kelas 10' },
].forEach(({ level, grade }) => {
  assert(validateAcademicSettingReadiness(cloneSetting({ level: level as any, grade })).valid, `U1.3.1-A.grade: ${level} ${grade} is valid`);
});

[
  { level: 'SD', grade: 'Kelas 10' },
  { level: 'SMP', grade: 'Kelas 1' },
  { level: 'SMP', grade: 'VII' },
  { level: 'SMA', grade: 'X' },
  { level: 'XYZ', grade: 'Kelas 1' },
  { level: 'SMK', grade: 'Kelas 10' },
].forEach(({ level, grade }) => {
  assert(!validateAcademicSettingReadiness(cloneSetting({ level: level as any, grade })).valid, `U1.3.1-A.grade: ${level} ${grade} is invalid`);
});

assert(
  validateAcademicSettingReadiness(cloneSetting({ subject: 'Muatan Lokal Sekolah' })).valid,
  'U1.3.1-A.subject: Custom subject remains valid academic identity'
);

const academicSettingsCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AcademicSettings.tsx'), 'utf-8');
const appCode = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
assert(academicSettingsCode.includes('validateAcademicSettingReadiness(formData)'), 'U1.3.1-B.1: AcademicSettings checks readiness before save');
assert(academicSettingsCode.includes('if (!readiness.valid)'), 'U1.3.1-B.2: AcademicSettings aborts invalid save');
assert(academicSettingsCode.includes('const storedReadiness = validateAcademicSettingReadiness(setting);'), 'U1.3.1-B.3: Unsaved modal checks stored readiness');
assert(academicSettingsCode.includes('storedReadiness.valid ?'), 'U1.3.1-B.4: Abaikan & Lanjut is readiness-gated');
assert(appCode.includes('const effectiveSetting = savedSetting || activeAcademicSetting;'), 'U1.3.1-B.5: App uses just-saved setting for routing');
assert(appCode.includes('validateAcademicSettingReadiness(effectiveSetting)'), 'U1.3.1-B.6: App validates effective setting before routing');

const initialStorage = loadAppStorage();
const testStorage = {
  ...initialStorage,
  profiles: [{ ...mockProfile }],
  schools: [{ ...mockSchool }],
  workspaces: [{ ...mockWorkspace }],
  academicSettings: [cloneSetting({ id: mockWorkspace.academicSettingId })],
};
saveAppStorage(testStorage);
const syncResult = saveAcademicSetting(cloneSetting({ id: mockWorkspace.academicSettingId, subject: 'Bahasa Indonesia' }));
assert(typeof syncResult === 'boolean' && syncResult === true, 'U1.3.1-B.7: saveAcademicSetting remains synchronous boolean');
saveAppStorage(initialStorage);

function simulateAppNextStep(savedSetting?: AcademicSetting): string | null {
  const effectiveSetting = savedSetting || cloneSetting();
  const readiness = validateAcademicSettingReadiness(effectiveSetting);
  if (!readiness.valid || !readiness.curriculumType) return null;
  if (readiness.curriculumType === 'K13') return 'k13-kd';
  if (readiness.curriculumType === 'KURIKULUM_MERDEKA') return 'cp';
  return null;
}
assert(simulateAppNextStep(cloneSetting({
  curriculum: 'Kurikulum 2013',
  curriculumType: 'K13',
  level: 'SMA',
  grade: 'Kelas 10',
  subject: 'Fisika',
})) === 'k13-kd', 'U1.3.1-B.8: K13 routes to k13-kd');
assert(simulateAppNextStep(cloneSetting()) === 'cp', 'U1.3.1-B.9: Merdeka routes to cp');
assert(getCurriculumTypeFromSetting(cloneSetting()) === 'KURIKULUM_MERDEKA', 'U1.3.1-B.10: Router still resolves Merdeka');
assert(isMerdeka(cloneSetting()) && !isK13(cloneSetting()), 'U1.3.1-B.11: Router predicates remain valid');

[
  cloneSetting({ semester: '1xxx' as any }),
  cloneSetting({ academicYear: '2026-2027' }),
].forEach((academicSetting) => {
  const readiness = validateAcademicSettingReadiness(academicSetting);
  const ctx = buildAdministrationContext({
    workspace: mockWorkspace,
    profile: mockProfile,
    school: mockSchool,
    academicSetting,
  });
  assert(!readiness.valid, `U1.3.1-C.1: Readiness invalid for ${academicSetting.semester}/${academicSetting.academicYear}`);
  assert(ctx.curriculumResolutionStatus === 'UNRESOLVED', `U1.3.1-C.2: Context unresolved for invalid setting ${academicSetting.semester}/${academicSetting.academicYear}`);
});

const missingWorkspaceCtx = buildAdministrationContext({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: cloneSetting(),
});
assert(missingWorkspaceCtx.workspaceId === '', 'U1.3.1-C.3: Missing workspace does not create synthetic workspaceId');
assert(missingWorkspaceCtx.curriculumResolutionStatus === 'UNRESOLVED', 'U1.3.1-C.4: Missing workspace cannot be resolved context');

const danglingSchoolCtx = buildAdministrationContext({
  workspace: mockWorkspace,
  profile: { ...mockProfile, schoolId: 'missing-school' },
  school: undefined,
  academicSetting: cloneSetting(),
});
assert(danglingSchoolCtx.schoolId === '', 'U1.3.1-C.5: Dangling profile.schoolId is not treated as real school data');
assert(danglingSchoolCtx.curriculumResolutionStatus === 'UNRESOLVED', 'U1.3.1-C.6: Dangling school reference keeps context unresolved');

const validAdminCtx = buildAdministrationContext({
  workspace: mockWorkspace,
  profile: mockProfile,
  school: mockSchool,
  academicSetting: cloneSetting({ subject: 'Bahasa Indonesia' }),
});
assert(validAdminCtx.workspaceId === mockWorkspace.id, 'U1.3.1-C.7: Valid context uses actual workspace id');
assert(validAdminCtx.schoolId === mockSchool.id, 'U1.3.1-C.8: Valid context uses actual school id');

const activeMissing = buildActiveContext(
  mockProfile,
  mockSchool,
  cloneSetting({ level: '' as any, subject: '', grade: '', phase: 'Fase X' })
);
assert(activeMissing.level === '', 'U1.3.1-D.1: ActiveContext level does not fall back to profile.defaultLevel');
assert(activeMissing.subject === '', 'U1.3.1-D.2: ActiveContext subject does not fall back to profile.defaultSubject');
assert(activeMissing.phase === '', 'U1.3.1-D.3: ActiveContext phase is empty when level/grade missing');

const activeDerived = buildActiveContext(
  mockProfile,
  mockSchool,
  cloneSetting({ level: 'SMP', grade: 'Kelas 7', phase: 'Fase X' })
);
assert(activeDerived.phase === 'Fase D', 'U1.3.1-D.4: ActiveContext phase derives from level+grade, not stale setting.phase');

const invalidMerdekaWithData = validateWorkflowDependencies({
  profile: mockProfile,
  academicSetting: cloneSetting({ subject: '' }),
  cp: { id: 'cp-1', academicSettingId: 'set-u131', generalDescription: 'Capaian pembelajaran lengkap untuk pengujian', elements: [], updatedAt: '' } as any,
  cpAnalysis: { id: 'cpa-1', academicSettingId: 'set-u131', items: [{ id: 'a1', cpCompetence: 'A', materialScope: 'B' }] } as any,
  tp: { id: 'tp-1', academicSettingId: 'set-u131', items: [{ id: 'tp1', statement: 'TP' }] } as any,
  atp: { id: 'atp-1', academicSettingId: 'set-u131', items: [{ id: 'atp1', tpId: 'tp1' }] } as any,
});
['cp', 'cp-analysis', 'tp', 'atp', 'admin'].forEach((step) => {
  const state = invalidMerdekaWithData.stepStates[step as keyof typeof invalidMerdekaWithData.stepStates];
  assert(state.status === 'BLOCKED' && state.isBlocked && !state.isComplete, `U1.3.1-E.1: ${step} blocked when academic incomplete despite existing data`);
});

const invalidK13WithData = validateWorkflowDependencies({
  profile: mockProfile,
  academicSetting: cloneSetting({
    curriculum: 'Kurikulum 2013',
    curriculumType: 'K13',
    level: 'SMA',
    grade: '',
    subject: 'Fisika',
  }),
  k13Analysis: { id: 'k13-1', academicSettingId: 'set-u131', items: [{ id: 'kd1', kd: 'KD 1', materi: 'Materi', tujuanPembelajaran: 'Tujuan' }] } as any,
  k13KKM: { id: 'kkm-1', academicSettingId: 'set-u131', items: [{ id: 'kkm1' }] } as any,
});
['k13-kd', 'k13-indikator', 'k13-tujuan', 'k13-kkm', 'admin'].forEach((step) => {
  const state = invalidK13WithData.stepStates[step as keyof typeof invalidK13WithData.stepStates];
  assert(state.status === 'BLOCKED' && state.isBlocked && !state.isComplete, `U1.3.1-E.2: ${step} blocked when K13 academic incomplete despite existing data`);
});

const missingProfileMerdeka = validateWorkflowDependencies({
  profile: { ...mockProfile, name: '' },
  academicSetting: cloneSetting(),
  cp: { id: 'cp-1', academicSettingId: 'set-u131', generalDescription: 'Capaian pembelajaran lengkap untuk pengujian', elements: [], updatedAt: '' } as any,
  tp: { id: 'tp-1', academicSettingId: 'set-u131', items: [{ id: 'tp1', statement: 'TP' }] } as any,
  atp: { id: 'atp-1', academicSettingId: 'set-u131', items: [{ id: 'atp1', tpId: 'tp1' }] } as any,
});
['cp', 'cp-analysis', 'tp', 'atp', 'admin'].forEach((step) => {
  const state = missingProfileMerdeka.stepStates[step as keyof typeof missingProfileMerdeka.stepStates];
  assert(state.status === 'BLOCKED' && state.isBlocked && !state.isComplete, `U1.3.1-E.3: ${step} blocked when profile incomplete despite valid academic data`);
});

const missingProfileK13 = validateWorkflowDependencies({
  profile: { ...mockProfile, name: '' },
  academicSetting: cloneSetting({
    curriculum: 'Kurikulum 2013',
    curriculumType: 'K13',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Fisika',
  }),
  k13Analysis: { id: 'k13-1', academicSettingId: 'set-u131', items: [{ id: 'kd1', kd: 'KD 1', materi: 'Materi', tujuanPembelajaran: 'Tujuan' }] } as any,
});
['k13-kd', 'k13-indikator', 'k13-tujuan', 'k13-kkm', 'admin'].forEach((step) => {
  const state = missingProfileK13.stepStates[step as keyof typeof missingProfileK13.stepStates];
  assert(state.status === 'BLOCKED' && state.isBlocked && !state.isComplete, `U1.3.1-E.4: ${step} blocked when profile incomplete despite K13 data`);
});

const validMerdekaWorkflow = validateWorkflowDependencies({
  profile: mockProfile,
  academicSetting: cloneSetting(),
  cp: { id: 'cp-1', academicSettingId: 'set-u131', generalDescription: 'Capaian pembelajaran lengkap untuk pengujian', elements: [], updatedAt: '' } as any,
});
assert(validMerdekaWorkflow.stepStates.academic.isComplete, 'U1.3.1-E.5: Valid Merdeka academic step remains complete');
assert(!validMerdekaWorkflow.stepStates.cp.isBlocked, 'U1.3.1-E.6: Valid Merdeka CP is not globally blocked');

const validK13Workflow = validateWorkflowDependencies({
  profile: mockProfile,
  academicSetting: cloneSetting({
    curriculum: 'Kurikulum 2013',
    curriculumType: 'K13',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Fisika',
  }),
  k13Analysis: { id: 'k13-1', academicSettingId: 'set-u131', items: [{ id: 'kd1', kd: 'KD 1', materi: 'Materi', tujuanPembelajaran: 'Tujuan' }] } as any,
});
assert(validK13Workflow.stepStates.academic.isComplete, 'U1.3.1-E.7: Valid K13 academic step remains complete');
assert(!validK13Workflow.stepStates['k13-kd'].isBlocked, 'U1.3.1-E.8: Valid K13 KD is not globally blocked');

const curriculumRouterCode = fs.readFileSync(path.join(process.cwd(), 'src/services/curriculumRouter.ts'), 'utf-8');
const readinessCode = fs.readFileSync(path.join(process.cwd(), 'src/services/academicSettingReadiness.ts'), 'utf-8');
const regressionCode = fs.readFileSync(path.join(process.cwd(), 'scripts/testRecoveryU1AcademicContractRegression.ts'), 'utf-8');
assert(!curriculumRouterCode.includes('curriculumDefaults'), 'U1.3.1-F.1: curriculumRouter does not import curriculumDefaults');
assert(readinessCode.includes('./curriculumRouter') && readinessCode.includes('../data/curriculumDefaults'), 'U1.3.1-F.2: readiness service owns both dependencies');
assert(!curriculumRouterCode.includes('validateAcademicSettingReadiness'), 'U1.3.1-F.3: readiness implementation removed from curriculumRouter');
assert((readinessCode.match(/function validateAcademicSettingReadiness/g) || []).length === 1, 'U1.3.1-F.4: exactly one readiness implementation exists in new service');
assert(!curriculumRouterCode.includes("from './jpEngine'"), 'U1.3.1-F.5: unused jpEngine import removed from curriculumRouter');
assert(regressionCode.includes("{ level: 'SMP', grade: 'VII' }"), 'U1.3.1-F.6: Roman numeral VII is retained only as an invalid fixture');
assert(regressionCode.includes("{ level: 'SMA', grade: 'X' }"), 'U1.3.1-F.7: Roman numeral X is retained only as an invalid fixture');
assert(APP_BUILD_ID === 'M1.1.1-20260923-1', `U1.3.1-F.8: APP_BUILD_ID follows latest recovery fingerprint M1.1.1-20260923-1 (actual: ${APP_BUILD_ID})`);

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL RECOVERY U1.3.1 REGRESSION TESTS PASSED!');
}
