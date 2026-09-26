import {
  AppStorageStateV5,
  StorageBackupV5,
  STORAGE_KEY_V5,
  AdministrationWorkspaceV5,
  YearScopedEntry,
  SemesterScopedEntry,
  SemesterCalendarEntry,
  SemesterAttendanceEntry,
  SemesterGradeEntry,
} from '../types/storageV5';
import {
  TeacherProfile,
  SchoolData,
  PrincipalHistory,
  YearPlan,
  SemesterPlan,
  CurriculumType,
  CPData,
  CPAnalysisData,
  TPData,
  ATPData,
  CurriculumContextLock,
  AnnualJPReference,
  SemesterJPSetting,
  TimeAllocation,
  LearningPlan,
  AssessmentCriterion,
  AssessmentPlan,
  AssessmentPackage,
  Student,
  RemedialRecord,
  EnrichmentRecord,
} from '../types';

export { STORAGE_KEY_V5 };

export interface AnnualDataV5Result {
  yearPlan: YearPlan;
  cp: CPData | undefined;
  cpAnalysis: CPAnalysisData | undefined;
  tp: TPData | undefined;
  atp: ATPData | undefined;
  curriculumContext: CurriculumContextLock | undefined;
  annualJPReference: AnnualJPReference | undefined;
}

export interface SemesterDataV5Result {
  semesterPlan: SemesterPlan;
  yearPlan: YearPlan;
  semesterJPSetting: SemesterJPSetting | undefined;
  academicCalendar: SemesterCalendarEntry | undefined;
  timeAllocation: TimeAllocation[] | undefined;
  learningPlan: LearningPlan[] | undefined;
  assessmentCriteria: AssessmentCriterion[] | undefined;
  assessmentPlan: AssessmentPlan[] | undefined;
  assessmentPackage: AssessmentPackage[] | undefined;
  roster: Student[] | undefined;
  attendance: SemesterAttendanceEntry | undefined;
  grade: SemesterGradeEntry | undefined;
  remedial: RemedialRecord[] | undefined;
  enrichment: EnrichmentRecord[] | undefined;
}

export interface CreateYearHierarchyV5Params {
  profileId: string;
  schoolId: string;
  academicYear: string;
  curriculumType: CurriculumType;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
  grade: string;
  classSection?: string;
  subject: string;
  subjectCode?: string;
  phase?: string;
  workspaceName?: string;
  documentDate?: string;
}

export interface CreateYearHierarchyV5Result {
  yearPlan: YearPlan;
  workspace: AdministrationWorkspaceV5;
  semesterPlans: [SemesterPlan, SemesterPlan];
}

/**
 * Creates an empty, canonical initial state for Storage V5.
 */
