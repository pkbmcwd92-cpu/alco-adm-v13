import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  Save,
  Layers,
  CalendarCheck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  BookOpen,
  Info,
} from 'lucide-react';
import {
  AcademicCalendar,
  CalendarDay,
  TimeAllocation,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  ATPData,
  K13Analysis,
} from '../../types';
import { generateKalenderAkademik, generateAlokasiWaktu } from '../../services/documentEngine';
import {
  calculateAvailableJP,
  calculateEffectiveDays,
  calculateEffectiveWeeks,
  getSubjectJP,
  deriveEffectiveJP,
} from '../../services/jpEngine';

interface TimePlanningManagerProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  atp?: ATPData;
  k13Analysis?: K13Analysis;
  calendar?: AcademicCalendar;
  calendarDays: CalendarDay[];
  timeAllocations: TimeAllocation[];
  onSaveCalendar: (calendar: AcademicCalendar, days: CalendarDay[]) => void;
  onSaveTimeAllocations: (allocations: TimeAllocation[]) => void;
}

export const TimePlanningManager: React.FC<TimePlanningManagerProps> = ({
  school,
  profile,
  academicSetting,
  atp,
  k13Analysis,
  calendar,
  calendarDays = [],
  timeAllocations = [],
  onSaveCalendar,
  onSaveTimeAllocations,
}) => {
  const isK13Curriculum =
    academicSetting.curriculumType === 'K13' || academicSetting.curriculum?.includes('2013');

  // Official JP lookup based on verified curriculum database
  const officialRule = useMemo(() => {
    return getSubjectJP({
      curriculum: academicSetting.curriculum,
      level: academicSetting.level,
      grade: academicSetting.grade,
      subject: academicSetting.subject,
    });
  }, [academicSetting]);

  // Calendar form state
  const [academicYear, setAcademicYear] = useState(
    calendar?.academicYear || academicSetting.academicYear || '2026/2027'
  );
  const [semester, setSemester] = useState<'1' | '2'>(
    calendar?.semester || (academicSetting.semester?.includes('2') ? '2' : '1')
  );
  const [startDate, setStartDate] = useState(
    calendar?.startDate || (semester === '1' ? '2026-07-13' : '2027-01-04')
  );
  const [endDate, setEndDate] = useState(
    calendar?.endDate || (semester === '1' ? '2026-12-18' : '2027-06-18')
  );
  const [schoolDaysPerWeek, setSchoolDaysPerWeek] = useState<number>(
    calendar?.schoolDaysPerWeek || 5
  );

  // JP per week: initial value from calendar, setting, or official rule
  const initialJP =
    calendar?.jpPerWeek ||
    academicSetting.subjectWeeklyJP ||
    academicSetting.totalHoursPerWeek ||
    officialRule.weeklyJP ||
    4;
  const [jpPerWeek, setJpPerWeek] = useState<number>(initialJP);

  // Track if user manually modified JP
  const isCustomJP = officialRule.isOfficial && officialRule.weeklyJP !== null && jpPerWeek !== officialRule.weeklyJP;

  // Calendar days / events
  const [days, setDays] = useState<CalendarDay[]>(calendarDays || []);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayStatus, setNewDayStatus] = useState<CalendarDay['status']>('holiday');
  const [newDayNotes, setNewDayNotes] = useState('');

  // Time allocations
  const [allocations, setAllocations] = useState<TimeAllocation[]>(timeAllocations || []);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Exact Effective Days & Weeks calculation from JP Engine
  const effectiveResult = useMemo(() => {
    return calculateEffectiveDays(
      {
        startDate,
        endDate,
        schoolDaysPerWeek,
        semester,
        academicYear,
      },
      days
    );
  }, [startDate, endDate, schoolDaysPerWeek, semester, academicYear, days]);

  const effectiveWeeks = calculateEffectiveWeeks(effectiveResult.effectiveLearningDays, schoolDaysPerWeek).effectiveWeeksRounded;

  // Compute available JP using the official formula: JP/minggu * minggu efektif
  const availableJPResult = useMemo(() => {
    return calculateAvailableJP({
      subjectWeeklyJP: jpPerWeek,
      effectiveLearningDays: effectiveResult.effectiveLearningDays,
      schoolDaysPerWeek,
      semester,
      academicYear,
      level: academicSetting.level,
      grade: academicSetting.grade,
      subject: academicSetting.subject,
      officialAnnualJP: officialRule.annualJP,
    });
  }, [jpPerWeek, effectiveResult.effectiveLearningDays, schoolDaysPerWeek, semester, academicYear, academicSetting, officialRule]);

  const totalAvailableJP = availableJPResult.availableJP;

  // Planned JP calculation
  const totalPlannedJP = useMemo(() => {
    if (isK13Curriculum) {
      return (k13Analysis?.items || []).reduce((acc, _) => acc + jpPerWeek, 0);
    }
    return (atp?.items || []).reduce((acc, curr) => acc + (Number(curr.jp) || jpPerWeek), 0);
  }, [isK13Curriculum, k13Analysis, atp, jpPerWeek]);

  const jpDifference = totalAvailableJP - totalPlannedJP;

  const handleAddDay = () => {
    if (!newDayDate) return;
    const newDay: CalendarDay = {
      id: `day-${Date.now()}`,
      academicCalendarId: calendar?.id || 'cal-1',
      date: newDayDate,
      status: newDayStatus,
      notes: newDayNotes || (newDayStatus === 'holiday' ? 'Hari Libur' : 'Kegiatan Khusus'),
    };
    setDays((prev) => [...prev, newDay]);
    setNewDayDate('');
    setNewDayNotes('');
  };

  const handleRemoveDay = (id: string) => {
    setDays((prev) => prev.filter((d) => d.id !== id));
  };

  const handleResetToOfficialJP = () => {
    if (officialRule.weeklyJP) {
      setJpPerWeek(officialRule.weeklyJP);
    }
  };

  const handleSaveCalendarConfig = () => {
    const updatedCalendar: AcademicCalendar = {
      id: calendar?.id || `cal-${Date.now()}`,
      academicSettingId: academicSetting.id,
      academicYear,
      semester,
      startDate,
      endDate,
      schoolDaysPerWeek,
      jpPerWeek,
      updatedAt: new Date().toISOString(),
    };
    onSaveCalendar(updatedCalendar, days);
    setSaveNotification('Pengaturan Kalender & Alokasi JP berhasil disimpan!');
    setTimeout(() => setSaveNotification(null), 3000);
  };

  const handleWeekChange = (itemId: string, week: number) => {
    setAllocations((prev) => {
      const existingIndex = prev.findIndex((a) => a.atpItemId === itemId || a.tpId === itemId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], weekNumber: week };
        return updated;
      } else {
        const newAlloc: TimeAllocation = {
          id: `alloc-${Date.now()}-${itemId}`,
          academicSettingId: academicSetting.id,
          atpItemId: itemId,
          tpId: itemId,
          weekNumber: week,
          jp: jpPerWeek,
        };
        return [...prev, newAlloc];
      }
    });
  };

  const handleSaveAllocations = () => {
    onSaveTimeAllocations(allocations);
    setSaveNotification('Pemetaan Alokasi Waktu Pembelajaran berhasil disimpan!');
    setTimeout(() => setSaveNotification(null), 3000);
  };

  const handleExportKalender = async () => {
    setIsExporting('kalender');
    try {
      await generateKalenderAkademik({
        school,
        profile,
        academicSetting: {
          ...academicSetting,
          subjectWeeklyJP: jpPerWeek,
          hoursSourceType: isCustomJP ? 'USER_OVERRIDE' : 'REGULATION_STANDARDIZED',
        },
        calendar: {
          id: calendar?.id || 'cal-1',
          academicSettingId: academicSetting.id,
          academicYear,
          semester,
          startDate,
          endDate,
          schoolDaysPerWeek,
          jpPerWeek,
          updatedAt: new Date().toISOString(),
        },
        calendarDays: days,
      });
    } catch (e: any) {
      alert(`Gagal mengekspor kalender: ${e.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportAlokasi = async () => {
    setIsExporting('alokasi');
    try {
      await generateAlokasiWaktu({
        school,
        profile,
        academicSetting: {
          ...academicSetting,
          subjectWeeklyJP: jpPerWeek,
          hoursSourceType: isCustomJP ? 'USER_OVERRIDE' : 'REGULATION_STANDARDIZED',
        },
        atp,
        calendar: {
          id: calendar?.id || 'cal-1',
          academicSettingId: academicSetting.id,
          academicYear,
          semester,
          startDate,
          endDate,
          schoolDaysPerWeek,
          jpPerWeek,
          updatedAt: new Date().toISOString(),
        },
        timeAllocations: allocations,
      });
    } catch (e: any) {
      alert(`Gagal mengekspor alokasi waktu: ${e.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6" id="time-planning-container">
      {saveNotification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in duration-150">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">{saveNotification}</p>
        </div>
      )}

      {/* Top Banner & Context Info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs tracking-wider uppercase">
              <Clock className="w-4 h-4" />
              <span>Modul Perencanaan Waktu Pembelajaran Resmi</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Kalender Pendidikan, Hari/Minggu Efektif, & Alokasi JP
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Sinkronisasi perhitungan waktu berbasis regulasi resmi untuk {academicSetting.subject} ({academicSetting.grade} - {academicSetting.level})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-export-kalender"
              type="button"
              onClick={handleExportKalender}
              disabled={isExporting === 'kalender'}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>{isExporting === 'kalender' ? 'Mengekspor...' : 'Ekspor Kalender (.docx)'}</span>
            </button>
            <button
              id="btn-export-alokasi"
              type="button"
              onClick={handleExportAlokasi}
              disabled={isExporting === 'alokasi'}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>{isExporting === 'alokasi' ? 'Mengekspor...' : 'Ekspor Alokasi Waktu (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* Regulatory Provenance Card */}
        <div className="mt-4 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-indigo-950">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Basis Regulasi Struktur Kurikulum:</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-[11px]">
                  {officialRule.regulation}
                </span>
                {isCustomJP && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                    Kustomisasi Guru (Override)
                  </span>
                )}
              </div>
              <p className="text-slate-600 mt-1">
                Standar Intrakurikuler Resmi: <strong>{officialRule.weeklyJP || '-'} JP/pekan</strong> ({officialRule.annualJP ? `${officialRule.annualJP} JP/tahun` : 'Belum ditetapkan'})
                {officialRule.kokurikulerAnnualJP ? ` • P5/Kokurikuler: ${officialRule.kokurikulerWeeklyJP || Math.round(officialRule.kokurikulerAnnualJP / 36)} JP/pekan (${officialRule.kokurikulerAnnualJP} JP/tahun)` : ''}
              </p>
            </div>
          </div>

          {isCustomJP && (
            <button
              type="button"
              onClick={handleResetToOfficialJP}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium text-xs shadow-2xs self-start md:self-auto shrink-0"
              title="Kembalikan ke nilai JP resmi regulasi"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Gunakan Standar Resmi ({officialRule.weeklyJP} JP)</span>
            </button>
          )}
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-500 block">Minggu Efektif Semester</span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block">{effectiveWeeks} Pekan</span>
            <span className="text-xs text-slate-500">
              {effectiveResult.effectiveDaysCount} hari efektif ({effectiveResult.holidaysCount} hari libur)
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-500 block">Total JP Efektif Tersedia</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{totalAvailableJP} JP</span>
            <span className="text-[11px] text-indigo-600/80 font-medium">
              {effectiveWeeks} pekan &times; {jpPerWeek} JP/pekan
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-500 block">
              {isK13Curriculum ? 'Total Jam Materi (KD)' : 'Total Jam Materi (ATP)'}
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{totalPlannedJP} JP</span>
            <span className="text-xs text-slate-500">
              {isK13Curriculum ? `Dari ${k13Analysis?.items?.length || 0} KD K13` : `Dari ${atp?.items?.length || 0} Tujuan Pembelajaran`}
            </span>
          </div>

          <div className={`border rounded-xl p-4 ${jpDifference < 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <span className="text-xs font-medium text-slate-600 block">Analisis Selisih Jam</span>
            <span className={`text-xl font-bold mt-1 block ${jpDifference < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {jpDifference === 0 ? 'Tepat Sesuai (0 JP)' : jpDifference > 0 ? `+${jpDifference} JP Fleksibel` : `${jpDifference} JP Defisit`}
            </span>
            <span className="text-xs text-slate-500">
              {jpDifference === 0 ? 'Alokasi waktu pas dan terdistribusi' : jpDifference > 0 ? 'Tersedia jam untuk penguatan / cadangan' : 'Jam materi melebihi waktu efektif'}
            </span>
          </div>
        </div>

        {/* Detailed Explanation / Warning if discrepancy exists */}
        {jpDifference < 0 && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950">Perhatian Alokasi Waktu: </span>
              Total Jam Pelajaran pada rancangan materi ({totalPlannedJP} JP) melebihi ketersediaan Jam Pembelajaran Efektif ({totalAvailableJP} JP) sebanyak {Math.abs(jpDifference)} JP.
              Saran: Rampingkan alokasi waktu per unit materi atau sesuaikan perkiraan pekan efektif pada kalender.
            </div>
          </div>
        )}

        {jpDifference > 0 && (
          <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 text-xs">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-950">Optimalisasi Selisih Waktu (+{jpDifference} JP): </span>
              Sisa jam efektif ini bukan semata waktu kosong, melainkan dapat dialokasikan untuk: (1) Asesmen Sumatif Akhir Semester, (2) Kegiatan Remedial & Pengayaan terstruktur, (3) Penguatan Proyek/P5, atau (4) Cadangan waktu fleksibilitas agenda sekolah.
            </div>
          </div>
        )}
      </div>

      {/* Grid: Calendar Configuration & Days List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">Konfigurasi Rentang Kalender</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Ajaran</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="2026/2027"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
                <select
                  value={semester}
                  onChange={(e) => {
                    const newSem = e.target.value as '1' | '2';
                    setSemester(newSem);
                    if (newSem === '1') {
                      setStartDate('2026-07-13');
                      setEndDate('2026-12-18');
                    } else {
                      setStartDate('2027-01-04');
                      setEndDate('2027-06-18');
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                >
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Mulai Semester</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Akhir Semester</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hari Sekolah / Pekan</label>
                <select
                  value={schoolDaysPerWeek}
                  onChange={(e) => setSchoolDaysPerWeek(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                >
                  <option value={5}>5 Hari (Senin - Jumat)</option>
                  <option value={6}>6 Hari (Senin - Sabtu)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">JP Intrakurikuler / Pekan</label>
                  {officialRule.isOfficial && (
                    <span className="text-[10px] text-slate-500 font-normal">Resmi: {officialRule.weeklyJP} JP</span>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={jpPerWeek}
                  onChange={(e) => setJpPerWeek(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-indigo-900"
                />
              </div>
            </div>

            {/* Monthly Breakdown Preview */}
            {effectiveResult?.monthlyBreakdown && effectiveResult.monthlyBreakdown.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">Rincian Hari Efektif Bulanan:</span>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {effectiveResult.monthlyBreakdown.map((m) => (
                    <div key={m.monthName} className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="font-semibold text-slate-800">{m.monthName}</div>
                      <div className="text-slate-500 text-[10px]">{m.effectiveDays} HE / {m.effectiveWeeks} ME</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              id="btn-save-calendar-config"
              type="button"
              onClick={handleSaveCalendarConfig}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Konfigurasi Kalender & JP</span>
            </button>
          </div>
        </div>

        {/* Right: Days & Special Events Manager */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">Agenda Libur & Kegiatan Khusus Satuan Pendidikan</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">{days.length} entri tercatat</span>
          </div>

          {/* Add Day Input */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 space-y-2">
            <span className="text-xs font-semibold text-slate-700 block">Tambah Hari Libur / Agenda Non-KBM:</span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="date"
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                className="sm:col-span-4 text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
              <select
                value={newDayStatus}
                onChange={(e) => setNewDayStatus(e.target.value as CalendarDay['status'])}
                className="sm:col-span-3 text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
              >
                <option value="holiday">Hari Libur</option>
                <option value="schoolEvent">Kegiatan Sekolah</option>
                <option value="effective">Hari Efektif</option>
              </select>
              <input
                type="text"
                value={newDayNotes}
                onChange={(e) => setNewDayNotes(e.target.value)}
                placeholder="Keterangan (cth: PTS / Libur Nasional)"
                className="sm:col-span-4 text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
              <button
                type="button"
                onClick={handleAddDay}
                className="sm:col-span-1 inline-flex items-center justify-center p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                title="Tambah"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days Table List */}
          <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Jenis</th>
                  <th className="py-2 px-3">Keterangan</th>
                  <th className="py-2 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Belum ada tanggal libur atau agenda khusus ditambahkan.
                    </td>
                  </tr>
                ) : (
                  days.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800">{d.date}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            d.status === 'holiday'
                              ? 'bg-rose-100 text-rose-700'
                              : d.status === 'schoolEvent'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {d.status === 'holiday' ? 'Libur' : d.status === 'schoolEvent' ? 'Kegiatan' : 'Efektif'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{d.notes || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDay(d.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom: Weekly Time Allocations mapped to ATP / K13 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {isK13Curriculum
                  ? 'Pemetaan Pekan Pembelajaran per Kompetensi Dasar (K13)'
                  : 'Pemetaan Pekan Pembelajaran per TP (Alur Tujuan Pembelajaran)'}
              </h3>
              <p className="text-xs text-slate-500">
                Distribusikan urutan pekan mengajar efektif ({effectiveWeeks} pekan) untuk setiap unit materi
              </p>
            </div>
          </div>

          <button
            id="btn-save-time-allocations"
            type="button"
            onClick={handleSaveAllocations}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pemetaan Waktu</span>
          </button>
        </div>

        {isK13Curriculum ? (
          /* K13 Table Mapping */
          !k13Analysis?.items || k13Analysis.items.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p className="text-sm">Belum ada Analisis KD K13 yang disusun pada alur K13.</p>
              <p className="text-xs text-slate-400 mt-1">Silakan susun Analisis KD K13 terlebih dahulu agar materi otomatis terhubung di sini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3 w-28">Kompetensi Dasar (KD)</th>
                    <th className="py-2.5 px-3">Indikator & Ruang Lingkup Materi</th>
                    <th className="py-2.5 px-3 w-24 text-center">Alokasi JP</th>
                    <th className="py-2.5 px-3 w-40 text-center">Penempatan Pekan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {k13Analysis.items.map((item, index) => {
                    const matchedAlloc = allocations.find((a) => a.atpItemId === item.id || a.tpId === item.id);
                    const defaultWeek = Math.min(effectiveWeeks, index + 1);
                    const currentWeek = matchedAlloc?.weekNumber || defaultWeek;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center font-medium text-slate-500">{index + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-700">{item.kd}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{item.indikator || item.materi}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Materi Pokok: {item.materi || '-'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{jpPerWeek} JP</td>
                        <td className="py-2.5 px-3 text-center">
                          <select
                            value={currentWeek}
                            onChange={(e) => handleWeekChange(item.id, Number(e.target.value))}
                            className="text-xs px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            {Array.from({ length: effectiveWeeks }, (_, i) => i + 1).map((w) => (
                              <option key={w} value={w}>
                                Pekan ke-{w}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Kurikulum Merdeka ATP Table Mapping */
          !atp?.items || atp.items.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p className="text-sm">Belum ada Alur Tujuan Pembelajaran (ATP) yang dibuat pada Step 05.</p>
              <p className="text-xs text-slate-400 mt-1">Silakan susun ATP terlebih dahulu agar materi otomatis terhubung di sini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3 w-28">Kode TP</th>
                    <th className="py-2.5 px-3">Tujuan Pembelajaran & Ruang Lingkup Materi</th>
                    <th className="py-2.5 px-3 w-24 text-center">Beban JP</th>
                    <th className="py-2.5 px-3 w-40 text-center">Penempatan Pekan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(atp.items || []).map((item, index) => {
                    const matchedAlloc = allocations.find((a) => a.atpItemId === item.id || a.tpId === item.tpId);
                    const defaultWeek = Math.min(effectiveWeeks, index + 1);
                    const currentWeek = matchedAlloc?.weekNumber || defaultWeek;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center font-medium text-slate-500">{index + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-700">{item.tpCode || `TP.${index + 1}`}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{item.tpStatement || item.competency}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Lingkup Materi: {item.contentScope || item.subMaterial || '-'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{item.jp || jpPerWeek} JP</td>
                        <td className="py-2.5 px-3 text-center">
                          <select
                            value={currentWeek}
                            onChange={(e) => handleWeekChange(item.id, Number(e.target.value))}
                            className="text-xs px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            {Array.from({ length: effectiveWeeks }, (_, i) => i + 1).map((w) => (
                              <option key={w} value={w}>
                                Pekan ke-{w}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};

