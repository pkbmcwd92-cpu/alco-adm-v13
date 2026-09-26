import {
  AssessmentPackage,
  AssessmentGenerationPlan,
  AssessmentPackageValidationContext,
  AssessmentValidationSection,
  AssessmentValidationFinding,
  AssessmentValidationStatus,
} from '../types';

export function validateAssessmentCoverage(
  pkg: AssessmentPackage,
  generationPlan?: AssessmentGenerationPlan,
  _context?: AssessmentPackageValidationContext
): AssessmentValidationSection {
  const findings: AssessmentValidationFinding[] = [];

  if (!pkg.blueprintItems || pkg.blueprintItems.length === 0) {
    findings.push({
      code: 'MISSING_BLUEPRINT',
      status: 'FAIL',
      severity: 'BLOCKING',
      message: 'Kisi-kisi (blueprint) asesmen kosong.',
      source: 'DETERMINISTIC',
    });
    return {
      status: 'FAIL',
      findings,
    };
  }

  if (!generationPlan || !generationPlan.coverageUnits || generationPlan.coverageUnits.length === 0) {
    return {
      status: 'PASS',
      findings: [],
    };
  }

  const planUnitsMap = new Map(generationPlan.coverageUnits.map((u) => [u.id, u]));

  // 1. Check each planned coverage unit against package using CANONICAL coverageUnitId ONLY (BLOCKER 3)
  for (const planUnit of generationPlan.coverageUnits) {
    // Exact coverageUnitId match ONLY. No fallback to objectiveRefId/criterionId!
    const matchingBpItems = pkg.blueprintItems.filter((bp) => bp.coverageUnitId === planUnit.id);

    if (matchingBpItems.length === 0) {
      findings.push({
        code: 'MISSING_PLANNED_COVERAGE',
        status: 'FAIL',
        severity: 'BLOCKING',
        coverageUnitId: planUnit.id,
        message: `Unit cakupan rencana (${planUnit.id}) tidak ditemukan pada kisi-kisi perangkat asesmen.`,
        source: 'DETERMINISTIC',
      });
      continue;
    }

    // Validate matching blueprint items against planned objective and criterion
    for (const bpItem of matchingBpItems) {
      if (bpItem.objectiveRefId !== planUnit.objectiveRefId) {
        findings.push({
          code: 'OBJECTIVE_REF_MISMATCH',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Referensi Tujuan Pembelajaran pada item kisi-kisi (${bpItem.objectiveRefId}) tidak cocok dengan rencana (${planUnit.objectiveRefId}).`,
          source: 'DETERMINISTIC',
        });
      }

      if (planUnit.criterionId && bpItem.criterionId && bpItem.criterionId !== planUnit.criterionId) {
        findings.push({
          code: 'CRITERION_REF_MISMATCH',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Referensi Kriteria pada item kisi-kisi (${bpItem.criterionId}) tidak cocok dengan rencana (${planUnit.criterionId}).`,
          source: 'DETERMINISTIC',
        });
      }

      // Resolve instrument deterministically (NO TYPE FALLBACK)
      const res = resolveInstrumentForBlueprintItem(bpItem, pkg.instruments);

      if (res.error === 'AMBIGUOUS_INSTRUMENT_LINKAGE') {
        findings.push({
          code: 'AMBIGUOUS_INSTRUMENT_LINKAGE',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Terdapat keterkaitan instrumen ganda/ambigu untuk item kisi-kisi (${bpItem.id}).`,
          source: 'DETERMINISTIC',
        });
      } else if (res.error === 'DANGLING_BLUEPRINT_INSTRUMENT') {
        findings.push({
          code: 'DANGLING_BLUEPRINT_INSTRUMENT',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Item kisi-kisi (${bpItem.id}) merujuk ID instrumen (${bpItem.instrumentId}) yang tidak ditemukan.`,
          source: 'DETERMINISTIC',
        });
      } else if (res.error === 'MISSING_INSTRUMENT_LINKAGE') {
        findings.push({
          code: 'MISSING_INSTRUMENT_LINKAGE',
          status: 'FAIL',
          severity: 'BLOCKING',
          coverageUnitId: planUnit.id,
          blueprintItemId: bpItem.id,
          message: `Item kisi-kisi (${bpItem.id}) tidak memiliki keterkaitan ID instrumen atau item yang terbukti secara eksplisit.`,
          source: 'DETERMINISTIC',
        });
      } else if (res.instrument) {
        const instrument = res.instrument;

        if (bpItem.instrumentType && instrument.type !== bpItem.instrumentType) {
          findings.push({
            code: 'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH',
            status: 'FAIL',
            severity: 'BLOCKING',
            coverageUnitId: planUnit.id,
            blueprintItemId: bpItem.id,
            instrumentId: instrument.id,
            message: `Tipe instrumen (${instrument.type}) tidak sesuai dengan yang ditentukan pada kisi-kisi (${bpItem.instrumentType}).`,
            source: 'DETERMINISTIC',
          });
        }

        if (planUnit.instrumentType && instrument.type !== planUnit.instrumentType) {
          findings.push({
            code: 'INSTRUMENT_TYPE_MISMATCH',
            status: 'FAIL',
            severity: 'BLOCKING',
            coverageUnitId: planUnit.id,
            blueprintItemId: bpItem.id,
            instrumentId: instrument.id,
            message: `Tipe instrumen (${instrument.type}) tidak sesuai dengan yang direncanakan (${planUnit.instrumentType}).`,
            source: 'DETERMINISTIC',
          });
        }

        // Validate allocation unit semantics
        const isCompatible = checkAllocationSemantics(planUnit.allocationUnit, instrument.type);
        if (!isCompatible) {
          findings.push({
            code: 'ALLOCATION_SEMANTICS_MISMATCH',
            status: 'FAIL',
            severity: 'BLOCKING',
            coverageUnitId: planUnit.id,
            blueprintItemId: bpItem.id,
            instrumentId: instrument.id,
            message: `Alokasi unit ${planUnit.allocationUnit} tidak kompatibel dengan tipe instrumen ${instrument.type}.`,
            source: 'DETERMINISTIC',
          });
        }
      }
    }

    // FIX 2: Check planned count vs actual count ONLY if recommendedCount is defined
    if (planUnit.recommendedCount !== undefined) {
      const expectedCount = planUnit.recommendedCount;
      let actualCount = 0;
      let isUnresolved = false;
      let hasDeterministicLinkage = false;

      const resolvedInstruments: { bpItem: any; instrument: any }[] = [];
      let linkageFailed = false;

      for (const bpItem of matchingBpItems) {
        const res = resolveInstrumentForBlueprintItem(bpItem, pkg.instruments);
        if (res.error || !res.instrument) {
          linkageFailed = true;
          break;
        }
        resolvedInstruments.push({ bpItem, instrument: res.instrument });
      }

      if (!linkageFailed && resolvedInstruments.length > 0) {
        const allocationUnit = planUnit.allocationUnit || 'ITEM';

        if (allocationUnit === 'ITEM') {
          const matchedItemIds = new Set<string>();
          let totalItemsInResolvedInstruments = 0;
          let itemsHaveLinkageInfo = false;

          for (const { bpItem, instrument } of resolvedInstruments) {
            if ('items' in instrument && Array.isArray(instrument.items)) {
              totalItemsInResolvedInstruments += instrument.items.length;
              for (const item of instrument.items) {
                if (item.blueprintItemId || item.coverageUnitId) {
                  itemsHaveLinkageInfo = true;
                }
                const matchesBp = item.blueprintItemId === bpItem.id;
                const matchesCu = item.coverageUnitId === planUnit.id;
                const matchesBpItemIds = Array.isArray(bpItem.instrumentItemIds) && bpItem.instrumentItemIds.includes(item.id);

                if (matchesBp || matchesCu || matchesBpItemIds) {
                  matchedItemIds.add(item.id);
                }
              }
            }
          }

          if (matchedItemIds.size > 0) {
            actualCount = matchedItemIds.size;
            hasDeterministicLinkage = true;
          } else if (totalItemsInResolvedInstruments === 0) {
            actualCount = 0;
            hasDeterministicLinkage = true;
          } else if (itemsHaveLinkageInfo) {
            actualCount = 0;
            hasDeterministicLinkage = true;
          } else {
            isUnresolved = true;
          }
        } else if (allocationUnit === 'OBSERVATION') {
          let explicitObservationCount = 0;
          let observationLinkageFound = false;

          for (
            const { bpItem, instrument }
            of resolvedInstruments
          ) {
            if (instrument.type !== 'OBSERVATION') {
              continue;
            }

            const explicitInstrumentLink =
              bpItem.instrumentId === instrument.id ||
              instrument.blueprintItemId === bpItem.id ||
              instrument.coverageUnitId === planUnit.id;

            const blueprintAspectIds =
              Array.isArray(bpItem.instrumentItemIds)
                ? bpItem.instrumentItemIds
                : [];

            const actualAspectIds = new Set(
              Array.isArray(instrument.aspects)
                ? instrument.aspects.map(
                    (asp: any) => asp.id
                  )
                : []
            );

            const hasExplicitAspectLink =
              blueprintAspectIds.length > 0 &&
              blueprintAspectIds.every(
                (id: string) =>
                  actualAspectIds.has(id)
              );

            if (
              explicitInstrumentLink ||
              hasExplicitAspectLink
            ) {
              explicitObservationCount += 1;
              observationLinkageFound = true;
            }
          }

          if (observationLinkageFound) {
            actualCount = explicitObservationCount;
            hasDeterministicLinkage = true;
          } else {
            isUnresolved = true;
          }
        } else if (['TASK', 'EVIDENCE'].includes(allocationUnit)) {
          let explicitTaskCount = 0;
          let taskLinkageFound = false;

          for (const { bpItem, instrument } of resolvedInstruments) {
            if (bpItem.instrumentId === instrument.id || instrument.blueprintItemId === bpItem.id || instrument.coverageUnitId === planUnit.id) {
              explicitTaskCount += 1;
              taskLinkageFound = true;
            }
          }

          if (taskLinkageFound) {
            actualCount = explicitTaskCount;
            hasDeterministicLinkage = true;
          } else {
            isUnresolved = true;
          }
        }

        if (isUnresolved) {
          findings.push({
            code: 'COVERAGE_COUNT_UNRESOLVED',
            status: 'REVIEW',
            severity: 'REVIEW',
            coverageUnitId: planUnit.id,
            message: `Jumlah unit tergenerasi untuk unit cakupan (${planUnit.id}) tidak dapat ditentukan secara pasti karena kurangnya keterkaitan eksplisit.`,
            source: 'DETERMINISTIC',
          });
        } else if (hasDeterministicLinkage && actualCount !== expectedCount) {
          findings.push({
            code: 'COVERAGE_COUNT_MISMATCH',
            status: 'REVIEW',
            severity: 'REVIEW',
            coverageUnitId: planUnit.id,
            message: `Jumlah item/tugas tergenerasi (${actualCount}) tidak sama dengan rencana (${expectedCount}).`,
            source: 'DETERMINISTIC',
          });
        }
      }
    }
  }

  // 2. Check for missing or unexpected coverage units in package blueprint items
  for (const bpItem of pkg.blueprintItems) {
    if (!bpItem.coverageUnitId) {
      findings.push({
        code: 'MISSING_BLUEPRINT_COVERAGE_UNIT_ID',
        status: 'FAIL',
        severity: 'BLOCKING',
        blueprintItemId: bpItem.id,
        message: `Item kisi-kisi (${bpItem.id}) tidak memiliki coverageUnitId yang valid.`,
        source: 'DETERMINISTIC',
      });
    } else if (!planUnitsMap.has(bpItem.coverageUnitId)) {
      findings.push({
        code: 'UNEXPECTED_COVERAGE_UNIT',
        status: 'REVIEW',
        severity: 'REVIEW',
        blueprintItemId: bpItem.id,
        message: `Item kisi-kisi (${bpItem.id}) merujuk unit cakupan (${bpItem.coverageUnitId}) yang tidak ada dalam rencana.`,
        source: 'DETERMINISTIC',
      });
    }
  }

  // Aggregate status
  const hasFail = findings.some((f) => f.status === 'FAIL');
  const hasReview = findings.some((f) => f.status === 'REVIEW');
  const status: AssessmentValidationStatus = hasFail ? 'FAIL' : hasReview ? 'REVIEW' : 'PASS';

  return {
    status,
    findings,
  };
}

