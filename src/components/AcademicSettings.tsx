import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Check,
  ArrowRight,
  BookOpen,
  Calendar,
  Layers,
  GraduationCap,
  Clock,
  Info,
  AlertCircle,
  FolderTree,
  Edit3,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  FileCheck2,
} from 'lucide-react';
import { AcademicSetting, TeacherProfile, AdministrationWorkspace } from '../types';
import {
  CURRICULA,
  ACADEMIC_YEARS,
  SEMESTERS,
  EDUCATION_LEVELS,
  GRADE_PHASE_MAP,
  SUBJECT_OPTIONS,
  getPhaseFromGrade,
} from '../data/curriculumDefaults';
import { getSubjectJP } from '../services/jpEngine';
import { lookupOfficialWeeklyJP } from '../services/curriculumRules';
import {
  isK13,
  isMerdeka,
  getCurriculumTypeFromSetting,
} from '../services/curriculumRouter';
import { validateAcademicSettingReadiness } from '../services/academicSettingReadiness';
import { isValidDocumentDate } from '../services/documentDateService';
import { TeacherTeachingLoadModal } from './TeacherTeachingLoadModal';

interface AcademicSettingsProps {
  setting?: AcademicSetting | null;
  profile?: TeacherProfile | null;
  workspace?: AdministrationWorkspace | null;
  onSaveSetting: (setting: AcademicSetting, customWorkspaceName?: string, documentDate?: string) => boolean;
  onNextStep: (savedSetting?: AcademicSetting) => void;
}

interface AcademicSettingsFormProps {
  setting: AcademicSetting;
  profile?: TeacherProfile | null;
  workspace?: AdministrationWorkspace | null;
  onSaveSetting: (setting: AcademicSetting, customWorkspaceName?: string, documentDate?: string) => boolean;
  onNextStep: (savedSetting?: AcademicSetting) => void;
}

/**
 * Pure Form Component - Hooks execute unconditionally here
 */
