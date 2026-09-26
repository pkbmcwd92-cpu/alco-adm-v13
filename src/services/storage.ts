import {
  AppStorageState,
  TeacherProfile,
  TeacherSchoolAssignment,
  SchoolData,
  AcademicSetting,
  CurriculumType,
  ActiveContext,
  CPData,
  TPData,
  ATPData,
  AppDocumentRecord,
  ProfileWorkspaceData,
  AdministrationWorkspace,
  Student,
  AcademicCalendar,
  CalendarDay,
  TimeAllocation,
  AttendanceSession,
  AttendanceRecord,
  AssessmentCriterion,
  Assessment,
  AssessmentResult,
  RemedialRecord,
  EnrichmentRecord,
  K13Analysis,
  K13KKM,
  PrincipalHistory,
  CPAnalysisData,
  LearningPlan,
  AssessmentPlan,
  AssessmentPackage,
} from '../types';
import { getCurriculumTypeFromSetting } from './curriculumRouter';
import { isValidDocumentDate } from './documentDateService';
import {
  validateATPReferences,
  normalizeATPReferences,
  validateATPDataWorkflow,
  classifyCPChange,
  classifyCPAnalysisChange,
  classifyTPChange,
  classifyATPChange,
  classifyAssessmentCriteriaChange,
  getChangedTPItemIds,
  getChangedAssessmentCriterionIds,
} from './cpWorkflowService';
import {
  migrateLegacyLearningPlan,
  invalidatePlanIfDependenciesChanged,
  resolveLearningPlanObjectives,
  resolveLearningPlanAllocatedJP,
} from './learningPlanService';
import { invalidateAssessmentPlanDependencies } from './assessmentPlanService';
import { invalidateAssessmentPackageDependencies } from './assessmentPackageService';
import {
  buildActiveContext,
  getPhaseFromGrade,
} from '../data/curriculumDefaults';
import { resolveOfficialCalendar } from './calendarResolver';
import saveAs from 'file-saver';

const STORAGE_KEY = 'administrasi_guru_ai_storage_v3';
const V2_STORAGE_KEY = 'administrasi_guru_ai_storage_v2';
const LEGACY_STORAGE_KEY = 'administrasi_guru_ai_storage_v1';

export function createDefaultCalendarForSetting(
  setting: AcademicSetting,
  school?: SchoolData
): { calendar: AcademicCalendar; days: CalendarDay[] } {
  if (school && school.province && setting.academicYear) {
    const resolved = resolveOfficialCalendar({
      province: school.province,
      regency: school.regency,
      academicYear: setting.academicYear,
      semester: setting.semester || '1',
      academicSettingId: setting.id,
      calendarId: `cal-${setting.id}`,
      subjectWeeklyJP: setting.subjectWeeklyJP ? Number(setting.subjectWeeklyJP) : (setting.totalHoursPerWeek ? Number(setting.totalHoursPerWeek) : null),
    });
    if (resolved.isResolved && resolved.calendar) {
      return { calendar: resolved.calendar, days: resolved.days };
    }
  }

  const calId = `cal-${setting.id}`;
  const calendar: AcademicCalendar = {
    id: calId,
    academicSettingId: setting.id,
    academicYear: setting.academicYear || '',
    semester: setting.semester || '',
    startDate: '',
    endDate: '',
    schoolDaysPerWeek: null,
    sourceType: 'UNVERIFIED',
    workflowStatus: 'UNRESOLVED',
    jpPerWeek: setting.subjectWeeklyJP ? Number(setting.subjectWeeklyJP) : (setting.totalHoursPerWeek ? Number(setting.totalHoursPerWeek) : null),
    notes: '',
    updatedAt: new Date().toISOString(),
  };

  const days: CalendarDay[] = [];
  return { calendar, days };
}

export function generateWorkspaceName(setting: {
  subject?: string;
  grade?: string;
  semester?: string;
  academicYear?: string;
}): string {
  const mapel = setting.subject?.trim() || 'Mata Pelajaran';
  const kelas = setting.grade?.trim() || 'Kelas -';
  const sem = setting.semester?.includes('2') ? 'Sem 2' : setting.semester?.includes('1') ? 'Sem 1' : 'Sem -';
  const thn = setting.academicYear?.trim() ? setting.academicYear.trim() : 'Tahun Ajaran -';
  return `${mapel} — ${kelas} — ${sem} — ${thn}`;
}

export function getInitialState(): AppStorageState {
  return {
    version: 4,
    activeProfileId: '',
    activeWorkspaceId: '',
    profiles: [],
    schools: [],
    teacherSchoolAssignments: [],
    principalHistories: [],
    workspaces: [],
    academicSettings: [],
    cps: [],
    cpAnalyses: [],
    tps: [],
    atps: [],
    documents: [],
    students: [],
    academicCalendars: [],
    effectiveDays: [],
    timeAllocations: [],
    attendanceSessions: [],
    attendanceRecords: [],
    assessmentCriteria: [],
    assessments: [],
    assessmentResults: [],
    remedialRecords: [],
    enrichmentRecords: [],
    k13Analyses: [],
    k13KKMs: [],
    learningPlans: [],
    assessmentPlans: [],
    assessmentPackages: [],
  };
}

export function loadAppStorage(): AppStorageState {
  if (typeof window === 'undefined' && typeof globalThis.localStorage === 'undefined') {
    return getInitialState();
  }

  try {
    let raw = localStorage.getItem(STORAGE_KEY);

    // Migration from v2 if v3 does not exist yet
    if (!raw) {
      const v2Raw = localStorage.getItem(V2_STORAGE_KEY);
      if (v2Raw) {
        try {
          const v2Data = JSON.parse(v2Raw);
          const migratedState = migrateV2ToV3(v2Data);
          saveAppStorage(migratedState);
          return migratedState;
        } catch (e) {
          console.warn('Could not migrate v2 storage:', e);
        }
      }

      // Check legacy v1
      const v1Raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (v1Raw) {
        try {
          const v1Data = JSON.parse(v1Raw);
          const v2State = migrateV1ToV2(v1Data);
          const migratedState = migrateV2ToV3(v2State);
          saveAppStorage(migratedState);
          return migratedState;
        } catch (e) {
          console.warn('Could not migrate v1 storage:', e);
        }
      }

      const initial = getInitialState();
      saveAppStorage(initial);
      return initial;
    }

    const parsed = JSON.parse(raw) as AppStorageState;
    if (!parsed || !Array.isArray(parsed.profiles)) {
      const initial = getInitialState();
      saveAppStorage(initial);
      return initial;
    }

    let needsResave = false;

    // Ensure collections exist
    if (!Array.isArray(parsed.workspaces)) {
      parsed.workspaces = [];
      needsResave = true;
    }

    if (!Array.isArray(parsed.academicSettings)) {
      parsed.academicSettings = [];
      needsResave = true;
    }

    if (!Array.isArray(parsed.students)) { parsed.students = []; needsResave = true; }
    if (!Array.isArray(parsed.schools)) { parsed.schools = []; needsResave = true; }
    if (!Array.isArray(parsed.principalHistories)) { parsed.principalHistories = []; needsResave = true; }
    if (!Array.isArray(parsed.assessmentPackages)) { parsed.assessmentPackages = []; needsResave = true; }

    // Migration: ensure every profile has a valid schoolId
    parsed.profiles.forEach((p) => {
      const isSchoolValid = p.schoolId && parsed.schools.some((s) => s.id === p.schoolId);
      if (!isSchoolValid) {
        const legacyAssign = (parsed.teacherSchoolAssignments || []).find(
          (a) => a.teacherId === p.id && parsed.schools.some((s) => s.id === a.schoolId)
        );
        if (legacyAssign) {
          p.schoolId = legacyAssign.schoolId;
        } else if (parsed.schools.length > 0) {
          p.schoolId = parsed.schools[0].id;
        } else if (p.schoolId) {
          delete p.schoolId;
        }
        needsResave = true;
      }
    });

    // Migration: ensure all workspaces have schoolId matching their profile.schoolId
    parsed.workspaces.forEach((w) => {
      const prof = parsed.profiles.find((p) => p.id === w.profileId);
      if (prof && prof.schoolId && w.schoolId !== prof.schoolId) {
        w.schoolId = prof.schoolId;
        needsResave = true;
      }
    });

    if (!Array.isArray(parsed.documents)) { parsed.documents = []; needsResave = true; }
    if (!Array.isArray(parsed.cps)) { parsed.cps = []; needsResave = true; }
    else {
      parsed.cps = parsed.cps.map((c) => ({
        ...c,
        elements: Array.isArray(c.elements) ? c.elements : [],
      }));
    }

    if (!Array.isArray(parsed.cpAnalyses)) { parsed.cpAnalyses = []; needsResave = true; }
    if (!Array.isArray(parsed.tps)) { parsed.tps = []; needsResave = true; }
    else {
      parsed.tps = parsed.tps.map((t) => ({
        ...t,
        items: Array.isArray(t.items) ? t.items : [],
      }));
    }

    if (!Array.isArray(parsed.atps)) { parsed.atps = []; needsResave = true; }
    else {
      parsed.atps = parsed.atps.map((a) => ({
        ...a,
        items: Array.isArray(a.items) ? a.items : [],
      }));
    }

    if (!Array.isArray(parsed.academicCalendars)) { parsed.academicCalendars = []; needsResave = true; }
    if (!Array.isArray(parsed.effectiveDays)) { parsed.effectiveDays = []; needsResave = true; }
    if (!Array.isArray(parsed.timeAllocations)) { parsed.timeAllocations = []; needsResave = true; }
    if (!Array.isArray(parsed.attendanceSessions)) { parsed.attendanceSessions = []; needsResave = true; }
    if (!Array.isArray(parsed.attendanceRecords)) { parsed.attendanceRecords = []; needsResave = true; }
    if (!Array.isArray(parsed.assessmentCriteria)) { parsed.assessmentCriteria = []; needsResave = true; }
    if (!Array.isArray(parsed.assessments)) { parsed.assessments = []; needsResave = true; }
    if (!Array.isArray(parsed.assessmentResults)) { parsed.assessmentResults = []; needsResave = true; }
    if (!Array.isArray(parsed.remedialRecords)) { parsed.remedialRecords = []; needsResave = true; }
    if (!Array.isArray(parsed.enrichmentRecords)) { parsed.enrichmentRecords = []; needsResave = true; }
    if (!Array.isArray(parsed.k13Analyses)) { parsed.k13Analyses = []; needsResave = true; }
    if (!Array.isArray(parsed.k13KKMs)) { parsed.k13KKMs = []; needsResave = true; }
    if (!Array.isArray(parsed.learningPlans)) { parsed.learningPlans = []; needsResave = true; }
    if (!Array.isArray(parsed.assessmentPlans)) { parsed.assessmentPlans = []; needsResave = true; }

    // Auto-migrate: ensure all academicSettings have explicit curriculumType and derived phases
    parsed.academicSettings = parsed.academicSettings.map((setting) => {
      const derived = (setting.level && setting.grade) ? getPhaseFromGrade(setting.level, setting.grade) : '';
      const curType = getCurriculumTypeFromSetting(setting);
      let changed = false;
      const updated = { ...setting };
      if (setting.curriculumType !== curType) {
        updated.curriculumType = curType;
        changed = true;
      }
      if (setting.phase !== derived) {
        updated.phase = derived;
        changed = true;
      }
      if (changed) {
        needsResave = true;
      }
      return updated;
    });

    // Ensure activeProfileId is valid
    if (parsed.profiles.length > 0) {
      if (!parsed.activeProfileId || !parsed.profiles.some((p) => p.id === parsed.activeProfileId)) {
        parsed.activeProfileId = parsed.profiles[0].id;
        needsResave = true;
      }
    } else {
      if (parsed.activeProfileId) {
        parsed.activeProfileId = '';
        needsResave = true;
      }
    }

    // Ensure activeWorkspaceId is valid
    if (parsed.workspaces.length > 0) {
      if (!parsed.activeWorkspaceId || !parsed.workspaces.some((w) => w.id === parsed.activeWorkspaceId)) {
        const currentProfileWs = parsed.workspaces.find((w) => w.profileId === parsed.activeProfileId);
        parsed.activeWorkspaceId = currentProfileWs ? currentProfileWs.id : (parsed.workspaces[0]?.id || '');
        needsResave = true;
      }
    } else {
      if (parsed.activeWorkspaceId) {
        parsed.activeWorkspaceId = '';
        needsResave = true;
      }
    }

    if (needsResave) {
      saveAppStorage(parsed);
    }

    return parsed;
  } catch (err) {
    console.error('Failed to load localStorage data:', err);
    return getInitialState();
  }
}

