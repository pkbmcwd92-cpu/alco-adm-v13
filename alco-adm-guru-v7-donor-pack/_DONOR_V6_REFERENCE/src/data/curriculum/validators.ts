import { CurriculumStructureRule, ValidationIssue } from './types';
import { ALL_CURRICULUM_STRUCTURE_RULES } from './structure';
import { findSubjectByCode, isReligionSubject } from './subjects';
import { OFFICIAL_REGULATION_SOURCES } from './regulations';
import { MasterCPEntry } from './cp/types';
import { ALL_MASTER_CP_ENTRIES } from './cp';

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}


const REGULATION_ID_SET = new Set(OFFICIAL_REGULATION_SOURCES.map((r) => r.id));

/**
 * Memeriksa apakah URL rujukan merupakan URL dokumen regulasi resmi spesifik,
 * dan bukan sekadar menunjuk ke generic homepage / domain root portal.
 */
export function isSpecificOfficialSourceUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '').trim();
    // Jika tidak ada path spesifik dan tidak ada query string, itu hanya homepage/root
    if (!cleanPath && !parsed.search) {
      return false;
    }
    if (cleanPath === '' || cleanPath === '/') {
      return false;
    }
    const genericPaths = ['/home', '/index', '/index.html', '/index.php', '/beranda'];
    if (genericPaths.includes(cleanPath.toLowerCase()) && !parsed.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Memeriksa apakah locator memiliki detail rujukan spesifik yang memadai
 * (misal: attachment/lampiran, table/tabel, section/pasal, atau nomor halaman).
 */
export function hasSpecificLocatorDetails(locator: any): boolean {
  if (!locator || typeof locator !== 'object') return false;
  const hasAttachment = typeof locator.attachment === 'string' && locator.attachment.trim().length > 0;
  const hasTable = typeof locator.table === 'string' && locator.table.trim().length > 0;
  const hasSection = typeof locator.section === 'string' && locator.section.trim().length > 0;
  const hasPage = typeof locator.page === 'number' && locator.page > 0;
  const hasArticle = typeof locator.article === 'string' && locator.article.trim().length > 0;
  return Boolean(hasAttachment || hasTable || hasSection || hasPage || hasArticle);
}

/**
 * Memvalidasi konsistensi internal dari sebuah CurriculumStructureRule
 */
export function validateStructureRule(rule: CurriculumStructureRule): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Validasi Grade & Level
  if (typeof rule.grade !== 'number' || rule.grade < 1 || rule.grade > 12) {
    issues.push({
      ruleId: rule.id,
      field: 'grade',
      message: `Grade tidak valid: ${rule.grade}. Harus berada dalam rentang 1–12.`,
      severity: 'ERROR',
    });
  } else {
    // Level ↔ Grade mismatch validation
    if (rule.level === 'SD' && (rule.grade < 1 || rule.grade > 6)) {
      issues.push({
        ruleId: rule.id,
        field: 'level',
        message: `Level SD tidak valid untuk Kelas ${rule.grade} (SD hanya Kelas 1–6).`,
        severity: 'ERROR',
      });
    } else if (rule.level === 'SMP' && (rule.grade < 7 || rule.grade > 9)) {
      issues.push({
        ruleId: rule.id,
        field: 'level',
        message: `Level SMP tidak valid untuk Kelas ${rule.grade} (SMP hanya Kelas 7–9).`,
        severity: 'ERROR',
      });
    } else if (rule.level === 'SMA' && (rule.grade < 10 || rule.grade > 12)) {
      issues.push({
        ruleId: rule.id,
        field: 'level',
        message: `Level SMA tidak valid untuk Kelas ${rule.grade} (SMA hanya Kelas 10–12).`,
        severity: 'ERROR',
      });
    }
  }

  // 2. Validasi Subjek (Harus terdaftar di Master Subjects)
  if (!rule.subjectCode) {
    issues.push({
      ruleId: rule.id,
      field: 'subjectCode',
      message: `Aturan tidak memiliki subjectCode.`,
      severity: 'ERROR',
    });
  } else {
    const subject = findSubjectByCode(rule.subjectCode);
    if (!subject) {
      issues.push({
        ruleId: rule.id,
        field: 'subjectCode',
        message: `Kode mata pelajaran '${rule.subjectCode}' tidak ditemukan di Master Subjects.`,
        severity: 'ERROR',
      });
    }
  }

  // 3. Validasi Regulasi Rujukan & Sumber
  if (!rule.regulationIds || rule.regulationIds.length === 0) {
    issues.push({
      ruleId: rule.id,
      field: 'regulationIds',
      message: `Aturan tidak memiliki sumber rujukan regulasi resmi (regulationIds kosong).`,
      severity: 'ERROR',
    });
  } else {
    for (const regId of rule.regulationIds) {
      if (!REGULATION_ID_SET.has(regId)) {
        issues.push({
          ruleId: rule.id,
          field: 'regulationIds',
          message: `Regulation ID '${regId}' tidak ditemukan di Regulation Registry resmi.`,
          severity: 'ERROR',
        });
      }
    }
  }

  // 4. VERIFIED HARUS BENAR-BENAR PUNYA SUMBER RESMI DAN EVIDENCE TERDAFTAR
  if (rule.verificationStatus === 'VERIFIED') {
    const hasValidRegisteredSource =
      rule.regulationIds &&
      rule.regulationIds.length > 0 &&
      rule.regulationIds.every((id) => REGULATION_ID_SET.has(id));

    if (!hasValidRegisteredSource) {
      issues.push({
        ruleId: rule.id,
        field: 'verificationStatus',
        message: `Aturan berstatus VERIFIED tetapi mereferensikan sumber yang tidak terdaftar di Regulation Registry resmi.`,
        severity: 'ERROR',
      });
    }

    if (!rule.evidence || rule.evidence.length === 0) {
      issues.push({
        ruleId: rule.id,
        field: 'evidence',
        message: `Aturan berstatus VERIFIED wajib menyertakan evidence resmi (locator lampiran/pasal/tabel) yang dapat diverifikasi.`,
        severity: 'ERROR',
      });
    } else {
      for (const ev of rule.evidence) {
        if (!REGULATION_ID_SET.has(ev.regulationId)) {
          issues.push({
            ruleId: rule.id,
            field: 'evidence',
            message: `Evidence mereferensikan regulationId '${ev.regulationId}' yang tidak terdaftar di Regulation Registry resmi.`,
            severity: 'ERROR',
          });
        }
        if (!ev.sourceUrl || typeof ev.sourceUrl !== 'string') {
          issues.push({
            ruleId: rule.id,
            field: 'evidence',
            message: `Evidence harus menyertakan sourceUrl resmi yang valid.`,
            severity: 'ERROR',
          });
        } else if (!isSpecificOfficialSourceUrl(ev.sourceUrl)) {
          issues.push({
            ruleId: rule.id,
            field: 'evidence',
            message: `Evidence sourceUrl '${ev.sourceUrl}' terlalu generik (hanya root/homepage). Aturan VERIFIED wajib menggunakan URL dokumen regulasi resmi yang spesifik.`,
            severity: 'ERROR',
          });
        }

        if (!hasSpecificLocatorDetails(ev.locator)) {
          issues.push({
            ruleId: rule.id,
            field: 'evidence',
            message: `Evidence locator untuk aturan VERIFIED harus memiliki rujukan spesifik (attachment, table, section, atau page).`,
            severity: 'ERROR',
          });
        }
      }
    }
  }

  // 4b. Validasi Kontradiksi Selection Group
  if (rule.selectionGroup && rule.minSelections === 1 && rule.subjectType === 'REQUIRED') {
    issues.push({
      ruleId: rule.id,
      field: 'selectionGroup',
      message: `Kontradiksi selection group: aturan pada group '${rule.selectionGroup}' memiliki minSelections=1 tetapi subjectType ditandai REQUIRED. Cabang pilihan seharusnya bertipe ELECTIVE dengan selectionGroupRequired=true.`,
      severity: 'ERROR',
    });
  }

  // 5. Validasi Non-Negatif untuk Seluruh JP (Null-Safe)
  if (rule.intrakurikulerAnnualJP != null && rule.intrakurikulerAnnualJP < 0) {
    issues.push({
      ruleId: rule.id,
      field: 'intrakurikulerAnnualJP',
      message: `intrakurikulerAnnualJP bernilai negatif (${rule.intrakurikulerAnnualJP}).`,
      severity: 'ERROR',
    });
  }
  if (rule.kokurikulerAnnualJP != null && rule.kokurikulerAnnualJP < 0) {
    issues.push({
      ruleId: rule.id,
      field: 'kokurikulerAnnualJP',
      message: `kokurikulerAnnualJP bernilai negatif (${rule.kokurikulerAnnualJP}).`,
      severity: 'ERROR',
    });
  }
  if (rule.totalAnnualJP != null && rule.totalAnnualJP < 0) {
    issues.push({
      ruleId: rule.id,
      field: 'totalAnnualJP',
      message: `totalAnnualJP bernilai negatif (${rule.totalAnnualJP}).`,
      severity: 'ERROR',
    });
  }
  if (rule.derivedWeeklyJP != null && rule.derivedWeeklyJP < 0) {
    issues.push({
      ruleId: rule.id,
      field: 'derivedWeeklyJP',
      message: `derivedWeeklyJP bernilai negatif (${rule.derivedWeeklyJP}).`,
      severity: 'ERROR',
    });
  }
  if (rule.referenceWeeksPerYear != null && rule.referenceWeeksPerYear <= 0) {
    issues.push({
      ruleId: rule.id,
      field: 'referenceWeeksPerYear',
      message: `referenceWeeksPerYear harus > 0, ditemukan (${rule.referenceWeeksPerYear}).`,
      severity: 'ERROR',
    });
  }

  // 5b. Validasi minutesPerJP sesuai jenjang (SD = 35, SMP = 40, SMA = 45)
  if (rule.minutesPerJP != null) {
    if (rule.level === 'SD' && rule.minutesPerJP !== 35) {
      issues.push({
        ruleId: rule.id,
        field: 'minutesPerJP',
        message: `minutesPerJP untuk jenjang SD harus 35 menit, ditemukan ${rule.minutesPerJP}.`,
        severity: 'ERROR',
      });
    } else if (rule.level === 'SMP' && rule.minutesPerJP !== 40) {
      issues.push({
        ruleId: rule.id,
        field: 'minutesPerJP',
        message: `minutesPerJP untuk jenjang SMP harus 40 menit, ditemukan ${rule.minutesPerJP}.`,
        severity: 'ERROR',
      });
    } else if (rule.level === 'SMA' && rule.minutesPerJP !== 45) {
      issues.push({
        ruleId: rule.id,
        field: 'minutesPerJP',
        message: `minutesPerJP untuk jenjang SMA harus 45 menit, ditemukan ${rule.minutesPerJP}.`,
        severity: 'ERROR',
      });
    }
  }

  // 5c. Validasi referenceWeeksPerYear (rentang 32–36 minggu)
  if (rule.referenceWeeksPerYear != null) {
    if (rule.referenceWeeksPerYear < 32 || rule.referenceWeeksPerYear > 36) {
      issues.push({
        ruleId: rule.id,
        field: 'referenceWeeksPerYear',
        message: `referenceWeeksPerYear (${rule.referenceWeeksPerYear}) berada di luar rentang standar regulasi (32–36 minggu).`,
        severity: 'ERROR',
      });
    }
  }

  // 6. Validasi Total JP (Null-Safe)
  if (
    rule.intrakurikulerAnnualJP != null &&
    rule.kokurikulerAnnualJP != null &&
    rule.totalAnnualJP != null
  ) {
    if (rule.intrakurikulerAnnualJP + rule.kokurikulerAnnualJP !== rule.totalAnnualJP) {
      issues.push({
        ruleId: rule.id,
        field: 'totalAnnualJP',
        message: `Total annual JP mismatch: intra (${rule.intrakurikulerAnnualJP}) + kokuri (${rule.kokurikulerAnnualJP}) !== total (${rule.totalAnnualJP})`,
        severity: 'ERROR',
      });
    }
  }

  // 7. Validasi Ekuivalensi JP Mingguan (Null-Safe & Presisi Matematis Tanpa Pembulatan Paksa)
  if (
    rule.intrakurikulerAnnualJP != null &&
    rule.referenceWeeksPerYear != null &&
    rule.derivedWeeklyJP != null &&
    rule.referenceWeeksPerYear > 0
  ) {
    const expectedWeeklyJP = rule.intrakurikulerAnnualJP / rule.referenceWeeksPerYear;
    const tolerance = 0.0001;
    if (Math.abs(rule.derivedWeeklyJP - expectedWeeklyJP) > tolerance) {
      issues.push({
        ruleId: rule.id,
        field: 'derivedWeeklyJP',
        message: `Weekly JP mismatch: derived (${rule.derivedWeeklyJP}) vs calculated intra/weeks (${expectedWeeklyJP})`,
        severity: 'ERROR',
      });
    }
  }

  // 8. Validasi Pemetaan Kelas ke Fase (Kurikulum Merdeka)
  if (rule.curriculumType === 'KURIKULUM_MERDEKA' && rule.phase) {
    if ((rule.grade === 1 || rule.grade === 2) && rule.phase !== 'A') {
      issues.push({
        ruleId: rule.id,
        field: 'phase',
        message: `Kelas ${rule.grade} harus Fase A, ditemukan Fase ${rule.phase}`,
        severity: 'ERROR',
      });
    } else if ((rule.grade === 3 || rule.grade === 4) && rule.phase !== 'B') {
      issues.push({
        ruleId: rule.id,
        field: 'phase',
        message: `Kelas ${rule.grade} harus Fase B, ditemukan Fase ${rule.phase}`,
        severity: 'ERROR',
      });
    } else if ((rule.grade === 5 || rule.grade === 6) && rule.phase !== 'C') {
      issues.push({
        ruleId: rule.id,
        field: 'phase',
        message: `Kelas ${rule.grade} harus Fase C, ditemukan Fase ${rule.phase}`,
        severity: 'ERROR',
      });
    } else if ([7, 8, 9].includes(rule.grade) && rule.phase !== 'D') {
      issues.push({
        ruleId: rule.id,
        field: 'phase',
        message: `Kelas ${rule.grade} harus Fase D, ditemukan Fase ${rule.phase}`,
        severity: 'ERROR',
      });
    } else if (rule.grade === 10 && rule.phase !== 'E') {
      issues.push({
        ruleId: rule.id,
        field: 'phase',
        message: `Kelas 10 harus Fase E, ditemukan Fase ${rule.phase}`,
        severity: 'ERROR',
      });
    } else if ((rule.grade === 11 || rule.grade === 12) && rule.phase !== 'F') {
      issues.push({
        ruleId: rule.id,
        field: 'phase',
        message: `Kelas ${rule.grade} harus Fase F, ditemukan Fase ${rule.phase}`,
        severity: 'ERROR',
      });
    }
  }

  // 9. Validasi Periode Berlaku
  if (rule.effectiveFrom && rule.effectiveUntil) {
    if (rule.effectiveFrom > rule.effectiveUntil) {
      issues.push({
        ruleId: rule.id,
        field: 'effectivePeriod',
        message: `Periode berlaku tidak valid: effectiveFrom (${rule.effectiveFrom}) > effectiveUntil (${rule.effectiveUntil})`,
        severity: 'ERROR',
      });
    }
  }

  // 10. Cek Status Verifikasi
  if (rule.verificationStatus === 'UNVERIFIED') {
    issues.push({
      ruleId: rule.id,
      field: 'verificationStatus',
      message: `Aturan ini berstatus UNVERIFIED dan memerlukan telaah regulasi lebih lanjut`,
      severity: 'WARNING',
    });
  }

  return {
    isValid: issues.filter((i) => i.severity === 'ERROR').length === 0,
    issues,
  };
}

