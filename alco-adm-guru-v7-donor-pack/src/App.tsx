import React, { useState, useCallback, useMemo } from 'react';
import {
  WorkflowStepId,
  AppDataStore,
  TeacherProfile,
  SchoolData,
  AcademicSetting,
  CPData,
  CPAnalysisData,
  TPData,
  ATPData,
  AdministrationWorkspace,
  AppDocumentRecord,
} from './types';
import {
  getAppData,
  getProfileWorkspace,
  saveProfile,
  deleteProfile,
  createSchool,
  updateSchool,
  savePrincipalHistory,
  setActivePrincipal,
  saveAcademicSetting,
  saveCP,
  saveCPAnalysis,
  saveTP,
  saveATP,
  saveDocuments,
  saveStudents,
  saveAcademicCalendar,
  saveTimeAllocations,
  saveAttendanceSession,
  saveAssessmentCriteria,
  saveAssessment,
  deleteAssessment,
  saveRemedialRecords,
  saveEnrichmentRecords,
  saveK13Analysis,
  saveK13KKM,
  setActiveProfileId,
  setActiveWorkspaceId,
  createWorkspace,
  duplicateWorkspace,
  deleteWorkspace,
} from './services/storage';
import { Header } from './components/Header';
import { WorkflowStepper } from './components/WorkflowStepper';
import { ProfileManager } from './components/ProfileManager';
import { AcademicSettings } from './components/AcademicSettings';
import { CPManager } from './components/CPManager';
import { CPAnalysisManager } from './components/CPAnalysisManager';
import { TPManager } from './components/TPManager';
import { ATPManager } from './components/ATPManager';
import { K13Manager } from './components/administration/K13Manager';
import { AdministrationHub } from './components/administration/AdministrationHub';
import { BackupModal } from './components/BackupModal';
import { isK13 } from './services/curriculumRouter';
import { Plus, Copy, Trash2, X, FolderPlus } from 'lucide-react';
import { GRADE_PHASE_MAP, SUBJECT_OPTIONS } from './data/curriculumDefaults';

