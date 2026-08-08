import { XMLParser } from 'fast-xml-parser';
import type { ParsedXml, XmlFile } from './types.js';

// GX18 (KBObject-based) exports are attribute-heavy XML.
const gx18Parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
  cdataPropName: '#text',
  // Unlike GX9, GX18 rule/attribute text lives in XML attribute values (e.g.
  // `Rule Text="Parm(in:&amp;x);"`), which must be entity-decoded to be usable.
  processEntities: true,
  isArray: (name) =>
    [
      'Attribute',
      'Parameter',
      'Variable',
      'Rule',
      'Event',
      'Item',
      'Member',
      'Level',
      'Property',
    ].includes(name),
});

// GX9 (ExportFile/GXObject-based) exports are element-heavy and CDATA-heavy.
const gx9Parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseTagValue: false, // keep values as strings — avoids mangling CDATA numbers
  parseAttributeValue: false,
  trimValues: false, // preserve whitespace inside CDATA blocks
  cdataPropName: '#text',
  processEntities: false, // GeneXus variables like &SumaDetalle; are not real entities
  isArray: (name, jpath) => {
    if (
      [
        'GXObject',
        'AllowNulls',
        'LevelInfo',
        'Parm',
        'Variable',
        'Event',
        'Parameter',
      ].includes(name)
    ) {
      return true;
    }
    if (name === 'Value' && jpath.includes('OptionInfo')) return true;
    return false;
  },
});

/** Detects GeneXus 9 format by checking for an `<ExportFile>` root element. */
export function isGeneXus9Format(content: string): boolean {
  const head = content.slice(0, 500);
  return head.includes('<ExportFile>') || head.includes('<ExportFile ');
}

/**
 * Parses a single XML file/block into a JS object tree.
 * Auto-detects GX9 vs GX18 format and sanitizes the content first — GX9 web
 * layout sections can be huge and contain thousands of stray HTML entities
 * that would otherwise overwhelm the parser.
 */
export function parseOneXML(file: XmlFile, warnings: string[] = []): ParsedXml | null {
  try {
    const isGX9 = isGeneXus9Format(file.content);
    const parser = isGX9 ? gx9Parser : gx18Parser;
    const sanitized = sanitizeXML(file.content, isGX9, file.name, warnings);
    const parsed = parser.parse(sanitized) as Record<string, unknown>;
    return { fileName: file.name, parsed, isGX9 };
  } catch (e) {
    warnings.push(`Could not parse XML ${file.name}: ${(e as Error).message}`);
    return null;
  }
}

/** Parses every file, skipping (and warning about) any that fail. */
export function parseAllXMLs(files: XmlFile[], warnings: string[] = []): ParsedXml[] {
  const results: ParsedXml[] = [];
  for (const file of files) {
    const result = parseOneXML(file, warnings);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Strips GX9 sections irrelevant to code extraction (Documentation, Help,
 * form layout HTML) before parsing — they can be 60-80% of file size and are
 * full of `&nbsp;`/`&quot;` entities that break XML parsing. Web-event code
 * living inside `<Webform>`/`<HTMLForm>` is rescued first so it survives.
 */
function sanitizeXML(content: string, isGX9: boolean, fileName: string, warnings: string[]): string {
  // eslint-disable-next-line no-control-regex -- intentionally stripping control chars some GX exports contain
  let result = content.replace(/\x00/g, '').replace(/\x0b/g, ' ').replace(/\x0c/g, ' ');

  if (isGX9) {
    result = rescueEventsFromStrippedTag(result, 'Webform');
    result = rescueEventsFromStrippedTag(result, 'HTMLForm');

    const toStrip = ['Documentation', 'Help', 'HTMLForm', 'Webform', 'FormLayout'];
    let totalStripped = 0;
    for (const tag of toStrip) {
      const before = result.length;
      result = stripTagContent(result, tag);
      totalStripped += before - result.length;
    }
    if (totalStripped > 0) {
      warnings.push(
        `${fileName}: stripped ${(totalStripped / 1024).toFixed(0)}KB of layout/documentation ` +
          '(not needed for code extraction)',
      );
    }

    result = escapeRogueEntities(result);
  }

  return result;
}

/**
 * Removes every `<tagName>...</tagName>` occurrence via an indexOf loop
 * (not regex) so it scales to multi-megabyte files without engine backtracking.
 */
function stripTagContent(src: string, tagName: string): string {
  const open = `<${tagName}>`;
  const close = `</${tagName}>`;
  let result = '';
  let pos = 0;
  for (;;) {
    const start = src.indexOf(open, pos);
    if (start === -1) {
      result += src.slice(pos);
      break;
    }
    result += src.slice(pos, start);
    const end = src.indexOf(close, start);
    if (end === -1) {
      result += src.slice(pos); // unclosed — keep everything, avoid data loss
      break;
    }
    pos = end + close.length;
  }
  return result;
}

/**
 * Before a tag is stripped, pulls its nested `<Events>` block (if any) out
 * and re-emits it as a sibling `<GxFormEvents>` tag so web-panel event code
 * that lives inside `<Webform>`/`<HTMLForm>` isn't lost when that tag is stripped.
 */
function rescueEventsFromStrippedTag(src: string, tagName: string): string {
  const open = `<${tagName}>`;
  const close = `</${tagName}>`;
  const evOpen = '<Events>';
  const evClose = '</Events>';
  let result = '';
  let pos = 0;
  for (;;) {
    const start = src.indexOf(open, pos);
    if (start === -1) {
      result += src.slice(pos);
      break;
    }
    result += src.slice(pos, start);
    const end = src.indexOf(close, start);
    if (end === -1) {
      result += src.slice(pos);
      break;
    }

    const content = src.slice(start + open.length, end);
    const evStart = content.indexOf(evOpen);
    const evEnd = content.indexOf(evClose);
    if (evStart !== -1 && evEnd !== -1) {
      result += `<GxFormEvents>${content.slice(evStart + evOpen.length, evEnd)}</GxFormEvents>`;
    }

    result += src.slice(start, end + close.length); // keep original tag; stripped in the next pass
    pos = end + close.length;
  }
  return result;
}

/**
 * Replaces non-standard XML entity references (GeneXus variables like
 * `&SumaDetalle;` that leaked outside CDATA) with their literal text.
 * Standard entities (`&amp; &lt; &gt; &quot; &apos;`) are left untouched.
 */
function escapeRogueEntities(content: string): string {
  const STANDARD_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
  return content.replace(/&([a-zA-Z][a-zA-Z0-9_]*);/g, (match, name: string) =>
    STANDARD_ENTITIES.has(name.toLowerCase()) ? match : name,
  );
}

/** Safe deep getter — returns undefined instead of throwing on a missing/non-object path. */
export function safeGet(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Normalizes a value that fast-xml-parser may return as a single item or an array. */
export function ensureArray<T>(val: T | T[] | null | undefined): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}