export function createInitialStorageV5(): AppStorageStateV5 {
  return {
    schemaVersion: 5,
    profiles: [],
    schools: [],
    principalHistories: [],
    workspaces: [],
    yearPlans: [],
    semesterPlans: [],
    annualJPReferences: [],
    semesterJPSettings: [],
    annualData: {
      cp: [],
      cpAnalysis: [],
      tp: [],
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
}

/**
 * Helper to assert that a property is an array.
 */
function assertArray(obj: Record<string, unknown>, key: string, containerName: string): void {
  if (!Array.isArray(obj[key])) {
    throw new Error(
      `Invalid storage format: "${containerName}.${key}" must be an array, received ${typeof obj[
        key
      ]}`
    );
  }
}

/**
 * Helper to assert that a property is a non-null object.
 */
function assertObject(
  obj: Record<string, unknown>,
  key: string,
  containerName: string
): Record<string, unknown> {
  const val = obj[key];
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(
      `Invalid storage format: "${containerName}.${key}" must be an object, received ${
        Array.isArray(val) ? 'array' : typeof val
      }`
    );
  }
  return val as Record<string, unknown>;
}

/**
 * Validates that an unknown value conforms strictly to AppStorageStateV5,
 * including structural checks, root ID uniqueness, and relational integrity.
 * Does not mutate, drop, or normalize fields.
 */
export function validateStorageStateV5(value: unknown): AppStorageStateV5 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid storage state: root must be a non-null object');
  }

  const state = value as Record<string, unknown>;

  if (state.schemaVersion !== 5) {
    throw new Error(
      `Invalid schemaVersion: expected 5, received "${String(state.schemaVersion)}"`
    );
  }

  // Validate root collection arrays
  assertArray(state, 'profiles', 'data');
  assertArray(state, 'schools', 'data');
  assertArray(state, 'principalHistories', 'data');
  assertArray(state, 'workspaces', 'data');
  assertArray(state, 'yearPlans', 'data');
  assertArray(state, 'semesterPlans', 'data');
  assertArray(state, 'annualJPReferences', 'data');
  assertArray(state, 'semesterJPSettings', 'data');
  assertArray(state, 'documents', 'data');

  // Validate annualData structure & collections
  const annualData = assertObject(state, 'annualData', 'data');
  assertArray(annualData, 'cp', 'data.annualData');
  assertArray(annualData, 'cpAnalysis', 'data.annualData');
  assertArray(annualData, 'tp', 'data.annualData');
  assertArray(annualData, 'atp', 'data.annualData');
  assertArray(annualData, 'curriculumContext', 'data.annualData');

  // Validate semesterData structure & collections
  const semesterData = assertObject(state, 'semesterData', 'data');
  assertArray(semesterData, 'academicCalendar', 'data.semesterData');
  assertArray(semesterData, 'timeAllocation', 'data.semesterData');
  assertArray(semesterData, 'learningPlan', 'data.semesterData');
  assertArray(semesterData, 'assessmentCriteria', 'data.semesterData');
  assertArray(semesterData, 'assessmentPlan', 'data.semesterData');
  assertArray(semesterData, 'assessmentPackage', 'data.semesterData');
  assertArray(semesterData, 'roster', 'data.semesterData');
  assertArray(semesterData, 'attendance', 'data.semesterData');
  assertArray(semesterData, 'grade', 'data.semesterData');
  assertArray(semesterData, 'remedial', 'data.semesterData');
  assertArray(semesterData, 'enrichment', 'data.semesterData');

  // Cast arrays for relational validation
  const profiles = state.profiles as Array<Record<string, unknown>>;
  const schools = state.schools as Array<Record<string, unknown>>;
  const principalHistories = (state.principalHistories || []) as Array<Record<string, unknown>>;
  const workspaces = state.workspaces as Array<Record<string, unknown>>;
  const yearPlans = state.yearPlans as Array<Record<string, unknown>>;
  const semesterPlans = state.semesterPlans as Array<Record<string, unknown>>;

  const checkNonEmptyString = (val: unknown, fieldName: string) => {
    if (typeof val !== 'string' || !val.trim()) {
      throw new Error(`Field "${fieldName}" must be a non-empty string`);
    }
  };

  // Validate YearPlans shape (Rule 1)
  for (const yp of yearPlans) {
    checkNonEmptyString(yp.id, 'yearPlan.id');
    checkNonEmptyString(yp.profileId, 'yearPlan.profileId');
    checkNonEmptyString(yp.schoolId, 'yearPlan.schoolId');
    checkNonEmptyString(yp.academicYear, 'yearPlan.academicYear');

    if (yp.curriculumType !== 'KURIKULUM_MERDEKA' && yp.curriculumType !== 'K13') {
      throw new Error(`yearPlan.curriculumType must be exactly "KURIKULUM_MERDEKA" or "K13"`);
    }

    if (yp.level !== 'SD' && yp.level !== 'SMP' && yp.level !== 'SMA' && yp.level !== 'SMK') {
      throw new Error(`yearPlan.level must be exactly "SD", "SMP", "SMA", or "SMK"`);
    }

    checkNonEmptyString(yp.grade, 'yearPlan.grade');
    checkNonEmptyString(yp.subject, 'yearPlan.subject');
    checkNonEmptyString(yp.createdAt, 'yearPlan.createdAt');
    checkNonEmptyString(yp.updatedAt, 'yearPlan.updatedAt');

    // Reject legacy semester authority fields if present
    if ('semester' in yp) {
      throw new Error('YearPlan has forbidden legacy field "semester"');
    }
    if ('activeSemester' in yp) {
      throw new Error('YearPlan has forbidden legacy field "activeSemester"');
    }
    if ('academicSettingId' in yp) {
      throw new Error('YearPlan has forbidden legacy field "academicSettingId"');
    }
  }

  // Validate Workspaces shape (Rule 2)
  for (const ws of workspaces) {
    checkNonEmptyString(ws.id, 'workspace.id');
    checkNonEmptyString(ws.profileId, 'workspace.profileId');
    checkNonEmptyString(ws.schoolId, 'workspace.schoolId');
    checkNonEmptyString(ws.yearPlanId, 'workspace.yearPlanId');
    checkNonEmptyString(ws.name, 'workspace.name');
    checkNonEmptyString(ws.createdAt, 'workspace.createdAt');
    checkNonEmptyString(ws.updatedAt, 'workspace.updatedAt');

    // Reject legacy workspace fields if present
    if ('academicSettingId' in ws) {
      throw new Error('Workspace has forbidden legacy field "academicSettingId"');
    }
    if ('semester' in ws) {
      throw new Error('Workspace has forbidden legacy field "semester"');
    }
    if ('activeSemester' in ws) {
      throw new Error('Workspace has forbidden legacy field "activeSemester"');
    }
  }

  // Validate SemesterPlans shape (Rule 3)
  for (const sp of semesterPlans) {
    checkNonEmptyString(sp.id, 'semesterPlan.id');
    checkNonEmptyString(sp.yearPlanId, 'semesterPlan.yearPlanId');
    checkNonEmptyString(sp.createdAt, 'semesterPlan.createdAt');
    checkNonEmptyString(sp.updatedAt, 'semesterPlan.updatedAt');

    const sem = sp.semester;
    if (typeof sem !== 'number' || (sem !== 1 && sem !== 2)) {
      throw new Error(`semesterPlan.semester must be exactly number 1 or 2, received ${typeof sem} "${String(sem)}"`);
    }

    // Reject duplicated parent authority fields in SemesterPlan
    const forbiddenSemesterPlanFields = [
      'profileId',
      'schoolId',
      'academicYear',
      'grade',
      'subject',
      'curriculumType',
      'activeSemester',
      'academicSettingId'
    ];
    for (const f of forbiddenSemesterPlanFields) {
      if (f in sp) {
        throw new Error(`SemesterPlan contains duplicated parent authority field "${f}"`);
      }
    }
  }

  // 1. Root ID uniqueness
  const checkIdUniqueness = (arr: Array<Record<string, unknown>>, name: string) => {
    const seen = new Set<string>();
    for (const item of arr) {
      if (!item || typeof item !== 'object') {
        throw new Error(`Invalid item in "${name}": must be an object`);
      }
      const id = item.id;
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error(`Missing or invalid "id" in "${name}" item`);
      }
      if (seen.has(id)) {
        throw new Error(`Duplicate ID "${id}" found in "${name}"`);
      }
      seen.add(id);
    }
  };

  checkIdUniqueness(profiles, 'profiles');
  checkIdUniqueness(schools, 'schools');
  checkIdUniqueness(principalHistories, 'principalHistories');
  checkIdUniqueness(workspaces, 'workspaces');
  checkIdUniqueness(yearPlans, 'yearPlans');
  checkIdUniqueness(semesterPlans, 'semesterPlans');

  // Create Maps for fast relational checks
  const profileMap = new Map<string, Record<string, unknown>>(
    profiles.map((p) => [p.id as string, p])
  );
  const schoolMap = new Map<string, Record<string, unknown>>(
    schools.map((s) => [s.id as string, s])
  );
  const yearPlanMap = new Map<string, Record<string, unknown>>(
    yearPlans.map((yp) => [yp.id as string, yp])
  );
  const semesterPlanMap = new Map<string, Record<string, unknown>>(
    semesterPlans.map((sp) => [sp.id as string, sp])
  );
  const workspaceMap = new Map<string, Record<string, unknown>>(
    workspaces.map((ws) => [ws.id as string, ws])
  );

  // Profile school relation
  for (const prof of profiles) {
    const profId = prof.id as string;
    const schId = prof.schoolId as string | undefined;
    if (schId && typeof schId === 'string' && schId.trim() !== '') {
      if (!schoolMap.has(schId)) {
        throw new Error(
          `Profile "${profId}" references non-existent schoolId "${schId}"`
        );
      }
    }
  }

  // PrincipalHistory relations & active limit
  const activePrincipalCounts = new Map<string, number>();
  for (const ph of principalHistories) {
    const phId = ph.id as string;
    const schId = ph.schoolId as string;
    if (!schId || typeof schId !== 'string' || !schoolMap.has(schId)) {
      throw new Error(
        `PrincipalHistory "${phId}" references non-existent schoolId "${schId}"`
      );
    }
    if (ph.isActive === true) {
      const count = (activePrincipalCounts.get(schId) || 0) + 1;
      if (count > 1) {
        throw new Error(`School "${schId}" has multiple active PrincipalHistories`);
      }
      activePrincipalCounts.set(schId, count);
    }
  }

  // 2. YearPlan Relations
  for (const yp of yearPlans) {
    const profileId = yp.profileId as string;
    const schoolId = yp.schoolId as string;

    const profile = profileMap.get(profileId);
    if (!profile) {
      throw new Error(
        `YearPlan "${yp.id}" references non-existent profileId "${profileId}"`
      );
    }

    const school = schoolMap.get(schoolId);
    if (!school) {
      throw new Error(
        `YearPlan "${yp.id}" references non-existent schoolId "${schoolId}"`
      );
    }

    if (profile.schoolId && profile.schoolId !== schoolId) {
      throw new Error(
        `YearPlan "${yp.id}" profile school mismatch: profile.schoolId "${profile.schoolId}" !== yearPlan.schoolId "${schoolId}"`
      );
    }
  }

  // 3. Workspace Relations & 1 YearPlan ↔ 1 Workspace
  const yearPlanWorkspaceCounts = new Map<string, number>();
  for (const ws of workspaces) {
    const yearPlanId = ws.yearPlanId as string;
    const parentYP = yearPlanMap.get(yearPlanId);
    if (!parentYP) {
      throw new Error(
        `Workspace "${ws.id}" references non-existent yearPlanId "${yearPlanId}"`
      );
    }

    if (ws.profileId !== parentYP.profileId) {
      throw new Error(
        `Workspace "${ws.id}" profileId "${ws.profileId}" does not match parent YearPlan profileId "${parentYP.profileId}"`
      );
    }

    if (ws.schoolId !== parentYP.schoolId) {
      throw new Error(
        `Workspace "${ws.id}" schoolId "${ws.schoolId}" does not match parent YearPlan schoolId "${parentYP.schoolId}"`
      );
    }

    yearPlanWorkspaceCounts.set(
      yearPlanId,
      (yearPlanWorkspaceCounts.get(yearPlanId) || 0) + 1
    );
  }

  for (const yp of yearPlans) {
    const ypId = yp.id as string;
    const count = yearPlanWorkspaceCounts.get(ypId) || 0;
    if (count === 0) {
      throw new Error(`YearPlan "${ypId}" does not have a matching Workspace`);
    }
    if (count > 1) {
      throw new Error(`YearPlan "${ypId}" has duplicate Workspaces (${count})`);
    }
  }

  // 4. SemesterPlan Relations & 1 YearPlan ↔ 2 SemesterPlans (Sem 1 & Sem 2)
  const yearPlanSemesterCounts = new Map<string, { sem1: number; sem2: number }>();

  for (const sp of semesterPlans) {
    const yearPlanId = sp.yearPlanId as string;
    if (!yearPlanMap.has(yearPlanId)) {
      throw new Error(
        `Parent YearPlan "${yearPlanId}" not found for SemesterPlan "${sp.id}"`
      );
    }

    const sem = sp.semester as number;

    if (!yearPlanSemesterCounts.has(yearPlanId)) {
      yearPlanSemesterCounts.set(yearPlanId, { sem1: 0, sem2: 0 });
    }
    const counts = yearPlanSemesterCounts.get(yearPlanId)!;
    if (sem === 1) counts.sem1++;
    if (sem === 2) counts.sem2++;
  }

  for (const yp of yearPlans) {
    const ypId = yp.id as string;
    const counts = yearPlanSemesterCounts.get(ypId) || { sem1: 0, sem2: 0 };
    if (counts.sem1 !== 1) {
      throw new Error(
        `YearPlan "${ypId}" must have exactly 1 SemesterPlan for Semester 1 (found ${counts.sem1})`
      );
    }
    if (counts.sem2 !== 1) {
      throw new Error(
        `YearPlan "${ypId}" must have exactly 1 SemesterPlan for Semester 2 (found ${counts.sem2})`
      );
    }
  }

  // 5. Year Scoped Entries Validation
  const validateYearScopedCollection = (
    arr: Array<Record<string, unknown>>,
    collName: string
  ) => {
    const seenYearPlans = new Set<string>();
    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`Invalid entry in "${collName}"`);
      }
      const ypId = entry.yearPlanId as string;
      if (!ypId || typeof ypId !== 'string') {
        throw new Error(`Entry in "${collName}" missing valid "yearPlanId"`);
      }
      if (!yearPlanMap.has(ypId)) {
        throw new Error(
          `Entry in "${collName}" references non-existent yearPlanId "${ypId}"`
        );
      }
      if (seenYearPlans.has(ypId)) {
        throw new Error(
          `Duplicate entry for yearPlanId "${ypId}" in collection "${collName}"`
        );
      }
      seenYearPlans.add(ypId);

      const val = entry.value;
      if (!val || typeof val !== 'object' || Array.isArray(val)) {
        throw new Error(`Entry in "${collName}" value must exist and be a non-null object`);
      }
    }
  };

  validateYearScopedCollection(
    state.annualJPReferences as Array<Record<string, unknown>>,
    'annualJPReferences'
  );
  validateYearScopedCollection(
    annualData.cp as Array<Record<string, unknown>>,
    'annualData.cp'
  );
  validateYearScopedCollection(
    annualData.cpAnalysis as Array<Record<string, unknown>>,
    'annualData.cpAnalysis'
  );
  validateYearScopedCollection(
    annualData.tp as Array<Record<string, unknown>>,
    'annualData.tp'
  );
  validateYearScopedCollection(
    annualData.atp as Array<Record<string, unknown>>,
    'annualData.atp'
  );
  validateYearScopedCollection(
    annualData.curriculumContext as Array<Record<string, unknown>>,
    'annualData.curriculumContext'
  );

  // 6. Semester Scoped Entries Validation
  const validateSemesterScopedCollection = (
    arr: Array<Record<string, unknown>>,
    collName: string
  ) => {
    const seenSemesterPlans = new Set<string>();
    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`Invalid entry in "${collName}"`);
      }
      const spId = entry.semesterPlanId as string;
      if (!spId || typeof spId !== 'string') {
        throw new Error(`Entry in "${collName}" missing valid "semesterPlanId"`);
      }
      if (!semesterPlanMap.has(spId)) {
        throw new Error(
          `Entry in "${collName}" references non-existent semesterPlanId "${spId}"`
        );
      }
      if (seenSemesterPlans.has(spId)) {
        throw new Error(
          `Duplicate entry for semesterPlanId "${spId}" in collection "${collName}"`
        );
      }
      seenSemesterPlans.add(spId);

      const val = entry.value;
      if (val === undefined || val === null) {
        throw new Error(`Entry in "${collName}" is missing a value`);
      }

      const arrayValuedCollections = [
        'semesterData.timeAllocation',
        'semesterData.learningPlan',
        'semesterData.assessmentCriteria',
        'semesterData.assessmentPlan',
        'semesterData.assessmentPackage',
        'semesterData.roster',
        'semesterData.remedial',
        'semesterData.enrichment'
      ];

      const objectValuedCollections = [
        'semesterJPSettings',
        'semesterData.academicCalendar',
        'semesterData.attendance',
        'semesterData.grade'
      ];

      if (arrayValuedCollections.includes(collName)) {
        if (!Array.isArray(val)) {
          throw new Error(`Collection "${collName}" value must be an array`);
        }
      } else if (objectValuedCollections.includes(collName)) {
        if (typeof val !== 'object' || Array.isArray(val)) {
          throw new Error(`Collection "${collName}" value must be a non-null object`);
        }
      }

      // Special check for semesterJPSettings inner semesterPlanId
      if (collName === 'semesterJPSettings') {
        const innerId = (val as Record<string, unknown>).semesterPlanId;

        if (
          typeof innerId !== 'string' ||
          !innerId.trim() ||
          innerId !== spId
        ) {
          throw new Error(
            `semesterJPSettings inner semesterPlanId "${innerId}" does not match outer semesterPlanId "${spId}"`
          );
        }
      }
    }
  };

  validateSemesterScopedCollection(
    state.semesterJPSettings as Array<Record<string, unknown>>,
    'semesterJPSettings'
  );
  validateSemesterScopedCollection(
    semesterData.academicCalendar as Array<Record<string, unknown>>,
    'semesterData.academicCalendar'
  );
  validateSemesterScopedCollection(
    semesterData.timeAllocation as Array<Record<string, unknown>>,
    'semesterData.timeAllocation'
  );
  validateSemesterScopedCollection(
    semesterData.learningPlan as Array<Record<string, unknown>>,
    'semesterData.learningPlan'
  );
  validateSemesterScopedCollection(
    semesterData.assessmentCriteria as Array<Record<string, unknown>>,
    'semesterData.assessmentCriteria'
  );
  validateSemesterScopedCollection(
    semesterData.assessmentPlan as Array<Record<string, unknown>>,
    'semesterData.assessmentPlan'
  );
  validateSemesterScopedCollection(
    semesterData.assessmentPackage as Array<Record<string, unknown>>,
    'semesterData.assessmentPackage'
  );
  validateSemesterScopedCollection(
    semesterData.roster as Array<Record<string, unknown>>,
    'semesterData.roster'
  );
  validateSemesterScopedCollection(
    semesterData.attendance as Array<Record<string, unknown>>,
    'semesterData.attendance'
  );
  validateSemesterScopedCollection(
    semesterData.grade as Array<Record<string, unknown>>,
    'semesterData.grade'
  );
  validateSemesterScopedCollection(
    semesterData.remedial as Array<Record<string, unknown>>,
    'semesterData.remedial'
  );
  validateSemesterScopedCollection(
    semesterData.enrichment as Array<Record<string, unknown>>,
    'semesterData.enrichment'
  );

  // 7. Active Context Pointer Validation
  const checkActivePointer = (val: unknown, name: string) => {
    if (val !== undefined && val !== null) {
      if (typeof val !== 'string' || !val.trim()) {
        throw new Error(`Active context pointer "${name}" must be a non-empty string`);
      }
    }
  };
  checkActivePointer(state.activeProfileId, 'activeProfileId');
  checkActivePointer(state.activeYearPlanId, 'activeYearPlanId');
  checkActivePointer(state.activeWorkspaceId, 'activeWorkspaceId');
  checkActivePointer(state.activeSemesterPlanId, 'activeSemesterPlanId');

  if (state.activeProfileId !== undefined && state.activeProfileId !== null) {
    const actProf = String(state.activeProfileId);
    if (!profileMap.has(actProf)) {
      throw new Error(`activeProfileId "${actProf}" references non-existent profile`);
    }
  }

  if (state.activeYearPlanId !== undefined && state.activeYearPlanId !== null) {
    const actYPId = String(state.activeYearPlanId);
    const actYP = yearPlanMap.get(actYPId);
    if (!actYP) {
      throw new Error(`activeYearPlanId "${actYPId}" references non-existent yearPlan`);
    }

    if (!state.activeProfileId) {
      throw new Error(`activeYearPlanId "${actYPId}" requires activeProfileId`);
    }

    if (actYP.profileId !== String(state.activeProfileId)) {
      throw new Error(
        `activeYearPlanId profileId "${actYP.profileId}" mismatch with activeProfileId "${state.activeProfileId}"`
      );
    }

    if (!state.activeWorkspaceId) {
      throw new Error(`activeYearPlanId "${actYPId}" requires activeWorkspaceId`);
    }

    const actWS = workspaceMap.get(String(state.activeWorkspaceId));
    if (!actWS || actWS.yearPlanId !== actYPId) {
      throw new Error(
        `activeYearPlanId "${actYPId}" requires activeWorkspaceId to be workspace belonging to yearPlan`
      );
    }
  }

  if (state.activeWorkspaceId !== undefined && state.activeWorkspaceId !== null) {
    const actWSId = String(state.activeWorkspaceId);
    const actWS = workspaceMap.get(actWSId);
    if (!actWS) {
      throw new Error(`activeWorkspaceId "${actWSId}" references non-existent workspace`);
    }

    if (!state.activeYearPlanId) {
      throw new Error(`activeWorkspaceId "${actWSId}" requires activeYearPlanId`);
    }

    if (actWS.yearPlanId !== String(state.activeYearPlanId)) {
      throw new Error(
        `activeWorkspaceId yearPlanId "${actWS.yearPlanId}" mismatch with activeYearPlanId "${state.activeYearPlanId}"`
      );
    }

    if (!state.activeProfileId) {
      throw new Error(`activeWorkspaceId "${actWSId}" requires activeProfileId`);
    }

    if (actWS.profileId !== String(state.activeProfileId)) {
      throw new Error(
        `activeWorkspaceId profileId "${actWS.profileId}" mismatch with activeProfileId "${state.activeProfileId}"`
      );
    }
  }

  if (state.activeSemesterPlanId !== undefined && state.activeSemesterPlanId !== null) {
    const actSPId = String(state.activeSemesterPlanId);
    const actSP = semesterPlanMap.get(actSPId);
    if (!actSP) {
      throw new Error(`activeSemesterPlanId "${actSPId}" references non-existent semesterPlan`);
    }

    if (!state.activeYearPlanId) {
      throw new Error(`activeSemesterPlanId "${actSPId}" requires activeYearPlanId`);
    }

    if (actSP.yearPlanId !== String(state.activeYearPlanId)) {
      throw new Error(
        `activeSemesterPlanId yearPlanId "${actSP.yearPlanId}" mismatch with activeYearPlanId "${state.activeYearPlanId}"`
      );
    }
  }

  return value as AppStorageStateV5;
}

