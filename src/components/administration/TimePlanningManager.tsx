import React, { useState, useMemo, useEffect } from 'react';
import {
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AcademicCalendar,
  CalendarDay,
  TimeAllocation,
  ATPData,
  K13Analysis,
  CalendarSourceType,
  CalendarWorkflowStatus,
  CalendarResolutionStatus,
} from '../../types';
import {
  calculateEffectiveDays,
  calculateEffectiveWeeks,
  calculateAvailableJP,
  getSubjectJP,
  resolveSemester,
} from '../../services/jpEngine';
import {
  resolveOfficialCalendar,
  applyManualCalendarOverride,
  confirmCalendarWorkflow,
  resetCalendarToOfficial,
  getAvailableProvinces,
  getAvailableAcademicYears,
} from '../../services/calendarResolver';
import {
  generateKalenderAkademik,
  generateAlokasiWaktu,
} from '../../services/documentEngine';
import { resolveCalendarOnline } from '../../services/calendarProviderClient';
import { CalendarSourceCandidate } from '../../services/calendarProvider';
import {
  Clock,
  Calendar as CalendarIcon,
  CalendarCheck,
  CalendarDays,
  Layers,
  Plus,
  Trash2,
  Save,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Info,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Check,
  Edit3,
  ExternalLink,
} from 'lucide-react';

export interface TimePlanningManagerProps {
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

  // Workflow State
  const [workflowStatus, setWorkflowStatus] = useState<CalendarWorkflowStatus>(
    calendar?.workflowStatus || (calendar?.startDate && calendar?.endDate ? 'AUTO_RESOLVED' : 'UNRESOLVED')
  );
  const [resolutionStatus, setResolutionStatus] = useState<CalendarResolutionStatus>(
    calendar?.resolutionStatus || (calendar?.startDate && calendar?.endDate ? 'RESOLVED' : 'UNRESOLVED')
  );

  // Region & Academic Settings for Auto-Resolution
  const [selectedProvince, setSelectedProvince] = useState<string>(
    calendar?.sourceRegion || school.province || ''
  );
  const [academicYear, setAcademicYear] = useState<string>(
    calendar?.academicYear || academicSetting.academicYear || ''
  );
  const [semester, setSemester] = useState<'1' | '2' | null>(
    resolveSemester(calendar?.semester, academicSetting.semester)
  );

  // Calendar dates & structure
  const [startDate, setStartDate] = useState<string>(calendar?.startDate || '');
  const [endDate, setEndDate] = useState<string>(calendar?.endDate || '');
  const [schoolDaysPerWeek, setSchoolDaysPerWeek] = useState<number | null>(
    calendar?.schoolDaysPerWeek === 5 || calendar?.schoolDaysPerWeek === 6
      ? calendar.schoolDaysPerWeek
      : 5
  );

  // Provenance & Authority
  const [sourceType, setSourceType] = useState<CalendarSourceType>(
    calendar?.sourceType || 'REGIONAL_EDUCATION_CALENDAR'
  );
  const [sourceName, setSourceName] = useState<string>(calendar?.sourceName || '');
  const [sourceAuthority, setSourceAuthority] = useState<string>(calendar?.sourceAuthority || '');
  const [sourceDocumentNumber, setSourceDocumentNumber] = useState<string>(calendar?.sourceDocumentNumber || '');
  const [sourceUrl, setSourceUrl] = useState<string>(calendar?.sourceUrl || '');
  const [isOverridden, setIsOverridden] = useState<boolean>(calendar?.isOverridden || false);
  const [overrideReason, setOverrideReason] = useState<string>(calendar?.overrideReason || '');

  // JP per week
  const initialJP =
    calendar?.jpPerWeek !== undefined && calendar?.jpPerWeek !== null
      ? calendar.jpPerWeek
      : academicSetting.subjectWeeklyJP !== undefined && academicSetting.subjectWeeklyJP !== null
      ? Number(academicSetting.subjectWeeklyJP)
      : academicSetting.totalHoursPerWeek !== undefined && academicSetting.totalHoursPerWeek !== null
      ? Number(academicSetting.totalHoursPerWeek)
      : officialRule.weeklyJP ?? null;

  const [jpPerWeek, setJpPerWeek] = useState<number | null>(initialJP);

  // Track if user manually modified JP
  const isCustomJP =
    officialRule.isOfficial &&
    officialRule.weeklyJP !== null &&
    jpPerWeek !== null &&
    jpPerWeek !== officialRule.weeklyJP;

