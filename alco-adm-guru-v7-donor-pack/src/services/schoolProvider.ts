import { SchoolData } from '../types';

export type SchoolCandidateSourceType =
  | 'official_government'
  | 'official_school_web'
  | 'third_party_api'
  | 'web_search';

export interface SchoolCandidate extends Omit<SchoolData, 'id' | 'createdAt' | 'updatedAt'> {
  source: string;
  sourceType?: SchoolCandidateSourceType;
  sourceUrl?: string;
  level?: string;
  status?: string;
  accreditation?: string;
  phone?: string;
  email?: string;
  website?: string;
  isCandidate?: boolean;
}

export interface SchoolSearchResponse {
  query: string;
  found: boolean;
  candidates: SchoolCandidate[];
  message: string;
  error?: boolean;
  sourceType?: SchoolCandidateSourceType | 'mixed' | 'online_search' | 'official_api';
}

export interface PrincipalResolutionResponse {
  success: boolean;
  found: boolean;
  principalName?: string;
  principalNip?: string;
  principalSource?: string;
  principalSourceUrl?: string;
  verificationStatus?: 'verified' | 'unverified';
  lastVerifiedAt?: string;
  message?: string;
}

/**
 * SchoolSearchService:
 * Client-side service communicating with the backend trusted web search and education data providers.
 * Strictly adheres to the rule of NEVER fabricating NPSN, address, or principal info.
 */
export class SchoolSearchService {
  /**
   * Resolves and verifies headmaster / principal name and NIP from official sources.
   */
  static async resolvePrincipal(params: {
    name: string;
    npsn?: string;
    district?: string;
    regency?: string;
    province?: string;
  }): Promise<PrincipalResolutionResponse> {
    try {
      const response = await fetch('/api/schools/resolve-principal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        return await response.json();
      }
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        found: false,
        message: err.message || 'Gagal memverifikasi kepala sekolah.',
      };
    } catch (e) {
      console.warn('[SchoolSearchService] resolvePrincipal error:', e);
      return {
        success: false,
        found: false,
        message: 'Koneksi ke verifikasi kepala sekolah terputus.',
      };
    }
  }

  /**
   * Normalizes a school search candidate result into a clean, typed SchoolData object.
   * Preserves principal information if available from verified sources, or marks empty safely without fabrication.
   */
  static normalizeSchoolSearchResult(
    result: Partial<SchoolCandidate> | Partial<SchoolData>,
    existingId?: string
  ): SchoolData {
    const hasPrincipal = Boolean(result.principalName && result.principalName.trim().length > 0);
    const now = new Date().toISOString();

    return {
      id: existingId || (result as SchoolData).id || `school_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: (result.name || '').trim(),
      npsn: (result.npsn || '').trim(),
      address: (result.address || '').trim(),
      village: (result.village || '').trim(),
      district: (result.district || '').trim(),
      regency: (result.regency || '').trim(),
      province: (result.province || '').trim(),
      principalName: (result.principalName || '').trim(),
      principalNip: (result.principalNip || '').trim(),
      principalSource: result.principalSource || (result as SchoolCandidate).source || (hasPrincipal ? 'Sumber Data Sekolah' : undefined),
      principalSourceUrl: result.principalSourceUrl || (result as SchoolCandidate).sourceUrl,
      lastVerifiedAt: result.lastVerifiedAt || now,
      verificationStatus: result.verificationStatus || (result.npsn ? 'verified' : 'unverified'),
      createdAt: (result as SchoolData).createdAt || now,
      updatedAt: now,
    };
  }

  /**
   * Search for official school records via backend service.
   */
  static async searchSchool(query: string): Promise<SchoolSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        query,
        found: false,
        candidates: [],
        message: 'Masukkan nama sekolah atau NPSN untuk mencari data identitas.',
      };
    }

    try {
      const response = await fetch(`/api/schools/search?q=${encodeURIComponent(trimmed)}`);
      if (response.ok) {
        const data = await response.json();
        return {
          query: trimmed,
          found: data.found ?? false,
          candidates: data.candidates || [],
          message:
            data.message ||
            (data.found
              ? 'Data sekolah ditemukan dari sumber online.'
              : 'Tidak ditemukan pada sumber data yang tersedia.'),
          sourceType: data.sourceType,
        };
      } else {
        const errData = await response.json().catch(() => ({}));
        return {
          query: trimmed,
          found: false,
          candidates: [],
          message: errData.message || 'Tidak dapat menghubungi sumber data sekolah saat ini.',
          error: true,
        };
      }
    } catch (err) {
      console.warn('[SchoolSearchService] Search request error:', err);
      return {
        query: trimmed,
        found: false,
        candidates: [],
        message: 'Tidak dapat terhubung ke server pencarian. Anda dapat memasukkan data sekolah secara manual.',
        error: true,
      };
    }
  }

  /**
   * Format full school address into standard Indonesian official mailing string.
   */
  static formatFullAddress(school: Partial<SchoolData>): string {
    const parts = [
      school.address,
      school.village ? `Desa/Kel. ${school.village}` : '',
      school.district ? (school.district.startsWith('Kec.') ? school.district : `Kec. ${school.district}`) : '',
      school.regency ? school.regency : '',
      school.province ? (school.province.startsWith('Prov.') ? school.province : `Prov. ${school.province}`) : '',
    ].filter(Boolean);

    return parts.join(', ') || 'Alamat belum dilengkapi';
  }
}

// Alias for backward compatibility
export const SchoolIdentityProvider = SchoolSearchService;
