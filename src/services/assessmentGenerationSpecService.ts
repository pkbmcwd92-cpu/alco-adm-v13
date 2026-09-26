import {
  AcademicSetting,
  AssessmentCriterion,
  AssessmentGenerationIssue,
  AssessmentGenerationProfile,
  AssessmentGenerationResolutionStatus,
  AssessmentGenerationSpec,
  AssessmentInstrumentType,
  AssessmentPlan,
  AssessmentSourceContext,
  K13Analysis,
  K13AnalysisItem,
  ResolvedAssessmentCriterion,
  ResolvedAssessmentCurriculumContext,
  ResolvedAssessmentObjective,
  TPData,
  TPItem,
} from '../types';
import {
  createAssessmentGenerationProfile,
  resolveGrade,
  resolvePhaseForGrade,
} from './assessmentGenerationProfileService';
import { resolveSubjectAssessmentProfile } from './subjectAssessmentProfileService';
import { mapObjectiveToEvidence } from './assessmentEvidenceMapperService';

export interface ResolveAssessmentGenerationSpecParams {
  assessmentPlan?: AssessmentPlan | null;
  academicSetting?: AcademicSetting | null;
  tp?: TPData | null;
  k13Analysis?: K13Analysis | null;
  assessmentCriteria?: AssessmentCriterion[] | null;
  activeAssessmentPackageId?: string;
  canonicalSourceContext?: AssessmentSourceContext[];
}

/**
 * Resolusi canonical text untuk Tujuan Pembelajaran (Kurikulum Merdeka).
 * Berdasarkan kontrak TP kanonikal: statement > description > competence + contentScope > competence.
 * Tidak menebak atau memalsukan teks dari subjek atau ID jika kosong.
 */
export function resolveCanonicalTPText(item: TPItem): string {
  if (item.statement && item.statement.trim() !== '') return item.statement.trim();
  if (item.description && item.description.trim() !== '') return item.description.trim();
  if (item.competence && item.contentScope) {
    const combined = `${item.competence} ${item.contentScope}`.trim();
    if (combined !== '') return combined;
  }
  if (item.competence && item.competence.trim() !== '') return item.competence.trim();

  // Legacy field fallback terisolasi dan terurut (misal mock / integrasi lama)
  const legacy = item as unknown as Record<string, unknown>;
  if (typeof legacy.tp === 'string' && legacy.tp.trim() !== '') return legacy.tp.trim();
  if (typeof legacy.text === 'string' && legacy.text.trim() !== '') return legacy.text.trim();

  return '';
}

/**
 * Resolusi canonical text untuk Kompetensi Dasar K13.
 * Berdasarkan kontrak analisis KD K13: tujuanPembelajaran > kd > indikator.
 * Tidak menebak atau memalsukan teks dari subjek atau ID jika kosong.
 */
export function resolveCanonicalKDText(item: K13AnalysisItem): string {
  if (item.tujuanPembelajaran && item.tujuanPembelajaran.trim() !== '') return item.tujuanPembelajaran.trim();
  if (item.kd && item.kd.trim() !== '') return item.kd.trim();
  if (item.indikator && item.indikator.trim() !== '') return item.indikator.trim();

  // Legacy field fallback terisolasi dan terurut (misal mock / integrasi lama)
  const legacy = item as unknown as Record<string, unknown>;
  if (typeof legacy.kdText === 'string' && legacy.kdText.trim() !== '') return legacy.kdText.trim();
  if (typeof legacy.text === 'string' && legacy.text.trim() !== '') return legacy.text.trim();

  return '';
}

/**
 * Resolusi tipe kurikulum secara eksplisit dan fail-closed.
 * Tidak boleh menebak Kurikulum Merdeka hanya karena ada data TP.
 */
export function getExplicitCurriculum(
  setting?: AcademicSetting | null
): 'KURIKULUM_MERDEKA' | 'K13' | 'UNRESOLVED' {
  if (!setting) return 'UNRESOLVED';
  if (setting.curriculumType === 'K13') return 'K13';
  if (setting.curriculumType === 'KURIKULUM_MERDEKA') return 'KURIKULUM_MERDEKA';
  if (!setting.curriculum || setting.curriculum.trim() === '') return 'UNRESOLVED';

  const cur = setting.curriculum.toLowerCase();
  if (cur.includes('2013') || cur.includes('k13')) return 'K13';
  if (cur.includes('merdeka')) return 'KURIKULUM_MERDEKA';

  return 'UNRESOLVED';
}

