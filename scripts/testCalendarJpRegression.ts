import {
  calculateAvailableJP,
  calculateEffectiveDays,
  calculateEffectiveWeeks,
  getSubjectJP,
  normalizeLearningAllocation,
  resolveSemester,
} from '../src/services/jpEngine';
import { createDefaultCalendarForSetting } from '../src/services/storage';
import { AcademicCalendar, CalendarDay, AcademicSetting } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('===========================================================');
console.log('🧪 RUNNING AUDIT NO. 7 REGRESSION TEST: Calendar & JP Engine');
console.log('===========================================================');

// -----------------------------------------------------------------------------
// 1. Audit No. 7: createDefaultCalendarForSetting No-Fabricated-Default Principle
// -----------------------------------------------------------------------------
console.log('\n--- 1. Storage & Calendar Creation Defaults ---');
const dummySetting: AcademicSetting = {
  id: 'setting-sd-4',
  profileId: 'prof-1',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SD',
  grade: '4',
  phase: 'B',
  semester: '1 (Ganjil)',
  academicYear: '2025/2026',
  subject: 'Matematika',
  updatedAt: new Date().toISOString(),
};

const defaultCalRes = createDefaultCalendarForSetting(dummySetting);
const defaultCal = defaultCalRes.calendar;
assert(defaultCal.startDate === '', 'Default calendar startDate is empty string (no hardcoded date)');
assert(defaultCal.endDate === '', 'Default calendar endDate is empty string (no hardcoded date)');
assert(defaultCal.academicYear === '2025/2026', 'Default calendar inherits setting academicYear');
assert(defaultCal.semester === '1 (Ganjil)', 'Default calendar inherits setting semester');
assert(defaultCal.schoolDaysPerWeek === null || defaultCal.schoolDaysPerWeek === undefined, 'Default calendar schoolDaysPerWeek is null/undefined (unresolved)');
assert(defaultCal.sourceType === 'UNVERIFIED' || defaultCal.sourceType === 'MANUAL', 'Default calendar provenance sourceType is UNVERIFIED or MANUAL');

// -----------------------------------------------------------------------------
// 2. Audit No. 7: JP Engine Completeness Gates & UNRESOLVED handling
// -----------------------------------------------------------------------------
console.log('\n--- 2. JP Engine Completeness Gates ---');

// Case 2a: Missing effective learning days
const resUnresolvedDays = calculateAvailableJP({
  subjectWeeklyJP: 4,
  effectiveLearningDays: null,
  schoolDaysPerWeek: 5,
  semester: '1',
  academicYear: '2025/2026',
});
assert(resUnresolvedDays.status === 'UNRESOLVED', 'calculateAvailableJP returns UNRESOLVED when effectiveLearningDays is null');
assert(resUnresolvedDays.availableJP === null, 'availableJP is null when effectiveLearningDays is null');

// Case 2b: Invalid / missing school days per week
const resInvalidDaysPerWeek = calculateAvailableJP({
  subjectWeeklyJP: 4,
  effectiveLearningDays: 95,
  schoolDaysPerWeek: undefined,
  semester: '1',
  academicYear: '2025/2026',
});
assert(resInvalidDaysPerWeek.status === 'UNRESOLVED', 'calculateAvailableJP returns UNRESOLVED when schoolDaysPerWeek is missing/invalid');
assert(resInvalidDaysPerWeek.availableJP === null, 'availableJP is null when schoolDaysPerWeek is missing/invalid');

// Case 2c: Missing weekly JP
const resMissingWeeklyJP = calculateAvailableJP({
  subjectWeeklyJP: null,
  effectiveLearningDays: 95,
  schoolDaysPerWeek: 5,
  semester: '1',
  academicYear: '2025/2026',
});
assert(resMissingWeeklyJP.status === 'UNRESOLVED', 'calculateAvailableJP returns UNRESOLVED when weeklyJP is null');
assert(resMissingWeeklyJP.availableJP === null, 'availableJP is null when weeklyJP is null');

