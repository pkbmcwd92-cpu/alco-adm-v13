import React, { useState, useCallback, useMemo } from 'react';
import {
  WorkflowStepId,
  TeacherProfile,
  SchoolData,
  PrincipalHistory,
  AcademicSetting,
  ActiveContext,
  CPData,
  CPAnalysisData,
  TPData,
  ATPData,
  AdministrationWorkspace,
  AppDocumentRecord,
  LearningPlan,
  AssessmentPlan,
  AssessmentPackage,
  Student,
  RemedialRecord,
  EnrichmentRecord,
  YearPlan,
  SemesterPlan,
} from './types';
import {
  AppStorageStateV5,
  AdministrationWorkspaceV5,
} from './types/storageV5';
import {
  loadStorageV5,
  createProfileV5,
  updateProfileV5,
  deleteProfileV5,
  setActiveProfileV5,
  createSchoolV5,
  updateSchoolV5,
  savePrincipalHistoryV5,
  setActivePrincipalV5,
  createYearHierarchyV5,
  setActiveYearPlanV5,
  setActiveSemesterPlanV5,
  deleteWorkspaceV5,
  renameWorkspaceV5,
  saveCPV5,
  saveCPAnalysisV5,
  saveTPV5,
  saveATPV5,
} from './services/storageV5';
import { getRuntimeContextV5 } from './services/runtimeV5';
import {
  getLocalTodayDocumentDate,
  isValidDocumentDate,
} from './services/documentDateService';
import { Header } from './components/Header';
import { WorkflowStepper } from './components/WorkflowStepper';
import { ProfileManager } from './components/ProfileManager';
import { AcademicSettings } from './components/AcademicSettings';
import { CPManager } from './components/CPManager';
import { CPAnalysisManager } from './components/CPAnalysisManager';
import { TPManager } from './components/TPManager';
import { ATPManager } from './components/ATPManager';
import { SemesterSelector } from './components/SemesterSelector';
import { K13Manager } from './components/administration/K13Manager';
import { AdministrationHub } from './components/administration/AdministrationHub';
import { BackupModal } from './components/BackupModal';
import { isK13, getCurriculumTypeFromSetting } from './services/curriculumRouter';
import { validateAcademicSettingReadiness } from './services/academicSettingReadiness';
import { Plus, Copy, Trash2, X, FolderPlus, AlertCircle } from 'lucide-react';
import { GRADE_PHASE_MAP, SUBJECT_OPTIONS } from './data/curriculumDefaults';
import { APP_BUILD_ID } from './config/buildInfo';

const EMPTY_SCHOOL_VIEW: SchoolData = {
  id: '',
  name: '',
  npsn: '',
  address: '',
  village: '',
  district: '',
  regency: '',
  province: '',
  principalName: '',
  principalNip: '',
  createdAt: '',
  updatedAt: '',
};