/**
 * Validasi seluruh master struktur kurikulum
 */
export function validateAllStructureRules(
  rules: CurriculumStructureRule[] = ALL_CURRICULUM_STRUCTURE_RULES
) {
  const allIssues: ValidationIssue[] = [];

  // Track ID duplikat
  const seenRuleIds = new Set<string>();

  for (const rule of rules) {
    if (seenRuleIds.has(rule.id)) {
      allIssues.push({
        ruleId: rule.id,
        field: 'id',
        message: `Duplicate rule ID terdeteksi: '${rule.id}'. Setiap aturan harus memiliki ID unik.`,
        severity: 'ERROR',
      });
    } else {
      seenRuleIds.add(rule.id);
    }

    const res = validateStructureRule(rule);
    if (res.issues.length > 0) {
      allIssues.push(...res.issues);
    }
  }

  // Validasi Cross-Rule: Aturan aktif duplikat & Tumpang Tindih Periode Berlaku (Overlapping Periods)
  const activeRules = rules.filter((r) => r.verificationStatus !== 'SUPERSEDED');
  const groupedRules = new Map<string, CurriculumStructureRule[]>();

  for (const rule of activeRules) {
    const key = `${rule.curriculumType}_${rule.level}_${rule.grade}_${rule.subjectCode}`;
    const group = groupedRules.get(key) || [];
    group.push(rule);
    groupedRules.set(key, group);
  }

  for (const [key, group] of groupedRules.entries()) {
    if (group.length > 1) {
      // Periksa apakah terdapat tumpang tindih periode (overlap)
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const ruleA = group[i];
          const ruleB = group[j];

          const startA = ruleA.effectiveFrom || '1970-01-01';
          const endA = ruleA.effectiveUntil || '9999-12-31';
          const startB = ruleB.effectiveFrom || '1970-01-01';
          const endB = ruleB.effectiveUntil || '9999-12-31';

          // Dua interval [startA, endA] dan [startB, endB] tumpang tindih jika:
          const overlaps = startA <= endB && startB <= endA;
          if (overlaps) {
            allIssues.push({
              ruleId: ruleA.id,
              field: 'effectivePeriod',
              message: `Overlapping active rules terdeteksi untuk kunci ${key}: rule '${ruleA.id}' dan '${ruleB.id}' memiliki periode berlaku aktif yang saling tumpang tindih.`,
              severity: 'ERROR',
            });
          }
        }
      }
    }
  }

  const errors = allIssues.filter((i) => i.severity === 'ERROR');
  const warnings = allIssues.filter((i) => i.severity === 'WARNING');
  const verifiedRules = rules.filter((r) => r.verificationStatus === 'VERIFIED').length;
  const unverifiedRules = rules.filter((r) => r.verificationStatus === 'UNVERIFIED').length;
  const supersededRules = rules.filter((r) => r.verificationStatus === 'SUPERSEDED').length;

  return {
    valid: errors.length === 0,
    totalRules: rules.length,
    verifiedRules,
    unverifiedRules,
    supersededRules,
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: allIssues,
  };
}