// Case 2d: Valid inputs with 5-day school week (95 days / 5 = 19 weeks, 19 * 4 = 76 JP)
const resValid5 = calculateAvailableJP({
  subjectWeeklyJP: 4,
  effectiveLearningDays: 95,
  schoolDaysPerWeek: 5,
  semester: '1',
  academicYear: '2025/2026',
});
assert(resValid5.status === 'RESOLVED', 'calculateAvailableJP returns RESOLVED for valid 5-day week');
assert(resValid5.effectiveWeeksRounded === 19, '95 days with 5-day week resolves to 19 effective weeks');
assert(resValid5.availableJP === 76, '19 weeks * 4 JP/week resolves to 76 available JP');

// Case 2e: Valid inputs with 6-day school week (114 days / 6 = 19 weeks, 19 * 3 = 57 JP)
const resValid6 = calculateAvailableJP({
  subjectWeeklyJP: 3,
  effectiveLearningDays: 114,
  schoolDaysPerWeek: 6,
  semester: '1',
  academicYear: '2025/2026',
});
assert(resValid6.status === 'RESOLVED', 'calculateAvailableJP returns RESOLVED for valid 6-day week');
assert(resValid6.effectiveWeeksRounded === 19, '114 days with 6-day week resolves to 19 effective weeks');
assert(resValid6.availableJP === 57, '19 weeks * 3 JP/week resolves to 57 available JP');

// -----------------------------------------------------------------------------
// 3. Calendar Effective Days Calculator
// -----------------------------------------------------------------------------
console.log('\n--- 3. Calendar Effective Days Calculation ---');
const testCalendar: AcademicCalendar = {
  id: 'cal-test',
  academicSettingId: dummySetting.id,
  academicYear: '2025/2026',
  semester: '1',
  startDate: '2025-07-14',
  endDate: '2025-07-20', // Exactly 7 days (Mon-Sun)
  schoolDaysPerWeek: 5,
  sourceType: 'REGIONAL_EDUCATION_CALENDAR',
  sourceName: 'Kaldik Disdik Prov. Jawa Barat 2025/2026',
  sourceRegion: 'Jawa Barat',
  updatedAt: new Date().toISOString(),
};

// 7 days: 5 weekdays (Mon-Fri) + 2 weekend days (Sat-Sun)
// All 5 weekdays are recorded as effective learning days
const fullWeekDays: CalendarDay[] = [
  { id: 'cd-1', academicCalendarId: 'cal-test', date: '2025-07-14', status: 'effective', notes: '' },
  { id: 'cd-2', academicCalendarId: 'cal-test', date: '2025-07-15', status: 'effective', notes: '' },
  { id: 'cd-3', academicCalendarId: 'cal-test', date: '2025-07-16', status: 'effective', notes: '' },
  { id: 'cd-4', academicCalendarId: 'cal-test', date: '2025-07-17', status: 'effective', notes: '' },
  { id: 'cd-5', academicCalendarId: 'cal-test', date: '2025-07-18', status: 'effective', notes: '' },
];
const effRes = calculateEffectiveDays(testCalendar, fullWeekDays);
assert(effRes.status === 'RESOLVED', 'Effective days calculation resolves successfully for valid dates and 5-day week');
assert(effRes.totalCalendarDays === 7, 'Total calendar days is 7');
assert(effRes.effectiveLearningDays === 5, '5 weekdays are counted as effective learning days');

