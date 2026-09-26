import {
  AssessmentPackage,
  AssessmentRegenerationRequest,
  AssessmentRegenerationResult,
  AssessmentRegenerationContract,
  AssessmentRegenerationDraft,
  AssessmentRegenerationProvider,
  AssessmentRegenerationTarget,
} from '../types';
import { assessmentRegenerationDependencyService } from './assessmentRegenerationDependencyService';

const TARGET_ALLOWED_KEYS: Record<AssessmentRegenerationTarget, string[]> = {
  INDICATOR: ['assessmentIndicator'],
  MATERIAL_CONTEXT: ['materialOrContext'],
  ITEM_PROMPT: ['prompt'],
  STIMULUS: ['stimulus', 'stimulusOrigin', 'stimulusSource'],
  OPTIONS: ['options'],
  PROPOSED_ANSWER: ['value', 'optionIds', 'matchingPairs', 'categoryAnswers'],
  SCORING_GUIDE: ['title', 'guideType', 'instructions', 'maxScore'],
  RUBRIC: ['title', 'criteria', 'scale'],
  TASK: [
    'task',
    'instructions',
    'expectedOutput',
    'projectBrief',
    'expectedDeliverable',
    'productBrief',
    'expectedProduct',
  ],
  EVIDENCE_REQUIREMENT: ['evidenceRequirements'],
  OBSERVATION_CONTENT: ['aspects', 'recordingScheme'],
  COVERAGE_UNIT: ['assessmentIndicator', 'materialOrContext'],
};

const TASK_KEYS_BY_TYPE: Record<string, string[]> = {
  PERFORMANCE: ['task', 'instructions'],
  ASSIGNMENT: ['instructions', 'expectedOutput'],
  PROJECT: ['projectBrief', 'expectedDeliverable'],
  PRODUCT: ['productBrief', 'expectedProduct'],
};

export class AssessmentRegenerationService {
  /**
   * Performs the transactional granular regeneration.
   * If any step fails or is blocked, the source package is completely unmodified.
   */
  public async regenerate(
    pkg: AssessmentPackage,
    request: AssessmentRegenerationRequest,
    provider: AssessmentRegenerationProvider,
    extra?: {
      gradeCalibration?: any;
      subjectProfile?: any;
      validationFindings?: any[];
      getCurrentPackageRevision?: () => number | Promise<number>;
    }
  ): Promise<AssessmentRegenerationResult> {
    const pkgRevision = pkg.revision ?? 1;

    // 1. Concurrency Guard / Revision Check (pre-provider check)
    if (request.expectedPackageRevision !== pkgRevision) {
      return {
        status: 'STALE_REGENERATION_REQUEST',
        issues: [
          `Request expected revision ${request.expectedPackageRevision} but package is at revision ${pkgRevision}.`,
        ],
      };
    }

    // 1.1 Invariant: Target ID and Locator ID must match when locator is provided
    if (request.locator && request.locator.id !== request.targetId) {
      return {
        status: 'FAILED',
        issues: [
          `Target ID '${request.targetId}' and locator ID '${request.locator.id}' mismatch. Exact unique resolution required (TARGET_LOCATOR_ID_MISMATCH).`,
        ],
      };
    }

    // 2. Locate Target and Verify Existence
    const targetLocator = this.locateTarget(pkg, request.target, request.targetId, request.locator);
    if (!targetLocator.found) {
      const issue =
        targetLocator.error === 'AMBIGUOUS_TARGET'
          ? `Target '${request.target}' with ID '${request.targetId}' is ambiguous (${targetLocator.matchCount} matches found). Exact unique resolution required.`
          : targetLocator.error === 'INVALID_LOCATOR_KIND'
          ? `Invalid locator kind for target '${request.target}' (INVALID_LOCATOR_KIND).`
          : `Target '${request.target}' with ID '${request.targetId}' not found in the assessment package.`;
      return {
        status: 'FAILED',
        issues: [issue],
      };
    }

    const {
      coverageUnitId,
      objectiveRefId,
      criterionId,
      instrumentType,
      allocationUnit,
      cognitiveDemand,
      preservedContent,
      editableContent,
    } = targetLocator;

    // 3. Teacher Edit Protection
    const isTeacherEdited = this.checkTeacherEdited(request.target, targetLocator.targetElement);
    if (isTeacherEdited && request.explicitTeacherOverride !== true) {
      return {
        status: 'TEACHER_EDIT_PROTECTED',
        issues: [
          `Target field of '${request.target}' with ID '${request.targetId}' has been edited by a teacher. Explicit override required.`,
        ],
      };
    }

    // 4. Build Scoped Contract
    const contract: AssessmentRegenerationContract = {
      packageId: pkg.id,
      packageRevision: pkgRevision,
      target: request.target,
      targetId: request.targetId,
      locator: request.locator,
      immutableContext: {
        coverageUnitId,
        objectiveRefId,
        criterionId,
        instrumentType,
        allocationUnit,
        cognitiveDemand,
      },
      preservedContent,
      editableContent,
      gradeCalibration: extra?.gradeCalibration,
      subjectProfile: extra?.subjectProfile,
      validationFindings: extra?.validationFindings?.filter((f) => {
        if (request.locator) {
          switch (request.locator.kind) {
            case 'BLUEPRINT_ITEM':
              return f.blueprintItemId === request.locator.id;
            case 'COVERAGE_UNIT':
              return f.coverageUnitId === request.locator.id;
            case 'INSTRUMENT':
              return f.instrumentId === request.locator.id;
            case 'INSTRUMENT_ITEM':
              return f.instrumentItemId === request.locator.id;
            case 'ANSWER_KEY':
              return f.answerKeyId === request.locator.id;
            case 'SCORING_GUIDE':
              return f.scoringGuideId === request.locator.id;
            case 'RUBRIC':
              return f.rubricId === request.locator.id;
            default:
              return false;
          }
        }
        return (
          f.blueprintItemId === request.targetId ||
          f.instrumentItemId === request.targetId ||
          f.instrumentId === request.targetId ||
          f.coverageUnitId === request.targetId ||
          f.answerKeyId === request.targetId ||
          f.scoringGuideId === request.targetId ||
          f.rubricId === request.targetId
        );
      }),
    };

    // 5. Call Provider and Wrap in Try-Catch for Atomicity
    let providerOutput: any;
    try {
      providerOutput = await provider.regenerate(contract);
    } catch (e: any) {
      return {
        status: 'FAILED',
        issues: [`AI Provider threw an exception during regeneration: ${e.message || e}`],
      };
    }

    // 5.5 Apply-Time Revision Guard (Blocker 1)
    if (extra?.getCurrentPackageRevision) {
      const currentRev = await extra.getCurrentPackageRevision();
      if (currentRev !== pkgRevision) {
        return {
          status: 'STALE_REGENERATION_REQUEST',
          issues: [
            `Request started at revision ${pkgRevision} but authoritative revision became ${currentRev} during provider run.`,
          ],
        };
      }
    }

    // 6. Runtime Validation of Untrusted Provider Output (Blocker 2 & 3)
    const validation = this.validateProviderOutput(
      request.target,
      request.targetId,
      providerOutput,
      contract
    );
    if (!validation.valid) {
      return {
        status: 'FAILED',
        issues: [`Validation of AI provider output failed: ${validation.reason}`],
      };
    }

    const draft = validation.draft!;

    // 7. Safe Allowlist Merge & Immutable Canonical Field Protection
    const clonedPkg: AssessmentPackage = JSON.parse(JSON.stringify(pkg));
    const applyResult = this.applyDraftChanges(clonedPkg, draft);
    if (!applyResult.success) {
      return {
        status: 'FAILED',
        issues: [`Applying draft changes failed: ${applyResult.reason}`],
      };
    }

    // 8. Dependency Invalidation Engine (Blocker 5)
    const invalidatedPkg = assessmentRegenerationDependencyService.invalidateDependencies(
      clonedPkg,
      request.target,
      request.targetId
    );

    // 9. Increment Revision & Enforce Workflow Draft / Needs Review State
    invalidatedPkg.revision = pkgRevision + 1;
    invalidatedPkg.workflowStatus = 'DRAFT';
    invalidatedPkg.needsReview = true;
    invalidatedPkg.updatedAt = new Date().toISOString();

    // Preserve metadata about this regeneration in a lightweight audit trail
    if (request.validationFindingIds && request.validationFindingIds.length > 0) {
      (invalidatedPkg as any).regenerationProvenance = {
        target: request.target,
        targetId: request.targetId,
        fromRevision: pkgRevision,
        toRevision: invalidatedPkg.revision,
        validationFindingIds: request.validationFindingIds,
        createdAt: invalidatedPkg.updatedAt,
      };
    }

    return {
      status: 'REGENERATED',
      regeneratedPackage: invalidatedPkg,
      draft,
    };
  }

