import {
  AppStorageState,
  TeacherProfile,
  TeacherSchoolAssignment,
  SchoolData,
  AcademicSetting,
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
} from '../types';
import { getCurriculumTypeFromSetting, isK13, isMerdeka } from './curriculumRouter';
import { validateATPReferences, normalizeATPReferences, validateATPDataWorkflow } from './cpWorkflowService';
import {
  INITIAL_PROFILES,
  INITIAL_SCHOOL,
  INITIAL_ACADEMIC_SETTINGS,
  INITIAL_CP_DATA,
  INITIAL_TP_DATA,
  INITIAL_ATP_DATA,
  buildActiveContext,
  getPhaseFromGrade,
} from '../data/curriculumDefaults';
import saveAs from 'file-saver';

const STORAGE_KEY = 'administrasi_guru_ai_storage_v3';
const V2_STORAGE_KEY = 'administrasi_guru_ai_storage_v2';
const LEGACY_STORAGE_KEY = 'administrasi_guru_ai_storage_v1';

export const DEFAULT_SAMPLE_STUDENTS: { name: string; gender: 'L' | 'P'; nisn: string }[] = [
  { name: 'Ahmad Faiz Al-Farisi', gender: 'L', nisn: '0123456781' },
  { name: 'Annisa Rahmawati', gender: 'P', nisn: '0123456782' },
  { name: 'Budi Kurniawan', gender: 'L', nisn: '0123456783' },
  { name: 'Citra Dewi Lestari', gender: 'P', nisn: '0123456784' },
  { name: 'Daffa Rizky Pratama', gender: 'L', nisn: '0123456785' },
  { name: 'Dewi Sartika Putri', gender: 'P', nisn: '0123456786' },
  { name: 'Eko Wahyudi', gender: 'L', nisn: '0123456787' },
  { name: 'Farah Salsabila', gender: 'P', nisn: '0123456788' },
  { name: 'Gilang Ramadhan', gender: 'L', nisn: '0123456789' },
  { name: 'Hafizah Nur Aini', gender: 'P', nisn: '0123456790' },
];

export function createDefaultCalendarForSetting(setting: AcademicSetting): { calendar: AcademicCalendar; days: CalendarDay[] } {
  const isSem1 = setting.semester?.startsWith('1') ?? true;
  const yearParts = (setting.academicYear || '2026/2027').split('/');
  const startYear = parseInt(yearParts[0], 10) || 2026;
  const endYear = parseInt(yearParts[1], 10) || startYear + 1;

  const startDate = isSem1 ? `${startYear}-07-13` : `${endYear}-01-05`;
  const endDate = isSem1 ? `${startYear}-12-19` : `${endYear}-06-25`;

  const calId = `cal-${setting.id}`;
  const calendar: AcademicCalendar = {
    id: calId,
    academicSettingId: setting.id,
    academicYear: setting.academicYear || '2026/2027',
    semester: setting.semester || '1 (Ganjil)',
    startDate,
    endDate,
    schoolDaysPerWeek: 5,
    jpPerWeek: Number(setting.totalHoursPerWeek) || 4,
    notes: `Kalender Akademik Semester ${setting.semester || '1'} Tahun Ajaran ${setting.academicYear || '2026/2027'}`,
    updatedAt: new Date().toISOString(),
  };

  const days: CalendarDay[] = [];
  if (isSem1) {
    days.push(
      { id: `day-${calId}-mpls`, academicCalendarId: calId, date: `${startYear}-07-13`, status: 'schoolEvent', notes: 'Hari Pertama Masuk Sekolah / MPLS' },
      { id: `day-${calId}-hutri`, academicCalendarId: calId, date: `${startYear}-08-17`, status: 'holiday', notes: 'Hari Kemerdekaan RI Ke-81' },
      { id: `day-${calId}-pts`, academicCalendarId: calId, date: `${startYear}-09-21`, status: 'schoolEvent', notes: 'Penilaian Tengah Semester (PTS/STS)' },
      { id: `day-${calId}-guru`, academicCalendarId: calId, date: `${startYear}-11-25`, status: 'schoolEvent', notes: 'Peringatan Hari Guru Nasional' },
      { id: `day-${calId}-pas`, academicCalendarId: calId, date: `${startYear}-12-07`, status: 'schoolEvent', notes: 'Penilaian Akhir Semester (PAS/SAS)' },
      { id: `day-${calId}-rapor`, academicCalendarId: calId, date: `${startYear}-12-19`, status: 'schoolEvent', notes: 'Pembagian Buku Rapor Semester Ganjil' }
    );
  } else {
    days.push(
      { id: `day-${calId}-masuk2`, academicCalendarId: calId, date: `${endYear}-01-05`, status: 'schoolEvent', notes: 'Hari Pertama Masuk Semester Genap' },
      { id: `day-${calId}-pts2`, academicCalendarId: calId, date: `${endYear}-03-08`, status: 'schoolEvent', notes: 'Penilaian Tengah Semester Genap' },
      { id: `day-${calId}-lebaran`, academicCalendarId: calId, date: `${endYear}-04-01`, status: 'holiday', notes: 'Libur Hari Raya Idul Fitri' },
      { id: `day-${calId}-pat`, academicCalendarId: calId, date: `${endYear}-06-07`, status: 'schoolEvent', notes: 'Penilaian Akhir Tahun (PAT/SAS Genap)' },
      { id: `day-${calId}-rapor2`, academicCalendarId: calId, date: `${endYear}-06-25`, status: 'schoolEvent', notes: 'Pembagian Buku Rapor & Kenaikan Kelas' }
    );
  }

  return { calendar, days };
}