export function resolveInstrumentForBlueprintItem(
  bpItem: any,
  instruments: any[]
): {
  instrument?: any;
  error?:
    | 'DANGLING_BLUEPRINT_INSTRUMENT'
    | 'AMBIGUOUS_INSTRUMENT_LINKAGE'
    | 'MISSING_INSTRUMENT_LINKAGE';
} {
  if (!instruments || instruments.length === 0) {
    return { error: 'MISSING_INSTRUMENT_LINKAGE' };
  }

  // 1. Explicit instrumentId on blueprint item
  if (bpItem.instrumentId) {
    const found = instruments.find((i) => i.id === bpItem.instrumentId);
    if (!found) {
      return { error: 'DANGLING_BLUEPRINT_INSTRUMENT' };
    }
    return { instrument: found };
  }

  // 2. Explicit item-level ownership / linkage
  const itemLinked = instruments.filter((inst) => {
    if ('items' in inst && Array.isArray((inst as any).items)) {
      return (inst as any).items.some(
        (item: any) =>
          item.blueprintItemId === bpItem.id ||
          (Array.isArray(bpItem.instrumentItemIds) &&
            bpItem.instrumentItemIds.includes(item.id))
      );
    }
    if (inst.blueprintItemId && inst.blueprintItemId === bpItem.id) {
      return true;
    }
    return false;
  });

  if (itemLinked.length === 1) {
    return { instrument: itemLinked[0] };
  } else if (itemLinked.length > 1) {
    return { error: 'AMBIGUOUS_INSTRUMENT_LINKAGE' };
  }

  // DO NOT FALL BACK TO INSTRUMENT TYPE MATCHING!
  // TYPE VALIDATES IDENTITY. TYPE DOES NOT CREATE IDENTITY.
  return { error: 'MISSING_INSTRUMENT_LINKAGE' };
}

function checkAllocationSemantics(
  allocationUnit: 'ITEM' | 'TASK' | 'EVIDENCE' | 'OBSERVATION',
  instrumentType: string
): boolean {
  switch (allocationUnit) {
    case 'ITEM':
      return (
        instrumentType === 'WRITTEN_TEST' ||
        instrumentType === 'ORAL_TEST' ||
        instrumentType === 'SELF_ASSESSMENT' ||
        instrumentType === 'PEER_ASSESSMENT'
      );
    case 'TASK':
      return ['PERFORMANCE', 'PROJECT', 'PRODUCT', 'ASSIGNMENT'].includes(instrumentType);
    case 'EVIDENCE':
      return instrumentType === 'PORTFOLIO';
    case 'OBSERVATION':
      return instrumentType === 'OBSERVATION';
    default:
      return true;
  }
}
