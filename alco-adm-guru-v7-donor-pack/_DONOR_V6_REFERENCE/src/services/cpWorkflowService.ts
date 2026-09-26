import {
  CPData,
  CPAnalysisData,
  TPData,
  TPItem,
  ATPData,
  ATPItem,
  WorkflowCompletionStatus,
  ActiveContext,
  AcademicSetting,
  normalizeCPVerificationStatus,
} from '../types';

export interface CPValidationDetails {
  status: WorkflowCompletionStatus;
  isSiap: boolean;
  issues: string[];
}

/**
 * Validasi mendalam untuk status workflow CPData
 */
export function validateCPDataWorkflow(
  cp: CPData,
  context?: Partial<ActiveContext> | Partial<AcademicSetting>
): CPValidationDetails {
  const issues: string[] = [];

  const hasDesc = !!(cp.generalDescription && cp.generalDescription.trim().length >= 10);
  const hasElements = !!(cp.elements && cp.elements.length > 0);

  if (!hasDesc && !hasElements) {
    return {
      status: 'BELUM_DIMULAI',
      isSiap: false,
      issues: ['Deskripsi CP umum dan rincian elemen CP masih kosong.'],
    };
  }

  // Check element validity
  if (cp.elements && cp.elements.length > 0) {
    for (let i = 0; i < cp.elements.length; i++) {
      const el = cp.elements[i];
      if (!el.name || !el.name.trim()) {
        issues.push(`Elemen ke-${i + 1} tidak memiliki nama elemen.`);
      }
      if (!el.content || !el.content.trim()) {
        issues.push(`Elemen "${el.name || i + 1}" tidak memiliki uraian konten.`);
      }
    }
  }

  // Check source availability & verification status
  if (!cp.source) {
    issues.push('Sumber rujukan CP belum diset.');
  } else {
    const status = normalizeCPVerificationStatus(cp.source.verificationStatus);
    if (status === 'SUPERSEDED') {
      issues.push('Sumber CP yang digunakan telah kedaluwarsa/digantikan (SUPERSEDED).');
    } else if (status === 'VERSION_CONFLICT') {
      issues.push('Terjadi konflik versi CP (AMBIGUOUS). Spesifikasikan tahun ajaran/regulasi.');
    }
  }

  // Check context match if context is provided
  if (context) {
    if (context.subject && cp.source?.title) {
      // Basic sanity check
    }
  }

  if (issues.length > 0) {
    const isDraft = hasDesc || hasElements;
    return {
      status: isDraft ? 'PERLU_DILENGKAPI' : 'BELUM_DIMULAI',
      isSiap: false,
      issues,
    };
  }

  return {
    status: 'SIAP',
    isSiap: true,
    issues: [],
  };
}

export interface CPAnalysisValidationDetails {
  status: WorkflowCompletionStatus;
  isSiap: boolean;
  issues: string[];
}

/**
 * Validasi mendalam untuk status workflow CPAnalysisData
 */
export function validateCPAnalysisDataWorkflow(
  cpAnalysis?: CPAnalysisData,
  cp?: CPData
): CPAnalysisValidationDetails {
  const issues: string[] = [];

  if (!cpAnalysis || !cpAnalysis.items || cpAnalysis.items.length === 0) {
    return {
      status: 'BELUM_DIMULAI',
      isSiap: false,
      issues: ['Analisis CP belum memiliki baris bedah kompetensi.'],
    };
  }

  // Check if CP version changed or review needed
  if (cpAnalysis.needsReview) {
    issues.push(
      cpAnalysis.reviewReason ||
        'Versi CP sumber telah diperbarui. Analisis CP perlu ditinjau ulang.'
    );
  }

  // Check items completeness
  for (let i = 0; i < cpAnalysis.items.length; i++) {
    const item = cpAnalysis.items[i];
    if (!item.elementName || !item.elementName.trim()) {
      issues.push(`Baris analisis ke-${i + 1} belum memiliki nama elemen.`);
    }
    if (!item.cpCompetence || !item.cpCompetence.trim()) {
      issues.push(`Baris "${item.elementName || i + 1}" belum mengisi Kata Kerja Operasional (Kompetensi).`);
    }
    if (!item.materialScope || !item.materialScope.trim()) {
      issues.push(`Baris "${item.elementName || i + 1}" belum mengisi Lingkup Materi Inti.`);
    }
  }

  // Check if source CP is outdated
  if (cp && cpAnalysis.basedOnCpUpdatedAt && cp.updatedAt) {
    const cpTime = new Date(cp.updatedAt).getTime();
    const anaTime = new Date(cpAnalysis.basedOnCpUpdatedAt).getTime();
    if (cpTime > anaTime + 1000) {
      issues.push('Teks CP telah diperbarui sejak analisis ini dibuat. Mohon sesuaikan analisis.');
    }
  }

  if (issues.length > 0) {
    return {
      status: 'PERLU_DILENGKAPI',
      isSiap: false,
      issues,
    };
  }

  return {
    status: 'SIAP',
    isSiap: true,
    issues: [],
  };
}

