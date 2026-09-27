import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Extracts plain text from a PDF Uint8Array or ArrayBuffer.
 * Hard bounded to max 50,000 characters and max 30 pages.
 * Fails closed to empty string on corrupted or unparseable input.
 */
export async function extractTextFromPdfBuffer(
  buffer: Uint8Array | ArrayBuffer
): Promise<string> {
  if (!buffer) return '';
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (uint8.byteLength === 0) return '';

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdf = await loadingTask.promise;
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 30);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        .filter((it: any) => typeof it?.str === 'string')
        .map((it: any) => it.str);
      fullText += strings.join(' ') + '\n';
      if (fullText.length >= 50000) {
        break;
      }
    }
    return fullText.trim().slice(0, 50000);
  } catch {
    return '';
  }
}
