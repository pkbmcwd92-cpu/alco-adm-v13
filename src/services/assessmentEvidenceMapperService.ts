import {
  AssessmentEvidenceRecommendation,
  AssessmentEvidenceType,
  AssessmentInstrumentType,
  AssessmentGenerationRule,
  ResolvedAssessmentObjective,
  ResolvedAssessmentCriterion,
  SubjectAssessmentProfile,
  AssessmentGenerationProfile,
} from '../types';

export interface MapEvidenceParams {
  objective: ResolvedAssessmentObjective;
  criterion?: ResolvedAssessmentCriterion;
  subjectProfile: SubjectAssessmentProfile;
  generationProfile?: AssessmentGenerationProfile;
  plannedInstrumentTypes?: AssessmentInstrumentType[];
}

/**
 * Pemeta Bukti Ketercapaian Asesmen (Evidence Mapper).
 * Memetakan TP/KD dan kriteria ke rekomendasi bukti dan instrumen secara rule-based & deterministik.
 * Tanpa AI, tanpa prompt, tanpa pembentukan soal.
 */
export function mapObjectiveToEvidence(params: MapEvidenceParams): AssessmentEvidenceRecommendation {
  const { objective, criterion, subjectProfile } = params;

  // Gabungkan teks objektif dan kriteria untuk evaluasi kontekstual
  const rawText = [
    objective.text || '',
    criterion?.name || '',
    criterion?.description || '',
  ].join(' ').toLowerCase();

  const matchedRules: typeof subjectProfile.recommendationRules = [];

  for (const rule of subjectProfile.recommendationRules) {
    if (!rule.triggerKeywords || rule.triggerKeywords.length === 0) continue;

    const isMatch = rule.triggerKeywords.some((kw) => {
      const lowerKw = kw.toLowerCase();
      // Gunakan word boundary atau include yang aman
      return rawText.includes(lowerKw);
    });

    if (isMatch) {
      matchedRules.push(rule);
    }
  }

  // Jika ada rule yang cocok
  if (matchedRules.length > 0) {
    const evidenceSet = new Set<AssessmentEvidenceType>();
    const instrumentSet = new Set<AssessmentInstrumentType>();
    const rationaleCodes: string[] = [];
    const provenanceList: AssessmentGenerationRule[] = [];

    for (const rule of matchedRules) {
      rule.recommendedEvidenceTypes.forEach((e) => evidenceSet.add(e));
      rule.recommendedInstrumentTypes.forEach((inst) => instrumentSet.add(inst));
      if (!rationaleCodes.includes(rule.rationaleCode)) {
        rationaleCodes.push(rule.rationaleCode);
      }
      provenanceList.push(rule.provenance);
    }

    // Jika profil subject adalah GENERIC, tandai dengan NEEDS_TEACHER_REVIEW
    const confidence = subjectProfile.profileStatus === 'SPECIFIC'
      ? 'RULE_BASED'
      : 'NEEDS_TEACHER_REVIEW';

    return {
      objectiveRefId: objective.id,
      criterionId: criterion?.id,
      evidenceTypes: Array.from(evidenceSet),
      recommendedInstrumentTypes: Array.from(instrumentSet),
      rationaleCode: rationaleCodes.join('+'),
      provenance: provenanceList,
      confidence,
    };
  }

  // Jika tidak ada rule yang cocok atau kompetensi ambigu:
  // Dilarang memilih indeks pertama atau fallback written test / knowledge response secara deterministik.
  return {
    objectiveRefId: objective.id,
    criterionId: criterion?.id,
    evidenceTypes: [],
    recommendedInstrumentTypes: [],
    rationaleCode: 'COMPETENCY_AMBIGUOUS',
    provenance: subjectProfile.provenance,
    confidence: 'NEEDS_TEACHER_REVIEW',
  };
}