const AcademicSettingsForm: React.FC<AcademicSettingsFormProps> = ({
  setting,
  profile,
  workspace,
  onSaveSetting,
  onNextStep,
}) => {
  const initialPhase = getPhaseFromGrade(setting.level, setting.grade);
  const [formData, setFormData] = useState<AcademicSetting>({
    ...setting,
    phase: initialPhase,
    totalHoursPerWeek: setting.totalHoursPerWeek ?? null,
  });
  const [workspaceName, setWorkspaceName] = useState<string>(workspace?.name || '');
  const [documentDate, setDocumentDate] = useState<string>(workspace?.documentDate || '');
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [showTeachingLoadModal, setShowTeachingLoadModal] = useState(false);

  // Derive official JP lookup using centralized JP Engine
  const officialJpInfo = useMemo(() => {
    return getSubjectJP({
      curriculum: formData.curriculum,
      level: formData.level,
      grade: formData.grade,
      subject: formData.subject,
    });
  }, [formData.curriculum, formData.level, formData.grade, formData.subject]);

  // Sync state if prop changes (e.g. on workspace or profile switch)
  useEffect(() => {
    const derivedPhase = getPhaseFromGrade(setting.level, setting.grade);
    setFormData({
      ...setting,
      phase: derivedPhase,
      totalHoursPerWeek: setting.totalHoursPerWeek ?? null,
    });
    setWorkspaceName(workspace?.name || '');
    setDocumentDate(workspace?.documentDate || '');
    const currentSubjectList = SUBJECT_OPTIONS[setting.level] || [];
    if (setting.subject && !currentSubjectList.includes(setting.subject)) {
      setIsCustomSubject(true);
    } else {
      setIsCustomSubject(false);
    }
  }, [setting, workspace]);

  // Dirty State Calculation: Check if form data or workspace name or documentDate differs from saved setting
  const isDirty = useMemo(() => {
    const derivedPhase = getPhaseFromGrade(formData.level, formData.grade);
    const isSettingChanged =
      (formData.curriculum || '') !== (setting.curriculum || '') ||
      (formData.academicYear || '') !== (setting.academicYear || '') ||
      (formData.semester || '') !== (setting.semester || '') ||
      (formData.level || '') !== (setting.level || '') ||
      (formData.grade || '') !== (setting.grade || '') ||
      (formData.subject || '') !== (setting.subject || '') ||
      formData.totalHoursPerWeek !== (setting.totalHoursPerWeek ?? null) ||
      (formData.phase || '') !== (derivedPhase || '');

    const isNameChanged = workspace ? workspaceName.trim() !== (workspace.name || '').trim() : false;
    const isDateChanged = workspace ? (documentDate || '') !== (workspace.documentDate || '') : false;

    return isSettingChanged || isNameChanged || isDateChanged;
  }, [formData, setting, workspace, workspaceName, documentDate]);

  // Handle Level Change (clean reset without fabricated guessing)
  const handleLevelChange = (level: string) => {
    const availableGrades = GRADE_PHASE_MAP[level] || [];
    const validGrade = availableGrades.some((g) => g.grade === formData.grade) ? formData.grade : '';
    const derivedPhase = getPhaseFromGrade(level, validGrade);

    const currentSubjectList = SUBJECT_OPTIONS[level] || [];
    const validSubject = isCustomSubject
      ? formData.subject
      : (currentSubjectList.includes(formData.subject) ? formData.subject : '');

    const jpLookup = lookupOfficialWeeklyJP(formData.curriculum, level, validGrade, validSubject);

    setFormData((prev) => ({
      ...prev,
      level: level as any,
      grade: validGrade,
      phase: derivedPhase,
      subject: validSubject,
      totalHoursPerWeek: prev.isHoursOverridden ? prev.totalHoursPerWeek : jpLookup.weeklyJP,
      regulationReference: jpLookup.regulationReference,
      isHoursOverridden: !jpLookup.isOfficial && prev.totalHoursPerWeek !== null,
    }));
  };

  // Handle Grade Change (strictly auto-derives Phase & official JP)
  const handleGradeChange = (grade: string) => {
    const derivedPhase = getPhaseFromGrade(formData.level, grade);
    const jpLookup = lookupOfficialWeeklyJP(formData.curriculum, formData.level, grade, formData.subject);
    setFormData((prev) => ({
      ...prev,
      grade,
      phase: derivedPhase,
      totalHoursPerWeek: prev.isHoursOverridden ? prev.totalHoursPerWeek : jpLookup.weeklyJP,
      regulationReference: jpLookup.regulationReference,
    }));
  };

  // Handle Subject Change
  const handleSubjectChange = (subject: string) => {
    const jpLookup = lookupOfficialWeeklyJP(formData.curriculum, formData.level, formData.grade, subject);
    setFormData((prev) => ({
      ...prev,
      subject,
      totalHoursPerWeek: prev.isHoursOverridden ? prev.totalHoursPerWeek : jpLookup.weeklyJP,
      regulationReference: jpLookup.regulationReference,
    }));
  };

  const handleApplyOfficialJP = () => {
    setFormData((prev) => ({
      ...prev,
      totalHoursPerWeek: officialJpInfo.weeklyJP,
      isHoursOverridden: false,
      regulationReference: officialJpInfo.regulation,
    }));
  };

  const handleResetChanges = () => {
    const derivedPhase = getPhaseFromGrade(setting.level, setting.grade);
    setFormData({
      ...setting,
      phase: derivedPhase,
      totalHoursPerWeek: setting.totalHoursPerWeek ?? null,
    });
    setWorkspaceName(workspace?.name || '');
    setDocumentDate(workspace?.documentDate || '');
    setErrorMessage(null);
  };

  const handleSave = (e?: React.FormEvent): AcademicSetting | null => {
    if (e) e.preventDefault();

    if (documentDate && documentDate.trim() !== '' && !isValidDocumentDate(documentDate)) {
      setErrorMessage('Format Tanggal Dokumen tidak valid (YYYY-MM-DD).');
      return null;
    }

    const readiness = validateAcademicSettingReadiness(formData);
    if (!readiness.valid) {
      setErrorMessage(readiness.errors.join('. ') || 'Lengkapi semua field wajib sebelum menyimpan.');
      return null;
    }

    const derivedPhase = getPhaseFromGrade(formData.level, formData.grade);
    const resolvedCurriculumType = readiness.curriculumType || getCurriculumTypeFromSetting({
      curriculum: formData.curriculum,
      curriculumType: formData.curriculumType,
    });

    const updated: AcademicSetting = {
      ...formData,
      phase: derivedPhase,
      curriculumType: resolvedCurriculumType,
      updatedAt: new Date().toISOString(),
    };

    const saved = onSaveSetting(updated, workspaceName.trim() || undefined, documentDate);
    if (!saved) {
      setErrorMessage('Gagal menyimpan pengaturan: Workspace tidak valid atau terjadi kesalahan.');
      return null;
    }

    setErrorMessage(null);
    setSaveSuccessNotice(true);
    setShowUnsavedPrompt(false);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
    return updated;
  };

  const handleSaveAndContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const savedSetting = handleSave();
    if (savedSetting) {
      onNextStep(savedSetting);
    }
  };

  const handleNextClick = () => {
    if (isDirty) {
      setShowUnsavedPrompt(true);
    } else {
      const readiness = validateAcademicSettingReadiness(formData);
      if (!readiness.valid) {
        setErrorMessage(readiness.errors.join('. ') || 'Lengkapi dan simpan Data Pembelajaran sebelum melanjutkan.');
        return;
      }
      onNextStep(formData);
    }
  };

  const availableGrades = GRADE_PHASE_MAP[formData.level] || [];
  const standardSubjects = SUBJECT_OPTIONS[formData.level] || [];

  return (
    <div className="space-y-6">
      {/* Header Info & Save State Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
              02
            </span>
            <h3 className="text-lg font-bold text-slate-900">Pengaturan Data Pembelajaran</h3>
          </div>

          {/* Persistent Save State Indicator */}
          <div className="flex items-center gap-2">
            {isDirty ? (
              <div
                id="indicator-dirty-state"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-xs animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Perubahan belum disimpan</span>
              </div>
            ) : validateAcademicSettingReadiness(setting).valid ? (
              <div
                id="indicator-clean-ready-state"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pengaturan tersimpan & lengkap</span>
              </div>
            ) : (
              <div
                id="indicator-clean-incomplete-state"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50/80 text-amber-800 border border-amber-200"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Tersimpan, belum lengkap</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Tentukan parameter kurikulum, tahun ajaran, kelas, dan mata pelajaran untuk administrasi ini.
          Fase capaian dan alokasi JP per minggu disinkronkan secara otomatis sesuai standar struktur kurikulum nasional.
        </p>

        {/* Workspace info badge */}
        {workspace && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Workspace Administrasi:</span>
              <strong className="text-slate-900">{workspace.name}</strong>
            </div>
            <span className="text-[11px] text-slate-400">ID: {workspace.id}</span>
          </div>
        )}
      </div>

      {/* Error Message Notice */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-600 hover:text-rose-900 font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveAndContinue} className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          {/* Row 0: Workspace Name & Tanggal Dokumen */}
          {workspace && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nama Administrasi / Workspace</span>
                </label>
                <input
                  id="input-workspace-name"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Contoh: PJOK — Kelas 1 — Sem 1 — 2026/2027"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama ini memudahkan Anda membedakan antar administrasi (misal jika Anda mengajar banyak kelas atau mapel).
                </p>
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tanggal Dokumen Resmi</span>
                </label>
                <input
                  id="input-workspace-document-date"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white cursor-pointer"
                />
                {!documentDate || !isValidDocumentDate(documentDate) ? (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span><strong>Tanggal Resmi Dokumen Belum Diset</strong>. Pilih tanggal untuk membuka akses ekspor resmi.</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Tanggal resmi dokumen: <strong>{workspace?.documentDate ? documentDate : 'Akan disimpan saat tombol Simpan diklik'}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Row 1: Kurikulum & Tahun Ajaran */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Kurikulum</span>
              </label>
              <select
                id="select-curriculum"
                value={formData.curriculum || ''}
                onChange={(e) => {
                  const newCur = e.target.value;
                  const jp = lookupOfficialWeeklyJP(newCur, formData.level, formData.grade, formData.subject);
                  setFormData({
                    ...formData,
                    curriculum: newCur,
                    curriculumType: getCurriculumTypeFromSetting({ curriculum: newCur }),
                    totalHoursPerWeek: formData.isHoursOverridden ? formData.totalHoursPerWeek : jp.weeklyJP,
                    regulationReference: jp.regulationReference,
                  });
                }}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white cursor-pointer"
              >
                <option value="">— Pilih Kurikulum —</option>
                {CURRICULA.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Tahun Ajaran</span>
              </label>
              <select
                id="select-academic-year"
                value={formData.academicYear || ''}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white cursor-pointer"
              >
                <option value="">— Pilih Tahun Ajaran —</option>
                {ACADEMIC_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Semester</span>
              </label>
              <select
                id="select-semester"
                value={formData.semester || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    semester: (e.target.value || undefined) as any,
                  })
                }
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white cursor-pointer"
              >
                <option value="">— Pilih Semester —</option>
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Jenjang, Kelas & Derived Phase */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>Jenjang Pendidikan</span>
              </label>
              <select
                id="select-academic-level"
                value={formData.level || ''}
                onChange={(e) => handleLevelChange(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white cursor-pointer"
              >
                <option value="">— Pilih Jenjang —</option>
                {EDUCATION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Tingkat / Kelas</span>
              </label>
              <select
                id="select-grade"
                value={formData.grade || ''}
                onChange={(e) => handleGradeChange(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white cursor-pointer"
              >
                <option value="">— Pilih Tingkat / Kelas —</option>
                {availableGrades.map((g) => (
                  <option key={g.grade} value={g.grade}>
                    {g.grade}
                  </option>
                ))}
              </select>
            </div>

            {/* Read-Only Derived Phase (Merdeka) vs Struktur K13 */}
            {isK13(formData) ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Struktur Kurikulum 2013</span>
                </label>
                <div
                  id="display-k13-structure"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 font-medium text-sm flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    Struktur KD & Standar Isi
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md">
                    K13 (Tanpa Fase)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>K13 menggunakan tingkatan Kelas ({formData.grade || '—'}) tanpa sistem Fase.</span>
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Fase Capaian (Otomatis)</span>
                </label>
                <div
                  id="display-derived-phase"
                  className={`w-full px-3.5 py-2.5 rounded-xl border font-bold text-sm flex items-center justify-between ${
                    formData.phase
                      ? 'border-blue-200 bg-blue-50/70 text-blue-950'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${formData.phase ? 'bg-blue-600' : 'bg-slate-300'}`}></span>
                    {formData.phase || '— (Belum Ditentukan)'}
                  </span>
                  {formData.phase && (
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                      Derived
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>
                    {formData.level && formData.grade
                      ? `${formData.level} ${formData.grade} → ${formData.phase || '—'}`
                      : 'Pilih Jenjang dan Kelas untuk menentukan Fase'}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Row 3: Mata Pelajaran & Alokasi JP */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-4 border-t border-slate-100">
            <div className="sm:col-span-7">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mata Pelajaran <span className="text-rose-500">*</span></span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomSubject(!isCustomSubject)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  {isCustomSubject ? 'Pilih dari daftar standar' : '+ Tulis mapel lainnya'}
                </button>
              </div>

              {isCustomSubject ? (
                <input
                  id="input-custom-subject"
                  type="text"
                  required
                  placeholder="Ketik nama mata pelajaran kustom / muatan lokal..."
                  value={formData.subject || ''}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
                />
              ) : (
                <select
                  id="select-subject"
                  value={formData.subject || ''}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white cursor-pointer"
                >
                  <option value="">— Pilih Mata Pelajaran —</option>
                  {standardSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>JP Mapel / Pekan</span>
                </label>
                <div className="flex items-center gap-2">
                  {officialJpInfo.isOfficial &&
                    officialJpInfo.weeklyJP !== null &&
                    formData.totalHoursPerWeek !== officialJpInfo.weeklyJP && (
                      <button
                        type="button"
                        onClick={handleApplyOfficialJP}
                        className="text-[11px] text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        Gunakan JP Resmi ({officialJpInfo.weeklyJP} JP)
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setShowTeachingLoadModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <UserCheck className="w-3 h-3 text-purple-600" />
                    <span>Validasi 24 JP Guru</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="input-hours-per-week"
                  type="number"
                  min="1"
                  max="40"
                  placeholder="—"
                  value={
                    formData.totalHoursPerWeek !== null && formData.totalHoursPerWeek !== undefined
                      ? formData.totalHoursPerWeek
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    const validVal = val === null || isNaN(val) ? null : val;
                    setFormData({
                      ...formData,
                      totalHoursPerWeek: validVal,
                      isHoursOverridden: validVal !== officialJpInfo.weeklyJP,
                    });
                  }}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-xs font-semibold text-slate-500 shrink-0">JP / Pekan</span>
              </div>

              {/* Official Status vs Override Note */}
              <div className="text-[11px] flex flex-col gap-1 pt-0.5">
                {officialJpInfo.isOfficial && formData.totalHoursPerWeek === officialJpInfo.weeklyJP ? (
                  <div className="text-emerald-700 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {officialJpInfo.statusLabel} ({officialJpInfo.regulation}) &bull;{' '}
                      {officialJpInfo.annualJP ? `${officialJpInfo.annualJP} JP/tahun` : ''}
                    </span>
                  </div>
                ) : officialJpInfo.isOfficial && officialJpInfo.weeklyJP !== null ? (
                  <div className="text-amber-700 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      Penyesuaian Manual (Standar Resmi: {officialJpInfo.weeklyJP} JP/minggu &bull;{' '}
                      {officialJpInfo.regulation})
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-500 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {formData.subject
                        ? 'Status: Belum diverifikasi dalam regulasi nasional'
                        : 'Pilih mapel untuk melihat alokasi JP resmi'}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-slate-400">
                  * Catatan: JP Mapel berasal dari struktur kurikulum. Beban tatap muka guru dihitung terpisah (min. 24 JP/minggu).
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={handleResetChanges}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Batal Perubahan</span>
              </button>
            )}
            {saveSuccessNotice && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Perubahan berhasil disimpan!</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-save-academic-setting"
              type="button"
              onClick={() => handleSave()}
              disabled={!isDirty}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                isDirty
                  ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-md'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              Simpan Pengaturan
            </button>

            <button
              id="btn-continue-to-cp"
              type="button"
              onClick={handleNextClick}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer"
            >
              <span>
                {isK13(formData)
                  ? 'Lanjut ke SKL / KI / KD (K13)'
                  : isMerdeka(formData)
                  ? 'Lanjut ke Capaian Pembelajaran (CP)'
                  : 'Lanjut ke Kurikulum'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      {/* MODAL: Unsaved Changes Prompt before navigating away */}
      {showUnsavedPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">Simpan Perubahan Pengaturan?</h4>
                <p className="text-xs text-slate-600">
                  Anda telah mengubah pengaturan pembelajaran tetapi belum menyimpannya. Apakah Anda ingin menyimpan perubahan sebelum melanjutkan ke langkah berikutnya?
                </p>
              </div>
            </div>

            {(() => {
              const storedReadiness = validateAcademicSettingReadiness(setting);
              return (
                <>
                  {!storedReadiness.valid && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                      <p className="font-semibold">Pengaturan tersimpan belum lengkap:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-700">
                        {storedReadiness.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-amber-900 font-medium pt-1">
                        Lengkapi dan simpan Data Pembelajaran sebelum melanjutkan.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {storedReadiness.valid ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUnsavedPrompt(false);
                          onNextStep(setting);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                      >
                        Abaikan & Lanjut
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Lengkapi dan simpan Data Pembelajaran sebelum melanjutkan."
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-slate-100 cursor-not-allowed opacity-60"
                      >
                        Abaikan & Lanjut
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const savedSetting = handleSave();
                        if (savedSetting) {
                          setShowUnsavedPrompt(false);
                          onNextStep(savedSetting);
                        }
                      }}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 shadow-sm transition cursor-pointer"
                    >
                      Simpan & Lanjut
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* TEACHER TEACHING LOAD & JP VALIDATION MODAL */}
      <TeacherTeachingLoadModal
        isOpen={showTeachingLoadModal}
        onClose={() => setShowTeachingLoadModal(false)}
        currentSetting={formData}
        teacherProfile={profile}
      />
    </div>
  );
};

/**
 * AcademicSettings Container Component:
 * Guarantees Rules of Hooks integrity by rendering AcademicSettingsForm
 * ONLY when setting is defined and valid.
 */
export const AcademicSettings: React.FC<AcademicSettingsProps> = ({
  setting,
  profile,
  workspace,
  onSaveSetting,
  onNextStep,
}) => {
  if (!setting) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              Administrasi pembelajaran belum dibuat.
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Buat atau pilih Workspace Administrasi terlebih dahulu sebelum mengisi Data Pembelajaran.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AcademicSettingsForm
      setting={setting}
      profile={profile}
      workspace={workspace}
      onSaveSetting={onSaveSetting}
      onNextStep={onNextStep}
    />
  );
};
