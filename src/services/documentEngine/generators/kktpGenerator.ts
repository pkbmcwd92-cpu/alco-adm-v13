import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  AlignmentType,
  WidthType,
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createTableHeaderCell,
  createTableDataCell,
  createSignoffBlock,
  createProseParagraph,
  createDocxSectionProperties,
} from '../docxStyles';

export async function generateKKTP(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, tp, assessmentCriteria } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  const headerTitle = isBlankMode
    ? 'KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP) (FORMAT KOSONG)'
    : 'KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)';
  docChildren.push(...createDocumentHeader(headerTitle, academicSetting.curriculum));

  // Metadata Table
  const tpList = tp?.items || [];
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Jumlah Tujuan Pembelajaran', isBlankMode ? ': .......... TP' : `: ${tpList.length} TP`],
      ['Pendekatan KKTP', `: Rubrik / Skala Interval Nilai & Deskripsi Kriteria`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Explanatory note
  docChildren.push(
    createProseParagraph(
      'Panduan Penentuan Ketercapaian: Guru menetapkan kriteria ketercapaian per Tujuan Pembelajaran (TP) untuk memetakan perkembangan kompetensi siswa, mendiagnosis kebutuhan intervensi remedial, dan memberikan materi pengayaan.',
      { firstLineIndent: false, italics: true }
    )
  );

  // Matriks KKTP
  const criteriaList = assessmentCriteria || [];
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6, AlignmentType.CENTER),
        createTableHeaderCell('Kode TP', 12, AlignmentType.CENTER),
        createTableHeaderCell('Tujuan Pembelajaran (TP)', 32, AlignmentType.LEFT),
        createTableHeaderCell('Indikator Ketercapaian & Kriteria', 50, AlignmentType.LEFT),
      ],
    }),
  ];

  if (isBlankMode) {
    for (let i = 0; i < 8; i++) {
      rows.push(
        new TableRow({
          children: [
            createTableDataCell((i + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell(`TP.${i + 1}`, 12, AlignmentType.CENTER),
            createTableDataCell('..........................................................................................', 32),
            createTableDataCell(
              '1. .....................................................................................\n' +
              '2. .....................................................................................\n' +
              '3. Interval Ketercapaian: ..............................................................',
              50
            ),
          ],
        })
      );
    }
  } else if (tpList.length === 0) {
    throw new Error('Data Tujuan Pembelajaran (TP) belum tersedia. Silakan susun TP terlebih dahulu sebelum mengekspor KKTP.');
  } else {
    tpList.forEach((item, index) => {
      const matched = criteriaList.find((c) => c.tpId === item.id);
      let criteriaText = '';

      if (matched && matched.levels && matched.levels.length > 0) {
        criteriaText = matched.levels
          .map((lvl) => `• [${lvl.label}${lvl.scoreRange ? ` (${lvl.scoreRange})` : ''}]: ${lvl.description}`)
          .join('\n');
      } else if (matched && matched.indicators && matched.indicators.length > 0) {
        criteriaText = matched.indicators.map((ind, i) => `${i + 1}. ${ind}`).join('\n');
      } else {
        criteriaText = matched?.description || '-';
      }

      rows.push(
        new TableRow({
          children: [
            createTableDataCell((index + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell(item.code || '-', 12, AlignmentType.CENTER),
            createTableDataCell(`${item.statement || '-'}\n(Materi: ${item.contentScope || '-'})`, 32),
            createTableDataCell(criteriaText, 50),
          ],
        })
      );
    });
  }

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  docChildren.push(new Paragraph({ spacing: { after: 220 } }));

  // Signatures
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode, context.documentDate));

  // Build Document (Portrait A4)
  const doc = new Document({
    sections: [
      {
        properties: createDocxSectionProperties('portrait'),
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const safeGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = isBlankMode
    ? `[Format_Kosong]_KKTP_${safeSubject}_${safeGrade}.docx`
    : `KKTP_${safeSubject}_${safeGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'KKTP',
    title: isBlankMode
      ? `KKTP (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
      : `KKTP - ${academicSetting.subject} ${academicSetting.grade}`,
    fileName,
    blob,
    record: {
      id: `doc-kktp-${Date.now()}`,
      type: 'KKTP',
      title: isBlankMode
        ? `KKTP (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
        : `KKTP - ${academicSetting.subject} ${academicSetting.grade}`,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