function migrateV2ToV3(v2Data: any): AppStorageState {
  const initial = getInitialState();
  return {
    version: 3,
    activeProfileId: v2Data.activeProfileId || initial.activeProfileId,
    activeWorkspaceId: v2Data.activeWorkspaceId || initial.activeWorkspaceId,
    profiles: Array.isArray(v2Data.profiles) ? v2Data.profiles : initial.profiles,
    schools: Array.isArray(v2Data.schools) && v2Data.schools.length > 0 ? v2Data.schools : initial.schools,
    principalHistories: Array.isArray(v2Data.principalHistories) ? v2Data.principalHistories : [],
    workspaces: Array.isArray(v2Data.workspaces) ? v2Data.workspaces : initial.workspaces,
    academicSettings: Array.isArray(v2Data.academicSettings) ? v2Data.academicSettings : initial.academicSettings,
    cps: Array.isArray(v2Data.cps) ? v2Data.cps : initial.cps,
    cpAnalyses: Array.isArray(v2Data.cpAnalyses) ? v2Data.cpAnalyses : [],
    tps: Array.isArray(v2Data.tps) ? v2Data.tps : initial.tps,
    atps: Array.isArray(v2Data.atps) ? v2Data.atps : initial.atps,
    documents: Array.isArray(v2Data.documents) ? v2Data.documents : initial.documents,
    students: Array.isArray(v2Data.students) ? v2Data.students : [],
    academicCalendars: Array.isArray(v2Data.academicCalendars) ? v2Data.academicCalendars : [],
    effectiveDays: Array.isArray(v2Data.effectiveDays) ? v2Data.effectiveDays : [],
    timeAllocations: Array.isArray(v2Data.timeAllocations) ? v2Data.timeAllocations : [],
    attendanceSessions: Array.isArray(v2Data.attendanceSessions) ? v2Data.attendanceSessions : [],
    attendanceRecords: Array.isArray(v2Data.attendanceRecords) ? v2Data.attendanceRecords : [],
    assessmentCriteria: Array.isArray(v2Data.assessmentCriteria) ? v2Data.assessmentCriteria : [],
    assessments: Array.isArray(v2Data.assessments) ? v2Data.assessments : [],
    assessmentResults: Array.isArray(v2Data.assessmentResults) ? v2Data.assessmentResults : [],
    remedialRecords: Array.isArray(v2Data.remedialRecords) ? v2Data.remedialRecords : [],
    enrichmentRecords: Array.isArray(v2Data.enrichmentRecords) ? v2Data.enrichmentRecords : [],
    k13Analyses: Array.isArray(v2Data.k13Analyses) ? v2Data.k13Analyses : [],
    k13KKMs: Array.isArray(v2Data.k13KKMs) ? v2Data.k13KKMs : [],
    learningPlans: Array.isArray(v2Data.learningPlans)
      ? v2Data.learningPlans.map((lp: any) => migrateLegacyLearningPlan(lp, lp.academicSettingId || ''))
      : [],
  };
}

