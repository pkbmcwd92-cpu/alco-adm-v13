import {
  AssessmentPackage,
  DependencyFreshness,
  AssessmentRegenerationTarget,
} from '../types';

export class AssessmentRegenerationDependencyService {
  /**
   * Invalidates dependencies of a given target within the AssessmentPackage.
   * Returns a deep clone of the package with modified dependency freshness.
   */
  public invalidateDependencies(
    pkg: AssessmentPackage,
    target: AssessmentRegenerationTarget,
    targetId: string
  ): AssessmentPackage {
    // Deep clone pkg
    const cloned: AssessmentPackage = JSON.parse(JSON.stringify(pkg));

    // Ensure answerKeys, scoringGuides, rubrics arrays exist
    cloned.answerKeys = cloned.answerKeys || [];
    cloned.scoringGuides = cloned.scoringGuides || [];
    cloned.rubrics = cloned.rubrics || [];
    cloned.blueprintItems = cloned.blueprintItems || [];

    switch (target) {
      case 'ITEM_PROMPT': {
        // Find dependent answer keys (answerKey.instrumentItemId === targetId)
        cloned.answerKeys.forEach((ak: any) => {
          if (ak.instrumentItemId === targetId) {
            ak.freshness = 'STALE';
          }
        });

        // Find dependent blueprint item to mark its review/findings stale
        cloned.blueprintItems.forEach((bp: any) => {
          if (bp.instrumentItemIds && bp.instrumentItemIds.includes(targetId)) {
            bp.freshness = 'STALE';
          }
        });
        break;
      }

      case 'OPTIONS': {
        // Find dependent answer keys (answerKey.instrumentItemId === targetId)
        cloned.answerKeys.forEach((ak: any) => {
          if (ak.instrumentItemId === targetId) {
            ak.freshness = 'STALE';
          }
        });

        // Find dependent blueprint item to mark distractor review stale
        cloned.blueprintItems.forEach((bp: any) => {
          if (bp.instrumentItemIds && bp.instrumentItemIds.includes(targetId)) {
            bp.freshness = 'STALE';
          }
        });
        break;
      }

      case 'STIMULUS': {
        // Find dependent answer keys (instrumentItemId === targetId)
        cloned.answerKeys.forEach((ak: any) => {
          if (ak.instrumentItemId === targetId) {
            ak.freshness = 'STALE';
          }
        });

        // Find dependent blueprint item to mark quality reviews stale
        cloned.blueprintItems.forEach((bp: any) => {
          if (bp.instrumentItemIds && bp.instrumentItemIds.includes(targetId)) {
            bp.freshness = 'STALE';
          }
        });
        break;
      }

      case 'INDICATOR': {
        // Find blueprint item with this id
        cloned.blueprintItems.forEach((bp: any) => {
          if (bp.id === targetId) {
            bp.freshness = 'STALE'; // alignment is stale

            if (bp.instrumentItemIds && bp.instrumentItemIds.length > 0) {
              const itemIds = bp.instrumentItemIds;
              cloned.answerKeys.forEach((ak: any) => {
                if (ak.instrumentItemId && itemIds.includes(ak.instrumentItemId)) {
                  ak.freshness = 'NEEDS_REVIEW';
                }
              });
              cloned.scoringGuides.forEach((sg: any) => {
                if (sg.instrumentItemId && itemIds.includes(sg.instrumentItemId)) {
                  sg.freshness = 'NEEDS_REVIEW';
                }
              });
              cloned.rubrics.forEach((rb: any) => {
                if (rb.instrumentItemId && itemIds.includes(rb.instrumentItemId)) {
                  rb.freshness = 'NEEDS_REVIEW';
                }
              });
            } else if (bp.instrumentId) {
              const instrument = (cloned.instruments || []).find((i: any) => i.id === bp.instrumentId);
              const TASK_INSTRUMENT_TYPES = ['PERFORMANCE', 'ASSIGNMENT', 'PROJECT', 'PRODUCT'];
              if (instrument && TASK_INSTRUMENT_TYPES.includes(instrument.type)) {
                // Task semantic instruments linked at instrument level
                cloned.answerKeys.forEach((ak: any) => {
                  if (ak.instrumentId === bp.instrumentId) {
                    ak.freshness = 'NEEDS_REVIEW';
                  }
                });
                cloned.scoringGuides.forEach((sg: any) => {
                  if (sg.instrumentId === bp.instrumentId) {
                    sg.freshness = 'NEEDS_REVIEW';
                  }
                });
                cloned.rubrics.forEach((rb: any) => {
                  if (rb.instrumentId === bp.instrumentId) {
                    rb.freshness = 'NEEDS_REVIEW';
                  }
                });
              }
            }
          }
        });
        break;
      }

      case 'TASK': {
        // TASK is for PERFORMANCE / ASSIGNMENT / PROJECT / PRODUCT
        // Find the instrument
        const inst = cloned.instruments.find((i) => i.id === targetId);
        if (inst) {
          // scoring guide stale
          cloned.scoringGuides.forEach((sg: any) => {
            if (sg.instrumentId === targetId) {
              sg.freshness = 'STALE';
            }
          });

          // rubric stale / needs review
          cloned.rubrics.forEach((rb: any) => {
            if (rb.instrumentId === targetId) {
              // Check if teacher edited
              const isTeacherEdited =
                rb.provenance === 'TEACHER_EDITED' ||
                rb.provenance?.fields?.criteria === 'TEACHER_EDITED' ||
                rb.provenance?.criteria === 'TEACHER_EDITED';

              if (isTeacherEdited) {
                rb.freshness = 'NEEDS_REVIEW';
                rb.status = 'DRAFT';
              } else {
                rb.freshness = 'STALE';
              }
            }
          });
        }
        break;
      }

      case 'EVIDENCE_REQUIREMENT': {
        // Related rubric/scoring/alignment review stale
        const inst = cloned.instruments.find((i: any) => {
          if (i.type === 'PORTFOLIO') {
            return i.id === targetId || i.blueprintItemId === targetId;
          }
          return false;
        });
        const instId = inst ? inst.id : targetId;

        cloned.rubrics.forEach((rb: any) => {
          if (rb.instrumentId === instId) {
            rb.freshness = 'STALE';
          }
        });
        cloned.scoringGuides.forEach((sg: any) => {
          if (sg.instrumentId === instId) {
            sg.freshness = 'STALE';
          }
        });
        break;
      }

      case 'OBSERVATION_CONTENT': {
        // Invalidate dependent observation results
        const inst = cloned.instruments.find((i) => i.id === targetId);
        if (inst) {
          cloned.blueprintItems.forEach((bp: any) => {
            if (bp.instrumentId === targetId) {
              bp.freshness = 'STALE';
            }
          });
        }
        break;
      }

      default:
        break;
    }

    return cloned;
  }
}

export const assessmentRegenerationDependencyService = new AssessmentRegenerationDependencyService();