/**
 * Single Entry Point Resolver: resolveAssessmentGenerationSpec
 *
 * Mengubah canonical Rencana Asesmen (Audit 9A) dan konteks akademik menjadi
 * spesifikasi konteks generasi asesmen deterministik (AssessmentGenerationSpec).
 *
 * Aturan Utama:
 * 1. Fail-closed: Jika dependensi kanonikal tidak lengkap/valid -> BLOCKED.
 * 2. Tanpa mutasi: Rekomendasi tidak boleh mengubah AssessmentPlan kanonikal.
 * 3. Tidak ada tebakan/fallback indeks pertama (no tp.items[0] / k13.items[0]).
 * 4. Mismatch rekomendasi menghasilkan status NEEDS_REVIEW.
 * 5. Tanpa pembuatan soal dan tanpa AI.
 */
export function resolveAssessmentGenerationSpec(
  params: ResolveAssessmentGenerationSpecParams
): AssessmentGenerationSpec {
  const issues: AssessmentGenerationIssue[] = [];
  const { assessmentPlan, academicSetting, tp, k13Analysis, assessmentCriteria, activeAssessmentPackageId } = params;

  const planId = assessmentPlan?.id || '';
  const packageId = activeAssessmentPackageId || (planId ? `pkg-${planId}` : '');

  // 1. Verifikasi Keberadaan AssessmentPlan
  if (!assessmentPlan) {
    issues.push({
      code: 'ASSESSMENT_PLAN_NOT_FOUND',
      severity: 'BLOCKING',
      message: 'Rencana Asesmen (AssessmentPlan) tidak ditemukan atau belum diberikan.',
    });
  } else if (assessmentPlan.workflowStatus !== 'SIAP') {
    // 2. Verifikasi Kesiapan Workflow Status (wajib SIAP)
    issues.push({
      code: 'ASSESSMENT_PLAN_NOT_READY',
      severity: 'BLOCKING',
      message: `Rencana Asesmen "${assessmentPlan.title || planId}" belum berstatus SIAP (status saat ini: ${assessmentPlan.workflowStatus || 'DRAFT'}).`,
    });
  } else if (assessmentPlan.needsReview) {
    issues.push({
      code: 'ASSESSMENT_PLAN_NEEDS_REVIEW',
      severity: 'BLOCKING',
      message: `Rencana Asesmen "${assessmentPlan.title || planId}" masih memerlukan peninjauan ulang.`,
    });
  }

  // 3. Resolusi Kurikulum Eksplisit
  const rawCurriculumType = getExplicitCurriculum(academicSetting);
  if (rawCurriculumType === 'UNRESOLVED') {
    issues.push({
      code: 'CURRICULUM_UNRESOLVED',
      severity: 'BLOCKING',
      message: 'Jenis kurikulum tidak dapat di-resolve secara aman dari AcademicSetting.',
    });
  }

  // 4. Resolusi Jenjang Kelas (Grade)
  const resolvedGradeNumber = resolveGrade(academicSetting);
  if (resolvedGradeNumber === undefined) {
    issues.push({
      code: 'GRADE_UNRESOLVED',
      severity: 'BLOCKING',
      message: 'Tingkat kelas (grade) tidak dapat di-resolve secara aman. Nilai wajib 1 s.d. 12 tanpa fallback asumsi.',
    });
  }

  // 5. Resolusi Mata Pelajaran (Subject)
  const subjectInput = academicSetting?.subject || '';
  const subjectProfile = resolveSubjectAssessmentProfile(subjectInput);
  if (subjectProfile.profileStatus === 'UNRESOLVED') {
    issues.push({
      code: 'SUBJECT_UNRESOLVED',
      severity: 'BLOCKING',
      message: `Mata pelajaran "${subjectInput}" tidak dapat di-resolve ke profil asesmen kanonikal.`,
    });
  } else if (subjectProfile.profileStatus === 'GENERIC') {
    issues.push({
      code: 'GENERIC_SUBJECT_PROFILE',
      severity: 'REVIEW',
      message: `Profil mata pelajaran untuk "${subjectInput}" belum memiliki spesifikasi domain khusus (menggunakan profil generic terstandar).`,
    });
  }

  // 6. Planned Instruments pada AssessmentPlan
  const plannedInstrumentTypes: AssessmentInstrumentType[] = [];
  if (assessmentPlan?.instruments && assessmentPlan.instruments.length > 0) {
    for (const inst of assessmentPlan.instruments) {
      if (inst.type && !plannedInstrumentTypes.includes(inst.type)) {
        plannedInstrumentTypes.push(inst.type);
      }
    }
  }

  if (plannedInstrumentTypes.length === 0) {
    issues.push({
      code: 'PLANNED_INSTRUMENT_EMPTY',
      severity: 'BLOCKING',
      message: 'Rencana Asesmen tidak memiliki instrumen asesmen yang terdaftar.',
    });
  }

  // 7. Resolusi Objectives (TP / KD) secara ID kanonikal (NO items[0] fallback)
  const resolvedObjectives: ResolvedAssessmentObjective[] = [];
  const planTpIds = assessmentPlan?.tpIds || [];

  if (planTpIds.length === 0) {
    issues.push({
      code: 'PLAN_OBJECTIVES_EMPTY',
      severity: 'BLOCKING',
      message: 'Rencana Asesmen tidak memiliki referensi tujuan pembelajaran (tpIds kosong).',
    });
  } else if (rawCurriculumType === 'KURIKULUM_MERDEKA') {
    if (!tp || !Array.isArray(tp.items)) {
      issues.push({
        code: 'OBJECTIVE_SOURCE_MISSING',
        severity: 'BLOCKING',
        message: 'Sumber data Tujuan Pembelajaran (TP) kanonikal tidak tersedia untuk Kurikulum Merdeka.',
      });
    } else if (tp.workflowStatus !== 'SIAP' || tp.needsReview) {
      issues.push({
        code: 'OBJECTIVE_SOURCE_NOT_READY',
        severity: 'BLOCKING',
        message: 'Sumber data Tujuan Pembelajaran (TP) kanonikal belum SIAP atau masih memerlukan review.',
      });
    } else {
      for (const targetId of planTpIds) {
        const found = tp.items.find((item) => item.id === targetId);
        if (!found) {
          issues.push({
            code: 'DANGLING_OBJECTIVE_REF',
            severity: 'BLOCKING',
            message: `Referensi TP kanonikal dengan ID "${targetId}" tidak ditemukan pada daftar Tujuan Pembelajaran.`,
            objectiveRefId: targetId,
          });
        } else {
          // Cari kriteria yang terasosiasi dengan TP ini
          const matchingCriteriaIds = (assessmentPlan?.criterionIds || []).filter((critId) => {
            const c = (assessmentCriteria || []).find((x) => x.id === critId);
            return c && c.tpId === targetId;
          });

          const text = resolveCanonicalTPText(found);
          if (!text || text.trim() === '') {
            issues.push({
              code: 'OBJECTIVE_TEXT_EMPTY',
              severity: 'BLOCKING',
              message: `Tujuan pembelajaran kanonikal dengan ID "${targetId}" memiliki teks kosong.`,
              objectiveRefId: targetId,
            });
          }

          resolvedObjectives.push({
            id: found.id,
            sourceType: 'TP',
            text,
            criterionIds: matchingCriteriaIds,
          });
        }
      }
    }
  } else if (rawCurriculumType === 'K13') {
    if (!k13Analysis || !Array.isArray(k13Analysis.items)) {
      issues.push({
        code: 'OBJECTIVE_SOURCE_MISSING',
        severity: 'BLOCKING',
        message: 'Sumber data Analisis KD K13 kanonikal tidak tersedia untuk Kurikulum 2013.',
      });
    } else {
      for (const targetId of planTpIds) {
        const found = k13Analysis.items.find((item) => item.id === targetId);
        if (!found) {
          issues.push({
            code: 'DANGLING_OBJECTIVE_REF',
            severity: 'BLOCKING',
            message: `Referensi Kompetensi Dasar (KD) kanonikal dengan ID "${targetId}" tidak ditemukan pada data Analisis KD K13.`,
            objectiveRefId: targetId,
          });
        } else {
          const text = resolveCanonicalKDText(found);
          if (!text || text.trim() === '') {
            issues.push({
              code: 'OBJECTIVE_TEXT_EMPTY',
              severity: 'BLOCKING',
              message: `Kompetensi Dasar (KD) kanonikal dengan ID "${targetId}" memiliki teks kosong.`,
              objectiveRefId: targetId,
            });
          }

          resolvedObjectives.push({
            id: found.id,
            sourceType: 'KD',
            text,
            criterionIds: [],
          });
        }
      }
    }
  }

  // 8. Resolusi Kriteria (KKTP / Indikator)
  const resolvedCriteria: ResolvedAssessmentCriterion[] = [];
  const planCriterionIds = assessmentPlan?.criterionIds || [];

  if (planCriterionIds.length > 0) {
    if (!assessmentCriteria || !Array.isArray(assessmentCriteria) || assessmentCriteria.length === 0) {
      issues.push({
        code: 'CRITERIA_SOURCE_MISSING',
        severity: 'BLOCKING',
        message: 'Rencana Asesmen merujuk KKTP/kriteria, namun data kanonikal kriteria tidak ditemukan.',
      });
    } else {
      for (const critId of planCriterionIds) {
        const foundCrit = assessmentCriteria.find((c) => c.id === critId);
        if (!foundCrit) {
          issues.push({
            code: 'DANGLING_CRITERION_REF',
            severity: 'BLOCKING',
            message: `Referensi Kriteria/KKTP dengan ID "${critId}" tidak ditemukan pada data asesmen.`,
            criterionId: critId,
          });
        } else if (foundCrit.workflowStatus !== 'SIAP' || foundCrit.needsReview) {
          issues.push({
            code: 'CRITERION_SOURCE_NOT_READY',
            severity: 'BLOCKING',
            message: `Kriteria/KKTP dengan ID "${critId}" belum SIAP atau masih memerlukan review.`,
            criterionId: critId,
          });
        } else {
          // Periksa apakah kriteria milik salah satu objective pada rencana
          if (foundCrit.tpId && !planTpIds.includes(foundCrit.tpId)) {
            issues.push({
              code: 'CRITERION_OBJECTIVE_MISMATCH',
              severity: 'BLOCKING',
              message: `Kriteria "${foundCrit.description || critId}" merujuk ke TP "${foundCrit.tpId}" yang tidak ada dalam Rencana Asesmen.`,
              criterionId: critId,
              objectiveRefId: foundCrit.tpId,
            });
          } else {
            resolvedCriteria.push({
              id: foundCrit.id,
              objectiveRefId: foundCrit.tpId || '',
              name: foundCrit.description || '',
              description: foundCrit.notes || (foundCrit.indicators ? foundCrit.indicators.join('; ') : ''),
            });
          }
        }
      }
    }
  }

  // 9. Pembuatan Profil Generasi & Profil Kalibrasi Jenjang (hanya jika grade terdefinisi secara kanonikal)
  let generationProfile: AssessmentGenerationProfile | undefined = undefined;
  if (resolvedGradeNumber !== undefined) {
    generationProfile = createAssessmentGenerationProfile(resolvedGradeNumber);
  }

  // 10. Pemetaan Rekomendasi Bukti (Evidence Mapping) & Pengecekan Keselarasan Instrumen
  const evidenceRecommendations = resolvedObjectives.flatMap((obj) => {
    const relatedCriteria = resolvedCriteria.filter(
      (c) => c.objectiveRefId === obj.id
    );

    const targets: (ResolvedAssessmentCriterion | undefined)[] =
      relatedCriteria.length > 0
        ? relatedCriteria
        : [undefined];

    return targets.map((criterion) => {
      const rec = mapObjectiveToEvidence({
        objective: obj,
        criterion,
        subjectProfile,
        generationProfile,
        plannedInstrumentTypes,
      });

      // Pengecekan koherensi dengan AssessmentPlan kanonikal:
      // CANONICAL PLAN MUST WIN! Rekomendasi tidak boleh merubah plannedInstrumentTypes di plan.
      // Jika rekomendasi kosong karena ambigu, JANGAN membuat mismatch palsu (hanya EVIDENCE_RECOMMENDATION_AMBIGUOUS).
      const hasRecommendations = rec.recommendedInstrumentTypes.length > 0;
      const isCoherent = hasRecommendations && rec.recommendedInstrumentTypes.some((recInst) =>
        plannedInstrumentTypes.includes(recInst)
      );

      if (hasRecommendations && !isCoherent && plannedInstrumentTypes.length > 0) {
        issues.push({
          code: 'INSTRUMENT_RECOMMENDATION_MISMATCH',
          severity: 'REVIEW',
          message: `Rekomendasi instrumen (${rec.recommendedInstrumentTypes.join(', ')}) untuk kompetensi "${obj.text.slice(0, 50)}..." berbeda dari instrumen rencana (${plannedInstrumentTypes.join(', ')}). Rencana Asesmen guru tetap dipertahankan.`,
          objectiveRefId: obj.id,
          criterionId: criterion?.id,
        });
      }

      if (rec.confidence === 'NEEDS_TEACHER_REVIEW') {
        issues.push({
          code: 'EVIDENCE_RECOMMENDATION_AMBIGUOUS',
          severity: 'REVIEW',
          message: `Rekomendasi bukti untuk tujuan pembelajaran ID "${obj.id}" memerlukan telaah/konfirmasi oleh guru.`,
          objectiveRefId: obj.id,
          criterionId: criterion?.id,
        });
      }

      return rec;
    });
  });

  // 11. Konteks Sumber (Source Context) - Hanya sumber nyata/kanonikal guru
  const sourceContext: AssessmentSourceContext[] = [];

  if (params.canonicalSourceContext && Array.isArray(params.canonicalSourceContext)) {
    sourceContext.push(...params.canonicalSourceContext);
  }

  if (assessmentPlan) {
    sourceContext.push({
      id: `SRC-PLAN-${assessmentPlan.id}`,
      sourceType: 'TEACHER_SOURCE',
      title: assessmentPlan.title || 'Rencana Asesmen Guru',
      revision: assessmentPlan.updatedAt,
    });
  }

  // 12. Evaluasi Final Status Resolusi
  let status: AssessmentGenerationResolutionStatus = 'RESOLVED';
  const hasBlocking = issues.some((i) => i.severity === 'BLOCKING');
  const hasReview = issues.some((i) => i.severity === 'REVIEW');

  if (hasBlocking) {
    status = 'BLOCKED';
  } else if (hasReview) {
    status = 'NEEDS_REVIEW';
  }

  const rawLevel = academicSetting?.level;
  let resolvedSchoolLevel: 'SD' | 'SMP' | 'SMA' | undefined = undefined;
  if (rawLevel === 'SD' || rawLevel === 'SMP' || rawLevel === 'SMA') {
    resolvedSchoolLevel = rawLevel;
  }

  let resolvedCurriculumType: 'KURIKULUM_MERDEKA' | 'K13' | undefined = undefined;
  if (rawCurriculumType === 'KURIKULUM_MERDEKA' || rawCurriculumType === 'K13') {
    resolvedCurriculumType = rawCurriculumType;
  }

  const settingId = academicSetting?.id || params.assessmentPlan?.academicSettingId;

  const curriculumContext: ResolvedAssessmentCurriculumContext = {
    academicSettingId: settingId,
    curriculumType: resolvedCurriculumType,
    rawCurriculumName: academicSetting?.curriculum || '',
    grade: resolvedGradeNumber,
    schoolLevel: resolvedSchoolLevel,
    phase: resolvedGradeNumber !== undefined ? resolvePhaseForGrade(resolvedGradeNumber) : undefined,
  };

  return {
    assessmentPlanId: planId,
    assessmentPackageId: packageId,
    academicSettingId: settingId,
    curriculumContext,
    objectives: resolvedObjectives,
    criteria: resolvedCriteria,
    generationProfile,
    subjectProfile,
    evidenceRecommendations,
    plannedInstrumentTypes,
    sourceContext,
    resolution: {
      status,
      issues,
    },
  };
}