/**
 * Serializes an AppStorageStateV5 into a canonical V5 backup envelope string.
 */
export function serializeBackupV5(data: AppStorageStateV5): string {
  const validated = validateStorageStateV5(data);

  const backup: StorageBackupV5 = {
    app: 'Administrasi Guru AI',
    schemaVersion: 5,
    exportedAt: new Date().toISOString(),
    data: validated,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Parses and strictly validates a V5 backup envelope string.
 *
 * Strict policy:
 * - Only accepts schemaVersion === 5
 * - Strictly rejects legacy V1/V2/V3/V4 backups without auto-migration
 * - Reuses validateStorageStateV5 to ensure 100% consistent validation
 * - Preserves all collections and fields losslessly without discarding or normalizing payload
 */
export function parseBackupV5(jsonString: string): AppStorageStateV5 {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    throw new Error('Backup payload must be a non-empty string');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`Malformed JSON in backup payload: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid backup format: root must be an object');
  }

  const envelope = parsed as Record<string, unknown>;

  if (envelope.app !== 'Administrasi Guru AI') {
    throw new Error(
      `Invalid backup application identifier: expected "Administrasi Guru AI", received "${String(
        envelope.app
      )}"`
    );
  }

  if (envelope.schemaVersion !== 5) {
    throw new Error(
      `Unsupported schemaVersion "${String(
        envelope.schemaVersion
      )}". Storage V5 strictly accepts schemaVersion: 5 without legacy auto-migration.`
    );
  }

  if (typeof envelope.exportedAt !== 'string' || !envelope.exportedAt.trim()) {
    throw new Error(
      'Invalid backup format: "exportedAt" must be a valid non-empty ISO date string'
    );
  }

  const parsedDate = Date.parse(envelope.exportedAt);
  if (isNaN(parsedDate)) {
    throw new Error(
      'Invalid backup format: "exportedAt" must be a parseable valid date string'
    );
  }

  if (!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
    throw new Error('Invalid backup format: data payload is missing or invalid');
  }

  return validateStorageStateV5(envelope.data);
}