export function App() {
  const [dataStore, setDataStore] = useState<AppDataStore>(getAppData());
  const [currentStep, setCurrentStep] = useState<WorkflowStepId>('profile');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);

  // New Workspace form state
  const [newWsGrade, setNewWsGrade] = useState('Kelas 1');
  const [newWsSubject, setNewWsSubject] = useState('Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)');
  const [newWsSemester, setNewWsSemester] = useState<'1 (Ganjil)' | '2 (Genap)'>('1 (Ganjil)');
  const [newWsYear, setNewWsYear] = useState('2026/2027');

  // Reload data from storage
  const refreshData = useCallback(() => {
    setDataStore(getAppData());
  }, []);

  // Compute the full workspace and active context using getProfileWorkspace
  const currentWorkspaceData = useMemo(() => {
    return getProfileWorkspace(dataStore.activeProfileId, dataStore.activeWorkspaceId);
  }, [dataStore]);

  const {
    workspace: activeWorkspace,
    profile: activeProfile,
    school: activeSchool,
    academicSetting: activeAcademicSetting,
    cp: activeCP,
    cpAnalysis: activeCPAnalysis,
    tp: activeTP,
    atp: activeATP,
    context: activeContext,
    students = [],
    calendar,
    calendarDays = [],
    timeAllocations = [],
    attendanceSessions = [],
    attendanceRecords = [],
    assessmentCriteria = [],
    assessments = [],
    assessmentResults = [],
    remedials = [],
    enrichments = [],
    k13Analysis,
    k13KKM,
    allWorkspaces = [],
    allWorkspacesForProfile = [],
  } = currentWorkspaceData;

  const currentWorkspacesList = allWorkspacesForProfile && allWorkspacesForProfile.length > 0
    ? allWorkspacesForProfile
    : allWorkspaces;

  // Handlers for Profile
  const handleSelectProfile = (id: string) => {
    setActiveProfileId(id);
    refreshData();
  };

  const handleSaveProfile = (profile: TeacherProfile) => {
    saveProfile(profile);
    refreshData();
  };

  const handleDeleteProfile = (id: string) => {
    deleteProfile(id);
    refreshData();
  };

  // Handlers for School (Explicit CRUD)
  const handleCreateSchool = (school: Omit<SchoolData, 'id' | 'createdAt' | 'updatedAt'> | SchoolData) => {
    createSchool(school);
    refreshData();
  };

  const handleUpdateSchool = (schoolId: string, updates: Partial<SchoolData>) => {
    updateSchool(schoolId, updates);
    refreshData();
  };

  const handleSavePrincipalHistory = (history: any) => {
    savePrincipalHistory(history);
    refreshData();
  };

  const handleSetActivePrincipal = (schoolId: string, historyId: string) => {
    setActivePrincipal(schoolId, historyId);
    refreshData();
  };

  // Handlers for Workspaces
  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    refreshData();
  };

  const handleCreateNewWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsSubject.trim()) {
      alert('Mata pelajaran tidak boleh kosong.');
      return;
    }

    createWorkspace({
      profileId: activeProfile.id,
      schoolId: activeSchool.id,
      setting: {
        level: activeProfile.defaultLevel || 'SD',
        grade: newWsGrade,
        subject: newWsSubject.trim(),
        semester: newWsSemester,
        academicYear: newWsYear,
      },
    });

    setIsNewWorkspaceModalOpen(false);
    refreshData();
    setCurrentStep('academic');
  };

  // Handlers for Academic Setting & Documents
  const handleSaveAcademicSetting = (setting: AcademicSetting, customWorkspaceName?: string) => {
    saveAcademicSetting(setting, customWorkspaceName);
    refreshData();
  };

  const handleSaveCP = (cp: CPData) => {
    saveCP(cp);
    refreshData();
  };

  const handleSaveCPAnalysis = (analysis: CPAnalysisData) => {
    saveCPAnalysis(analysis);
    refreshData();
  };

  const handleSaveTP = (tp: TPData) => {
    saveTP(tp);
    refreshData();
  };

  const handleSaveATP = (atp: ATPData) => {
    saveATP(atp);
    refreshData();
  };

  // Handlers for Interconnected Administration Modules
  const handleSaveCalendar = (cal: any, days: any[]) => {
    saveAcademicCalendar(cal, days);
    refreshData();
  };

  const handleSaveTimeAllocations = (allocs: any[]) => {
    saveTimeAllocations(activeAcademicSetting.id, allocs);
    refreshData();
  };

  const handleSaveStudents = (stdList: any[]) => {
    saveStudents(activeAcademicSetting.id, stdList);
    refreshData();
  };

  const handleSaveAttendance = (session: any, records: any[]) => {
    saveAttendanceSession(session, records);
    refreshData();
  };

  const handleSaveCriteria = (criteria: any[]) => {
    saveAssessmentCriteria(criteria);
    refreshData();
  };

  const handleSaveAssessment = (assessment: any, results: any[]) => {
    saveAssessment(assessment, results);
    refreshData();
  };

  const handleDeleteAssessment = (assessmentId: string) => {
    deleteAssessment(assessmentId);
    refreshData();
  };

  const handleSaveRemedials = (records: any[]) => {
    saveRemedialRecords(records);
    refreshData();
  };

  const handleSaveEnrichments = (records: any[]) => {
    saveEnrichmentRecords(records);
    refreshData();
  };

  const handleSaveK13Analysis = (analysis: any) => {
    saveK13Analysis(analysis);
    refreshData();
  };

  const handleSaveK13KKM = (kkm: any) => {
    saveK13KKM(kkm);
    refreshData();
  };

  const availableGrades = GRADE_PHASE_MAP[activeProfile.defaultLevel || 'SD'] || [];
  const availableSubjects = SUBJECT_OPTIONS[activeProfile.defaultLevel || 'SD'] || [];

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Application Header */}
      <Header
        activeProfile={activeProfile}
        school={activeSchool}
        profiles={dataStore.profiles || []}
        workspaces={currentWorkspacesList || []}
        activeWorkspaceId={activeWorkspace?.id || dataStore.activeWorkspaceId || ''}
        onSelectProfile={handleSelectProfile}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspaceClick={() => setIsNewWorkspaceModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
      />

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Workflow Stepper & Context Banner */}
        <WorkflowStepper
          currentStep={currentStep}
          onSelectStep={(step) => setCurrentStep(step)}
          profile={activeProfile}
          school={activeSchool}
          workspace={activeWorkspace}
          academicSetting={activeAcademicSetting}
          cp={activeCP}
          cpAnalysis={activeCPAnalysis}
          tp={activeTP}
          atp={activeATP}
          k13Analysis={k13Analysis}
          k13KKM={k13KKM}
        />

        {/* Step Views */}
        <section className="transition-all duration-150">
          {currentStep === 'profile' && (
            <ProfileManager
              profiles={dataStore.profiles}
              activeProfileId={activeProfile.id}
              activeSchool={activeSchool}
              schools={dataStore.schools}
              principalHistories={dataStore.principalHistories || []}
              onSelectProfile={handleSelectProfile}
              onSaveProfile={handleSaveProfile}
              onDeleteProfile={handleDeleteProfile}
              onCreateSchool={handleCreateSchool}
              onUpdateSchool={handleUpdateSchool}
              onSavePrincipalHistory={handleSavePrincipalHistory}
              onSetActivePrincipal={handleSetActivePrincipal}
              onNextStep={() => setCurrentStep('academic')}
            />
          )}

          {currentStep === 'academic' && (
            <AcademicSettings
              setting={activeAcademicSetting}
              profile={activeProfile}
              workspace={activeWorkspace}
              onSaveSetting={handleSaveAcademicSetting}
              onNextStep={() => setCurrentStep(isK13(activeAcademicSetting) ? 'k13-kd' : 'cp')}
            />
          )}

          {/* KURIKULUM MERDEKA STEPS */}
          {currentStep === 'cp' && (
            <CPManager
              cp={activeCP}
              context={activeContext}
              academicSetting={activeAcademicSetting}
              profile={activeProfile}
              onSaveCP={handleSaveCP}
              onNextStep={() => setCurrentStep('cp-analysis')}
            />
          )}

          {currentStep === 'cp-analysis' && (
            <CPAnalysisManager
              cpAnalysis={activeCPAnalysis}
              cp={activeCP}
              context={activeContext}
              academicSetting={activeAcademicSetting}
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
              context={activeContext}
              academicSetting={activeAcademicSetting}
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
              context={activeContext}
              academicSetting={activeAcademicSetting}
              profile={activeProfile}
              onSaveATP={handleSaveATP}
              onNextStep={() => setCurrentStep('admin')}
              onBackToTP={() => setCurrentStep('tp')}
            />
          )}

          {/* KURIKULUM 2013 STEPS */}
          {currentStep === 'k13-kd' && (
            <K13Manager
              mode="kd"
              k13Analysis={k13Analysis}
              k13KKM={k13KKM}
              academicSetting={activeAcademicSetting}
              profile={activeProfile}
              school={activeSchool}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('k13-indikator')}
              onBackToStep={() => setCurrentStep('academic')}
            />
          )}

          {currentStep === 'k13-indikator' && (
            <K13Manager
              mode="indikator"
              k13Analysis={k13Analysis}
              k13KKM={k13KKM}
              academicSetting={activeAcademicSetting}
              profile={activeProfile}
              school={activeSchool}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('k13-tujuan')}
              onBackToStep={() => setCurrentStep('k13-kd')}
            />
          )}

          {currentStep === 'k13-tujuan' && (
            <K13Manager
              mode="tujuan"
              k13Analysis={k13Analysis}
              k13KKM={k13KKM}
              academicSetting={activeAcademicSetting}
              profile={activeProfile}
              school={activeSchool}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('admin')}
              onBackToStep={() => setCurrentStep('k13-indikator')}
            />
          )}

          {currentStep === 'k13-kkm' && (
            <K13Manager
              mode="kkm"
              k13Analysis={k13Analysis}
              k13KKM={k13KKM}
              academicSetting={activeAcademicSetting}
              profile={activeProfile}
              school={activeSchool}
              onSaveAnalysis={handleSaveK13Analysis}
              onSaveKKM={handleSaveK13KKM}
              onNextStep={() => setCurrentStep('admin')}
              onBackToStep={() => setCurrentStep('k13-tujuan')}
            />
          )}

          {/* SHARED ADMINISTRATION & DOCS EXPORT */}
          {currentStep === 'admin' && (
            <AdministrationHub
              profile={activeProfile}
              school={activeSchool}
              workspace={activeWorkspace}
              academicSetting={activeAcademicSetting}
              cp={activeCP}
              tp={activeTP}
              atp={activeATP}
              documents={dataStore.documents || []}
              students={students || []}
              calendar={calendar}
              calendarDays={calendarDays || []}
              timeAllocations={timeAllocations || []}
              attendanceSessions={attendanceSessions || []}
              attendanceRecords={attendanceRecords || []}
              assessmentCriteria={assessmentCriteria || []}
              assessments={assessments || []}
              assessmentResults={assessmentResults || []}
              remedials={remedials || []}
              enrichments={enrichments || []}
              k13Analysis={k13Analysis}
              k13KKM={k13KKM}
              onSaveCalendar={handleSaveCalendar}
              onSaveTimeAllocations={handleSaveTimeAllocations}
              onSaveStudents={handleSaveStudents}
              onSaveAttendance={handleSaveAttendance}
              onSaveCriteria={handleSaveCriteria}
              onSaveAssessment={handleSaveAssessment}
              onDeleteAssessment={handleDeleteAssessment}
              onSaveRemedials={handleSaveRemedials}
              onSaveEnrichments={handleSaveEnrichments}
              onSaveK13Analysis={handleSaveK13Analysis}
              onSaveK13KKM={handleSaveK13KKM}
              onBackToStep={(step) => setCurrentStep(step)}
              onUpdateDocuments={(updatedDocs) => {
                saveDocuments(updatedDocs);
                refreshData();
              }}
            />
          )}
        </section>
      </main>

      {/* Footer info */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Administrasi Guru AI</strong> — MVP Fondasi Administrasi Berkesinambungan (Profil → CP → TP → ATP → Dokumen)
          </div>
          <div className="text-[11px] text-slate-400">
            Konteks Terpusat (ActiveContext) • Multi-Workspace Administrasi • Sumber CP Terverifikasi • Ekspor Word (.docx)
          </div>
        </div>
      </footer>

      {/* Modal: Create New Administration Workspace */}
      {isNewWorkspaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Buat Administrasi / Kelas Baru</h3>
                  <p className="text-xs text-slate-500">
                    Guru: <strong>{activeProfile.name}</strong> • Sekolah: <strong>{activeSchool.name}</strong>
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
                    Kelas / Tingkat
                  </label>
                  <select
                    value={newWsGrade}
                    onChange={(e) => setNewWsGrade(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
                  >
                    {availableGrades.map((g) => (
                      <option key={g.grade} value={g.grade}>
                        {g.grade} ({g.phase})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Semester
                  </label>
                  <select
                    value={newWsSemester}
                    onChange={(e) => setNewWsSemester(e.target.value as '1 (Ganjil)' | '2 (Genap)')}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
                  >
                    <option value="1 (Ganjil)">1 (Ganjil)</option>
                    <option value="2 (Genap)">2 (Genap)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tahun Ajaran
                </label>
                <select
                  value={newWsYear}
                  onChange={(e) => setNewWsYear(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
                >
                  <option value="2026/2027">2026/2027</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2024/2025">2024/2025</option>
                </select>
              </div>

              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200/60 text-xs text-blue-900 space-y-1">
                <div className="font-semibold">Nama Workspace yang Dibuat:</div>
                <div className="font-bold text-blue-950">
                  {newWsSubject || 'Mapel'} — {newWsGrade} — {newWsSemester.startsWith('1') ? 'Sem 1' : 'Sem 2'} — {newWsYear}
                </div>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Setiap workspace memiliki CP, TP, ATP, dan dokumen mandiri tanpa tercampur dengan administrasi lainnya.
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
        onDataRestored={refreshData}
      />
    </div>
  );
}

export default App;
