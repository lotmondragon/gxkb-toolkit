import AdmZip from 'adm-zip';
import type { XmlFile } from './types.js';

const LARGE_FILE_WARNING_BYTES = 20 * 1024 * 1024;

/**
 * Unzips a .xpz buffer and returns every entry as a decoded XML string.
 * Detects each entry's declared XML encoding (`iso-8859-1` / `windows-1252`
 * export as `latin1`) and re-decodes to a plain JS string accordingly.
 */
export function extractXPZ(buffer: Buffer, warnings: string[] = []): XmlFile[] {
  if (buffer.length > LARGE_FILE_WARNING_BYTES) {
    warnings.push(
      `Large .xpz detected (${(buffer.length / 1024 / 1024).toFixed(0)} MB) — ` +
        'extraction is in-memory and may take a moment.',
    );
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (e) {
    throw new Error(`Failed to open .xpz as a ZIP archive: ${(e as Error).message}`);
  }

  const xmlFiles: XmlFile[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    try {
      const raw = entry.getData();
      const content = decodeXmlBuffer(raw, entry.entryName, warnings);
      xmlFiles.push({ name: entry.entryName, content });
    } catch (e) {
      warnings.push(`Could not read ${entry.entryName}: ${(e as Error).message}`);
    }
  }

  if (xmlFiles.length === 0) {
    throw new Error('No files found inside the .xpz — is this a valid GeneXus export?');
  }
  return xmlFiles;
}

function decodeXmlBuffer(rawBuffer: Buffer, name: string, warnings: string[]): string {
  const peek = rawBuffer.subarray(0, 200).toString('latin1');
  const match = peek.match(/encoding\s*=\s*['"]([^'"]+)['"]/i);
  const declared = match ? match[1]!.toLowerCase() : 'utf-8';
  const nodeEncoding: BufferEncoding =
    declared.includes('8859') || declared.includes('1252') ? 'latin1' : 'utf-8';
  if (nodeEncoding === 'latin1') {
    warnings.push(`${name}: iso-8859-1 encoding detected — converted to UTF-8`);
  }
  return rawBuffer.toString(nodeEncoding);
}