/**
 * Saves an AppStorageStateV5 to localStorage under STORAGE_KEY_V5.
 * Validates the state before writing.
 */
export function saveStorageV5(state: AppStorageStateV5): void {
  const validated = validateStorageStateV5(state);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(validated));
  }
}

/**
 * Loads AppStorageStateV5 from localStorage.
 *
 * Rules:
 * - If V5 key is missing -> creates initial storage, saves it to V5 key, returns initial.
 * - If V5 key exists but JSON is malformed or schema is invalid -> throws without resetting/overwriting raw data.
 * - Never reads or touches legacy storage keys.
 */
export function loadStorageV5(): AppStorageStateV5 {
  if (typeof localStorage === 'undefined') {
    return createInitialStorageV5();
  }

  const raw = localStorage.getItem(STORAGE_KEY_V5);
  if (raw === null) {
    const initial = createInitialStorageV5();
    saveStorageV5(initial);
    return initial;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(
      `Corrupted V5 storage payload: malformed JSON under key "${STORAGE_KEY_V5}": ${err.message}`
    );
  }

  return validateStorageStateV5(parsed);
}

/**
 * Resets the V5 storage state to canonical empty initial state.
 * Only touches STORAGE_KEY_V5 without modifying legacy storage keys.
 */
export function resetStorageV5(): AppStorageStateV5 {
  const initial = createInitialStorageV5();
  saveStorageV5(initial);
  return initial;
}

/**
 * Atomically creates a complete canonical YearPlan hierarchy:
 * 1 YearPlan
 * 1 AdministrationWorkspaceV5
 * 2 SemesterPlans (Semester 1 & 2)
 *
 * Rules:
 * - Profile and School must exist and be validly associated (profile.schoolId === schoolId)
 * - Rejects duplicate YearPlan identity tuple without silently reusing
 * - Sets activeProfileId, activeYearPlanId, activeWorkspaceId
 * - Leaves activeSemesterPlanId = undefined (never auto-selects Semester 1)
 */
