import {
  AssessmentRegenerationTarget,
  AssessmentRegenerationLocator,
  AssessmentValidationFinding,
} from '../types';

export const EXPLICIT_STRUCTURAL_CODES = new Set<string>([
  'STRUCTURAL_ERROR',
  'STRUCTURAL_WARNING',
  'DANGLING_ANSWER_KEY_INSTRUMENT',
  'DANGLING_ANSWER_KEY_ITEM',
  'DANGLING_BLUEPRINT_INSTRUMENT',
  'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH',
  'BLUEPRINT_INSTRUMENT_ITEM_OWNERSHIP_MISMATCH',
  'MISSING_BLUEPRINT',
  'MISSING_PLANNED_COVERAGE',
  'OBJECTIVE_REF_MISMATCH',
  'CRITERION_REF_MISMATCH',
  'AMBIGUOUS_INSTRUMENT_LINKAGE',
  'MISSING_INSTRUMENT_LINKAGE',
  'INSTRUMENT_TYPE_MISMATCH',
  'ALLOCATION_SEMANTICS_MISMATCH',
  'COVERAGE_COUNT_UNRESOLVED',
  'COVERAGE_COUNT_MISMATCH',
  'MISSING_BLUEPRINT_COVERAGE_UNIT_ID',
  'UNEXPECTED_COVERAGE_UNIT',
  'EXACT_DUPLICATE_ITEM_PROMPT',
  'DANGLING_ANSWER_KEY_OPTION',
  'ANSWER_SOURCE_CONFLICT',
  'DANGLING_MATCHING_REFERENCE',
  'ALLOCATION_UNIT_MISMATCH',
  'INVALID_ITEM_TYPE',
  'INSUFFICIENT_GENERATED_UNITS',
  'PROVIDER_MISSING',
  'PROVIDER_EXECUTION_ERROR',
]);

export const ACTIONABLE_FINDING_CODE_MAP: Record<string, AssessmentRegenerationTarget> = {
  // Distractors / Options
  POOR_DISTRACTOR: 'OPTIONS',
  QUALITY_DISTRACTOR_QUALITY_FAIL: 'OPTIONS',
  QUALITY_DISTRACTOR_QUALITY_REVIEW: 'OPTIONS',
  INVALID_OPTION_STRUCTURE: 'OPTIONS',
  INVALID_OPTION_TEXT: 'OPTIONS',

  // Item Prompt
  POOR_PROMPT: 'ITEM_PROMPT',
  EMPTY_ITEM_PROMPT: 'ITEM_PROMPT',
  QUALITY_ITEM_CONSTRUCTION_FAIL: 'ITEM_PROMPT',
  QUALITY_ITEM_CONSTRUCTION_REVIEW: 'ITEM_PROMPT',

  // Stimulus
  POOR_STIMULUS: 'STIMULUS',
  QUALITY_STIMULUS_QUALITY_FAIL: 'STIMULUS',
  QUALITY_STIMULUS_QUALITY_REVIEW: 'STIMULUS',

  // Rubric
  RUBRIC_QUALITY: 'RUBRIC',
  QUALITY_RUBRIC_FAIL: 'RUBRIC',
  QUALITY_RUBRIC_REVIEW: 'RUBRIC',
  RUBRIC_CRITERIA_UNCLEAR: 'RUBRIC',
  RUBRIC_SCALE_INCONSISTENT: 'RUBRIC',

  // Scoring Guide
  SCORING_GUIDE_QUALITY: 'SCORING_GUIDE',
  SCORING_GUIDE_INCOMPLETE: 'SCORING_GUIDE',
  QUALITY_SCORING_GUIDE_FAIL: 'SCORING_GUIDE',
  QUALITY_SCORING_GUIDE_REVIEW: 'SCORING_GUIDE',

  // Answer Key / Proposed Answer
  ANSWER_KEY_UNCLEAR: 'PROPOSED_ANSWER',
  ANSWER_KEY_MISMATCH: 'PROPOSED_ANSWER',
  PROPOSED_ANSWER_QUALITY: 'PROPOSED_ANSWER',

  // Task
  TASK_QUALITY: 'TASK',
  TASK_INSTRUCTIONS_AMBIGUOUS: 'TASK',
  EMPTY_TASK_PROMPT: 'TASK',
  TASK_INSTRUCTIONS_UNCLEAR: 'TASK',
  QUALITY_TASK_FAIL: 'TASK',
  QUALITY_TASK_REVIEW: 'TASK',

  // Evidence Requirement
  EMPTY_EVIDENCE_REQUIREMENTS: 'EVIDENCE_REQUIREMENT',
  EVIDENCE_REQUIREMENTS_UNCLEAR: 'EVIDENCE_REQUIREMENT',
  QUALITY_EVIDENCE_FAIL: 'EVIDENCE_REQUIREMENT',
  QUALITY_EVIDENCE_REVIEW: 'EVIDENCE_REQUIREMENT',

  // Observation Content
  EMPTY_OBSERVATION_ASPECTS: 'OBSERVATION_CONTENT',
  OBSERVATION_ASPECTS_UNCLEAR: 'OBSERVATION_CONTENT',
  QUALITY_OBSERVATION_FAIL: 'OBSERVATION_CONTENT',
  QUALITY_OBSERVATION_REVIEW: 'OBSERVATION_CONTENT',

  // Indicator / Material Context
  INDICATOR_QUALITY: 'INDICATOR',
  INDICATOR_CLARITY: 'INDICATOR',
  INDICATOR_UNCLEAR: 'INDICATOR',
  MATERIAL_CONTEXT_QUALITY: 'MATERIAL_CONTEXT',

  // Coverage Unit
  COVERAGE_UNIT_QUALITY: 'COVERAGE_UNIT',
};