/**
 * Memvalidasi konsistensi internal dari sebuah MasterCPEntry
 */
export function validateCPEntry(cp: MasterCPEntry): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Validasi ID
  if (!cp.id || typeof cp.id !== 'string') {
    issues.push({
      ruleId: cp.id || 'UNKNOWN_CP',
      field: 'id',
      message: 'Capaian Pembelajaran harus memiliki id yang valid.',
      severity: 'ERROR',
    });
  }

  // 2. Validasi Subjek (Harus terdaftar di Master Subjects)
  if (!cp.subjectCode) {
    issues.push({
      ruleId: cp.id,
      field: 'subjectCode',
      message: 'CP tidak memiliki subjectCode.',
      severity: 'ERROR',
    });
  } else {
    const subject = findSubjectByCode(cp.subjectCode);
    if (!subject) {
      issues.push({
        ruleId: cp.id,
        field: 'subjectCode',
        message: `Kode mata pelajaran '${cp.subjectCode}' pada CP tidak ditemukan di Master Subjects.`,
        severity: 'ERROR',
      });
    }
  }

  // Validasi Level & Phase
  const validLevels = ['SD', 'SMP', 'SMA'];
  const validPhases = ['A', 'B', 'C', 'D', 'E', 'F'];
  if (!cp.level || !validLevels.includes(cp.level)) {
    issues.push({
      ruleId: cp.id,
      field: 'level',
      message: `Level CP tidak valid: '${cp.level}'. Harus salah satu dari SD, SMP, SMA.`,
      severity: 'ERROR',
    });
  }
  if (!cp.phase || !validPhases.includes(cp.phase)) {
    issues.push({
      ruleId: cp.id,
      field: 'phase',
      message: `Fase CP tidak valid: '${cp.phase}'. Harus salah satu dari A, B, C, D, E, F.`,
      severity: 'ERROR',
    });
  }
  if (cp.level && cp.phase) {
    if (cp.level === 'SD' && !['A', 'B', 'C'].includes(cp.phase)) {
      issues.push({
        ruleId: cp.id,
        field: 'levelPhaseMismatch',
        message: `Level SD hanya berlaku untuk Fase A, B, atau C (ditemukan: Fase ${cp.phase}).`,
        severity: 'ERROR',
      });
    } else if (cp.level === 'SMP' && cp.phase !== 'D') {
      issues.push({
        ruleId: cp.id,
        field: 'levelPhaseMismatch',
        message: `Level SMP hanya berlaku untuk Fase D (ditemukan: Fase ${cp.phase}).`,
        severity: 'ERROR',
      });
    } else if (cp.level === 'SMA' && !['E', 'F'].includes(cp.phase)) {
      issues.push({
        ruleId: cp.id,
        field: 'levelPhaseMismatch',
        message: `Level SMA hanya berlaku untuk Fase E atau F (ditemukan: Fase ${cp.phase}).`,
        severity: 'ERROR',
      });
    }
  }

  // 3. Validasi Regulasi Rujukan (Harus terdaftar di Regulation Registry)
  if (!cp.regulationSourceId) {
    issues.push({
      ruleId: cp.id,
      field: 'regulationSourceId',
      message: 'CP tidak memiliki regulationSourceId.',
      severity: 'ERROR',
    });
  } else if (!REGULATION_ID_SET.has(cp.regulationSourceId)) {
    issues.push({
      ruleId: cp.id,
      field: 'regulationSourceId',
      message: `Regulasi ID '${cp.regulationSourceId}' pada CP tidak terdaftar di OFFICIAL_REGULATION_SOURCES.`,
      severity: 'ERROR',
    });
  }

  // 4. Validasi Batasan Regulasi BKPDM 020/2026:
  // Regulasi 020/2026 KHUSUS kelompok Pendidikan Agama dan Budi Pekerti
  if (cp.regulationSourceId === 'DEC-BKPDM-020-2026' && !isReligionSubject(cp.subjectCode)) {
    issues.push({
      ruleId: cp.id,
      field: 'regulationSourceId',
      message: `Keputusan Kepala BKPDM No. 020 Tahun 2026 hanya berlaku untuk Pendidikan Agama dan Budi Pekerti, tidak dapat diterapkan pada mata pelajaran '${cp.subjectCode}'.`,
      severity: 'ERROR',
    });
  }

  // 5. Validasi VERIFIED CP 2026 Agama
  if (
    cp.verificationStatus === 'VERIFIED' &&
    isReligionSubject(cp.subjectCode) &&
    cp.implementationFromAcademicYear &&
    cp.implementationFromAcademicYear >= '2026/2027' &&
    cp.regulationSourceId !== 'DEC-BKPDM-020-2026'
  ) {
    issues.push({
      ruleId: cp.id,
      field: 'regulationSourceId',
      message: `CP Agama TA 2026/2027 berstatus VERIFIED harus merujuk pada regulasi DEC-BKPDM-020-2026 (ditemukan: ${cp.regulationSourceId}).`,
      severity: 'ERROR',
    });
  }

  // 6. Validasi Periode Berlaku (effectiveFrom <= effectiveUntil jika keduanya ada)
  if (cp.effectiveFrom && cp.effectiveUntil) {
    if (cp.effectiveFrom > cp.effectiveUntil) {
      issues.push({
        ruleId: cp.id,
        field: 'effectivePeriod',
        message: `effectiveFrom (${cp.effectiveFrom}) tidak boleh lebih besar dari effectiveUntil (${cp.effectiveUntil}).`,
        severity: 'ERROR',
      });
    }
  }

  // 7. Validasi Evidence untuk CP berstatus VERIFIED
  if (cp.verificationStatus === 'VERIFIED') {
    if (!cp.evidence || cp.evidence.length === 0) {
      issues.push({
        ruleId: cp.id,
        field: 'evidence',
        message: `CP berstatus VERIFIED wajib menyertakan evidence resmi (bukti naskah asli).`,
        severity: 'ERROR',
      });
    } else {
      for (const ev of cp.evidence) {
        if (!isSpecificOfficialSourceUrl(ev.sourceUrl)) {
          issues.push({
            ruleId: cp.id,
            field: 'evidence.sourceUrl',
            message: `URL evidence '${ev.sourceUrl}' tidak valid atau hanya menunjuk domain generic homepage.`,
            severity: 'ERROR',
          });
        }
        if (!hasSpecificLocatorDetails(ev.locator)) {
          issues.push({
            ruleId: cp.id,
            field: 'evidence.locator',
            message: `Locator evidence tidak memadai untuk CP VERIFIED. Wajib menyertakan lampiran, tabel, pasal, atau nomor halaman spesifik.`,
            severity: 'ERROR',
          });
        }
      }
    }
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  return {
    isValid: errors.length === 0,
    issues,
  };
}

