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

export async function generateJurnal(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, atp } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // 1. Header
  const headerTitle = isBlankMode
    ? 'JURNAL HARIAN PELAKSANAAN PEMBELAJARAN (FORMAT KOSONG)'
    : 'JURNAL HARIAN PELAKSANAAN PEMBELAJARAN';
  docChildren.push(
    ...createDocumentHeader(
      headerTitle,
      `${academicSetting.curriculum} — ${academicSetting.subject} ${academicSetting.grade} TP ${academicSetting.academicYear || '2025/2026'}`
    )
  );

  // 2. Identity Metadata
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Semester', `: ${academicSetting.semester || '1 (Ganjil)'}`],
      ['Total Peserta Didik', isBlankMode ? ': .......... Siswa' : `: ${context.students?.length || 0} Siswa`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // 3. Jurnal Table Matrix
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'Matriks Catatan Jurnal Mengajar & Refleksi Pembelajaran',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    })
  );

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 4),
      createTableHeaderCell('Hari / Tanggal', 12),
      createTableHeaderCell('Jam Ke-', 6),
      createTableHeaderCell('Kode & Tujuan Pembelajaran (TP)', 26, AlignmentType.LEFT),
      createTableHeaderCell('Materi Pokok & Aktivitas Pembelajaran', 24, AlignmentType.LEFT),
      createTableHeaderCell('Kehadiran & Catatan Kelas', 14, AlignmentType.LEFT),
      createTableHeaderCell('Refleksi & Tindak Lanjut', 14, AlignmentType.LEFT),
    ],
  });

  const items = atp?.items && atp.items.length > 0 ? atp.items : [];

  const dataRows = isBlankMode
    ? Array.from({ length: 15 }, (_, idx) =>
        new TableRow({
          children: [
            createTableDataCell(`${idx + 1}`, 4, AlignmentType.CENTER),
            createTableDataCell('..../..../20...', 12, AlignmentType.CENTER),
            createTableDataCell('....', 6, AlignmentType.CENTER),
            createTableDataCell(`TP ${idx + 1}\n..................................................`, 26),
            createTableDataCell('Materi: ....................................\nAktivitas: ....................................', 24),
            createTableDataCell('Hadir: .....\nIzin: .....\nSakit: .....\nAlpa: .....', 14),
            createTableDataCell('Catatan: ....................................\nTindak lanjut: ....................................', 14),
          ],
        })
      )
    : items.map((item, idx) => {
        return new TableRow({
          children: [
            createTableDataCell(`${idx + 1}`, 4, AlignmentType.CENTER),
            createTableDataCell(`Minggu ${idx + 1}\n(....../....../202...)`, 12, AlignmentType.CENTER),
            createTableDataCell(`1 - ${item.jp || 4}`, 6, AlignmentType.CENTER),
            new TableCell({
              width: { size: 26, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `[${item.tpCode}] `, bold: true, size: 19, font: 'Arial', color: '1E3A8A' }),
                    new TextRun({ text: item.tpStatement, size: 19, font: 'Arial' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Materi: ${item.materialScope || '-'}\n`, bold: true, size: 19, font: 'Arial' }),
                    new TextRun({
                      text: `Aktivitas: Eksplorasi konsep, diskusi terbimbing, dan pengerjaan lembar kerja aktif.`,
                      size: 18,
                      font: 'Arial',
                      color: '334155',
                    }),
                  ],
                }),
              ],
            }),
            createTableDataCell('Hadir: ..... Siswa\nIzin: .....\nSakit: .....\nAlpa: .....', 14),
            createTableDataCell('Ketercapaian: 100%\nTindak Lanjut: Penguatan pada konsep kunci pertemuan berikutnya.', 14),
          ],
        });
      });

  const jurnalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...dataRows],
  });

  docChildren.push(jurnalTable);

  // 4. Signoff Block
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = isBlankMode
    ? `[Format_Kosong]_Jurnal_Mengajar_${cleanSubject}_${cleanGrade}.docx`
    : `JURNAL_MENGAJAR_${cleanSubject}_${cleanGrade}_${new Date().toISOString().slice(0, 10)}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'JURNAL',
    title: isBlankMode ? 'Jurnal Harian Pelaksanaan Pembelajaran (Format Kosong)' : 'Jurnal Harian Pelaksanaan Pembelajaran',
    fileName,
    blob,
    record: {
      id: `doc-jurnal-${Date.now()}`,
      type: 'JURNAL',
      title: isBlankMode ? 'Jurnal Harian Pelaksanaan Pembelajaran (Format Kosong)' : 'Jurnal Harian Pelaksanaan Pembelajaran',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