function migrateV1ToV2(v1Data: any): AppStorageState {
  const initial = getInitialState();
  const profiles: TeacherProfile[] = Array.isArray(v1Data.profiles) ? v1Data.profiles : initial.profiles;
  const schools: SchoolData[] = Array.isArray(v1Data.schools) ? v1Data.schools : initial.schools;
  const academicSettings: AcademicSetting[] = Array.isArray(v1Data.academicSettings) ? v1Data.academicSettings : initial.academicSettings;
  const cps: CPData[] = Array.isArray(v1Data.cps) ? v1Data.cps : initial.cps;
  const tps: TPData[] = Array.isArray(v1Data.tps) ? v1Data.tps : initial.tps;
  const atps: ATPData[] = Array.isArray(v1Data.atps) ? v1Data.atps : initial.atps;
  const documents: AppDocumentRecord[] = Array.isArray(v1Data.documents) ? v1Data.documents : initial.documents;

  const workspaces: AdministrationWorkspace[] = [];
  academicSettings.forEach((setting, idx) => {
    const ws: AdministrationWorkspace = {
      id: `ws-${setting.id || idx}`,
      profileId: setting.profileId,
      schoolId: profiles.find((p) => p.id === setting.profileId)?.schoolId || '',
      academicSettingId: setting.id,
      name: generateWorkspaceName(setting),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workspaces.push(ws);
  });

  const activeProfileId = v1Data.activeProfileId || (profiles[0]?.id || '');
  const activeWs = workspaces.find((w) => w.profileId === activeProfileId) || workspaces[0];

  return {
    version: 2,
    activeProfileId,
    activeWorkspaceId: activeWs?.id || '',
    profiles,
    schools,
    workspaces,
    academicSettings,
    cps,
    tps,
    atps,
    documents,
  };
}

export function saveAppStorage(state: AppStorageState): void {
  if (typeof window === 'undefined' && typeof globalThis.localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Aliases
export const getAppData = loadAppStorage;
export const saveAppData = saveAppStorage;

export function setActiveProfileId(profileId: string): void {
  const current = loadAppStorage();
  const targetProfile = current.profiles.find((p) => p.id === profileId);
  if (!targetProfile) return;

  current.activeProfileId = profileId;

  // Workspaces strictly for this teacher profile
  const profileWorkspaces = current.workspaces.filter((w) => w.profileId === profileId);

  // Synchronize schoolId across all workspaces for this profile
  if (targetProfile.schoolId) {
    profileWorkspaces.forEach((w) => {
      w.schoolId = targetProfile.schoolId!;
    });
  }

  // Switch active workspace to a workspace belonging to this profile
  if (profileWorkspaces.length > 0) {
    const currentActiveBelongs = profileWorkspaces.some((w) => w.id === current.activeWorkspaceId);
    if (!currentActiveBelongs) {
      current.activeWorkspaceId = profileWorkspaces[0].id;
    }
  } else {
    delete current.activeWorkspaceId;
  }

  saveAppStorage(current);
}

export function setActiveWorkspaceId(workspaceId: string): void {
  const current = loadAppStorage();
  const targetWs = current.workspaces.find((w) => w.id === workspaceId);
  if (targetWs) {
    current.activeWorkspaceId = workspaceId;
    current.activeProfileId = targetWs.profileId;

    // Ensure targetWs.schoolId matches its profile.schoolId
    const prof = current.profiles.find((p) => p.id === targetWs.profileId);
    if (prof && prof.schoolId) {
      targetWs.schoolId = prof.schoolId;
    }
    saveAppStorage(current);
  }
}

/**
 * Retrieves the full isolated data tree for a given profile and active workspace.
 * Guarantee: Data from Workspace SD A will NEVER bleed into Workspace SD B.
 */
export function getProfileWorkspace(profileId?: string, workspaceId?: string): ProfileWorkspaceData {
  const state = loadAppStorage();
  const profile = (profileId ? state.profiles.find((p) => p.id === profileId) : undefined) || state.profiles[0];

  if (!profile) {
    return {
      status: 'NO_PROFILE',
      profile: undefined,
      school: undefined,
      schools: state.schools || [],
      teacherSchoolAssignments: [],
      assignedSchools: [],
      principalHistories: state.principalHistories || [],
      workspace: undefined,
      academicSetting: undefined,
      context: undefined,
      cp: undefined,
      cpAnalysis: undefined,
      tp: undefined,
      atp: undefined,
      documents: [],
      allWorkspaces: [],
      allWorkspacesForProfile: [],
      activeProfile: undefined,
      activeSchool: undefined,
      activeWorkspace: undefined,
      activeAcademicSetting: undefined,
      activeContext: undefined,
      activeCP: undefined,
      activeTP: undefined,
      activeATP: undefined,
      students: [],
      calendar: undefined,
      calendarDays: [],
      timeAllocations: [],
      attendanceSessions: [],
      attendanceRecords: [],
      assessmentCriteria: [],
      assessments: [],
      assessmentResults: [],
      remedials: [],
      enrichments: [],
      k13Analysis: undefined,
      k13KKM: undefined,
      learningPlans: [],
      assessmentPlans: [],
      assessmentPackages: [],
    };
  }

  // 1 Profil Guru = 1 Sekolah Utama (master data SchoolData)
  const school = profile.schoolId ? state.schools.find((s) => s.id === profile.schoolId) : undefined;

  // Workspaces strictly for this teacher profile
  let profileWorkspaces = state.workspaces.filter((w) => w.profileId === profile.id);

  // Do not silently bind unresolved or invalid school relationships to an unrelated school.

  // Resolve active workspace
  let targetWs: AdministrationWorkspace | undefined;
  if (workspaceId) {
    targetWs = profileWorkspaces.find((w) => w.id === workspaceId);
  }
  if (!targetWs) {
    targetWs = profileWorkspaces.find((w) => w.id === state.activeWorkspaceId) || profileWorkspaces[0];
  }

  // Retrieve Academic Setting for this workspace
  let academicSetting = targetWs ? state.academicSettings.find((a) => a.id === targetWs.academicSettingId) : undefined;

  // Ensure derived phase is always up to date if level and grade exist
  if (academicSetting) {
    const derivedPhase = (academicSetting.level && academicSetting.grade)
      ? getPhaseFromGrade(academicSetting.level, academicSetting.grade)
      : '';
    if (derivedPhase !== academicSetting.phase) {
      academicSetting = {
        ...academicSetting,
        phase: derivedPhase,
      };
    }
  }

  // Build the unified single source of truth activeContext
  const context = academicSetting && school ? buildActiveContext(profile, school, academicSetting) : undefined;

  // Retrieve CP strictly for this workspace's academic setting
  let cp = academicSetting ? state.cps.find((c) => c.academicSettingId === academicSetting.id) : undefined;
  if (cp) {
    cp = {
      ...cp,
      elements: Array.isArray(cp.elements) ? cp.elements : [],
    };
  }

  // Retrieve TP strictly for this workspace's academic setting
  let tp = academicSetting ? state.tps.find((t) => t.academicSettingId === academicSetting.id) : undefined;
  if (tp) {
    tp = {
      ...tp,
      items: Array.isArray(tp.items) ? tp.items : [],
    };
  }

  // Retrieve ATP strictly for this workspace's academic setting
  let atp = academicSetting ? state.atps.find((a) => a.academicSettingId === academicSetting.id) : undefined;
  if (atp) {
    atp = {
      ...atp,
      items: Array.isArray(atp.items) ? atp.items : [],
    };
  }

  // Retrieve workspace documents
  const workspaceDocs = (state.documents || []).filter(
    (d) => (academicSetting && d.academicSettingId === academicSetting.id) || (targetWs && d.workspaceId === targetWs.id)
  );

  // Retrieve Students strictly for this academicSetting
  const settingStudents = academicSetting ? (state.students || []).filter((s) => s.academicSettingId === academicSetting.id) : [];

  // Retrieve Academic Calendar strictly for this academicSetting
  let calendar = academicSetting ? (state.academicCalendars || []).find((c) => c.academicSettingId === academicSetting.id) : undefined;
  let calendarDays = (state.effectiveDays || []).filter((d) => d.academicCalendarId === calendar?.id);

  // Retrieve Time Allocations
  const timeAllocations = academicSetting ? (state.timeAllocations || []).filter((t) => t.academicSettingId === academicSetting.id) : [];

  // Retrieve Attendance Sessions & Records
  const attendanceSessions = academicSetting ? (state.attendanceSessions || []).filter((s) => s.academicSettingId === academicSetting.id) : [];
  const sessionIds = new Set(attendanceSessions.map((s) => s.id));
  const attendanceRecords = (state.attendanceRecords || []).filter((r) => sessionIds.has(r.sessionId));

  // Retrieve KKTP (Assessment Criteria)
  const assessmentCriteria = academicSetting ? (state.assessmentCriteria || []).filter((c) => c.academicSettingId === academicSetting.id) : [];

  // Retrieve Assessments & Results
  const assessments = academicSetting ? (state.assessments || []).filter((a) => a.academicSettingId === academicSetting.id) : [];
  const assessmentIds = new Set(assessments.map((a) => a.id));
  const assessmentResults = (state.assessmentResults || []).filter((r) => assessmentIds.has(r.assessmentId));

  // Retrieve Remedials & Enrichments
  const remedials = academicSetting ? (state.remedialRecords || []).filter((r) => r.academicSettingId === academicSetting.id) : [];
  const enrichments = academicSetting ? (state.enrichmentRecords || []).filter((e) => e.academicSettingId === academicSetting.id) : [];

  // Retrieve K13 items only if existing legitimate records are present.
  let k13Analysis = academicSetting ? (state.k13Analyses || []).find((k) => k.academicSettingId === academicSetting.id) : undefined;
  let k13KKM = academicSetting ? (state.k13KKMs || []).find((k) => k.academicSettingId === academicSetting.id) : undefined;

  // Retrieve CP Analysis if exists
  const cpAnalysis = academicSetting ? (state.cpAnalyses || []).find((a) => a.academicSettingId === academicSetting.id) : undefined;
  const principalHistories = school ? (state.principalHistories || []).filter((h) => h.schoolId === school.id) : [];
  const rawLearningPlans = academicSetting ? (state.learningPlans || []).filter((lp) => lp.academicSettingId === academicSetting.id) : [];
  const learningPlans = rawLearningPlans.map((lp) => {
    if (lp.status === 'SIAP') {
      const reval = invalidatePlanIfDependenciesChanged(lp, { academicSetting, tp, atp, k13Analysis });
      if (reval.isInvalidated) {
        return reval.plan;
      }
    }
    return lp;
  });

  const rawAssessmentPlans = academicSetting ? (state.assessmentPlans || []).filter((ap) => ap.academicSettingId === academicSetting.id) : [];
  const assessmentPlans = rawAssessmentPlans.map((ap) => {
    if (ap.workflowStatus === 'SIAP') {
      const reval = invalidateAssessmentPlanDependencies(ap, { academicSetting, tp, k13Analysis, assessmentCriteria, learningPlans });
      if (reval.isInvalidated) {
        return reval.plan;
      }
    }
    return ap;
  });

  const planMap = new Map(assessmentPlans.map((p) => [p.id, p]));
  const rawAssessmentPackages = academicSetting ? (state.assessmentPackages || []).filter((pkg) => pkg.academicSettingId === academicSetting.id) : [];
  const assessmentPackages = rawAssessmentPackages.map((pkg) => {
    const parentPlan = planMap.get(pkg.assessmentPlanId);
    if (pkg.workflowStatus === 'SIAP') {
      const reval = invalidateAssessmentPackageDependencies(pkg, { academicSetting, assessmentPlan: parentPlan, tp, k13Analysis, assessmentCriteria });
      if (reval.isInvalidated) {
        return reval.package;
      }
    }
    return pkg;
  });

  return {
    profile,
    school,
    schools: state.schools || [],
    teacherSchoolAssignments: state.teacherSchoolAssignments || [],
    assignedSchools: school ? [school] : [],
    principalHistories,
    workspace: targetWs,
    academicSetting,
    context,
    cp,
    cpAnalysis,
    tp,
    atp,
    documents: workspaceDocs.length > 0 ? workspaceDocs : (state.documents || []),
    allWorkspaces: profileWorkspaces,
    allWorkspacesForProfile: profileWorkspaces,
    activeProfile: profile,
    activeSchool: school,
    activeWorkspace: targetWs,
    activeAcademicSetting: academicSetting,
    activeContext: context,
    activeCP: cp,
    activeTP: tp,
    activeATP: atp,
    students: settingStudents,
    calendar,
    calendarDays,
    timeAllocations,
    attendanceSessions,
    attendanceRecords,
    assessmentCriteria,
    assessments,
    assessmentResults,
    remedials,
    enrichments,
    k13Analysis,
    k13KKM,
    learningPlans,
    assessmentPlans,
    assessmentPackages,
  };
}

/**
 * Creates a brand new Administration Workspace for a teacher profile.
 */
export function createWorkspace(params: {
  profileId: string;
  schoolId?: string;
  name?: string;
  documentDate?: string;
  setting: {
    curriculum?: string;
    academicYear?: string;
    semester?: '1 (Ganjil)' | '2 (Genap)' | string;
    level?: 'SD' | 'SMP' | 'SMA' | 'SMK' | string;
    grade?: string;
    subject?: string;
    totalHoursPerWeek?: number;
  };
}): AdministrationWorkspace {
  const state = loadAppStorage();

  if (params.documentDate !== undefined && params.documentDate !== '') {
    if (!isValidDocumentDate(params.documentDate)) {
      throw new Error(`Tanggal dokumen tidak valid: "${params.documentDate}". Format yang benar adalah YYYY-MM-DD.`);
    }
  }
  
  let profile = state.profiles.find((p) => p.id === params.profileId);
  if (!profile) {
    if (params.profileId && params.profileId.trim().length > 0) {
      throw new Error(`Profil guru dengan ID "${params.profileId}" tidak ditemukan.`);
    }
    profile = state.activeProfileId ? state.profiles.find((p) => p.id === state.activeProfileId) : undefined;
    if (!profile) {
      throw new Error('Profil guru tidak ditemukan untuk membuat administrasi baru.');
    }
  }

  // 1 Profil Guru = 1 Sekolah Utama: unresolved/invalid school stays unresolved.
  const school = profile.schoolId ? state.schools.find((s) => s.id === profile.schoolId) : undefined;
  const schoolId = school?.id || '';

  const newSettingId = `acad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  
  const level = params.setting?.level || profile.defaultLevel || '';
  const grade = params.setting?.grade?.trim() || '';
  const derivedPhase = (level && grade) ? getPhaseFromGrade(level, grade) : '';

  let curriculum = params.setting?.curriculum?.trim() || '';
  let curType: CurriculumType | undefined = undefined;

  if (curriculum === 'Kurikulum 2013' || curriculum === 'K13') {
    curriculum = 'Kurikulum 2013';
    curType = 'K13';
  } else if (curriculum === 'Kurikulum Merdeka' || curriculum === 'KURIKULUM_MERDEKA') {
    curriculum = 'Kurikulum Merdeka';
    curType = 'KURIKULUM_MERDEKA';
  } else if (curriculum) {
    curType = getCurriculumTypeFromSetting({ curriculum });
  }

  const subject = params.setting?.subject?.trim() || profile.defaultSubject || '';
  const academicYear = params.setting?.academicYear?.trim() || '';
  const semester = params.setting?.semester || '';
  const totalHoursPerWeek = params.setting?.totalHoursPerWeek ? Number(params.setting.totalHoursPerWeek) : undefined;

  const newSetting: AcademicSetting = {
    id: newSettingId,
    profileId: profile.id,
    curriculum,
    curriculumType: curType,
    academicYear,
    semester: semester === '1 (Ganjil)' || semester === '2 (Genap)' ? semester : '',
    level: level === 'SD' || level === 'SMP' || level === 'SMA' || level === 'SMK' ? level : '',
    grade,
    phase: derivedPhase,
    subject,
    totalHoursPerWeek,
    updatedAt: new Date().toISOString(),
  };

  const wsName = params.name && params.name.trim().length > 0
    ? params.name.trim()
    : generateWorkspaceName(newSetting);

  const newWorkspace: AdministrationWorkspace = {
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    profileId: profile.id,
    schoolId,
    academicSettingId: newSettingId,
    name: wsName,
    documentDate: params.documentDate && isValidDocumentDate(params.documentDate) ? params.documentDate : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.academicSettings.push(newSetting);
  state.workspaces.push(newWorkspace);

  if (curType === 'KURIKULUM_MERDEKA') {
    // Merdeka: Create CP, TP, ATP instances strictly for Merdeka workspace
    const newCP: CPData = {
      id: `cp-${newSettingId}`,
      academicSettingId: newSettingId,
      generalDescription: '',
      elements: [],
      updatedAt: new Date().toISOString(),
    };

    const newTP: TPData = {
      id: `tp-${newSettingId}`,
      academicSettingId: newSettingId,
      items: [],
      updatedAt: new Date().toISOString(),
    };

    const newATP: ATPData = {
      id: `atp-${newSettingId}`,
      academicSettingId: newSettingId,
      rationale: '',
      items: [],
      totalJP: 0,
      updatedAt: new Date().toISOString(),
    };

    state.cps.push(newCP);
    state.tps.push(newTP);
    state.atps.push(newATP);
  } else if (curType === 'K13') {
    // K13: Create an empty analysis container only; KKM remains absent until configured.
    const newK13Analysis: K13Analysis = {
      id: `k13-ana-${newSettingId}`,
      academicSettingId: newSettingId,
      items: [],
      updatedAt: new Date().toISOString(),
    };

    state.k13Analyses = [...(state.k13Analyses || []), newK13Analysis];
  }

  state.activeProfileId = profile.id;
  state.activeWorkspaceId = newWorkspace.id;

  saveAppStorage(state);
  return newWorkspace;
}

/**
 * Duplicates an existing workspace (e.g. PJOK Kelas 1 -> PJOK Kelas 2)
 */
export function duplicateWorkspace(sourceWorkspaceId: string, newGrade?: string, newSubject?: string): AdministrationWorkspace | null {
  const state = loadAppStorage();
  const sourceWs = state.workspaces.find((w) => w.id === sourceWorkspaceId);
  if (!sourceWs) return null;

  const sourceSetting = state.academicSettings.find((a) => a.id === sourceWs.academicSettingId);
  if (!sourceSetting) return null;

  const targetGrade = newGrade || sourceSetting.grade;
  const targetSubject = newSubject || sourceSetting.subject;
  const derivedPhase = (sourceSetting.level && targetGrade) ? getPhaseFromGrade(sourceSetting.level, targetGrade) : '';
  const curType = getCurriculumTypeFromSetting(sourceSetting);

  const newSettingId = `acad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const clonedSetting: AcademicSetting = {
    ...sourceSetting,
    id: newSettingId,
    curriculumType: curType,
    grade: targetGrade,
    phase: derivedPhase,
    subject: targetSubject,
    updatedAt: new Date().toISOString(),
  };

  const clonedName = generateWorkspaceName(clonedSetting);

  const clonedWs: AdministrationWorkspace = {
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    profileId: sourceWs.profileId,
    schoolId: sourceWs.schoolId,
    academicSettingId: newSettingId,
    name: clonedName,
    documentDate: isValidDocumentDate(sourceWs.documentDate) ? sourceWs.documentDate : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sourceStudents = (state.students || []).filter((s) => s.academicSettingId === sourceSetting.id);
  const clonedStudents: Student[] = sourceStudents.map((s, idx) => ({
    ...s,
    id: `std-${newSettingId}-${Date.now()}-${idx + 1}`,
    academicSettingId: newSettingId,
  }));

  state.academicSettings.push(clonedSetting);
  state.workspaces.push(clonedWs);
  state.students = [...(state.students || []), ...clonedStudents];

  if (curType === 'KURIKULUM_MERDEKA') {
    // Clone CP, TP, ATP for Merdeka only
    const sourceCP = state.cps.find((c) => c.academicSettingId === sourceSetting.id);
    const clonedCP: CPData = sourceCP
      ? {
          ...sourceCP,
          id: `cp-${newSettingId}`,
          academicSettingId: newSettingId,
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `cp-${newSettingId}`,
          academicSettingId: newSettingId,
          generalDescription: '',
          elements: [],
          updatedAt: new Date().toISOString(),
        };

    const sourceTP = state.tps.find((t) => t.academicSettingId === sourceSetting.id);
    const clonedTP: TPData = sourceTP
      ? {
          ...sourceTP,
          id: `tp-${newSettingId}`,
          academicSettingId: newSettingId,
          items: (sourceTP.items || []).map((it, idx) => ({ ...it, id: `tp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}` })),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `tp-${newSettingId}`,
          academicSettingId: newSettingId,
          items: [],
          updatedAt: new Date().toISOString(),
        };

    const sourceATP = state.atps.find((a) => a.academicSettingId === sourceSetting.id);
    const clonedATP: ATPData = sourceATP
      ? {
          ...sourceATP,
          id: `atp-${newSettingId}`,
          academicSettingId: newSettingId,
          items: (sourceATP.items || []).map((it, idx) => ({ ...it, id: `atp-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}` })),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `atp-${newSettingId}`,
          academicSettingId: newSettingId,
          rationale: '',
          items: [],
          totalJP: 0,
          updatedAt: new Date().toISOString(),
        };

    state.cps.push(clonedCP);
    state.tps.push(clonedTP);
    state.atps.push(clonedATP);
  } else if (curType === 'K13') {
    // Clone K13 data for K13 only
    const sourceAnalysis = (state.k13Analyses || []).find((k) => k.academicSettingId === sourceSetting.id);
    const clonedAnalysis: K13Analysis = sourceAnalysis
      ? {
          ...sourceAnalysis,
          id: `k13-ana-${newSettingId}`,
          academicSettingId: newSettingId,
          items: (sourceAnalysis.items || []).map((it, idx) => ({ ...it, id: `k13-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}` })),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `k13-ana-${newSettingId}`,
          academicSettingId: newSettingId,
          items: [],
          updatedAt: new Date().toISOString(),
        };

    const sourceKKM = (state.k13KKMs || []).find((k) => k.academicSettingId === sourceSetting.id);

    state.k13Analyses = [...(state.k13Analyses || []), clonedAnalysis];
    if (sourceKKM) {
      const clonedKKM: K13KKM = {
        ...sourceKKM,
        id: `k13-kkm-${newSettingId}`,
        academicSettingId: newSettingId,
        items: (sourceKKM.items || []).map((it, idx) => ({ ...it, id: `kkm-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}` })),
        updatedAt: new Date().toISOString(),
      };
      state.k13KKMs = [...(state.k13KKMs || []), clonedKKM];
    }
  }

  state.activeWorkspaceId = clonedWs.id;
  saveAppStorage(state);
  return clonedWs;
}

export function renameWorkspace(workspaceId: string, newName: string): void {
  const current = loadAppStorage();
  const ws = current.workspaces.find((w) => w.id === workspaceId);
  if (ws && newName.trim()) {
    ws.name = newName.trim();
    ws.updatedAt = new Date().toISOString();
    saveAppStorage(current);
  }
}

export function deleteWorkspace(workspaceId: string): boolean {
  const current = loadAppStorage();
  const targetWs = current.workspaces.find((w) => w.id === workspaceId);
  if (!targetWs) return false;

  // Do not delete if it's the only workspace for this profile
  const profileWs = current.workspaces.filter((w) => w.profileId === targetWs.profileId);
  if (profileWs.length <= 1) {
    return false;
  }

  current.workspaces = current.workspaces.filter((w) => w.id !== workspaceId);
  current.academicSettings = current.academicSettings.filter((a) => a.id !== targetWs.academicSettingId);
  current.cps = current.cps.filter((c) => c.academicSettingId !== targetWs.academicSettingId);
  current.tps = current.tps.filter((t) => t.academicSettingId !== targetWs.academicSettingId);
  current.atps = current.atps.filter((a) => a.academicSettingId !== targetWs.academicSettingId);
  current.k13Analyses = (current.k13Analyses || []).filter((k) => k.academicSettingId !== targetWs.academicSettingId);
  current.k13KKMs = (current.k13KKMs || []).filter((k) => k.academicSettingId !== targetWs.academicSettingId);

  if (current.activeWorkspaceId === workspaceId) {
    const remaining = current.workspaces.filter((w) => w.profileId === targetWs.profileId);
    current.activeWorkspaceId = remaining[0]?.id || current.workspaces[0]?.id;
  }

  saveAppStorage(current);
  return true;
}

export function saveProfile(profile: TeacherProfile): void {
  const current = loadAppStorage();

  const validSchoolId = profile.schoolId && current.schools.some((s) => s.id === profile.schoolId)
    ? profile.schoolId
    : undefined;
  const profileToSave: TeacherProfile = {
    ...profile,
    ...(validSchoolId ? { schoolId: validSchoolId } : { schoolId: undefined }),
  };

  const idx = current.profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    current.profiles[idx] = {
      ...profileToSave,
      updatedAt: new Date().toISOString(),
    };
  } else {
    current.profiles.push({
      ...profileToSave,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    current.activeProfileId = profile.id;
  }

  // 1 Profil Guru = 1 Sekolah Utama:
  // Explicit synchronization: Ensure all workspaces of this profile match profile.schoolId
  current.workspaces.forEach((w) => {
    if (w.profileId === profile.id) {
      w.schoolId = validSchoolId || '';
    }
  });

  // DO NOT create TeacherSchoolAssignment
  // DO NOT create SchoolData
  // DO NOT merge by NPSN

  saveAppStorage(current);
}

export function deleteProfile(profileId: string): void {
  const current = loadAppStorage();
  const targetProfile = current.profiles.find((p) => p.id === profileId);
  if (!targetProfile) return;

  // 1. Filter out the profile
  current.profiles = current.profiles.filter((p) => p.id !== profileId);

  // 2. Identify all associated workspaces and academic settings
  const targetWorkspaces = current.workspaces.filter((w) => w.profileId === profileId);
  const targetWsIds = new Set(targetWorkspaces.map((w) => w.id));
  const targetAcadSettingIds = new Set(
    current.academicSettings
      .filter((a) => a.profileId === profileId || targetWsIds.has(`ws-${a.id}`) || targetWorkspaces.some((w) => w.academicSettingId === a.id))
      .map((a) => a.id)
  );

  // 3. Cascading cleanup of all derived child records
  current.workspaces = current.workspaces.filter((w) => w.profileId !== profileId);
  current.academicSettings = current.academicSettings.filter((a) => !targetAcadSettingIds.has(a.id));
  current.cps = (current.cps || []).filter((c) => !targetAcadSettingIds.has(c.academicSettingId));
  current.cpAnalyses = (current.cpAnalyses || []).filter((ca) => !targetAcadSettingIds.has(ca.academicSettingId));
  current.tps = (current.tps || []).filter((t) => !targetAcadSettingIds.has(t.academicSettingId));
  current.atps = (current.atps || []).filter((a) => !targetAcadSettingIds.has(a.academicSettingId));
  current.documents = (current.documents || []).filter(
    (d) => (!d.workspaceId || !targetWsIds.has(d.workspaceId)) && (!d.academicSettingId || !targetAcadSettingIds.has(d.academicSettingId))
  );
  current.students = (current.students || []).filter((s) => !targetAcadSettingIds.has(s.academicSettingId));

  const targetCalendarIds = new Set(
    (current.academicCalendars || []).filter((c) => targetAcadSettingIds.has(c.academicSettingId)).map((c) => c.id)
  );
  current.academicCalendars = (current.academicCalendars || []).filter((c) => !targetAcadSettingIds.has(c.academicSettingId));
  current.effectiveDays = (current.effectiveDays || []).filter((e) => !targetCalendarIds.has(e.academicCalendarId));

  current.timeAllocations = (current.timeAllocations || []).filter((t) => !targetAcadSettingIds.has(t.academicSettingId));

  const targetSessionIds = new Set(
    (current.attendanceSessions || []).filter((s) => targetAcadSettingIds.has(s.academicSettingId)).map((s) => s.id)
  );
  current.attendanceSessions = (current.attendanceSessions || []).filter((s) => !targetAcadSettingIds.has(s.academicSettingId));
  current.attendanceRecords = (current.attendanceRecords || []).filter((a) => !targetSessionIds.has(a.sessionId));

  current.assessmentCriteria = (current.assessmentCriteria || []).filter((c) => !targetAcadSettingIds.has(c.academicSettingId));

  const targetAssessmentIds = new Set(
    (current.assessments || []).filter((a) => targetAcadSettingIds.has(a.academicSettingId)).map((a) => a.id)
  );
  current.assessments = (current.assessments || []).filter((a) => !targetAcadSettingIds.has(a.academicSettingId));
  current.assessmentResults = (current.assessmentResults || []).filter((a) => !targetAssessmentIds.has(a.assessmentId));

  current.remedialRecords = (current.remedialRecords || []).filter((r) => !targetAcadSettingIds.has(r.academicSettingId));
  current.enrichmentRecords = (current.enrichmentRecords || []).filter((e) => !targetAcadSettingIds.has(e.academicSettingId));
  current.k13Analyses = (current.k13Analyses || []).filter((k) => !targetAcadSettingIds.has(k.academicSettingId));
  current.k13KKMs = (current.k13KKMs || []).filter((k) => !targetAcadSettingIds.has(k.academicSettingId));
  current.learningPlans = (current.learningPlans || []).filter((l) => !targetAcadSettingIds.has(l.academicSettingId));
  current.assessmentPlans = (current.assessmentPlans || []).filter((a) => !targetAcadSettingIds.has(a.academicSettingId));
  current.assessmentPackages = (current.assessmentPackages || []).filter((a) => !targetAcadSettingIds.has(a.academicSettingId));

  // Note: current.schools is preserved! Master reusable SchoolData is NOT deleted.

  // 4. Update active profile & workspace pointers
  if (current.activeProfileId === profileId) {
    if (current.profiles.length > 0) {
      current.activeProfileId = current.profiles[0].id;
      const firstWs = current.workspaces.find((w) => w.profileId === current.activeProfileId);
      current.activeWorkspaceId = firstWs?.id || '';
    } else {
      current.activeProfileId = '';
      current.activeWorkspaceId = '';
    }
  } else {
    if (targetWsIds.has(current.activeWorkspaceId)) {
      const remainingWs = current.workspaces.find((w) => w.profileId === current.activeProfileId);
      current.activeWorkspaceId = remainingWs?.id || '';
    }
  }
  saveAppStorage(current);
}

export class DuplicateNpsnError extends Error {
  existingSchool: SchoolData;
  constructor(existingSchool: SchoolData) {
    super(`Sekolah dengan NPSN ${existingSchool.npsn} sudah ada (${existingSchool.name}).`);
    this.name = 'DuplicateNpsnError';
    this.existingSchool = existingSchool;
  }
}

export function getSchools(): SchoolData[] {
  const current = loadAppStorage();
  return current.schools || [];
}

export function getSchoolById(schoolId: string): SchoolData | undefined {
  const current = loadAppStorage();
  return (current.schools || []).find((s) => s.id === schoolId);
}

// Alias for compatibility
export const findSchool = getSchoolById;

export function findSchoolByNpsn(npsn: string): SchoolData | undefined {
  if (!npsn || !npsn.trim()) return undefined;
  const current = loadAppStorage();
  const cleanNpsn = npsn.trim();
  return (current.schools || []).find((s) => s.npsn && s.npsn.trim() === cleanNpsn);
}

export function createSchool(school: Omit<SchoolData, 'id' | 'createdAt' | 'updatedAt'> | SchoolData): SchoolData {
  const current = loadAppStorage();
  const trimmedNpsn = (school.npsn || '').trim();

  // If NPSN is provided, check for duplicates in master schools
  if (trimmedNpsn) {
    const existing = (current.schools || []).find((s) => s.npsn && s.npsn.trim() === trimmedNpsn);
    if (existing) {
      throw new DuplicateNpsnError(existing);
    }
  }

  const newId = `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const newSchool: SchoolData = {
    ...school,
    id: newId,
    createdAt: ('createdAt' in school && school.createdAt) ? school.createdAt : now,
    updatedAt: now,
  };

  current.schools.push(newSchool);

  // If principal name is specified on creation, initialize active principal history record
  if (newSchool.principalName && newSchool.principalName.trim()) {
    if (!current.principalHistories) current.principalHistories = [];
    current.principalHistories.push({
      id: `ph-${Date.now()}`,
      schoolId: newSchool.id,
      name: newSchool.principalName.trim(),
      nip: newSchool.principalNip?.trim() || '',
      startDate: now.slice(0, 10),
      isActive: true,
      source: newSchool.principalSource || 'Data Sekolah Baru',
      createdAt: now,
    });
  }

  saveAppStorage(current);
  return newSchool;
}

export function updateSchool(schoolOrId: string | SchoolData, updates?: Partial<SchoolData>): SchoolData {
  const current = loadAppStorage();
  const targetId = typeof schoolOrId === 'string' ? schoolOrId : schoolOrId.id;
  const updateData = typeof schoolOrId === 'string' ? (updates || {}) : schoolOrId;

  const existingIdx = current.schools.findIndex((s) => s.id === targetId);
  if (existingIdx < 0) {
    throw new Error(`Sekolah dengan ID ${targetId} tidak ditemukan.`);
  }

  const existing = current.schools[existingIdx];
  const updatedSchool: SchoolData = {
    ...existing,
    ...updateData,
    id: existing.id, // Mandatory: never change ID
    updatedAt: new Date().toISOString(),
  };
  current.schools[existingIdx] = updatedSchool;

  // Handle principal changes and archiving:
  if (updateData.principalName !== undefined && updateData.principalName.trim() !== '') {
    if (!current.principalHistories) current.principalHistories = [];
    const activeHist = current.principalHistories.find((h) => h.schoolId === updatedSchool.id && h.isActive);
    if (activeHist) {
      const isNameDiff = activeHist.name.trim() !== updatedSchool.principalName.trim();
      const isNipDiff = (activeHist.nip || '').trim() !== (updatedSchool.principalNip || '').trim();
      if (isNameDiff || isNipDiff) {
        activeHist.isActive = false;
        if (!activeHist.endDate) {
          activeHist.endDate = new Date().toISOString().slice(0, 10);
        }
        current.principalHistories.push({
          id: `ph-${Date.now()}`,
          schoolId: updatedSchool.id,
          name: updatedSchool.principalName.trim(),
          nip: updatedSchool.principalNip?.trim() || '',
          startDate: new Date().toISOString().slice(0, 10),
          isActive: true,
          source: updatedSchool.principalSource || 'Pembaruan Data Sekolah',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      current.principalHistories.push({
        id: `ph-${Date.now()}`,
        schoolId: updatedSchool.id,
        name: updatedSchool.principalName.trim(),
        nip: updatedSchool.principalNip?.trim() || '',
        startDate: new Date().toISOString().slice(0, 10),
        isActive: true,
        source: updatedSchool.principalSource || 'Pembaruan Data Sekolah',
        createdAt: new Date().toISOString(),
      });
    }
  }

  saveAppStorage(current);
  return updatedSchool;
}

/** @deprecated In v4, use explicit createSchool() or updateSchool() */
export function saveSchool(school: SchoolData, mode: 'create' | 'edit' = 'edit'): SchoolData {
  if (mode === 'create') {
    return createSchool(school);
  }
  return updateSchool(school.id, school);
}

export function deleteSchool(schoolId: string): boolean {
  const current = loadAppStorage();
  if (current.schools.length <= 1) return false;
  // Check if any profile is referencing this school as primary school
  const isUsedByProfile = current.profiles.some((p) => p.schoolId === schoolId);
  if (isUsedByProfile) return false;

  current.schools = current.schools.filter((s) => s.id !== schoolId);
  current.principalHistories = (current.principalHistories || []).filter((h) => h.schoolId !== schoolId);
  if (current.teacherSchoolAssignments) {
    current.teacherSchoolAssignments = current.teacherSchoolAssignments.filter((a) => a.schoolId !== schoolId);
  }
  saveAppStorage(current);
  return true;
}

// Legacy compatibility stubs (non-active data flow, deprecated)
/** @deprecated Non-active data flow. In v4, active school is strictly derived from activeProfile.schoolId */
export function assignSchoolToTeacher(teacherId: string, schoolId: string, role?: string): TeacherSchoolAssignment {
  return {
    id: `assign-${teacherId}-${schoolId}`,
    teacherId,
    schoolId,
    status: 'active',
    role: role || 'Guru Kelas / Mapel',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** @deprecated Non-active data flow */
export function unassignSchoolFromTeacher(_teacherId: string, _schoolId: string): boolean {
  return true;
}

/** @deprecated Non-active data flow. In v4, active school is strictly derived from activeProfile.schoolId */
export function setActiveSchool(_schoolId: string): void {
  // Deprecated: In v4, active school is strictly derived from activeProfile.schoolId
}

export function savePrincipalHistory(history: PrincipalHistory): void {
  const current = loadAppStorage();
  if (!current.principalHistories) current.principalHistories = [];
  const list = current.principalHistories;

  if (history.isActive) {
    list.forEach((h) => {
      if (h.schoolId === history.schoolId) {
        h.isActive = false;
      }
    });
  }

  const idx = list.findIndex((h) => h.id === history.id);
  if (idx >= 0) {
    list[idx] = history;
  } else {
    list.push(history);
  }

  // Only if set to active, sync active principal info back to SchoolData
  if (history.isActive) {
    const targetSchool = current.schools.find((s) => s.id === history.schoolId);
    if (targetSchool) {
      targetSchool.principalName = history.name;
      targetSchool.principalNip = history.nip;
      targetSchool.updatedAt = new Date().toISOString();
    }
  }

  saveAppStorage(current);
}

export function setActivePrincipal(schoolId: string, historyId: string): void {
  const current = loadAppStorage();
  if (!current.principalHistories) return;

  let activeItem: PrincipalHistory | undefined;
  current.principalHistories.forEach((h) => {
    if (h.schoolId === schoolId) {
      if (h.id === historyId) {
        h.isActive = true;
        activeItem = h;
      } else {
        h.isActive = false;
      }
    }
  });

  if (activeItem) {
    const targetSchool = current.schools.find((s) => s.id === schoolId);
    if (targetSchool) {
      targetSchool.principalName = activeItem.name;
      targetSchool.principalNip = activeItem.nip;
      targetSchool.updatedAt = new Date().toISOString();
    }
  }

  saveAppStorage(current);
}

export function deletePrincipalHistory(historyId: string): void {
  const current = loadAppStorage();
  current.principalHistories = (current.principalHistories || []).filter((h) => h.id !== historyId);
  saveAppStorage(current);
}

export function saveCPAnalysis(analysis: CPAnalysisData): void {
  const current = loadAppStorage();
  const oldAnalysis = (current.cpAnalyses || []).find((a) => a.academicSettingId === analysis.academicSettingId);
  const changeType = classifyCPAnalysisChange(oldAnalysis, analysis);
  const now = new Date().toISOString();
  const updatedAnalysis = {
    ...analysis,
    updatedAt: changeType === 'SUBSTANTIVE' || !oldAnalysis ? now : oldAnalysis.updatedAt,
  };
  const list = current.cpAnalyses || [];
  const idx = list.findIndex((a) => a.academicSettingId === analysis.academicSettingId);
  if (idx >= 0) {
    list[idx] = updatedAnalysis;
  } else {
    list.push(updatedAnalysis);
  }
  current.cpAnalyses = list;

  if (changeType === 'SUBSTANTIVE') {
    const tpIdx = (current.tps || []).findIndex((t) => t.academicSettingId === analysis.academicSettingId);
    if (tpIdx >= 0 && current.tps[tpIdx].items && current.tps[tpIdx].items.length > 0) {
      current.tps[tpIdx] = {
        ...current.tps[tpIdx],
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: 'Analisis CP rujukan berubah secara substantif.',
      };
    }
  }

  saveAppStorage(current);
}

export function saveAcademicSetting(
  setting: AcademicSetting,
  customWorkspaceName?: string,
  documentDate?: string
): boolean {
  if (documentDate !== undefined && documentDate !== '') {
    if (!isValidDocumentDate(documentDate)) {
      console.warn(`[storage] Invalid documentDate "${documentDate}" rejected.`);
      return false;
    }
  }

  const current = loadAppStorage();
  const derived = (setting.level && setting.grade) ? getPhaseFromGrade(setting.level, setting.grade) : '';
  const curType = getCurriculumTypeFromSetting(setting);
  const normalized: AcademicSetting = {
    ...setting,
    curriculumType: curType,
    phase: derived,
    updatedAt: new Date().toISOString(),
  };

  const idx = current.academicSettings.findIndex((a) => a.id === setting.id);
  const ws = current.workspaces.find((w) => w.academicSettingId === setting.id);

  if (idx >= 0) {
    current.academicSettings[idx] = normalized;
  } else {
    // Block orphan AcademicSetting: only allowed if an authoritative workspace links to this setting
    if (!ws) {
      console.warn(`[storage] Blocked attempt to persist orphan AcademicSetting ${setting.id} without authoritative workspace.`);
      return false;
    }
    current.academicSettings.push(normalized);
  }

  // Deterministic creation of empty containers when curriculum is chosen
  if (curType === 'KURIKULUM_MERDEKA') {
    if (!current.cps.some((c) => c.academicSettingId === setting.id)) {
      current.cps.push({
        id: `cp-${setting.id}`,
        academicSettingId: setting.id,
        generalDescription: '',
        elements: [],
        updatedAt: new Date().toISOString(),
      });
    }
    if (!current.tps.some((t) => t.academicSettingId === setting.id)) {
      current.tps.push({
        id: `tp-${setting.id}`,
        academicSettingId: setting.id,
        items: [],
        updatedAt: new Date().toISOString(),
      });
    }
    if (!current.atps.some((a) => a.academicSettingId === setting.id)) {
      current.atps.push({
        id: `atp-${setting.id}`,
        academicSettingId: setting.id,
        rationale: '',
        items: [],
        totalJP: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  } else if (curType === 'K13') {
    current.k13Analyses = current.k13Analyses || [];
    if (!current.k13Analyses.some((k) => k.academicSettingId === setting.id)) {
      current.k13Analyses.push({
        id: `k13-ana-${setting.id}`,
        academicSettingId: setting.id,
        items: [],
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Sync workspace name and documentDate
  if (ws) {
    ws.name = customWorkspaceName && customWorkspaceName.trim().length > 0
      ? customWorkspaceName.trim()
      : generateWorkspaceName(normalized);
    if (documentDate !== undefined) {
      ws.documentDate = documentDate ? documentDate : undefined;
    }
    ws.updatedAt = new Date().toISOString();
  }

  saveAppStorage(current);
  return true;
}

export function saveCP(cp: CPData): void {
  const current = loadAppStorage();
  const oldCP = current.cps.find((c) => c.academicSettingId === cp.academicSettingId);
  const changeType = classifyCPChange(oldCP, cp);
  const now = new Date().toISOString();
  const updatedCP = {
    ...cp,
    updatedAt: changeType === 'SUBSTANTIVE' || !oldCP ? now : oldCP.updatedAt,
  };
  const idx = current.cps.findIndex((c) => c.academicSettingId === cp.academicSettingId);
  if (idx >= 0) {
    current.cps[idx] = updatedCP;
  } else {
    current.cps.push(updatedCP);
  }

  if (changeType === 'SUBSTANTIVE') {
    current.cpAnalyses = (current.cpAnalyses || []).map((analysis) => {
      if (analysis.academicSettingId !== cp.academicSettingId) return analysis;
      return {
        ...analysis,
        needsReview: true,
        reviewReason: 'Capaian Pembelajaran (CP) rujukan berubah secara substantif.',
      };
    });

    const tpIdx = (current.tps || []).findIndex((t) => t.academicSettingId === cp.academicSettingId);
    if (tpIdx >= 0 && current.tps[tpIdx].items && current.tps[tpIdx].items.length > 0) {
      current.tps[tpIdx] = {
        ...current.tps[tpIdx],
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: 'Capaian Pembelajaran (CP) rujukan berubah secara substantif.',
      };
    }
  }

  saveAppStorage(current);
}

export function saveTP(tp: TPData): void {
  const current = loadAppStorage();
  const oldTP = current.tps.find((t) => t.academicSettingId === tp.academicSettingId);
  const changeType = classifyTPChange(oldTP, tp);
  const now = new Date().toISOString();
  const updatedTP = {
    ...tp,
    updatedAt: changeType === 'SUBSTANTIVE' || !oldTP ? now : oldTP.updatedAt,
  };
  const idx = current.tps.findIndex((t) => t.academicSettingId === tp.academicSettingId);
  if (idx >= 0) {
    current.tps[idx] = updatedTP;
  } else {
    current.tps.push(updatedTP);
  }

  const changedTpIds = getChangedTPItemIds(oldTP, updatedTP);

  if (changeType === 'SUBSTANTIVE') {
    const atpIdx = (current.atps || []).findIndex((a) => a.academicSettingId === tp.academicSettingId);
    let atpBecameStale = false;
    if (atpIdx >= 0 && current.atps[atpIdx].items && current.atps[atpIdx].items.length > 0) {
      const atpObj = current.atps[atpIdx];
      current.atps[atpIdx] = {
        ...atpObj,
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: 'Tujuan Pembelajaran (TP) acuan telah berubah secara substantif, alur ATP perlu ditinjau ulang.',
      };
      atpBecameStale = true;
    }

    if (current.assessmentCriteria && current.assessmentCriteria.length > 0) {
      current.assessmentCriteria = current.assessmentCriteria.map((c) => {
        if (c.academicSettingId === tp.academicSettingId && changedTpIds.has(c.tpId)) {
          return {
            ...c,
            needsReview: true,
            reviewReason: 'Tujuan Pembelajaran (TP) acuan telah berubah secara substantif. Kriteria ketercapaian perlu ditinjau ulang.',
            workflowStatus: 'PERLU_DILENGKAPI',
          };
        }
        return c;
      });
    }

    current.learningPlans = (current.learningPlans || []).map((plan) => {
      if (plan.academicSettingId !== tp.academicSettingId || plan.status !== 'SIAP') return plan;
      const isAtpLinked = (plan.atpItemIds || []).length > 0;
      const shouldInvalidate = isAtpLinked
        ? atpBecameStale
        : (plan.tpIds || []).some((id) => changedTpIds.has(id));
      if (!shouldInvalidate) return plan;
      return {
        ...plan,
        status: 'PERLU_DILENGKAPI',
        confirmedAt: undefined,
        updatedAt: now,
      };
    });

    current.assessmentPlans = (current.assessmentPlans || []).map((plan) => {
      if (plan.academicSettingId !== tp.academicSettingId) return plan;
      const referenced = (plan.tpIds || []).some((id) => changedTpIds.has(id));
      if (!referenced) return plan;
      return {
        ...plan,
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: 'Tujuan Pembelajaran (TP) acuan berubah secara substantif.',
        updatedAt: now,
      };
    });

    const affectedAssessmentPlanIds = new Set(
      (current.assessmentPlans || [])
        .filter((plan) => plan.academicSettingId === tp.academicSettingId && (plan.tpIds || []).some((id) => changedTpIds.has(id)))
        .map((plan) => plan.id)
    );
    current.assessmentPackages = (current.assessmentPackages || []).map((pkg) => {
      const blueprintRefsTp = (pkg.blueprintItems || []).some((item) => changedTpIds.has(item.objectiveRefId));
      if (pkg.academicSettingId !== tp.academicSettingId || (!affectedAssessmentPlanIds.has(pkg.assessmentPlanId) && !blueprintRefsTp)) return pkg;
      return {
        ...pkg,
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: 'Tujuan Pembelajaran (TP) acuan berubah secara substantif.',
        updatedAt: now,
      };
    });
  }

  saveAppStorage(current);
}

export function saveATP(atp: ATPData): void {
  const current = loadAppStorage();
  const tp = current.tps.find((t) => t.academicSettingId === atp.academicSettingId);
  const oldATP = current.atps.find((a) => a.academicSettingId === atp.academicSettingId);
  const normalizedATP = normalizeATPReferences(atp, tp);
  const changeType = classifyATPChange(oldATP, normalizedATP);
  const now = new Date().toISOString();

  const val = validateATPDataWorkflow(normalizedATP, tp);
  const hasUnknownJP = (normalizedATP?.items || []).some((item) => item.jp === undefined || item.jp === null);
  const knownTotalJP = (normalizedATP?.items || []).reduce(
    (acc, curr) => acc + (curr.jp !== undefined && curr.jp !== null ? Number(curr.jp) : 0),
    0
  );

  const updatedATP: ATPData = {
    ...normalizedATP,
    tpDataId: tp?.id || normalizedATP.tpDataId || normalizedATP.tpId,
    tpId: tp?.id || normalizedATP.tpId,
    academicYear: atp.academicYear || tp?.academicYear,
    subjectCode: atp.subjectCode || tp?.subjectCode,
    phase: atp.phase || tp?.phase,
    totalJP: knownTotalJP,
    knownTotalJP,
    hasUnknownJP,
    allocationComplete: !hasUnknownJP,
    workflowStatus: val.status,
    needsReview: atp.needsReview === true && atp.workflowStatus !== 'SIAP' ? true : val.issues.length > 0 ? true : false,
    reviewReason: atp.needsReview === true && atp.workflowStatus !== 'SIAP' ? atp.reviewReason : val.issues.length > 0 ? val.issues.join('; ') : undefined,
    basedOnTpUpdatedAt: atp.basedOnTpUpdatedAt,
    updatedAt: changeType === 'SUBSTANTIVE' || !oldATP ? now : oldATP.updatedAt,
  };

  const idx = current.atps.findIndex((a) => a.academicSettingId === atp.academicSettingId);
  if (idx >= 0) {
    current.atps[idx] = updatedATP;
  } else {
    current.atps.push(updatedATP);
  }

  const affectedAtpItemIds = new Set([
    ...(oldATP?.items || []).map((item) => item.id),
    ...(updatedATP.items || []).map((item) => item.id),
  ]);
  const affectedTpIds = new Set([
    ...(oldATP?.items || []).map((item) => item.tpId).filter(Boolean) as string[],
    ...(updatedATP.items || []).map((item) => item.tpId).filter(Boolean) as string[],
  ]);
  if (changeType === 'SUBSTANTIVE') {
    current.learningPlans = (current.learningPlans || []).map((plan) => {
      if (plan.academicSettingId !== atp.academicSettingId || plan.status !== 'SIAP') return plan;
      const referencesAtp = (plan.atpItemIds || []).some((id) => affectedAtpItemIds.has(id));
      const referencesTp = (plan.tpIds || []).some((id) => affectedTpIds.has(id));
      if (!referencesAtp && !referencesTp) return plan;
      return {
        ...plan,
        status: 'PERLU_DILENGKAPI',
        confirmedAt: undefined,
        updatedAt: now,
      };
    });
  }

  saveAppStorage(current);
}

export function saveDocumentRecord(doc: AppDocumentRecord): void {
  const current = loadAppStorage();
  const idx = current.documents.findIndex((d) => d.id === doc.id || (d.type === doc.type && d.workspaceId === doc.workspaceId));
  if (idx >= 0) {
    current.documents[idx] = doc;
  } else {
    current.documents.push(doc);
  }
  saveAppStorage(current);
}

export function saveDocuments(docs: AppDocumentRecord[]): void {
  const current = loadAppStorage();
  current.documents = docs;
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: STUDENTS
// ==========================================
export function saveStudents(academicSettingId: string, students: Student[]): void {
  const current = loadAppStorage();
  current.students = [
    ...(current.students || []).filter((s) => s.academicSettingId !== academicSettingId),
    ...students,
  ];
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: ACADEMIC CALENDAR & DAYS
// ==========================================
export function saveAcademicCalendar(calendar: AcademicCalendar, days?: CalendarDay[]): void {
  const current = loadAppStorage();
  const cIdx = (current.academicCalendars || []).findIndex((c) => c.id === calendar.id || c.academicSettingId === calendar.academicSettingId);
  if (cIdx >= 0) {
    current.academicCalendars![cIdx] = calendar;
  } else {
    current.academicCalendars = [...(current.academicCalendars || []), calendar];
  }

  if (days) {
    current.effectiveDays = [
      ...(current.effectiveDays || []).filter((d) => d.academicCalendarId !== calendar.id),
      ...days,
    ];
  }
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: TIME ALLOCATIONS
// ==========================================
export function saveTimeAllocations(academicSettingId: string, allocations: TimeAllocation[]): void {
  const current = loadAppStorage();
  current.timeAllocations = [
    ...(current.timeAllocations || []).filter((t) => t.academicSettingId !== academicSettingId),
    ...allocations,
  ];
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: ATTENDANCE
// ==========================================
export function saveAttendanceSession(session: AttendanceSession, records: AttendanceRecord[]): void {
  const current = loadAppStorage();
  const sIdx = (current.attendanceSessions || []).findIndex((s) => s.id === session.id);
  if (sIdx >= 0) {
    current.attendanceSessions![sIdx] = session;
  } else {
    current.attendanceSessions = [...(current.attendanceSessions || []), session];
  }

  current.attendanceRecords = [
    ...(current.attendanceRecords || []).filter((r) => r.sessionId !== session.id),
    ...records,
  ];
  saveAppStorage(current);
}

export function deleteAttendanceSession(sessionId: string): void {
  const current = loadAppStorage();
  current.attendanceSessions = (current.attendanceSessions || []).filter((s) => s.id !== sessionId);
  current.attendanceRecords = (current.attendanceRecords || []).filter((r) => r.sessionId !== sessionId);
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: KKTP (CRITERIA)
// ==========================================
function persistAssessmentCriteriaForSetting(
  current: AppStorageState,
  academicSettingId: string | undefined,
  criteria: AssessmentCriterion[]
): void {
  const oldCriteria = academicSettingId
    ? (current.assessmentCriteria || []).filter((c) => c.academicSettingId === academicSettingId)
    : (current.assessmentCriteria || []).filter((c) => criteria.some((next) => next.id === c.id));
  const changeType = classifyAssessmentCriteriaChange(oldCriteria, criteria);
  const changedCriterionIds = getChangedAssessmentCriterionIds(oldCriteria, criteria);
  const now = new Date().toISOString();

  if (academicSettingId) {
    current.assessmentCriteria = [
      ...(current.assessmentCriteria || []).filter((c) => c.academicSettingId !== academicSettingId),
      ...criteria,
    ];
  } else {
    // Merge by id
    const existingMap = new Map((current.assessmentCriteria || []).map((c) => [c.id, c]));
    criteria.forEach((c) => existingMap.set(c.id, c));
    current.assessmentCriteria = Array.from(existingMap.values());
  }

  if (academicSettingId && changeType === 'SUBSTANTIVE') {
    current.assessmentPlans = (current.assessmentPlans || []).map((plan) => {
      if (plan.academicSettingId !== academicSettingId) return plan;
      const referenced = (plan.criterionIds || []).some((id) => changedCriterionIds.has(id));
      if (!referenced) return plan;
      return {
        ...plan,
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: 'Kriteria ketercapaian (KKTP) berubah secara substantif.',
        updatedAt: now,
      };
    });
    const affectedPlanIds = new Set(
      (current.assessmentPlans || [])
        .filter((plan) => plan.academicSettingId === academicSettingId && (plan.criterionIds || []).some((id) => changedCriterionIds.has(id)))
        .map((plan) => plan.id)
    );
    current.assessmentPackages = (current.assessmentPackages || []).map((pkg) => {
      const blueprintRefsCriterion = (pkg.blueprintItems || []).some((item) => changedCriterionIds.has((item as any).criterionId || ''));
      if (pkg.academicSettingId !== academicSettingId || (!affectedPlanIds.has(pkg.assessmentPlanId) && !blueprintRefsCriterion)) return pkg;
      return {
        ...pkg,
        workflowStatus: 'PERLU_DILENGKAPI',
        needsReview: true,
        reviewReason: 'Kriteria ketercapaian (KKTP) berubah secara substantif.',
        updatedAt: now,
      };
    });
  }
}

export function saveAssessmentCriteria(criteria: AssessmentCriterion[]): void {
  const current = loadAppStorage();
  const academicSettingId = criteria[0]?.academicSettingId;
  persistAssessmentCriteriaForSetting(current, academicSettingId, criteria);
  saveAppStorage(current);
}

export function saveAssessmentCriterion(criterion: AssessmentCriterion): void {
  const current = loadAppStorage();
  const settingCriteria = (current.assessmentCriteria || []).filter((c) => c.academicSettingId === criterion.academicSettingId);
  const idx = settingCriteria.findIndex((c) => c.id === criterion.id);
  const nextCriteria = idx >= 0
    ? settingCriteria.map((c) => c.id === criterion.id ? criterion : c)
    : [...settingCriteria, criterion];
  persistAssessmentCriteriaForSetting(current, criterion.academicSettingId, nextCriteria);
  saveAppStorage(current);
}

export function deleteAssessmentCriterion(criterionId: string): void {
  const current = loadAppStorage();
  const deleted = (current.assessmentCriteria || []).find((c) => c.id === criterionId);
  if (!deleted) {
    saveAppStorage(current);
    return;
  }
  const nextCriteria = (current.assessmentCriteria || [])
    .filter((c) => c.academicSettingId === deleted.academicSettingId && c.id !== criterionId);
  persistAssessmentCriteriaForSetting(current, deleted.academicSettingId, nextCriteria);
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: ASSESSMENTS & RESULTS
// ==========================================
export function saveAssessment(assessment: Assessment, results?: AssessmentResult[]): void {
  const current = loadAppStorage();
  const idx = (current.assessments || []).findIndex((a) => a.id === assessment.id);
  if (idx >= 0) {
    current.assessments![idx] = assessment;
  } else {
    current.assessments = [...(current.assessments || []), assessment];
  }

  if (results) {
    current.assessmentResults = [
      ...(current.assessmentResults || []).filter((r) => r.assessmentId !== assessment.id),
      ...results,
    ];
  }
  saveAppStorage(current);
}

export function deleteAssessment(assessmentId: string): void {
  const current = loadAppStorage();
  current.assessments = (current.assessments || []).filter((a) => a.id !== assessmentId);
  current.assessmentResults = (current.assessmentResults || []).filter((r) => r.assessmentId !== assessmentId);
  // Also clean up linked remedials & enrichments
  current.remedialRecords = (current.remedialRecords || []).filter((r) => r.sourceAssessmentId !== assessmentId);
  current.enrichmentRecords = (current.enrichmentRecords || []).filter((e) => e.sourceAssessmentId !== assessmentId);
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: REMEDIAL & ENRICHMENT
// ==========================================
export function saveRemedialRecords(records: RemedialRecord[]): void {
  const current = loadAppStorage();
  const settingId = records[0]?.academicSettingId;
  if (settingId) {
    current.remedialRecords = [
      ...(current.remedialRecords || []).filter((r) => r.academicSettingId !== settingId),
      ...records,
    ];
  } else {
    const existingMap = new Map((current.remedialRecords || []).map((r) => [r.id, r]));
    records.forEach((r) => existingMap.set(r.id, r));
    current.remedialRecords = Array.from(existingMap.values());
  }
  saveAppStorage(current);
}

export function saveRemedialRecord(record: RemedialRecord): void {
  const current = loadAppStorage();
  const idx = (current.remedialRecords || []).findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    current.remedialRecords![idx] = record;
  } else {
    current.remedialRecords = [...(current.remedialRecords || []), record];
  }
  saveAppStorage(current);
}

export function deleteRemedialRecord(recordId: string): void {
  const current = loadAppStorage();
  current.remedialRecords = (current.remedialRecords || []).filter((r) => r.id !== recordId);
  saveAppStorage(current);
}

export function saveEnrichmentRecords(records: EnrichmentRecord[]): void {
  const current = loadAppStorage();
  const settingId = records[0]?.academicSettingId;
  if (settingId) {
    current.enrichmentRecords = [
      ...(current.enrichmentRecords || []).filter((e) => e.academicSettingId !== settingId),
      ...records,
    ];
  } else {
    const existingMap = new Map((current.enrichmentRecords || []).map((e) => [e.id, e]));
    records.forEach((e) => existingMap.set(e.id, e));
    current.enrichmentRecords = Array.from(existingMap.values());
  }
  saveAppStorage(current);
}

export function saveEnrichmentRecord(record: EnrichmentRecord): void {
  const current = loadAppStorage();
  const idx = (current.enrichmentRecords || []).findIndex((e) => e.id === record.id);
  if (idx >= 0) {
    current.enrichmentRecords![idx] = record;
  } else {
    current.enrichmentRecords = [...(current.enrichmentRecords || []), record];
  }
  saveAppStorage(current);
}

export function deleteEnrichmentRecord(recordId: string): void {
  const current = loadAppStorage();
  current.enrichmentRecords = (current.enrichmentRecords || []).filter((e) => e.id !== recordId);
  saveAppStorage(current);
}

// ==========================================
// SCOPED CRUD: K13 ADMINISTRATION
// ==========================================
export function saveK13Analysis(analysis: K13Analysis): void {
  const current = loadAppStorage();
  const idx = (current.k13Analyses || []).findIndex((k) => k.academicSettingId === analysis.academicSettingId);
  if (idx >= 0) {
    current.k13Analyses![idx] = analysis;
  } else {
    current.k13Analyses = [...(current.k13Analyses || []), analysis];
  }
  saveAppStorage(current);
}

export function saveK13KKM(kkm: K13KKM): void {
  const current = loadAppStorage();
  const idx = (current.k13KKMs || []).findIndex((k) => k.academicSettingId === kkm.academicSettingId);
  if (idx >= 0) {
    current.k13KKMs![idx] = kkm;
  } else {
    current.k13KKMs = [...(current.k13KKMs || []), kkm];
  }
  saveAppStorage(current);
}

export function exportAppDataAsJSON(): void {
  const state = loadAppStorage();
  const jsonStr = JSON.stringify(
    {
      app: 'Administrasi Guru AI',
      exportDate: new Date().toISOString(),
      data: state,
    },
    null,
    2
  );
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const dateTag = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Backup_Administrasi_Guru_AI_${dateTag}.json`);
}

export function importAppDataFromJSON(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    const data = parsed.data || parsed;
    if (!data.profiles || !Array.isArray(data.profiles) || data.profiles.length === 0) {
      return false;
    }
    const state: AppStorageState = {
      version: 3,
      activeProfileId: data.activeProfileId || data.profiles[0].id,
      activeWorkspaceId: data.activeWorkspaceId,
      profiles: data.profiles,
      schools: data.schools || [],
      principalHistories: data.principalHistories || [],
      workspaces: data.workspaces || [],
      academicSettings: data.academicSettings || [],
      cps: data.cps || [],
      cpAnalyses: data.cpAnalyses || [],
      tps: data.tps || [],
      atps: data.atps || [],
      documents: data.documents || [],
      students: data.students || [],
      academicCalendars: data.academicCalendars || [],
      effectiveDays: data.effectiveDays || [],
      timeAllocations: data.timeAllocations || [],
      attendanceSessions: data.attendanceSessions || [],
      attendanceRecords: data.attendanceRecords || [],
      assessmentCriteria: data.assessmentCriteria || [],
      assessments: data.assessments || [],
      assessmentResults: data.assessmentResults || [],
      remedialRecords: data.remedialRecords || [],
      enrichmentRecords: data.enrichmentRecords || [],
      k13Analyses: data.k13Analyses || [],
      k13KKMs: data.k13KKMs || [],
      learningPlans: Array.isArray(data.learningPlans)
        ? data.learningPlans.map((lp: any) => migrateLegacyLearningPlan(lp, lp.academicSettingId || ''))
        : [],
      assessmentPlans: Array.isArray(data.assessmentPlans) ? data.assessmentPlans : [],
    };
    saveAppStorage(state);
    return true;
  } catch (err) {
    console.error('Failed to parse import JSON:', err);
    return false;
  }
}

export function saveLearningPlan(plan: LearningPlan): void {
  const state = loadAppStorage();
  if (!state.learningPlans) state.learningPlans = [];
  const idx = state.learningPlans.findIndex((p) => p.id === plan.id);
  const tp = state.tps.find((t) => t.academicSettingId === plan.academicSettingId);
  const atp = state.atps.find((a) => a.academicSettingId === plan.academicSettingId);
  const k13Analysis = (state.k13Analyses || []).find((k) => k.academicSettingId === plan.academicSettingId);
  const objectives = resolveLearningPlanObjectives({
    tpIds: plan.tpIds,
    tp,
    k13Analysis,
    curriculumType: plan.curriculumType,
  }).objectives;
  const jpResolution = resolveLearningPlanAllocatedJP(plan, {
    atp,
    timeAllocations: state.timeAllocations || [],
  });
  const updatedPlan: LearningPlan = {
    ...plan,
    objectives,
    timeAllocationIds: jpResolution.timeAllocationIds || [],
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    state.learningPlans[idx] = updatedPlan;
  } else {
    state.learningPlans.push(updatedPlan);
  }
  saveAppStorage(state);
}

export function deleteLearningPlan(planId: string): void {
  const state = loadAppStorage();
  if (!state.learningPlans) return;
  state.learningPlans = state.learningPlans.filter((p) => p.id !== planId);
  saveAppStorage(state);
}

export function getLearningPlansForSetting(academicSettingId: string): LearningPlan[] {
  const state = loadAppStorage();
  return (state.learningPlans || []).filter((p) => p.academicSettingId === academicSettingId);
}

export function saveAssessmentPlan(plan: AssessmentPlan): void {
  const state = loadAppStorage();
  persistAssessmentPlanWithPackageInvalidation(state, plan);
  saveAppStorage(state);
}

export function deleteAssessmentPlan(planId: string): void {
  const state = loadAppStorage();
  if (!state.assessmentPlans) return;
  const now = new Date().toISOString();
  state.assessmentPlans = state.assessmentPlans.filter((p) => p.id !== planId);
  invalidatePackagesForAssessmentPlan(state, planId, 'Parent AssessmentPlan telah dihapus.', now);
  saveAppStorage(state);
}

export function getAssessmentPlansForSetting(academicSettingId: string): AssessmentPlan[] {
  const state = loadAppStorage();
  return (state.assessmentPlans || []).filter((p) => p.academicSettingId === academicSettingId);
}

function stablePlanFingerprint(plan?: AssessmentPlan | null): string {
  if (!plan) return '';
  return JSON.stringify({
    title: plan.title || '',
    purpose: plan.purpose,
    timing: plan.timing,
    scopeType: plan.scopeType,
    tpIds: [...(plan.tpIds || [])].sort(),
    criterionIds: [...(plan.criterionIds || [])].sort(),
    instruments: (plan.instruments || []).map((instrument) => ({
      id: instrument.id,
      type: instrument.type,
      label: instrument.label || '',
    })).sort((a, b) => a.id.localeCompare(b.id)),
    displayLabel: plan.displayLabel || '',
    customTimingLabel: plan.customTimingLabel || '',
    customScopeLabel: plan.customScopeLabel || '',
  });
}

function invalidatePackagesForAssessmentPlan(state: AppStorageState, planId: string, reason: string, now: string): void {
  state.assessmentPackages = (state.assessmentPackages || []).map((pkg) => {
    if (pkg.assessmentPlanId !== planId) return pkg;
    return {
      ...pkg,
      workflowStatus: 'PERLU_DILENGKAPI',
      needsReview: true,
      reviewReason: reason,
      updatedAt: now,
    };
  });
}

function persistAssessmentPlanWithPackageInvalidation(state: AppStorageState, plan: AssessmentPlan): void {
  if (!state.assessmentPlans) state.assessmentPlans = [];
  const idx = state.assessmentPlans.findIndex((p) => p.id === plan.id);
  const oldPlan = idx >= 0 ? state.assessmentPlans[idx] : undefined;
  const now = new Date().toISOString();
  const updatedPlan: AssessmentPlan = {
    ...plan,
    updatedAt: now,
  };
  const parentBecameInvalid = !!oldPlan &&
    oldPlan.workflowStatus === 'SIAP' &&
    oldPlan.needsReview !== true &&
    (updatedPlan.workflowStatus !== 'SIAP' || updatedPlan.needsReview === true);
  const substantiveChanged = !!oldPlan && stablePlanFingerprint(oldPlan) !== stablePlanFingerprint(updatedPlan);

  if (idx >= 0) {
    state.assessmentPlans[idx] = updatedPlan;
  } else {
    state.assessmentPlans.push(updatedPlan);
  }

  if (parentBecameInvalid || substantiveChanged) {
    invalidatePackagesForAssessmentPlan(
      state,
      updatedPlan.id,
      parentBecameInvalid
        ? 'Parent AssessmentPlan belum SIAP atau memerlukan review.'
        : 'Parent AssessmentPlan berubah secara substantif.',
      now
    );
  }
}

export function saveAssessmentPlansBulk(plans: AssessmentPlan[]): void {
  const state = loadAppStorage();
  plans.forEach((plan) => persistAssessmentPlanWithPackageInvalidation(state, plan));
  saveAppStorage(state);
}

export function saveAssessmentPackage(pkg: AssessmentPackage): void {
  const state = loadAppStorage();
  if (!state.assessmentPackages) state.assessmentPackages = [];
  const idx = state.assessmentPackages.findIndex((p) => p.id === pkg.id);
  const updatedPkg: AssessmentPackage = {
    ...pkg,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    state.assessmentPackages[idx] = updatedPkg;
  } else {
    state.assessmentPackages.push(updatedPkg);
  }
  saveAppStorage(state);
}

export function deleteAssessmentPackage(packageId: string): void {
  const state = loadAppStorage();
  if (!state.assessmentPackages) return;
  state.assessmentPackages = state.assessmentPackages.filter((p) => p.id !== packageId);
  saveAppStorage(state);
}

export function getAssessmentPackagesForSetting(academicSettingId: string): AssessmentPackage[] {
  const state = loadAppStorage();
  return (state.assessmentPackages || []).filter((p) => p.academicSettingId === academicSettingId);
}

export function resetToDefaultData(): void {
  const initial = getInitialState();
  saveAppStorage(initial);
}
