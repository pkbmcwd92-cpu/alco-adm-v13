import {
  CurriculumType,
  CurriculumStructureRule,
  MasterCurriculumStructure,
  SubjectJPQuery,
  SubjectJPResult,
  TeachingAssignment,
  AdditionalDuty,
  TeacherLoadValidationResult,
  EffectiveDayResult,
  AvailableJPResult,
  TimeAllocationValidationResult,
  TimeAllocationStatus,
  LearningTimeAllocation,
  TimeAllocation,
  AcademicCalendar,
  CalendarDay,
  EffectiveWeekInfo,
  CanonicalDayStatus,
  CalendarCompletenessResult,
} from '../types';
import {
  calculateTeacherWorkload,
  PREDEFINED_ADDITIONAL_DUTIES,
} from './teacherWorkloadEngine';
import {
  ALL_CURRICULUM_STRUCTURE_RULES,
  resolveCurriculumContext,
  findSubjectByCode,
  getRegulationSources,
} from '../data/curriculum';

export { calculateTeacherWorkload, PREDEFINED_ADDITIONAL_DUTIES };

/**
 * MASTER STRUKTUR KURIKULUM RESMI PEMERINTAH (KEMENDIKDASMEN / KEMENAG)
 * Didelegasikan ke Master Regulasi Terpusat di src/data/curriculum/
 * Menyediakan kompatibilitas penuh dengan CurriculumStructureRule[]
 */
export const MASTER_CURRICULUM_STRUCTURE: CurriculumStructureRule[] = ALL_CURRICULUM_STRUCTURE_RULES.map((rule) => {
  const subj = findSubjectByCode(rule.subjectCode);
  const regs = getRegulationSources(rule.regulationIds);
  const mainReg = regs[0];
  return {
    id: rule.id,
    curriculum: rule.curriculumType === 'K13' ? 'Kurikulum 2013' : 'Kurikulum Merdeka',
    curriculumType: rule.curriculumType,
    regulation: mainReg?.title || 'Regulasi Kemendikdasmen',
    regulationYear: mainReg?.year || 2024,
    level: rule.level,
    phase: rule.phase ? `Fase ${rule.phase}` : undefined,
    grade: `Kelas ${rule.grade}`,
    subject: subj?.name || rule.subjectCode,
    intrakurikulerWeeklyJP: rule.derivedWeeklyJP,
    intrakurikulerAnnualJP: rule.intrakurikulerAnnualJP,
    kokurikulerAnnualJP: rule.kokurikulerAnnualJP,
    totalAnnualJP: rule.totalAnnualJP,
    weeklyJP: rule.derivedWeeklyJP,
    annualJP: rule.intrakurikulerAnnualJP,
    kokurikulerJP: rule.kokurikulerAnnualJP,
    source: mainReg?.authority || 'Kemendikdasmen RI',
    sourceUrl: mainReg?.sourceUrl,
    effectiveFrom: rule.effectiveFrom,
    verificationStatus: rule.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
    notes: rule.notes,
  };
});

/**
 * Normalisasi string teks untuk perbandingan fuzzy yang aman
 */
