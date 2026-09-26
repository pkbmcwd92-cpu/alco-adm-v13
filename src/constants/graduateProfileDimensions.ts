export const CANONICAL_GRADUATE_PROFILE_DIMENSIONS = [
  'Keimanan dan Ketakwaan terhadap Tuhan Yang Maha Esa',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
] as const;

export type CanonicalGraduateProfileDimension =
  (typeof CANONICAL_GRADUATE_PROFILE_DIMENSIONS)[number];

export const CANONICAL_GRADUATE_PROFILE_DIMENSIONS_SET = new Set<string>(
  CANONICAL_GRADUATE_PROFILE_DIMENSIONS
);

/**
 * Checks if a string exactly matches one of the 8 canonical graduate profile dimensions (Kemendikdasmen / Kurikulum Merdeka 2026).
 * Safe whitespace trimming is performed, but no semantic coercion or silent fallback is allowed.
 */
export function isCanonicalGraduateProfileDimension(
  dimension: unknown
): dimension is CanonicalGraduateProfileDimension {
  if (typeof dimension !== 'string') return false;
  return CANONICAL_GRADUATE_PROFILE_DIMENSIONS_SET.has(dimension.trim());
}

export interface GraduateProfileValidationResult {
  isValid: boolean;
  invalidDimensions: string[];
  dimensions: string[];
  error?: string;
}

/**
 * Validates an array of graduate profile dimensions against canonical 8 values.
 * Fail-closed: returns invalidDimensions and error if any unknown dimension is present.
 */
export function validateGraduateProfileDimensions(
  dimensions: unknown
): GraduateProfileValidationResult {
  if (!Array.isArray(dimensions)) {
    return {
      isValid: false,
      invalidDimensions: [],
      dimensions: [],
      error: 'Dimensi Profil Lulusan harus berupa daftar (array).',
    };
  }

  if (dimensions.length === 0) {
    return {
      isValid: false,
      invalidDimensions: [],
      dimensions: [],
      error: 'Dimensi Profil Lulusan belum dipilih / kosong.',
    };
  }

  const malformedIndex = dimensions.findIndex(
    (dimension) =>
      typeof dimension !== 'string' ||
      dimension.trim().length === 0
  );

  if (malformedIndex >= 0) {
    return {
      isValid: false,
      invalidDimensions: [],
      dimensions: [],
      error: `Dimensi Profil Lulusan butir ke-${malformedIndex + 1} harus berupa string non-kosong.`,
    };
  }

  const cleaned = (dimensions as string[]).map((dimension) => dimension.trim());

  const invalidDimensions = cleaned.filter(
    (dimension) => !CANONICAL_GRADUATE_PROFILE_DIMENSIONS_SET.has(dimension)
  );

  if (invalidDimensions.length > 0) {
    return {
      isValid: false,
      invalidDimensions,
      dimensions: cleaned,
      error: `Dimensi Profil Lulusan tidak valid: ${invalidDimensions.join(', ')}`,
    };
  }

  return {
    isValid: true,
    invalidDimensions: [],
    dimensions: cleaned,
  };
}
