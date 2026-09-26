import { CurriculumStructureRule } from '../types';
import { SD_STRUCTURE_RULES } from './sd';
import { SMP_STRUCTURE_RULES } from './smp';
import { SMA_STRUCTURE_RULES } from './sma';

export { SD_STRUCTURE_RULES } from './sd';
export { SMP_STRUCTURE_RULES } from './smp';
export { SMA_STRUCTURE_RULES } from './sma';

/**
 * Gabungan seluruh master struktur kurikulum resmi SD, SMP, SMA
 */
export const ALL_CURRICULUM_STRUCTURE_RULES: CurriculumStructureRule[] = [
  ...SD_STRUCTURE_RULES,
  ...SMP_STRUCTURE_RULES,
  ...SMA_STRUCTURE_RULES,
];