export interface TPValidationDetails {
  status: WorkflowCompletionStatus;
  isSiap: boolean;
  issues: string[];
}

/**
 * Validasi mendalam untuk status workflow TPData (Tujuan Pembelajaran)
 */
export function validateTPDataWorkflow(
  tp?: TPData,
  cp?: CPData,
  cpAnalysis?: CPAnalysisData,
  context?: Partial<ActiveContext> | Partial<AcademicSetting>
): TPValidationDetails {
  const issues: string[] = [];

  if (!tp || !tp.items || tp.items.length === 0) {
    return {
      status: 'BELUM_DIMULAI',
      isSiap: false,
      issues: ['Daftar Tujuan Pembelajaran (TP) belum dirumuskan.'],
    };
  }

  // Check essential provenance fields
  if (!tp.academicSettingId) {
    issues.push('TP belum terikat pada Academic Setting (academicSettingId).');
  }
  if (tp.cpId && cp && cp.id && tp.cpId !== cp.id) {
    issues.push(`ID CP pada TP (${tp.cpId}) tidak sesuai dengan CP rujukan (${cp.id}).`);
  }

  // Check if review is flagged
  if (tp.needsReview) {
    issues.push(
      tp.reviewReason ||
        'Tujuan Pembelajaran memerlukan peninjauan ulang karena data acuan (CP / Analisis CP) mengalami perubahan.'
    );
  }

  // Check CP source validity if CP is provided
  if (cp) {
    const cpStatus = normalizeCPVerificationStatus(cp.source?.verificationStatus || (cp as { verificationStatus?: any }).verificationStatus);
    if (['SUPERSEDED', 'VERSION_CONFLICT', 'AMBIGUOUS', 'UNRESOLVED'].includes(cpStatus)) {
      issues.push(`CP rujukan berstatus ${cpStatus} dan tidak valid untuk perumusan TP.`);
    }

    if (cp.updatedAt && tp.basedOnCpUpdatedAt) {
      const cpTime = new Date(cp.updatedAt).getTime();
      const tpCpTime = new Date(tp.basedOnCpUpdatedAt).getTime();
      if (cpTime > tpCpTime + 1000) {
        issues.push('Capaian Pembelajaran (CP) telah diperbarui sejak TP ini dirumuskan.');
      }
    }
  }

  // Check CP Analysis validity if CP Analysis is provided
  if (cpAnalysis) {
    if (cpAnalysis.needsReview) {
      issues.push('Analisis CP rujukan memerlukan peninjauan ulang.');
    }
    if (cpAnalysis.updatedAt && tp.basedOnAnalysisUpdatedAt) {
      const anaTime = new Date(cpAnalysis.updatedAt).getTime();
      const tpAnaTime = new Date(tp.basedOnAnalysisUpdatedAt).getTime();
      if (anaTime > tpAnaTime + 1000) {
        issues.push('Analisis CP telah diperbarui sejak TP ini dirumuskan.');
      }
    }
    if (tp.cpAnalysisId && cpAnalysis.id && tp.cpAnalysisId !== cpAnalysis.id) {
      issues.push('ID Analisis CP pada TP tidak sesuai dengan Analisis CP rujukan.');
    }
  }

  // Check Context / AcademicSetting consistency if context is provided
  if (context) {
    const contextSubject = (context as any).subjectCode || context.subject;
    if (contextSubject && tp.subjectCode && tp.subjectCode !== contextSubject) {
      issues.push(`Mata pelajaran TP (${tp.subjectCode}) tidak sesuai dengan konteks (${contextSubject}).`);
    }
    if (context.academicYear && tp.academicYear && tp.academicYear !== context.academicYear) {
      issues.push(`Tahun ajaran TP (${tp.academicYear}) tidak sesuai dengan konteks (${context.academicYear}).`);
    }
    if (context.phase && tp.phase && tp.phase !== context.phase) {
      issues.push(`Fase TP (${tp.phase}) tidak sesuai dengan konteks (${context.phase}).`);
    }

    const level = context.level || (context.grade ? (
      ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', '1', '2', '3', '4', '5', '6'].some((g) => String(context.grade).includes(g)) ? 'SD' :
      ['Kelas 7', 'Kelas 8', 'Kelas 9', '7', '8', '9'].some((g) => String(context.grade).includes(g)) ? 'SMP' : 'SMA'
    ) : undefined);

    if (level && context.phase) {
      if (level === 'SD' && !['A', 'B', 'C'].includes(context.phase)) {
        issues.push(`Fase ${context.phase} tidak sesuai untuk jenjang SD (harus A, B, atau C).`);
      } else if (level === 'SMP' && context.phase !== 'D') {
        issues.push(`Fase ${context.phase} tidak sesuai untuk jenjang SMP (harus Fase D).`);
      } else if (level === 'SMA' && !['E', 'F'].includes(context.phase)) {
        issues.push(`Fase ${context.phase} tidak sesuai untuk jenjang SMA (harus E atau F).`);
      }
    }
  }

  // Check items completeness & stable ID uniqueness
  const seenIds = new Set<string>();
  for (let i = 0; i < tp.items.length; i++) {
    const item = tp.items[i];
    const stmt = item.statement || item.description || '';
    if (!stmt.trim()) {
      issues.push(`Butir TP ke-${i + 1} (${item.code || 'Tanpa Kode'}) belum memiliki rumusan kalimat TP.`);
    }
    if (!item.id) {
      issues.push(`Butir TP ke-${i + 1} (${item.code || 'Tanpa Kode'}) belum memiliki Stable ID.`);
    } else {
      if (seenIds.has(item.id)) {
        issues.push(`Terdeteksi duplikasi Stable ID (${item.id}) pada butir TP.`);
      }
      seenIds.add(item.id);
    }
  }

  if (issues.length > 0) {
    return {
      status: 'PERLU_DILENGKAPI',
      isSiap: false,
      issues,
    };
  }

  return {
    status: 'SIAP',
    isSiap: true,
    issues: [],
  };
}

