/**
 * TEST SUITE: MASTER REGULASI KURIKULUM NASIONAL (SD, SMP, SMA)
 *
 * Menguji:
 * 1. Konsistensi Internal Struktur JP (Permendikbudristek 12/2024 & Permendikdasmen 13/2025)
 * 2. Pemetaan Fase Resmi (Fase A - F)
 * 3. Pemetaan Jenjang Sekolah (SD, SMP, SMA)
 * 4. Resolusi Alias Subjek & Kode Baku
 * 5. Ketetapan Permendikdasmen No. 13 Tahun 2025 (Koding & AI, Bahasa Inggris)
 * 6. Pemisahan JP Normatif Tahunan vs JP Ekuivalen Mingguan vs JP Tersedia Aktual
 * 7. Kompatibilitas jpEngine (getSubjectJP)
 * 8. Master Capaian Pembelajaran (CP)
 */

import fs from 'fs';
import path from 'path';
import {
  ALL_CURRICULUM_STRUCTURE_RULES,
  resolveCurriculumContext,
  resolveSubjectInput,
  parseAcademicYear,
  getPhaseForGrade,
  getSchoolLevelForGrade,
  validateStructureRule,
  validateAllStructureRules,
  validateCurriculumMaster,
  findSubjectByCode,
  findSubjectByNameOrAlias,
  CURRICULUM_REGULATIONS,
  findCPBySubjectAndPhase,
  resolveCPContext,
  isReligionSubject,
  validateCPEntry,
  validateAllCPEntries,
  SD_CP_ENTRIES,
  SMP_CP_ENTRIES,
  SMA_CP_ENTRIES,
  parseAcademicYearStart,
  isCPApplicableForAcademicYear,
} from '../src/data/curriculum';
import {
  getSubjectJP,
  calculateEffectiveDays,
  getEffectiveWeeksList,
  calculateAvailableJP,
  normalizeCalendarDayStatus,
  validateCalendarCompleteness,
} from '../src/services/jpEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runCurriculumMasterTests() {
  console.log('===========================================================');
  console.log('🏛️ RUNNING TEST SUITE: MASTER REGULASI KURIKULUM SD–SMA');
  console.log('===========================================================');

  // TEST 1: Validasi Integritas Seluruh Struktur JP Resmi
  console.log('\n--- 1. Validasi Integritas Struktur JP ---');
  const validationSummary = validateAllStructureRules();
  if (validationSummary.errors.length > 0) {
    console.log('Errors found in validation:', JSON.stringify(validationSummary.errors.slice(0, 10), null, 2));
  }
  assert(
    validationSummary.valid,
    `Semua rule struktur kurikulum valid secara matematis (${validationSummary.totalRules} rules)`
  );
  assert(
    validationSummary.errors.length === 0,
    `Tidak ada error struktur JP (errors: ${validationSummary.errors.length})`
  );
  assert(
    validationSummary.verifiedRules > 0,
    `Terdapat ${validationSummary.verifiedRules} rule terverifikasi resmi`
  );

  // TEST 2: Setiap Regulation ID Terdaftar pada Master Regulasi Resmi
  console.log('\n--- 2. Validasi Sumber Regulasi Resmi ---');
  const regMap = new Map(CURRICULUM_REGULATIONS.map((r) => [r.id, r]));
  for (const rule of ALL_CURRICULUM_STRUCTURE_RULES) {
    for (const regId of rule.regulationIds) {
      assert(
        regMap.has(regId),
        `Rule ${rule.id} mereferensikan sumber regulasi valid: ${regId}`
      );
    }
  }

  // TEST 3: Pemetaan Fase Resmi (Fase A - F)
  console.log('\n--- 3. Pemetaan Fase Resmi (Fase A - F) ---');
  assert(getPhaseForGrade(1) === 'A', 'Kelas 1 adalah Fase A');
  assert(getPhaseForGrade(2) === 'A', 'Kelas 2 adalah Fase A');
  assert(getPhaseForGrade(3) === 'B', 'Kelas 3 adalah Fase B');
  assert(getPhaseForGrade(4) === 'B', 'Kelas 4 adalah Fase B');
  assert(getPhaseForGrade(5) === 'C', 'Kelas 5 adalah Fase C');
  assert(getPhaseForGrade(6) === 'C', 'Kelas 6 adalah Fase C');
  assert(getPhaseForGrade(7) === 'D', 'Kelas 7 adalah Fase D');
  assert(getPhaseForGrade(8) === 'D', 'Kelas 8 adalah Fase D');
  assert(getPhaseForGrade(9) === 'D', 'Kelas 9 adalah Fase D');
  assert(getPhaseForGrade(10) === 'E', 'Kelas 10 adalah Fase E');
  assert(getPhaseForGrade(11) === 'F', 'Kelas 11 adalah Fase F');
  assert(getPhaseForGrade(12) === 'F', 'Kelas 12 adalah Fase F');

  // TEST 4: Pemetaan Jenjang Sekolah
  console.log('\n--- 4. Pemetaan Jenjang Sekolah (SD, SMP, SMA) ---');
  assert(getSchoolLevelForGrade(1) === 'SD', 'Kelas 1 jenjang SD');
  assert(getSchoolLevelForGrade(6) === 'SD', 'Kelas 6 jenjang SD');
  assert(getSchoolLevelForGrade(7) === 'SMP', 'Kelas 7 jenjang SMP');
  assert(getSchoolLevelForGrade(9) === 'SMP', 'Kelas 9 jenjang SMP');
  assert(getSchoolLevelForGrade(10) === 'SMA', 'Kelas 10 jenjang SMA');
  assert(getSchoolLevelForGrade(12) === 'SMA', 'Kelas 12 jenjang SMA');

  // TEST 5: Resolusi Alias Subjek & Normalisasi
  console.log('\n--- 5. Resolusi Alias Subjek ---');
  const pjok1 = findSubjectByNameOrAlias('PJOK');
  const pjok2 = findSubjectByNameOrAlias('Pendidikan Jasmani, Olahraga, dan Kesehatan');
  const pjok3 = findSubjectByNameOrAlias('Penjasorkes');
  assert(pjok1?.code === 'PJOK', 'Alias PJOK teresolusi ke PJOK');
  assert(pjok2?.code === 'PJOK', 'Nama lengkap PJOK teresolusi ke PJOK');
  assert(pjok3?.code === 'PJOK', 'Alias Penjasorkes teresolusi ke PJOK');

  const ipas1 = findSubjectByNameOrAlias('IPAS');
  const ipas2 = findSubjectByNameOrAlias('Ilmu Pengetahuan Alam dan Sosial');
  assert(ipas1?.code === 'IPAS', 'Alias IPAS teresolusi ke IPAS');
  assert(ipas2?.code === 'IPAS', 'Nama lengkap IPAS teresolusi ke IPAS');

  const coding1 = findSubjectByNameOrAlias('Koding dan Kecerdasan Artifisial');
  const coding2 = findSubjectByNameOrAlias('Coding & AI');
  const coding3 = findSubjectByNameOrAlias('Kecerdasan Buatan');
  assert(coding1?.code === 'CODING_AI', 'Nama resmi Koding & AI teresolusi ke CODING_AI');
  assert(coding2?.code === 'CODING_AI', 'Alias Coding & AI teresolusi ke CODING_AI');
  assert(coding3?.code === 'CODING_AI', 'Alias Kecerdasan Buatan teresolusi ke CODING_AI');

  // TEST 6: Ketetapan Permendikdasmen No. 13 Tahun 2025 & Float Weekly JP
  console.log('\n--- 6. Ketetapan Permendikdasmen No. 13 Tahun 2025 & Float Weekly JP ---');
  // Sejarah SMA Kelas 10 (54 JP intrakurikuler / 36 minggu = 1.5 JP/minggu)
  const sejarahGrade10 = resolveCurriculumContext({
    grade: 10,
    subjectCode: 'SEJARAH',
  });
  assert(sejarahGrade10 !== null, 'Sejarah Kelas 10 SMA ditemukan');
  assert(sejarahGrade10?.derivedWeeklyJP === 1.5, 'Sejarah Kelas 10 derivedWeeklyJP bernilai float 1.5 (tanpa pembulatan paksa)');
  assert(sejarahGrade10?.intrakurikulerAnnualJP === 54, 'Sejarah Kelas 10 intrakurikulerAnnualJP = 54');
  assert(sejarahGrade10?.kokurikulerAnnualJP === 18, 'Sejarah Kelas 10 kokurikulerAnnualJP = 18');
  assert(sejarahGrade10?.allocationMode === 'ANNUAL', 'Sejarah Kelas 10 allocationMode = ANNUAL');

  // Coding & AI SD Kelas 5 TA 2025/2026
  const codingGrade5 = resolveCurriculumContext({
    grade: 5,
    subjectInput: 'Coding & AI',
    academicYear: '2025/2026',
  });
  assert(codingGrade5 !== null, 'Coding & AI ditemukan untuk Kelas 5 SD TA 2025/2026');
  assert(codingGrade5?.derivedWeeklyJP === 2, 'Coding & AI Kelas 5 dialokasikan 2 JP/minggu');
  assert(codingGrade5?.intrakurikulerAnnualJP === 72, 'Coding & AI Kelas 5 dialokasikan 72 JP/tahun');
  assert(codingGrade5?.isElective === true, 'Coding & AI berstatus mapel pilihan (ELECTIVE)');
  assert(
    codingGrade5?.regulationSources.some((r) => r.id === 'REG-PERMENDIKDASMEN-13-2025') === true,
    'Coding & AI bersumber dari Permendikdasmen No. 13 Tahun 2025'
  );

  // Coding & AI SD Kelas 4 TA 2025/2026 berstatus UNVERIFIED secara jujur (tanpa menebak rollout)
  const codingGrade4In2025 = resolveCurriculumContext({
    grade: 4,
    subjectInput: 'Coding & AI',
    academicYear: '2025/2026',
  });
  assert(
    codingGrade4In2025 === null || codingGrade4In2025?.verificationStatus === 'UNVERIFIED',
    'Coding & AI SD Kelas 4 tidak aktif / berstatus UNVERIFIED untuk TA 2025/2026'
  );

  const codingGrade4Rule = ALL_CURRICULUM_STRUCTURE_RULES.find(
    (r) => r.id === 'km25-sd-4-coding-ai'
  );
  assert(
    codingGrade4Rule !== undefined && codingGrade4Rule.verificationStatus === 'UNVERIFIED',
    'Coding & AI SD Kelas 4 berstatus UNVERIFIED secara jujur di dataset master (tanpa menebak rollout)'
  );

  // TEST 7: Pemisahan Tiga Lapisan JP & Aturan Ketat Aktual
  console.log('\n--- 7. Pemisahan Tiga Lapisan JP & Aturan Ketat Aktual ---');
  // Kasus A: Matematika Kelas 4 tanpa jadwal mingguan aktual eksplisit (hanya minggu efektif) -> actualAvailableAnnualJP harus null
  const matGrade4OnlyWeeks = resolveCurriculumContext({
    grade: 4,
    subjectInput: 'Matematika',
    schoolWeeksPerYear: 34,
  });
  assert(matGrade4OnlyWeeks !== null, 'Matematika Kelas 4 ditemukan');
  assert(matGrade4OnlyWeeks?.intrakurikulerAnnualJP === 180, 'JP Normatif Tahunan = 180 JP');
  assert(matGrade4OnlyWeeks?.derivedWeeklyJP === 5, 'JP Ekuivalen Mingguan = 5 JP/minggu');
  assert(
    matGrade4OnlyWeeks?.actualAvailableAnnualJP === null,
    'Jika hanya tersedia schoolWeeksPerYear tanpa actualWeeklyJP eksplisit, actualAvailableAnnualJP bernilai null (tidak menggunakan derivedWeeklyJP)'
  );

  // Kasus B: Matematika Kelas 4 dengan jadwal mingguan aktual eksplisit (actualWeeklyJP: 5, weeklyJPSource: 'ACTUAL_SCHEDULE')
  const matGrade4WithActualSchedule = resolveCurriculumContext({
    grade: 4,
    subjectInput: 'Matematika',
    schoolWeeksPerYear: 34,
    actualWeeklyJP: 5,
    weeklyJPSource: 'ACTUAL_SCHEDULE',
  });
  assert(
    matGrade4WithActualSchedule?.actualAvailableAnnualJP === 170,
    'Jika actualWeeklyJP eksplisit (5) dan schoolWeeksPerYear (34) diberikan, actualAvailableAnnualJP dihitung = 170'
  );

  // Kasus C: allocationMode ANNUAL (misal Sejarah SMA 10) dengan schoolWeeksPerYear saja -> actualAvailableAnnualJP = null
  const sejarahOnlyWeeks = resolveCurriculumContext({
    grade: 10,
    subjectCode: 'SEJARAH',
    schoolWeeksPerYear: 34,
  });
  assert(
    sejarahOnlyWeeks?.actualAvailableAnnualJP === null,
    'allocationMode ANNUAL dengan hanya schoolWeeksPerYear menghasilkan actualAvailableAnnualJP = null (BLOCKER 1 & 2)'
  );

  // Kasus D: allocationMode ANNUAL dengan actualScheduledAnnualJP eksplisit = 50 JP
  const sejarahWithScheduledAnnual = resolveCurriculumContext({
    grade: 10,
    subjectCode: 'SEJARAH',
    schoolWeeksPerYear: 34,
    actualScheduledAnnualJP: 50,
  });
  assert(
    sejarahWithScheduledAnnual?.actualAvailableAnnualJP === 50,
    'allocationMode ANNUAL dengan actualScheduledAnnualJP = 50 menghasilkan actualAvailableAnnualJP = 50'
  );

  // TEST 8: Kompatibilitas jpEngine (getSubjectJP)
  console.log('\n--- 8. Kompatibilitas jpEngine (getSubjectJP) ---');
  const jpSD = getSubjectJP({
    curriculum: 'Kurikulum Merdeka',
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
  });
  assert(jpSD.isOfficial === true, 'JP PJOK SD Kelas 4 terverifikasi resmi');
  assert(jpSD.weeklyJP === 3, 'JP PJOK SD Kelas 4 adalah 3 JP/minggu');
  assert(jpSD.intrakurikulerAnnualJP === 108, 'JP Intrakurikuler Tahunan PJOK SD Kelas 4 adalah 108 JP');
  assert(jpSD.kokurikulerAnnualJP === 36, 'JP Kokurikuler Tahunan PJOK SD Kelas 4 adalah 36 JP');
  assert(jpSD.totalAnnualJP === 144, 'Total Tahunan PJOK SD Kelas 4 adalah 144 JP');

  const jpSMP = getSubjectJP({
    curriculum: 'Kurikulum Merdeka',
    level: 'SMP',
    grade: 'Kelas 7',
    subject: 'Informatika',
  });
  assert(jpSMP.isOfficial === true, 'Informatika SMP Kelas 7 terverifikasi resmi');
  assert(jpSMP.weeklyJP === 2, 'Informatika SMP Kelas 7 adalah 2 JP (derived)');
  assert(jpSMP.intrakurikulerAnnualJP === 72, 'Informatika SMP Kelas 7 adalah 72 JP intra tahunan');
  assert(jpSMP.kokurikulerAnnualJP === 36, 'Informatika SMP Kelas 7 adalah 36 JP kokurikuler tahunan');

  const jpSMA = getSubjectJP({
    curriculum: 'Kurikulum Merdeka',
    level: 'SMA',
    grade: 'Kelas 10',
    subject: 'Fisika',
  });
  assert(jpSMA.isOfficial === true, 'Fisika SMA Kelas 10 terverifikasi resmi');
  assert(jpSMA.intrakurikulerAnnualJP === 72, 'Fisika SMA Kelas 10 adalah 72 JP intra tahunan');

  // TEST 9: Master Capaian Pembelajaran (CP)
  console.log('\n--- 9. Master Capaian Pembelajaran (CP) ---');
  assert(SD_CP_ENTRIES.length > 0, `SD memiliki ${SD_CP_ENTRIES.length} CP master`);
  assert(SMP_CP_ENTRIES.length > 0, `SMP memiliki ${SMP_CP_ENTRIES.length} CP master`);
  assert(SMA_CP_ENTRIES.length > 0, `SMA memiliki ${SMA_CP_ENTRIES.length} CP master`);

  const cpPjokA = findCPBySubjectAndPhase('PJOK', 'A');
  assert(cpPjokA !== undefined, 'CP PJOK Fase A ditemukan');
  assert(cpPjokA?.phase === 'A', 'Fase CP adalah Fase A');
  assert(cpPjokA?.elements.length === 4, 'CP PJOK Fase A memiliki 4 elemen capaian pembelajaran');

  const cpMatB = findCPBySubjectAndPhase('Matematika', 'B');
  assert(cpMatB !== undefined, 'CP Matematika Fase B ditemukan');
  assert(cpMatB?.elements.some((e) => e.name === 'Bilangan') === true, 'Elemen Bilangan ada pada CP Matematika Fase B');

  const cpIpasC = findCPBySubjectAndPhase('IPAS', 'C');
  assert(cpIpasC !== undefined, 'CP IPAS Fase C ditemukan');

  const cpInformatikaD = findCPBySubjectAndPhase('Informatika', 'D');
  assert(cpInformatikaD !== undefined, 'CP Informatika Fase D ditemukan');

  // TEST 10: Calendar No-Assumption Regression
  console.log('\n--- 10. Calendar No-Assumption Regression ---');
  // Kalender dengan schoolDaysPerWeek tidak didefinisikan (undefined) atau null
  const calNoDays = {
    semester: '1',
    academicYear: '2024/2025',
    calendarDays: [
      { date: '2024-07-15', status: 'EFEKTIF' },
      { date: '2024-07-16', status: 'EFEKTIF' },
    ],
  };
  const effDaysNoDays = calculateEffectiveDays(calNoDays as any);
  assert(
    effDaysNoDays === null || effDaysNoDays.status === 'UNRESOLVED',
    'calculateEffectiveDays mengembalikan UNRESOLVED/null jika schoolDaysPerWeek tidak diset'
  );

  const effWeeksNoDays = getEffectiveWeeksList(calNoDays as any);
  assert(
    effWeeksNoDays.length === 0,
    'getEffectiveWeeksList mengembalikan array kosong jika schoolDaysPerWeek tidak diset'
  );

  const calEmptyDays = {
    semester: '1',
    academicYear: '2024/2025',
    schoolDaysPerWeek: 5,
    calendarDays: [],
  };
  const effWeeksEmptyDays = getEffectiveWeeksList(calEmptyDays as any);
  assert(
    effWeeksEmptyDays.length === 0,
    'getEffectiveWeeksList mengembalikan array kosong jika calendarDays kosong'
  );

  // Kalender valid dengan 5 hari sekolah
  const calValid5 = {
    semester: '1',
    academicYear: '2024/2025',
    schoolDaysPerWeek: 5,
    calendarDays: [
      { date: '2024-07-15', status: 'EFEKTIF' }, // Senin
      { date: '2024-07-16', status: 'EFEKTIF' }, // Selasa
      { date: '2024-07-17', status: 'EFEKTIF' }, // Rabu
      { date: '2024-07-18', status: 'EFEKTIF' }, // Kamis
      { date: '2024-07-19', status: 'EFEKTIF' }, // Jumat
    ],
  };
  const effDaysValid5 = calculateEffectiveDays(calValid5 as any);
  assert(
    effDaysValid5 !== null && effDaysValid5.effectiveLearningDays === 5,
    'calculateEffectiveDays menghitung 5 hari efektif dengan schoolDaysPerWeek = 5'
  );

  // Kalender dengan missing date (hanya Senin dan Selasa yang tercatat, Rabu-Jumat tidak ada di calendarDays)
  const calMissingDays = {
    semester: '1',
    academicYear: '2024/2025',
    startDate: '2024-07-15',
    endDate: '2024-07-19',
    schoolDaysPerWeek: 5,
    calendarDays: [
      { date: '2024-07-15', status: 'EFFECTIVE_LEARNING' }, // Senin
      { date: '2024-07-16', status: 'EFFECTIVE_LEARNING' }, // Selasa
      // 2024-07-17 (Rabu), 2024-07-18 (Kamis), 2024-07-19 (Jumat) TIDAK ADA di calendarDays
    ],
  };
  const effDaysMissing = calculateEffectiveDays(calMissingDays as any);
  assert(
    effDaysMissing.effectiveLearningDays === 2,
    'Missing date tidak dianggap hari efektif (hanya 2 hari efektif dari 2 tanggal tercatat)'
  );
  assert(
    effDaysMissing.unknownDays === 3,
    'Tanggal tanpa record di calendarDays dicatat sebagai unknownDays (3 hari)'
  );
  assert(
    effDaysMissing.status === 'PARTIAL',
    'Kalender dengan missing dates berstatus PARTIAL'
  );

  const completeness = validateCalendarCompleteness(calMissingDays as any);
  assert(
    completeness.complete === false && completeness.missingScheduledDates.length === 3,
    'validateCalendarCompleteness mendeteksi 3 tanggal terjadwal yang hilang (missingScheduledDates)'
  );

  assert(
    normalizeCalendarDayStatus('LIBUR') === 'HOLIDAY',
    'normalizeCalendarDayStatus memetakan LIBUR ke HOLIDAY'
  );
  assert(
    normalizeCalendarDayStatus('ASESMEN') === 'ASSESSMENT',
    'normalizeCalendarDayStatus memetakan ASESMEN ke ASSESSMENT'
  );
  assert(
    normalizeCalendarDayStatus('JEDA_SEMESTER') === 'BREAK',
    'normalizeCalendarDayStatus memetakan JEDA_SEMESTER ke BREAK'
  );
  assert(
    normalizeCalendarDayStatus('unknown_status') === 'UNKNOWN',
    'normalizeCalendarDayStatus memetakan unknown status ke UNKNOWN'
  );

  // TEST 11: Academic Year Parser & Version-Aware Resolver
  console.log('\n--- 11. Academic Year Parser & Version-Aware Resolver ---');
  const ayParsed1 = parseAcademicYear('2024/2025');
  assert(
    ayParsed1 !== null &&
      ayParsed1.startYear === 2024 &&
      ayParsed1.endYear === 2025 &&
      ayParsed1.startDate === '2024-07-01' &&
      ayParsed1.endDate === '2025-06-30',
    'parseAcademicYear membaca format 2024/2025 dengan tepat'
  );

  const ayParsed2 = parseAcademicYear('2025-2026');
  assert(
    ayParsed2 !== null &&
      ayParsed2.startYear === 2025 &&
      ayParsed2.endYear === 2026,
    'parseAcademicYear membaca format 2025-2026 dengan tepat'
  );

  const ayInvalid = parseAcademicYear('invalid-year');
  assert(ayInvalid === null, 'parseAcademicYear mengembalikan null untuk format tidak valid');

  const resolvedWithAY = resolveCurriculumContext({
    grade: 7,
    subjectCode: 'BINDO',
    academicYear: '2024/2025',
  });
  assert(
    resolvedWithAY !== null && resolvedWithAY.subject?.code === 'BINDO',
    'resolveCurriculumContext berhasil menyelesaikan konteks dengan academicYear 2024/2025'
  );

  // TEST 12: Actual Available JP Semantics (Strict Separation)
  console.log('\n--- 12. Actual Available JP Semantics ---');
  const resolvedNoWeeks = resolveCurriculumContext({
    grade: 7,
    subjectCode: 'BINDO',
    // schoolWeeksPerYear TIDAK disediakan
  });
  assert(
    resolvedNoWeeks !== null && resolvedNoWeeks.actualAvailableAnnualJP === null,
    'Jika schoolWeeksPerYear tidak disediakan, actualAvailableAnnualJP bernilai null (bukan berasumsi referenceWeeks)'
  );
  assert(
    resolvedNoWeeks !== null && resolvedNoWeeks.referenceWeeksPerYear === 36,
    'referenceWeeksPerYear tetap tersedia sebagai standar regulasi (36 minggu)'
  );

  const resolvedWithWeeks = resolveCurriculumContext({
    grade: 7,
    subjectCode: 'BINDO',
    schoolWeeksPerYear: 35,
    actualWeeklyJP: 5,
    weeklyJPSource: 'ACTUAL_SCHEDULE',
    actualWeeksProvenance: 'CALENDAR',
  });
  assert(
    resolvedWithWeeks !== null && resolvedWithWeeks.actualAvailableAnnualJP === 35 * 5,
    'Jika schoolWeeksPerYear disediakan (35) bersama actualWeeklyJP eksplisit (5), actualAvailableAnnualJP dihitung akurat (35 × 5 = 175)'
  );
  assert(
    resolvedWithWeeks !== null && resolvedWithWeeks.actualWeeksProvenance === 'CALENDAR',
    'Provenance data aktual dicatat sebagai CALENDAR'
  );

  // TEST 13: Master Validator Edge-Case Coverage
  console.log('\n--- 13. Master Validator Edge Cases ---');
  const invalidGradeRule: any = {
    id: 'test-invalid-grade',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 15, // Invalid grade
    phase: 'A',
    subjectCode: 'BINDO',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 36,
    derivedWeeklyJP: 6,
    regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
    verificationStatus: 'VERIFIED',
  };
  const invalidGradeResult = validateStructureRule(invalidGradeRule);
  assert(
    invalidGradeResult.isValid === false &&
      invalidGradeResult.issues.some((i) => i.field === 'grade'),
    'Validator mendeteksi grade tidak valid (> 12)'
  );

  const levelMismatchRule: any = {
    id: 'test-level-mismatch',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 8, // SD cannot have grade 8
    phase: 'D',
    subjectCode: 'BINDO',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 36,
    derivedWeeklyJP: 6,
    regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
    verificationStatus: 'VERIFIED',
  };
  const levelMismatchResult = validateStructureRule(levelMismatchRule);
  assert(
    levelMismatchResult.isValid === false &&
      levelMismatchResult.issues.some((i) => i.field === 'level'),
    'Validator mendeteksi mismatch antara Level SD dan Grade 8'
  );

  const unknownSubjectRule: any = {
    id: 'test-unknown-subject',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 1,
    phase: 'A',
    subjectCode: 'MAPEL_PALSU_TIDAK_ADA',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 36,
    derivedWeeklyJP: 6,
    regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
    verificationStatus: 'VERIFIED',
  };
  const unknownSubResult = validateStructureRule(unknownSubjectRule);
  assert(
    unknownSubResult.isValid === false &&
      unknownSubResult.issues.some((i) => i.field === 'subjectCode'),
    'Validator mendeteksi subjectCode yang tidak terdaftar di Master'
  );

  // TEST 14: Regulasi 2025 & Provenance Audit
  console.log('\n--- 14. Regulasi 2025 & Provenance Audit ---');
  const reg2025Decision = CURRICULUM_REGULATIONS.find(
    (r) => r.id === 'DEC-BSKAP-046-2025'
  );
  assert(
    reg2025Decision !== undefined && reg2025Decision.year === 2025,
    'Keputusan Kepala BSKAP No. 046/H/KR/2025 terdaftar di Regulation Registry'
  );

  const guide2025 = CURRICULUM_REGULATIONS.find(
    (r) => r.id === 'GUIDE-BSKAP-PPA-2025'
  );
  assert(
    guide2025 !== undefined && guide2025.year === 2025,
    'Panduan Pembelajaran dan Asesmen 2025 terdaftar di Regulation Registry'
  );

  // Verifikasi status CP terhadap BSKAP 046/2025
  const allCPs = [...SD_CP_ENTRIES, ...SMP_CP_ENTRIES, ...SMA_CP_ENTRIES];
  const verifiedCPs = allCPs.filter(
    (cp) => cp.verificationStatus === 'VERIFIED'
  );
  assert(
    verifiedCPs.length > 0 &&
      verifiedCPs.every((cp) => cp.regulationSourceId === 'DEC-BSKAP-046-2025'),
    'Hanya CP yang diverifikasi langsung terhadap BSKAP No. 046/H/KR/2025 yang berstatus VERIFIED'
  );
  const unverifiedCPs = allCPs.filter(
    (cp) => cp.verificationStatus === 'UNVERIFIED'
  );
  assert(
    unverifiedCPs.length > 0,
    'CP yang belum diverifikasi terhadap naskah 046/2025 tetap berstatus UNVERIFIED secara jujur'
  );

  // TEST 15: validateCurriculumMaster() Entry Point
  console.log('\n--- 15. validateCurriculumMaster() Entry Point ---');
  const masterValidation = validateCurriculumMaster();
  assert(masterValidation.valid === true, 'validateCurriculumMaster() berhasil tanpa error');
  assert(masterValidation.totalRules > 0, `Total ${masterValidation.totalRules} rules divalidasi`);

  // TEST 16: Invalid Grades & Edge-Case Grade Mapping
  console.log('\n--- 16. Invalid Grades & Edge-Case Grade Mapping ---');
  assert(getSchoolLevelForGrade(0) === undefined, 'Kelas 0 tidak dipetakan ke jenjang manapun (undefined)');
  assert(getSchoolLevelForGrade(13) === undefined, 'Kelas 13 tidak dipetakan ke SMA (undefined)');
  assert(getSchoolLevelForGrade(99) === undefined, 'Kelas 99 tidak dipetakan ke jenjang manapun (undefined)');

  assert(
    resolveCurriculumContext({ grade: 0, subjectCode: 'MAT' }) === null,
    'Kelas 0 mengembalikan null (UNRESOLVED)'
  );
  assert(
    resolveCurriculumContext({ grade: 13, subjectCode: 'MAT' }) === null,
    'Kelas 13 mengembalikan null (UNRESOLVED)'
  );
  assert(
    resolveCurriculumContext({ grade: 99, subjectCode: 'MAT' }) === null,
    'Kelas 99 mengembalikan null (UNRESOLVED)'
  );

  // TEST 17: Level Mismatch Guard
  console.log('\n--- 17. Level Mismatch Guard ---');
  const levelMismatchLookup = resolveCurriculumContext({
    level: 'SD',
    grade: 8, // SMP grade
    subjectCode: 'MAT',
  });
  assert(
    levelMismatchLookup === null,
    'Lookup dengan level SD dan grade 8 mengembalikan null (UNRESOLVED karena mismatch)'
  );

  // TEST 18: No Silent Year Fallback
  console.log('\n--- 18. No Silent Year Fallback ---');
  const invalidYearLookup = resolveCurriculumContext({
    grade: 4,
    subjectCode: 'MAT',
    academicYear: 'invalid-academic-year',
  });
  assert(
    invalidYearLookup === null,
    'Academic year tidak valid mengembalikan null tanpa fallback diam-diam'
  );

  const ancientYearLookup = resolveCurriculumContext({
    grade: 4,
    subjectCode: 'MAT',
    academicYear: '2010/2011',
  });
  assert(
    ancientYearLookup === null,
    'Tahun ajaran sebelum kurikulum ada (2010/2011) mengembalikan null tanpa fallback diam-diam'
  );

  // TEST 19: Ambiguity Safety (No candidate exposed as final)
  console.log('\n--- 19. Ambiguity Safety ---');
  const unambiguousResult = resolveCurriculumContext({
    grade: 7,
    subjectCode: 'BINDO',
  });
  assert(
    unambiguousResult !== null && unambiguousResult.isAmbiguous === false,
    'Rule tunggal Kelas 7 Bahasa Indonesia tidak ambigu'
  );

  // TEST 20: minutesPerJP & referenceWeeksPerYear Validation
  console.log('\n--- 20. minutesPerJP & referenceWeeksPerYear Validation ---');
  const badMinutesRule: any = {
    id: 'test-bad-minutes',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 1,
    phase: 'A',
    subjectCode: 'BINDO',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 36,
    minutesPerJP: 60, // Invalid for SD (must be 35)
    derivedWeeklyJP: 6,
    regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
    verificationStatus: 'VERIFIED',
  };
  const badMinutesRes = validateStructureRule(badMinutesRule);
  assert(
    badMinutesRes.isValid === false && badMinutesRes.issues.some((i) => i.field === 'minutesPerJP'),
    'Validator mendeteksi minutesPerJP tidak valid untuk SD (harus 35)'
  );

  const badWeeksRule: any = {
    id: 'test-bad-weeks',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 1,
    phase: 'A',
    subjectCode: 'BINDO',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 20, // Invalid (< 32)
    minutesPerJP: 35,
    derivedWeeklyJP: 10.8,
    regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
    verificationStatus: 'VERIFIED',
  };
  const badWeeksRes = validateStructureRule(badWeeksRule);
  assert(
    badWeeksRes.isValid === false && badWeeksRes.issues.some((i) => i.field === 'referenceWeeksPerYear'),
    'Validator mendeteksi referenceWeeksPerYear di luar rentang standar (32–36)'
  );

  // TEST 21: Evidence Enforcement on VERIFIED Rules
  console.log('\n--- 21. Evidence Enforcement on VERIFIED Rules ---');
  const ruleWithoutEvidence: any = {
    id: 'test-no-evidence',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 1,
    phase: 'A',
    subjectCode: 'BINDO',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 36,
    minutesPerJP: 35,
    derivedWeeklyJP: 6,
    regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
    verificationStatus: 'VERIFIED',
    evidence: [], // KOSONG -> harus ERROR
  };
  const noEvidenceRes = validateStructureRule(ruleWithoutEvidence);
  assert(
    noEvidenceRes.isValid === false &&
      noEvidenceRes.issues.some((i) => i.field === 'evidence' && i.severity === 'ERROR'),
    'Validator menghasilkan ERROR jika rule berstatus VERIFIED tidak memiliki evidence resmi'
  );

  // TEST 22: Selection Group Contradiction Guard
  console.log('\n--- 22. Selection Group Contradiction Guard ---');
  const contradictingSelectionRule: any = {
    id: 'test-contradiction-selection',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 1,
    phase: 'A',
    subjectCode: 'SENI_RUPA',
    subjectType: 'REQUIRED', // KONTRADIKSI: dalam group minSelections=1 tetapi ditandai REQUIRED
    selectionGroup: 'SENI_BUDAYA',
    minSelections: 1,
    intrakurikulerAnnualJP: 108,
    kokurikulerAnnualJP: 36,
    totalAnnualJP: 144,
    referenceWeeksPerYear: 36,
    minutesPerJP: 35,
    derivedWeeklyJP: 3,
    regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
    verificationStatus: 'VERIFIED',
    evidence: [
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/',
      },
    ],
  };
  const contradictionRes = validateStructureRule(contradictingSelectionRule);
  assert(
    contradictionRes.isValid === false &&
      contradictionRes.issues.some((i) => i.field === 'selectionGroup' && i.severity === 'ERROR'),
    'Validator mendeteksi kontradiksi selection group (minSelections=1 tetapi subjectType ditandai REQUIRED)'
  );

  // TEST 23: resolveSubjectInput Canonicalization
  console.log('\n--- 23. resolveSubjectInput Canonicalization ---');
  const subjectInputRes1 = resolveSubjectInput('Pendidikan Jasmani');
  assert(
    subjectInputRes1.status === 'RESOLVED' && subjectInputRes1.subjectCode === 'PJOK',
    'resolveSubjectInput menyelesaikan "Pendidikan Jasmani" ke PJOK'
  );
  assert(
    subjectInputRes1.isCanonical === false,
    'Resolusi melalui alias tercatat dengan isCanonical: false'
  );

  const subjectInputRes2 = resolveSubjectInput('PJOK');
  assert(
    subjectInputRes2.status === 'RESOLVED' &&
      subjectInputRes2.subjectCode === 'PJOK' &&
      subjectInputRes2.isCanonical === true,
    'Resolusi dengan kode baku langsung tercatat dengan isCanonical: true'
  );

  const subjectInputRes3 = resolveSubjectInput('Mata Pelajaran Fiktif Yang Tidak Pernah Ada');
  assert(
    subjectInputRes3.status === 'UNRESOLVED',
    'Subject input tidak dikenal menghasilkan status UNRESOLVED'
  );

  // TEST 24: resolveCPContext Ambiguity-Safe Logic
  console.log('\n--- 24. resolveCPContext Ambiguity-Safe Logic ---');
  const cpResolved = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
  });
  assert(
    cpResolved.status === 'RESOLVED' && cpResolved.entry?.id === 'cp25-sd-fase-a-pjok',
    'resolveCPContext menyelesaikan CP PJOK Fase A dengan status RESOLVED ke entri aktif 2025'
  );

  const cpUnresolved = resolveCPContext({
    subjectCode: 'MAPEL_PALSU',
    phase: 'A',
    level: 'SD',
  });
  assert(
    cpUnresolved.status === 'UNRESOLVED',
    'resolveCPContext mengembalikan status UNRESOLVED untuk mapel yang tidak memiliki CP'
  );

  // TEST 25: All Active Rules in ALL_CURRICULUM_STRUCTURE_RULES Have Valid Evidence
  console.log('\n--- 25. All Active VERIFIED Rules Have Valid Evidence ---');
  const verifiedActiveRules = ALL_CURRICULUM_STRUCTURE_RULES.filter(
    (r) => r.verificationStatus === 'VERIFIED'
  );
  const rulesMissingEvidence = verifiedActiveRules.filter(
    (r) => !r.evidence || r.evidence.length === 0
  );
  assert(
    rulesMissingEvidence.length === 0,
    `Semua ${verifiedActiveRules.length} aturan VERIFIED memiliki bukti resmi (evidence) terdaftar tanpa celah`
  );

  // TEST 26: Evidence Validation Integrity (No Evidence vs Homepage vs Specific)
  console.log('\n--- 26. Evidence Validation Integrity ---');
  const ruleWithHomepageUrl: any = {
    id: 'test-homepage-url',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 1,
    phase: 'A',
    subjectCode: 'BINDO',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 36,
    minutesPerJP: 35,
    derivedWeeklyJP: 6,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    verificationStatus: 'VERIFIED',
    evidence: [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/', // Homepage only -> INVALID
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SD/MI',
          section: 'Kelas 1',
        },
      },
    ],
  };
  const homepageRes = validateStructureRule(ruleWithHomepageUrl);
  assert(
    homepageRes.isValid === false &&
      homepageRes.issues.some((i) => i.field === 'evidence' && i.message.includes('terlalu generik')),
    'VERIFIED rule dengan homepage-only evidence → FAIL (ditolak oleh validator)'
  );

  const ruleWithSpecificUrl: any = {
    id: 'test-specific-url',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 1,
    phase: 'A',
    subjectCode: 'BINDO',
    intrakurikulerAnnualJP: 216,
    kokurikulerAnnualJP: 72,
    totalAnnualJP: 288,
    referenceWeeksPerYear: 36,
    minutesPerJP: 35,
    derivedWeeklyJP: 6,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    verificationStatus: 'VERIFIED',
    evidence: [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SD/MI',
          section: 'Kelas 1',
        },
      },
    ],
  };
  const specificRes = validateStructureRule(ruleWithSpecificUrl);
  assert(
    specificRes.isValid === true && specificRes.issues.length === 0,
    'VERIFIED rule dengan specific official evidence → PASS (diterima oleh validator)'
  );

  // TEST 27: CP Current 2025/2026 vs Historical 2024/2025 Separation
  console.log('\n--- 27. CP Current 2025/2026 vs Historical 2024/2025 Separation ---');
  const cp2025 = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2025/2026',
  });
  assert(
    cp2025.status === 'RESOLVED' &&
      cp2025.entry?.regulationSourceId === 'DEC-BSKAP-046-2025' &&
      cp2025.entry?.id === 'cp25-sd-fase-a-pjok',
    'CP current 2025/2026 menggunakan source DEC-BSKAP-046-2025'
  );
  assert(
    cp2025.entry?.elements.some((e) => e.name === 'Terampil Bergerak') &&
      cp2025.entry?.elements.some((e) => e.name === 'Belajar melalui Gerak') &&
      cp2025.entry?.elements.some((e) => e.name === 'Bergaya Hidup Aktif') &&
      cp2025.entry?.elements.some((e) => e.name === 'Memilih Hidup yang Menyehatkan'),
    'CP current PJOK Fase A memiliki elemen terverifikasi sesuai BSKAP 046/2025'
  );

  const cp2024 = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2024/2025',
  });
  assert(
    cp2024.status === 'RESOLVED' &&
      cp2024.entry?.regulationSourceId === 'DEC-BSKAP-032-2024' &&
      cp2024.entry?.id === 'cp24-sd-fase-a-pjok',
    'CP historical 2024/2025 menggunakan source DEC-BSKAP-032-2024 dan tidak tertukar dengan current'
  );
  assert(
    cp2024.entry?.elements.some((e) => e.name === 'Keterampilan Gerak') &&
      cp2024.entry?.elements.some((e) => e.name === 'Pengetahuan Gerak'),
    'CP historical 2024/2025 mempertahankan rumusan elemen historis BSKAP 032/2024'
  );

  // TEST 28: CP Ambiguity Safety (Multiple Active Candidates)
  console.log('\n--- 28. CP Ambiguity Safety ---');
  const mockPool: any[] = [
    {
      id: 'cp-mock-a',
      subjectCode: 'IPA',
      phase: 'D',
      level: 'SMP',
      regulationSourceId: 'DEC-BSKAP-046-2025',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      generalDescription: 'Varian A',
      elements: [],
    },
    {
      id: 'cp-mock-b',
      subjectCode: 'IPA',
      phase: 'D',
      level: 'SMP',
      regulationSourceId: 'DEC-BSKAP-046-2025',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      generalDescription: 'Varian B',
      elements: [],
    },
  ];
  const ambiguousCpRes = resolveCPContext({
    subjectCode: 'IPA',
    phase: 'D',
    level: 'SMP',
    academicYear: '2025/2026',
    entriesPool: mockPool,
  });
  assert(
    ambiguousCpRes.status === 'AMBIGUOUS' &&
      ambiguousCpRes.cp === null &&
      ambiguousCpRes.candidates?.length === 2,
    'Jika terdapat > 1 kandidat CP aktif tanpa pembeda, sistem mengembalikan AMBIGUOUS tanpa memilih diam-diam'
  );

  // TEST 29: CP Unknown / Unresolved Safety
  console.log('\n--- 29. CP Unknown / Unresolved Safety ---');
  const unknownCpRes = resolveCPContext({
    subjectCode: 'MAPEL_TIDAK_DIKENAL',
    phase: 'A',
    level: 'SD',
  });
  assert(
    unknownCpRes.status === 'UNRESOLVED' && unknownCpRes.cp === null,
    'Mapel tidak dikenal menghasilkan status UNRESOLVED dengan cp: null'
  );

  // TEST 30: Regulation Registry BKPDM 020/2026 Audit
  console.log('\n--- 30. Regulation Registry BKPDM 020/2026 Audit ---');
  const reg020 = CURRICULUM_REGULATIONS.find((r) => r.id === 'DEC-BKPDM-020-2026');
  assert(reg020 !== undefined, 'Keputusan Kepala BKPDM No. 020 Tahun 2026 terdaftar di Regulation Registry');
  assert(reg020?.year === 2026, 'Tahun regulasi 020/2026 adalah 2026');
  assert(reg020?.type === 'OFFICIAL_DECISION', 'Tipe regulasi adalah OFFICIAL_DECISION');
  assert(
    reg020?.sourceUrl.startsWith('https://kurikulum.kemdikbud.go.id/'),
    'URL regulasi 020/2026 berasal dari domain resmi portal Kurikulum Kemendikdasmen'
  );
  assert(
    reg020?.legalEffectiveDate === null,
    'legalEffectiveDate 020/2026 tidak ditebak (bernilai null karena belum terbukti di naskah hukum)'
  );
  assert(
    reg020?.implementationFromAcademicYear === '2026/2027',
    'implementationFromAcademicYear 020/2026 tercatat 2026/2027'
  );

  // TEST 31: Religion Subject Canonical Helper
  console.log('\n--- 31. Religion Subject Canonical Helper ---');
  assert(isReligionSubject('PAI') === true, 'PAI diidentifikasi sebagai mapel agama');
  assert(isReligionSubject('PAK') === true, 'PAK diidentifikasi sebagai mapel agama');
  assert(isReligionSubject('PKAT') === true, 'PKAT diidentifikasi sebagai mapel agama');
  assert(isReligionSubject('PHINDU') === true, 'PHINDU diidentifikasi sebagai mapel agama');
  assert(isReligionSubject('PBUDDHA') === true, 'PBUDDHA diidentifikasi sebagai mapel agama');
  assert(isReligionSubject('PKHONGHUCU') === true, 'PKHONGHUCU diidentifikasi sebagai mapel agama');
  assert(isReligionSubject('PJOK') === false, 'PJOK BUKAN mapel agama');
  assert(isReligionSubject('MAT') === false, 'Matematika BUKAN mapel agama');
  assert(isReligionSubject('BINDO') === false, 'Bahasa Indonesia BUKAN mapel agama');
  assert(isReligionSubject('CODING_AI') === false, 'Coding & AI BUKAN mapel agama');

  // TEST 32: Non-Religion CP Persistence (020/2026 does not replace PJOK/MAT/BINDO)
  console.log('\n--- 32. Non-Religion CP Persistence ---');
  const pjok2025Res = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2025/2026',
  });
  assert(
    pjok2025Res.status === 'RESOLVED' &&
      pjok2025Res.entry?.regulationSourceId === 'DEC-BSKAP-046-2025',
    'PJOK 2025/2026 teresolusi ke CP BSKAP 046/2025'
  );

  const pjok2026Res = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2026/2027',
  });
  assert(
    pjok2026Res.status === 'RESOLVED' &&
      pjok2026Res.entry?.regulationSourceId === 'DEC-BSKAP-046-2025',
    'PJOK 2026/2027 tetap teresolusi ke CP BSKAP 046/2025 (020/2026 tidak menggantikan CP PJOK)'
  );

  const pjok2027Res = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2027/2028',
  });
  assert(
    pjok2027Res.status === 'RESOLVED' &&
      pjok2027Res.entry?.regulationSourceId === 'DEC-BSKAP-046-2025',
    'PJOK 2027/2028 tetap teresolusi ke CP BSKAP 046/2025 (open-ended hingga regulasi baru)'
  );

  const mat2026Res = resolveCPContext({
    subjectCode: 'MAT',
    phase: 'A',
    level: 'SD',
    academicYear: '2026/2027',
  });
  assert(
    mat2026Res.status === 'RESOLVED' &&
      mat2026Res.entry?.regulationSourceId !== 'DEC-BKPDM-020-2026',
    '020/2026 tidak menggantikan CP Matematika (tetap menggunakan regulasi non-agama yang berlaku)'
  );

  const bindo2026Res = resolveCPContext({
    subjectCode: 'BINDO',
    phase: 'A',
    level: 'SD',
    academicYear: '2026/2027',
  });
  assert(
    bindo2026Res.status === 'RESOLVED' &&
      bindo2026Res.entry?.regulationSourceId !== 'DEC-BKPDM-020-2026',
    '020/2026 tidak menggantikan CP Bahasa Indonesia (tetap menggunakan regulasi non-agama yang berlaku)'
  );

  // TEST 33: Religion CP Versioning (2025/2026 vs 2026/2027 across all religions)
  console.log('\n--- 33. Religion CP Versioning (2025/2026 vs 2026/2027) ---');
  const religionCodes = ['PAI', 'PAK', 'PKAT', 'PHINDU', 'PBUDDHA', 'PKHONGHUCU'];

  for (const relCode of religionCodes) {
    // SD Fase A
    const sdRel2025 = resolveCPContext({
      subjectCode: relCode,
      phase: 'A',
      level: 'SD',
      academicYear: '2025/2026',
    });
    assert(
      sdRel2025.status === 'RESOLVED' &&
        sdRel2025.entry?.regulationSourceId === 'DEC-BSKAP-046-2025',
      `SD Fase A ${relCode} 2025/2026 teresolusi ke CP BSKAP 046/2025`
    );

    const sdRel2026 = resolveCPContext({
      subjectCode: relCode,
      phase: 'A',
      level: 'SD',
      academicYear: '2026/2027',
    });
    assert(
      sdRel2026.status === 'RESOLVED' &&
        sdRel2026.entry?.regulationSourceId === 'DEC-BKPDM-020-2026',
      `SD Fase A ${relCode} 2026/2027 teresolusi ke CP BKPDM 020/2026`
    );

    // SMP Fase D
    const smpRel2025 = resolveCPContext({
      subjectCode: relCode,
      phase: 'D',
      level: 'SMP',
      academicYear: '2025/2026',
    });
    assert(
      smpRel2025.status === 'RESOLVED' &&
        smpRel2025.entry?.regulationSourceId === 'DEC-BSKAP-046-2025',
      `SMP Fase D ${relCode} 2025/2026 teresolusi ke CP BSKAP 046/2025`
    );

    const smpRel2026 = resolveCPContext({
      subjectCode: relCode,
      phase: 'D',
      level: 'SMP',
      academicYear: '2026/2027',
    });
    assert(
      smpRel2026.status === 'RESOLVED' &&
        smpRel2026.entry?.regulationSourceId === 'DEC-BKPDM-020-2026',
      `SMP Fase D ${relCode} 2026/2027 teresolusi ke CP BKPDM 020/2026`
    );

    // SMA Fase E
    const smaRel2025 = resolveCPContext({
      subjectCode: relCode,
      phase: 'E',
      level: 'SMA',
      academicYear: '2025/2026',
    });
    assert(
      smaRel2025.status === 'RESOLVED' &&
        smaRel2025.entry?.regulationSourceId === 'DEC-BSKAP-046-2025',
      `SMA Fase E ${relCode} 2025/2026 teresolusi ke CP BSKAP 046/2025`
    );

    const smaRel2026 = resolveCPContext({
      subjectCode: relCode,
      phase: 'E',
      level: 'SMA',
      academicYear: '2026/2027',
    });
    assert(
      smaRel2026.status === 'RESOLVED' &&
        smaRel2026.entry?.regulationSourceId === 'DEC-BKPDM-020-2026',
      `SMA Fase E ${relCode} 2026/2027 teresolusi ke CP BKPDM 020/2026`
    );
  }

  // TEST 34: CP Validator Enforcement
  console.log('\n--- 34. CP Validator Enforcement ---');
  // a. Non-religion CP using 020/2026 → ERROR
  const invalidNonReligionCP: any = {
    id: 'cp-invalid-pjok-020',
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    verificationStatus: 'UNVERIFIED',
    generalDescription: 'Test PJOK with 020',
    elements: [],
  };
  const invalidCPRes1 = validateCPEntry(invalidNonReligionCP);
  assert(
    invalidCPRes1.isValid === false &&
      invalidCPRes1.issues.some((i) => i.field === 'regulationSourceId'),
    'CP non-agama yang menggunakan regulasi 020/2026 ditolak oleh validator (ERROR)'
  );

  // b. effectiveFrom > effectiveUntil → ERROR
  const invalidPeriodCP: any = {
    id: 'cp-invalid-period',
    subjectCode: 'MAT',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    verificationStatus: 'UNVERIFIED',
    effectiveFrom: '2026-07-01',
    effectiveUntil: '2025-06-30',
    generalDescription: 'Test inverted period',
    elements: [],
  };
  const invalidCPRes2 = validateCPEntry(invalidPeriodCP);
  assert(
    invalidCPRes2.isValid === false &&
      invalidCPRes2.issues.some((i) => i.field === 'effectivePeriod'),
    'CP dengan effectiveFrom > effectiveUntil ditolak oleh validator (ERROR)'
  );

  // c. Validasi seluruh Master CP dataset
  const cpValidationSummary = validateAllCPEntries();
  assert(
    cpValidationSummary.valid === true,
    `Seluruh master CP entries valid tanpa error (total: ${cpValidationSummary.totalCPs} CP, verified: ${cpValidationSummary.verifiedCPs}, unverified: ${cpValidationSummary.unverifiedCPs})`
  );

  // TEST 35: CP Ambiguity & Unresolved Safety
  console.log('\n--- 35. CP Ambiguity & Unresolved Safety ---');
  const unknownMapelCP = resolveCPContext({
    subjectCode: 'KIMIA_GAIB',
    phase: 'E',
    level: 'SMA',
  });
  assert(
    unknownMapelCP.status === 'UNRESOLVED' && unknownMapelCP.cp === null,
    'Subjek yang tidak dikenal menghasilkan status UNRESOLVED'
  );

  const duplicateCandidatePool: any[] = [
    {
      id: 'cp-dup-1',
      subjectCode: 'BINDO',
      phase: 'D',
      level: 'SMP',
      regulationSourceId: 'DEC-BSKAP-046-2025',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      generalDescription: 'Versi 1',
      elements: [],
    },
    {
      id: 'cp-dup-2',
      subjectCode: 'BINDO',
      phase: 'D',
      level: 'SMP',
      regulationSourceId: 'DEC-BSKAP-046-2025',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      generalDescription: 'Versi 2',
      elements: [],
    },
  ];
  const duplicateCPRes = resolveCPContext({
    subjectCode: 'BINDO',
    phase: 'D',
    level: 'SMP',
    academicYear: '2025/2026',
    entriesPool: duplicateCandidatePool,
  });
  assert(
    duplicateCPRes.status === 'AMBIGUOUS' &&
      duplicateCPRes.cp === null &&
      duplicateCPRes.candidates?.length === 2,
    'Kandidat CP ganda aktif menghasilkan status AMBIGUOUS tanpa memilih diam-diam'
  );

  // TEST 36: Academic Year Parser Strictness
  console.log('\n--- 36. Academic Year Parser Strictness ---');
  assert(parseAcademicYearStart('2025/2026') === 2025, '2025/2026 -> 2025 (valid)');
  assert(parseAcademicYearStart('2026/2027') === 2026, '2026/2027 -> 2026 (valid)');
  assert(parseAcademicYearStart('2025') === null, '2025 -> null (invalid format)');
  assert(parseAcademicYearStart('2025/2027') === null, '2025/2027 -> null (invalid step: 2027 !== 2025 + 1)');
  assert(parseAcademicYearStart('abc2025') === null, 'abc2025 -> null (invalid alphanumeric prefix)');
  assert(parseAcademicYearStart('2025-2026') === null, '2025-2026 -> null (hyphen format is invalid)');
  assert(parseAcademicYearStart(null) === null, 'null -> null');
  assert(parseAcademicYearStart(undefined) === null, 'undefined -> null');
  assert(parseAcademicYearStart('') === null, 'empty string -> null');

  // TEST 37: Missing Metadata Applicability Safety (No Guessing from effectiveFrom / legalEffectiveDate)
  console.log('\n--- 37. Missing Metadata Applicability Safety ---');
  const cpMissingImpYearWithEffectiveFrom: any = {
    id: 'cp-fixture-missing-impyear',
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    verificationStatus: 'UNVERIFIED',
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: null,
    generalDescription: 'Fixture missing imp year',
    elements: [],
  };
  assert(
    isCPApplicableForAcademicYear(cpMissingImpYearWithEffectiveFrom, '2025/2026') === false,
    'CP tanpa implementationFromAcademicYear meskipun memiliki effectiveFrom TIDAK applicable (no guessing)'
  );

  const resolveMissingRes = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2025/2026',
    entriesPool: [cpMissingImpYearWithEffectiveFrom],
  });
  assert(
    resolveMissingRes.status === 'UNRESOLVED' && resolveMissingRes.cp === null,
    'Resolver menghasilkan UNRESOLVED ketika entri tidak memiliki implementationFromAcademicYear'
  );

  // TEST 38: effectiveUntil Ignored by Academic-Year Resolver
  console.log('\n--- 38. effectiveUntil Ignored by Academic-Year Resolver ---');
  const cpWithEffectiveUntilFixture: any = {
    id: 'cp-fixture-eff-until',
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    verificationStatus: 'UNVERIFIED',
    implementationFromAcademicYear: '2025/2026',
    implementationUntilAcademicYear: null,
    effectiveUntil: '2025-06-30', // Tanggal kalender ini tidak boleh membatasi tahun ajaran
    generalDescription: 'Fixture open-ended academic year with calendar effectiveUntil',
    elements: [],
  };
  assert(
    isCPApplicableForAcademicYear(cpWithEffectiveUntilFixture, '2026/2027') === true,
    'effectiveUntil tidak membatasi tahun ajaran jika implementationUntilAcademicYear adalah null (open-ended)'
  );

  // TEST 39: Invalid Academic Year Input Handling
  console.log('\n--- 39. Invalid Academic Year Input Handling ---');
  const invalidAYRes1 = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2025-2026', // Format tidak valid
  });
  assert(
    invalidAYRes1.status === 'UNRESOLVED' && invalidAYRes1.cp === null,
    'Input tahun ajaran format invalid ("2025-2026") menghasilkan status UNRESOLVED'
  );

  const invalidAYRes2 = resolveCPContext({
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    academicYear: '2025', // 4 digit tanpa pasangannya
  });
  assert(
    invalidAYRes2.status === 'UNRESOLVED' && invalidAYRes2.cp === null,
    'Input tahun ajaran format invalid ("2025") menghasilkan status UNRESOLVED'
  );

  // TEST 40: Closed-Range vs Open-Ended Multi-Year Lifecycle
  console.log('\n--- 40. Closed-Range vs Open-Ended Multi-Year Lifecycle ---');
  // Closed-range test (Religion 2025/2026):
  const paiSd2025 = resolveCPContext({
    subjectCode: 'PAI',
    phase: 'A',
    level: 'SD',
    academicYear: '2025/2026',
  });
  assert(
    paiSd2025.status === 'RESOLVED' && paiSd2025.entry?.regulationSourceId === 'DEC-BSKAP-046-2025',
    'PAI 2025/2026 teresolusi ke 046/2025 (closed range: 2025/2026 - 2025/2026)'
  );

  const paiSd2026 = resolveCPContext({
    subjectCode: 'PAI',
    phase: 'A',
    level: 'SD',
    academicYear: '2026/2027',
  });
  assert(
    paiSd2026.status === 'RESOLVED' && paiSd2026.entry?.regulationSourceId === 'DEC-BKPDM-020-2026',
    'PAI 2026/2027 teresolusi ke 020/2026 (open-ended from 2026/2027)'
  );

  const paiSd2027 = resolveCPContext({
    subjectCode: 'PAI',
    phase: 'A',
    level: 'SD',
    academicYear: '2027/2028',
  });
  assert(
    paiSd2027.status === 'RESOLVED' && paiSd2027.entry?.regulationSourceId === 'DEC-BKPDM-020-2026',
    'PAI 2027/2028 tetap teresolusi ke 020/2026 (open-ended from 2026/2027)'
  );

  // TEST 41: Static Regression Guard on isCPApplicableForAcademicYear Code Structure
  console.log('\n--- 41. Static Regression Guard on isCPApplicableForAcademicYear ---');
  const cpIndexFilePath = path.join(process.cwd(), 'src/data/curriculum/cp/index.ts');
  const cpIndexCode = fs.readFileSync(cpIndexFilePath, 'utf-8');

  // Extract isCPApplicableForAcademicYear function body
  const fnMatch = cpIndexCode.match(/export function isCPApplicableForAcademicYear\([\s\S]*?\n\}/);
  assert(fnMatch !== null, 'Fungsi isCPApplicableForAcademicYear ditemukan dalam cp/index.ts');

  if (fnMatch) {
    const fnBody = fnMatch[0];
    assert(!fnBody.includes('effectiveFrom'), 'isCPApplicableForAcademicYear TIDAK mengandung "effectiveFrom" fallback');
    assert(!fnBody.includes('effectiveUntil'), 'isCPApplicableForAcademicYear TIDAK mengandung "effectiveUntil" fallback');
    assert(!fnBody.includes('legalEffectiveDate'), 'isCPApplicableForAcademicYear TIDAK mengandung "legalEffectiveDate" fallback');
    assert(!fnBody.includes('.slice'), 'isCPApplicableForAcademicYear TIDAK memotong tanggal dengan .slice()');
    assert(!fnBody.includes('07-01'), 'isCPApplicableForAcademicYear TIDAK mengandung tanggal sintetis "07-01"');
    assert(!fnBody.includes('2026-07-01'), 'isCPApplicableForAcademicYear TIDAK mengandung tanggal sintetis "2026-07-01"');
    assert(!fnBody.includes('new Date()') && !fnBody.includes('Date.now()'), 'isCPApplicableForAcademicYear TIDAK bergantung pada clock runtime');
  }

  console.log('\n===========================================================');
  console.log('🎉 ALL CURRICULUM MASTER TESTS PASSED SUCCESSFULLY!');
  console.log('===========================================================');
}

runCurriculumMasterTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
