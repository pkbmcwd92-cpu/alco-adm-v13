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

export async function generateATP(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, atp, cp } = context;

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  docChildren.push(...createDocumentHeader('ALUR TUJUAN PEMBELAJARAN (ATP)', academicSetting.curriculum));

  // Metadata Table
  docChildren.push(createIdentityMetadataTable(school, profile, academicSetting));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Rasionalisasi Alur Pembelajaran
  if (atp.rationale) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: 'A. Rasionalisasi Alur Pembelajaran',
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: atp.rationale,
            size: 20,
            font: 'Arial',
          }),
        ],
      })
    );
  }

  // CP Ringkas
  if (cp?.generalDescription) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 100, after: 60 },
        children: [
          new TextRun({
            text: 'B. Capaian Pembelajaran Rujukan',
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: cp.generalDescription,
            size: 19,
            font: 'Arial',
            italics: true,
          }),
        ],
      })
    );
  }

  // ATP Matrix Section Title
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'C. Matriks Alur Tujuan Pembelajaran',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    })
  );

  // Table Headers
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 6),
      createTableHeaderCell('Tujuan Pembelajaran (TP)', 28, AlignmentType.LEFT),
      createTableHeaderCell('Lingkup Materi', 20, AlignmentType.LEFT),
      createTableHeaderCell('Alokasi JP', 10),
      createTableHeaderCell('Profil Pelajar Pancasila', 18, AlignmentType.LEFT),
      createTableHeaderCell('Rencana Asesmen & Glosarium', 18, AlignmentType.LEFT),
    ],
  });

  // Table Data Rows
  const tableDataRows = (atp?.items || []).map((item, index) => {
    const p3List = item.p3Dimensions && item.p3Dimensions.length > 0 ? item.p3Dimensions.join(', ') : '-';
    const assessAndGloss = [
      item.assessmentPlan ? `Asesmen: ${item.assessmentPlan}` : '',
      item.glossary ? `Glosarium: ${item.glossary}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return new TableRow({
      children: [
        createTableDataCell(`${item.stepNumber || index + 1}`, 6, AlignmentType.CENTER),
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `[${item.tpCode || 'TP'}] `, bold: true, size: 19, font: 'Arial', color: '1E3A8A' }),
                new TextRun({ text: item.tpStatement || '', size: 19, font: 'Arial' }),
              ],
            }),
          ],
        }),
        createTableDataCell(item.materialScope || '-', 20),
        createTableDataCell(`${item.jp || 0} JP`, 10, AlignmentType.CENTER, true),
        createTableDataCell(p3List, 18),
        createTableDataCell(assessAndGloss || '-', 18),
      ],
    });
  });

  // Total JP Row
  const totalJP = (atp?.items || []).reduce((acc, curr) => acc + (Number(curr.jp) || 0), 0);
  const totalRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 54, type: WidthType.PERCENTAGE },
        columnSpan: 3,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: 'TOTAL ALOKASI WAKTU SEMESTER: ',
                bold: true,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
        ],
      }),
      createTableDataCell(`${totalJP} JP`, 10, AlignmentType.CENTER, true),
      new TableCell({
        width: { size: 36, type: WidthType.PERCENTAGE },
        columnSpan: 2,
        children: [new Paragraph({})],
      }),
    ],
  });

  const atpTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows, totalRow],
  });

  docChildren.push(atpTable);

  // Sign-off
  docChildren.push(...createSignoffBlock(school, profile));

  // Build Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
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
  const fileName = `ATP_${cleanSubject}_${cleanGrade}_${new Date().toISOString().slice(0, 10)}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'ATP',
    title: 'Alur Tujuan Pembelajaran (ATP)',
    fileName,
    blob,
    record: {
      id: `doc-atp-${Date.now()}`,
      type: 'ATP',
      title: 'Alur Tujuan Pembelajaran (ATP)',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
