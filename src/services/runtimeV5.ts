import {
  TeacherProfile,
  SchoolData,
  YearPlan,
  SemesterPlan,
} from '../types';
import { AdministrationWorkspaceV5 } from '../types/storageV5';
import {
  AnnualDataV5Result,
  SemesterDataV5Result,
  loadStorageV5,
} from './storageV5';

export interface RuntimeContextV5 {
  activeProfile: TeacherProfile | undefined;
  activeSchool: SchoolData | undefined;
  activeYearPlan: YearPlan | undefined;
  activeWorkspace: AdministrationWorkspaceV5 | undefined;

  yearPlansForActiveProfile: YearPlan[];
  workspacesForActiveProfile: AdministrationWorkspaceV5[];

  semesterPlansForActiveYear: SemesterPlan[];
  activeSemesterPlan: SemesterPlan | undefined;

  annualData: AnnualDataV5Result | undefined;
  semesterData: SemesterDataV5Result | undefined;

  curriculumRuntimeStatus: 'READY' | 'K13_DEFERRED' | 'NO_YEAR_PLAN';
}

/**
 * Resolves the V5 Runtime Context read model from canonical V5 storage state.
 *
 * Contract:
 * - If the V5 storage key exists: Performs exactly 1 V5 storage read (loadStorageV5) and 0 writes.
 * - If the V5 storage key is missing (first-run): Performs exactly 1 V5 storage read,
 *   initializes the canonical empty V5 state (which performs exactly 1 V5 write), and returns
 *   a valid empty RuntimeContextV5.
 *
 * Never reads or touches legacy V3 storage.
 */
export function getRuntimeContextV5(): RuntimeContextV5 {
  const state = loadStorageV5();

  // 1. Resolve active entities
  const activeProfile = state.activeProfileId
    ? state.profiles.find((p) => p.id === state.activeProfileId)
    : undefined;

  const activeYearPlan = state.activeYearPlanId
    ? state.yearPlans.find((yp) => yp.id === state.activeYearPlanId)
    : undefined;

  const activeWorkspace = state.activeWorkspaceId
    ? state.workspaces.find((ws) => ws.id === state.activeWorkspaceId)
    : undefined;

  // 2. Resolve activeSchool according to canonical rules:
  // - From activeYearPlan.schoolId if active YearPlan exists;
  // - If no active YearPlan but activeProfile has schoolId, use activeProfile school.
  let activeSchool: SchoolData | undefined;
  if (activeYearPlan?.schoolId) {
    activeSchool = state.schools.find((s) => s.id === activeYearPlan.schoolId);
  } else if (activeProfile?.schoolId) {
    activeSchool = state.schools.find((s) => s.id === activeProfile.schoolId);
  }

  // 3. Resolve collections for active profile
  const yearPlansForActiveProfile = activeProfile
    ? state.yearPlans.filter((yp) => yp.profileId === activeProfile.id)
    : [];

  const workspacesForActiveProfile = activeProfile
    ? state.workspaces.filter((ws) => ws.profileId === activeProfile.id)
    : [];

  // 4. Resolve semester plans for active year plan
  const semesterPlansForActiveYear = activeYearPlan
    ? state.semesterPlans.filter((sp) => sp.yearPlanId === activeYearPlan.id)
    : [];

  // 5. Resolve active semester plan
  // Rule: Do not auto-select Semester 1 if activeSemesterPlanId is undefined or invalid
  const activeSemesterPlan =
    state.activeSemesterPlanId && activeYearPlan
      ? semesterPlansForActiveYear.find((sp) => sp.id === state.activeSemesterPlanId)
      : undefined;

  // 6. Resolve annual data for active year plan
  // Rule: If activeYearPlan is undefined -> annualData is undefined
  let annualData: AnnualDataV5Result | undefined;
  if (activeYearPlan) {
    const yearPlanId = activeYearPlan.id;
    annualData = {
      yearPlan: activeYearPlan,
      cp: state.annualData.cp.find((e) => e.yearPlanId === yearPlanId)?.value,
      cpAnalysis: state.annualData.cpAnalysis.find((e) => e.yearPlanId === yearPlanId)?.value,
      tp: state.annualData.tp.find((e) => e.yearPlanId === yearPlanId)?.value,
      atp: state.annualData.atp.find((e) => e.yearPlanId === yearPlanId)?.value,
      curriculumContext: state.annualData.curriculumContext.find(
        (e) => e.yearPlanId === yearPlanId
      )?.value,
      annualJPReference: state.annualJPReferences.find(
        (e) => e.yearPlanId === yearPlanId
      )?.value,
    };
  }

  // 7. Resolve semester data for active semester plan
  // Rule: If activeSemesterPlan is undefined -> semesterData is undefined
  let semesterData: SemesterDataV5Result | undefined;
  if (activeSemesterPlan && activeYearPlan) {
    const semesterPlanId = activeSemesterPlan.id;
    semesterData = {
      semesterPlan: activeSemesterPlan,
      yearPlan: activeYearPlan,
      semesterJPSetting: state.semesterJPSettings.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      academicCalendar: state.semesterData.academicCalendar.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      timeAllocation: state.semesterData.timeAllocation.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      learningPlan: state.semesterData.learningPlan.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      assessmentCriteria: state.semesterData.assessmentCriteria.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      assessmentPlan: state.semesterData.assessmentPlan.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      assessmentPackage: state.semesterData.assessmentPackage.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      roster: state.semesterData.roster.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      attendance: state.semesterData.attendance.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      grade: state.semesterData.grade.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      remedial: state.semesterData.remedial.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
      enrichment: state.semesterData.enrichment.find(
        (e) => e.semesterPlanId === semesterPlanId
      )?.value,
    };
  }

  // 8. Resolve curriculum runtime status
  let curriculumRuntimeStatus: 'READY' | 'K13_DEFERRED' | 'NO_YEAR_PLAN';
  if (!activeYearPlan) {
    curriculumRuntimeStatus = 'NO_YEAR_PLAN';
  } else if (activeYearPlan.curriculumType === 'K13') {
    curriculumRuntimeStatus = 'K13_DEFERRED';
  } else {
    curriculumRuntimeStatus = 'READY';
  }

  return {
    activeProfile,
    activeSchool,
    activeYearPlan,
    activeWorkspace,
    yearPlansForActiveProfile,
    workspacesForActiveProfile,
    semesterPlansForActiveYear,
    activeSemesterPlan,
    annualData,
    semesterData,
    curriculumRuntimeStatus,
  };
}