export function createYearHierarchyV5(
  params: CreateYearHierarchyV5Params
): CreateYearHierarchyV5Result {
  const state = loadStorageV5();

  const profile = state.profiles.find((p) => p.id === params.profileId);
  if (!profile) {
    throw new Error(`Profile with ID "${params.profileId}" not found`);
  }

  const school = state.schools.find((s) => s.id === params.schoolId);
  if (!school) {
    throw new Error(`School with ID "${params.schoolId}" not found`);
  }

  if (profile.schoolId !== params.schoolId) {
    throw new Error(
      `Profile school mismatch: profile.schoolId "${profile.schoolId}" does not match requested schoolId "${params.schoolId}"`
    );
  }

  // Check duplicate exact YearPlan identity: (profileId, schoolId, academicYear, grade, classSection, subject)
  const isDuplicate = state.yearPlans.some(
    (yp) =>
      yp.profileId === params.profileId &&
      yp.schoolId === params.schoolId &&
      yp.academicYear === params.academicYear &&
      yp.grade === params.grade &&
      (yp.classSection || '') === (params.classSection || '') &&
      yp.subject.trim().toLowerCase() === params.subject.trim().toLowerCase()
  );

  if (isDuplicate) {
    throw new Error(
      `Duplicate YearPlan: A YearPlan already exists for profileId "${params.profileId}", schoolId "${params.schoolId}", academicYear "${params.academicYear}", grade "${params.grade}", classSection "${params.classSection || ''}", and subject "${params.subject}".`
    );
  }

  const now = new Date().toISOString();
  const yearPlanId = `yp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const yearPlan: YearPlan = {
    id: yearPlanId,
    profileId: params.profileId,
    schoolId: params.schoolId,
    academicYear: params.academicYear,
    curriculumType: params.curriculumType,
    level: params.level,
    grade: params.grade,
    ...(params.classSection !== undefined ? { classSection: params.classSection } : {}),
    subject: params.subject,
    ...(params.subjectCode !== undefined ? { subjectCode: params.subjectCode } : {}),
    ...(params.phase !== undefined ? { phase: params.phase } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const workspaceId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const workspaceName =
    params.workspaceName?.trim() ||
    `${params.subject} - ${params.grade} (${params.academicYear})`;

  const workspace: AdministrationWorkspaceV5 = {
    id: workspaceId,
    profileId: params.profileId,
    schoolId: params.schoolId,
    yearPlanId: yearPlanId,
    name: workspaceName,
    ...(params.documentDate !== undefined ? { documentDate: params.documentDate } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const semesterPlan1: SemesterPlan = {
    id: `sp-${Date.now()}-1-${Math.random().toString(36).slice(2, 9)}`,
    yearPlanId: yearPlanId,
    semester: 1,
    createdAt: now,
    updatedAt: now,
  };

  const semesterPlan2: SemesterPlan = {
    id: `sp-${Date.now()}-2-${Math.random().toString(36).slice(2, 9)}`,
    yearPlanId: yearPlanId,
    semester: 2,
    createdAt: now,
    updatedAt: now,
  };

  state.yearPlans.push(yearPlan);
  state.workspaces.push(workspace);
  state.semesterPlans.push(semesterPlan1, semesterPlan2);

  state.activeProfileId = params.profileId;
  state.activeYearPlanId = yearPlanId;
  state.activeWorkspaceId = workspaceId;
  state.activeSemesterPlanId = undefined; // Strictly undefined on creation

  saveStorageV5(state);

  return {
    yearPlan,
    workspace,
    semesterPlans: [semesterPlan1, semesterPlan2],
  };
}

/**
 * Retrieves a YearPlan by its ID.
 */
export function getYearPlanV5(yearPlanId: string): YearPlan | undefined {
  const state = loadStorageV5();
  return state.yearPlans.find((yp) => yp.id === yearPlanId);
}

/**
 * Retrieves all SemesterPlans belonging to a YearPlan.
 */
export function getSemesterPlansForYearV5(yearPlanId: string): SemesterPlan[] {
  const state = loadStorageV5();
  return state.semesterPlans.filter((sp) => sp.yearPlanId === yearPlanId);
}

/**
 * Sets the active YearPlan.
 *
 * Rules:
 * - Validates that YearPlan exists
 * - Updates activeYearPlanId, activeProfileId, and activeWorkspaceId
 * - If activeSemesterPlanId is not a child of this YearPlan, it is cleared (undefined)
 * - Never defaults or auto-selects Semester 1
 */
export function setActiveYearPlanV5(yearPlanId: string): void {
  const state = loadStorageV5();
  const yearPlan = state.yearPlans.find((yp) => yp.id === yearPlanId);
  if (!yearPlan) {
    throw new Error(`YearPlan with ID "${yearPlanId}" not found`);
  }

  state.activeYearPlanId = yearPlan.id;
  state.activeProfileId = yearPlan.profileId;

  const workspace = state.workspaces.find((w) => w.yearPlanId === yearPlan.id);
  state.activeWorkspaceId = workspace ? workspace.id : undefined;

  if (state.activeSemesterPlanId) {
    const currentSp = state.semesterPlans.find((sp) => sp.id === state.activeSemesterPlanId);
    if (!currentSp || currentSp.yearPlanId !== yearPlan.id) {
      state.activeSemesterPlanId = undefined;
    }
  }

  saveStorageV5(state);
}

/**
 * Sets the active SemesterPlan.
 *
 * Rules:
 * - Validates that SemesterPlan exists
 * - Sets activeSemesterPlanId
 * - Synchronizes activeYearPlanId to parent YearPlan
 * - Synchronizes activeProfileId to parent YearPlan's profileId
 * - Synchronizes activeWorkspaceId to parent YearPlan's workspace
 */
export function setActiveSemesterPlanV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  const semesterPlan = state.semesterPlans.find((sp) => sp.id === semesterPlanId);
  if (!semesterPlan) {
    throw new Error(`SemesterPlan with ID "${semesterPlanId}" not found`);
  }

  const parentYearPlan = state.yearPlans.find((yp) => yp.id === semesterPlan.yearPlanId);
  if (!parentYearPlan) {
    throw new Error(
      `Parent YearPlan "${semesterPlan.yearPlanId}" not found for SemesterPlan "${semesterPlanId}"`
    );
  }

  const workspace = state.workspaces.find((w) => w.yearPlanId === parentYearPlan.id);

  state.activeSemesterPlanId = semesterPlan.id;
  state.activeYearPlanId = parentYearPlan.id;
  state.activeProfileId = parentYearPlan.profileId;
  state.activeWorkspaceId = workspace ? workspace.id : undefined;

  saveStorageV5(state);
}

/**
 * Renames an existing AdministrationWorkspaceV5.
 *
 * Rules:
 * - Rejects if workspace is not found
 * - Only modifies `name` and `updatedAt`
 */
export function renameWorkspaceV5(workspaceId: string, name: string): void {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new Error('Workspace name cannot be empty');
  }

  const state = loadStorageV5();
  const workspace = state.workspaces.find((w) => w.id === workspaceId);
  if (!workspace) {
    throw new Error(`Workspace with ID "${workspaceId}" not found`);
  }

  workspace.name = trimmed;
  workspace.updatedAt = new Date().toISOString();

  saveStorageV5(state);
}

/**
 * Asserts that a YearPlan exists in the state and returns it.
 */
function assertYearPlanExists(state: AppStorageStateV5, yearPlanId: string): YearPlan {
  const yearPlan = state.yearPlans.find((yp) => yp.id === yearPlanId);
  if (!yearPlan) {
    throw new Error(`YearPlan with ID "${yearPlanId}" not found`);
  }
  return yearPlan;
}

/**
 * Upserts a YearScopedEntry into an annual collection.
 * Replaces value if entry already exists, or inserts a new entry if not.
 * Ensures exactly 1 wrapper per yearPlanId.
 */
function upsertAnnualScopedEntry<T>(
  collection: YearScopedEntry<T>[],
  yearPlanId: string,
  value: T
): T {
  const existing = collection.find((entry) => entry.yearPlanId === yearPlanId);
  if (existing) {
    existing.value = value;
  } else {
    collection.push({ yearPlanId, value });
  }
  return value;
}

/**
 * Removes a YearScopedEntry from an annual collection.
 * Returns true if an entry was removed, false if not found.
 */
function deleteAnnualScopedEntry<T>(
  collection: YearScopedEntry<T>[],
  yearPlanId: string
): boolean {
  const index = collection.findIndex((entry) => entry.yearPlanId === yearPlanId);
  if (index !== -1) {
    collection.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Retrieves all annual scoped domain data for a given YearPlan.
 *
 * Rules:
 * - Validates that YearPlan exists (throws if not found)
 * - Returns { yearPlan, cp, cpAnalysis, tp, atp, curriculumContext, annualJPReference }
 * - Unpopulated collections return undefined
 * - Does not fallback to activeYearPlanId or other YearPlans
 */
export function getAnnualDataV5(yearPlanId: string): AnnualDataV5Result {
  const state = loadStorageV5();
  const yearPlan = assertYearPlanExists(state, yearPlanId);

  const cp = state.annualData.cp.find((e) => e.yearPlanId === yearPlanId)?.value;
  const cpAnalysis = state.annualData.cpAnalysis.find((e) => e.yearPlanId === yearPlanId)?.value;
  const tp = state.annualData.tp.find((e) => e.yearPlanId === yearPlanId)?.value;
  const atp = state.annualData.atp.find((e) => e.yearPlanId === yearPlanId)?.value;
  const curriculumContext = state.annualData.curriculumContext.find(
    (e) => e.yearPlanId === yearPlanId
  )?.value;
  const annualJPReference = state.annualJPReferences.find(
    (e) => e.yearPlanId === yearPlanId
  )?.value;

  return {
    yearPlan,
    cp,
    cpAnalysis,
    tp,
    atp,
    curriculumContext,
    annualJPReference,
  };
}

export function saveCPV5(yearPlanId: string, value: CPData): CPData {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  upsertAnnualScopedEntry(state.annualData.cp, yearPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveCPAnalysisV5(yearPlanId: string, value: CPAnalysisData): CPAnalysisData {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  upsertAnnualScopedEntry(state.annualData.cpAnalysis, yearPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveTPV5(yearPlanId: string, value: TPData): TPData {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  upsertAnnualScopedEntry(state.annualData.tp, yearPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveATPV5(yearPlanId: string, value: ATPData): ATPData {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  upsertAnnualScopedEntry(state.annualData.atp, yearPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveCurriculumContextV5(
  yearPlanId: string,
  value: CurriculumContextLock
): CurriculumContextLock {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  upsertAnnualScopedEntry(state.annualData.curriculumContext, yearPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveAnnualJPReferenceV5(
  yearPlanId: string,
  value: AnnualJPReference
): AnnualJPReference {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  upsertAnnualScopedEntry(state.annualJPReferences, yearPlanId, value);
  saveStorageV5(state);
  return value;
}

export function deleteCPV5(yearPlanId: string): void {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  const changed = deleteAnnualScopedEntry(state.annualData.cp, yearPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteCPAnalysisV5(yearPlanId: string): void {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  const changed = deleteAnnualScopedEntry(state.annualData.cpAnalysis, yearPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteTPV5(yearPlanId: string): void {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  const changed = deleteAnnualScopedEntry(state.annualData.tp, yearPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteATPV5(yearPlanId: string): void {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  const changed = deleteAnnualScopedEntry(state.annualData.atp, yearPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteCurriculumContextV5(yearPlanId: string): void {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  const changed = deleteAnnualScopedEntry(state.annualData.curriculumContext, yearPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteAnnualJPReferenceV5(yearPlanId: string): void {
  const state = loadStorageV5();
  assertYearPlanExists(state, yearPlanId);
  const changed = deleteAnnualScopedEntry(state.annualJPReferences, yearPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

/**
 * Asserts that a SemesterPlan exists and its parent YearPlan exists.
 * Returns both entities.
 */
function assertSemesterPlanAndParentExist(
  state: AppStorageStateV5,
  semesterPlanId: string
): { semesterPlan: SemesterPlan; yearPlan: YearPlan } {
  const semesterPlan = state.semesterPlans.find((sp) => sp.id === semesterPlanId);
  if (!semesterPlan) {
    throw new Error(`SemesterPlan with ID "${semesterPlanId}" not found`);
  }

  const yearPlan = state.yearPlans.find((yp) => yp.id === semesterPlan.yearPlanId);
  if (!yearPlan) {
    throw new Error(
      `Parent YearPlan "${semesterPlan.yearPlanId}" not found for SemesterPlan "${semesterPlanId}"`
    );
  }

  return { semesterPlan, yearPlan };
}

/**
 * Upserts a SemesterScopedEntry into a semester collection.
 * Replaces value if entry already exists, or inserts a new entry if not.
 * Ensures exactly 1 wrapper per semesterPlanId.
 */
function upsertSemesterScopedEntry<T>(
  collection: SemesterScopedEntry<T>[],
  semesterPlanId: string,
  value: T
): T {
  const existing = collection.find((entry) => entry.semesterPlanId === semesterPlanId);
  if (existing) {
    existing.value = value;
  } else {
    collection.push({ semesterPlanId, value });
  }
  return value;
}

/**
 * Removes a SemesterScopedEntry from a semester collection.
 * Returns true if an entry was removed, false if not found.
 */
function deleteSemesterScopedEntry<T>(
  collection: SemesterScopedEntry<T>[],
  semesterPlanId: string
): boolean {
  const index = collection.findIndex((entry) => entry.semesterPlanId === semesterPlanId);
  if (index !== -1) {
    collection.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Retrieves all semester-scoped domain data for a given SemesterPlan.
 *
 * Rules:
 * - Validates that SemesterPlan and its parent YearPlan exist (throws if either not found)
 * - Returns { semesterPlan, yearPlan, ...collections }
 * - Unpopulated collections return undefined
 * - Does not use activeSemesterPlanId implicitly
 */
export function getSemesterDataV5(semesterPlanId: string): SemesterDataV5Result {
  const state = loadStorageV5();
  const { semesterPlan, yearPlan } = assertSemesterPlanAndParentExist(state, semesterPlanId);

  const semesterJPSetting = state.semesterJPSettings.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const academicCalendar = state.semesterData.academicCalendar.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const timeAllocation = state.semesterData.timeAllocation.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const learningPlan = state.semesterData.learningPlan.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const assessmentCriteria = state.semesterData.assessmentCriteria.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const assessmentPlan = state.semesterData.assessmentPlan.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const assessmentPackage = state.semesterData.assessmentPackage.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const roster = state.semesterData.roster.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const attendance = state.semesterData.attendance.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const grade = state.semesterData.grade.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const remedial = state.semesterData.remedial.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;
  const enrichment = state.semesterData.enrichment.find(
    (e) => e.semesterPlanId === semesterPlanId
  )?.value;

  return {
    semesterPlan,
    yearPlan,
    semesterJPSetting,
    academicCalendar,
    timeAllocation,
    learningPlan,
    assessmentCriteria,
    assessmentPlan,
    assessmentPackage,
    roster,
    attendance,
    grade,
    remedial,
    enrichment,
  };
}

export function saveSemesterJPSettingV5(
  semesterPlanId: string,
  value: SemesterJPSetting
): SemesterJPSetting {
  if (value.semesterPlanId !== semesterPlanId) {
    throw new Error(
      `SemesterJPSetting inner semesterPlanId "${value.semesterPlanId}" does not match outer semesterPlanId "${semesterPlanId}"`
    );
  }
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterJPSettings, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveAcademicCalendarV5(
  semesterPlanId: string,
  value: SemesterCalendarEntry
): SemesterCalendarEntry {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.academicCalendar, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveTimeAllocationV5(
  semesterPlanId: string,
  value: TimeAllocation[]
): TimeAllocation[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.timeAllocation, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveLearningPlansV5(
  semesterPlanId: string,
  value: LearningPlan[]
): LearningPlan[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.learningPlan, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveAssessmentCriteriaV5(
  semesterPlanId: string,
  value: AssessmentCriterion[]
): AssessmentCriterion[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.assessmentCriteria, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveAssessmentPlansV5(
  semesterPlanId: string,
  value: AssessmentPlan[]
): AssessmentPlan[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.assessmentPlan, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveAssessmentPackagesV5(
  semesterPlanId: string,
  value: AssessmentPackage[]
): AssessmentPackage[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.assessmentPackage, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveRosterV5(semesterPlanId: string, value: Student[]): Student[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.roster, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveAttendanceV5(
  semesterPlanId: string,
  value: SemesterAttendanceEntry
): SemesterAttendanceEntry {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.attendance, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveGradeV5(
  semesterPlanId: string,
  value: SemesterGradeEntry
): SemesterGradeEntry {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.grade, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveRemedialV5(
  semesterPlanId: string,
  value: RemedialRecord[]
): RemedialRecord[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.remedial, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function saveEnrichmentV5(
  semesterPlanId: string,
  value: EnrichmentRecord[]
): EnrichmentRecord[] {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  upsertSemesterScopedEntry(state.semesterData.enrichment, semesterPlanId, value);
  saveStorageV5(state);
  return value;
}

export function deleteSemesterJPSettingV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterJPSettings, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteAcademicCalendarV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.academicCalendar, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteTimeAllocationV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.timeAllocation, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteLearningPlansV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.learningPlan, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteAssessmentCriteriaV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.assessmentCriteria, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteAssessmentPlansV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.assessmentPlan, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteAssessmentPackagesV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.assessmentPackage, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteRosterV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.roster, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteAttendanceV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.attendance, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteGradeV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.grade, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteRemedialV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.remedial, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

export function deleteEnrichmentV5(semesterPlanId: string): void {
  const state = loadStorageV5();
  assertSemesterPlanAndParentExist(state, semesterPlanId);
  const changed = deleteSemesterScopedEntry(state.semesterData.enrichment, semesterPlanId);
  if (changed) {
    saveStorageV5(state);
  }
}

// ============================================================================
// PROFILE MASTER DATA API
// ============================================================================

function setActiveProfileInState(state: AppStorageStateV5, profileId: string): void {
  const profileExists = state.profiles.some((p) => p.id === profileId);
  if (!profileExists) {
    throw new Error(`Profile with ID "${profileId}" not found`);
  }

  state.activeProfileId = profileId;

  // 1. Validate activeYearPlanId
  if (state.activeYearPlanId !== undefined) {
    const activeYP = state.yearPlans.find((yp) => yp.id === state.activeYearPlanId);
    if (!activeYP || activeYP.profileId !== profileId) {
      state.activeYearPlanId = undefined;
    }
  }

  // 2. Validate activeWorkspaceId
  if (state.activeWorkspaceId !== undefined) {
    const activeWS = state.workspaces.find((ws) => ws.id === state.activeWorkspaceId);
    if (
      !activeWS ||
      activeWS.profileId !== profileId ||
      !state.activeYearPlanId ||
      activeWS.yearPlanId !== state.activeYearPlanId
    ) {
      state.activeWorkspaceId = undefined;
    }
  }

  // 3. Validate activeSemesterPlanId
  if (state.activeSemesterPlanId !== undefined) {
    const activeSP = state.semesterPlans.find((sp) => sp.id === state.activeSemesterPlanId);
    const parentYP = activeSP
      ? state.yearPlans.find((yp) => yp.id === activeSP.yearPlanId)
      : undefined;
    if (
      !activeSP ||
      !parentYP ||
      parentYP.profileId !== profileId ||
      !state.activeYearPlanId ||
      activeSP.yearPlanId !== state.activeYearPlanId
    ) {
      state.activeSemesterPlanId = undefined;
    }
  }
}

export function getProfileV5(profileId: string): TeacherProfile | undefined {
  const state = loadStorageV5();
  return state.profiles.find((p) => p.id === profileId);
}

export function createProfileV5(
  profile: Omit<TeacherProfile, 'id' | 'createdAt' | 'updatedAt'>
): TeacherProfile {
  const state = loadStorageV5();

  let targetSchoolId: string | undefined = undefined;
  if (typeof profile.schoolId === 'string' && profile.schoolId.trim() !== '') {
    targetSchoolId = profile.schoolId.trim();
    const schoolExists = state.schools.some((s) => s.id === targetSchoolId);
    if (!schoolExists) {
      throw new Error(`School with ID "${targetSchoolId}" not found`);
    }
  }

  const now = new Date().toISOString();
  const newProfile: TeacherProfile = {
    ...profile,
    schoolId: targetSchoolId,
    id: `prof-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };

  state.profiles.push(newProfile);
  setActiveProfileInState(state, newProfile.id);

  saveStorageV5(state);
  return newProfile;
}

