import * as fs from 'fs';
import * as path from 'path';

const RELIGIONS = ['PAI', 'PAK', 'PKAT', 'PHINDU', 'PBUDDHA', 'PKHONGHUCU'];
const ART_SD = ['SENI_RUPA', 'SENI_MUSIK', 'SENI_TARI', 'SENI_TEATER'];
const ART_SMP = ['SENI_RUPA', 'SENI_MUSIK', 'SENI_TARI', 'SENI_TEATER', 'PRAKARYA'];
const ART_SMA = ['SENI_RUPA', 'SENI_MUSIK', 'SENI_TARI', 'SENI_TEATER'];

function jsonProps(obj: Record<string, any>, indent = 4): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    lines.push(`${pad}${k}: ${JSON.stringify(v, null, 2).replace(/\n/g, '\n' + pad)},`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 1. GENERATE SD
// ---------------------------------------------------------------------------
function generateSD(): string {
  const rules: any[] = [];

  // --- 2024 SD Grade 1-6 ---
  for (let grade = 1; grade <= 6; grade++) {
    const phase = grade <= 2 ? 'A' : grade <= 4 ? 'B' : 'C';
    const weeks = grade === 6 ? 32 : 36;
    const factor = weeks;

    const baseEvidence24 = [
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SD/MI',
          section: `Kelas ${grade}`,
        },
      },
    ];

    // Agama
    for (const rel of RELIGIONS) {
      rules.push({
        id: `km-sd-${grade}-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SD',
        grade,
        phase,
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 3 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 4 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 35,
        derivedWeeklyJP: 3,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Pendidikan Agama dan Budi Pekerti SD Kelas ${grade} (3 JP/minggu)`,
      });
    }

    // Pancasila
    rules.push({
      id: `km-sd-${grade}-pancasila`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'PANCASILA',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 4 * factor,
      kokurikulerAnnualJP: 1 * factor,
      totalAnnualJP: 5 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 4,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Pendidikan Pancasila SD Kelas ${grade} (4 JP/minggu)`,
    });

    // Bahasa Indonesia
    const bindoWeekly = grade === 1 ? 6 : grade === 2 ? 7 : 6;
    const bindoKokuWeekly = grade <= 2 ? 2 : 1;
    rules.push({
      id: `km-sd-${grade}-bindo`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'BINDO',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: bindoWeekly * factor,
      kokurikulerAnnualJP: bindoKokuWeekly * factor,
      totalAnnualJP: (bindoWeekly + bindoKokuWeekly) * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: bindoWeekly,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Bahasa Indonesia SD Kelas ${grade} (${bindoWeekly} JP/minggu)`,
    });

    // Matematika
    const matWeekly = grade === 1 ? 4 : 5;
    rules.push({
      id: `km-sd-${grade}-mat`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'MAT',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: matWeekly * factor,
      kokurikulerAnnualJP: 1 * factor,
      totalAnnualJP: (matWeekly + 1) * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: matWeekly,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Matematika SD Kelas ${grade} (${matWeekly} JP/minggu)`,
    });

    // IPAS (Grade 3-6)
    if (grade >= 3) {
      rules.push({
        id: `km-sd-${grade}-ipas`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SD',
        grade,
        phase,
        subjectCode: 'IPAS',
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 5 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 6 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 35,
        derivedWeeklyJP: 5,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `IPAS SD Kelas ${grade} (5 JP/minggu)`,
      });
    }

    // PJOK
    rules.push({
      id: `km-sd-${grade}-pjok`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'PJOK',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 3 * factor,
      kokurikulerAnnualJP: 1 * factor,
      totalAnnualJP: 4 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 3,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `PJOK SD Kelas ${grade} (3 JP/minggu)`,
    });

    // Seni Budaya (Pilihan Cabang, Group Required)
    for (const art of ART_SD) {
      rules.push({
        id: `km-sd-${grade}-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SD',
        grade,
        phase,
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_BUDAYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: 3 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 4 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 35,
        derivedWeeklyJP: 3,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Seni Budaya SD Kelas ${grade} (${art}) - Pilihan cabang kelompok Seni Budaya (3 JP/minggu)`,
      });
    }

    // Bahasa Inggris (Pilihan)
    rules.push({
      id: `km-sd-${grade}-bing`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'BING',
      subjectType: 'ELECTIVE',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Bahasa Inggris SD Kelas ${grade} (2 JP/minggu)`,
    });

    // Muatan Lokal
    rules.push({
      id: `km-sd-${grade}-local-content`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Muatan Lokal SD Kelas ${grade} (2 JP/minggu)`,
    });
  }

  // --- 2025/2026 SD Grade 1-6 ---
  for (let grade = 1; grade <= 6; grade++) {
    const phase = grade <= 2 ? 'A' : grade <= 4 ? 'B' : 'C';
    const weeks = grade === 6 ? 32 : 36;
    const factor = weeks;

    const baseEvidence25 = [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SD/MI',
          section: `Kelas ${grade}`,
        },
      },
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SD/MI',
          section: `Kelas ${grade}`,
        },
      },
    ];

    // Agama
    for (const rel of RELIGIONS) {
      rules.push({
        id: `km25-sd-${grade}-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SD',
        grade,
        phase,
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 3 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 4 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 35,
        derivedWeeklyJP: 3,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Pendidikan Agama dan Budi Pekerti SD Kelas ${grade} TA 2025/2026 (3 JP/minggu intrakurikuler + 1 JP Kokurikuler)`,
      });
    }

    // Pancasila
    rules.push({
      id: `km25-sd-${grade}-pancasila`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'PANCASILA',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 4 * factor,
      kokurikulerAnnualJP: 1 * factor,
      totalAnnualJP: 5 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 4,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Pendidikan Pancasila SD Kelas ${grade} TA 2025/2026 (4 JP/minggu)`,
    });

    // Bahasa Indonesia
    const bindoWeekly = grade === 1 ? 6 : grade === 2 ? 7 : 6;
    const bindoKokuWeekly = grade <= 2 ? 2 : 1;
    rules.push({
      id: `km25-sd-${grade}-bindo`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'BINDO',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: bindoWeekly * factor,
      kokurikulerAnnualJP: bindoKokuWeekly * factor,
      totalAnnualJP: (bindoWeekly + bindoKokuWeekly) * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: bindoWeekly,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Bahasa Indonesia SD Kelas ${grade} TA 2025/2026 (${bindoWeekly} JP/minggu intrakurikuler + ${bindoKokuWeekly} JP Kokurikuler)`,
    });

    // Matematika
    const matWeekly = grade === 1 ? 4 : 5;
    rules.push({
      id: `km25-sd-${grade}-mat`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'MAT',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: matWeekly * factor,
      kokurikulerAnnualJP: 1 * factor,
      totalAnnualJP: (matWeekly + 1) * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: matWeekly,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Matematika SD Kelas ${grade} TA 2025/2026 (${matWeekly} JP/minggu)`,
    });

    // IPAS (Grade 3-6)
    if (grade >= 3) {
      rules.push({
        id: `km25-sd-${grade}-ipas`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SD',
        grade,
        phase,
        subjectCode: 'IPAS',
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 5 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 6 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 35,
        derivedWeeklyJP: 5,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `IPAS SD Kelas ${grade} TA 2025/2026 (5 JP/minggu)`,
      });
    }

    // PJOK
    rules.push({
      id: `km25-sd-${grade}-pjok`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'PJOK',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 3 * factor,
      kokurikulerAnnualJP: 1 * factor,
      totalAnnualJP: 4 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 3,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `PJOK SD Kelas ${grade} TA 2025/2026 (3 JP/minggu)`,
    });

    // Seni Budaya (Pilihan Cabang, Group Required)
    for (const art of ART_SD) {
      rules.push({
        id: `km25-sd-${grade}-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SD',
        grade,
        phase,
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_BUDAYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: 3 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 4 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 35,
        derivedWeeklyJP: 3,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Seni Budaya SD Kelas ${grade} (${art}) - Pilihan cabang kelompok Seni Budaya TA 2025/2026 (3 JP/minggu)`,
      });
    }

    // Bahasa Inggris (Pilihan)
    rules.push({
      id: `km25-sd-${grade}-bing`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'BING',
      subjectType: 'ELECTIVE',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Bahasa Inggris SD Kelas ${grade} TA 2025/2026 (2 JP/minggu)`,
    });

    // Muatan Lokal
    rules.push({
      id: `km25-sd-${grade}-local-content`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SD',
      grade,
      phase,
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 35,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Muatan Lokal SD Kelas ${grade} TA 2025/2026 (2 JP/minggu)`,
    });
  }

  // --- KODING DAN KECERDASAN ARTIFISIAL SD (Permendikdasmen 13/2025) ---
  // Kelas 5: VERIFIED
  rules.push({
    id: 'km25-sd-5-coding-ai',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 5,
    phase: 'C',
    subjectCode: 'CODING_AI',
    subjectType: 'ELECTIVE',
    intrakurikulerAnnualJP: 72,
    kokurikulerAnnualJP: 0,
    totalAnnualJP: 72,
    referenceWeeksPerYear: 36,
    minutesPerJP: 35,
    derivedWeeklyJP: 2,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    evidence: [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
        locator: {
          attachment: 'Lampiran II',
          section: 'Pasal 32A & Lampiran II Struktur Kurikulum SD/MI',
          table: 'Alokasi Waktu Mata Pelajaran SD/MI Kelas V',
          note: 'Alokasi Koding dan Kecerdasan Artifisial Kelas 5 SD (2 JP/minggu, 72 JP/tahun)',
        },
      },
    ],
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'VERIFIED',
    notes: 'Koding dan Kecerdasan Artifisial sebagai mapel pilihan SD Kelas 5 TA 2025/2026 (2 JP/minggu)',
  });

  // Kelas 4 & 6: UNVERIFIED (belum diverifikasi secara eksplisit per kelas per tahun)
  rules.push({
    id: 'km25-sd-4-coding-ai',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 4,
    phase: 'B',
    subjectCode: 'CODING_AI',
    subjectType: 'ELECTIVE',
    intrakurikulerAnnualJP: 72,
    kokurikulerAnnualJP: 0,
    totalAnnualJP: 72,
    referenceWeeksPerYear: 36,
    minutesPerJP: 35,
    derivedWeeklyJP: 2,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes: 'Koding dan Kecerdasan Artifisial belum diverifikasi implementasinya untuk SD Kelas 4 pada TA 2025/2026 (status UNVERIFIED)',
  });

  rules.push({
    id: 'km25-sd-6-coding-ai',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 6,
    phase: 'C',
    subjectCode: 'CODING_AI',
    subjectType: 'ELECTIVE',
    intrakurikulerAnnualJP: 64,
    kokurikulerAnnualJP: 0,
    totalAnnualJP: 64,
    referenceWeeksPerYear: 32,
    minutesPerJP: 35,
    derivedWeeklyJP: 2,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes: 'Koding dan Kecerdasan Artifisial belum diverifikasi secara spesifik per kelas untuk SD Kelas 6 pada TA 2025/2026 (status UNVERIFIED)',
  });

  // --- K13 SD (Grade 4-6) ---
  for (const grade of [4, 5, 6]) {
    const weeks = grade === 6 ? 32 : 36;
    const k13Evidence = [
      {
        regulationId: 'REG-PERMENDIKBUD-37-2018',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=2178',
        locator: {
          attachment: 'Lampiran',
          table: 'Struktur Kurikulum SD/MI',
          section: `Beban Belajar dan KI-KD SD Kelas ${grade}`,
        },
      },
    ];

    const k13Subjects = [
      { code: 'PAI', weekly: 4, name: 'PAI' },
      { code: 'PANCASILA', weekly: 4, name: 'PPKn' },
      { code: 'BINDO', weekly: 7, name: 'Bahasa Indonesia' },
      { code: 'MAT', weekly: 6, name: 'Matematika' },
      { code: 'IPA', weekly: 3, name: 'IPA' },
      { code: 'IPS', weekly: 3, name: 'IPS' },
      { code: 'SENI_RUPA', weekly: 4, name: 'Seni Budaya dan Prakarya (SBdP)' },
      { code: 'PJOK', weekly: 4, name: 'PJOK' },
      { code: 'LOCAL_CONTENT', weekly: 2, name: 'Muatan Lokal', type: 'LOCAL_CONTENT' },
    ];

    for (const sub of k13Subjects) {
      rules.push({
        id: `k13-sd-${grade}-${sub.code.toLowerCase()}`,
        curriculumType: 'K13',
        level: 'SD',
        grade,
        subjectCode: sub.code,
        subjectType: sub.type || 'REQUIRED',
        intrakurikulerAnnualJP: sub.weekly * weeks,
        kokurikulerAnnualJP: 0,
        totalAnnualJP: sub.weekly * weeks,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 35,
        derivedWeeklyJP: sub.weekly,
        regulationIds: ['REG-PERMENDIKBUD-37-2018'],
        evidence: k13Evidence,
        effectiveFrom: '2018-12-21',
        verificationStatus: 'VERIFIED',
        notes: `K13 SD Kelas ${grade} ${sub.name} (${sub.weekly} JP/minggu)`,
      });
    }
  }

  return `import { CurriculumStructureRule } from '../types';

/**
 * STRUKTUR KURIKULUM RESMI JENJANG SEKOLAH DASAR (SD / MI)
 * KELAS 1 SAMPAI KELAS 6
 *
 * Regulasi Rujukan:
 * - Permendikbudristek No. 12 Tahun 2024 (Lampiran II: Struktur Kurikulum SD)
 * - Permendikdasmen No. 13 Tahun 2025 (Pembaruan Mapel Pilihan Coding dan AI)
 * - Permendikbud No. 37 Tahun 2018 (Struktur & KD Kurikulum 2013)
 */
export const SD_STRUCTURE_RULES: CurriculumStructureRule[] = [
${rules.map((r) => '  {\n' + jsonProps(r, 4) + '\n  },').join('\n')}
];
`;
}

