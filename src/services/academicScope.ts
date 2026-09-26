import {
  SemesterNumber,
  AcademicScopeType,
  YearPlan,
  SemesterPlan,
  AnnualJPReference,
  SemesterJPSetting,
  CurriculumContextLock,
} from '../types';

export type {
  SemesterNumber,
  AcademicScopeType,
  YearPlan,
  SemesterPlan,
  AnnualJPReference,
  SemesterJPSetting,
  CurriculumContextLock,
};

/**
 * Normalizes legacy or arbitrary semester representations to canonical SemesterNumber (1 | 2).
 *
 * Recognized valid representations:
 * - 1, 2 (number)
 * - "1", "2"
 * - "1 (Ganjil)", "2 (Genap)" (case-insensitive)
 * - "Ganjil", "Genap" (case-insensitive)
 *
 * Any other value (e.g. 0, 3, "", undefined, random string) returns null.
 * Never silently defaults to Semester 1.
 */
export function normalizeSemester(value: unknown): SemesterNumber | null {
  if (value === 1 || value === 2) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const s = value.trim().toLowerCase();
  if (s === '1' || s === '1 (ganjil)' || s === 'ganjil') {
    return 1;
  }
  if (s === '2' || s === '2 (genap)' || s === 'genap') {
    return 2;
  }

  return null;
}

/**
 * Domain entity kinds within academic administration.
 * Categorized strictly into ANNUAL (YEAR) or SEMESTER scope.
 */
export type AcademicEntityKind =
  | 'CP'
  | 'CP_ANALYSIS'
  | 'TP'
  | 'ATP'
  | 'PROTA'
  | 'CURRICULUM_CONTEXT'
  | 'ANNUAL_JP_REFERENCE'
  | 'ACADEMIC_CALENDAR'
  | 'TIME_ALLOCATION'
  | 'PROMES'
  | 'LEARNING_PLAN'
  | 'ASSESSMENT_CRITERIA'
  | 'ASSESSMENT_PLAN'
  | 'ASSESSMENT_PACKAGE'
  | 'ROSTER'
  | 'ATTENDANCE'
  | 'GRADE'
  | 'REMEDIAL'
  | 'ENRICHMENT';

/**
 * Immutable mapping of academic entity kinds to their canonical scope ('YEAR' | 'SEMESTER').
 */
const ACADEMIC_ENTITY_SCOPE_MAP: Record<AcademicEntityKind, AcademicScopeType> = {
  // Annual (YEAR) Scope:
  CP: 'YEAR',
  CP_ANALYSIS: 'YEAR',
  TP: 'YEAR',
  ATP: 'YEAR',
  PROTA: 'YEAR',
  CURRICULUM_CONTEXT: 'YEAR',
  ANNUAL_JP_REFERENCE: 'YEAR',

  // Semester (SEMESTER) Scope:
  ACADEMIC_CALENDAR: 'SEMESTER',
  TIME_ALLOCATION: 'SEMESTER',
  PROMES: 'SEMESTER',
  LEARNING_PLAN: 'SEMESTER',
  ASSESSMENT_CRITERIA: 'SEMESTER',
  ASSESSMENT_PLAN: 'SEMESTER',
  ASSESSMENT_PACKAGE: 'SEMESTER',
  ROSTER: 'SEMESTER',
  ATTENDANCE: 'SEMESTER',
  GRADE: 'SEMESTER',
  REMEDIAL: 'SEMESTER',
  ENRICHMENT: 'SEMESTER',
};

/**
 * Resolves the canonical AcademicScopeType ('YEAR' | 'SEMESTER') for a given entity kind.
 * Fails explicitly if the kind is unknown or unmapped. Never falls back silently.
 */
export function getAcademicEntityScope(kind: AcademicEntityKind): AcademicScopeType {
  const scope = ACADEMIC_ENTITY_SCOPE_MAP[kind];
  if (!scope) {
    throw new Error(`Unknown academic entity kind: ${String(kind)}`);
  }
  return scope;
}

/**
 * Pure predicate checking whether an entity belongs to ANNUAL (YEAR) scope.
 */
export function isAnnualEntity(kind: AcademicEntityKind): boolean {
  return getAcademicEntityScope(kind) === 'YEAR';
}

/**
 * Pure predicate checking whether an entity belongs to SEMESTER scope.
 */
export function isSemesterEntity(kind: AcademicEntityKind): boolean {
  return getAcademicEntityScope(kind) === 'SEMESTER';
}

/**
 * Creates a deterministic annual scope key.
 * Format: "YEAR:<yearPlanId>"
 */
export function createYearScopeKey(yearPlanId: string): string {
  if (!yearPlanId || typeof yearPlanId !== 'string' || !yearPlanId.trim()) {
    throw new Error('yearPlanId must be a non-empty string');
  }
  return `YEAR:${yearPlanId.trim()}`;
}

/**
 * Creates a deterministic semester scope key.
 * Format: "SEMESTER:<yearPlanId>:<semester>"
 */
export function createSemesterScopeKey(
  yearPlanId: string,
  semester: SemesterNumber | unknown
): string {
  if (!yearPlanId || typeof yearPlanId !== 'string' || !yearPlanId.trim()) {
    throw new Error('yearPlanId must be a non-empty string');
  }
  const norm = normalizeSemester(semester);
  if (!norm) {
    throw new Error(`Invalid semester number: ${String(semester)}`);
  }
  return `SEMESTER:${yearPlanId.trim()}:${norm}`;
}