export function updateProfileV5(
  profileId: string,
  updates: Partial<TeacherProfile>
): TeacherProfile {
  const state = loadStorageV5();

  const index = state.profiles.findIndex((p) => p.id === profileId);
  if (index === -1) {
    throw new Error(`Profile with ID "${profileId}" not found`);
  }

  const existingProfile = state.profiles[index];
  const hasSchoolIdProp = Object.prototype.hasOwnProperty.call(updates, 'schoolId');

  let targetSchoolId: string | undefined = existingProfile.schoolId;

  if (hasSchoolIdProp) {
    const rawVal = updates.schoolId;
    if (typeof rawVal === 'string') {
      const trimmed = rawVal.trim();
      targetSchoolId = trimmed === '' ? undefined : trimmed;
    } else {
      targetSchoolId = rawVal;
    }

    if (targetSchoolId !== undefined && targetSchoolId !== null) {
      const schoolExists = state.schools.some((s) => s.id === targetSchoolId);
      if (!schoolExists) {
        throw new Error(`School with ID "${targetSchoolId}" not found`);
      }
    } else {
      targetSchoolId = undefined;
    }

    const isSchoolChanging = targetSchoolId !== existingProfile.schoolId;

    if (isSchoolChanging) {
      const hasYearPlan = state.yearPlans.some((yp) => yp.profileId === profileId);
      const hasWorkspace = state.workspaces.some((ws) => ws.profileId === profileId);

      if (hasYearPlan || hasWorkspace) {
        throw new Error(
          `Cannot change schoolId for profile "${profileId}" because it already has YearPlans or Workspaces`
        );
      }
    }
  }

  const now = new Date().toISOString();
  const updatedProfile: TeacherProfile = {
    ...existingProfile,
    ...updates,
    schoolId: targetSchoolId,
    id: existingProfile.id,
    createdAt: existingProfile.createdAt,
    updatedAt: now,
  };

  state.profiles[index] = updatedProfile;
  saveStorageV5(state);
  return updatedProfile;
}

export function deleteProfileV5(profileId: string): void {
  const state = loadStorageV5();

  const profileIndex = state.profiles.findIndex((p) => p.id === profileId);
  if (profileIndex === -1) {
    throw new Error(`Profile with ID "${profileId}" not found`);
  }

  const hasYearPlan = state.yearPlans.some((yp) => yp.profileId === profileId);
  const hasWorkspace = state.workspaces.some((ws) => ws.profileId === profileId);

  if (hasYearPlan || hasWorkspace) {
    throw new Error(
      `Cannot delete profile "${profileId}" because it has associated YearPlans or Workspaces`
    );
  }

  state.profiles.splice(profileIndex, 1);

  if (state.activeProfileId === profileId) {
    state.activeProfileId = undefined;
  }

  saveStorageV5(state);
}

export function setActiveProfileV5(profileId: string): void {
  const state = loadStorageV5();
  setActiveProfileInState(state, profileId);
  saveStorageV5(state);
}

// ============================================================================
// SCHOOL MASTER DATA API
// ============================================================================

export function getSchoolV5(schoolId: string): SchoolData | undefined {
  const state = loadStorageV5();
  return state.schools.find((s) => s.id === schoolId);
}

export function createSchoolV5(
  school: Omit<SchoolData, 'id' | 'createdAt' | 'updatedAt'>
): SchoolData {
  const state = loadStorageV5();

  const trimmedNPSN = (school.npsn || '').trim();
  if (trimmedNPSN !== '') {
    const isDup = state.schools.some((s) => (s.npsn || '').trim() === trimmedNPSN);
    if (isDup) {
      throw new Error(`Duplicate NPSN "${trimmedNPSN}" found`);
    }
  }

  const now = new Date().toISOString();
  const newSchool: SchoolData = {
    ...school,
    npsn: trimmedNPSN,
    id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };

  state.schools.push(newSchool);
  saveStorageV5(state);
  return newSchool;
}