// ==========================================
// ATP REFERENCE VALIDATION & RESOLUTION
// ==========================================

export type ATPReferenceStatus =
  | 'RESOLVED_REFERENCE'
  | 'LEGACY_MIGRATED'
  | 'AMBIGUOUS_REFERENCE'
  | 'DANGLING_REFERENCE'
  | 'UNRESOLVED_REFERENCE';

export interface ATPReferenceResult {
  status: ATPReferenceStatus;
  canonicalTPItem?: TPItem;
  tpId?: string;
  issue?: string;
}

/**
 * Resolves reference from an ATPItem to a canonical TPItem in TPData.
 */
export function resolveATPItemTPReference(
  atpItem: ATPItem,
  tpItems: TPItem[] = []
): ATPReferenceResult {
  // 1. If atpItem has a tpId
  if (atpItem.tpId) {
    const match = tpItems.find((t) => t.id === atpItem.tpId);
    if (match) {
      return {
        status: 'RESOLVED_REFERENCE',
        canonicalTPItem: match,
        tpId: match.id,
      };
    } else {
      return {
        status: 'DANGLING_REFERENCE',
        tpId: atpItem.tpId,
        issue: `TP dengan ID "${atpItem.tpId}" pada langkah ke-${atpItem.stepNumber} tidak ditemukan pada TP tersimpan (Dangling Reference).`,
      };
    }
  }

  // 2. Legacy migration check by exact unique code
  if (atpItem.tpCode && atpItem.tpCode.trim()) {
    const codeMatches = tpItems.filter(
      (t) => t.code && t.code.trim().toLowerCase() === atpItem.tpCode.trim().toLowerCase()
    );
    if (codeMatches.length === 1) {
      return {
        status: 'LEGACY_MIGRATED',
        canonicalTPItem: codeMatches[0],
        tpId: codeMatches[0].id,
      };
    } else if (codeMatches.length > 1) {
      return {
        status: 'AMBIGUOUS_REFERENCE',
        issue: `Kode TP "${atpItem.tpCode}" pada langkah ke-${atpItem.stepNumber} cocok dengan lebih dari 1 butir TP (Ambiguous Reference).`,
      };
    }
  }

  // 3. Legacy migration check by exact unique normalized statement
  if (atpItem.tpStatement && atpItem.tpStatement.trim()) {
    const normStatement = atpItem.tpStatement.trim().toLowerCase();
    const statementMatches = tpItems.filter(
      (t) => (t.statement || t.description || '').trim().toLowerCase() === normStatement
    );
    if (statementMatches.length === 1) {
      return {
        status: 'LEGACY_MIGRATED',
        canonicalTPItem: statementMatches[0],
        tpId: statementMatches[0].id,
      };
    } else if (statementMatches.length > 1) {
      return {
        status: 'AMBIGUOUS_REFERENCE',
        issue: `Kalimat TP "${atpItem.tpStatement}" pada langkah ke-${atpItem.stepNumber} cocok dengan lebih dari 1 butir TP (Ambiguous Reference).`,
      };
    }
  }

  // 4. Unresolved reference
  return {
    status: 'UNRESOLVED_REFERENCE',
    issue: `Langkah ATP ke-${atpItem.stepNumber} (${atpItem.tpCode || 'Tanpa Kode'}) belum terhubung dengan Tujuan Pembelajaran (TP) manapun.`,
  };
}

