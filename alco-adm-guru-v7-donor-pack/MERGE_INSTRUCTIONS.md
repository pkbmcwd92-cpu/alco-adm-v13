# V7 Donor Integration Pack

## Authority
- `src/`, `server/`, `scripts/` at repository root = V7 BASE and authoritative starting point.
- `_DONOR_V6_REFERENCE/` = read-only reference from V6. NEVER compile/import this folder and NEVER copy it wholesale over V7.

## Goal
Port only V6 improvements missing from V7 while preserving V7's stricter workflow foundation.

## Mandatory keep from V7
- `src/services/workflowEngine.ts`
- `scripts/testWorkflowDependencyRegression.ts`
- strict `matchCanonicalTP()` behavior
- no positional/index fallback for TP matching
- ambiguous code/statement must not select first match
- no fabricated JP, semester, assessment, resource, or P3 defaults
- `KKTPManager`: non-legacy `passingThreshold` must remain `null`

## Port order
1. Regulation registry / curriculum structure evidence
2. CP master/source/versioning including 2026 religion CP rules
3. CP verification and CP Analysis workflow
4. TP provenance/dependency invalidation
5. ATP: port only capabilities missing in V7 (reference status/normalization, coverage, duplicate/dangling detection, review invalidation)

## ATP hard rules
- `tpId` authoritative.
- Legacy code/statement matching only when unique.
- Never use silent chained `.find()` first-match behavior.
- Missing JP stays null/undefined; never `jp || 6`.
- Missing semester stays null/undefined; never `semester || 1`.
- No default `Bernalar Kritis`.
- No fabricated assessment/resource strings.
- AI ATP remains DRAFT until teacher confirmation through validator.
- Existing ATP item IDs must survive edit/reorder/save.

## Do not overwrite wholesale
- `src/components/ATPManager.tsx`
- `src/components/TPManager.tsx`
- `src/components/CPManager.tsx`
- `src/components/CPAnalysisManager.tsx`
- `src/types/index.ts`
- curriculum resolver/types/validators

Compare root V7 file with corresponding `_DONOR_V6_REFERENCE/...` and adapt only missing logic.

## Validation
Run available typecheck/build/tests. Do not claim PASS for commands not run.
Search regressions: `jp || 6`, `jp ?? 6`, `semester || 1`, `semester ?? 1`, `weeklyJP || 5`, `['Bernalar Kritis']`, fabricated assessment/resource defaults, chained TP `.find()` fallbacks.

## Cleanup
After successful integration and tests, delete `_DONOR_V6_REFERENCE/` before production release/commit if desired.
