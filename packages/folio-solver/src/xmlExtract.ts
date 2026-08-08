import type {
  ExtractedAttribute,
  ExtractedEvent,
  ExtractedMember,
  ExtractedObjectCode,
  ExtractedParameter,
  ExtractedVariable,
} from './types.js';

/**
 * Pulls structured fields out of Claude's raw generated XML WITHOUT trusting
 * its element structure. Claude occasionally produces malformed tags (e.g.
 * `<Report>...</WebPanel>`) or nests a whole extra `<ExportFile>`/`<KBObject>`
 * wrapper inside a CDATA block. Rather than parsing that XML as XML, this
 * extracts only CDATA bodies and leaf-attribute values via regex, and
 * {@link buildTransactionXml}/friends in `xmlBuilder.ts` reconstruct guaranteed-valid
 * XML from the extracted parts. This two-step approach is what made
 * folio-solver's generated .xpz files reliably importable in testing.
 */
export function extractObjectCode(xml: string): ExtractedObjectCode {
  const result: ExtractedObjectCode = {
    source: '',
    rules: '',
    attributes: [],
    parameters: [],
    variables: [],
    members: [],
    events: [],
  };
  if (!xml) return result;

  result.source = extractMainSource(xml);
  result.rules = extractRules(xml);
  result.attributes = extractAttributes(xml);
  result.parameters = extractParameters(xml);
  result.variables = extractVariables(xml);
  result.members = extractMembers(xml);
  result.events = extractEvents(xml);

  return result;
}

function isXmlWrapper(s: string): boolean {
  return s.startsWith('<?xml') || s.startsWith('<ExportFile') || s.startsWith('<KBObject') || s.startsWith('<GXObject');
}

/**
 * The real GeneXus source code, if Claude emitted one CDATA block containing
 * it directly. If Claude nested a full XML document inside the CDATA
 * (occasionally happens), digs for the innermost CDATA instead of using the
 * XML-wrapper text verbatim.
 */
function extractMainSource(xml: string): string {
  const allCdataBlocks = [...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]!.trim());

  const byLengthDesc = [...allCdataBlocks].sort((a, b) => b.length - a.length);
  for (const block of byLengthDesc) {
    if (!block || block.length < 5) continue;
    if (!isXmlWrapper(block)) return block;
    const inner = extractInnerCdata(block);
    if (inner) return inner;
  }

  const plain = xml.match(/<Source[^>]*>([\s\S]*?)<\/Source>/i);
  if (plain) {
    const rawContent = plain[1]!.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (!isXmlWrapper(rawContent)) return rawContent;
  }

  return '';
}

function extractInnerCdata(cdataContent: string): string | null {
  const innerIdx = cdataContent.lastIndexOf('<![CDATA[');
  if (innerIdx < 0) return null;
  const afterInner = cdataContent.slice(innerIdx + '<![CDATA['.length);
  const endIdx = afterInner.indexOf(']]>');
  const code = (endIdx >= 0 ? afterInner.slice(0, endIdx) : afterInner).trim();
  return code.length > 5 && !isXmlWrapper(code) ? code : null;
}

function extractRules(xml: string): string {
  const cdataRules = xml.match(/<Rules[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/Rules>/i);
  if (cdataRules) return cdataRules[1]!.trim();

  const ruleTexts = [...xml.matchAll(/<Rule[^>]*\sText="([^"]+)"/gi)].map((m) => m[1]!);
  return ruleTexts.join('\n');
}

function attrGetter(attrsText: string): (key: string) => string {
  return (key: string) => (attrsText.match(new RegExp(`${key}="([^"]*)"`, 'i')) ?? [])[1] ?? '';
}

function extractAttributes(xml: string): ExtractedAttribute[] {
  return [...xml.matchAll(/<Attribute\s([^>]*?)\/?>/gi)].map((m) => {
    const get = attrGetter(m[1]!);
    return {
      name: get('Name'),
      type: get('Type'),
      length: get('Length'),
      isPK: /IsPK="true"/i.test(m[1]!),
      description: get('Description'),
    };
  });
}

function extractParameters(xml: string): ExtractedParameter[] {
  return [...xml.matchAll(/<Parameter\s([^>]*?)\/?>/gi)].map((m) => {
    const get = attrGetter(m[1]!);
    return { name: get('Name'), type: get('Type'), mode: get('Mode') || 'In', length: get('Length') };
  });
}

function extractVariables(xml: string): ExtractedVariable[] {
  return [...xml.matchAll(/<Variable\s([^>]*?)\/?>/gi)].map((m) => {
    const get = attrGetter(m[1]!);
    return {
      name: get('Name'),
      type: get('Type'),
      length: get('Length'),
      dec: get('Dec'),
      isCollection: /IsCollection="true"/i.test(m[1]!),
    };
  });
}

function extractMembers(xml: string): ExtractedMember[] {
  return [...xml.matchAll(/<Member\s([^>]*?)\/?>/gi)].map((m) => {
    const get = attrGetter(m[1]!);
    return {
      name: get('Name'),
      type: get('Type'),
      length: get('Length'),
      isCollection: /IsCollection="true"/i.test(m[1]!),
    };
  });
}

function extractEvents(xml: string): ExtractedEvent[] {
  return [...xml.matchAll(/<Event\s+Name="([^"]+)"[^>]*>([\s\S]*?)<\/Event>/gi)].map((m) => {
    const body = m[2]!;
    const cdata = body.match(/<Source[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/Source>/i);
    const plain = body.match(/<Source[^>]*>([\s\S]*?)<\/Source>/i);
    return {
      name: m[1]!,
      source: cdata ? cdata[1]!.trim() : plain ? plain[1]!.trim() : '',
    };
  });
}
