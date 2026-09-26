import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
  HeadingLevel,
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createTableHeaderCell,
  createTableDataCell,
  createSignoffBlock,
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
    new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: 'Panduan Penentuan Ketercapaian: Guru menetapkan kriteria ketercapaian per Tujuan Pembelajaran (TP) untuk memetakan perkembangan kompetensi siswa, mendiagnosis kebutuhan intervensi remedial, dan memberikan materi pengayaan.',
          italics: true,
          size: 20,
          font: 'Arial',
          color: '475569',
        }),
      ],
    })
  );

  // Matriks KKTP
  const criteriaList = assessmentCriteria || [];
  const rows: TableRow[] = [
    new TableRow({
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
    rows.push(
      new TableRow({
        children: [
          createTableDataCell('1', 6, AlignmentType.CENTER),
          createTableDataCell('TP.1', 12, AlignmentType.CENTER),
          createTableDataCell('Tujuan Pembelajaran Semester Aktif', 32),
          createTableDataCell(
            '• Siswa mampu memahami konsep dasar dan menerapkan prosedur secara mandiri.\n• Kriteria: Minimal mencapai interval 75 (Kategori Baik).',
            50
          ),
        ],
      })
    );
  } else {
    tpList.forEach((item, index) => {
      const matched = criteriaList.find((c) => c.tpId === item.id);
      let criteriaText = '';

      if (matched && matched.levels && matched.levels.length > 0) {
        criteriaText = matched.levels
          .map((lvl) => `• [${lvl.label} (${lvl.scoreRange || lvl.level})]: ${lvl.description}`)
          .join('\n');
      } else if (matched && matched.indicators && matched.indicators.length > 0) {
        criteriaText = matched.indicators.map((ind, i) => `${i + 1}. ${ind}`).join('\n');
      } else {
        criteriaText =
          `1. Mampu mengidentifikasi dan mendeskripsikan ruang lingkup kompetensi.\n` +
          `2. Mampu mempraktikkan keterampilan inti secara runtut dan tepat.\n` +
          `3. Batas Ketuntasan: Interval nilai ≥ 75 (Tercapai).`;
      }

      rows.push(
        new TableRow({
          children: [
            createTableDataCell((index + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell(item.code || `TP.${index + 1}`, 12, AlignmentType.CENTER),
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
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
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