/**
 * Memvalidasi seluruh kumpulan Master CP Entries
 */
export function validateAllCPEntries(entries: MasterCPEntry[] = ALL_MASTER_CP_ENTRIES) {
  const allIssues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const cp of entries) {
    if (seenIds.has(cp.id)) {
      allIssues.push({
        ruleId: cp.id,
        field: 'id',
        message: `Duplicate CP ID terdeteksi: '${cp.id}'.`,
        severity: 'ERROR',
      });
    } else {
      seenIds.add(cp.id);
    }

    const res = validateCPEntry(cp);
    if (res.issues.length > 0) {
      allIssues.push(...res.issues);
    }
  }

  // Cross-entry Overlapping Active Versions
  const activeEntries = entries.filter((c) => c.verificationStatus !== 'SUPERSEDED');
  const grouped = new Map<string, MasterCPEntry[]>();

  for (const cp of activeEntries) {
    const key = `${cp.level}_${cp.phase}_${cp.subjectCode}`;
    const grp = grouped.get(key) || [];
    grp.push(cp);
    grouped.set(key, grp);
  }

  for (const [key, group] of grouped.entries()) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const cpA = group[i];
          const cpB = group[j];

          const startA = cpA.effectiveFrom || '1970-01-01';
          const endA = cpA.effectiveUntil || '9999-12-31';
          const startB = cpB.effectiveFrom || '1970-01-01';
          const endB = cpB.effectiveUntil || '9999-12-31';

          const overlaps = startA <= endB && startB <= endA;
          if (overlaps) {
            allIssues.push({
              ruleId: cpA.id,
              field: 'effectivePeriod',
              message: `Overlapping active CP terdeteksi untuk kunci ${key}: CP '${cpA.id}' dan '${cpB.id}' memiliki periode berlaku aktif yang saling tumpang tindih.`,
              severity: 'ERROR',
            });
          }
        }
      }
    }
  }

  const errors = allIssues.filter((i) => i.severity === 'ERROR');
  const warnings = allIssues.filter((i) => i.severity === 'WARNING');
  const verifiedCPs = entries.filter((c) => c.verificationStatus === 'VERIFIED').length;
  const unverifiedCPs = entries.filter((c) => c.verificationStatus === 'UNVERIFIED').length;
  const supersededCPs = entries.filter((c) => c.verificationStatus === 'SUPERSEDED').length;

  return {
    valid: errors.length === 0,
    totalCPs: entries.length,
    verifiedCPs,
    unverifiedCPs,
    supersededCPs,
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: allIssues,
  };
}

/**
 * MASTER VALIDATOR RESMI CURRICULUM FOUNDATION
 * Memvalidasi integritas master struktur kurikulum nasional (SD, SMP, SMA)
 */
export function validateCurriculumMaster(
  rules: CurriculumStructureRule[] = ALL_CURRICULUM_STRUCTURE_RULES
) {
  return validateAllStructureRules(rules);
}