// ---------------------------------------------------------------------------
// 2. GENERATE SMP
// ---------------------------------------------------------------------------
function generateSMP(): string {
  const rules: any[] = [];

  const smpBaseMap = [
    { code: 'PANCASILA', weekly: 2, name: 'Pendidikan Pancasila' },
    { code: 'BINDO', weekly: 5, name: 'Bahasa Indonesia' },
    { code: 'MAT', weekly: 4, name: 'Matematika' },
    { code: 'IPA', weekly: 4, name: 'Ilmu Pengetahuan Alam' },
    { code: 'IPS', weekly: 3, name: 'Ilmu Pengetahuan Sosial' },
    { code: 'BING', weekly: 3, name: 'Bahasa Inggris' },
    { code: 'PJOK', weekly: 2, name: 'PJOK' },
    { code: 'INFORMATIKA', weekly: 2, name: 'Informatika' },
  ];

  // --- 2024 SMP Grade 7-9 ---
  for (let grade = 7; grade <= 9; grade++) {
    const weeks = grade === 9 ? 32 : 36;
    const factor = weeks;

    const baseEvidence24 = [
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran III',
          table: 'Alokasi Waktu Mata Pelajaran SMP/MTs',
          section: `Kelas ${grade}`,
        },
      },
    ];

    // Agama
    for (const rel of RELIGIONS) {
      rules.push({
        id: `km-smp-${grade}-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade,
        phase: 'D',
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 3 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 4 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 40,
        derivedWeeklyJP: 3,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Pendidikan Agama dan Budi Pekerti SMP Kelas ${grade} (3 JP/minggu)`,
      });
    }

    // Core mapel
    for (const m of smpBaseMap) {
      rules.push({
        id: `km-smp-${grade}-${m.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade,
        phase: 'D',
        subjectCode: m.code,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: m.weekly * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: (m.weekly + 1) * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 40,
        derivedWeeklyJP: m.weekly,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `${m.name} SMP Kelas ${grade} (${m.weekly} JP/minggu)`,
      });
    }

    // Seni & Prakarya (Pilihan, Group Required)
    for (const art of ART_SMP) {
      rules.push({
        id: `km-smp-${grade}-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade,
        phase: 'D',
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_PRAKARYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: 2 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 3 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 40,
        derivedWeeklyJP: 2,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Seni/Prakarya SMP Kelas ${grade} (${art}) - Pilihan cabang kelompok Seni & Prakarya (2 JP/minggu)`,
      });
    }

    // Muatan Lokal
    rules.push({
      id: `km-smp-${grade}-local-content`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMP',
      grade,
      phase: 'D',
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 40,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Muatan Lokal SMP Kelas ${grade} (2 JP/minggu)`,
    });
  }

  // --- 2025/2026 SMP Grade 7-9 ---
  for (let grade = 7; grade <= 9; grade++) {
    const weeks = grade === 9 ? 32 : 36;
    const factor = weeks;

    const baseEvidence25 = [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SMP/MTs',
          section: `Kelas ${grade}`,
        },
      },
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran III',
          table: 'Alokasi Waktu Mata Pelajaran SMP/MTs',
          section: `Kelas ${grade}`,
        },
      },
    ];

    // Agama
    for (const rel of RELIGIONS) {
      rules.push({
        id: `km25-smp-${grade}-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade,
        phase: 'D',
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 3 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 4 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 40,
        derivedWeeklyJP: 3,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Pendidikan Agama dan Budi Pekerti SMP Kelas ${grade} TA 2025/2026 (3 JP/minggu intrakurikuler + 1 JP Kokurikuler)`,
      });
    }

    // Core mapel
    for (const m of smpBaseMap) {
      rules.push({
        id: `km25-smp-${grade}-${m.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade,
        phase: 'D',
        subjectCode: m.code,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: m.weekly * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: (m.weekly + 1) * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 40,
        derivedWeeklyJP: m.weekly,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `${m.name} SMP Kelas ${grade} TA 2025/2026 (${m.weekly} JP/minggu intrakurikuler + 1 JP Kokurikuler)`,
      });
    }

    // Seni & Prakarya (Pilihan, Group Required)
    for (const art of ART_SMP) {
      rules.push({
        id: `km25-smp-${grade}-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMP',
        grade,
        phase: 'D',
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_PRAKARYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: 2 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 3 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 40,
        derivedWeeklyJP: 2,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Seni/Prakarya SMP Kelas ${grade} (${art}) - Pilihan cabang kelompok Seni & Prakarya TA 2025/2026 (2 JP/minggu)`,
      });
    }

    // Muatan Lokal
    rules.push({
      id: `km25-smp-${grade}-local-content`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMP',
      grade,
      phase: 'D',
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 40,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Muatan Lokal SMP Kelas ${grade} TA 2025/2026 (2 JP/minggu)`,
    });
  }

  // --- KODING DAN KECERDASAN ARTIFISIAL SMP (Permendikdasmen 13/2025) ---
  // Kelas 7: VERIFIED
  rules.push({
    id: 'km25-smp-7-coding-ai',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 7,
    phase: 'D',
    subjectCode: 'CODING_AI',
    subjectType: 'ELECTIVE',
    intrakurikulerAnnualJP: 72,
    kokurikulerAnnualJP: 0,
    totalAnnualJP: 72,
    referenceWeeksPerYear: 36,
    minutesPerJP: 40,
    derivedWeeklyJP: 2,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    evidence: [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
        locator: {
          attachment: 'Lampiran II',
          section: 'Pasal 32A & Lampiran II Struktur Kurikulum SMP/MTs',
          table: 'Alokasi Waktu Mata Pelajaran SMP/MTs Kelas VII',
          note: 'Alokasi Koding dan Kecerdasan Artifisial Kelas 7 SMP (2 JP/minggu, 72 JP/tahun)',
        },
      },
    ],
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'VERIFIED',
    notes: 'Koding dan Kecerdasan Artifisial sebagai mapel pilihan SMP Kelas 7 TA 2025/2026 (2 JP/minggu)',
  });

  // Kelas 8 & 9: UNVERIFIED
  rules.push({
    id: 'km25-smp-8-coding-ai',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 8,
    phase: 'D',
    subjectCode: 'CODING_AI',
    subjectType: 'ELECTIVE',
    intrakurikulerAnnualJP: 72,
    kokurikulerAnnualJP: 0,
    totalAnnualJP: 72,
    referenceWeeksPerYear: 36,
    minutesPerJP: 40,
    derivedWeeklyJP: 2,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes: 'Koding dan Kecerdasan Artifisial belum diverifikasi secara spesifik per kelas untuk SMP Kelas 8 pada TA 2025/2026 (status UNVERIFIED)',
  });

  rules.push({
    id: 'km25-smp-9-coding-ai',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SMP',
    grade: 9,
    phase: 'D',
    subjectCode: 'CODING_AI',
    subjectType: 'ELECTIVE',
    intrakurikulerAnnualJP: 64,
    kokurikulerAnnualJP: 0,
    totalAnnualJP: 64,
    referenceWeeksPerYear: 32,
    minutesPerJP: 40,
    derivedWeeklyJP: 2,
    regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes: 'Koding dan Kecerdasan Artifisial belum diverifikasi secara spesifik per kelas untuk SMP Kelas 9 pada TA 2025/2026 (status UNVERIFIED)',
  });

  // --- K13 SMP (Grade 7-9) ---
  for (const grade of [7, 8, 9]) {
    const weeks = grade === 9 ? 32 : 36;
    const k13Evidence = [
      {
        regulationId: 'REG-PERMENDIKBUD-35-2018',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=2180',
        locator: {
          attachment: 'Lampiran',
          table: 'Struktur Kurikulum SMP/MTs',
          section: `Alokasi Beban Belajar SMP Kelas ${grade}`,
        },
      },
    ];

    const k13Subjects = [
      { code: 'PAI', weekly: 3, name: 'PAI' },
      { code: 'PANCASILA', weekly: 3, name: 'PPKn' },
      { code: 'BINDO', weekly: 6, name: 'Bahasa Indonesia' },
      { code: 'MAT', weekly: 5, name: 'Matematika' },
      { code: 'IPA', weekly: 5, name: 'IPA' },
      { code: 'IPS', weekly: 4, name: 'IPS' },
      { code: 'BING', weekly: 4, name: 'Bahasa Inggris' },
      { code: 'SENI_RUPA', weekly: 3, name: 'Seni Budaya' },
      { code: 'PJOK', weekly: 3, name: 'PJOK' },
      { code: 'PRAKARYA', weekly: 2, name: 'Prakarya' },
      { code: 'LOCAL_CONTENT', weekly: 2, name: 'Muatan Lokal', type: 'LOCAL_CONTENT' },
    ];

    for (const sub of k13Subjects) {
      rules.push({
        id: `k13-smp-${grade}-${sub.code.toLowerCase()}`,
        curriculumType: 'K13',
        level: 'SMP',
        grade,
        subjectCode: sub.code,
        subjectType: sub.type || 'REQUIRED',
        intrakurikulerAnnualJP: sub.weekly * weeks,
        kokurikulerAnnualJP: 0,
        totalAnnualJP: sub.weekly * weeks,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 40,
        derivedWeeklyJP: sub.weekly,
        regulationIds: ['REG-PERMENDIKBUD-35-2018'],
        evidence: k13Evidence,
        effectiveFrom: '2018-12-01',
        verificationStatus: 'VERIFIED',
        notes: `K13 SMP Kelas ${grade} ${sub.name} (${sub.weekly} JP/minggu)`,
      });
    }
  }

  return `import { CurriculumStructureRule } from '../types';

/**
 * STRUKTUR KURIKULUM RESMI JENJANG SEKOLAH MENENGAH PERTAMA (SMP / MTs)
 * KELAS 7 SAMPAI KELAS 9
 *
 * Regulasi Rujukan:
 * - Permendikbudristek No. 12 Tahun 2024 (Lampiran III: Struktur Kurikulum SMP)
 * - Permendikdasmen No. 13 Tahun 2025 (Pembaruan Mapel Pilihan Coding dan AI)
 * - Permendikbud No. 35 Tahun 2018 (Struktur Kurikulum 2013 SMP)
 */
export const SMP_STRUCTURE_RULES: CurriculumStructureRule[] = [
${rules.map((r) => '  {\n' + jsonProps(r, 4) + '\n  },').join('\n')}
];
`;
}