  /**
   * Helper to inspect provenance of a target element to see if it was modified by a teacher (Blocker 6).
   */
  private checkTeacherEdited(target: AssessmentRegenerationTarget, element: any): boolean {
    if (!element) return false;

    // Check direct provenance string
    if (element.provenance === 'TEACHER_EDITED') return true;

    // Resolve fields related to this target
    const targetFieldsMap: Record<AssessmentRegenerationTarget, string[]> = {
      INDICATOR: ['assessmentIndicator'],
      MATERIAL_CONTEXT: ['materialOrContext'],
      ITEM_PROMPT: ['prompt'],
      STIMULUS: ['stimulus'],
      OPTIONS: ['options'],
      PROPOSED_ANSWER: ['value', 'answer'],
      SCORING_GUIDE: ['instructions', 'maxScore', 'title'],
      RUBRIC: ['criteria', 'scale', 'title'],
      TASK: [
        'task',
        'instructions',
        'expectedOutput',
        'projectBrief',
        'expectedDeliverable',
        'productBrief',
        'expectedProduct',
      ],
      EVIDENCE_REQUIREMENT: ['evidenceRequirements'],
      OBSERVATION_CONTENT: ['aspects', 'recordingScheme'],
      COVERAGE_UNIT: ['assessmentIndicator', 'materialOrContext'],
    };

    const fields = targetFieldsMap[target] || [];

    // Check if the provenance specifically marks any target fields as TEACHER_EDITED
    if (element.provenance && typeof element.provenance === 'object') {
      const p = element.provenance;
      const f = p.fields || p;
      for (const field of fields) {
        if (f[field] === 'TEACHER_EDITED') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Helper to merge and preserve field-level provenance without destroying others (Blocker 6)
   */
  private updateFieldProvenance(
    existingProvenance: any,
    fieldName: string,
    status: 'AI_REGENERATED' | 'TEACHER_EDITED'
  ): any {
    let prov: any = {};
    if (existingProvenance) {
      if (typeof existingProvenance === 'string') {
        prov = { originalOwner: existingProvenance, fields: {} };
      } else if (typeof existingProvenance === 'object') {
        prov = JSON.parse(JSON.stringify(existingProvenance));
      }
    }
    prov.fields = prov.fields || {};
    prov.fields[fieldName] = status;
    return prov;
  }

  /**
   * Locates the target element and its context in the package.
   * Enforces exact unique resolution: 0 matches -> TARGET_NOT_FOUND, 1 match -> valid, >1 matches -> AMBIGUOUS_TARGET.
   */
  private locateTarget(
    pkg: AssessmentPackage,
    target: AssessmentRegenerationTarget,
    targetId: string,
    locator?: import('../types').AssessmentRegenerationLocator
  ): {
    found: boolean;
    error?: 'TARGET_NOT_FOUND' | 'AMBIGUOUS_TARGET' | 'INVALID_LOCATOR_KIND';
    matchCount?: number;
    targetElement?: any;
    coverageUnitId?: string;
    objectiveRefId?: string;
    criterionId?: string;
    instrumentType?: string;
    allocationUnit?: string;
    cognitiveDemand?: string;
    preservedContent?: any;
    editableContent?: any;
  } {
    switch (target) {
      case 'INDICATOR':
      case 'MATERIAL_CONTEXT': {
        if (locator && locator.kind !== 'BLUEPRINT_ITEM') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        const candidates = (pkg.blueprintItems || []).filter((b) => b.id === targetId);
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const bp = candidates[0];
        return {
          found: true,
          targetElement: bp,
          coverageUnitId: bp.coverageUnitId,
          objectiveRefId: bp.objectiveRefId,
          criterionId: bp.criterionId,
          instrumentType: bp.instrumentType,
          cognitiveDemand: bp.cognitiveDemand,
          preservedContent: {
            id: bp.id,
            coverageUnitId: bp.coverageUnitId,
            objectiveRefId: bp.objectiveRefId,
          },
          editableContent:
            target === 'INDICATOR' ? bp.assessmentIndicator : bp.materialOrContext,
        };
      }

      case 'ITEM_PROMPT':
      case 'STIMULUS':
      case 'OPTIONS': {
        if (locator && locator.kind !== 'INSTRUMENT_ITEM') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        const matchingItems: { item: any; inst: any }[] = [];
        for (const inst of pkg.instruments || []) {
          if ('items' in inst && Array.isArray(inst.items)) {
            for (const item of inst.items) {
              if (item.id === targetId) {
                matchingItems.push({ item, inst });
              }
            }
          }
        }
        if (matchingItems.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (matchingItems.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: matchingItems.length };
        const { item, inst } = matchingItems[0];
        const matchingBps = (pkg.blueprintItems || []).filter(
          (b) => b.instrumentItemIds && b.instrumentItemIds.includes(targetId)
        );
        const bp = matchingBps.length === 1 ? matchingBps[0] : undefined;
        return {
          found: true,
          targetElement: item,
          coverageUnitId: item.coverageUnitId || bp?.coverageUnitId,
          objectiveRefId: bp?.objectiveRefId,
          criterionId: bp?.criterionId,
          instrumentType: inst.type,
          allocationUnit: 'ITEM',
          preservedContent: { id: item.id, itemType: item.itemType },
          editableContent:
            target === 'ITEM_PROMPT'
              ? item.prompt
              : target === 'STIMULUS'
              ? item.stimulus
              : item.options,
        };
      }

      case 'PROPOSED_ANSWER': {
        if (locator && locator.kind !== 'ANSWER_KEY' && locator.kind !== 'INSTRUMENT_ITEM') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        let candidates: any[] = [];
        if (locator?.kind === 'ANSWER_KEY') {
          candidates = (pkg.answerKeys || []).filter((a) => a.id === locator.id);
        } else if (locator?.kind === 'INSTRUMENT_ITEM') {
          candidates = (pkg.answerKeys || []).filter((a) => a.instrumentItemId === locator.id);
        } else {
          // Legacy request without locator - fail closed if ambiguous across namespaces or multiple items
          const byEntityId = (pkg.answerKeys || []).filter((a) => a.id === targetId);
          const byItemId = (pkg.answerKeys || []).filter((a) => a.instrumentItemId === targetId);
          candidates = Array.from(new Set([...byEntityId, ...byItemId]));
        }
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const ak = candidates[0];
        const inst = pkg.instruments.find((i) => i.id === ak.instrumentId);
        return {
          found: true,
          targetElement: ak,
          instrumentType: inst?.type,
          preservedContent: {
            id: ak.id,
            instrumentId: ak.instrumentId,
            instrumentItemId: ak.instrumentItemId,
            answerType: ak.answerType,
          },
          editableContent: {
            value: ak.value,
            optionIds: ak.optionIds,
            matchingPairs: ak.matchingPairs,
            categoryAnswers: ak.categoryAnswers,
          },
        };
      }

      case 'SCORING_GUIDE': {
        if (locator && locator.kind !== 'SCORING_GUIDE' && locator.kind !== 'INSTRUMENT_ITEM') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        let candidates: any[] = [];
        if (locator?.kind === 'SCORING_GUIDE') {
          candidates = (pkg.scoringGuides || []).filter((s) => s.id === locator.id);
        } else if (locator?.kind === 'INSTRUMENT_ITEM') {
          candidates = (pkg.scoringGuides || []).filter((s) => s.instrumentItemId === locator.id);
        } else {
          // Legacy request without locator
          const byEntityId = (pkg.scoringGuides || []).filter((s) => s.id === targetId);
          const byItemId = (pkg.scoringGuides || []).filter((s) => s.instrumentItemId === targetId);
          candidates = Array.from(new Set([...byEntityId, ...byItemId]));
        }
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const sg = candidates[0];
        return {
          found: true,
          targetElement: sg,
          preservedContent: {
            id: sg.id,
            instrumentId: sg.instrumentId,
            instrumentItemId: sg.instrumentItemId,
          },
          editableContent: {
            title: sg.title,
            guideType: sg.guideType,
            instructions: sg.instructions,
            maxScore: sg.maxScore,
          },
        };
      }

      case 'RUBRIC': {
        if (locator && locator.kind !== 'RUBRIC' && locator.kind !== 'INSTRUMENT_ITEM') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        let candidates: any[] = [];
        if (locator?.kind === 'RUBRIC') {
          candidates = (pkg.rubrics || []).filter((r) => r.id === locator.id);
        } else if (locator?.kind === 'INSTRUMENT_ITEM') {
          candidates = (pkg.rubrics || []).filter((r) => r.instrumentItemId === locator.id);
        } else {
          // Legacy request without locator
          const byEntityId = (pkg.rubrics || []).filter((r) => r.id === targetId);
          const byItemId = (pkg.rubrics || []).filter((r) => r.instrumentItemId === targetId);
          candidates = Array.from(new Set([...byEntityId, ...byItemId]));
        }
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const rb = candidates[0];
        return {
          found: true,
          targetElement: rb,
          preservedContent: {
            id: rb.id,
            instrumentId: rb.instrumentId,
            instrumentItemId: rb.instrumentItemId,
          },
          editableContent: { title: rb.title, criteria: rb.criteria, scale: rb.scale },
        };
      }

      case 'TASK': {
        if (locator && locator.kind !== 'INSTRUMENT') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        const candidates = (pkg.instruments || []).filter(
          (i) =>
            i.id === targetId &&
            ['PERFORMANCE', 'ASSIGNMENT', 'PROJECT', 'PRODUCT'].includes(i.type)
        );
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const inst = candidates[0];
        return {
          found: true,
          targetElement: inst,
          instrumentType: inst.type,
          allocationUnit: 'TASK',
          preservedContent: { id: inst.id, type: inst.type },
          editableContent: inst,
        };
      }

      case 'EVIDENCE_REQUIREMENT': {
        if (locator && locator.kind !== 'INSTRUMENT') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        const candidates = (pkg.instruments || []).filter(
          (i) => i.id === targetId && i.type === 'PORTFOLIO'
        );
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const inst = candidates[0];
        return {
          found: true,
          targetElement: inst,
          instrumentType: 'PORTFOLIO',
          allocationUnit: 'EVIDENCE',
          preservedContent: { id: inst.id, type: 'PORTFOLIO' },
          editableContent: (inst as any).evidenceRequirements,
        };
      }

      case 'OBSERVATION_CONTENT': {
        if (locator && locator.kind !== 'INSTRUMENT') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        const candidates = (pkg.instruments || []).filter(
          (i) => i.id === targetId && i.type === 'OBSERVATION'
        );
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const inst = candidates[0];
        return {
          found: true,
          targetElement: inst,
          instrumentType: 'OBSERVATION',
          allocationUnit: 'OBSERVATION',
          preservedContent: { id: inst.id, type: 'OBSERVATION' },
          editableContent: inst,
        };
      }

      case 'COVERAGE_UNIT': {
        if (locator && locator.kind !== 'COVERAGE_UNIT') {
          return { found: false, error: 'INVALID_LOCATOR_KIND' };
        }
        const candidates = (pkg.blueprintItems || []).filter((b) => b.coverageUnitId === targetId);
        if (candidates.length === 0) return { found: false, error: 'TARGET_NOT_FOUND', matchCount: 0 };
        if (candidates.length > 1) return { found: false, error: 'AMBIGUOUS_TARGET', matchCount: candidates.length };
        const bp = candidates[0];
        return {
          found: true,
          targetElement: bp,
          coverageUnitId: bp.coverageUnitId,
          objectiveRefId: bp.objectiveRefId,
          criterionId: bp.criterionId,
          instrumentType: bp.instrumentType,
          preservedContent: {
            coverageUnitId: bp.coverageUnitId,
            objectiveRefId: bp.objectiveRefId,
            criterionId: bp.criterionId,
          },
          editableContent: bp,
        };
      }

      default:
        return { found: false, error: 'TARGET_NOT_FOUND' };
    }
  }

  /**
   * Validates untrusted AI provider output.
   */
  private validateProviderOutput(
    target: AssessmentRegenerationTarget,
    targetId: string,
    output: any,
    contract: AssessmentRegenerationContract
  ): { valid: boolean; reason?: string; draft?: AssessmentRegenerationDraft } {
    if (!output || typeof output !== 'object') {
      return { valid: false, reason: 'AI Output must be a non-null object' };
    }

    // Whole package replacement is strictly rejected
    if (
      output.package ||
      output.assessmentPackage ||
      ('blueprintItems' in output && 'instruments' in output)
    ) {
      return { valid: false, reason: 'AI proposed a whole-package replacement, which is forbidden' };
    }

    if (output.target !== target) {
      return {
        valid: false,
        reason: `AI returned target '${output.target}' instead of requested target '${target}'`,
      };
    }

    if (output.targetId !== targetId) {
      return {
        valid: false,
        reason: `AI returned targetId '${output.targetId}' instead of requested targetId '${targetId}'`,
      };
    }

    if (contract.locator && output.locator) {
      if (
        output.locator.kind !== contract.locator.kind ||
        output.locator.id !== contract.locator.id
      ) {
        return {
          valid: false,
          reason: `AI output changed locator identity from ${contract.locator.kind}:${contract.locator.id} to ${output.locator.kind}:${output.locator.id}`,
        };
      }
    }

    const proposed = output.proposedChanges;
    if (!proposed || typeof proposed !== 'object') {
      return { valid: false, reason: 'AI output must specify a valid proposedChanges object' };
    }

    // Strict Target Allowlist Check & Immutable Field Presence Check (Blocker 2)
    const canonicalFields = [
      'coverageUnitId',
      'objectiveRefId',
      'criterionId',
      'instrumentType',
      'allocationUnit',
    ];
    for (const f of canonicalFields) {
      if (f in proposed) {
        return { valid: false, reason: `AI proposedChanges contains forbidden canonical field: ${f}` };
      }
    }

    const allowedKeys = TARGET_ALLOWED_KEYS[target];
    if (!allowedKeys) {
      return { valid: false, reason: `No allowed keys registry defined for target target: ${target}` };
    }

    const proposedKeys = Object.keys(proposed);
    if (proposedKeys.length === 0) {
      return { valid: false, reason: 'proposedChanges cannot be an empty object' };
    }

    for (const key of proposedKeys) {
      if (!allowedKeys.includes(key)) {
        return {
          valid: false,
          reason: `Unexpected field '${key}' is not allowed for target type ${target}`,
        };
      }
    }

    // Complete Target-Specific Runtime Schema Validation (Blocker 3)
    switch (target) {
      case 'INDICATOR': {
        if (
          typeof proposed.assessmentIndicator !== 'string' ||
          proposed.assessmentIndicator.trim() === ''
        ) {
          return {
            valid: false,
            reason: "INDICATOR target requires non-empty string 'assessmentIndicator'",
          };
        }
        break;
      }

      case 'MATERIAL_CONTEXT': {
        if (
          typeof proposed.materialOrContext !== 'string' ||
          proposed.materialOrContext.trim() === ''
        ) {
          return {
            valid: false,
            reason: "MATERIAL_CONTEXT target requires non-empty string 'materialOrContext'",
          };
        }
        break;
      }

      case 'ITEM_PROMPT': {
        if (typeof proposed.prompt !== 'string' || proposed.prompt.trim() === '') {
          return { valid: false, reason: "ITEM_PROMPT target requires non-empty string 'prompt'" };
        }
        break;
      }

      case 'STIMULUS': {
        if (typeof proposed.stimulus !== 'string' || proposed.stimulus.trim() === '') {
          return { valid: false, reason: "STIMULUS target requires non-empty string 'stimulus'" };
        }
        break;
      }

      case 'OPTIONS': {
        if (!Array.isArray(proposed.options) || proposed.options.length < 2) {
          return { valid: false, reason: 'OPTIONS target requires options array with at least 2 choices' };
        }
        for (const opt of proposed.options) {
          if (!opt.id || typeof opt.text !== 'string' || opt.text.trim() === '') {
            return {
              valid: false,
              reason: 'Each option in OPTIONS must contain a valid id and non-empty string text',
            };
          }
        }
        break;
      }

      case 'PROPOSED_ANSWER': {
        const hasKey =
          'value' in proposed ||
          'optionIds' in proposed ||
          'matchingPairs' in proposed ||
          'categoryAnswers' in proposed;
        if (!hasKey) {
          return {
            valid: false,
            reason: 'PROPOSED_ANSWER must specify value, optionIds, matchingPairs, or categoryAnswers',
          };
        }
        if ('value' in proposed && (typeof proposed.value !== 'string' || proposed.value.trim() === '')) {
          return { valid: false, reason: 'PROPOSED_ANSWER value must be a non-empty string' };
        }
        if ('optionIds' in proposed) {
          if (!Array.isArray(proposed.optionIds) || proposed.optionIds.length === 0) {
            return { valid: false, reason: 'PROPOSED_ANSWER optionIds must be a non-empty array' };
          }
          if (proposed.optionIds.some((id: any) => typeof id !== 'string' || id.trim() === '')) {
            return { valid: false, reason: 'PROPOSED_ANSWER optionIds must be an array of non-empty strings' };
          }
        }
        if ('matchingPairs' in proposed) {
          if (!Array.isArray(proposed.matchingPairs) || proposed.matchingPairs.length === 0) {
            return { valid: false, reason: 'PROPOSED_ANSWER matchingPairs must be a non-empty array' };
          }
          for (const pair of proposed.matchingPairs) {
            if (
              !pair.premiseId ||
              typeof pair.premiseId !== 'string' ||
              pair.premiseId.trim() === '' ||
              !pair.responseId ||
              typeof pair.responseId !== 'string' ||
              pair.responseId.trim() === ''
            ) {
              return { valid: false, reason: 'Each pair in matchingPairs must have a premiseId and responseId' };
            }
          }
        }
        if ('categoryAnswers' in proposed) {
          if (!Array.isArray(proposed.categoryAnswers) || proposed.categoryAnswers.length === 0) {
            return { valid: false, reason: 'PROPOSED_ANSWER categoryAnswers must be a non-empty array' };
          }
          for (const ans of proposed.categoryAnswers) {
            if (
              !ans.statementId ||
              typeof ans.statementId !== 'string' ||
              ans.statementId.trim() === '' ||
              !ans.categoryId ||
              typeof ans.categoryId !== 'string' ||
              ans.categoryId.trim() === ''
            ) {
              return { valid: false, reason: 'Each categoryAnswer must have a statementId and categoryId' };
            }
          }
        }
        break;
      }

      case 'SCORING_GUIDE': {
        const hasField =
          'instructions' in proposed ||
          'title' in proposed ||
          'guideType' in proposed ||
          'maxScore' in proposed;
        if (!hasField) {
          return { valid: false, reason: 'SCORING_GUIDE must contain at least one valid editable field' };
        }
        if ('guideType' in proposed) {
          const validTypes = ['OBJECTIVE', 'MANUAL', 'ESSAY', 'RUBRIC_BASED'];
          if (!validTypes.includes(proposed.guideType)) {
            return { valid: false, reason: `Invalid guideType: ${proposed.guideType}` };
          }
        }
        if ('maxScore' in proposed && (typeof proposed.maxScore !== 'number' || proposed.maxScore < 0)) {
          return { valid: false, reason: 'SCORING_GUIDE maxScore must be a positive number' };
        }
        if ('instructions' in proposed && typeof proposed.instructions !== 'string') {
          return { valid: false, reason: 'SCORING_GUIDE instructions must be a string' };
        }
        break;
      }

      case 'RUBRIC': {
        const hasField = 'criteria' in proposed || 'scale' in proposed || 'title' in proposed;
        if (!hasField) {
          return { valid: false, reason: 'RUBRIC target requires at least one editable field (criteria, scale, title)' };
        }

        if ('criteria' in proposed) {
          if (!Array.isArray(proposed.criteria) || proposed.criteria.length === 0) {
            return { valid: false, reason: 'RUBRIC target requires a non-empty criteria array' };
          }
          const critIds = new Set<string>();
          for (const crit of proposed.criteria) {
            if (!crit.id || typeof crit.id !== 'string' || crit.id.trim() === '') {
              return { valid: false, reason: 'Rubric criteria must contain a valid non-empty id' };
            }
            if (!crit.label || typeof crit.label !== 'string' || crit.label.trim() === '') {
              return { valid: false, reason: 'Rubric criteria must contain a valid non-empty label' };
            }
            if (critIds.has(crit.id)) {
              return { valid: false, reason: `Duplicate rubric criteria id found: ${crit.id}` };
            }
            critIds.add(crit.id);
          }
        }

        if ('scale' in proposed) {
          if (!Array.isArray(proposed.scale) || proposed.scale.length === 0) {
            return { valid: false, reason: 'RUBRIC target requires a non-empty scale array' };
          }
          const scaleIds = new Set<string>();
          for (const sc of proposed.scale) {
            if (!sc.id || typeof sc.id !== 'string' || sc.id.trim() === '') {
              return { valid: false, reason: 'Rubric scale level must contain a valid non-empty id' };
            }
            if (!sc.label || typeof sc.label !== 'string' || sc.label.trim() === '') {
              return { valid: false, reason: 'Rubric scale level must contain a valid non-empty label' };
            }
            if (typeof sc.order !== 'number') {
              return { valid: false, reason: 'Rubric scale level order must be a valid number' };
            }
            if (sc.score !== undefined && typeof sc.score !== 'number') {
              return { valid: false, reason: 'Rubric scale level score must be a number' };
            }
            if (scaleIds.has(sc.id)) {
              return { valid: false, reason: `Duplicate rubric scale level id found: ${sc.id}` };
            }
            scaleIds.add(sc.id);
          }
        }
        break;
      }

      case 'TASK': {
        const type = contract.immutableContext.instrumentType;
        if (!type || !['PERFORMANCE', 'ASSIGNMENT', 'PROJECT', 'PRODUCT'].includes(type)) {
          return {
            valid: false,
            reason: `TASK regeneration is not supported for instrument type: ${type}`,
          };
        }

        // Check cross-type field pollution
        const allowedFields = TASK_KEYS_BY_TYPE[type];
        for (const key of proposedKeys) {
          if (!allowedFields.includes(key)) {
            return {
              valid: false,
              reason: `Field '${key}' is invalid for instrument type '${type}' task regeneration`,
            };
          }
        }

        // Type-specific field contents validations
        if (type === 'PERFORMANCE') {
          if (typeof proposed.task !== 'string' || proposed.task.trim() === '') {
            return { valid: false, reason: 'PERFORMANCE task must be a non-empty string' };
          }
        } else if (type === 'ASSIGNMENT') {
          if (typeof proposed.instructions !== 'string' || proposed.instructions.trim() === '') {
            return { valid: false, reason: 'ASSIGNMENT instructions must be a non-empty string' };
          }
        } else if (type === 'PROJECT') {
          if (typeof proposed.projectBrief !== 'string' || proposed.projectBrief.trim() === '') {
            return { valid: false, reason: 'PROJECT projectBrief must be a non-empty string' };
          }
        } else if (type === 'PRODUCT') {
          if (typeof proposed.productBrief !== 'string' || proposed.productBrief.trim() === '') {
            return { valid: false, reason: 'PRODUCT productBrief must be a non-empty string' };
          }
        }
        break;
      }

      case 'EVIDENCE_REQUIREMENT': {
        if (!Array.isArray(proposed.evidenceRequirements) || proposed.evidenceRequirements.length === 0) {
          return {
            valid: false,
            reason: 'EVIDENCE_REQUIREMENT target requires a non-empty evidenceRequirements array',
          };
        }
        for (const req of proposed.evidenceRequirements) {
          if (typeof req !== 'string' || req.trim() === '') {
            return {
              valid: false,
              reason: 'evidenceRequirements must contain only non-empty strings',
            };
          }
        }
        break;
      }

      case 'OBSERVATION_CONTENT': {
        if (!Array.isArray(proposed.aspects) || proposed.aspects.length === 0) {
          return {
            valid: false,
            reason: 'OBSERVATION_CONTENT target requires a non-empty aspects array',
          };
        }
        const aspectIds = new Set<string>();
        for (const asp of proposed.aspects) {
          if (!asp.id || typeof asp.id !== 'string' || asp.id.trim() === '') {
            return { valid: false, reason: 'Observation aspect must contain a non-empty id' };
          }
          if (!asp.label || typeof asp.label !== 'string' || asp.label.trim() === '') {
            return { valid: false, reason: 'Observation aspect must contain a non-empty label' };
          }
          if (aspectIds.has(asp.id)) {
            return { valid: false, reason: `Duplicate aspect id found: ${asp.id}` };
          }
          aspectIds.add(asp.id);
        }
        if ('recordingScheme' in proposed && typeof proposed.recordingScheme !== 'string') {
          return { valid: false, reason: 'Observation recordingScheme must be a string' };
        }
        break;
      }

      case 'COVERAGE_UNIT': {
        const hasField = 'assessmentIndicator' in proposed || 'materialOrContext' in proposed;
        if (!hasField) {
          return {
            valid: false,
            reason: 'COVERAGE_UNIT must provide assessmentIndicator or materialOrContext',
          };
        }
        if (
          'assessmentIndicator' in proposed &&
          (typeof proposed.assessmentIndicator !== 'string' || proposed.assessmentIndicator.trim() === '')
        ) {
          return { valid: false, reason: 'COVERAGE_UNIT assessmentIndicator must be a non-empty string' };
        }
        if (
          'materialOrContext' in proposed &&
          (typeof proposed.materialOrContext !== 'string' || proposed.materialOrContext.trim() === '')
        ) {
          return { valid: false, reason: 'COVERAGE_UNIT materialOrContext must be a non-empty string' };
        }
        break;
      }

      default:
        return { valid: false, reason: `Unsupported target validation: ${target}` };
    }

    return {
      valid: true,
      draft: {
        target,
        targetId,
        locator: contract.locator,
        proposedChanges: proposed,
      },
    };
  }

  /**
   * Applies the validated draft changes to the cloned package.
   * Enforces exact unique match (0 match -> fail, >1 match -> ambiguous/fail).
   */
  private applyDraftChanges(
    pkg: AssessmentPackage,
    draft: AssessmentRegenerationDraft
  ): { success: boolean; reason?: string } {
    const proposed = draft.proposedChanges;
    const locator = draft.locator;
    const targetId = draft.targetId;

    switch (draft.target) {
      case 'INDICATOR':
      case 'MATERIAL_CONTEXT': {
        const candidates = (pkg.blueprintItems || []).filter((b) => b.id === targetId);
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Blueprint item not found' : 'Ambiguous blueprint item',
          };
        }
        const bp: any = candidates[0];
        if (draft.target === 'INDICATOR') {
          bp.assessmentIndicator = proposed.assessmentIndicator;
          bp.provenance = this.updateFieldProvenance(
            bp.provenance,
            'assessmentIndicator',
            'AI_REGENERATED'
          );
        } else {
          bp.materialOrContext = proposed.materialOrContext;
          bp.provenance = this.updateFieldProvenance(
            bp.provenance,
            'materialOrContext',
            'AI_REGENERATED'
          );
        }
        return { success: true };
      }

      case 'ITEM_PROMPT':
      case 'STIMULUS':
      case 'OPTIONS': {
        const matches: { item: any; inst: any }[] = [];
        for (const inst of pkg.instruments || []) {
          if ('items' in inst && Array.isArray(inst.items)) {
            for (const item of inst.items) {
              if (item.id === targetId) {
                matches.push({ item, inst });
              }
            }
          }
        }
        if (matches.length !== 1) {
          return {
            success: false,
            reason: matches.length === 0 ? 'Instrument item not found' : 'Ambiguous instrument item',
          };
        }
        const { item } = matches[0];
        if (draft.target === 'ITEM_PROMPT') {
          item.prompt = proposed.prompt;
          item.provenance = this.updateFieldProvenance(item.provenance, 'prompt', 'AI_REGENERATED');
        } else if (draft.target === 'STIMULUS') {
          item.stimulus = proposed.stimulus;
          if (proposed.stimulusOrigin) item.stimulusOrigin = proposed.stimulusOrigin;
          if (proposed.stimulusSource) item.stimulusSource = proposed.stimulusSource;
          item.provenance = this.updateFieldProvenance(
            item.provenance,
            'stimulus',
            'AI_REGENERATED'
          );
        } else if (draft.target === 'OPTIONS') {
          item.options = proposed.options;
          item.provenance = this.updateFieldProvenance(
            item.provenance,
            'options',
            'AI_REGENERATED'
          );
        }
        return { success: true };
      }

      case 'PROPOSED_ANSWER': {
        if (locator && locator.kind !== 'ANSWER_KEY' && locator.kind !== 'INSTRUMENT_ITEM') {
          return { success: false, reason: 'Invalid locator kind for PROPOSED_ANSWER' };
        }
        let candidates: any[] = [];
        if (locator?.kind === 'ANSWER_KEY') {
          candidates = (pkg.answerKeys || []).filter((a) => a.id === locator.id);
        } else if (locator?.kind === 'INSTRUMENT_ITEM') {
          candidates = (pkg.answerKeys || []).filter((a) => a.instrumentItemId === locator.id);
        } else {
          const byEntityId = (pkg.answerKeys || []).filter((a) => a.id === targetId);
          const byItemId = (pkg.answerKeys || []).filter((a) => a.instrumentItemId === targetId);
          candidates = Array.from(new Set([...byEntityId, ...byItemId]));
        }
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Answer key not found' : 'Ambiguous answer key',
          };
        }
        const ak: any = candidates[0];
        if ('value' in proposed) ak.value = proposed.value;
        if ('optionIds' in proposed) ak.optionIds = proposed.optionIds;
        if ('matchingPairs' in proposed) ak.matchingPairs = proposed.matchingPairs;
        if ('categoryAnswers' in proposed) ak.categoryAnswers = proposed.categoryAnswers;
        ak.provenance = this.updateFieldProvenance(ak.provenance, 'answer', 'AI_REGENERATED');
        return { success: true };
      }

      case 'SCORING_GUIDE': {
        if (locator && locator.kind !== 'SCORING_GUIDE' && locator.kind !== 'INSTRUMENT_ITEM') {
          return { success: false, reason: 'Invalid locator kind for SCORING_GUIDE' };
        }
        let candidates: any[] = [];
        if (locator?.kind === 'SCORING_GUIDE') {
          candidates = (pkg.scoringGuides || []).filter((s) => s.id === locator.id);
        } else if (locator?.kind === 'INSTRUMENT_ITEM') {
          candidates = (pkg.scoringGuides || []).filter((s) => s.instrumentItemId === locator.id);
        } else {
          const byEntityId = (pkg.scoringGuides || []).filter((s) => s.id === targetId);
          const byItemId = (pkg.scoringGuides || []).filter((s) => s.instrumentItemId === targetId);
          candidates = Array.from(new Set([...byEntityId, ...byItemId]));
        }
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Scoring guide not found' : 'Ambiguous scoring guide',
          };
        }
        const sg: any = candidates[0];
        if ('title' in proposed) {
          sg.title = proposed.title;
          sg.provenance = this.updateFieldProvenance(sg.provenance, 'title', 'AI_REGENERATED');
        }
        if ('guideType' in proposed) {
          sg.guideType = proposed.guideType;
          sg.provenance = this.updateFieldProvenance(sg.provenance, 'guideType', 'AI_REGENERATED');
        }
        if ('instructions' in proposed) {
          sg.instructions = proposed.instructions;
          sg.provenance = this.updateFieldProvenance(sg.provenance, 'instructions', 'AI_REGENERATED');
        }
        if ('maxScore' in proposed) {
          sg.maxScore = proposed.maxScore;
          sg.provenance = this.updateFieldProvenance(sg.provenance, 'maxScore', 'AI_REGENERATED');
        }
        return { success: true };
      }