export function App() {
  const [v5State, setV5State] = useState<AppStorageStateV5>(() => loadStorageV5());
  const [currentStep, setCurrentStep] = useState<WorkflowStepId>('profile');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [appNotice, setAppNotice] = useState<{ type: 'error' | 'warning' | 'info'; message: string } | null>(null);

  // New Workspace form state (Canonical Merdeka Annual Hierarchy - No Semester)
  const [newWsGrade, setNewWsGrade] = useState('');
  const [newWsClassSection, setNewWsClassSection] = useState('');
  const [newWsSubject, setNewWsSubject] = useState('');
  const [newWsYear, setNewWsYear] = useState('');
  const [newWsDocumentDate, setNewWsDocumentDate] = useState<string>('');

  // Reload data from V5 storage authority
  const refreshV5 = useCallback(() => {
    setV5State(loadStorageV5());
  }, []);

  // Compute canonical V5 runtime context
  const runtimeContext = useMemo(() => {
    return getRuntimeContextV5();
  }, [v5State]);

  const {
    activeProfile,
    activeSchool,
    activeYearPlan,
    activeWorkspace,
    yearPlansForActiveProfile,
    workspacesForActiveProfile,
    semesterPlansForActiveYear,
    activeSemesterPlan,
  } = runtimeContext;

  const activeSchoolForView = activeSchool || EMPTY_SCHOOL_VIEW;
  const newWorkspaceLevel = activeProfile?.defaultLevel || '';
  const availableGrades = newWorkspaceLevel && GRADE_PHASE_MAP[newWorkspaceLevel]
    ? GRADE_PHASE_MAP[newWorkspaceLevel]
    : [];
  const availableSubjects = newWorkspaceLevel && SUBJECT_OPTIONS[newWorkspaceLevel]
    ? SUBJECT_OPTIONS[newWorkspaceLevel]
    : [];

  const openNewWorkspaceModal = () => {
    if (!activeProfile) {
      setAppNotice({
        type: 'warning',
        message: 'Buat atau pilih profil guru terlebih dahulu sebelum membuat Administrasi.',
      });
      return;
    }
    if (!activeProfile.schoolId) {
      setAppNotice({
        type: 'warning',
        message: 'Pilih atau daftarkan Sekolah Utama terlebih dahulu sebelum membuat Administrasi.',
      });
      return;
    }
    setNewWsSubject(activeProfile?.defaultSubject || '');
    setNewWsGrade('');
    setNewWsClassSection('');
    setNewWsYear(activeYearPlan?.academicYear || '2026/2027');
    setNewWsDocumentDate(getLocalTodayDocumentDate());
    setIsNewWorkspaceModalOpen(true);
  };

  // Handlers for Profile (Canonical Storage V5 Authority)
  const handleSelectProfile = (id: string) => {
    try {
      setActiveProfileV5(id);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal memilih profil guru.',
      });
    }
  };

  const handleSaveProfile = (profile: TeacherProfile, isCreate?: boolean): boolean => {
    try {
      const isExisting = v5State.profiles.some((p) => p.id === profile.id);
      if (!isExisting || isCreate) {
        createProfileV5({
          name: profile.name.trim(),
          nip: profile.nip?.trim() || '',
          nuptk: profile.nuptk?.trim() || undefined,
          status: profile.status,
          defaultSubject: profile.defaultSubject?.trim() || '',
          defaultLevel: profile.defaultLevel,
          schoolId: profile.schoolId?.trim() || undefined,
        });
      } else {
        updateProfileV5(profile.id, {
          name: profile.name.trim(),
          nip: profile.nip?.trim() || '',
          nuptk: profile.nuptk?.trim() || undefined,
          status: profile.status,
          defaultSubject: profile.defaultSubject?.trim() || '',
          defaultLevel: profile.defaultLevel,
          schoolId: profile.schoolId?.trim() || undefined,
        });
      }
      refreshV5();
      return true;
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal menyimpan profil guru.',
      });
      return false;
    }
  };

  const handleDeleteProfile = (id: string) => {
    try {
      deleteProfileV5(id);
      refreshV5();
      setAppNotice({
        type: 'info',
        message: 'Profil guru berhasil dihapus.',
      });
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal menghapus profil guru.',
      });
    }
  };

  // Handlers for School (Canonical Storage V5 Authority)
  const handleCreateSchool = (school: Omit<SchoolData, 'id' | 'createdAt' | 'updatedAt'> | SchoolData) => {
    try {
      createSchoolV5({
        name: school.name.trim(),
        npsn: (school.npsn || '').trim(),
        address: school.address || '',
        village: school.village || '',
        district: school.district || '',
        regency: school.regency || '',
        province: school.province || '',
        principalName: school.principalName || '',
        principalNip: school.principalNip || '',
        verificationStatus: school.verificationStatus,
        principalSource: school.principalSource,
        principalSourceUrl: school.principalSourceUrl,
      });
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal menambahkan sekolah baru.',
      });
    }
  };

  const handleUpdateSchool = (schoolId: string, updates: Partial<SchoolData>) => {
    try {
      updateSchoolV5(schoolId, updates);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal memperbarui sekolah.',
      });
    }
  };

  const handleSavePrincipalHistory = (history: PrincipalHistory) => {
    try {
      savePrincipalHistoryV5(history);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal menyimpan riwayat kepala sekolah.',
      });
    }
  };

  const handleSetActivePrincipal = (schoolId: string, historyId: string) => {
    try {
      setActivePrincipalV5(schoolId, historyId);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal mengaktifkan kepala sekolah.',
      });
    }
  };

  // Handlers for Workspaces / Annual Hierarchy (Canonical Storage V5 Authority)
  const handleSelectWorkspace = (wsId: string) => {
    const ws = v5State.workspaces.find((w) => w.id === wsId);
    if (ws) {
      setActiveYearPlanV5(ws.yearPlanId);
      refreshV5();
    }
  };

  const handleDeleteWorkspace = (wsId: string) => {
    try {
      deleteWorkspaceV5(wsId);
      refreshV5();
      setAppNotice({
        type: 'info',
        message: 'Administrasi tahunan berhasil dihapus.',
      });
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal menghapus administrasi tahunan.',
      });
    }
  };

  const handleCreateNewWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) {
      setAppNotice({
        type: 'error',
        message: 'Profil guru tidak ditemukan. Buat profil terlebih dahulu.',
      });
      return;
    }
    const targetSchoolId = activeProfile.schoolId;
    if (!targetSchoolId) {
      setAppNotice({
        type: 'error',
        message: 'Sekolah utama belum ditentukan untuk profil guru ini. Tentukan sekolah utama pada Profil terlebih dahulu.',
      });
      return;
    }
    if (!newWsSubject.trim()) {
      setAppNotice({
        type: 'warning',
        message: 'Mata pelajaran tidak boleh kosong.',
      });
      return;
    }
    if (!newWsGrade.trim()) {
      setAppNotice({
        type: 'warning',
        message: 'Pilih Kelas / Tingkat terlebih dahulu.',
      });
      return;
    }
    if (newWsYear.trim() && !/^\d{4}\/\d{4}$/.test(newWsYear.trim())) {
      setAppNotice({
        type: 'warning',
        message: 'Tahun ajaran gunakan format 2026/2027.',
      });
      return;
    }
    if (!isValidDocumentDate(newWsDocumentDate)) {
      setAppNotice({
        type: 'warning',
        message: 'Tanggal Dokumen wajib ditentukan untuk Administrasi baru.',
      });
      return;
    }

    try {
      const level = (activeProfile.defaultLevel || 'SD') as 'SD' | 'SMP' | 'SMA' | 'SMK';
      const academicYear = newWsYear.trim() || '2026/2027';
      const grade = newWsGrade.trim();
      const subject = newWsSubject.trim();
      const classSection = newWsClassSection.trim() || undefined;

      const matchedGrade = availableGrades.find((g) => g.grade === grade);
      const phase = matchedGrade?.phase;

      // Canonical annual workspace name without any semester
      const workspaceName = `${subject} — ${grade}${classSection ? ` (${classSection})` : ''} — ${academicYear}`;

      createYearHierarchyV5({
        profileId: activeProfile.id,
        schoolId: targetSchoolId,
        academicYear,
        curriculumType: 'KURIKULUM_MERDEKA',
        level,
        grade,
        classSection,
        subject,
        phase,
        workspaceName,
        documentDate: newWsDocumentDate.trim(),
      });

      setIsNewWorkspaceModalOpen(false);
      refreshV5();
      setCurrentStep('academic');
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err.message || 'Gagal membuat administrasi tahunan baru.',
      });
    }
  };

  // ==========================================================================
  // TRANSITIONAL READ-ONLY DOWNSTREAM COMPATIBILITY (PART 7)
  // Derived strictly from YearPlan + WorkspaceV5 + Profile + School.
  // Never written to V3; does not invent a semester for annual workflow.
  // ==========================================================================
  const transitionalWorkspace = useMemo<AdministrationWorkspace | undefined>(() => {
    if (!activeWorkspace) return undefined;
    return {
      id: activeWorkspace.id,
      profileId: activeWorkspace.profileId,
      schoolId: activeWorkspace.schoolId,
      academicSettingId: activeYearPlan?.id || '',
      name: activeWorkspace.name,
      documentDate: activeWorkspace.documentDate,
      createdAt: activeWorkspace.createdAt,
      updatedAt: activeWorkspace.updatedAt,
    };
  }, [activeWorkspace, activeYearPlan]);

  const transitionalAcademicSetting = useMemo<AcademicSetting>(() => {
    if (!activeYearPlan) {
      return {
        id: '',
        profileId: activeProfile?.id || '',
        curriculum: 'Kurikulum Merdeka',
        curriculumType: 'KURIKULUM_MERDEKA',
        academicYear: '',
        semester: '', // Strictly empty for annual workflow
        level: activeProfile?.defaultLevel || 'SD',
        grade: '',
        phase: '',
        subject: activeProfile?.defaultSubject || '',
        updatedAt: '',
      };
    }
    return {
      id: activeYearPlan.id,
      profileId: activeYearPlan.profileId,
      curriculum: 'Kurikulum Merdeka',
      curriculumType: activeYearPlan.curriculumType || 'KURIKULUM_MERDEKA',
      academicYear: activeYearPlan.academicYear,
      semester: '', // Strictly empty for annual workflow; NEVER default to Semester 1
      level: activeYearPlan.level,
      grade: activeYearPlan.grade,
      classSection: activeYearPlan.classSection,
      phase: activeYearPlan.phase || '',
      subject: activeYearPlan.subject,
      updatedAt: activeYearPlan.updatedAt,
    };
  }, [activeYearPlan, activeProfile]);

  const isActiveSemesterValid =
    !!activeSemesterPlan &&
    semesterPlansForActiveYear.some(
      (sp) => sp.id === activeSemesterPlan.id
    );

  const semesterAcademicSetting = useMemo<AcademicSetting | undefined>(() => {
    if (!activeYearPlan || !activeSemesterPlan || !isActiveSemesterValid) {
      return undefined;
    }
    return {
      id: activeSemesterPlan.id,
      profileId: activeYearPlan.profileId,
      curriculum: 'Kurikulum Merdeka',
      curriculumType: activeYearPlan.curriculumType || 'KURIKULUM_MERDEKA',
      academicYear: activeYearPlan.academicYear,
      semester:
        activeSemesterPlan.semester === 1
          ? '1 (Ganjil)'
          : '2 (Genap)',
      level: activeYearPlan.level,
      grade: activeYearPlan.grade,
      phase: activeYearPlan.phase || '',
      subject: activeYearPlan.subject,
      updatedAt: activeSemesterPlan.updatedAt,
    };
  }, [activeYearPlan, activeSemesterPlan, isActiveSemesterValid]);

  const effectiveAdminAcademicSetting = isK13(transitionalAcademicSetting)
    ? transitionalAcademicSetting
    : semesterAcademicSetting;

  const handleSelectStep = (step: WorkflowStepId) => {
    const isMerdeka = !isK13(transitionalAcademicSetting);
    if (isMerdeka && step === 'admin' && !isActiveSemesterValid) {
      setCurrentStep('semester');
      setAppNotice({
        type: 'warning',
        message: 'Pilih Semester 1 atau Semester 2 terlebih dahulu sebelum membuka Administrasi.',
      });
      return;
    }
    setCurrentStep(step);
  };

  const transitionalActiveContext = useMemo<ActiveContext>(() => {
    return {
      profileId: activeProfile?.id || activeYearPlan?.profileId || '',
      schoolId: activeSchool?.id || activeYearPlan?.schoolId || '',
      curriculum: 'Kurikulum Merdeka',
      curriculumType: activeYearPlan?.curriculumType || 'KURIKULUM_MERDEKA',
      academicYear: activeYearPlan?.academicYear || '',
      semester: '', // Strictly empty for annual workflow
      level: activeYearPlan?.level || activeProfile?.defaultLevel || '',
      grade: activeYearPlan?.grade || '',
      phase: activeYearPlan?.phase || '',
      subject: activeYearPlan?.subject || activeProfile?.defaultSubject || '',
    };
  }, [activeYearPlan, activeProfile, activeSchool]);

  // Downstream domain models (transitional read fallbacks)
  const activeCP: CPData = runtimeContext.annualData?.cp || {
    id: '',
    academicSettingId: activeYearPlan?.id || '',
    subject: activeYearPlan?.subject || '',
    elements: [],
    updatedAt: '',
  };
  const activeCPAnalysis: CPAnalysisData = runtimeContext.annualData?.cpAnalysis || {
    id: '',
    academicSettingId: activeYearPlan?.id || '',
    elements: [],
    updatedAt: '',
  };
  const activeTP: TPData = runtimeContext.annualData?.tp || {
    id: '',
    academicSettingId: activeYearPlan?.id || '',
    items: [],
    updatedAt: '',
  };
  const activeATP: ATPData = runtimeContext.annualData?.atp || {
    id: '',
    academicSettingId: activeYearPlan?.id || '',
    items: [],
    updatedAt: '',
  };

  // Handlers for Academic Setting & Documents (Transitional compatibility)
  const handleSaveAcademicSetting = (
    setting: AcademicSetting,
    customWorkspaceName?: string,
    documentDate?: string
  ): boolean => {
    if (activeWorkspace) {
      if (customWorkspaceName?.trim()) {
        try {
          renameWorkspaceV5(activeWorkspace.id, customWorkspaceName.trim());
        } catch {
          // ignore error
        }
      }
      refreshV5();
    }
    return true;
  };

  const handleSaveCP = (cp: CPData) => {
    if (!activeYearPlan) {
      setAppNotice({
        type: 'error',
        message: 'Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan Capaian Pembelajaran (CP).',
      });
      return;
    }

    try {
      const canonicalCP: CPData = {
        ...cp,
        id: cp.id && cp.id.trim() ? cp.id : `cp-${activeYearPlan.id}`,
        academicSettingId: activeYearPlan.id,
      };

      saveCPV5(activeYearPlan.id, canonicalCP);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan CP ke penyimpanan tahunan.',
      });
    }
  };

  const handleSaveCPAnalysis = (analysis: CPAnalysisData) => {
    const persistedCP = runtimeContext.annualData?.cp;
    if (!activeYearPlan || !persistedCP) {
      setAppNotice({
        type: 'error',
        message: !activeYearPlan
          ? 'Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan Analisis CP.'
          : 'Capaian Pembelajaran (CP) harus disimpan terlebih dahulu sebelum menyimpan Analisis CP.',
      });
      return;
    }

    try {
      const canonicalAnalysis: CPAnalysisData = {
        ...analysis,
        id: analysis.id && analysis.id.trim() ? analysis.id : `cpanalysis-${activeYearPlan.id}`,
        academicSettingId: activeYearPlan.id,
        cpId: persistedCP.id,
        basedOnCpUpdatedAt: persistedCP.updatedAt,
      };

      saveCPAnalysisV5(activeYearPlan.id, canonicalAnalysis);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan Analisis CP ke penyimpanan tahunan.',
      });
    }
  };

  const handleSaveTP = (tp: TPData) => {
    const persistedCP = runtimeContext.annualData?.cp;
    const persistedAnalysis = runtimeContext.annualData?.cpAnalysis;

    if (!activeYearPlan || !persistedCP || !persistedAnalysis) {
      const missingReason = !activeYearPlan
        ? 'Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan TP.'
        : !persistedCP
        ? 'Capaian Pembelajaran (CP) harus disimpan terlebih dahulu sebelum menyimpan TP.'
        : 'Analisis CP harus disimpan terlebih dahulu sebelum menyimpan TP.';
      setAppNotice({
        type: 'error',
        message: missingReason,
      });
      return;
    }

    try {
      const canonicalTP: TPData = {
        ...tp,
        id: tp.id && tp.id.trim() ? tp.id : `tp-${activeYearPlan.id}`,
        academicSettingId: activeYearPlan.id,
        cpId: persistedCP.id,
        cpAnalysisId: persistedAnalysis.id,
        academicYear: activeYearPlan.academicYear,
        subjectCode: activeYearPlan.subjectCode || activeYearPlan.subject,
        phase: activeYearPlan.phase || tp.phase,
        basedOnCpUpdatedAt: tp.basedOnCpUpdatedAt || persistedCP.updatedAt,
        basedOnAnalysisUpdatedAt: tp.basedOnAnalysisUpdatedAt || persistedAnalysis.updatedAt,
      };

      saveTPV5(activeYearPlan.id, canonicalTP);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan Tujuan Pembelajaran (TP) ke penyimpanan tahunan.',
      });
    }
  };

  const handleSaveATP = (atp: ATPData) => {
    const persistedTP = runtimeContext.annualData?.tp;

    if (!activeYearPlan || !persistedTP) {
      const missingReason = !activeYearPlan
        ? 'Tidak ada Tahun Ajaran (YearPlan) aktif untuk menyimpan ATP.'
        : 'Tujuan Pembelajaran (TP) harus disimpan terlebih dahulu sebelum menyimpan ATP.';
      setAppNotice({
        type: 'error',
        message: missingReason,
      });
      return;
    }

    try {
      const canonicalItems = (atp.items || []).map((item) => {
        const { semester: _legacySemester, ...annualItem } = item;
        return annualItem;
      });

      const canonicalATP: ATPData = {
        ...atp,
        id: atp.id && atp.id.trim() ? atp.id : `atp-${activeYearPlan.id}`,
        academicSettingId: activeYearPlan.id,
        tpId: persistedTP.id,
        tpDataId: persistedTP.id,
        academicYear: activeYearPlan.academicYear,
        subjectCode: activeYearPlan.subjectCode || activeYearPlan.subject,
        phase: activeYearPlan.phase || atp.phase,
        basedOnTpUpdatedAt: atp.basedOnTpUpdatedAt || persistedTP.updatedAt,
        items: canonicalItems,
      };

      saveATPV5(activeYearPlan.id, canonicalATP);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan Alur Tujuan Pembelajaran (ATP) ke penyimpanan tahunan.',
      });
    }
  };

  const handleSelectSemester = (semesterPlanId: string) => {
    try {
      setActiveSemesterPlanV5(semesterPlanId);
      refreshV5();
    } catch (err: any) {
      setAppNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal memilih semester aktif.',
      });
    }
  };

  // Handlers for Interconnected Administration Modules (Transitional)
  const handleSaveCalendar = (cal: any, days: any[]) => {};
  const handleSaveTimeAllocations = (allocs: any[]) => {};
  const handleSaveStudents = (stdList: any[]) => {};
  const handleSaveAttendance = (session: any, records: any[]) => {};
  const handleSaveCriteria = (criteria: any[]) => {};
  const handleSaveAssessment = (assessment: any, results: any[]) => {};
  const handleDeleteAssessment = (assessmentId: string) => {};
  const handleSaveRemedials = (records: any[]) => {};
  const handleSaveEnrichments = (records: any[]) => {};
  const handleSaveK13Analysis = (analysis: any) => {};
  const handleSaveK13KKM = (kkm: any) => {};
  const handleSaveLearningPlan = (plan: LearningPlan) => {};
  const handleDeleteLearningPlan = (planId: string) => {};
  const handleSaveAssessmentPlan = (plan: any) => {};
  const handleDeleteAssessmentPlan = (planId: string) => {};
  const handleSaveAssessmentPackage = (pkg: any) => {};
  const handleDeleteAssessmentPackage = (pkgId: string) => {};

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Application Header */}
      <Header
        activeProfile={activeProfile}
        school={activeSchoolForView}
        profiles={v5State.profiles || []}
        workspaces={workspacesForActiveProfile || []}
        activeWorkspaceId={activeWorkspace?.id || ''}
        onSelectProfile={handleSelectProfile}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspaceClick={openNewWorkspaceModal}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
      />

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* App Notification Banner */}
        {appNotice && (
          <div
            id="app-notification-banner"
            className={`p-4 rounded-xl border flex items-center justify-between shadow-xs animate-fade-in ${
              appNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : appNotice.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{appNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setAppNotice(null)}
              className="text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-black/5 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Workflow Stepper & Context Banner */}
        <WorkflowStepper
          currentStep={currentStep}
          onSelectStep={handleSelectStep}
          profile={activeProfile}
          school={activeSchool}
          workspace={transitionalWorkspace}
          academicSetting={transitionalAcademicSetting}
          cp={activeCP}
          cpAnalysis={activeCPAnalysis}
          tp={activeTP}
          atp={activeATP}
          activeSemesterPlan={activeSemesterPlan}
          k13Analysis={undefined}
          k13KKM={undefined}
        />

        {/* Step Views */}
        <section className="transition-all duration-150">
          {currentStep === 'profile' && (
            <ProfileManager
              profiles={v5State.profiles}
              activeProfileId={activeProfile?.id || ''}
              activeSchool={activeSchool}
              schools={v5State.schools}
              principalHistories={v5State.principalHistories || []}
              activeWorkspace={activeWorkspace}
              workspaces={workspacesForActiveProfile || []}
              yearPlans={yearPlansForActiveProfile || []}
              onCreateWorkspaceClick={openNewWorkspaceModal}
              onSelectProfile={handleSelectProfile}
              onSaveProfile={handleSaveProfile}
              onDeleteProfile={handleDeleteProfile}
              onCreateSchool={handleCreateSchool}
              onUpdateSchool={handleUpdateSchool}
              onSavePrincipalHistory={handleSavePrincipalHistory}
              onSetActivePrincipal={handleSetActivePrincipal}
              onSelectWorkspace={handleSelectWorkspace}
              onDeleteWorkspace={handleDeleteWorkspace}
              onNextStep={() => setCurrentStep('academic')}
            />
          )}

          {currentStep === 'academic' && (
            <AcademicSettings
              setting={transitionalAcademicSetting}
              profile={activeProfile}
              workspace={transitionalWorkspace}
              onSaveSetting={handleSaveAcademicSetting}
              onNextStep={(savedSetting?: AcademicSetting) => {
                const effectiveSetting = savedSetting || transitionalAcademicSetting;
                const readiness = validateAcademicSettingReadiness(effectiveSetting);
                if (!readiness.valid || !readiness.curriculumType) {
                  setAppNotice({
                    type: 'warning',
                    message: readiness.errors[0] || 'Pilih dan simpan Kurikulum yang valid (Kurikulum Merdeka atau Kurikulum 2013) sebelum melanjutkan.',
                  });
                  return;
                }
                if (readiness.curriculumType === 'K13') {
                  setCurrentStep('k13-kd');
                } else if (readiness.curriculumType === 'KURIKULUM_MERDEKA') {
                  setCurrentStep('cp');
                }
              }}
            />
          )}

          {/* KURIKULUM MERDEKA STEPS */}
          {currentStep === 'cp' && (
            <CPManager
              cp={activeCP}
              context={transitionalActiveContext}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              onSaveCP={handleSaveCP}
              onNextStep={() => setCurrentStep('cp-analysis')}
            />
          )}

          {currentStep === 'cp-analysis' && (
            <CPAnalysisManager
              cpAnalysis={activeCPAnalysis}
              cp={activeCP}
              context={transitionalActiveContext}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              onSaveCPAnalysis={handleSaveCPAnalysis}
              onNextStep={() => setCurrentStep('tp')}
              onBackToCP={() => setCurrentStep('cp')}
            />
          )}

          {currentStep === 'tp' && (
            <TPManager
              tp={activeTP}
              cp={activeCP}
              cpAnalysis={activeCPAnalysis}
              context={transitionalActiveContext}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              onSaveTP={handleSaveTP}
              onNextStep={() => setCurrentStep('atp')}
              onBackToCP={() => setCurrentStep('cp-analysis')}
            />
          )}

          {currentStep === 'atp' && (
            <ATPManager
              atp={activeATP}
              tp={activeTP}
              cp={activeCP}
              context={transitionalActiveContext}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              onSaveATP={handleSaveATP}
              onNextStep={() => setCurrentStep('semester')}
              onBackToTP={() => setCurrentStep('tp')}
            />
          )}

          {currentStep === 'semester' && (
            <SemesterSelector
              semesterPlans={semesterPlansForActiveYear}
              activeSemesterPlan={activeSemesterPlan}
              onSelectSemester={handleSelectSemester}
              onNextStep={() => setCurrentStep('admin')}
              onBackToATP={() => setCurrentStep('atp')}
            />
          )}

          {/* KURIKULUM 2013 STEPS */}
          {currentStep === 'k13-kd' && (
            <K13Manager
              mode="kd"
              k13Analysis={undefined}
              k13KKM={undefined}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              school={activeSchoolForView}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('k13-indikator')}
              onBackToStep={() => setCurrentStep('academic')}
            />
          )}

          {currentStep === 'k13-indikator' && (
            <K13Manager
              mode="indikator"
              k13Analysis={undefined}
              k13KKM={undefined}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              school={activeSchoolForView}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('k13-tujuan')}
              onBackToStep={() => setCurrentStep('k13-kd')}
            />
          )}

          {currentStep === 'k13-tujuan' && (
            <K13Manager
              mode="tujuan"
              k13Analysis={undefined}
              k13KKM={undefined}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              school={activeSchoolForView}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('admin')}
              onBackToStep={() => setCurrentStep('k13-indikator')}
            />
          )}

          {currentStep === 'k13-kkm' && (
            <K13Manager
              mode="kkm"
              k13Analysis={undefined}
              k13KKM={undefined}
              academicSetting={transitionalAcademicSetting}
              profile={activeProfile}
              school={activeSchoolForView}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('admin')}
              onBackToStep={() => setCurrentStep('k13-tujuan')}
            />
          )}

          {/* SHARED ADMINISTRATION & DOCS EXPORT */}
          {currentStep === 'admin' && effectiveAdminAcademicSetting && (
            <AdministrationHub
              profile={activeProfile}
              school={activeSchoolForView}
              workspace={transitionalWorkspace}
              academicSetting={effectiveAdminAcademicSetting}
              cp={activeCP}
              tp={activeTP}
              atp={activeATP}
              documents={v5State.documents || []}
              students={[]}
              calendar={undefined}
              calendarDays={[]}
              timeAllocations={[]}
              attendanceSessions={[]}
              attendanceRecords={[]}
              assessmentCriteria={[]}
              assessments={[]}
              assessmentResults={[]}
              remedials={[]}
              enrichments={[]}
              learningPlans={[]}
              assessmentPlans={[]}
              assessmentPackages={[]}
              onSaveCalendar={handleSaveCalendar}
              onSaveTimeAllocations={handleSaveTimeAllocations}
              onSaveStudents={handleSaveStudents}
              onSaveAttendance={handleSaveAttendance}
              onSaveCriteria={handleSaveCriteria}
              onSaveAssessment={handleSaveAssessment}
              onDeleteAssessment={handleDeleteAssessment}
              onSaveAssessmentPlan={handleSaveAssessmentPlan}
              onDeleteAssessmentPlan={handleDeleteAssessmentPlan}
              onSaveAssessmentPackage={handleSaveAssessmentPackage}
              onDeleteAssessmentPackage={handleDeleteAssessmentPackage}
              onSaveRemedials={handleSaveRemedials}
              onSaveEnrichments={handleSaveEnrichments}
              onSaveK13Analysis={handleSaveK13Analysis}
              onSaveK13KKM={handleSaveK13KKM}
              onSaveLearningPlan={handleSaveLearningPlan}
              onDeleteLearningPlan={handleDeleteLearningPlan}
              onBackToStep={(step) => setCurrentStep(step)}
              onUpdateDocuments={(updatedDocs) => {}}
            />
          )}
        </section>
      </main>

      {/* Footer info */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Administrasi Guru AI</strong> — Kurikulum Merdeka & Administrasi Pembelajaran
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Perencanaan Tahunan (YearPlan) • Hierarki V5 • Ekspor Word Resmi (.docx)</span>
            <span id="app-build-badge" className="font-mono text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-semibold">
              Build: {APP_BUILD_ID}
            </span>
          </div>
        </div>
      </footer>

      {/* Modal: Create New Annual Administration (Canonical Merdeka) */}
      {isNewWorkspaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buat Administrasi Tahunan Baru</h3>
                  <p className="text-xs text-slate-500">
                    Guru: <strong>{activeProfile?.name || 'Belum dipilih'}</strong> • Sekolah: <strong>{activeSchool?.name || 'Belum dipilih'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewWorkspaceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PJOK / Bahasa Indonesia"
                  value={newWsSubject}
                  onChange={(e) => setNewWsSubject(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  list="suggested-subjects"
                />
                <datalist id="suggested-subjects">
                  {availableSubjects.map((sub) => (
                    <option key={sub} value={sub} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kurikulum
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Kurikulum Merdeka"
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kelas / Tingkat <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newWsGrade}
                    onChange={(e) => setNewWsGrade(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
                  >
                    <option value="">Pilih Kelas</option>
                    {availableGrades.map((g) => (
                      <option key={g.grade} value={g.grade}>
                        {g.grade} ({g.phase})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Rombel / Paralel (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: A / 1A"
                    value={newWsClassSection}
                    onChange={(e) => setNewWsClassSection(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tahun Ajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4}/\d{4}"
                    placeholder="Contoh: 2026/2027"
                    value={newWsYear}
                    onChange={(e) => setNewWsYear(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tanggal Dokumen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={newWsDocumentDate}
                  onChange={(e) => setNewWsDocumentDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Tanggal ini akan digunakan sebagai tanggal resmi seluruh dokumen dalam Administrasi ini dan dapat diubah kembali pada Pengaturan Administrasi.
                </p>
              </div>

              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200/60 text-xs text-blue-900 space-y-1">
                <div className="font-semibold">Nama Administrasi Tahunan yang Dibuat:</div>
                <div className="font-bold text-blue-950">
                  {newWsSubject || 'Mapel'} — {newWsGrade || 'Kelas -'}{newWsClassSection ? ` (${newWsClassSection})` : ''} — {newWsYear || 'Tahun Ajaran -'}
                </div>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Administrasi tahunan mencakup seluruh perencanaan kurikulum (CP, TP, ATP) serta memuat Semester 1 dan Semester 2 secara otomatis.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewWorkspaceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 shadow-sm transition cursor-pointer"
                >
                  Buat Administrasi Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backup / Restore JSON Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataRestored={refreshV5}
      />
    </div>
  );
}

export default App;