export class AssessmentRegenerationEligibilityService {
  /**
   * Deterministically maps a validation finding to an AssessmentRegenerationTarget if safe.
   * Returns null if ambiguous or ineligible.
   */
  public resolveTargetForFinding(
    finding: AssessmentValidationFinding
  ): AssessmentRegenerationTarget | null {
    // 1. Structural findings are strictly ineligible for AI regeneration
    if (this.isStructuralFinding(finding)) {
      return null;
    }

    const code = finding.code || '';
    const dimension = finding.dimension;

    // 2. Check explicit code map first
    if (code && ACTIONABLE_FINDING_CODE_MAP[code]) {
      return ACTIONABLE_FINDING_CODE_MAP[code];
    }

    // 3. Explicit entity findings via typed finding IDs
    if (finding.rubricId) {
      return 'RUBRIC';
    }
    if (finding.scoringGuideId) {
      return 'SCORING_GUIDE';
    }
    if (finding.answerKeyId) {
      return 'PROPOSED_ANSWER';
    }

    // 4. Check dimension mappings with strict rules
    if (dimension === 'DISTRACTOR_QUALITY') {
      return 'OPTIONS';
    }

    if (dimension === 'STIMULUS_QUALITY') {
      return 'STIMULUS';
    }

    if (dimension === 'ITEM_CONSTRUCTION') {
      return 'ITEM_PROMPT';
    }

    if (dimension === 'GRADE_LANGUAGE') {
      if (finding.targetField === 'ITEM_PROMPT') {
        return 'ITEM_PROMPT';
      }
      if (finding.targetField === 'STIMULUS') {
        return 'STIMULUS';
      }
      // Ambiguous targetField -> FAIL CLOSED! Never guess!
      return null;
    }

    // Ambiguous findings such as ANSWER_VERIFICATION = REJECTED must NOT guess the target
    if (dimension === 'ANSWER_VERIFICATION' || code.includes('ANSWER_VERIFICATION')) {
      return null;
    }

    // Fail closed for any unmapped or ambiguous finding
    return null;
  }

  /**
   * Checks if a validation finding is a structural constraint that must block regeneration.
   */
  public isStructuralFinding(finding: AssessmentValidationFinding): boolean {
    const code = finding.code || '';
    return EXPLICIT_STRUCTURAL_CODES.has(code);
  }

  /**
   * Verifies if the finding can be addressed via AI regeneration.
   */
  public isEligible(finding: AssessmentValidationFinding): boolean {
    if (this.isStructuralFinding(finding)) {
      return false;
    }
    return this.resolveTargetForFinding(finding) !== null;
  }

