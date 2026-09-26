import {
  AcademicSetting,
  ActiveContext,
  ATPData,
  TPData,
  LearningPlan,
  AssessmentCriterion,
  AssessmentPlan,
  AssessmentPackage,
} from '../types';
import { APP_BUILD_ID } from '../config/buildInfo';
import { normalizePhaseCode, TPValidationDetails } from './cpWorkflowService';

export type DiagnosticScope = 'TP' | 'ATP' | 'LEARNING_PLAN' | 'KKTP' | 'ASSESSMENT_PLAN' | 'ASSESSMENT_PACKAGE';

export interface DiagnosticEvent {
  timestamp: string;
  scope: DiagnosticScope;
  action: string;
  status?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const STORAGE_KEY = 'alco_diagnostic_events_v1';
const MAX_EVENTS = 30;

function readEvents(): DiagnosticEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

export function getRecentDiagnosticEvents(scope?: DiagnosticScope): DiagnosticEvent[] {
  const events = readEvents();
  return scope ? events.filter((event) => event.scope === scope) : events;
}

export function recordDiagnosticEvent(event: Omit<DiagnosticEvent, 'timestamp'>): void {
  if (typeof localStorage === 'undefined') return;
  const nextEvent: DiagnosticEvent = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  const events = [...readEvents(), nextEvent].slice(-MAX_EVENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Diagnostics must never interrupt the user workflow.
  }
}

function line(key: string, value: unknown): string {
  return `${key}: ${value === undefined || value === null || value === '' ? '-' : String(value)}`;
}

function formatEvents(scope: DiagnosticScope): string[] {
  const events = getRecentDiagnosticEvents(scope).slice(-10);
  if (events.length === 0) return ['- none'];
  return events.map((event) => {
    const metadata = event.metadata
      ? Object.entries(event.metadata)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')
      : '';
    return `- ${event.timestamp} ${event.action}${event.status ? ` status=${event.status}` : ''}${metadata ? ` (${metadata})` : ''}`;
  });
}

export function buildTPDiagnosticReport(data: {
  module?: 'TP' | 'LEARNING_PLAN';
  workspaceId?: string;
  academicSetting?: AcademicSetting | null;
  context?: Partial<ActiveContext> | null;
  tp?: TPData | null;
  uiItemsCount?: number;
  validation?: TPValidationDetails | null;
  atp?: ATPData | null;
  learningPlanGate?: 'ALLOWED' | 'BLOCKED';
  learningPlanGateReason?: string;
}): string {
  const phaseRaw = data.context?.phase || data.academicSetting?.phase || '';
  const tpPhaseRaw = data.tp?.phase || '';
  const validation = data.validation;
  const issues = validation?.issues?.length ? validation.issues.map((issue) => `- ${issue}`) : ['- none'];
  return [
    'ADMINISTRASI GURU AI - DIAGNOSTIC REPORT',
    '',
    'Build:',
    APP_BUILD_ID,
    '',
    'Module:',
    data.module || 'TP',
    '',
    'GeneratedAt:',
    new Date().toISOString(),
    '',
    'Context:',
    line('workspaceId', data.workspaceId),
    line('academicSettingId', data.academicSetting?.id),
    line('curriculumType', data.academicSetting?.curriculumType || data.context?.curriculumType),
    line('academicYear', data.academicSetting?.academicYear || data.context?.academicYear),
    line('semester', data.academicSetting?.semester || data.context?.semester),
    line('level', data.academicSetting?.level || data.context?.level),
    line('grade', data.academicSetting?.grade || data.context?.grade),
    line('phaseRaw', phaseRaw),
    line('phaseNormalized', normalizePhaseCode(phaseRaw)),
    line('subject', data.academicSetting?.subject || data.context?.subject),
    '',
    'TP:',
    line('id', data.tp?.id),
    line('uiItemsCount', data.uiItemsCount ?? data.tp?.items?.length ?? 0),
    line('storedItemsCount', data.tp?.items?.length ?? 0),
    line('workflowStatus', data.tp?.workflowStatus),
    line('runtimeValidationStatus', validation?.status),
    line('runtimeIsSiap', validation?.isSiap),
    line('needsReview', data.tp?.needsReview || false),
    line('generatedBy', data.tp?.generatedBy),
    line('updatedAt', data.tp?.updatedAt),
    line('storedPhaseRaw', tpPhaseRaw),
    line('storedPhaseNormalized', normalizePhaseCode(tpPhaseRaw)),
    '',
    'TP Validation Issues:',
    ...issues,
    '',
    'Downstream:',
    line('atpItemsCount', data.atp?.items?.length ?? 0),
    line('atpWorkflowStatus', data.atp?.workflowStatus),
    line('atpNeedsReview', data.atp?.needsReview || false),
    line('learningPlanGate', data.learningPlanGate || '-'),
    line('learningPlanGateReason', data.learningPlanGateReason || '-'),
    '',
    'Recent Diagnostic Events:',
    ...formatEvents(data.module || 'TP'),
  ].join('\n');
}

function countByStatus<T extends { status?: string; workflowStatus?: string; needsReview?: boolean }>(
  items: T[] = [],
  field: 'status' | 'workflowStatus' = 'workflowStatus'
): string[] {
  const siap = items.filter((item) => item[field] === 'SIAP').length;
  const draft = items.filter((item) => item[field] === 'DRAFT').length;
  const perlu = items.filter((item) => item[field] === 'PERLU_DILENGKAPI').length;
  const review = items.filter((item) => item.needsReview).length;
  return [
    line('count', items.length),
    line('SIAP count', siap),
    line('DRAFT count', draft),
    line('PERLU_DILENGKAPI count', perlu),
    line('needsReview count', review),
  ];
}

function gate(value: boolean | 'NOT_EVALUATED'): 'ALLOWED' | 'BLOCKED' | 'NOT_EVALUATED' {
  if (value === 'NOT_EVALUATED') return 'NOT_EVALUATED';
  return value ? 'ALLOWED' : 'BLOCKED';
}

export function buildAdministrationChainDiagnosticReport(data: {
  workspaceId?: string;
  academicSetting?: AcademicSetting | null;
  context?: Partial<ActiveContext> | null;
  tp?: TPData | null;
  tpRuntimeStatus?: string;
  atp?: ATPData | null;
  atpRuntimeStatus?: string;
  learningPlans?: LearningPlan[];
  assessmentCriteria?: AssessmentCriterion[];
  assessmentPlans?: AssessmentPlan[];
  assessmentPackages?: AssessmentPackage[];
}): string {
  const setting = data.academicSetting;
  const tpStoredReady = data.tp?.workflowStatus === 'SIAP' && data.tp.needsReview !== true;
  const atpStoredReady = data.atp?.workflowStatus === 'SIAP' && data.atp.needsReview !== true;
  const kktpReady = (data.assessmentCriteria || []).length > 0 &&
    (data.assessmentCriteria || []).every((c) => c.workflowStatus === 'SIAP' && c.needsReview !== true);
  const assessmentPlanReady = (data.assessmentPlans || []).some((p) => p.workflowStatus === 'SIAP' && p.needsReview !== true);
  return [
    'ADMINISTRASI GURU AI - CHAIN DIAGNOSTIC REPORT',
    '',
    'Build:',
    APP_BUILD_ID,
    '',
    'GeneratedAt:',
    new Date().toISOString(),
    '',
    'Context:',
    line('workspaceId', data.workspaceId),
    line('academicSettingId', setting?.id),
    line('curriculumType', setting?.curriculumType || data.context?.curriculumType),
    line('academicYear', setting?.academicYear || data.context?.academicYear),
    line('semester', setting?.semester || data.context?.semester),
    line('level', setting?.level || data.context?.level),
    line('grade', setting?.grade || data.context?.grade),
    line('phase', setting?.phase || data.context?.phase),
    line('phaseNormalized', normalizePhaseCode(setting?.phase || data.context?.phase)),
    line('subject', setting?.subject || data.context?.subject),
    '',
    'TP:',
    line('id', data.tp?.id),
    line('itemsCount', data.tp?.items?.length || 0),
    line('workflowStatus', data.tp?.workflowStatus),
    line('runtimeStatus', data.tpRuntimeStatus || 'NOT_EVALUATED'),
    line('needsReview', data.tp?.needsReview || false),
    line('updatedAt', data.tp?.updatedAt),
    line('basedOnCpUpdatedAt', data.tp?.basedOnCpUpdatedAt),
    line('basedOnAnalysisUpdatedAt', data.tp?.basedOnAnalysisUpdatedAt),
    '',
    'ATP:',
    line('id', data.atp?.id),
    line('itemsCount', data.atp?.items?.length || 0),
    line('workflowStatus', data.atp?.workflowStatus),
    line('runtimeStatus', data.atpRuntimeStatus || 'NOT_EVALUATED'),
    line('needsReview', data.atp?.needsReview || false),
    line('basedOnTpUpdatedAt', data.atp?.basedOnTpUpdatedAt),
    line('tpTimestampMatch', data.atp?.basedOnTpUpdatedAt && data.tp?.updatedAt ? data.atp.basedOnTpUpdatedAt === data.tp.updatedAt : 'NOT_EVALUATED'),
    '',
    'LearningPlan:',
    ...countByStatus(data.learningPlans || [], 'status'),
    '',
    'KKTP:',
    ...countByStatus(data.assessmentCriteria || [], 'workflowStatus'),
    '',
    'AssessmentPlan:',
    ...countByStatus(data.assessmentPlans || [], 'workflowStatus'),
    '',
    'AssessmentPackage:',
    ...countByStatus(data.assessmentPackages || [], 'workflowStatus'),
    '',
    'Gates:',
    line('TP_RUNTIME_READY', data.tpRuntimeStatus ? data.tpRuntimeStatus === 'SIAP' : 'NOT_EVALUATED'),
    line('TP_STORED_READY', gate(tpStoredReady)),
    line('ATP_RUNTIME_READY', data.atpRuntimeStatus ? data.atpRuntimeStatus === 'SIAP' : 'NOT_EVALUATED'),
    line('ATP_STORED_READY', data.atp ? gate(atpStoredReady) : 'NOT_EVALUATED'),
    line('TP_TO_ATP', gate(tpStoredReady)),
    line('TP_ATP_TO_LEARNING_PLAN', gate(tpStoredReady && ((data.atp?.items?.length || 0) === 0 || atpStoredReady))),
    line('TP_TO_KKTP', gate(tpStoredReady)),
    line('TP_KKTP_TO_ASSESSMENT_PLAN', gate(tpStoredReady && kktpReady)),
    line('ASSESSMENT_PLAN_TO_PACKAGE', gate(assessmentPlanReady)),
    '',
    'Recent Events:',
    ...getRecentDiagnosticEvents().slice(-10).map((event) => `- ${event.timestamp} ${event.scope}.${event.action}${event.status ? ` status=${event.status}` : ''}`),
  ].join('\n');
}