function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[(),.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lookup JP Mata Pelajaran dari Master Struktur Kurikulum Resmi Pemerintah
 * Terkoneksi langsung ke Single Entry Point Resolver: resolveCurriculumContext
 */
export function getSubjectJP(query: SubjectJPQuery): SubjectJPResult {
  const normCurriculum = normalizeText(query.curriculum);
  const resolvedCurriculumType: CurriculumType =
    query.curriculumType ||
    (normCurriculum.includes('k13') || normCurriculum.includes('2013')
      ? 'K13'
      : 'KURIKULUM_MERDEKA');

  // Parse nomor kelas jika tersedia (e.g. "Kelas 4" -> 4, "4" -> 4)
  const gradeNum = parseInt((query.grade || '').replace(/[^0-9]/g, ''), 10);

  // 1. Delegasi ke Central Resolver jika nomor kelas terdeteksi
  if (!isNaN(gradeNum) && gradeNum > 0 && query.subject) {
    const resolvedContext = resolveCurriculumContext({
      curriculumType: resolvedCurriculumType,
      grade: gradeNum,
      subjectInput: query.subject,
    });

    if (resolvedContext && resolvedContext.rule) {
      const { rule, regulationSources } = resolvedContext;
      const mainReg = regulationSources[0];
      const matchedLegacyRule = MASTER_CURRICULUM_STRUCTURE.find((r) => r.id === rule.id);

      return {
        weeklyJP: rule.derivedWeeklyJP,
        intrakurikulerWeeklyJP: rule.derivedWeeklyJP,
        intrakurikulerAnnualJP: rule.intrakurikulerAnnualJP ?? undefined,
        kokurikulerAnnualJP: rule.kokurikulerAnnualJP ?? undefined,
        totalAnnualJP: rule.totalAnnualJP ?? undefined,
        annualJP: rule.intrakurikulerAnnualJP ?? undefined,
        kokurikulerJP: rule.kokurikulerAnnualJP ?? undefined,
        isOfficial: rule.verificationStatus === 'VERIFIED',
        verificationStatus: rule.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
        statusLabel: rule.verificationStatus === 'VERIFIED' ? 'Terverifikasi Resmi' : 'Belum diverifikasi',
        sourceType: 'OFFICIAL',
        regulation: mainReg?.title || 'Permendikbudristek No. 12 Tahun 2024',
        regulationYear: mainReg?.year || 2024,
        source: mainReg?.authority || 'BSKAP Kemendikdasmen RI',
        sourceUrl: mainReg?.sourceUrl,
        effectiveFrom: rule.effectiveFrom,
        curriculumType: rule.curriculumType,
        matchedRule: matchedLegacyRule,
        explanation: `Alokasi intrakurikuler resmi: ${rule.derivedWeeklyJP} JP/minggu (${rule.intrakurikulerAnnualJP} JP/tahun${rule.kokurikulerAnnualJP ? `, Kokurikuler/P5: ${rule.kokurikulerAnnualJP} JP/tahun` : ''}) berdasarkan ${mainReg?.title || 'Regulasi Resmi'}.`,
      };
    }
  }

  // 2. Fallback fuzzy search pada MASTER_CURRICULUM_STRUCTURE jika query tanpa kelas spesifik
  const normSubject = normalizeText(query.subject);
  const normGrade = normalizeText(query.grade);
  const normLevel = normalizeText(query.level);

  const candidates = MASTER_CURRICULUM_STRUCTURE.filter(
    (rule) => rule.curriculumType === resolvedCurriculumType
  );

  let matchedRule = candidates.find((rule) => {
    const rSubject = normalizeText(rule.subject);
    const rGrade = normalizeText(rule.grade);
    const rLevel = normalizeText(rule.level);

    const subjectMatch =
      rSubject === normSubject ||
      normSubject.includes(rSubject) ||
      rSubject.includes(normSubject) ||
      (normSubject.includes('pjok') && rSubject.includes('jasmani')) ||
      (normSubject.includes('pancasila') && rSubject.includes('pancasila')) ||
      (normSubject.includes('agama') && rSubject.includes('agama')) ||
      (normSubject.includes('matematika') && rSubject.includes('matematika')) ||
      (normSubject.includes('bahasa indonesia') && rSubject.includes('bahasa indonesia')) ||
      (normSubject.includes('ipas') && rSubject.includes('ipas'));

    const gradeMatch = !normGrade || rGrade === normGrade || normGrade.includes(rGrade) || rGrade.includes(normGrade);
    const levelMatch = !normLevel || rLevel === normLevel;

    return subjectMatch && gradeMatch && levelMatch;
  });

  if (!matchedRule) {
    matchedRule = candidates.find((rule) => {
      const rSubject = normalizeText(rule.subject);
      const rLevel = normalizeText(rule.level);

      const subjectMatch =
        rSubject === normSubject ||
        normSubject.includes(rSubject) ||
        rSubject.includes(normSubject) ||
        (normSubject.includes('pjok') && rSubject.includes('jasmani')) ||
        (normSubject.includes('pancasila') && rSubject.includes('pancasila')) ||
        (normSubject.includes('matematika') && rSubject.includes('matematika')) ||
        (normSubject.includes('bahasa indonesia') && rSubject.includes('bahasa indonesia'));

      const levelMatch = !normLevel || rLevel === normLevel;
      return subjectMatch && levelMatch;
    });
  }

  if (matchedRule && matchedRule.verificationStatus === 'VERIFIED') {
    const weeklyJP = matchedRule.intrakurikulerWeeklyJP ?? matchedRule.weeklyJP ?? null;
    const annualJP = matchedRule.intrakurikulerAnnualJP ?? matchedRule.annualJP;
    const kokurikulerJP = matchedRule.kokurikulerAnnualJP ?? matchedRule.kokurikulerJP;
    const totalAnnualJP = matchedRule.totalAnnualJP;

    return {
      weeklyJP,
      intrakurikulerWeeklyJP: weeklyJP,
      intrakurikulerAnnualJP: annualJP,
      kokurikulerAnnualJP: kokurikulerJP,
      totalAnnualJP,
      annualJP,
      kokurikulerJP,
      isOfficial: true,
      verificationStatus: 'VERIFIED',
      statusLabel: 'Terverifikasi Resmi',
      sourceType: 'OFFICIAL',
      regulation: matchedRule.regulation,
      regulationYear: matchedRule.regulationYear,
      source: matchedRule.source,
      sourceUrl: matchedRule.sourceUrl,
      effectiveFrom: matchedRule.effectiveFrom,
      curriculumType: matchedRule.curriculumType,
      matchedRule,
      explanation: `Alokasi intrakurikuler resmi: ${weeklyJP ?? '-'} JP/minggu (${annualJP ? `${annualJP} JP/tahun` : ''}${kokurikulerJP ? `, Kokurikuler/P5: ${kokurikulerJP} JP/tahun` : ''}) berdasarkan ${matchedRule.regulation}.`,
    };
  }

  // 3. JANGAN MENGARANG: Mapel tidak ditemukan dalam master resmi
  return {
    weeklyJP: null,
    intrakurikulerWeeklyJP: null,
    isOfficial: false,
    verificationStatus: 'UNVERIFIED',
    statusLabel: 'Belum diverifikasi',
    sourceType: 'UNVERIFIED',
    source: 'Struktur Kurikulum Belum Diverifikasi',
    curriculumType: resolvedCurriculumType,
    explanation: `Mata pelajaran "${query.subject || 'Mapel'}" pada ${query.level || ''} ${query.grade || ''} belum terdaftar dalam struktur regulasi baku. Silakan tetapkan JP intrakurikuler secara manual.`,
  };
}

/**
 * Normalisasi Status Hari Kalender ke Status Kanonikal
 * Memetakan input legacy/raw ke CanonicalDayStatus
 */
export function normalizeCalendarDayStatus(status?: string): CanonicalDayStatus {
  if (!status) return 'UNKNOWN';
  const clean = status.trim().toUpperCase();
  if (
    clean === 'EFFECTIVE' ||
    clean === 'EFEKTIF' ||
    clean === 'EFFECTIVE_LEARNING'
  ) {
    return 'EFFECTIVE_LEARNING';
  }
  if (clean === 'HOLIDAY' || clean === 'LIBUR') {
    return 'HOLIDAY';
  }
  if (
    clean === 'SCHOOLEVENT' ||
    clean === 'SCHOOL_EVENT' ||
    clean === 'KEGIATAN_SEKOLAH'
  ) {
    return 'SCHOOL_EVENT';
  }
  if (clean === 'ASSESSMENT' || clean === 'ASESMEN') {
    return 'ASSESSMENT';
  }
  if (clean === 'BREAK' || clean === 'JEDA_SEMESTER' || clean === 'JEDA') {
    return 'BREAK';
  }
  if (
    clean === 'NONLEARNING' ||
    clean === 'NON_LEARNING' ||
    clean === 'NON_EFEKTIF' ||
    clean === 'WEEKEND' ||
    clean === 'OTHER'
  ) {
    return 'NON_LEARNING';
  }
  return 'UNKNOWN';
}

/**
 * Validasi Kelengkapan Kalender Akademik
 * Memeriksa apakah setiap hari sekolah terjadwal memiliki catatan status definitif
 */
export function validateCalendarCompleteness(
  calendar: Partial<AcademicCalendar> & {
    startDate?: string;
    endDate?: string;
    schoolDaysPerWeek?: number;
    calendarDays?: CalendarDay[];
  },
  calendarDaysParam?: CalendarDay[]
): CalendarCompletenessResult {
  const schoolDaysPerWeek =
    calendar.schoolDaysPerWeek === 5 || calendar.schoolDaysPerWeek === 6
      ? calendar.schoolDaysPerWeek
      : null;

  const calendarDays =
    calendarDaysParam && calendarDaysParam.length > 0
      ? calendarDaysParam
      : calendar.calendarDays || [];

  const startDateStr = calendar.startDate || calendarDays[0]?.date;
  const endDateStr = calendar.endDate || calendarDays[calendarDays.length - 1]?.date;

  if (!schoolDaysPerWeek || !startDateStr || !endDateStr) {
    return {
      complete: false,
      missingScheduledDates: [],
      totalScheduledDays: 0,
      recordedScheduledDays: 0,
      diagnostic: 'Konfigurasi kalender (tanggal mulai/selesai atau hari sekolah) belum lengkap.',
    };
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return {
      complete: false,
      missingScheduledDates: [],
      totalScheduledDays: 0,
      recordedScheduledDays: 0,
      diagnostic: 'Rentang tanggal kalender tidak valid.',
    };
  }

  const dayMap = new Map<string, CalendarDay>();
  for (const day of calendarDays) {
    if (day.date) {
      dayMap.set(day.date, day);
    }
  }

  let totalScheduledDays = 0;
  let recordedScheduledDays = 0;
  const missingScheduledDates: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isScheduledSchoolDay =
      schoolDaysPerWeek === 6
        ? dayOfWeek >= 1 && dayOfWeek <= 6
        : dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isScheduledSchoolDay) {
      totalScheduledDays++;
      const dateStr = current.toISOString().slice(0, 10);
      const dayRecord = dayMap.get(dateStr);
      if (dayRecord && normalizeCalendarDayStatus(dayRecord.status) !== 'UNKNOWN') {
        recordedScheduledDays++;
      } else {
        missingScheduledDates.push(dateStr);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const complete = missingScheduledDates.length === 0;
  const diagnostic = complete
    ? 'Kalender lengkap untuk seluruh hari sekolah terjadwal.'
    : `Terdapat ${missingScheduledDates.length} hari sekolah terjadwal tanpa status terdefinisi (UNKNOWN).`;

  return {
    complete,
    missingScheduledDates,
    totalScheduledDays,
    recordedScheduledDays,
    diagnostic,
  };
}

export function calculateEffectiveDays(
  calendar: Partial<AcademicCalendar> & {
    startDate?: string;
    endDate?: string;
    schoolDaysPerWeek?: number;
    calendarDays?: CalendarDay[];
  },
  calendarDaysParam?: CalendarDay[]
): EffectiveDayResult {
  const schoolDaysPerWeek =
    calendar.schoolDaysPerWeek === 5 || calendar.schoolDaysPerWeek === 6
      ? calendar.schoolDaysPerWeek
      : null;

  const holidays: Array<{ date: string; notes?: string }> = [];
  const events: Array<{ date: string; notes?: string }> = [];
  const assessments: Array<{ date: string; notes?: string }> = [];
  const nonLearning: Array<{ date: string; notes?: string }> = [];
  const unknown: Array<{ date: string; notes?: string }> = [];

  const emptyResult = (status: 'RESOLVED' | 'UNRESOLVED' | 'PARTIAL' = 'UNRESOLVED'): EffectiveDayResult => ({
    status,
    totalCalendarDays: 0,
    scheduledSchoolDays: 0,
    effectiveLearningDays: 0,
    holidayDays: 0,
    schoolEventDays: 0,
    assessmentDays: 0,
    nonLearningDays: 0,
    unknownDays: 0,
    breakdown: { holidays, events, assessments, nonLearning, unknown },
    monthlyBreakdown: [],
  });

  // Jangan berasumsi 5 hari sekolah jika data tidak diatur
  if (!schoolDaysPerWeek) {
    return emptyResult('UNRESOLVED');
  }

  const calendarDays =
    calendarDaysParam && calendarDaysParam.length > 0
      ? calendarDaysParam
      : (calendar.calendarDays || []);

  const startDateStr = calendar.startDate || calendarDays[0]?.date;
  const endDateStr = calendar.endDate || calendarDays[calendarDays.length - 1]?.date;

  if (!startDateStr || !endDateStr) {
    return emptyResult('UNRESOLVED');
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return emptyResult('UNRESOLVED');
  }

  const completeness = validateCalendarCompleteness(calendar, calendarDaysParam);

  // Map agenda hari yang ditandai khusus
  const dayMap = new Map<string, CalendarDay>();
  for (const day of calendarDays) {
    if (day.date) {
      dayMap.set(day.date, day);
    }
  }

  let totalCalendarDays = 0;
  let scheduledSchoolDays = 0;
  let effectiveLearningDays = 0;
  let holidayDays = 0;
  let schoolEventDays = 0;
  let assessmentDays = 0;
  let nonLearningDays = 0;
  let unknownDays = 0;

  const monthMap = new Map<string, { monthName: string; effectiveDays: number }>();
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const recordEffectiveDay = (d: Date) => {
    effectiveLearningDays++;
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mName = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const cur = monthMap.get(mKey) || { monthName: mName, effectiveDays: 0 };
    cur.effectiveDays++;
    monthMap.set(mKey, cur);
  };

  const current = new Date(start);
  while (current <= end) {
    totalCalendarDays++;
    const dayOfWeek = current.getDay(); // 0: Sunday, 1: Mon, ..., 6: Sat

    // Cek apakah hari sekolah terjadwal
    // 5 hari kerja: Senin (1) s.d. Jumat (5)
    // 6 hari kerja: Senin (1) s.d. Sabtu (6)
    const isScheduledSchoolDay =
      schoolDaysPerWeek === 6
        ? dayOfWeek >= 1 && dayOfWeek <= 6
        : dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isScheduledSchoolDay) {
      scheduledSchoolDays++;
      const dateStr = current.toISOString().slice(0, 10);
      const specialDay = dayMap.get(dateStr);
      const canonicalStatus = specialDay
        ? normalizeCalendarDayStatus(specialDay.status)
        : 'UNKNOWN';

      switch (canonicalStatus) {
        case 'EFFECTIVE_LEARNING':
          recordEffectiveDay(current);
          break;
        case 'HOLIDAY':
          holidayDays++;
          holidays.push({ date: dateStr, notes: specialDay?.notes });
          break;
        case 'SCHOOL_EVENT':
          schoolEventDays++;
          events.push({ date: dateStr, notes: specialDay?.notes });
          break;
        case 'ASSESSMENT':
          assessmentDays++;
          assessments.push({ date: dateStr, notes: specialDay?.notes });
          break;
        case 'BREAK':
        case 'NON_LEARNING':
          nonLearningDays++;
          nonLearning.push({ date: dateStr, notes: specialDay?.notes });
          break;
        case 'UNKNOWN':
        default:
          // Hari sekolah terjadwal tanpa status definitif tidak dianggap hari efektif
          unknownDays++;
          unknown.push({
            date: dateStr,
            notes: specialDay?.notes || 'Data status kalender tidak tersedia (UNKNOWN)',
          });
          break;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  const monthlyBreakdown = Array.from(monthMap.values()).map((m) => ({
    monthName: m.monthName,
    effectiveDays: m.effectiveDays,
    effectiveWeeks: Math.max(0, Math.round(m.effectiveDays / schoolDaysPerWeek)),
  }));

  const status: 'RESOLVED' | 'PARTIAL' = unknownDays > 0 ? 'PARTIAL' : 'RESOLVED';

  return {
    status,
    totalCalendarDays,
    scheduledSchoolDays,
    effectiveLearningDays,
    holidayDays,
    schoolEventDays,
    assessmentDays,
    nonLearningDays,
    unknownDays,
    completeness,
    breakdown: {
      holidays,
      events,
      assessments,
      nonLearning,
      unknown,
    },
    monthlyBreakdown,
  };
}

/**
 * Mengelompokkan hari-hari efektif pembelajaran berdasarkan minggu kalender
 * untuk mendapatkan urutan Minggu Efektif Aktual beserta tanggal dan bulan resminya.
 */
export function getEffectiveWeeksList(
  calendar: Partial<AcademicCalendar> & {
    startDate?: string;
    endDate?: string;
    schoolDaysPerWeek?: number;
    calendarDays?: CalendarDay[];
  },
  calendarDaysParam?: CalendarDay[]
): EffectiveWeekInfo[] {
  const schoolDaysPerWeek =
    calendar?.schoolDaysPerWeek === 5 || calendar?.schoolDaysPerWeek === 6
      ? calendar.schoolDaysPerWeek
      : null;

  if (!schoolDaysPerWeek) return [];

  const calendarDays =
    calendarDaysParam && calendarDaysParam.length > 0
      ? calendarDaysParam
      : (calendar?.calendarDays || []);

  if (!calendarDays || calendarDays.length === 0) {
    return [];
  }

  const startDateStr = calendar?.startDate || calendarDays[0]?.date;
  const endDateStr = calendar?.endDate || calendarDays[calendarDays.length - 1]?.date;

  if (!startDateStr || !endDateStr) return [];

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const dayMap = new Map<string, CalendarDay>();
  for (const day of calendarDays) {
    if (day?.date) {
      dayMap.set(day.date, day);
    }
  }

  // Group effective days into calendar weeks (Monday to Sunday)
  const weekMap = new Map<string, string[]>();
  const weekOrder: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0: Sun, 1: Mon...
    const isScheduledSchoolDay =
      schoolDaysPerWeek === 6
        ? dayOfWeek >= 1 && dayOfWeek <= 6
        : dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isScheduledSchoolDay) {
      const dateStr = current.toISOString().slice(0, 10);
      const specialDay = dayMap.get(dateStr);
      const canonicalStatus = specialDay
        ? normalizeCalendarDayStatus(specialDay.status)
        : 'UNKNOWN';

      // HANYA hari dengan status kanonikal EFFECTIVE_LEARNING yang dihitung
      if (canonicalStatus === 'EFFECTIVE_LEARNING') {
        // Monday of current date's calendar week
        const mon = new Date(current);
        const day = mon.getDay();
        const diff = mon.getDate() - day + (day === 0 ? -6 : 1);
        mon.setDate(diff);
        const mondayKey = mon.toISOString().slice(0, 10);

        if (!weekMap.has(mondayKey)) {
          weekMap.set(mondayKey, []);
          weekOrder.push(mondayKey);
        }
        weekMap.get(mondayKey)!.push(dateStr);
      }
    }

    current.setDate(current.getDate() + 1);
  }

  const effectiveWeeks: EffectiveWeekInfo[] = [];
  let effectiveWeekCounter = 1;

  for (const monKey of weekOrder) {
    const dates = weekMap.get(monKey);
    if (dates && dates.length > 0) {
      const firstDate = new Date(dates[0]);
      effectiveWeeks.push({
        weekIndex: effectiveWeekCounter++,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        effectiveDaysCount: dates.length,
        month: firstDate.getMonth() + 1, // 1 - 12
        year: firstDate.getFullYear(),
      });
    }
  }

  return effectiveWeeks;
}

/**
 * Menghitung Minggu Efektif Ekuivalen dari Hari Efektif Belajar
 * Wajib menerima schoolDaysPerWeek yang valid (5 atau 6). Jika tidak valid/undefined/null, mengembalikan status UNRESOLVED.
 */
export function calculateEffectiveWeeks(
  effectiveLearningDays: number,
  schoolDaysPerWeek?: number | null
): {
  status: 'RESOLVED' | 'UNRESOLVED';
  effectiveWeeksEquivalent: number | null;
  effectiveWeeksRounded: number | null;
  unresolvedReason?: string;
} {
  const validDays =
    schoolDaysPerWeek === 5 || schoolDaysPerWeek === 6 ? schoolDaysPerWeek : null;

  if (!validDays) {
    return {
      status: 'UNRESOLVED',
      effectiveWeeksEquivalent: null,
      effectiveWeeksRounded: null,
      unresolvedReason: 'Hari sekolah per minggu (schoolDaysPerWeek) harus bernilai 5 atau 6.',
    };
  }

  const equivalent = Math.max(0, effectiveLearningDays) / validDays;
  const rounded = Math.round(equivalent * 10) / 10;
  return {
    status: 'RESOLVED',
    effectiveWeeksEquivalent: equivalent,
    effectiveWeeksRounded: rounded,
  };
}

/**
 * Menghitung Alokasi Jam Pelajaran (JP) Tersedia dalam satu semester
 * Formula: JP Mingguan Aktual × (Hari Efektif Belajar ÷ Hari Sekolah per Minggu)
 * Wajib menerima schoolDaysPerWeek valid (5 atau 6) dan weeklyJPSource !== 'REFERENCE_EQUIVALENT'.
 */
export function calculateAvailableJP(params: {
  subjectWeeklyJP?: number | null;
  effectiveLearningDays?: number | null;
  schoolDaysPerWeek?: number | null;
  weeklyJPSource?: 'ACTUAL_SCHEDULE' | 'REFERENCE_EQUIVALENT';
  actualScheduledAnnualJP?: number | null;
  semester?: string;
  academicYear?: string;
  level?: string;
  grade?: string;
  subject?: string;
  officialAnnualJP?: number | null;
}): AvailableJPResult {
  const validDays =
    params.schoolDaysPerWeek === 5 || params.schoolDaysPerWeek === 6
      ? params.schoolDaysPerWeek
      : null;

  if (!validDays) {
    return {
      status: 'UNRESOLVED',
      subjectWeeklyJP: params.subjectWeeklyJP ?? null,
      effectiveLearningDays: params.effectiveLearningDays ?? null,
      schoolDaysPerWeek: null,
      effectiveWeeksEquivalent: null,
      effectiveWeeksRounded: null,
      availableJP: null,
      unresolvedReason:
        'Hari sekolah per minggu (schoolDaysPerWeek) belum ditentukan atau tidak valid (harus 5 atau 6 hari).',
      formula: 'JP Mingguan × (Hari Efektif Belajar ÷ Hari Sekolah/Minggu)',
      formulaCalculation: 'Data hari sekolah per minggu tidak valid (UNRESOLVED)',
      jpPerWeek: params.subjectWeeklyJP ?? null,
      effectiveWeeks: null,
      officialAnnualJP: params.officialAnnualJP ?? undefined,
      details: {
        semester: params.semester,
        academicYear: params.academicYear,
        level: params.level,
        grade: params.grade,
        subject: params.subject,
      },
    };
  }

  if (params.weeklyJPSource === 'REFERENCE_EQUIVALENT') {
    return {
      status: 'UNRESOLVED',
      subjectWeeklyJP: params.subjectWeeklyJP ?? null,
      effectiveLearningDays: params.effectiveLearningDays ?? null,
      schoolDaysPerWeek: validDays,
      effectiveWeeksEquivalent: null,
      effectiveWeeksRounded: null,
      availableJP: null,
      unresolvedReason:
        'Alokasi mingguan berasal dari REFERENCE_EQUIVALENT normatif regulasi, bukan jadwal mingguan aktual sekolah (ACTUAL_SCHEDULE).',
      formula: 'JP Mingguan Aktual × (Hari Efektif Belajar ÷ Hari Sekolah/Minggu)',
      formulaCalculation: 'Bukan jadwal mingguan aktual sekolah (REFERENCE_EQUIVALENT)',
      jpPerWeek: params.subjectWeeklyJP ?? null,
      effectiveWeeks: null,
      officialAnnualJP: params.officialAnnualJP ?? undefined,
      details: {
        semester: params.semester,
        academicYear: params.academicYear,
        level: params.level,
        grade: params.grade,
        subject: params.subject,
      },
    };
  }

  const subjectWeeklyJP = Math.max(0, Number(params.subjectWeeklyJP) || 0);
  const effectiveLearningDays = Math.max(0, Number(params.effectiveLearningDays) || 0);

  const { effectiveWeeksEquivalent, effectiveWeeksRounded } = calculateEffectiveWeeks(
    effectiveLearningDays,
    validDays
  );

  const exactAvailableJP = subjectWeeklyJP * (effectiveLearningDays / validDays);
  const availableJP = Math.round(exactAvailableJP);

  // Batasi / validasi terhadap kapasitas struktur tahunan resmi
  let isCapacityExceeded = false;
  let capacityWarning: string | undefined;
  if (params.officialAnnualJP && params.officialAnnualJP > 0) {
    const projectedAnnualJP = availableJP * 2;
    if (projectedAnnualJP > params.officialAnnualJP * 1.15) {
      isCapacityExceeded = true;
      capacityWarning = `Perhatian: Proyeksi JP tahunan (${projectedAnnualJP} JP) melampaui alokasi struktur kurikulum resmi (${params.officialAnnualJP} JP/tahun). Periksa kembali kalender akademik.`;
    }
  }

  const formula = 'JP Mingguan × (Hari Efektif Belajar ÷ Hari Sekolah/Minggu)';
  const formulaCalculation = `${subjectWeeklyJP} JP/minggu × (${effectiveLearningDays} hari ÷ ${validDays} hari/minggu) = ${subjectWeeklyJP} × ${effectiveWeeksRounded} = ${availableJP} JP`;

  return {
    status: 'RESOLVED',
    subjectWeeklyJP,
    effectiveLearningDays,
    schoolDaysPerWeek: validDays,
    effectiveWeeksEquivalent,
    effectiveWeeksRounded,
    availableJP,
    formula,
    formulaCalculation,
    isCapacityExceeded,
    capacityWarning,
    officialAnnualJP: params.officialAnnualJP ?? undefined,
    details: {
      semester: params.semester,
      academicYear: params.academicYear,
      level: params.level,
      grade: params.grade,
      subject: params.subject,
    },
    jpPerWeek: subjectWeeklyJP,
    effectiveWeeks: effectiveWeeksRounded,
  };
}

/**
 * Normalisasi objek alokasi ke model shared LearningTimeAllocation
 */
export function normalizeLearningAllocation(raw: Partial<LearningTimeAllocation | TimeAllocation>): LearningTimeAllocation {
  const allocatedJP = Number(raw.allocatedJP ?? raw.jp ?? 0);
  const startWeek = raw.startWeek ?? raw.weekNumber;
  const sourceId = raw.sourceId ?? raw.tpId ?? raw.atpItemId ?? raw.id ?? '';
  let sourceType = raw.sourceType;
  if (!sourceType) {
    const rawAny = raw as Record<string, any>;
    if (raw.atpItemId || rawAny.atpId || (sourceId && (sourceId.startsWith('atp-') || sourceId.startsWith('ATP-')))) {
      sourceType = 'ATP_ITEM';
    } else if (raw.tpId || rawAny.tpCode || (sourceId && (sourceId.startsWith('tp-') || sourceId.startsWith('TP-')))) {
      sourceType = 'TP';
    } else if (rawAny.kdId || rawAny.kd || rawAny.kdCode || (sourceId && (sourceId.startsWith('kd-') || sourceId.startsWith('KD-')))) {
      sourceType = 'KD';
    } else if (rawAny.k13ObjectiveId || rawAny.indicatorId || rawAny.indikatorId || (sourceId && sourceId.startsWith('k13-'))) {
      sourceType = 'K13_OBJECTIVE';
    } else {
      sourceType = 'LEGACY';
    }
  }
  return {
    id: raw.id || `alloc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    academicSettingId: raw.academicSettingId || '',
    sourceType,
    sourceId,
    semester: ((raw as Record<string, any>).semester === '2' || (raw as Record<string, any>).semester === 'Semester 2') ? '2' : '1',
    allocatedJP,
    startWeek,
    endWeek: raw.endWeek ?? startWeek,
    month: raw.month,
    monthName: raw.monthName,
    notes: raw.notes,
    tpId: raw.tpId || (sourceType === 'TP' || sourceType === 'ATP_ITEM' ? sourceId : undefined),
    atpItemId: raw.atpItemId || (sourceType === 'ATP_ITEM' ? sourceId : undefined),
    weekNumber: startWeek,
    jp: allocatedJP,
  };
}

/**
 * Validasi Keseluruhan Distribusi Alokasi Waktu (TP / KD) terhadap JP Tersedia
 */
export function validateTimeAllocations(
  allocations: Array<Partial<LearningTimeAllocation | TimeAllocation>>,
  availableJP: number
): TimeAllocationValidationResult {
  const totalAllocatedJP = allocations.reduce((sum, item) => {
    const jp = Number(item.allocatedJP ?? item.jp) || 0;
    return sum + jp;
  }, 0);

  const remainingJP = availableJP - totalAllocatedJP;
  let status: TimeAllocationStatus = 'BALANCED';
  let statusLabel = 'Alokasi Seimbang';
  let statusDescription = `Total alokasi waktu (${totalAllocatedJP} JP) tepat sama dengan kapasitas JP tersedia (${availableJP} JP).`;

  if (remainingJP > 0) {
    status = 'UNDER_ALLOCATED';
    statusLabel = 'Sisa JP Belum Dialokasikan';
    statusDescription = `Terdapat sisa ${remainingJP} JP yang belum dialokasikan dari total ${availableJP} JP tersedia.`;
  } else if (remainingJP < 0) {
    status = 'OVER_ALLOCATED';
    statusLabel = 'Defisit JP';
    statusDescription = `Total alokasi (${totalAllocatedJP} JP) melampaui JP tersedia (${availableJP} JP) sebesar ${Math.abs(remainingJP)} JP.`;
  }

  return {
    availableJP,
    totalAllocatedJP,
    remainingJP,
    status,
    statusLabel,
    statusDescription,
    allocationsCount: allocations.length,
  };
}

/**
 * Menurunkan nilai JP intrakurikuler mata pelajaran dengan pelacakan provenance yang jelas
 */
export function deriveEffectiveJP(setting: {
  curriculum?: string;
  curriculumType?: CurriculumType;
  level?: string;
  grade?: string;
  subject?: string;
  subjectWeeklyJP?: number;
  totalHoursPerWeek?: number;
  isHoursOverridden?: boolean;
  hoursSourceType?: 'OFFICIAL' | 'USER_OVERRIDE' | 'UNVERIFIED' | 'LEGACY_VALUE';
}): {
  weeklyJP: number;
  isOfficial: boolean;
  isOverridden: boolean;
  sourceType: 'OFFICIAL' | 'USER_OVERRIDE' | 'UNVERIFIED' | 'LEGACY_VALUE';
  ruleResult: SubjectJPResult;
  sourceExplanation: string;
} {
  const ruleResult = getSubjectJP({
    curriculum: setting.curriculum,
    curriculumType: setting.curriculumType,
    level: setting.level,
    grade: setting.grade,
    subject: setting.subject,
  });

  const customValue = setting.subjectWeeklyJP ?? setting.totalHoursPerWeek;

  if (
    (setting.isHoursOverridden || setting.hoursSourceType === 'USER_OVERRIDE') &&
    customValue !== undefined &&
    customValue > 0
  ) {
    return {
      weeklyJP: customValue,
      isOfficial: ruleResult.isOfficial && customValue === ruleResult.weeklyJP,
      isOverridden: true,
      sourceType: 'USER_OVERRIDE',
      ruleResult,
      sourceExplanation: `Manual Override Guru (${customValue} JP/minggu). ${ruleResult.isOfficial ? `Standar resmi: ${ruleResult.weeklyJP} JP/minggu (${ruleResult.regulation}).` : 'Belum diverifikasi dalam regulasi resmi.'}`,
    };
  }

  if (ruleResult.isOfficial && ruleResult.weeklyJP !== null) {
    return {
      weeklyJP: ruleResult.weeklyJP,
      isOfficial: true,
      isOverridden: false,
      sourceType: 'OFFICIAL',
      ruleResult,
      sourceExplanation: ruleResult.explanation,
    };
  }

  return {
    weeklyJP: customValue || 0,
    isOfficial: false,
    isOverridden: false,
    sourceType: 'UNVERIFIED',
    ruleResult,
    sourceExplanation: ruleResult.explanation,
  };
}

/** @deprecated Compatibility wrapper */
export function calculateSemesterJP(jpPerWeek: number, semesterEffectiveWeeks: number): number {
  return Math.max(0, Number(jpPerWeek) || 0) * Math.max(0, Number(semesterEffectiveWeeks) || 0);
}

/** @deprecated Compatibility wrapper */
export function calculateAnnualJP(jpPerWeek: number, annualEffectiveWeeks: number): number {
  return Math.max(0, Number(jpPerWeek) || 0) * Math.max(0, Number(annualEffectiveWeeks) || 0);
}

/**
 * Normalizes curriculum string or type to canonical CurriculumType
 */
export function getCurriculumType(curriculum?: string, curriculumType?: CurriculumType): CurriculumType {
  if (curriculumType === 'K13' || curriculumType === 'KURIKULUM_MERDEKA') {
    return curriculumType;
  }
  const curr = (curriculum || '').toLowerCase();
  if (curr.includes('k13') || curr.includes('2013')) {
    return 'K13';
  }
  return 'KURIKULUM_MERDEKA';
}

/** @deprecated Compatibility wrapper */
export function validateTeacherTeachingLoad(
  assignments: TeachingAssignment[] = [],
  additionalDuties: AdditionalDuty[] = [],
  teacherName?: string
): TeacherLoadValidationResult {
  return calculateTeacherWorkload(assignments, additionalDuties, teacherName);
}