  // Calendar days / events
  const [days, setDays] = useState<CalendarDay[]>(calendarDays || []);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayStatus, setNewDayStatus] = useState<CalendarDay['status']>('holiday');
  const [newDayNotes, setNewDayNotes] = useState('');

  // Time allocations
  const [allocations, setAllocations] = useState<TimeAllocation[]>(timeAllocations || []);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [resolutionMessage, setResolutionMessage] = useState<string | null>(null);

  // Online Discovery & Resolution State
  const [onlineDiscovery, setOnlineDiscovery] = useState<CalendarSourceCandidate | null>(null);
  const [isOnlineSearching, setIsOnlineSearching] = useState<boolean>(false);
  const [onlineSearchError, setOnlineSearchError] = useState<string | null>(null);

  // Auto-resolve on initialization if calendar is empty or unconfigured
  useEffect(() => {
    if (
      (!calendar || !calendar.startDate || !calendar.endDate) &&
      school.province &&
      academicSetting.academicYear &&
      academicSetting.semester
    ) {
      handleAutoResolve(false);
    }
  }, [school.province, academicSetting.academicYear, academicSetting.semester]);

  // Exact Effective Days & Weeks calculation from JP Engine
  const effectiveResult = useMemo(() => {
    if (!startDate || !endDate || !schoolDaysPerWeek) {
      return calculateEffectiveDays(
        {
          startDate: '',
          endDate: '',
          schoolDaysPerWeek: undefined,
        },
        []
      );
    }
    return calculateEffectiveDays(
      {
        startDate,
        endDate,
        schoolDaysPerWeek,
        semester: semester ? (semester === '1' ? '1 (Ganjil)' : '2 (Genap)') : undefined,
        academicYear,
      },
      days
    );
  }, [startDate, endDate, schoolDaysPerWeek, semester, academicYear, days]);

  const effectiveWeeksResult = useMemo(() => {
    return calculateEffectiveWeeks(effectiveResult.effectiveLearningDays, schoolDaysPerWeek);
  }, [effectiveResult.effectiveLearningDays, schoolDaysPerWeek]);

  const effectiveWeeks =
    effectiveWeeksResult.status === 'RESOLVED' ? effectiveWeeksResult.effectiveWeeksRounded : null;

  // Compute available JP
  const availableJPResult = useMemo(() => {
    return calculateAvailableJP({
      subjectWeeklyJP: jpPerWeek,
      effectiveLearningDays:
        effectiveResult.status === 'RESOLVED' ? effectiveResult.effectiveLearningDays : null,
      schoolDaysPerWeek,
      calendarStatus: effectiveResult.status,
      effectiveDayStatus: effectiveResult.status,
      semester: semester ? (semester === '1' ? '1 (Ganjil)' : '2 (Genap)') : undefined,
      academicYear,
      level: academicSetting.level,
      grade: academicSetting.grade,
      subject: academicSetting.subject,
      officialAnnualJP: officialRule.intrakurikulerAnnualJP ?? officialRule.annualJP,
    });
  }, [
    jpPerWeek,
    effectiveResult,
    schoolDaysPerWeek,
    semester,
    academicYear,
    academicSetting,
    officialRule,
  ]);

  const totalAvailableJP =
    availableJPResult.status === 'RESOLVED' ? availableJPResult.availableJP : null;

  // Planned JP calculation
  const totalPlannedJP = useMemo(() => {
    if (isK13Curriculum) {
      return (k13Analysis?.items || []).reduce((acc, item) => {
        const match = allocations.find(
          (a) =>
            (a.sourceType === 'KD' && a.sourceId === item.id) ||
            a.sourceId === item.id ||
            a.tpId === item.id
        );
        const jp = match?.allocatedJP ?? match?.jp ?? (item.alokasiJp ? Number(item.alokasiJp) : 0);
        return acc + jp;
      }, 0);
    }
    return (atp?.items || []).reduce((acc, curr) => {
      const match = allocations.find(
        (a) =>
          (a.sourceType === 'ATP_ITEM' && a.sourceId === curr.id) ||
          a.atpItemId === curr.id ||
          a.sourceId === curr.id
      );
      const itemJp =
        curr.jp !== undefined && curr.jp !== null
          ? Number(curr.jp)
          : match?.allocatedJP ?? match?.jp ?? 0;
      return acc + (itemJp || 0);
    }, 0);
  }, [isK13Curriculum, k13Analysis, atp, allocations]);

  const jpDifference =
    totalAvailableJP !== null && totalPlannedJP > 0 ? totalAvailableJP - totalPlannedJP : null;

  const isCalendarConfigComplete =
    Boolean(startDate) &&
    Boolean(endDate) &&
    Boolean(semester) &&
    (schoolDaysPerWeek === 5 || schoolDaysPerWeek === 6) &&
    effectiveResult.status === 'RESOLVED';

  // =========================================================================
  // WORKFLOW ACTION HANDLERS
  // =========================================================================

  // Step 1: AUTO RESOLVE
  const handleAutoResolve = async (showNotification: boolean = true) => {
    // 1. Resolve local official static calendar first
    const res = resolveOfficialCalendar({
      province: selectedProvince,
      academicYear,
      semester: semester || undefined,
      academicSettingId: academicSetting.id,
      calendarId: calendar?.id,
      schoolDaysPerWeek,
      subjectWeeklyJP: jpPerWeek,
    });

    if (res.isResolved && res.calendar) {
      // Local source resolved: keep existing flow and do not perform online search
      setOnlineDiscovery(null);
      setOnlineSearchError(null);
      setStartDate(res.calendar.startDate);
      setEndDate(res.calendar.endDate);
      setSchoolDaysPerWeek(res.calendar.schoolDaysPerWeek || 5);
      setSourceType('REGIONAL_EDUCATION_CALENDAR');
      setSourceName(res.calendar.sourceName || '');
      setSourceAuthority(res.calendar.sourceAuthority || '');
      setSourceDocumentNumber(res.calendar.sourceDocumentNumber || '');
      setSourceUrl(res.calendar.sourceUrl || '');
      setDays(res.days);
      setIsOverridden(false);
      setWorkflowStatus('AUTO_RESOLVED');
      setResolutionStatus('RESOLVED');
      setResolutionMessage(res.diagnostic);

      onSaveCalendar(res.calendar, res.days);

      if (showNotification) {
        setSaveNotification('Kalender Pendidikan berhasil di-resolusi secara otomatis dari Sumber Resmi Daerah!');
        setTimeout(() => setSaveNotification(null), 3500);
      }
    } else {
      // Local unresolved: keep unresolved workflow
      setWorkflowStatus('UNRESOLVED');
      setResolutionStatus(res.resolutionStatus);
      setResolutionMessage(res.diagnostic);

      const semNum = semester === '1' ? 1 : semester === '2' ? 2 : null;
      const prov = selectedProvince || school.province;

      // Online search strictly if and only if UNVERIFIED_SOURCE and province + academicYear + semester are present
      if (
        res.resolutionStatus === 'UNVERIFIED_SOURCE' &&
        academicYear &&
        semNum &&
        prov
      ) {
        setIsOnlineSearching(true);
        setOnlineSearchError(null);
        try {
          const onlineRes = await resolveCalendarOnline({
            academicYear,
            semester: semNum,
            province: prov,
            regency: school.regency || undefined,
          });

          if (onlineRes.status === 'PARTIALLY_RESOLVED' && onlineRes.selectedSource) {
            setOnlineDiscovery(onlineRes.selectedSource);
            // CRITICAL POLICY: PARTIAL is strictly READ-ONLY. DO NOT mutate AcademicCalendar, dates, or save!
            if (showNotification) {
              setSaveNotification('Sumber resmi ditemukan online — perlu verifikasi');
              setTimeout(() => setSaveNotification(null), 4000);
            }
          } else {
            setOnlineDiscovery(null);
            if (showNotification) {
              setSaveNotification(res.diagnostic);
              setTimeout(() => setSaveNotification(null), 4000);
            }
          }
        } catch (err: any) {
          setOnlineSearchError(err?.message || 'Gagal melakukan pencarian kalender online');
          setOnlineDiscovery(null);
        } finally {
          setIsOnlineSearching(false);
        }
      } else {
        // For REGION_REQUIRED, ACADEMIC_YEAR_REQUIRED, SEMESTER_REQUIRED: no online search
        setOnlineDiscovery(null);
        if (showNotification) {
          setSaveNotification(res.diagnostic);
          setTimeout(() => setSaveNotification(null), 4000);
        }
      }
    }
  };

  // Step 3: MANUAL OVERRIDE
  const handleApplyOverride = (overrideUpdates?: Partial<AcademicCalendar>, updatedDays?: CalendarDay[]) => {
    const currentCal: AcademicCalendar = {
      id: calendar?.id || `cal-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      academicYear,
      semester: semester ? (semester === '1' ? '1 (Ganjil)' : '2 (Genap)') : '',
      startDate,
      endDate,
      schoolDaysPerWeek,
      sourceType: 'SCHOOL_OVERRIDE',
      sourceName: sourceName.trim() || undefined,
      sourceAuthority: sourceAuthority.trim() || undefined,
      sourceDocumentNumber: sourceDocumentNumber.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      sourceRegion: selectedProvince,
      workflowStatus: 'MANUAL_OVERRIDE',
      isOverridden: true,
      overrideReason: overrideReason.trim() || 'Penyesuaian tanggal / agenda oleh satuan pendidikan',
      jpPerWeek,
      updatedAt: new Date().toISOString(),
    };

    const targetDays = updatedDays || days;
    const res = applyManualCalendarOverride(
      currentCal,
      targetDays,
      overrideUpdates || {},
      targetDays
    );

    setIsOverridden(true);
    setWorkflowStatus('MANUAL_OVERRIDE');
    onSaveCalendar(res.calendar, res.days);

    setSaveNotification('Penyesuaian Manual (Manual Override) berhasil diterapkan & disimpan.');
    setTimeout(() => setSaveNotification(null), 3000);
  };

  // Step 4: CONFIRM
  const handleConfirmCalendar = () => {
    if (!isCalendarConfigComplete) {
      alert('Lengkapi konfigurasi kalender terlebih dahulu sebelum melakukan konfirmasi.');
      return;
    }

    const currentCal: AcademicCalendar = {
      id: calendar?.id || `cal-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      academicYear,
      semester: semester ? (semester === '1' ? '1 (Ganjil)' : '2 (Genap)') : '',
      startDate,
      endDate,
      schoolDaysPerWeek,
      sourceType,
      sourceName: sourceName.trim() || undefined,
      sourceAuthority: sourceAuthority.trim() || undefined,
      sourceDocumentNumber: sourceDocumentNumber.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      sourceRegion: selectedProvince,
      workflowStatus: 'CONFIRMED',
      isOverridden,
      overrideReason: isOverridden ? overrideReason : undefined,
      jpPerWeek,
      updatedAt: new Date().toISOString(),
    };

    const res = confirmCalendarWorkflow(currentCal, days);
    setWorkflowStatus('CONFIRMED');
    onSaveCalendar(res.calendar, res.days);

    setSaveNotification('Kalender Pendidikan RESMI DIKONFIRMASI & DITETAPKAN untuk semester ini!');
    setTimeout(() => setSaveNotification(null), 3500);
  };

  // Reset to Official
  const handleResetToOfficial = () => {
    if (confirm('Kembalikan semua tanggal dan agenda ke Kalender Pendidikan Resmi Daerah? Modifikasi manual sekolah akan digantikan.')) {
      handleAutoResolve(true);
    }
  };

  // Day add/remove
  const handleAddDay = () => {
    if (!newDayDate) return;
    const newDay: CalendarDay = {
      id: `day-${Date.now()}`,
      academicCalendarId: calendar?.id || `cal-${academicSetting.id}`,
      date: newDayDate,
      status: newDayStatus,
      notes: newDayNotes || (newDayStatus === 'holiday' ? 'Hari Libur Sekolah' : 'Kegiatan Khusus Sekolah'),
      sourceType: 'SCHOOL_OVERRIDE',
      sourceName: school.name || 'Satuan Pendidikan',
      isOverridden: true,
      category: newDayStatus === 'holiday' ? 'OTHER' : 'SCHOOL_EVENT',
    };
    const updatedDays = [...days, newDay].sort((a, b) => a.date.localeCompare(b.date));
    setDays(updatedDays);
    setNewDayDate('');
    setNewDayNotes('');
    handleApplyOverride({}, updatedDays);
  };

  const handleRemoveDay = (id: string) => {
    const updatedDays = days.filter((d) => d.id !== id);
    setDays(updatedDays);
    handleApplyOverride({}, updatedDays);
  };

  const handleResetToOfficialJP = () => {
    if (officialRule.weeklyJP) {
      setJpPerWeek(officialRule.weeklyJP);
    }
  };

  const handleWeekChange = (itemId: string, week: number) => {
    setAllocations((prev) => {
      const existingIndex = prev.findIndex(
        (a) =>
          a.sourceId === itemId ||
          a.atpItemId === itemId ||
          a.tpId === itemId
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          weekNumber: week,
          startWeek: week,
          endWeek: week,
        };
        return updated;
      } else {
        const currAtpItem = atp?.items?.find((i) => i.id === itemId);
        const allocatedVal = isK13Curriculum
          ? jpPerWeek || 0
          : currAtpItem?.jp
          ? Number(currAtpItem.jp)
          : jpPerWeek || 0;
        const newAlloc: TimeAllocation = {
          id: `alloc-${Date.now()}-${itemId}`,
          academicSettingId: academicSetting.id,
          sourceType: isK13Curriculum ? 'KD' : 'ATP_ITEM',
          sourceId: itemId,
          semester: semester ? (semester === '1' ? '1 (Ganjil)' : '2 (Genap)') : undefined,
          atpItemId: !isK13Curriculum ? itemId : undefined,
          weekNumber: week,
          startWeek: week,
          endWeek: week,
          jp: allocatedVal,
          allocatedJP: allocatedVal,
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
    if (!semester) {
      alert('Semester belum ditetapkan. Pilih semester sebelum melanjutkan ekspor kalender.');
      return;
    }
    if (!startDate || !endDate || !schoolDaysPerWeek) {
      alert(
        'Kalender pendidikan belum lengkap. Lengkapi tanggal mulai, tanggal selesai, dan hari sekolah per pekan sebelum ekspor.'
      );
      return;
    }
    setIsExporting('kalender');
    try {
      await generateKalenderAkademik({
        school,
        profile,
        academicSetting: {
          ...academicSetting,
          subjectWeeklyJP: jpPerWeek ?? undefined,
          hoursSourceType: isCustomJP ? 'USER_OVERRIDE' : 'REGULATION_STANDARDIZED',
        },
        calendar: {
          id: calendar?.id || `cal-${academicSetting.id}`,
          academicSettingId: academicSetting.id,
          academicYear,
          semester: semester === '1' ? '1 (Ganjil)' : '2 (Genap)',
          startDate,
          endDate,
          schoolDaysPerWeek,
          sourceType,
          sourceName: sourceName.trim() || undefined,
          sourceRegion: selectedProvince,
          jpPerWeek,
          workflowStatus,
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
    if (!semester) {
      alert('Semester belum ditetapkan. Pilih semester sebelum melanjutkan ekspor alokasi waktu.');
      return;
    }
    if (!startDate || !endDate || !schoolDaysPerWeek) {
      alert('Kalender pendidikan belum lengkap. Lengkapi konfigurasi waktu sebelum ekspor alokasi waktu.');
      return;
    }
    setIsExporting('alokasi');
    try {
      await generateAlokasiWaktu({
        school,
        profile,
        academicSetting: {
          ...academicSetting,
          subjectWeeklyJP: jpPerWeek ?? undefined,
          hoursSourceType: isCustomJP ? 'USER_OVERRIDE' : 'REGULATION_STANDARDIZED',
        },
        atp,
        calendar: {
          id: calendar?.id || `cal-${academicSetting.id}`,
          academicSettingId: academicSetting.id,
          academicYear,
          semester: semester === '1' ? '1 (Ganjil)' : '2 (Genap)',
          startDate,
          endDate,
          schoolDaysPerWeek,
          sourceType,
          sourceName: sourceName.trim() || undefined,
          sourceRegion: selectedProvince,
          jpPerWeek,
          workflowStatus,
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

  const availableProvinces = useMemo(() => getAvailableProvinces(), []);
  const availableYears = useMemo(() => getAvailableAcademicYears(), []);

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
              Kalender Pendidikan, Hari/Minggu Efektif, &amp; Alokasi JP
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Alur Kerja Terintegrasi: <strong>Auto Resolve → Review → Manual Override → Confirm</strong> untuk {academicSetting.subject} ({academicSetting.grade} - {academicSetting.level})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-export-kalender"
              type="button"
              onClick={handleExportKalender}
              disabled={isExporting === 'kalender' || !isCalendarConfigComplete}
              title={!isCalendarConfigComplete ? 'Lengkapi data kalender terlebih dahulu' : 'Ekspor Kalender (.docx)'}
              className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                isCalendarConfigComplete
                  ? 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
                  : 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed'
              }`}
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>{isExporting === 'kalender' ? 'Mengekspor...' : 'Ekspor Kalender (.docx)'}</span>
            </button>
            <button
              id="btn-export-alokasi"
              type="button"
              onClick={handleExportAlokasi}
              disabled={isExporting === 'alokasi' || !isCalendarConfigComplete}
              title={!isCalendarConfigComplete ? 'Lengkapi data kalender terlebih dahulu' : 'Ekspor Alokasi Waktu (.docx)'}
              className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                isCalendarConfigComplete
                  ? 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
                  : 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed'
              }`}
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>{isExporting === 'alokasi' ? 'Mengekspor...' : 'Ekspor Alokasi Waktu (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* 4-STEP WORKFLOW STEPPER BAR */}
        <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl" id="calendar-workflow-stepper">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Status Alur Kalender:
            </span>
            <div className="flex items-center gap-2">
              {workflowStatus === 'CONFIRMED' && (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Kalender Terkonfirmasi &amp; Sah
                </span>
              )}
              {workflowStatus === 'MANUAL_OVERRIDE' && (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  Override Satuan Pendidikan Aktif
                </span>
              )}
              {workflowStatus === 'AUTO_RESOLVED' && (
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                  Auto-Resolved (Sumber Resmi Daerah)
                </span>
              )}
              {workflowStatus === 'UNRESOLVED' && (
                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Belum Ditetapkan (Pilih Wilayah)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            {/* Step 1: Auto Resolve */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                workflowStatus === 'AUTO_RESOLVED' || workflowStatus === 'MANUAL_OVERRIDE' || workflowStatus === 'CONFIRMED'
                  ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>AUTO RESOLVE</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Pencocokan otomatis Kaldik Provinsi &amp; Libur SKB 3 Menteri
              </p>
            </div>

            {/* Step 2: Review */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                isCalendarConfigComplete
                  ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>REVIEW</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Verifikasi {effectiveWeeks ?? '-'} pekan efektif &amp; {effectiveResult.effectiveLearningDays ?? '-'} hari efektif
              </p>
            </div>

            {/* Step 3: Manual Override */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                isOverridden
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white inline-flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>MANUAL OVERRIDE</span>
              </div>
              <p className="text-[11px] text-slate-600">
                {isOverridden ? 'Penyesuaian sekolah diterapkan' : 'Opsional: atur jadwal lokal sekolah'}
              </p>
            </div>

            {/* Step 4: Confirm */}
            <div
              className={`p-3 rounded-lg border transition-all ${
                workflowStatus === 'CONFIRMED'
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>CONFIRM</span>
              </div>
              <p className="text-[11px] text-slate-600">
                {workflowStatus === 'CONFIRMED' ? 'Telah dikonfirmasi' : 'Kunci penetapan kalender semester'}
              </p>
            </div>
          </div>
        </div>

        {/* PROVENANCE & RESOLUTION TOOLBAR */}
        <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-indigo-950">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-800">Sumber Kaldik Wilayah:</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-[11px]">
                  {sourceAuthority || `Provinsi ${selectedProvince}`}
                </span>
                {sourceDocumentNumber && (
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[10px]">
                    {sourceDocumentNumber}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px]">
                  Overlay SKB 3 Menteri
                </span>
              </div>
              <p className="text-slate-600 text-[11px]">
                {resolutionMessage || `Kalender tersinkronisasi berdasarkan wilayah sekolah (${selectedProvince}) dan tahun ajaran (${academicYear}).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOverridden && (
              <button
                type="button"
                onClick={handleResetToOfficial}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-medium text-xs shadow-2xs transition-colors"
                title="Kembalikan ke Kalender Pendidikan Resmi Daerah"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Kembalikan ke Resmi</span>
              </button>
            )}

            <button
              id="btn-re-resolve-calendar"
              type="button"
              onClick={() => handleAutoResolve(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-2xs transition-colors"
              title="Jalankan Ulang Resolusi Otomatis"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resolusi Otomatis</span>
            </button>

            {workflowStatus !== 'CONFIRMED' && (
              <button
                id="btn-confirm-calendar-workflow"
                type="button"
                onClick={handleConfirmCalendar}
                disabled={!isCalendarConfigComplete}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-2xs transition-colors ${
                  isCalendarConfigComplete
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Konfirmasi Kalender</span>
              </button>
            )}
          </div>
        </div>

        {/* ONLINE DISCOVERY BANNER (PARTIAL SOURCE - READ ONLY) */}
        {onlineDiscovery && resolutionStatus !== 'RESOLVED' && (
          <div
            id="online-calendar-discovery-card"
            className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-950"
          >
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-amber-900">
                  Sumber resmi ditemukan online — perlu verifikasi
                </span>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-semibold text-[10px]">
                  {onlineDiscovery.sourceLevel}
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px]">
                  STATUS: {onlineDiscovery.verificationStatus}
                </span>
              </div>
              <div className="text-slate-700 text-[11px] space-y-0.5">
                <p>
                  <strong>Otoritas:</strong> {onlineDiscovery.authority}
                </p>
                <p>
                  <strong>Dokumen:</strong> {onlineDiscovery.documentTitle}
                  {onlineDiscovery.documentNumber ? ` (${onlineDiscovery.documentNumber})` : ''}
                </p>
                <p className="flex items-center gap-1">
                  <strong>Sumber Resmi:</strong>{' '}
                  <a
                    href={onlineDiscovery.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 underline font-mono inline-flex items-center gap-1 hover:text-indigo-900"
                  >
                    {onlineDiscovery.sourceUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        {isOnlineSearching && (
          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2 text-xs text-indigo-800 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Mencari sumber kalender pendidikan resmi secara online...</span>
          </div>
        )}

        {onlineSearchError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{onlineSearchError}</span>
          </div>
        )}

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-500 block">Minggu Efektif Semester</span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block">
              {effectiveWeeks !== null ? `${effectiveWeeks} Pekan` : '-'}
            </span>
            <span className="text-xs text-slate-500">
              {effectiveResult.status === 'RESOLVED'
                ? `${effectiveResult.effectiveLearningDays} hari efektif (${effectiveResult.holidayDays} hari libur)`
                : 'Kalender belum dikonfigurasi'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-500 block">Total JP Efektif Tersedia</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">
              {totalAvailableJP !== null ? `${totalAvailableJP} JP` : '-'}
            </span>
            <span className="text-[11px] text-indigo-600/80 font-medium">
              {effectiveWeeks !== null && jpPerWeek !== null
                ? `${effectiveWeeks} pekan × ${jpPerWeek} JP/pekan`
                : 'Menunggu kelengkapan data'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-500 block">
              {isK13Curriculum ? 'Total Jam Materi (KD)' : 'Total Jam Materi (ATP)'}
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{totalPlannedJP} JP</span>
            <span className="text-xs text-slate-500">
              {isK13Curriculum
                ? `Dari ${k13Analysis?.items?.length || 0} KD K13`
                : `Dari ${atp?.items?.length || 0} Tujuan Pembelajaran`}
            </span>
          </div>

          <div
            className={`border rounded-xl p-4 ${
              jpDifference === null
                ? 'bg-slate-50 border-slate-200'
                : jpDifference < 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <span className="text-xs font-medium text-slate-600 block">Analisis Selisih Jam</span>
            <span
              className={`text-xl font-bold mt-1 block ${
                jpDifference === null
                  ? 'text-slate-500'
                  : jpDifference < 0
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {jpDifference === null
                ? 'Belum Dihitung'
                : jpDifference === 0
                ? 'Tepat Sesuai (0 JP)'
                : jpDifference > 0
                ? `+${jpDifference} JP Fleksibel`
                : `${jpDifference} JP Defisit`}
            </span>
            <span className="text-xs text-slate-500">
              {jpDifference === null
                ? 'Lengkapi konfigurasi kalender & JP'
                : jpDifference === 0
                ? 'Alokasi waktu pas dan terdistribusi'
                : jpDifference > 0
                ? 'Tersedia jam untuk penguatan / cadangan'
                : 'Jam materi melebihi waktu efektif'}
            </span>
          </div>
        </div>

        {/* Detailed Explanation / Warning if discrepancy exists */}
        {jpDifference !== null && jpDifference < 0 && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950">Perhatian Alokasi Waktu: </span>
              Total Jam Pelajaran pada rancangan materi ({totalPlannedJP} JP) melebihi ketersediaan Jam
              Pembelajaran Efektif ({totalAvailableJP} JP) sebanyak {Math.abs(jpDifference)} JP. Saran:
              Rampingkan alokasi waktu per unit materi atau sesuaikan perkiraan pekan efektif pada
              kalender.
            </div>
          </div>
        )}

        {jpDifference !== null && jpDifference > 0 && (
          <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 text-xs">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-950">
                Optimalisasi Selisih Waktu (+{jpDifference} JP):{' '}
              </span>
              Sisa jam efektif ini dapat dialokasikan untuk: (1) Asesmen Sumatif Akhir Semester, (2)
              Kegiatan Remedial &amp; Pengayaan terstruktur, (3) Penguatan Proyek/P5, atau (4) Cadangan
              waktu fleksibilitas agenda sekolah.
            </div>
          </div>
        )}
      </div>

      {/* Grid: Calendar Configuration & Days List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration & Resolution Parameters */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">Konfigurasi Kalender &amp; Wilayah</h3>
            </div>
            {isOverridden && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                Manual Override
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Region & Academic Year Selector */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block">Parameter Resolusi Wilayah:</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Provinsi Sekolah</label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => {
                      setSelectedProvince(e.target.value);
                    }}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
                  >
                    {availableProvinces.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Tahun Ajaran</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Semester <span className="text-rose-500">*</span>
                </label>
                <select
                  value={semester ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newSem = val === '1' || val === '2' ? val : null;
                    setSemester(newSem);
                  }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium ${
                    !semester ? 'border-amber-400 bg-amber-50/40 text-slate-700' : 'border-slate-300'
                  }`}
                >
                  <option value="">-- Pilih Semester --</option>
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hari Sekolah / Pekan</label>
                <select
                  value={schoolDaysPerWeek ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSchoolDaysPerWeek(val);
                    handleApplyOverride({ schoolDaysPerWeek: val });
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                >
                  <option value="">-- Pilih Hari Kerja --</option>
                  <option value={5}>5 Hari (Senin - Jumat)</option>
                  <option value={6}>6 Hari (Senin - Sabtu)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Mulai Semester</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    handleApplyOverride({ startDate: e.target.value });
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Akhir Semester</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    handleApplyOverride({ endDate: e.target.value });
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">JP Intrakurikuler / Pekan</label>
                {officialRule.isOfficial && officialRule.weeklyJP !== null && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    Resmi Kurikulum: {officialRule.weeklyJP} JP
                  </span>
                )}
              </div>
              <input
                type="number"
                min={1}
                max={20}
                value={jpPerWeek ?? ''}
                placeholder="Masukkan JP"
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setJpPerWeek(val);
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-indigo-900"
              />
            </div>

            {/* Monthly Breakdown Preview */}
            {effectiveResult?.monthlyBreakdown && effectiveResult.monthlyBreakdown.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Rincian Hari Efektif Bulanan (Review):
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {effectiveResult.monthlyBreakdown.map((m) => (
                    <div key={m.monthName} className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="font-semibold text-slate-800">{m.monthName}</div>
                      <div className="text-slate-500 text-[10px]">
                        {m.effectiveDays} HE / {m.effectiveWeeks} ME
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              id="btn-save-calendar-config"
              type="button"
              onClick={() => handleApplyOverride()}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Simpan &amp; Terapkan Kalender</span>
            </button>
          </div>
        </div>

        {/* Right: Days & Special Events Manager (Manual Override & Provenance) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-base">Agenda Libur, Ujian, &amp; Penyesuaian Sekolah</h3>
                <p className="text-xs text-slate-500">
                  Kaldik Daerah + Overlay Libur SKB 3 Menteri + Override Satuan Pendidikan
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium">{days.length} entri tercatat</span>
          </div>

          {/* Add Day Input (Manual Override) */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 space-y-2">
            <span className="text-xs font-semibold text-slate-700 block">
              Tambah Penyesuaian Tanggal Libur / Agenda Sekolah:
            </span>
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
                placeholder="Keterangan (cth: PTS / Libur Khusus Sekolah)"
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
          <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Jenis</th>
                  <th className="py-2 px-3">Keterangan</th>
                  <th className="py-2 px-3">Sumber</th>
                  <th className="py-2 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Belum ada tanggal libur atau agenda khusus ditambahkan. Klik <em>Resolusi Otomatis</em> di atas untuk mengisi kalender resmi.
                    </td>
                  </tr>
                ) : (
                  days.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">{d.date}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            d.status === 'holiday'
                              ? 'bg-rose-100 text-rose-700'
                              : d.status === 'schoolEvent'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {d.status === 'holiday'
                            ? 'Libur'
                            : d.status === 'schoolEvent'
                            ? 'Kegiatan'
                            : 'Efektif'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium">{d.notes || '-'}</td>
                      <td className="py-2 px-3 text-[10px] text-slate-500 whitespace-nowrap">
                        {d.sourceType === 'NATIONAL_HOLIDAY_OVERLAY' ? (
                          <span className="text-blue-600 font-medium">SKB 3 Menteri</span>
                        ) : d.sourceType === 'SCHOOL_OVERRIDE' || d.isOverridden ? (
                          <span className="text-amber-700 font-medium">Sekolah (Override)</span>
                        ) : (
                          <span className="text-indigo-600 font-medium">Kaldik Disdik</span>
                        )}
                      </td>
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
                Distribusikan urutan pekan mengajar efektif (
                {effectiveWeeks !== null ? `${effectiveWeeks} pekan` : 'belum ditentukan'}) untuk setiap
                unit materi
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
              <p className="text-xs text-slate-400 mt-1">
                Silakan susun Analisis KD K13 terlebih dahulu agar materi otomatis terhubung di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3 w-28">Kompetensi Dasar (KD)</th>
                    <th className="py-2.5 px-3">Indikator &amp; Ruang Lingkup Materi</th>
                    <th className="py-2.5 px-3 w-24 text-center">Alokasi JP</th>
                    <th className="py-2.5 px-3 w-40 text-center">Penempatan Pekan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {k13Analysis.items.map((item, index) => {
                    const matchedAlloc = allocations.find(
                      (a) =>
                        (a.sourceType === 'KD' && a.sourceId === item.id) ||
                        a.sourceId === item.id ||
                        a.atpItemId === item.id ||
                        a.tpId === item.id
                    );
                    const defaultWeek = effectiveWeeks
                      ? Math.min(effectiveWeeks, index + 1)
                      : index + 1;
                    const currentWeek = matchedAlloc?.weekNumber || defaultWeek;
                    const displayJP =
                      matchedAlloc?.allocatedJP ??
                      matchedAlloc?.jp ??
                      (item.alokasiJp ? Number(item.alokasiJp) : null);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center font-medium text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-700">{item.kd}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">
                            {item.indikator || item.materi}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Materi Pokok: {item.materi || '-'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                          {displayJP !== null ? `${displayJP} JP` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <select
                            value={currentWeek}
                            onChange={(e) => handleWeekChange(item.id, Number(e.target.value))}
                            className="text-xs px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            {effectiveWeeks && effectiveWeeks > 0 ? (
                              Array.from({ length: effectiveWeeks }, (_, i) => i + 1).map((w) => (
                                <option key={w} value={w}>
                                  Pekan ke-{w}
                                </option>
                              ))
                            ) : (
                              <option value={currentWeek}>Pekan ke-{currentWeek}</option>
                            )}
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
              <p className="text-sm">
                Belum ada Alur Tujuan Pembelajaran (ATP) yang dibuat pada Step 05.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Silakan susun ATP terlebih dahulu agar materi otomatis terhubung di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3 w-28">Kode TP</th>
                    <th className="py-2.5 px-3">Tujuan Pembelajaran &amp; Ruang Lingkup Materi</th>
                    <th className="py-2.5 px-3 w-24 text-center">Beban JP</th>
                    <th className="py-2.5 px-3 w-40 text-center">Penempatan Pekan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(atp.items || []).map((item, index) => {
                    const matchedAlloc = allocations.find(
                      (a) =>
                        (a.sourceType === 'ATP_ITEM' && a.sourceId === item.id) ||
                        a.atpItemId === item.id ||
                        a.sourceId === item.id ||
                        a.tpId === item.tpId
                    );
                    const defaultWeek = effectiveWeeks
                      ? Math.min(effectiveWeeks, index + 1)
                      : index + 1;
                    const currentWeek = matchedAlloc?.weekNumber || defaultWeek;
                    const displayJP =
                      item.jp !== undefined && item.jp !== null
                        ? Number(item.jp)
                        : matchedAlloc?.allocatedJP ?? matchedAlloc?.jp ?? null;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center font-medium text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-700">
                          {item.tpCode || `TP.${index + 1}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">
                            {item.tpStatement || item.competency}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Lingkup Materi: {item.contentScope || item.subMaterial || '-'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                          {displayJP !== null ? `${displayJP} JP` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <select
                            value={currentWeek}
                            onChange={(e) => handleWeekChange(item.id, Number(e.target.value))}
                            className="text-xs px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            {effectiveWeeks && effectiveWeeks > 0 ? (
                              Array.from({ length: effectiveWeeks }, (_, i) => i + 1).map((w) => (
                                <option key={w} value={w}>
                                  Pekan ke-{w}
                                </option>
                              ))
                            ) : (
                              <option value={currentWeek}>Pekan ke-{currentWeek}</option>
                            )}
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
