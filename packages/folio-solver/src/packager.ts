import AdmZip from 'adm-zip';
import type { KbFormat } from 'xpz-extract';
import { buildGX9ExportFile, sanitizeName } from './xmlBuilder.js';
import type { GeneratedObject } from './types.js';

/**
 * Packages generated objects into a .xpz buffer, matching the real GeneXus
 * import envelope for each format: GX9 is one `<ExportFile>` XML containing
 * every object; GX18 is one `<KBObject>` XML file per object.
 */
export function packageXpz(objects: GeneratedObject[], kbFormat: KbFormat, folioId = 'folio'): Buffer {
  const zip = new AdmZip();
  const safeId = sanitizeName(folioId);

  if (kbFormat === 'gx9') {
    const xmlContent = buildGX9ExportFile(objects, folioId);
    zip.addFile(`${safeId}_1.xml`, Buffer.from(xmlContent, 'utf-8'));
  } else {
    const usedNames = new Set<string>();
    for (const obj of objects) {
      const safeName = sanitizeName(obj.name);
      if (usedNames.has(safeName)) continue;
      usedNames.add(safeName);
      zip.addFile(`${safeName}.xml`, Buffer.from(obj.xml, 'utf-8'));
    }
  }

  return zip.toBuffer();
}