export function generateWorkspaceName(setting: {
  subject: string;
  grade: string;
  semester?: string;
  academicYear?: string;
}): string {
  const mapel = setting.subject || 'Mata Pelajaran';
  const kelas = setting.grade || 'Kelas';
  const sem = setting.semester?.startsWith('1') ? 'Sem 1' : setting.semester?.startsWith('2') ? 'Sem 2' : 'Sem 1';
  const thn = setting.academicYear || '2026/2027';
  return `${mapel} — ${kelas} — ${sem} — ${thn}`;
}

export function getInitialState(): AppStorageState {
  const initialWorkspaces: AdministrationWorkspace[] = [
    {
      id: 'ws-prof-1-1',
      profileId: 'prof-1',
      schoolId: 'sch-default-1',
      academicSettingId: 'acad-prof-1',
      name: 'PJOK — Kelas 1 — Sem 1 — 2026/2027',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ws-prof-2-1',
      profileId: 'prof-2',
      schoolId: 'sch-default-1',
      academicSettingId: 'acad-prof-2',
      name: 'Bahasa Indonesia — Kelas 4 — Sem 1 — 2025/2026',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ws-prof-3-1',
      profileId: 'prof-3',
      schoolId: 'sch-default-1',
      academicSettingId: 'acad-prof-3',
      name: 'Matematika — Kelas 4 — Sem 1 — 2025/2026',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    version: 4,
    activeProfileId: INITIAL_PROFILES[0].id,
    activeWorkspaceId: initialWorkspaces[0].id,
    profiles: [...INITIAL_PROFILES],
    schools: [{ ...INITIAL_SCHOOL }],
    teacherSchoolAssignments: [],
    principalHistories: [],
    workspaces: initialWorkspaces,
    academicSettings: [...INITIAL_ACADEMIC_SETTINGS],
    cps: [...INITIAL_CP_DATA],
    cpAnalyses: [],
    tps: [...INITIAL_TP_DATA],
    atps: [...INITIAL_ATP_DATA],
    documents: [
      {
        id: 'doc-atp-1',
        type: 'ATP',
        title: 'Alur Tujuan Pembelajaran (ATP) - PJOK Kelas 1 Fase A',
        status: 'completed',
        lastGenerated: new Date().toISOString(),
        fileName: 'ATP_PJOK_Kelas_1_Fase_A.docx',
        academicSettingId: 'acad-prof-1',
        workspaceId: 'ws-prof-1-1',
      },
      {
        id: 'doc-prota-1',
        type: 'PROTA',
        title: 'Program Tahunan (PROTA)',
        status: 'completed',
        lastGenerated: new Date().toISOString(),
        fileName: 'PROTA_PJOK_Kelas_1.docx',
        academicSettingId: 'acad-prof-1',
        workspaceId: 'ws-prof-1-1',
      },
      {
        id: 'doc-promes-1',
        type: 'PROMES',
        title: 'Program Semester (PROMES)',
        status: 'completed',
        lastGenerated: new Date().toISOString(),
        fileName: 'PROMES_PJOK_Kelas_1.docx',
        academicSettingId: 'acad-prof-1',
        workspaceId: 'ws-prof-1-1',
      },
      {
        id: 'doc-modul-1',
        type: 'MODUL_AJAR',
        title: 'Modul Ajar / RPP Berdiferensiasi',
        status: 'completed',
        lastGenerated: new Date().toISOString(),
        fileName: 'Modul_Ajar_PJOK_Kelas_1.docx',
        academicSettingId: 'acad-prof-1',
        workspaceId: 'ws-prof-1-1',
      },
      {
        id: 'doc-asesmen-1',
        type: 'ASESMEN',
        title: 'Instrumen Asesmen & Rubrik',
        status: 'completed',
        lastGenerated: new Date().toISOString(),
        fileName: 'Asesmen_PJOK_Kelas_1.docx',
        academicSettingId: 'acad-prof-1',
        workspaceId: 'ws-prof-1-1',
      },
      {
        id: 'doc-jurnal-1',
        type: 'JURNAL',
        title: 'Jurnal Harian Mengajar & Refleksi',
        status: 'completed',
        lastGenerated: new Date().toISOString(),
        fileName: 'Jurnal_Mengajar_PJOK_Kelas_1.docx',
        academicSettingId: 'acad-prof-1',
        workspaceId: 'ws-prof-1-1',
      },
    ],
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
    if (!parsed || !parsed.profiles || parsed.profiles.length === 0) {
      const initial = getInitialState();
      saveAppStorage(initial);
      return initial;
    }

    let needsResave = false;

    // Ensure collections exist
    if (!parsed.workspaces || !Array.isArray(parsed.workspaces) || parsed.workspaces.length === 0) {
      parsed.workspaces = [];
      parsed.academicSettings.forEach((setting) => {
        const ws: AdministrationWorkspace = {
          id: `ws-${setting.id}`,
          profileId: setting.profileId,
          schoolId: parsed.profiles.find((p) => p.id === setting.profileId)?.schoolId || parsed.schools[0]?.id || 'sch-default-1',
          academicSettingId: setting.id,
          name: generateWorkspaceName(setting),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        parsed.workspaces.push(ws);
      });
      needsResave = true;
    }

    if (!Array.isArray(parsed.students)) { parsed.students = []; needsResave = true; }
    if (!Array.isArray(parsed.schools)) { parsed.schools = [{ ...INITIAL_SCHOOL }]; needsResave = true; }
    if (!Array.isArray(parsed.principalHistories)) { parsed.principalHistories = []; needsResave = true; }

    // Migration: ensure every profile has a valid schoolId
    // If TeacherProfile.schoolId is valid, keep it.
    // If empty/invalid, use legacy assignment once if available, otherwise default to first school.
    parsed.profiles.forEach((p) => {
      const isSchoolValid = p.schoolId && parsed.schools.some((s) => s.id === p.schoolId);
      if (!isSchoolValid) {
        const legacyAssign = (parsed.teacherSchoolAssignments || []).find(
          (a) => a.teacherId === p.id && parsed.schools.some((s) => s.id === a.schoolId)
        );
        if (legacyAssign) {
          p.schoolId = legacyAssign.schoolId;
        } else {
          p.schoolId = parsed.schools[0]?.id || INITIAL_SCHOOL.id;
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
    if (!Array.isArray(parsed.cpAnalyses)) { parsed.cpAnalyses = []; needsResave = true; }
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

    // Ensure core curriculum data arrays exist and items are sanitized
    if (!Array.isArray(parsed.cps) || parsed.cps.length === 0) {
      parsed.cps = [...INITIAL_CP_DATA];
      needsResave = true;
    } else {
      parsed.cps = parsed.cps.map((c) => ({
        ...c,
        elements: Array.isArray(c.elements) ? c.elements : [],
      }));
    }

    if (!Array.isArray(parsed.tps) || parsed.tps.length === 0) {
      parsed.tps = [...INITIAL_TP_DATA];
      needsResave = true;
    } else {
      parsed.tps = parsed.tps.map((t) => ({
        ...t,
        items: Array.isArray(t.items) ? t.items : [],
      }));
    }

    if (!Array.isArray(parsed.atps) || parsed.atps.length === 0) {
      parsed.atps = [...INITIAL_ATP_DATA];
      needsResave = true;
    } else {
      parsed.atps = parsed.atps.map((a) => ({
        ...a,
        items: Array.isArray(a.items) ? a.items : [],
      }));
    }

    // Auto-migrate: ensure all academicSettings have explicit curriculumType and derived phases
    parsed.academicSettings = parsed.academicSettings.map((setting) => {
      const derived = getPhaseFromGrade(setting.level || 'SD', setting.grade || 'Kelas 1');
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

    // Ensure activeWorkspaceId is valid
    if (!parsed.activeWorkspaceId || !parsed.workspaces.some((w) => w.id === parsed.activeWorkspaceId)) {
      const currentProfileWs = parsed.workspaces.find((w) => w.profileId === parsed.activeProfileId);
      parsed.activeWorkspaceId = currentProfileWs ? currentProfileWs.id : parsed.workspaces[0]?.id;
      needsResave = true;
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
    profiles: Array.isArray(v2Data.profiles) && v2Data.profiles.length > 0 ? v2Data.profiles : initial.profiles,
    schools: Array.isArray(v2Data.schools) && v2Data.schools.length > 0 ? v2Data.schools : initial.schools,
    principalHistories: Array.isArray(v2Data.principalHistories) ? v2Data.principalHistories : [],
    workspaces: Array.isArray(v2Data.workspaces) && v2Data.workspaces.length > 0 ? v2Data.workspaces : initial.workspaces,
    academicSettings: Array.isArray(v2Data.academicSettings) && v2Data.academicSettings.length > 0 ? v2Data.academicSettings : initial.academicSettings,
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
  };
}

function migrateV1ToV2(v1Data: any): AppStorageState {
  const initial = getInitialState();
  const profiles: TeacherProfile[] = Array.isArray(v1Data.profiles) && v1Data.profiles.length > 0 ? v1Data.profiles : initial.profiles;
  const schools: SchoolData[] = Array.isArray(v1Data.schools) && v1Data.schools.length > 0 ? v1Data.schools : initial.schools;
  const academicSettings: AcademicSetting[] = Array.isArray(v1Data.academicSettings) && v1Data.academicSettings.length > 0 ? v1Data.academicSettings : initial.academicSettings;
  const cps: CPData[] = Array.isArray(v1Data.cps) ? v1Data.cps : initial.cps;
  const tps: TPData[] = Array.isArray(v1Data.tps) ? v1Data.tps : initial.tps;
  const atps: ATPData[] = Array.isArray(v1Data.atps) ? v1Data.atps : initial.atps;
  const documents: AppDocumentRecord[] = Array.isArray(v1Data.documents) ? v1Data.documents : initial.documents;

  const workspaces: AdministrationWorkspace[] = [];
  academicSettings.forEach((setting, idx) => {
    const ws: AdministrationWorkspace = {
      id: `ws-${setting.id || idx}`,
      profileId: setting.profileId,
      schoolId: profiles.find((p) => p.id === setting.profileId)?.schoolId || schools[0]?.id || 'sch-default-1',
      academicSettingId: setting.id,
      name: generateWorkspaceName(setting),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workspaces.push(ws);
  });

  const activeProfileId = v1Data.activeProfileId || profiles[0].id;
  const activeWs = workspaces.find((w) => w.profileId === activeProfileId) || workspaces[0];

  return {
    version: 2,
    activeProfileId,
    activeWorkspaceId: activeWs?.id,
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
export function getProfileWorkspace(profileId: string, workspaceId?: string): ProfileWorkspaceData {
  const state = loadAppStorage();
  const profile = state.profiles.find((p) => p.id === profileId) || state.profiles[0] || INITIAL_PROFILES[0];

  // 1 Profil Guru = 1 Sekolah Utama (master data SchoolData)
  let school = (profile.schoolId ? state.schools.find((s) => s.id === profile.schoolId) : undefined)
    || state.schools[0]
    || INITIAL_SCHOOL;

  // Ensure profile references this valid school
  if (profile.schoolId !== school.id) {
    profile.schoolId = school.id;
    saveAppStorage(state);
  }

  // Workspaces strictly for this teacher profile
  let profileWorkspaces = state.workspaces.filter((w) => w.profileId === profile.id);

  // Synchronize schoolId across all workspaces for this profile
  profileWorkspaces.forEach((w) => {
    if (w.schoolId !== school.id) {
      w.schoolId = school.id;
    }
  });

  // Resolve active workspace
  let targetWs: AdministrationWorkspace | undefined;
  if (workspaceId) {
    targetWs = profileWorkspaces.find((w) => w.id === workspaceId);
  }
  if (!targetWs) {
    targetWs = profileWorkspaces.find((w) => w.id === state.activeWorkspaceId) || profileWorkspaces[0];
  }

  // If no workspace exists for this profile, bootstrap one automatically
  if (!targetWs) {
    const newSettingId = `acad-${profile.id}-${Date.now()}`;
    const derivedPhase = getPhaseFromGrade(profile.defaultLevel || 'SD', 'Kelas 1');
    const newSetting: AcademicSetting = {
      id: newSettingId,
      profileId: profile.id,
      curriculum: 'Kurikulum Merdeka',
      academicYear: '2026/2027',
      semester: '1 (Ganjil)',
      level: profile.defaultLevel || 'SD',
      grade: 'Kelas 1',
      phase: derivedPhase,
      subject: profile.defaultSubject || 'Bahasa Indonesia',
      totalHoursPerWeek: 4,
      updatedAt: new Date().toISOString(),
    };

    const newWs: AdministrationWorkspace = {
      id: `ws-${newSettingId}`,
      profileId: profile.id,
      schoolId: school.id,
      academicSettingId: newSettingId,
      name: generateWorkspaceName(newSetting),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.academicSettings.push(newSetting);
    state.workspaces.push(newWs);
    state.activeWorkspaceId = newWs.id;
    targetWs = newWs;
    profileWorkspaces = [newWs];
    saveAppStorage(state);
  }

  // Retrieve Academic Setting for this workspace
  let academicSetting = state.academicSettings.find((a) => a.id === targetWs!.academicSettingId);
  if (!academicSetting) {
    const derivedPhase = getPhaseFromGrade(profile.defaultLevel || 'SD', 'Kelas 1');
    academicSetting = {
      id: targetWs.academicSettingId,
      profileId: profile.id,
      curriculum: 'Kurikulum Merdeka',
      academicYear: '2026/2027',
      semester: '1 (Ganjil)',
      level: profile.defaultLevel || 'SD',
      grade: 'Kelas 1',
      phase: derivedPhase,
      subject: profile.defaultSubject || 'Bahasa Indonesia',
      totalHoursPerWeek: 4,
      updatedAt: new Date().toISOString(),
    };
    state.academicSettings.push(academicSetting);
    saveAppStorage(state);
  }

  // Ensure derived phase is always up to date
  const derivedPhase = getPhaseFromGrade(academicSetting.level, academicSetting.grade);
  if (academicSetting.phase !== derivedPhase) {
    academicSetting.phase = derivedPhase;
  }

  // Build the unified single source of truth activeContext
  const context = buildActiveContext(profile, school, academicSetting);
  const curType = getCurriculumTypeFromSetting(academicSetting);
  let stateNeedsSave = false;

  // Retrieve CP strictly for this workspace's academic setting
  let cp = state.cps.find((c) => c.academicSettingId === academicSetting!.id);
  if (!cp) {
    cp = {
      id: `cp-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      generalDescription: '',
      elements: [],
      updatedAt: new Date().toISOString(),
    };
    if (curType === 'KURIKULUM_MERDEKA') {
      state.cps.push(cp);
      stateNeedsSave = true;
    }
  } else {
    cp = {
      ...cp,
      elements: Array.isArray(cp.elements) ? cp.elements : [],
    };
  }

  // Retrieve TP strictly for this workspace's academic setting
  let tp = state.tps.find((t) => t.academicSettingId === academicSetting!.id);
  if (!tp) {
    tp = {
      id: `tp-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      items: [],
      updatedAt: new Date().toISOString(),
    };
    if (curType === 'KURIKULUM_MERDEKA') {
      state.tps.push(tp);
      stateNeedsSave = true;
    }
  } else {
    tp = {
      ...tp,
      items: Array.isArray(tp.items) ? tp.items : [],
    };
  }

  // Retrieve ATP strictly for this workspace's academic setting
  let atp = state.atps.find((a) => a.academicSettingId === academicSetting!.id);
  if (!atp) {
    atp = {
      id: `atp-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      rationale: '',
      items: [],
      totalJP: 0,
      updatedAt: new Date().toISOString(),
    };
    if (curType === 'KURIKULUM_MERDEKA') {
      state.atps.push(atp);
      stateNeedsSave = true;
    }
  } else {
    atp = {
      ...atp,
      items: Array.isArray(atp.items) ? atp.items : [],
    };
  }

  if (stateNeedsSave) {
    saveAppStorage(state);
  }

  // Retrieve workspace documents
  const workspaceDocs = (state.documents || []).filter(
    (d) => d.academicSettingId === academicSetting!.id || d.workspaceId === targetWs!.id
  );

  // Retrieve & guarantee Students strictly for this academicSetting
  let settingStudents = (state.students || []).filter((s) => s.academicSettingId === academicSetting!.id);
  if (settingStudents.length === 0) {
    settingStudents = DEFAULT_SAMPLE_STUDENTS.map((s, idx) => ({
      id: `std-${academicSetting!.id}-${idx + 1}`,
      academicSettingId: academicSetting!.id,
      name: s.name,
      gender: s.gender,
      nisn: s.nisn,
    }));
    state.students = [...(state.students || []), ...settingStudents];
    saveAppStorage(state);
  }

  // Retrieve & guarantee Academic Calendar strictly for this academicSetting
  let calendar = (state.academicCalendars || []).find((c) => c.academicSettingId === academicSetting!.id);
  let calendarDays = (state.effectiveDays || []).filter((d) => d.academicCalendarId === calendar?.id);
  if (!calendar) {
    const defCal = createDefaultCalendarForSetting(academicSetting!);
    calendar = defCal.calendar;
    calendarDays = defCal.days;
    state.academicCalendars = [...(state.academicCalendars || []), calendar];
    state.effectiveDays = [...(state.effectiveDays || []), ...calendarDays];
    saveAppStorage(state);
  }

  // Retrieve Time Allocations
  const timeAllocations = (state.timeAllocations || []).filter((t) => t.academicSettingId === academicSetting!.id);

  // Retrieve Attendance Sessions & Records
  const attendanceSessions = (state.attendanceSessions || []).filter((s) => s.academicSettingId === academicSetting!.id);
  const sessionIds = new Set(attendanceSessions.map((s) => s.id));
  const attendanceRecords = (state.attendanceRecords || []).filter((r) => sessionIds.has(r.sessionId));

  // Retrieve KKTP (Assessment Criteria)
  const assessmentCriteria = (state.assessmentCriteria || []).filter((c) => c.academicSettingId === academicSetting!.id);

  // Retrieve Assessments & Results
  const assessments = (state.assessments || []).filter((a) => a.academicSettingId === academicSetting!.id);
  const assessmentIds = new Set(assessments.map((a) => a.id));
  const assessmentResults = (state.assessmentResults || []).filter((r) => assessmentIds.has(r.assessmentId));

  // Retrieve Remedials & Enrichments
  const remedials = (state.remedialRecords || []).filter((r) => r.academicSettingId === academicSetting!.id);
  const enrichments = (state.enrichmentRecords || []).filter((e) => e.academicSettingId === academicSetting!.id);

  // Retrieve K13 items if exists, guarantee for K13 workspace
  let k13Analysis = (state.k13Analyses || []).find((k) => k.academicSettingId === academicSetting!.id);
  if (!k13Analysis && curType === 'K13') {
    k13Analysis = {
      id: `k13-ana-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      items: [
        {
          id: `k13-item-1`,
          skl: 'Memiliki perilaku yang mencerminkan sikap orang beriman, berakhlak mulia, dan bertanggung jawab.',
          ki: 'KI-3 (Pengetahuan) & KI-4 (Keterampilan)',
          kd: '3.1 Memahami konsep dan prinsip dasar pembelajaran.',
          indikator: '3.1.1 Mengidentifikasi prinsip dan konsep dasar materi pokok.',
          materi: 'Materi Pokok Pembelajaran Semester Aktif',
          kegiatan: 'Pendekatan Saintifik (5M: Mengamati, Menanya, Mengumpulkan Informasi, Menalar, Mengomunikasikan)',
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    state.k13Analyses = [...(state.k13Analyses || []), k13Analysis];
    saveAppStorage(state);
  }

  let k13KKM = (state.k13KKMs || []).find((k) => k.academicSettingId === academicSetting!.id);
  if (!k13KKM && curType === 'K13') {
    k13KKM = {
      id: `k13-kkm-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      kkmMataPelajaran: 75,
      predikatA: 89,
      predikatB: 79,
      predikatC: 70,
      items: [
        {
          id: `kkm-item-1`,
          kd: '3.1 Memahami konsep dan prinsip dasar pembelajaran',
          indikator: 'Mengidentifikasi prinsip dan konsep dasar materi pokok',
          kompleksitas: 75,
          dayaDukung: 78,
          intake: 74,
          kkmIndikator: 76,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    state.k13KKMs = [...(state.k13KKMs || []), k13KKM];
    saveAppStorage(state);
  }

  // Retrieve CP Analysis if exists
  const cpAnalysis = (state.cpAnalyses || []).find((a) => a.academicSettingId === academicSetting!.id);
  const principalHistories = (state.principalHistories || []).filter((h) => h.schoolId === school.id);

  return {
    profile,
    school,
    schools: state.schools || [{ ...INITIAL_SCHOOL }],
    teacherSchoolAssignments: state.teacherSchoolAssignments || [],
    assignedSchools: [school],
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
  };
}

/**
 * Creates a brand new Administration Workspace for a teacher profile.
 */
export function createWorkspace(params: {
  profileId: string;
  schoolId?: string;
  name?: string;
  setting: {
    curriculum?: string;
    academicYear?: string;
    semester?: '1 (Ganjil)' | '2 (Genap)';
    level?: 'SD' | 'SMP' | 'SMA' | 'SMK';
    grade: string;
    subject: string;
    totalHoursPerWeek?: number;
  };
}): AdministrationWorkspace {
  const state = loadAppStorage();
  const profile = state.profiles.find((p) => p.id === params.profileId) || state.profiles[0];
  // 1 Profil Guru = 1 Sekolah Utama: workspace.schoolId is strictly profile.schoolId
  const school = (profile.schoolId ? state.schools.find((s) => s.id === profile.schoolId) : undefined)
    || state.schools[0]
    || INITIAL_SCHOOL;
  const schoolId = school.id;

  const newSettingId = `acad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const level = params.setting.level || profile.defaultLevel || 'SD';
  const derivedPhase = getPhaseFromGrade(level, params.setting.grade);
  const curType = params.setting.curriculum === 'Kurikulum 2013' ? 'K13' : 'KURIKULUM_MERDEKA';

  const newSetting: AcademicSetting = {
    id: newSettingId,
    profileId: profile.id,
    curriculum: params.setting.curriculum || (curType === 'K13' ? 'Kurikulum 2013' : 'Kurikulum Merdeka'),
    curriculumType: curType,
    academicYear: params.setting.academicYear || '2026/2027',
    semester: params.setting.semester || '1 (Ganjil)',
    level,
    grade: params.setting.grade || 'Kelas 1',
    phase: derivedPhase,
    subject: params.setting.subject || 'Mata Pelajaran',
    totalHoursPerWeek: params.setting.totalHoursPerWeek || 4,
    updatedAt: new Date().toISOString(),
  };

  const wsName = params.name && params.name.trim().length > 0
    ? params.name.trim()
    : generateWorkspaceName(newSetting);

  const newWorkspace: AdministrationWorkspace = {
    id: `ws-${Date.now()}`,
    profileId: profile.id,
    schoolId,
    academicSettingId: newSettingId,
    name: wsName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialStudents: Student[] = DEFAULT_SAMPLE_STUDENTS.map((s, idx) => ({
    id: `std-${newSettingId}-${idx + 1}`,
    academicSettingId: newSettingId,
    name: s.name,
    gender: s.gender,
    nisn: s.nisn,
  }));

  state.academicSettings.push(newSetting);
  state.workspaces.push(newWorkspace);
  state.students = [...(state.students || []), ...initialStudents];

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
  } else {
    // K13: Create K13Analysis and K13KKM instances. DO NOT create CP/TP/ATP!
    const newK13Analysis: K13Analysis = {
      id: `k13-ana-${newSettingId}`,
      academicSettingId: newSettingId,
      items: [
        {
          id: `k13-item-${Date.now()}-1`,
          skl: 'Memiliki perilaku yang mencerminkan sikap orang beriman, berakhlak mulia, dan bertanggung jawab.',
          ki: 'KI-3 (Pengetahuan) & KI-4 (Keterampilan)',
          kd: '3.1 Memahami konsep dan prinsip dasar pembelajaran.',
          indikator: '3.1.1 Mengidentifikasi prinsip dan konsep dasar materi pokok.',
          materi: 'Materi Pokok Pembelajaran Semester Aktif',
          kegiatan: 'Pendekatan Saintifik (5M: Mengamati, Menanya, Mengumpulkan Informasi, Menalar, Mengomunikasikan)',
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const newK13KKM: K13KKM = {
      id: `k13-kkm-${newSettingId}`,
      academicSettingId: newSettingId,
      kkmMataPelajaran: 75,
      predikatA: 89,
      predikatB: 79,
      predikatC: 70,
      items: [
        {
          id: `kkm-item-${Date.now()}-1`,
          kd: '3.1 Memahami konsep dan prinsip dasar pembelajaran',
          indikator: 'Mengidentifikasi prinsip dan konsep dasar materi pokok',
          kompleksitas: 75,
          dayaDukung: 78,
          intake: 74,
          kkmIndikator: 76,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    state.k13Analyses = [...(state.k13Analyses || []), newK13Analysis];
    state.k13KKMs = [...(state.k13KKMs || []), newK13KKM];
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
  const derivedPhase = getPhaseFromGrade(sourceSetting.level, targetGrade);
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
    id: `ws-${Date.now()}`,
    profileId: sourceWs.profileId,
    schoolId: sourceWs.schoolId,
    academicSettingId: newSettingId,
    name: clonedName,
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
          items: (sourceTP.items || []).map((it, idx) => ({ ...it, id: `tp-${Date.now()}-${idx}` })),
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
          items: (sourceATP.items || []).map((it, idx) => ({ ...it, id: `atp-item-${Date.now()}-${idx}` })),
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
  } else {
    // Clone K13 data for K13 only
    const sourceAnalysis = (state.k13Analyses || []).find((k) => k.academicSettingId === sourceSetting.id);
    const clonedAnalysis: K13Analysis = sourceAnalysis
      ? {
          ...sourceAnalysis,
          id: `k13-ana-${newSettingId}`,
          academicSettingId: newSettingId,
          items: (sourceAnalysis.items || []).map((it, idx) => ({ ...it, id: `k13-item-${Date.now()}-${idx}` })),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `k13-ana-${newSettingId}`,
          academicSettingId: newSettingId,
          items: [],
          updatedAt: new Date().toISOString(),
        };

    const sourceKKM = (state.k13KKMs || []).find((k) => k.academicSettingId === sourceSetting.id);
    const clonedKKM: K13KKM = sourceKKM
      ? {
          ...sourceKKM,
          id: `k13-kkm-${newSettingId}`,
          academicSettingId: newSettingId,
          items: (sourceKKM.items || []).map((it, idx) => ({ ...it, id: `kkm-item-${Date.now()}-${idx}` })),
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `k13-kkm-${newSettingId}`,
          academicSettingId: newSettingId,
          kkmMataPelajaran: 75,
          predikatA: 89,
          predikatB: 79,
          predikatC: 70,
          items: [],
          updatedAt: new Date().toISOString(),
        };

    state.k13Analyses = [...(state.k13Analyses || []), clonedAnalysis];
    state.k13KKMs = [...(state.k13KKMs || []), clonedKKM];
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

  // Validate that profile.schoolId exists in master schools
  if (!profile.schoolId || !current.schools.some((s) => s.id === profile.schoolId)) {
    profile.schoolId = current.schools[0]?.id || INITIAL_SCHOOL.id;
  }

  const idx = current.profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    current.profiles[idx] = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
  } else {
    current.profiles.push({
      ...profile,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    current.activeProfileId = profile.id;
  }

  // 1 Profil Guru = 1 Sekolah Utama:
  // Explicit synchronization: Ensure all workspaces of this profile match profile.schoolId
  current.workspaces.forEach((w) => {
    if (w.profileId === profile.id) {
      w.schoolId = profile.schoolId!;
    }
  });

  // DO NOT create TeacherSchoolAssignment
  // DO NOT create SchoolData
  // DO NOT merge by NPSN

  saveAppStorage(current);
}

export function deleteProfile(profileId: string): void {
  const current = loadAppStorage();
  if (current.profiles.length <= 1) return;
  current.profiles = current.profiles.filter((p) => p.id !== profileId);
  current.workspaces = current.workspaces.filter((w) => w.profileId !== profileId);

  if (current.activeProfileId === profileId) {
    current.activeProfileId = current.profiles[0].id;
    const firstWs = current.workspaces.find((w) => w.profileId === current.activeProfileId);
    current.activeWorkspaceId = firstWs?.id;
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
  const updatedAnalysis = {
    ...analysis,
    updatedAt: new Date().toISOString(),
  };
  const list = current.cpAnalyses || [];
  const idx = list.findIndex((a) => a.academicSettingId === analysis.academicSettingId);
  if (idx >= 0) {
    list[idx] = updatedAnalysis;
  } else {
    list.push(updatedAnalysis);
  }
  current.cpAnalyses = list;

  // Invalidate TP if CP Analysis updated
  const tpIdx = (current.tps || []).findIndex((t) => t.academicSettingId === analysis.academicSettingId);
  if (tpIdx >= 0 && current.tps[tpIdx].items && current.tps[tpIdx].items.length > 0) {
    current.tps[tpIdx] = {
      ...current.tps[tpIdx],
      needsReview: true,
      reviewReason: 'Analisis CP rujukan telah diperbarui.',
      updatedAt: new Date().toISOString(),
    };
  }

  saveAppStorage(current);
}

export function saveAcademicSetting(setting: AcademicSetting, customWorkspaceName?: string): void {
  const current = loadAppStorage();
  const derived = getPhaseFromGrade(setting.level || 'SD', setting.grade || 'Kelas 1');
  const normalized = { ...setting, phase: derived, updatedAt: new Date().toISOString() };

  const idx = current.academicSettings.findIndex((a) => a.id === setting.id);
  if (idx >= 0) {
    current.academicSettings[idx] = normalized;
  } else {
    current.academicSettings.push(normalized);
  }

  // Sync workspace name
  const ws = current.workspaces.find((w) => w.academicSettingId === setting.id);
  if (ws) {
    ws.name = customWorkspaceName && customWorkspaceName.trim().length > 0
      ? customWorkspaceName.trim()
      : generateWorkspaceName(normalized);
    ws.updatedAt = new Date().toISOString();
  }

  saveAppStorage(current);
}

export function saveCP(cp: CPData): void {
  const current = loadAppStorage();
  const updatedCP = {
    ...cp,
    updatedAt: new Date().toISOString(),
  };
  const idx = current.cps.findIndex((c) => c.academicSettingId === cp.academicSettingId);
  if (idx >= 0) {
    current.cps[idx] = updatedCP;
  } else {
    current.cps.push(updatedCP);
  }

  // Invalidate TP if CP updated
  const tpIdx = (current.tps || []).findIndex((t) => t.academicSettingId === cp.academicSettingId);
  if (tpIdx >= 0 && current.tps[tpIdx].items && current.tps[tpIdx].items.length > 0) {
    current.tps[tpIdx] = {
      ...current.tps[tpIdx],
      needsReview: true,
      reviewReason: 'Capaian Pembelajaran (CP) rujukan telah diperbarui.',
      updatedAt: new Date().toISOString(),
    };
  }

  saveAppStorage(current);
}

export function saveTP(tp: TPData): void {
  const current = loadAppStorage();
  const updatedTP = {
    ...tp,
    updatedAt: new Date().toISOString(),
  };
  const idx = current.tps.findIndex((t) => t.academicSettingId === tp.academicSettingId);
  if (idx >= 0) {
    current.tps[idx] = updatedTP;
  } else {
    current.tps.push(updatedTP);
  }

  // Cascading invalidation: Check if ATP references to TP items are still valid
  const atpIdx = (current.atps || []).findIndex((a) => a.academicSettingId === tp.academicSettingId);
  if (atpIdx >= 0 && current.atps[atpIdx].items && current.atps[atpIdx].items.length > 0) {
    const atpObj = current.atps[atpIdx];
    const val = validateATPDataWorkflow(atpObj, updatedTP);
    current.atps[atpIdx] = {
      ...atpObj,
      workflowStatus: val.status,
      needsReview: true,
      reviewReason: 'Tujuan Pembelajaran (TP) acuan telah diperbarui, alur ATP perlu ditinjau ulang.',
      updatedAt: new Date().toISOString(),
    };
  }

  saveAppStorage(current);
}

export function saveATP(atp: ATPData): void {
  const current = loadAppStorage();
  const tp = current.tps.find((t) => t.academicSettingId === atp.academicSettingId);
  const normalizedATP = normalizeATPReferences(atp, tp);

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
    needsReview: val.issues.length > 0 ? true : false,
    reviewReason: val.issues.length > 0 ? val.issues.join('; ') : undefined,
    basedOnTpUpdatedAt: tp?.updatedAt || atp.basedOnTpUpdatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const idx = current.atps.findIndex((a) => a.academicSettingId === atp.academicSettingId);
  if (idx >= 0) {
    current.atps[idx] = updatedATP;
  } else {
    current.atps.push(updatedATP);
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
export function saveAssessmentCriteria(criteria: AssessmentCriterion[]): void {
  const current = loadAppStorage();
  const academicSettingId = criteria[0]?.academicSettingId;
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
  saveAppStorage(current);
}

export function saveAssessmentCriterion(criterion: AssessmentCriterion): void {
  const current = loadAppStorage();
  const idx = (current.assessmentCriteria || []).findIndex((c) => c.id === criterion.id);
  if (idx >= 0) {
    current.assessmentCriteria![idx] = criterion;
  } else {
    current.assessmentCriteria = [...(current.assessmentCriteria || []), criterion];
  }
  saveAppStorage(current);
}

export function deleteAssessmentCriterion(criterionId: string): void {
  const current = loadAppStorage();
  current.assessmentCriteria = (current.assessmentCriteria || []).filter((c) => c.id !== criterionId);
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
      schools: data.schools || [{ ...INITIAL_SCHOOL }],
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
    };
    saveAppStorage(state);
    return true;
  } catch (err) {
    console.error('Failed to parse import JSON:', err);
    return false;
  }
}

export function resetToDefaultData(): void {
  const initial = getInitialState();
  saveAppStorage(initial);
}