// ---------------------------------------------------------------------------
// 3. GENERATE SMA
// ---------------------------------------------------------------------------
function generateSMA(): string {
  const rules: any[] = [];

  const smaElectivesF = [
    { code: 'BIOLOGI', name: 'Biologi' },
    { code: 'KIMIA', name: 'Kimia' },
    { code: 'FISIKA', name: 'Fisika' },
    { code: 'INFORMATIKA', name: 'Informatika' },
    { code: 'MAT_LANJUT', name: 'Matematika Tingkat Lanjut' },
    { code: 'SOSIOLOGI', name: 'Sosiologi' },
    { code: 'EKONOMI', name: 'Ekonomi' },
    { code: 'GEOGRAFI', name: 'Geografi' },
    { code: 'ANTROPOLOGI', name: 'Antropologi' },
    { code: 'BINDO_LANJUT', name: 'Bahasa Indonesia Tingkat Lanjut' },
    { code: 'BING_LANJUT', name: 'Bahasa Inggris Tingkat Lanjut' },
    { code: 'PRAKARYA', name: 'Prakarya dan Kewirausahaan' },
  ];

  // --- 2024 SMA Grade 10 ---
  {
    const grade = 10;
    const factor = 36;
    const weeks = 36;
    const baseEvidence24 = [
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran IV',
          table: 'Alokasi Waktu Mata Pelajaran SMA/MA',
          section: 'Kelas 10',
        },
      },
    ];

    for (const rel of RELIGIONS) {
      rules.push({
        id: `km-sma-10-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 10,
        phase: 'E',
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 2 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 3 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: 2,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: 'Pendidikan Agama SMA Kelas 10 (2 JP/minggu)',
      });
    }

    rules.push({
      id: 'km-sma-10-pancasila',
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade: 10,
      phase: 'E',
      subjectCode: 'PANCASILA',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 54,
      kokurikulerAnnualJP: 18,
      totalAnnualJP: 72,
      referenceWeeksPerYear: 36,
      minutesPerJP: 45,
      derivedWeeklyJP: 1.5,
      allocationMode: 'ANNUAL',
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: 'Pendidikan Pancasila SMA Kelas 10 (Alokasi 54 JP/tahun, setara 1.5 JP/minggu)',
    });

    rules.push({
      id: 'km-sma-10-sejarah',
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade: 10,
      phase: 'E',
      subjectCode: 'SEJARAH',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 54,
      kokurikulerAnnualJP: 18,
      totalAnnualJP: 72,
      referenceWeeksPerYear: 36,
      minutesPerJP: 45,
      derivedWeeklyJP: 1.5,
      allocationMode: 'ANNUAL',
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: 'Sejarah SMA Kelas 10 (Alokasi 54 JP/tahun, setara 1.5 JP/minggu)',
    });

    const g10Map = [
      { code: 'BINDO', weekly: 3, name: 'Bahasa Indonesia' },
      { code: 'MAT', weekly: 3, name: 'Matematika' },
      { code: 'FISIKA', weekly: 2, name: 'Fisika' },
      { code: 'KIMIA', weekly: 2, name: 'Kimia' },
      { code: 'BIOLOGI', weekly: 2, name: 'Biologi' },
      { code: 'SOSIOLOGI', weekly: 2, name: 'Sosiologi' },
      { code: 'EKONOMI', weekly: 2, name: 'Ekonomi' },
      { code: 'GEOGRAFI', weekly: 2, name: 'Geografi' },
      { code: 'BING', weekly: 2, name: 'Bahasa Inggris' },
      { code: 'PJOK', weekly: 2, name: 'PJOK' },
      { code: 'INFORMATIKA', weekly: 2, name: 'Informatika' },
    ];

    for (const m of g10Map) {
      rules.push({
        id: `km-sma-10-${m.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 10,
        phase: 'E',
        subjectCode: m.code,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: m.weekly * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: (m.weekly + 1) * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: m.weekly,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `${m.name} SMA Kelas 10 (${m.weekly} JP/minggu)`,
      });
    }

    for (const art of ART_SMA) {
      rules.push({
        id: `km-sma-10-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 10,
        phase: 'E',
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_PRAKARYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: 54,
        kokurikulerAnnualJP: 18,
        totalAnnualJP: 72,
        referenceWeeksPerYear: 36,
        minutesPerJP: 45,
        derivedWeeklyJP: 1.5,
        allocationMode: 'ANNUAL',
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Seni SMA Kelas 10 (${art}) - Pilihan cabang kelompok Seni & Prakarya (1.5 JP/minggu)`,
      });
    }

    rules.push({
      id: 'km-sma-10-local-content',
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade: 10,
      phase: 'E',
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 72,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 72,
      referenceWeeksPerYear: 36,
      minutesPerJP: 45,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: 'Muatan Lokal SMA Kelas 10 (2 JP/minggu)',
    });
  }

  // --- 2024 SMA Grade 11 & 12 ---
  for (const grade of [11, 12]) {
    const weeks = grade === 12 ? 32 : 36;
    const factor = weeks;
    const baseEvidence24 = [
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran IV',
          table: 'Alokasi Waktu Mata Pelajaran SMA/MA',
          section: `Kelas ${grade}`,
        },
      },
    ];

    for (const rel of RELIGIONS) {
      rules.push({
        id: `km-sma-${grade}-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 2 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 3 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: 2,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Pendidikan Agama SMA Kelas ${grade} (2 JP/minggu)`,
      });
    }

    const pncIntra = grade === 12 ? 48 : 54;
    const pncKoku = grade === 12 ? 16 : 18;
    rules.push({
      id: `km-sma-${grade}-pancasila`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade,
      phase: 'F',
      subjectCode: 'PANCASILA',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: pncIntra,
      kokurikulerAnnualJP: pncKoku,
      totalAnnualJP: pncIntra + pncKoku,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 45,
      derivedWeeklyJP: 1.5,
      allocationMode: 'ANNUAL',
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Pendidikan Pancasila SMA Kelas ${grade} (Alokasi ${pncIntra} JP/tahun, setara 1.5 JP/minggu)`,
    });

    const coreF = [
      { code: 'BINDO', weekly: 3, name: 'Bahasa Indonesia' },
      { code: 'MAT', weekly: 3, name: 'Matematika' },
      { code: 'BING', weekly: 3, name: 'Bahasa Inggris' },
      { code: 'PJOK', weekly: 2, name: 'PJOK' },
      { code: 'SEJARAH', weekly: 2, name: 'Sejarah' },
    ];

    for (const c of coreF) {
      rules.push({
        id: `km-sma-${grade}-${c.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: c.code,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: c.weekly * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: (c.weekly + 1) * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: c.weekly,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `${c.name} SMA Kelas ${grade} (${c.weekly} JP/minggu)`,
      });
    }

    // Seni & Prakarya Fase F
    for (const art of ART_SMA) {
      rules.push({
        id: `km-sma-${grade}-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_PRAKARYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: pncIntra,
        kokurikulerAnnualJP: pncKoku,
        totalAnnualJP: pncIntra + pncKoku,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: 1.5,
        allocationMode: 'ANNUAL',
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Seni SMA Kelas ${grade} (${art}) - Pilihan cabang kelompok Seni & Prakarya (1.5 JP/minggu)`,
      });
    }

    // Muatan Lokal
    rules.push({
      id: `km-sma-${grade}-local-content`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade,
      phase: 'F',
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 45,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
      evidence: baseEvidence24,
      effectiveFrom: '2024-03-26',
      effectiveUntil: '2025-06-30',
      verificationStatus: 'VERIFIED',
      notes: `Muatan Lokal SMA Kelas ${grade} (2 JP/minggu)`,
    });

    // Mapel Pilihan Fase F (Pool 4-5 mapel, 5 JP/minggu masing-masing)
    for (const el of smaElectivesF) {
      rules.push({
        id: `km-sma-${grade}-${el.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: el.code,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SMA_F_ELECTIVE',
        selectionGroupRequired: true,
        minSelections: 4,
        maxSelections: 5,
        intrakurikulerAnnualJP: 5 * factor,
        kokurikulerAnnualJP: 0,
        totalAnnualJP: 5 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: 5,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024'],
        evidence: baseEvidence24,
        effectiveFrom: '2024-03-26',
        effectiveUntil: '2025-06-30',
        verificationStatus: 'VERIFIED',
        notes: `Mapel Pilihan ${el.name} SMA Kelas ${grade} (5 JP/minggu, pilihan 4-5)`,
      });
    }
  }

  // --- 2025/2026 SMA Grade 10-12 ---
  // Kelas 10
  {
    const factor = 36;
    const baseEvidence25 = [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SMA/MA',
          section: 'Kelas 10',
        },
      },
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran IV',
          table: 'Alokasi Waktu Mata Pelajaran SMA/MA',
          section: 'Kelas 10',
        },
      },
    ];

    for (const rel of RELIGIONS) {
      rules.push({
        id: `km25-sma-10-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 10,
        phase: 'E',
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 2 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 3 * factor,
        referenceWeeksPerYear: 36,
        minutesPerJP: 45,
        derivedWeeklyJP: 2,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: 'Pendidikan Agama SMA Kelas 10 TA 2025/2026 (2 JP/minggu)',
      });
    }

    rules.push({
      id: 'km25-sma-10-pancasila',
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade: 10,
      phase: 'E',
      subjectCode: 'PANCASILA',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 54,
      kokurikulerAnnualJP: 18,
      totalAnnualJP: 72,
      referenceWeeksPerYear: 36,
      minutesPerJP: 45,
      derivedWeeklyJP: 1.5,
      allocationMode: 'ANNUAL',
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: 'Pendidikan Pancasila SMA Kelas 10 TA 2025/2026 (Alokasi 54 JP/tahun, setara 1.5 JP/minggu)',
    });

    rules.push({
      id: 'km25-sma-10-sejarah',
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade: 10,
      phase: 'E',
      subjectCode: 'SEJARAH',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: 54,
      kokurikulerAnnualJP: 18,
      totalAnnualJP: 72,
      referenceWeeksPerYear: 36,
      minutesPerJP: 45,
      derivedWeeklyJP: 1.5,
      allocationMode: 'ANNUAL',
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: 'Sejarah SMA Kelas 10 TA 2025/2026 (Alokasi 54 JP/tahun, setara 1.5 JP/minggu)',
    });

    const g10Map = [
      { code: 'BINDO', weekly: 3, name: 'Bahasa Indonesia' },
      { code: 'MAT', weekly: 3, name: 'Matematika' },
      { code: 'FISIKA', weekly: 2, name: 'Fisika' },
      { code: 'KIMIA', weekly: 2, name: 'Kimia' },
      { code: 'BIOLOGI', weekly: 2, name: 'Biologi' },
      { code: 'SOSIOLOGI', weekly: 2, name: 'Sosiologi' },
      { code: 'EKONOMI', weekly: 2, name: 'Ekonomi' },
      { code: 'GEOGRAFI', weekly: 2, name: 'Geografi' },
      { code: 'BING', weekly: 2, name: 'Bahasa Inggris' },
      { code: 'PJOK', weekly: 2, name: 'PJOK' },
      { code: 'INFORMATIKA', weekly: 2, name: 'Informatika' },
    ];

    for (const m of g10Map) {
      rules.push({
        id: `km25-sma-10-${m.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 10,
        phase: 'E',
        subjectCode: m.code,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: m.weekly * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: (m.weekly + 1) * factor,
        referenceWeeksPerYear: 36,
        minutesPerJP: 45,
        derivedWeeklyJP: m.weekly,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `${m.name} SMA Kelas 10 TA 2025/2026 (${m.weekly} JP/minggu intrakurikuler + 1 JP Kokurikuler)`,
      });
    }

    for (const art of ART_SMA) {
      rules.push({
        id: `km25-sma-10-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade: 10,
        phase: 'E',
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_PRAKARYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: 54,
        kokurikulerAnnualJP: 18,
        totalAnnualJP: 72,
        referenceWeeksPerYear: 36,
        minutesPerJP: 45,
        derivedWeeklyJP: 1.5,
        allocationMode: 'ANNUAL',
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Seni SMA Kelas 10 (${art}) - Pilihan cabang kelompok Seni & Prakarya TA 2025/2026 (1.5 JP/minggu)`,
      });
    }

    rules.push({
      id: 'km25-sma-10-local-content',
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade: 10,
      phase: 'E',
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 72,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 72,
      referenceWeeksPerYear: 36,
      minutesPerJP: 45,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: 'Muatan Lokal SMA Kelas 10 TA 2025/2026 (2 JP/minggu)',
    });

    // Koding dan AI SMA Kelas 10: VERIFIED
    rules.push({
      id: 'km25-sma-10-coding-ai',
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade: 10,
      phase: 'E',
      subjectCode: 'CODING_AI',
      subjectType: 'ELECTIVE',
      intrakurikulerAnnualJP: 72,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 72,
      referenceWeeksPerYear: 36,
      minutesPerJP: 45,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
      evidence: [
        {
          regulationId: 'REG-PERMENDIKDASMEN-13-2025',
          sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
          locator: {
            attachment: 'Lampiran II',
            section: 'Pasal 32A & Lampiran II Struktur Kurikulum SMA/MA',
            table: 'Alokasi Waktu Mata Pelajaran SMA/MA Kelas X',
            note: 'Alokasi Koding dan Kecerdasan Artifisial Kelas 10 SMA (2 JP/minggu, 72 JP/tahun)',
          },
        },
      ],
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: 'Koding dan Kecerdasan Artifisial sebagai mapel pilihan SMA Kelas 10 TA 2025/2026 (2 JP/minggu)',
    });
  }

  // Kelas 11 & 12 (2025/2026)
  for (const grade of [11, 12]) {
    const weeks = grade === 12 ? 32 : 36;
    const factor = weeks;
    const baseEvidence25 = [
      {
        regulationId: 'REG-PERMENDIKDASMEN-13-2025',
        sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
        locator: {
          attachment: 'Lampiran II',
          table: 'Alokasi Waktu Mata Pelajaran SMA/MA',
          section: `Kelas ${grade}`,
        },
      },
      {
        regulationId: 'REG-PERMENDIKBUDRISTEK-12-2024',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
        locator: {
          attachment: 'Lampiran IV',
          table: 'Alokasi Waktu Mata Pelajaran SMA/MA',
          section: `Kelas ${grade}`,
        },
      },
    ];

    for (const rel of RELIGIONS) {
      rules.push({
        id: `km25-sma-${grade}-${rel.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: rel,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: 2 * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: 3 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: 2,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Pendidikan Agama SMA Kelas ${grade} TA 2025/2026 (2 JP/minggu)`,
      });
    }

    const pncIntra = grade === 12 ? 48 : 54;
    const pncKoku = grade === 12 ? 16 : 18;
    rules.push({
      id: `km25-sma-${grade}-pancasila`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade,
      phase: 'F',
      subjectCode: 'PANCASILA',
      subjectType: 'REQUIRED',
      intrakurikulerAnnualJP: pncIntra,
      kokurikulerAnnualJP: pncKoku,
      totalAnnualJP: pncIntra + pncKoku,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 45,
      derivedWeeklyJP: 1.5,
      allocationMode: 'ANNUAL',
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Pendidikan Pancasila SMA Kelas ${grade} TA 2025/2026 (Alokasi ${pncIntra} JP/tahun, setara 1.5 JP/minggu)`,
    });

    const coreF = [
      { code: 'BINDO', weekly: 3, name: 'Bahasa Indonesia' },
      { code: 'MAT', weekly: 3, name: 'Matematika' },
      { code: 'BING', weekly: 3, name: 'Bahasa Inggris' },
      { code: 'PJOK', weekly: 2, name: 'PJOK' },
      { code: 'SEJARAH', weekly: 2, name: 'Sejarah' },
    ];

    for (const c of coreF) {
      rules.push({
        id: `km25-sma-${grade}-${c.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: c.code,
        subjectType: 'REQUIRED',
        intrakurikulerAnnualJP: c.weekly * factor,
        kokurikulerAnnualJP: 1 * factor,
        totalAnnualJP: (c.weekly + 1) * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: c.weekly,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `${c.name} SMA Kelas ${grade} TA 2025/2026 (${c.weekly} JP/minggu intrakurikuler + 1 JP Kokurikuler)`,
      });
    }

    // Seni & Prakarya Fase F
    for (const art of ART_SMA) {
      rules.push({
        id: `km25-sma-${grade}-${art.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: art,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SENI_PRAKARYA',
        selectionGroupRequired: true,
        minSelections: 1,
        intrakurikulerAnnualJP: pncIntra,
        kokurikulerAnnualJP: pncKoku,
        totalAnnualJP: pncIntra + pncKoku,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: 1.5,
        allocationMode: 'ANNUAL',
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Seni SMA Kelas ${grade} (${art}) - Pilihan cabang kelompok Seni & Prakarya TA 2025/2026 (1.5 JP/minggu)`,
      });
    }

    // Muatan Lokal
    rules.push({
      id: `km25-sma-${grade}-local-content`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade,
      phase: 'F',
      subjectCode: 'LOCAL_CONTENT',
      subjectType: 'LOCAL_CONTENT',
      intrakurikulerAnnualJP: 2 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 2 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 45,
      derivedWeeklyJP: 2,
      regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
      evidence: baseEvidence25,
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'VERIFIED',
      notes: `Muatan Lokal SMA Kelas ${grade} TA 2025/2026 (2 JP/minggu)`,
    });

    // Mapel Pilihan Fase F
    for (const el of smaElectivesF) {
      rules.push({
        id: `km25-sma-${grade}-${el.code.toLowerCase()}`,
        curriculumType: 'KURIKULUM_MERDEKA',
        level: 'SMA',
        grade,
        phase: 'F',
        subjectCode: el.code,
        subjectType: 'ELECTIVE',
        selectionGroup: 'SMA_F_ELECTIVE',
        selectionGroupRequired: true,
        minSelections: 4,
        maxSelections: 5,
        intrakurikulerAnnualJP: 5 * factor,
        kokurikulerAnnualJP: 0,
        totalAnnualJP: 5 * factor,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: 5,
        regulationIds: ['REG-PERMENDIKBUDRISTEK-12-2024', 'REG-PERMENDIKDASMEN-13-2025'],
        evidence: baseEvidence25,
        effectiveFrom: '2025-07-01',
        implementationFromAcademicYear: '2025/2026',
        verificationStatus: 'VERIFIED',
        notes: `Mapel Pilihan ${el.name} SMA Kelas ${grade} TA 2025/2026 (5 JP/minggu, pilihan 4-5)`,
      });
    }

    // Coding & AI Kelas 11 & 12: UNVERIFIED
    rules.push({
      id: `km25-sma-${grade}-coding-ai`,
      curriculumType: 'KURIKULUM_MERDEKA',
      level: 'SMA',
      grade,
      phase: 'F',
      subjectCode: 'CODING_AI',
      subjectType: 'ELECTIVE',
      intrakurikulerAnnualJP: 5 * factor,
      kokurikulerAnnualJP: 0,
      totalAnnualJP: 5 * factor,
      referenceWeeksPerYear: weeks,
      minutesPerJP: 45,
      derivedWeeklyJP: 5,
      regulationIds: ['REG-PERMENDIKDASMEN-13-2025'],
      effectiveFrom: '2025-07-01',
      implementationFromAcademicYear: '2025/2026',
      verificationStatus: 'UNVERIFIED',
      notes: `Koding dan Kecerdasan Artifisial belum diverifikasi secara spesifik per kelas untuk SMA Kelas ${grade} (status UNVERIFIED)`,
    });
  }

  // --- K13 SMA (Grade 10-12) ---
  for (const grade of [10, 11, 12]) {
    const weeks = grade === 12 ? 32 : 36;
    const k13Evidence = [
      {
        regulationId: 'REG-PERMENDIKBUD-36-2018',
        sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=2181',
        locator: {
          attachment: 'Lampiran',
          table: 'Struktur Kurikulum SMA/MA',
          section: `Alokasi Beban Belajar SMA Kelas ${grade}`,
        },
      },
    ];

    const k13Subjects = [
      { code: 'PAI', weekly: 3, name: 'PAI' },
      { code: 'PANCASILA', weekly: 2, name: 'PPKn' },
      { code: 'BINDO', weekly: 4, name: 'Bahasa Indonesia' },
      { code: 'MAT', weekly: 4, name: 'Matematika' },
      { code: 'SEJARAH', weekly: 2, name: 'Sejarah Indonesia' },
      { code: 'BING', weekly: 2, name: 'Bahasa Inggris' },
      { code: 'SENI_RUPA', weekly: 2, name: 'Seni Budaya' },
      { code: 'PJOK', weekly: 3, name: 'PJOK' },
      { code: 'PRAKARYA', weekly: 2, name: 'Prakarya dan Kewirausahaan' },
      { code: 'LOCAL_CONTENT', weekly: 2, name: 'Muatan Lokal', type: 'LOCAL_CONTENT' },
    ];

    for (const sub of k13Subjects) {
      rules.push({
        id: `k13-sma-${grade}-${sub.code.toLowerCase()}`,
        curriculumType: 'K13',
        level: 'SMA',
        grade,
        subjectCode: sub.code,
        subjectType: sub.type || 'REQUIRED',
        intrakurikulerAnnualJP: sub.weekly * weeks,
        kokurikulerAnnualJP: 0,
        totalAnnualJP: sub.weekly * weeks,
        referenceWeeksPerYear: weeks,
        minutesPerJP: 45,
        derivedWeeklyJP: sub.weekly,
        regulationIds: ['REG-PERMENDIKBUD-36-2018'],
        evidence: k13Evidence,
        effectiveFrom: '2018-12-01',
        verificationStatus: 'VERIFIED',
        notes: `K13 SMA Kelas ${grade} ${sub.name} (${sub.weekly} JP/minggu)`,
      });
    }
  }

  return `import { CurriculumStructureRule } from '../types';

/**
 * STRUKTUR KURIKULUM RESMI JENJANG SEKOLAH MENENGAH ATAS (SMA / MA)
 * KELAS 10 SAMPAI KELAS 12
 *
 * Regulasi Rujukan:
 * - Permendikbudristek No. 12 Tahun 2024 (Lampiran IV: Struktur Kurikulum SMA)
 * - Permendikdasmen No. 13 Tahun 2025 (Pembaruan Mapel Pilihan Coding dan AI)
 * - Permendikbud No. 36 Tahun 2018 (Struktur Kurikulum 2013 SMA)
 */
export const SMA_STRUCTURE_RULES: CurriculumStructureRule[] = [
${rules.map((r) => '  {\n' + jsonProps(r, 4) + '\n  },').join('\n')}
];
`;
}

// ---------------------------------------------------------------------------
// EXECUTE GENERATION
// ---------------------------------------------------------------------------
const baseDir = path.resolve(process.cwd(), 'src/data/curriculum/structure');
fs.writeFileSync(path.join(baseDir, 'sd.ts'), generateSD(), 'utf8');
fs.writeFileSync(path.join(baseDir, 'smp.ts'), generateSMP(), 'utf8');
fs.writeFileSync(path.join(baseDir, 'sma.ts'), generateSMA(), 'utf8');
console.log('Successfully regenerated sd.ts, smp.ts, and sma.ts with evidence and audited rules!');