/**
 * Validates ATP Data and its items against canonical TPData & AcademicSetting context.
 * Single authoritative validator for ATP workflow status.
 */
export function validateATPDataWorkflow(
  atp?: ATPData,
  tp?: TPData,
  academicSetting?: AcademicSetting
): {
  status: WorkflowCompletionStatus;
  isSiap: boolean;
  issues: string[];
  details: ATPReferenceResult[];
} {
  const issues: string[] = [];
  const details: ATPReferenceResult[] = [];

  if (!atp || !atp.items || atp.items.length === 0) {
    return {
      status: 'BELUM_DIMULAI',
      isSiap: false,
      issues: ['Matriks Alur Tujuan Pembelajaran (ATP) belum disusun.'],
      details,
    };
  }

  // Canonical TP Readiness check
  if (!tp || tp.items.length === 0) {
    issues.push('Daftar Tujuan Pembelajaran (TP) acuan belum tersedia.');
  } else if (tp.workflowStatus !== 'SIAP' || tp.needsReview) {
    issues.push('Tujuan Pembelajaran (TP) acuan belum berstatus SIAP atau memerlukan peninjauan ulang.');
  }

  // Flag review check
  if (atp.needsReview) {
    issues.push(
      atp.reviewReason || 'Alur Tujuan Pembelajaran (ATP) memerlukan peninjauan ulang karena TP acuan telah diperbarui.'
    );
  }

  // Academic Setting check
  if (academicSetting && atp.academicSettingId && atp.academicSettingId !== academicSetting.id) {
    issues.push(`ATP terikat pada Academic Setting lain (${atp.academicSettingId}).`);
  }

  // Provenance check against TPData
  if (tp?.id) {
    if (atp.tpId && atp.tpId !== tp.id) {
      issues.push(`ID TPData pada ATP (${atp.tpId}) tidak sesuai dengan TP rujukan (${tp.id}).`);
    }
    if (atp.tpDataId && atp.tpDataId !== tp.id) {
      issues.push(`ID TPData pada ATP (${atp.tpDataId}) tidak sesuai dengan TP rujukan (${tp.id}).`);
    }
  }

  // Check if AI generated ATP is still in DRAFT
  if (atp.workflowStatus === 'DRAFT') {
    issues.push('Alur Tujuan Pembelajaran (ATP) berstatus DRAFT dan memerlukan konfirmasi guru.');
  }

  // Items step ordering & reference validation
  const tpItems = tp?.items || [];
  const seenStepNumbers = new Set<number>();

  for (let i = 0; i < atp.items.length; i++) {
    const item = atp.items[i];

    // Step number ordering
    if (!item.stepNumber || item.stepNumber <= 0) {
      issues.push(`Langkah ATP ke-${i + 1} memiliki nomor urut (stepNumber) yang tidak valid.`);
    } else if (seenStepNumbers.has(item.stepNumber)) {
      issues.push(`Langkah ATP ke-${i + 1} memiliki nomor urut duplikat (${item.stepNumber}).`);
    } else {
      seenStepNumbers.add(item.stepNumber);
    }

    // Reference resolution
    const res = resolveATPItemTPReference(item, tpItems);
    details.push(res);
    if (
      res.status === 'DANGLING_REFERENCE' ||
      res.status === 'AMBIGUOUS_REFERENCE' ||
      res.status === 'UNRESOLVED_REFERENCE'
    ) {
      if (res.issue) issues.push(res.issue);
    }

    if (item.jp !== undefined && item.jp !== null && Number(item.jp) <= 0) {
      issues.push(`Langkah ATP ke-${item.stepNumber || i + 1} belum memiliki alokasi JP yang valid.`);
    }
  }

  // TP Coverage check (MISSING_TP_REFERENCE)
  if (tpItems.length > 0) {
    for (const tpItem of tpItems) {
      const isCovered = atp.items.some((item) => {
        const ref = resolveATPItemTPReference(item, tpItems);
        return ref.canonicalTPItem?.id === tpItem.id;
      });
      if (!isCovered) {
        issues.push(
          `MISSING_TP_REFERENCE: Tujuan Pembelajaran "${tpItem.code || tpItem.id}" (${tpItem.statement.substring(0, 40)}...) belum dimasukkan ke dalam Alur Tujuan Pembelajaran (ATP).`
        );
      }
    }
  }

  // Duplicate TP reference check (DUPLICATE_TP_REFERENCE)
  if (tpItems.length > 0) {
    const referencedTpCount = new Map<string, number>();
    for (const item of atp.items) {
      const ref = resolveATPItemTPReference(item, tpItems);
      if (ref.canonicalTPItem?.id) {
        const tid = ref.canonicalTPItem.id;
        referencedTpCount.set(tid, (referencedTpCount.get(tid) || 0) + 1);
      }
    }
    referencedTpCount.forEach((count, tid) => {
      if (count > 1) {
        const matchedTp = tpItems.find((t) => t.id === tid);
        issues.push(
          `DUPLICATE_TP_REFERENCE: Tujuan Pembelajaran "${matchedTp?.code || tid}" dirujuk lebih dari 1 kali dalam ATP (${count} kali).`
        );
      }
    });
  }

  if (issues.length > 0) {
    return {
      status: atp.workflowStatus === 'DRAFT' ? 'DRAFT' : 'PERLU_DILENGKAPI',
      isSiap: false,
      issues,
      details,
    };
  }

  return {
    status: 'SIAP',
    isSiap: true,
    issues: [],
    details,
  };
}

/**
 * Validates all ATP items against canonical TPData.
 */
export function validateATPReferences(
  atp?: ATPData,
  tp?: TPData
): {
  status: WorkflowCompletionStatus;
  isSiap: boolean;
  issues: string[];
  details: ATPReferenceResult[];
} {
  return validateATPDataWorkflow(atp, tp);
}

/**
 * Automatically migrates legacy ATP items (populating tpId if unique match found).
 */
export function normalizeATPReferences(atp: ATPData, tp?: TPData): ATPData {
  if (!tp || !tp.items || tp.items.length === 0) return atp;

  const updatedItems = atp.items.map((item) => {
    const res = resolveATPItemTPReference(item, tp.items);
    if (res.status === 'LEGACY_MIGRATED' && res.tpId) {
      return {
        ...item,
        tpId: res.tpId,
        tpCode: res.canonicalTPItem?.code || item.tpCode,
        tpStatement: res.canonicalTPItem?.statement || item.tpStatement,
      };
    }
    return item;
  });

  return {
    ...atp,
    tpId: atp.tpId || tp.id,
    items: updatedItems,
  };
}