      case 'RUBRIC': {
        if (locator && locator.kind !== 'RUBRIC' && locator.kind !== 'INSTRUMENT_ITEM') {
          return { success: false, reason: 'Invalid locator kind for RUBRIC' };
        }
        let candidates: any[] = [];
        if (locator?.kind === 'RUBRIC') {
          candidates = (pkg.rubrics || []).filter((r) => r.id === locator.id);
        } else if (locator?.kind === 'INSTRUMENT_ITEM') {
          candidates = (pkg.rubrics || []).filter((r) => r.instrumentItemId === locator.id);
        } else {
          const byEntityId = (pkg.rubrics || []).filter((r) => r.id === targetId);
          const byItemId = (pkg.rubrics || []).filter((r) => r.instrumentItemId === targetId);
          candidates = Array.from(new Set([...byEntityId, ...byItemId]));
        }
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Rubric not found' : 'Ambiguous rubric',
          };
        }
        const rb: any = candidates[0];
        if ('title' in proposed) {
          rb.title = proposed.title || rb.title;
          rb.provenance = this.updateFieldProvenance(rb.provenance, 'title', 'AI_REGENERATED');
        }
        if ('criteria' in proposed) {
          rb.criteria = proposed.criteria;
          rb.provenance = this.updateFieldProvenance(rb.provenance, 'criteria', 'AI_REGENERATED');
        }
        if ('scale' in proposed) {
          rb.scale = proposed.scale;
          rb.provenance = this.updateFieldProvenance(rb.provenance, 'scale', 'AI_REGENERATED');
        }
        return { success: true };
      }

      case 'TASK': {
        const candidates = (pkg.instruments || []).filter(
          (i) =>
            i.id === targetId &&
            ['PERFORMANCE', 'ASSIGNMENT', 'PROJECT', 'PRODUCT'].includes(i.type)
        );
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Task instrument not found' : 'Ambiguous task instrument',
          };
        }
        const inst: any = candidates[0];
        if (inst.type === 'PERFORMANCE') {
          inst.task = proposed.task || inst.task;
          inst.provenance = this.updateFieldProvenance(inst.provenance, 'task', 'AI_REGENERATED');
          if (proposed.instructions) {
            inst.instructions = proposed.instructions || inst.instructions;
            inst.provenance = this.updateFieldProvenance(
              inst.provenance,
              'instructions',
              'AI_REGENERATED'
            );
          }
        } else if (inst.type === 'ASSIGNMENT') {
          inst.instructions = proposed.instructions || inst.instructions;
          inst.provenance = this.updateFieldProvenance(
            inst.provenance,
            'instructions',
            'AI_REGENERATED'
          );
          if (proposed.expectedOutput) {
            inst.expectedOutput = proposed.expectedOutput || inst.expectedOutput;
            inst.provenance = this.updateFieldProvenance(
              inst.provenance,
              'expectedOutput',
              'AI_REGENERATED'
            );
          }
        } else if (inst.type === 'PROJECT') {
          inst.projectBrief = proposed.projectBrief || inst.projectBrief;
          inst.provenance = this.updateFieldProvenance(
            inst.provenance,
            'projectBrief',
            'AI_REGENERATED'
          );
          if (proposed.expectedDeliverable) {
            inst.expectedDeliverable = proposed.expectedDeliverable || inst.expectedDeliverable;
            inst.provenance = this.updateFieldProvenance(
              inst.provenance,
              'expectedDeliverable',
              'AI_REGENERATED'
            );
          }
        } else if (inst.type === 'PRODUCT') {
          inst.productBrief = proposed.productBrief || inst.productBrief;
          inst.provenance = this.updateFieldProvenance(
            inst.provenance,
            'productBrief',
            'AI_REGENERATED'
          );
          if (proposed.expectedProduct) {
            inst.expectedProduct = proposed.expectedProduct || inst.expectedProduct;
            inst.provenance = this.updateFieldProvenance(
              inst.provenance,
              'expectedProduct',
              'AI_REGENERATED'
            );
          }
        }
        return { success: true };
      }

      case 'EVIDENCE_REQUIREMENT': {
        const candidates = (pkg.instruments || []).filter(
          (i) => i.id === targetId && i.type === 'PORTFOLIO'
        );
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Portfolio instrument not found' : 'Ambiguous portfolio instrument',
          };
        }
        const inst: any = candidates[0];
        inst.evidenceRequirements = proposed.evidenceRequirements;
        inst.provenance = this.updateFieldProvenance(
          inst.provenance,
          'evidenceRequirements',
          'AI_REGENERATED'
        );
        return { success: true };
      }

      case 'OBSERVATION_CONTENT': {
        const candidates = (pkg.instruments || []).filter(
          (i) => i.id === targetId && i.type === 'OBSERVATION'
        );
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Observation instrument not found' : 'Ambiguous observation instrument',
          };
        }
        const inst: any = candidates[0];
        inst.aspects = proposed.aspects;
        inst.provenance = this.updateFieldProvenance(inst.provenance, 'aspects', 'AI_REGENERATED');
        if ('recordingScheme' in proposed) {
          inst.recordingScheme = proposed.recordingScheme;
          inst.provenance = this.updateFieldProvenance(
            inst.provenance,
            'recordingScheme',
            'AI_REGENERATED'
          );
        }
        return { success: true };
      }

      case 'COVERAGE_UNIT': {
        const candidates = (pkg.blueprintItems || []).filter((b) => b.coverageUnitId === targetId);
        if (candidates.length !== 1) {
          return {
            success: false,
            reason: candidates.length === 0 ? 'Coverage unit blueprint item not found' : 'Ambiguous coverage unit blueprint items',
          };
        }
        const bp: any = candidates[0];
        if ('assessmentIndicator' in proposed) {
          bp.assessmentIndicator = proposed.assessmentIndicator;
          bp.provenance = this.updateFieldProvenance(
            bp.provenance,
            'assessmentIndicator',
            'AI_REGENERATED'
          );
        }
        if ('materialOrContext' in proposed) {
          bp.materialOrContext = proposed.materialOrContext;
          bp.provenance = this.updateFieldProvenance(
            bp.provenance,
            'materialOrContext',
            'AI_REGENERATED'
          );
        }
        return { success: true };
      }

      default:
        break;
    }

    return { success: false, reason: `Failed to apply changes for target ${draft.target}` };
  }
}

export const assessmentRegenerationService = new AssessmentRegenerationService();