export function updateSchoolV5(
  schoolId: string,
  updates: Partial<SchoolData>
): SchoolData {
  const state = loadStorageV5();

  const index = state.schools.findIndex((s) => s.id === schoolId);
  if (index === -1) {
    throw new Error(`School with ID "${schoolId}" not found`);
  }

  const existingSchool = state.schools[index];

  if (updates.npsn !== undefined) {
    const trimmedNPSN = updates.npsn.trim();
    if (trimmedNPSN !== '' && trimmedNPSN !== (existingSchool.npsn || '').trim()) {
      const isDup = state.schools.some(
        (s) => s.id !== schoolId && (s.npsn || '').trim() === trimmedNPSN
      );
      if (isDup) {
        throw new Error(`Duplicate NPSN "${trimmedNPSN}" found for another school`);
      }
    }
  }

  const now = new Date().toISOString();
  const updatedSchool: SchoolData = {
    ...existingSchool,
    ...updates,
    npsn: updates.npsn !== undefined ? updates.npsn.trim() : existingSchool.npsn,
    id: existingSchool.id,
    createdAt: existingSchool.createdAt,
    updatedAt: now,
  };

  state.schools[index] = updatedSchool;
  saveStorageV5(state);
  return updatedSchool;
}

export function deleteSchoolV5(schoolId: string): void {
  const state = loadStorageV5();

  const schoolIndex = state.schools.findIndex((s) => s.id === schoolId);
  if (schoolIndex === -1) {
    throw new Error(`School with ID "${schoolId}" not found`);
  }

  const isProfileRef = state.profiles.some((p) => p.schoolId === schoolId);
  const isYearPlanRef = state.yearPlans.some((yp) => yp.schoolId === schoolId);
  const isWorkspaceRef = state.workspaces.some((ws) => ws.schoolId === schoolId);

  if (isProfileRef || isYearPlanRef || isWorkspaceRef) {
    throw new Error(
      `Cannot delete school "${schoolId}" because it is referenced by profiles, yearPlans, or workspaces`
    );
  }

  state.schools.splice(schoolIndex, 1);
  state.principalHistories = state.principalHistories.filter((ph) => ph.schoolId !== schoolId);

  saveStorageV5(state);
}

// ============================================================================
// PRINCIPAL HISTORY MASTER DATA API
// ============================================================================

function syncSchoolPrincipalFromHistoriesInState(
  state: AppStorageStateV5,
  schoolId: string
): void {
  const school = state.schools.find((s) => s.id === schoolId);
  if (!school) return;

  const activeHistories = state.principalHistories.filter(
    (ph) => ph.schoolId === schoolId && ph.isActive === true
  );

  if (activeHistories.length === 1) {
    const active = activeHistories[0];
    school.principalName = active.name;
    school.principalNip = active.nip;
    school.updatedAt = new Date().toISOString();
  } else if (activeHistories.length === 0) {
    school.principalName = '';
    school.principalNip = '';
    school.updatedAt = new Date().toISOString();
  }
}

export function getPrincipalHistoriesV5(schoolId: string): PrincipalHistory[] {
  const state = loadStorageV5();
  return state.principalHistories.filter((ph) => ph.schoolId === schoolId);
}

export function savePrincipalHistoryV5(history: PrincipalHistory): PrincipalHistory {
  const state = loadStorageV5();

  const school = state.schools.find((s) => s.id === history.schoolId);
  if (!school) {
    throw new Error(`School with ID "${history.schoolId}" not found`);
  }

  const index = state.principalHistories.findIndex((ph) => ph.id === history.id);
  if (index >= 0) {
    const existingHistory = state.principalHistories[index];
    if (existingHistory.schoolId !== history.schoolId) {
      throw new Error(
        `Cannot change schoolId for PrincipalHistory "${history.id}" from "${existingHistory.schoolId}" to "${history.schoolId}"`
      );
    }
  }

  if (history.isActive === true) {
    for (const ph of state.principalHistories) {
      if (ph.schoolId === history.schoolId && ph.id !== history.id) {
        ph.isActive = false;
      }
    }
  }

  if (index >= 0) {
    state.principalHistories[index] = { ...history };
  } else {
    state.principalHistories.push({ ...history });
  }

  syncSchoolPrincipalFromHistoriesInState(state, history.schoolId);

  saveStorageV5(state);
  return history;
}

export function setActivePrincipalV5(
  schoolId: string,
  historyId: string
): PrincipalHistory {
  const state = loadStorageV5();

  const school = state.schools.find((s) => s.id === schoolId);
  if (!school) {
    throw new Error(`School with ID "${schoolId}" not found`);
  }

  const history = state.principalHistories.find((ph) => ph.id === historyId);
  if (!history) {
    throw new Error(`PrincipalHistory with ID "${historyId}" not found`);
  }

  if (history.schoolId !== schoolId) {
    throw new Error(
      `PrincipalHistory "${historyId}" belongs to school "${history.schoolId}", not requested school "${schoolId}"`
    );
  }

  for (const ph of state.principalHistories) {
    if (ph.schoolId === schoolId) {
      ph.isActive = ph.id === historyId;
    }
  }

  syncSchoolPrincipalFromHistoriesInState(state, schoolId);

  saveStorageV5(state);
  return history;
}

export function deletePrincipalHistoryV5(historyId: string): void {
  const state = loadStorageV5();

  const index = state.principalHistories.findIndex((ph) => ph.id === historyId);
  if (index === -1) {
    throw new Error(`PrincipalHistory with ID "${historyId}" not found`);
  }

  const targetHistory = state.principalHistories[index];
  const schoolId = targetHistory.schoolId;

  state.principalHistories.splice(index, 1);

  syncSchoolPrincipalFromHistoriesInState(state, schoolId);

  saveStorageV5(state);
}

// ============================================================================
// HIERARCHY DELETE API
// ============================================================================

/**
 * Internal helper to atomically perform canonical YearPlan hierarchy deletion in-memory.
 */
function performDeleteYearHierarchyInState(
  state: AppStorageStateV5,
  yearPlanId: string
): void {
  const yearPlan = state.yearPlans.find((yp) => yp.id === yearPlanId);
  if (!yearPlan) {
    throw new Error(`YearPlan with ID "${yearPlanId}" not found`);
  }

  const parentWorkspaces = state.workspaces.filter((ws) => ws.yearPlanId === yearPlanId);
  if (parentWorkspaces.length !== 1) {
    throw new Error(
      `YearPlan with ID "${yearPlanId}" must have exactly 1 parent Workspace (found ${parentWorkspaces.length})`
    );
  }

  const semesterPlans = state.semesterPlans.filter((sp) => sp.yearPlanId === yearPlanId);
  const sem1 = semesterPlans.find((sp) => Number(sp.semester) === 1);
  const sem2 = semesterPlans.find((sp) => Number(sp.semester) === 2);
  if (!sem1 || !sem2 || semesterPlans.length !== 2) {
    throw new Error(
      `YearPlan with ID "${yearPlanId}" must have exactly 1 SemesterPlan for Semester 1 and 1 for Semester 2`
    );
  }

  const targetYearPlanId = yearPlan.id;
  const targetWorkspace = parentWorkspaces[0];
  const targetWorkspaceId = targetWorkspace.id;
  const targetSemesterPlanIds = new Set(semesterPlans.map((sp) => sp.id));

  // 1. Root hierarchy removal
  state.yearPlans = state.yearPlans.filter((yp) => yp.id !== targetYearPlanId);
  state.workspaces = state.workspaces.filter((ws) => ws.id !== targetWorkspaceId);
  state.semesterPlans = state.semesterPlans.filter((sp) => !targetSemesterPlanIds.has(sp.id));

  // 2. Annual cascade removal (authority: entry.yearPlanId)
  state.annualJPReferences = state.annualJPReferences.filter((e) => e.yearPlanId !== targetYearPlanId);
  state.annualData.cp = state.annualData.cp.filter((e) => e.yearPlanId !== targetYearPlanId);
  state.annualData.cpAnalysis = state.annualData.cpAnalysis.filter((e) => e.yearPlanId !== targetYearPlanId);
  state.annualData.tp = state.annualData.tp.filter((e) => e.yearPlanId !== targetYearPlanId);
  state.annualData.atp = state.annualData.atp.filter((e) => e.yearPlanId !== targetYearPlanId);
  state.annualData.curriculumContext = state.annualData.curriculumContext.filter((e) => e.yearPlanId !== targetYearPlanId);

  // 3. Semester cascade removal (authority: entry.semesterPlanId)
  state.semesterJPSettings = state.semesterJPSettings.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.academicCalendar = state.semesterData.academicCalendar.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.timeAllocation = state.semesterData.timeAllocation.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.learningPlan = state.semesterData.learningPlan.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.assessmentCriteria = state.semesterData.assessmentCriteria.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.assessmentPlan = state.semesterData.assessmentPlan.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.assessmentPackage = state.semesterData.assessmentPackage.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.roster = state.semesterData.roster.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.attendance = state.semesterData.attendance.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.grade = state.semesterData.grade.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.remedial = state.semesterData.remedial.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));
  state.semesterData.enrichment = state.semesterData.enrichment.filter((e) => !targetSemesterPlanIds.has(e.semesterPlanId));

  // 4. Documents cascade removal (authority: document.workspaceId)
  if (Array.isArray(state.documents)) {
    state.documents = state.documents.filter((doc) => doc.workspaceId !== targetWorkspaceId);
  }

  // 5. Active context pointer cleanup
  if (state.activeYearPlanId === targetYearPlanId) {
    state.activeYearPlanId = undefined;
    state.activeWorkspaceId = undefined;
    state.activeSemesterPlanId = undefined;
  }

  if (state.activeWorkspaceId === targetWorkspaceId) {
    state.activeWorkspaceId = undefined;
    if (state.activeYearPlanId === targetYearPlanId) {
      state.activeYearPlanId = undefined;
      state.activeSemesterPlanId = undefined;
    }
  }

  if (state.activeSemesterPlanId !== undefined && targetSemesterPlanIds.has(state.activeSemesterPlanId)) {
    state.activeSemesterPlanId = undefined;
  }
}