  /**
   * Resolves exact action, target, and exact targetId & locator for a finding.
   * Fails closed if exact identity is missing, ambiguous, or structural.
   */
  public resolveActionForFinding(finding: AssessmentValidationFinding): {
    eligible: boolean;
    target?: AssessmentRegenerationTarget;
    targetId?: string;
    locator?: AssessmentRegenerationLocator;
    label?: string;
    reason?: string;
  } {
    if (this.isStructuralFinding(finding)) {
      return { eligible: false, reason: 'STRUCTURAL_FINDING' };
    }

    const target = this.resolveTargetForFinding(finding);
    if (!target) {
      return { eligible: false, reason: 'INELIGIBLE_OR_AMBIGUOUS' };
    }

    let locator: AssessmentRegenerationLocator | undefined;
    let targetId: string | undefined;

    switch (target) {
      case 'INDICATOR':
      case 'MATERIAL_CONTEXT': {
        if (finding.blueprintItemId && typeof finding.blueprintItemId === 'string' && finding.blueprintItemId.trim() !== '') {
          locator = { kind: 'BLUEPRINT_ITEM', id: finding.blueprintItemId };
          targetId = finding.blueprintItemId;
        }
        break;
      }

      case 'ITEM_PROMPT':
      case 'OPTIONS':
      case 'STIMULUS': {
        if (finding.instrumentItemId && typeof finding.instrumentItemId === 'string' && finding.instrumentItemId.trim() !== '') {
          locator = { kind: 'INSTRUMENT_ITEM', id: finding.instrumentItemId };
          targetId = finding.instrumentItemId;
        }
        break;
      }

      case 'RUBRIC': {
        if (finding.rubricId && typeof finding.rubricId === 'string' && finding.rubricId.trim() !== '') {
          locator = { kind: 'RUBRIC', id: finding.rubricId };
          targetId = finding.rubricId;
        } else if (finding.instrumentItemId && typeof finding.instrumentItemId === 'string' && finding.instrumentItemId.trim() !== '') {
          locator = { kind: 'INSTRUMENT_ITEM', id: finding.instrumentItemId };
          targetId = finding.instrumentItemId;
        }
        break;
      }

      case 'SCORING_GUIDE': {
        if (finding.scoringGuideId && typeof finding.scoringGuideId === 'string' && finding.scoringGuideId.trim() !== '') {
          locator = { kind: 'SCORING_GUIDE', id: finding.scoringGuideId };
          targetId = finding.scoringGuideId;
        } else if (finding.instrumentItemId && typeof finding.instrumentItemId === 'string' && finding.instrumentItemId.trim() !== '') {
          locator = { kind: 'INSTRUMENT_ITEM', id: finding.instrumentItemId };
          targetId = finding.instrumentItemId;
        }
        break;
      }

      case 'PROPOSED_ANSWER': {
        if (finding.answerKeyId && typeof finding.answerKeyId === 'string' && finding.answerKeyId.trim() !== '') {
          locator = { kind: 'ANSWER_KEY', id: finding.answerKeyId };
          targetId = finding.answerKeyId;
        } else if (finding.instrumentItemId && typeof finding.instrumentItemId === 'string' && finding.instrumentItemId.trim() !== '') {
          locator = { kind: 'INSTRUMENT_ITEM', id: finding.instrumentItemId };
          targetId = finding.instrumentItemId;
        }
        break;
      }

      case 'TASK':
      case 'EVIDENCE_REQUIREMENT':
      case 'OBSERVATION_CONTENT': {
        if (finding.instrumentId && typeof finding.instrumentId === 'string' && finding.instrumentId.trim() !== '') {
          locator = { kind: 'INSTRUMENT', id: finding.instrumentId };
          targetId = finding.instrumentId;
        }
        break;
      }

      case 'COVERAGE_UNIT': {
        if (finding.coverageUnitId && typeof finding.coverageUnitId === 'string' && finding.coverageUnitId.trim() !== '') {
          locator = { kind: 'COVERAGE_UNIT', id: finding.coverageUnitId };
          targetId = finding.coverageUnitId;
        }
        break;
      }

      default:
        break;
    }

    if (!locator || !targetId) {
      return { eligible: false, reason: 'MISSING_EXACT_IDENTITY' };
    }

    const labelMap: Record<AssessmentRegenerationTarget, string> = {
      OPTIONS: 'Buat Ulang Pilihan Jawaban',
      ITEM_PROMPT: 'Buat Ulang Pertanyaan',
      STIMULUS: 'Buat Ulang Stimulus',
      RUBRIC: 'Buat Ulang Rubrik',
      TASK: 'Buat Ulang Tugas',
      EVIDENCE_REQUIREMENT: 'Buat Ulang Bukti yang Dikumpulkan',
      OBSERVATION_CONTENT: 'Buat Ulang Aspek Pengamatan',
      INDICATOR: 'Buat Ulang Indikator',
      MATERIAL_CONTEXT: 'Buat Ulang Materi/Konteks',
      PROPOSED_ANSWER: 'Buat Ulang Jawaban',
      SCORING_GUIDE: 'Buat Ulang Pedoman Penskoran',
      COVERAGE_UNIT: 'Buat Ulang Unit Cakupan',
    };

    return {
      eligible: true,
      target,
      targetId,
      locator,
      label: labelMap[target] || `Buat Ulang (${target})`,
    };
  }
}

export const assessmentRegenerationEligibilityService = new AssessmentRegenerationEligibilityService();
