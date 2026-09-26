import { ActiveContext, CPSource, CPElem, CPVerificationStatus, normalizeCPVerificationStatus } from '../types';
import { CP_PRESETS, CPSamplePreset } from '../data/curriculumDefaults';

export interface CPSourceSearchResult {
  id: string;
  subject: string;
  level: string;
  grade: string;
  phase: string;
  curriculum: string;
  title: string;
  institution: string;
  documentYear: string;
  url?: string;
  page?: string;
  verificationStatus: CPVerificationStatus;
  generalDescription: string;
  elements: CPElem[];
  sourceMeta: CPSource;
  confidenceScore: number;
}

/**
 * Official CP Source Repository & Registry
 * Prioritizes official government publications (Kemendikdasmen, BSKAP, Ruang GTK).
 * Fallbacks are transparently labeled as local_reference.
 */
class CPSourceRepository {
  private registry: CPSamplePreset[] = [...CP_PRESETS];

  /**
   * Search available CP entries by ActiveContext
   */
  public search(context: Partial<ActiveContext>): CPSourceSearchResult[] {
    const targetSubject = (context.subject || '').trim().toLowerCase();
    const targetLevel = (context.level || '').trim().toLowerCase();
    const targetPhase = (context.phase || '').trim().toLowerCase();
    const targetGrade = (context.grade || '').trim().toLowerCase();

    return this.registry
      .map((item, index) => {
        let score = 0;
        const itemSubject = item.subject.toLowerCase();
        const itemPhase = item.phase.toLowerCase();
        const itemLevel = item.level.toLowerCase();

        // Exact or fuzzy subject match
        if (itemSubject === targetSubject) {
          score += 50;
        } else if (
          (targetSubject.includes('pjok') || targetSubject.includes('jasmani')) &&
          itemSubject.includes('pjok')
        ) {
          score += 45;
        } else if (
          targetSubject.includes('bahasa indonesia') &&
          itemSubject.includes('bahasa indonesia')
        ) {
          score += 45;
        } else if (
          targetSubject.includes('ipas') &&
          itemSubject.includes('ipas')
        ) {
          score += 45;
        } else if (
          targetSubject.includes('matematika') &&
          itemSubject.includes('matematika')
        ) {
          score += 45;
        } else if (
          targetSubject.includes('pancasila') &&
          itemSubject.includes('pancasila')
        ) {
          score += 45;
        } else if (itemSubject.includes(targetSubject) || targetSubject.includes(itemSubject)) {
          score += 30;
        }

        // Phase match
        if (targetPhase && itemPhase === targetPhase) {
          score += 30;
        }

        // Level match
        if (targetLevel && itemLevel === targetLevel) {
          score += 20;
        }

        return {
          id: `src-${index + 1}`,
          subject: item.subject,
          level: item.level,
          grade: item.grade,
          phase: item.phase,
          curriculum: 'Kurikulum Merdeka',
          title: item.sourceInfo.title,
          institution: item.sourceInfo.institution,
          documentYear: item.sourceInfo.documentYear || '2024/2025',
          url: item.sourceInfo.url,
          page: item.sourceInfo.page,
          verificationStatus: normalizeCPVerificationStatus(item.sourceInfo.verificationStatus),
          generalDescription: item.generalDescription,
          elements: item.elements.map((el, elIdx) => ({
            id: `elem-${index + 1}-${elIdx + 1}`,
            name: el.name,
            content: el.content,
          })),
          sourceMeta: item.sourceInfo,
          confidenceScore: score,
        };
      })
      .filter((r) => r.confidenceScore > 20)
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Returns default fallback reference if no exact match is found
   */
  public getLocalReferenceFallback(context: Partial<ActiveContext>): CPSourceSearchResult {
    const defaultPhase = context.phase || 'Fase A';
    const defaultSubject = context.subject || 'Mata Pelajaran';
    const defaultGrade = context.grade || 'Kelas 1';

    return {
      id: 'fallback-local',
      subject: defaultSubject,
      level: context.level || 'SD',
      grade: defaultGrade,
      phase: defaultPhase,
      curriculum: context.curriculum || 'Kurikulum Merdeka',
      title: `Draft Dokumen Referensi Lokal - ${defaultSubject} (${defaultPhase})`,
      institution: 'Penyusunan Mandiri Guru (Lokal)',
      documentYear: new Date().getFullYear().toString(),
      url: 'https://kurikulum.kemdikbud.go.id/',
      page: `${defaultPhase} / ${defaultGrade}`,
      verificationStatus: 'LOCAL_REFERENCE',
      generalDescription: `Pada akhir ${defaultPhase}, peserta didik menguasai kompetensi dasar ${defaultSubject} sesuai tahapan perkembangan belajar pada ${defaultGrade}.`,
      elements: [
        {
          id: 'elem-fallback-1',
          name: 'Pemahaman Konsep & Keterampilan',
          content: `Peserta didik mampu memahami konsep esensial dan mempraktikkan keterampilan utama ${defaultSubject} secara bertahap.`,
        },
      ],
      sourceMeta: {
        title: `Draft Referensi Lokal - ${defaultSubject} (${defaultPhase})`,
        institution: 'Penyusunan Mandiri Guru (Lokal)',
        documentYear: new Date().getFullYear().toString(),
        url: 'https://kurikulum.kemdikbud.go.id/',
        page: `${defaultPhase} / ${defaultGrade}`,
        retrievedAt: new Date().toISOString(),
        verificationStatus: 'LOCAL_REFERENCE',
      },
      confidenceScore: 10,
    };
  }
}

export const cpSourceRepository = new CPSourceRepository();