export function deleteYearHierarchyV5(yearPlanId: string): void {
  const state = loadStorageV5();
  performDeleteYearHierarchyInState(state, yearPlanId);
  saveStorageV5(state);
}

export function deleteWorkspaceV5(workspaceId: string): void {
  const state = loadStorageV5();
  const ws = state.workspaces.find((w) => w.id === workspaceId);
  if (!ws) {
    throw new Error(`Workspace with ID "${workspaceId}" not found`);
  }
  performDeleteYearHierarchyInState(state, ws.yearPlanId);
  saveStorageV5(state);
}

// ============================================================================
// HIERARCHY DUPLICATE API
// ============================================================================

export interface DuplicateYearHierarchyV5Overrides {
  academicYear?: string;
  grade?: string;
  classSection?: string;
  subject?: string;
  subjectCode?: string;
  phase?: string;
  workspaceName?: string;
  documentDate?: string;
}

export function performDuplicateYearHierarchyInState(
  state: AppStorageStateV5,
  sourceYearPlanId: string,
  overrides?: DuplicateYearHierarchyV5Overrides
): CreateYearHierarchyV5Result {
  // 1. Source Validation
  const sourceYP = state.yearPlans.find((yp) => yp.id === sourceYearPlanId);
  if (!sourceYP) {
    throw new Error(`Source YearPlan with ID "${sourceYearPlanId}" not found`);
  }

  if (sourceYP.curriculumType === 'K13') {
    throw new Error(
      `K13 hierarchy duplication is not supported in V5. Only KURIKULUM_MERDEKA is supported.`
    );
  }

  const parentWorkspaces = state.workspaces.filter((ws) => ws.yearPlanId === sourceYearPlanId);
  if (parentWorkspaces.length !== 1) {
    throw new Error(
      `Source YearPlan "${sourceYearPlanId}" must have exactly 1 parent Workspace (found ${parentWorkspaces.length})`
    );
  }
  const sourceWorkspace = parentWorkspaces[0];

  const semesterPlans = state.semesterPlans.filter((sp) => sp.yearPlanId === sourceYearPlanId);
  const sem1 = semesterPlans.find((sp) => Number(sp.semester) === 1);
  const sem2 = semesterPlans.find((sp) => Number(sp.semester) === 2);
  if (!sem1 || !sem2 || semesterPlans.length !== 2) {
    throw new Error(
      `Source YearPlan "${sourceYearPlanId}" must have exactly 1 SemesterPlan for Semester 1 and 1 for Semester 2`
    );
  }

  const profile = state.profiles.find((p) => p.id === sourceYP.profileId);
  if (!profile) {
    throw new Error(`Profile with ID "${sourceYP.profileId}" not found`);
  }

  const school = state.schools.find((s) => s.id === sourceYP.schoolId);
  if (!school) {
    throw new Error(`School with ID "${sourceYP.schoolId}" not found`);
  }

  // 2. Resolve Overrides
  const targetAcademicYear =
    overrides?.academicYear !== undefined
      ? overrides.academicYear.trim()
      : sourceYP.academicYear;

  const targetGrade =
    overrides?.grade !== undefined ? overrides.grade.trim() : sourceYP.grade;

  const targetClassSection =
    overrides?.classSection !== undefined
      ? (overrides.classSection.trim() || undefined)
      : sourceYP.classSection;

  const targetSubject =
    overrides?.subject !== undefined ? overrides.subject.trim() : sourceYP.subject;

  const targetSubjectCode =
    overrides?.subjectCode !== undefined
      ? (overrides.subjectCode.trim() || undefined)
      : sourceYP.subjectCode;

  const targetPhase =
    overrides?.phase !== undefined
      ? (overrides.phase.trim() || undefined)
      : sourceYP.phase;

  // 3. Duplicate Identity Guard
  const isDuplicate = state.yearPlans.some(
    (yp) =>
      yp.profileId === sourceYP.profileId &&
      yp.schoolId === sourceYP.schoolId &&
      yp.academicYear === targetAcademicYear &&
      yp.grade === targetGrade &&
      (yp.classSection || '') === (targetClassSection || '') &&
      yp.subject.trim().toLowerCase() === targetSubject.trim().toLowerCase()
  );

  if (isDuplicate) {
    throw new Error(
      `Duplicate YearPlan: A YearPlan already exists for profileId "${sourceYP.profileId}", schoolId "${sourceYP.schoolId}", academicYear "${targetAcademicYear}", grade "${targetGrade}", classSection "${targetClassSection || ''}", and subject "${targetSubject}".`
    );
  }

  // 4. Create New YearPlan
  const now = new Date().toISOString();
  const newYearPlanId = `yp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const newYearPlan: YearPlan = {
    id: newYearPlanId,
    profileId: sourceYP.profileId,
    schoolId: sourceYP.schoolId,
    academicYear: targetAcademicYear,
    curriculumType: sourceYP.curriculumType,
    level: sourceYP.level,
    grade: targetGrade,
    ...(targetClassSection !== undefined ? { classSection: targetClassSection } : {}),
    subject: targetSubject,
    ...(targetSubjectCode !== undefined ? { subjectCode: targetSubjectCode } : {}),
    ...(targetPhase !== undefined ? { phase: targetPhase } : {}),
    createdAt: now,
    updatedAt: now,
  };

  // 5. Create New Workspace
  const newWorkspaceId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const targetWorkspaceName =
    overrides?.workspaceName !== undefined && overrides.workspaceName.trim() !== ''
      ? overrides.workspaceName.trim()
      : `${targetSubject} - ${targetGrade} (${targetAcademicYear})`;

  const targetDocumentDate =
    overrides?.documentDate !== undefined
      ? (overrides.documentDate.trim() || undefined)
      : sourceWorkspace.documentDate;

  const newWorkspace: AdministrationWorkspaceV5 = {
    id: newWorkspaceId,
    profileId: sourceYP.profileId,
    schoolId: sourceYP.schoolId,
    yearPlanId: newYearPlanId,
    name: targetWorkspaceName,
    ...(targetDocumentDate !== undefined ? { documentDate: targetDocumentDate } : {}),
    createdAt: now,
    updatedAt: now,
  };

  // 6. Create New Semester Plans
  const newSemesterPlan1: SemesterPlan = {
    id: `sp-${Date.now()}-1-${Math.random().toString(36).slice(2, 9)}`,
    yearPlanId: newYearPlanId,
    semester: 1,
    createdAt: now,
    updatedAt: now,
  };

  const newSemesterPlan2: SemesterPlan = {
    id: `sp-${Date.now()}-2-${Math.random().toString(36).slice(2, 9)}`,
    yearPlanId: newYearPlanId,
    semester: 2,
    createdAt: now,
    updatedAt: now,
  };

  state.yearPlans.push(newYearPlan);
  state.workspaces.push(newWorkspace);
  state.semesterPlans.push(newSemesterPlan1, newSemesterPlan2);

  // 7. Active Context Pointer Update
  state.activeProfileId = sourceYP.profileId;
  state.activeYearPlanId = newYearPlanId;
  state.activeWorkspaceId = newWorkspaceId;
  state.activeSemesterPlanId = undefined;

  return {
    yearPlan: newYearPlan,
    workspace: newWorkspace,
    semesterPlans: [newSemesterPlan1, newSemesterPlan2],
  };
}

export function duplicateYearHierarchyV5(
  sourceYearPlanId: string,
  overrides?: DuplicateYearHierarchyV5Overrides
): CreateYearHierarchyV5Result {
  const state = loadStorageV5();
  const result = performDuplicateYearHierarchyInState(state, sourceYearPlanId, overrides);
  saveStorageV5(state);
  return result;
}

export function duplicateWorkspaceV5(
  sourceWorkspaceId: string,
  overrides?: DuplicateYearHierarchyV5Overrides
): CreateYearHierarchyV5Result {
  const state = loadStorageV5();
  const ws = state.workspaces.find((w) => w.id === sourceWorkspaceId);
  if (!ws) {
    throw new Error(`Workspace with ID "${sourceWorkspaceId}" not found`);
  }
  const result = performDuplicateYearHierarchyInState(state, ws.yearPlanId, overrides);
  saveStorageV5(state);
  return result;
}


