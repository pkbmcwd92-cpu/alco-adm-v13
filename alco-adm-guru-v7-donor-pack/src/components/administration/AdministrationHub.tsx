import React, { useState } from 'react';
import {
  CalendarDays,
  Users,
  Award,
  FileSpreadsheet,
  LifeBuoy,
  FileText,
  Clock,
  School,
  User,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import {
  TeacherProfile,
  SchoolData,
  AdministrationWorkspace,
  AcademicSetting,
  CPData,
  TPData,
  ATPData,
  AppDocumentRecord,
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
} from '../../types';
import { TimePlanningManager } from './TimePlanningManager';
import { AttendanceManager } from './AttendanceManager';
import { KKTPManager } from './KKTPManager';
import { AssessmentGradeManager } from './AssessmentGradeManager';
import { FollowUpManager } from './FollowUpManager';
import { AdminDocsExport } from '../AdminDocsExport';
import { isK13 } from '../../services/curriculumRouter';

export type AdministrationTab =
  | 'time_planning'
  | 'kktp'
  | 'assessment_grades'
  | 'attendance'
  | 'follow_up'
  | 'export_docs';

interface AdministrationHubProps {
  profile: TeacherProfile;
  school: SchoolData;
  workspace?: AdministrationWorkspace;
  academicSetting: AcademicSetting;
  cp?: CPData;
  tp?: TPData;
  atp?: ATPData;
  documents: AppDocumentRecord[];
  students: Student[];
  calendar: AcademicCalendar;
  calendarDays: CalendarDay[];
  timeAllocations: TimeAllocation[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
  assessmentCriteria: AssessmentCriterion[];
  assessments: Assessment[];
  assessmentResults: AssessmentResult[];
  remedials: RemedialRecord[];
  enrichments: EnrichmentRecord[];
  k13Analysis?: K13Analysis;
  k13KKM?: K13KKM;
  initialTab?: AdministrationTab;
  onSaveCalendar: (calendar: AcademicCalendar, days: CalendarDay[]) => void;
  onSaveTimeAllocations: (allocations: TimeAllocation[]) => void;
  onSaveStudents: (students: Student[]) => void;
  onSaveAttendance: (session: AttendanceSession, records: AttendanceRecord[]) => void;
  onSaveCriteria: (criteria: AssessmentCriterion[]) => void;
  onSaveAssessment: (assessment: Assessment, results: AssessmentResult[]) => void;
  onDeleteAssessment: (assessmentId: string) => void;
  onSaveRemedials: (records: RemedialRecord[]) => void;
  onSaveEnrichments: (records: EnrichmentRecord[]) => void;
  onSaveK13Analysis: (analysis: K13Analysis) => void;
  onSaveK13KKM: (kkm: K13KKM) => void;
  onBackToStep: (stepId: any) => void;
  onUpdateDocuments?: (updatedDocs: AppDocumentRecord[]) => void;
}

export const AdministrationHub: React.FC<AdministrationHubProps> = ({
  school,
  profile,
  academicSetting,
  workspace,
  cp,
  tp,
  atp,
  documents = [],
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
  initialTab = 'time_planning',
  onSaveCalendar,
  onSaveTimeAllocations,
  onSaveStudents,
  onSaveAttendance,
  onSaveCriteria,
  onSaveAssessment,
  onDeleteAssessment,
  onSaveRemedials,
  onSaveEnrichments,
  onSaveK13Analysis,
  onSaveK13KKM,
  onBackToStep,
  onUpdateDocuments,
}) => {
  const isK13Active = isK13(academicSetting);
  const [activeTab, setActiveTab] = useState<AdministrationTab>(initialTab);

  const tabs = [
    {
      id: 'time_planning' as AdministrationTab,
      label: 'Perencanaan Waktu',
      sublabel: 'Kalender & Alokasi JP',
      icon: CalendarDays,
      badge: `${calendar?.effectiveWeeks || 18} Mg`,
    },
    {
      id: 'kktp' as AdministrationTab,
      label: isK13Active ? 'Kriteria Ketercapaian' : 'Kriteria Capaian (KKTP)',
      sublabel: isK13Active ? 'Kriteria KD / KKM' : 'Standar Tuntas TP',
      icon: Award,
      badge: isK13Active
        ? `${k13Analysis?.items?.length || 0} KD`
        : `${assessmentCriteria?.length || tp?.items?.length || 0} TP`,
    },
    {
      id: 'assessment_grades' as AdministrationTab,
      label: isK13Active ? 'Penilaian KD & Rapor' : 'Asesmen & Nilai',
      sublabel: isK13Active ? 'Daftar Nilai K13' : 'Formatif & Sumatif',
      icon: FileSpreadsheet,
      badge: `${assessments?.length || 0} Asm`,
    },
    {
      id: 'attendance' as AdministrationTab,
      label: 'Daftar Hadir',
      sublabel: 'Presensi Siswa',
      icon: Users,
      badge: `${students?.length || 0} Siswa`,
    },
    {
      id: 'follow_up' as AdministrationTab,
      label: 'Tindak Lanjut',
      sublabel: 'Remedial & Pengayaan',
      icon: LifeBuoy,
      badge: `${(remedials?.length || 0) + (enrichments?.length || 0)}`,
    },
    {
      id: 'export_docs' as AdministrationTab,
      label: 'Pusat Dokumen',
      sublabel: isK13Active ? 'Ekspor Dokumen K13' : 'Ekspor Seluruh File',
      icon: FileText,
      badge: isK13Active ? '10 Dokumen' : '13 Dokumen',
    },
  ];

  return (
    <div className="space-y-6" id="administration-hub">
      {/* Top Context Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                  {academicSetting.curriculum}
                </span>
                <span className="text-xs text-slate-400">
                  Tahun Ajaran {academicSetting.academicYear} • Semester {academicSetting.semester}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white mt-1">
                Administrasi Guru Terpadu — {academicSetting.subject} {academicSetting.grade}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-2">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile.name || 'Guru Pengampu'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-slate-400" />
                  <span>{school.name || 'Satuan Pendidikan'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {isK13Active
                      ? `${k13Analysis?.items?.length || 0} Butir KD`
                      : `${atp?.items?.reduce((a, b) => a + (Number(b.jp) || 0), 0) || 0} Total JP`}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={() => onBackToStep(isK13Active ? 'k13-tujuan' : 'atp')}
              className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              {isK13Active ? '← Kembali ke Tujuan & IPK (05)' : '← Kembali ke Alur ATP (06)'}
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`p-3 rounded-xl text-left transition-all relative cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </div>
                <div className="text-xs font-bold truncate">{tab.label}</div>
                <div className={`text-[10px] truncate ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {tab.sublabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area Based on Active Tab */}
      <div className="min-h-[500px]">
        {activeTab === 'time_planning' && (
          <TimePlanningManager
            school={school}
            profile={profile}
            academicSetting={academicSetting}
            atp={atp}
            k13Analysis={k13Analysis}
            calendar={calendar}
            calendarDays={calendarDays}
            timeAllocations={timeAllocations}
            onSaveCalendar={onSaveCalendar}
            onSaveTimeAllocations={onSaveTimeAllocations}
          />
        )}

        {activeTab === 'kktp' && (
          <KKTPManager
            school={school}
            profile={profile}
            academicSetting={academicSetting}
            tp={tp}
            k13Analysis={k13Analysis}
            k13KKM={k13KKM}
            assessmentCriteria={assessmentCriteria}
            onSaveCriteria={onSaveCriteria}
            onSaveK13KKM={onSaveK13KKM}
          />
        )}

        {activeTab === 'assessment_grades' && (
          <AssessmentGradeManager
            school={school}
            profile={profile}
            academicSetting={academicSetting}
            tp={tp}
            students={students}
            assessments={assessments}
            assessmentResults={assessmentResults}
            onSaveAssessment={onSaveAssessment}
            onDeleteAssessment={onDeleteAssessment}
            onQuickAddRemedial={(record) => {
              const updated = [...(remedials || []), record];
              onSaveRemedials(updated);
            }}
            onQuickAddEnrichment={(record) => {
              const updated = [...(enrichments || []), record];
              onSaveEnrichments(updated);
            }}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceManager
            school={school}
            profile={profile}
            academicSetting={academicSetting}
            tp={tp}
            students={students}
            attendanceSessions={attendanceSessions}
            attendanceRecords={attendanceRecords}
            onSaveStudents={onSaveStudents}
            onSaveSessions={onSaveAttendance}
          />
        )}

        {activeTab === 'follow_up' && (
          <FollowUpManager
            school={school}
            profile={profile}
            academicSetting={academicSetting}
            tp={tp}
            students={students}
            remedials={remedials}
            enrichments={enrichments}
            onSaveRemedials={onSaveRemedials}
            onSaveEnrichments={onSaveEnrichments}
          />
        )}

        {activeTab === 'export_docs' && (
          <AdminDocsExport
            profile={profile}
            school={school}
            workspace={workspace}
            academicSetting={academicSetting}
            cp={cp}
            tp={tp}
            atp={atp}
            documents={documents}
            students={students}
            calendar={calendar}
            calendarDays={calendarDays}
            timeAllocations={timeAllocations}
            attendanceSessions={attendanceSessions}
            attendanceRecords={attendanceRecords}
            assessmentCriteria={assessmentCriteria}
            assessments={assessments}
            assessmentResults={assessmentResults}
            remedials={remedials}
            enrichments={enrichments}
            k13Analysis={k13Analysis}
            k13KKM={k13KKM}
            onBackToStep={onBackToStep}
            onUpdateDocuments={onUpdateDocuments}
          />
        )}
      </div>
    </div>
  );
};