// Add 1 holiday on Wednesday 2025-07-16
const daysWithHoliday: CalendarDay[] = [
  { id: 'cd-1', academicCalendarId: 'cal-test', date: '2025-07-14', status: 'effective', notes: '' },
  { id: 'cd-2', academicCalendarId: 'cal-test', date: '2025-07-15', status: 'effective', notes: '' },
  { id: 'cd-3', academicCalendarId: 'cal-test', date: '2025-07-16', status: 'holiday', notes: 'Tahun Baru Islam' },
  { id: 'cd-4', academicCalendarId: 'cal-test', date: '2025-07-17', status: 'effective', notes: '' },
  { id: 'cd-5', academicCalendarId: 'cal-test', date: '2025-07-18', status: 'effective', notes: '' },
];
const effResHoliday = calculateEffectiveDays(testCalendar, daysWithHoliday);
assert(effResHoliday.effectiveLearningDays === 4, '1 holiday reduces effective learning days to 4');
assert(effResHoliday.holidayDays === 1, 'Holiday days count is 1');

// Incomplete dates
const incompleteCal: AcademicCalendar = {
  id: 'cal-inc',
  academicSettingId: dummySetting.id,
  academicYear: '2025/2026',
  semester: '1',
  startDate: '',
  endDate: '',
  schoolDaysPerWeek: 5,
  updatedAt: new Date().toISOString(),
};
const effResIncomplete = calculateEffectiveDays(incompleteCal, []);
assert(effResIncomplete.status === 'UNRESOLVED', 'Empty dates return UNRESOLVED status');
assert(effResIncomplete.effectiveLearningDays === 0, 'Incomplete calendar yields 0 effective learning days');

// -----------------------------------------------------------------------------
// 4. Learning Time Allocation Normalization & Semester Resolution
// -----------------------------------------------------------------------------
console.log('\n--- 4. Learning Time Allocation Normalization & Semester Resolution ---');
const rawAlloc = {
  id: 'alloc-1',
  academicSettingId: dummySetting.id,
  sourceId: 'tp-101',
  sourceType: 'ATP_ITEM' as const,
  jp: 6,
  startWeek: 1,
  endWeek: 2,
};
const normalized = normalizeLearningAllocation(rawAlloc);
assert(normalized.allocatedJP === 6, 'normalizeLearningAllocation preserves allocatedJP');
assert(normalized.sourceId === 'tp-101', 'normalizeLearningAllocation preserves sourceId');
assert(normalized.startWeek === 1 && normalized.endWeek === 2, 'normalizeLearningAllocation preserves week range');
assert(normalized.semester === '', 'normalizeLearningAllocation does not fabricate default semester 1 when missing');

// -----------------------------------------------------------------------------
// 5. Canonical Semester Resolution (Audit No. 7 Micro-Patch)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Canonical Semester Resolution ---');
assert(resolveSemester(null, null) === null, 'calendar semester null + setting semester null -> null');
assert(resolveSemester(undefined, undefined) === null, 'calendar semester undefined + setting semester undefined -> null');
assert(resolveSemester('invalid-value', '') === null, 'calendar semester invalid + setting semester empty -> null');
assert(resolveSemester('1', null) === '1', 'calendar semester 1 -> "1"');
assert(resolveSemester('2', null) === '2', 'calendar semester 2 -> "2"');
assert(resolveSemester('Semester 1', null) === '1', 'calendar semester "Semester 1" -> "1"');
assert(resolveSemester('Semester 2', null) === '2', 'calendar semester "Semester 2" -> "2"');
assert(resolveSemester('1 (Ganjil)', null) === '1', 'calendar semester "1 (Ganjil)" -> "1"');
assert(resolveSemester('2 (Genap)', null) === '2', 'calendar semester "2 (Genap)" -> "2"');
assert(resolveSemester(null, '1 (Ganjil)') === '1', 'setting semester "1 (Ganjil)" -> "1"');
assert(resolveSemester(null, '2 (Genap)') === '2', 'setting semester "2 (Genap)" -> "2"');
assert(resolveSemester(null, 'Semester 2') === '2', 'setting semester "Semester 2" -> "2"');
assert(resolveSemester('2', '1 (Ganjil)') === '2', 'calendar semester takes precedence over setting semester');

console.log('\n===========================================================');
console.log('🎉 AUDIT NO. 7 REGRESSION TESTS COMPLETED: 100% PASSED');
console.log('===========================================================');
