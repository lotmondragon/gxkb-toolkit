import { ensureArray } from './xmlParser.js';
import { emptyClassified } from './types.js';
import type {
  ClassifiedObjects,
  GxAttribute,
  GxEvent,
  GxObject,
  GxObjectType,
  GxParameter,
  GxRule,
  ParsedXml,
} from './types.js';

// GX18 numeric/string object type codes → normalized type.
const GX18_TYPE_MAP: Record<string, GxObjectType> = {
  '0': 'Transaction',
  '1': 'Procedure',
  '2': 'WebPanel',
  '3': 'Report',
  '4': 'WorkPanel',
  '5': 'Table',
  '7': 'Domain',
  '8': 'SDT',
  '9': 'DataProvider',
  '10': 'BusinessComponent',
  '11': 'ExternalObject',
  '12': 'WebService',
  '15': 'Module',
  Transaction: 'Transaction',
  Procedure: 'Procedure',
  WebPanel: 'WebPanel',
  Panel: 'WebPanel',
  Report: 'Report',
  WorkPanel: 'WorkPanel',
  Table: 'Table',
  Domain: 'Domain',
  SDT: 'SDT',
  StructuredDataType: 'SDT',
  StructureDataType: 'SDT',
  DataProvider: 'DataProvider',
  BusinessComponent: 'BusinessComponent',
  ExternalObject: 'ExternalObject',
  WebService: 'WebService',
  Module: 'Module',
};

// GX9 element name → normalized type. 'Folder'-like entries are skipped entirely.
const GX9_TYPE_MAP: Record<string, GxObjectType | 'Folder'> = {
  Transaction: 'Transaction',
  Procedure: 'Procedure',
  WebPanel: 'WebPanel',
  WorkPanel: 'WorkPanel',
  Report: 'Report',
  StructureDataType: 'SDT',
  DataProvider: 'DataProvider',
  ExternalObject: 'ExternalObject',
  WebService: 'WebService',
  Table: 'Table',
  Domain: 'Domain',
  Folder: 'Folder',
  Menubar: 'Folder',
  Language: 'Folder',
  Theme: 'Folder',
  Pattern: 'Folder',
  Image: 'Folder',
  StyleSheet: 'Folder',
  UserControl: 'ExternalObject',
};

let idCounter = 0;

/**
 * Classifies every parsed XML file/block into typed buckets (Transaction,
 * Procedure, WebPanel, ...), normalizing GX9 and GX18 shapes into one
 * {@link GxObject} shape per object.
 */
export function classifyObjects(parsedFiles: ParsedXml[], warnings: string[] = []): ClassifiedObjects {
  const classified = emptyClassified();
  const attrCatalog = new Map<string, { type: string; domain: string; length: number | null; decimals: number | null }>();

  for (const file of parsedFiles) {
    try {
      dispatchParsed(file, classified, attrCatalog, warnings);
    } catch (e) {
      warnings.push(`Error classifying ${file.fileName}: ${(e as Error).message}`);
    }
  }

  enrichFromAttributeCatalog(classified, attrCatalog);
  return classified;
}

function dispatchParsed(
  file: ParsedXml,
  classified: ClassifiedObjects,
  attrCatalog: Map<string, { type: string; domain: string; length: number | null; decimals: number | null }>,
  warnings: string[],
): void {
  const { parsed, fileName } = file;

  if (parsed.ExportFile) {
    parseGX9ExportFile(parsed.ExportFile as Record<string, unknown>, fileName, classified, attrCatalog, warnings);
    return;
  }
  if (parsed.KBObject) {
    parseGX18KBObject(parsed.KBObject as Record<string, unknown>, fileName, classified, warnings);
    return;
  }

  warnings.push(`${fileName}: unrecognized XML root — skipped`);
}

// ═══════════════════════════════════════════════════════════════════════
// GX9 — <ExportFile><GXObject>...
// ═══════════════════════════════════════════════════════════════════════

function parseGX9ExportFile(
  exportFile: Record<string, unknown>,
  fileName: string,
  classified: ClassifiedObjects,
  attrCatalog: Map<string, { type: string; domain: string; length: number | null; decimals: number | null }>,
  warnings: string[],
): void {
  const gxObjects = ensureArray(exportFile.GXObject as Record<string, unknown> | Record<string, unknown>[]);
  for (const gxObj of gxObjects) {
    try {
      parseGX9Object(gxObj, fileName, classified, warnings);
    } catch (e) {
      warnings.push(`GX9 parse error in ${fileName}: ${(e as Error).message}`);
    }
  }

  for (const attSection of ensureArray(exportFile.Attributes as Record<string, unknown> | Record<string, unknown>[])) {
    if (!attSection || typeof attSection !== 'object') continue;
    collectGX9AttributeCatalog(attSection as Record<string, unknown>, attrCatalog);
  }
}

function parseGX9Object(
  gxObj: Record<string, unknown>,
  fileName: string,
  classified: ClassifiedObjects,
  warnings: string[],
): void {
  const typeKey = Object.keys(gxObj).find((k) => GX9_TYPE_MAP[k]);
  if (!typeKey) return;

  const normalizedType = GX9_TYPE_MAP[typeKey];
  if (!normalizedType || normalizedType === 'Folder') return;

  const raw = gxObj[typeKey] as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') return;

  const info = raw.Info as Record<string, unknown> | undefined;
  const name = String(info?.Name ?? info?.name ?? extractNameFromFile(fileName)).trim();
  const description = String(info?.Description ?? info?.description ?? '').trim();

  const obj: GxObject = {
    id: generateId(name, normalizedType),
    name,
    type: normalizedType,
    rawType: typeKey,
    description,
    fileName,
    attributes: [],
    parameters: [],
    rules: [],
    events: [],
    variables: [],
    members: [],
    calls: [],
    source: '',
  };

  switch (typeKey) {
    case 'Transaction':
      parseGX9Transaction(raw, obj);
      break;
    case 'Procedure':
    case 'Report':
      parseGX9ProcedureOrReport(raw, obj);
      break;
    case 'WebPanel':
    case 'WorkPanel':
      parseGX9WebPanel(raw, obj);
      break;
    case 'StructureDataType':
      parseGX9SDT(raw, obj);
      break;
    case 'Table':
      parseGX9Table(raw, obj);
      break;
    case 'DataProvider':
      parseGX9DataProvider(raw, obj);
      break;
    default:
      if (raw.Rules) obj.rules = parseGX9RulesText(extractCDATA(raw.Rules));
      if (raw.Source) obj.source = extractCDATA(raw.Source);
  }

  pushToClassified(obj, classified, warnings);
}

function parseGX9Transaction(raw: Record<string, unknown>, obj: GxObject): void {
  const structure = raw.Structure as Record<string, unknown> | undefined;
  const structureCDATA = extractCDATA(structure?.Source);
  if (structureCDATA) {
    obj.attributes = parseGX9StructureCDATA(structureCDATA);
  }

  const allowNulls = ensureArray(structure?.AllowNulls as Record<string, unknown> | Record<string, unknown>[]);
  const nullMap = new Map<string, unknown>();
  for (const an of allowNulls) {
    const attrName = an.Name ?? an.name;
    if (attrName) nullMap.set(String(attrName).trim(), an.Value ?? an.value);
  }
  for (const attr of obj.attributes) {
    if (nullMap.has(attr.name)) {
      const v = nullMap.get(attr.name);
      attr.nullable = v !== 'No' && v !== 'NO';
    }
  }

  if (raw.Rules) {
    const rulesText = extractCDATA(raw.Rules);
    obj.rules = parseGX9RulesText(rulesText);
    obj.calls = extractCallsFromText(rulesText);
  }

  const formEventsText = extractCDATA((raw.Form as Record<string, unknown> | undefined)?.Events) || extractCDATA(raw.GxFormEvents) || extractCDATA(raw.Events);
  if (formEventsText.trim()) {
    obj.events = parseGX9EventsText(formEventsText);
  }
}

function parseGX9StructureCDATA(text: string): GxAttribute[] {
  const attrs: GxAttribute[] = [];
  const lines = text.split(/\r?\n/);
  let currentLevel = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    let content = trimmed;
    let opens = 0;
    while (content.startsWith('(')) {
      opens++;
      content = content.slice(1).trim();
    }
    currentLevel += opens;

    let closes = 0;
    let safeContent = content;
    while (safeContent.endsWith(')')) {
      const openCnt = (safeContent.match(/\(/g) ?? []).length;
      const closeCnt = (safeContent.match(/\)/g) ?? []).length;
      if (closeCnt > openCnt) {
        closes++;
        safeContent = safeContent.slice(0, -1).trim();
      } else {
        break; // balanced parens — part of a formula expression, not a level-close marker
      }
    }
    content = safeContent;

    if (!content) {
      currentLevel = Math.max(0, currentLevel - closes);
      continue;
    }

    let formula = '';
    let attrName = content;
    const eqIdx = content.indexOf('=');
    if (eqIdx !== -1) {
      const lhs = content.slice(0, eqIdx).trim();
      if (/^[A-Za-z][A-Za-z0-9_]*\*?$/.test(lhs)) {
        formula = content.slice(eqIdx + 1).trim();
        attrName = lhs;
      }
    }

    const isPK = attrName.endsWith('*');
    if (isPK) attrName = attrName.slice(0, -1).trim();

    if (attrName) {
      const level = currentLevel > 0 ? `Level${currentLevel}` : 'Root';
      attrs.push({
        name: attrName,
        type: '',
        isPK,
        isFK: false,
        nullable: !isPK, // overridden below by <AllowNulls> when present
        description: '',
        domain: '',
        length: null,
        decimals: null,
        level,
        levelTable: level,
        formula,
        hasFormula: !!formula,
      });
    }

    currentLevel = Math.max(0, currentLevel - closes);
  }

  return attrs;
}

function parseGX9ProcedureOrReport(raw: Record<string, unknown>, obj: GxObject): void {
  const layoutSource = extractCodeBlocksFromLayout(raw.Layout as Record<string, unknown> | undefined);
  if (layoutSource) {
    obj.source = layoutSource;
    obj.calls = extractCallsFromText(layoutSource);
  }

  // Parm() always lives in <Rules> (never in <Source>) in real GeneXus exports.
  if (raw.Rules) {
    const rulesText = extractCDATA(raw.Rules);
    obj.rules = parseGX9RulesText(rulesText);
    obj.parameters = extractParmDeclaration(rulesText);
  }
}

function extractCodeBlocksFromLayout(layout: Record<string, unknown> | undefined): string {
  if (!layout) return '';
  const parts: string[] = [];
  for (const block of ensureArray(layout.Block as Record<string, unknown> | Record<string, unknown>[])) {
    for (const cb of ensureArray(block.CodeBlock as Record<string, unknown> | Record<string, unknown>[])) {
      const src = extractCDATA(cb.Source).trim();
      if (src.length > 5) parts.push(src);
    }
    if (block.Block) {
      const nested = extractCodeBlocksFromLayout({ Block: block.Block });
      if (nested) parts.push(nested);
    }
  }
  return parts.join('\n\n').trim();
}

function parseGX9WebPanel(raw: Record<string, unknown>, obj: GxObject): void {
  const variablesNode = raw.Variables as Record<string, unknown> | undefined;
  obj.variables = ensureArray(variablesNode?.Variable as Record<string, unknown> | Record<string, unknown>[]).map((v) => ({
    name: String(v.Name ?? ''),
    type: String(v.Type ?? v.BaseType ?? ''),
    baseType: String(v.BaseType ?? ''),
  }));

  if (raw.Rules) {
    const rulesText = extractCDATA(raw.Rules);
    obj.rules = parseGX9RulesText(rulesText);
    obj.calls = extractCallsFromText(rulesText);
  }

  const eventsText = extractCDATA(raw.Events) || extractCDATA(raw.GxFormEvents);
  if (eventsText.trim()) {
    obj.events = parseGX9EventsText(eventsText);
    for (const ev of obj.events) {
      for (const c of extractCallsFromText(ev.source)) {
        if (!obj.calls.includes(c)) obj.calls.push(c);
      }
    }
  }
}

/**
 * SDT members are nested `<CGxExpandPropertyDef>` blocks. A stack-based scan
 * (rather than a nested-tag regex) captures only depth-1 blocks — those are
 * the actual SDT members; deeper blocks are per-member metadata (Length, Collection, ...).
 */
function parseGX9SDT(raw: Record<string, unknown>, obj: GxObject): void {
  const sdtXmlNode = raw.SDTXml as Record<string, unknown> | undefined;
  const sdtXml = extractCDATA(sdtXmlNode?.Source ?? raw.SDTXml);
  if (!sdtXml) return;

  const OPEN = '<CGxExpandPropertyDef>';
  const CLOSE = '</CGxExpandPropertyDef>';
  const members: GxObject['members'] = [];
  let depth = 0;
  let memberStart = -1;
  let pos = 0;

  while (pos < sdtXml.length) {
    const o = sdtXml.indexOf(OPEN, pos);
    const c = sdtXml.indexOf(CLOSE, pos);
    if (o === -1 && c === -1) break;

    const useOpen = o !== -1 && (c === -1 || o < c);
    if (useOpen) {
      depth++;
      if (depth === 1) memberStart = o + OPEN.length;
      pos = o + OPEN.length;
    } else {
      if (depth === 1 && memberStart !== -1) {
        const block = sdtXml.slice(memberStart, c);
        const firstNested = block.indexOf(OPEN);
        const nameStart = block.indexOf('<Name>');
        const nameEnd = block.indexOf('</Name>');
        if (nameStart !== -1 && nameEnd !== -1 && (firstNested === -1 || nameStart < firstNested)) {
          const name = block.slice(nameStart + '<Name>'.length, nameEnd).trim();
          const isCollection = /<Name>Collection<\/Name>[\s\S]*?<Value>True/i.test(block);
          if (name) members.push({ name, type: 'Attribute', isCollection, description: '' });
        }
        memberStart = -1;
      }
      depth--;
      pos = c + CLOSE.length;
    }
  }

  obj.members = members;
}

function parseGX9Table(raw: Record<string, unknown>, obj: GxObject): void {
  const keys = ensureArray(raw.Key as unknown as unknown[]);
  const pkSet = new Set(
    keys.map((k) => (typeof k === 'string' ? k : String((k as Record<string, unknown>)['#text'] ?? '')).trim()).filter(Boolean),
  );

  const allowNulls = ensureArray(raw.AllowNulls as Record<string, unknown> | Record<string, unknown>[]);
  const seen = new Set(pkSet);

  for (const pk of pkSet) {
    obj.attributes.push(makeAttribute(pk, { isPK: true, nullable: false }));
  }
  for (const an of allowNulls) {
    const attrName = String(an.Name ?? an.name ?? '').trim();
    if (!attrName || seen.has(attrName)) continue;
    seen.add(attrName);
    const nullable = an.Value !== 'No' && an.Value !== 'NO';
    obj.attributes.push(makeAttribute(attrName, { nullable }));
  }
}

function parseGX9DataProvider(raw: Record<string, unknown>, obj: GxObject): void {
  const sourceNode = raw.Source as Record<string, unknown> | string | undefined;
  const src = typeof sourceNode === 'object' ? extractCDATA(sourceNode.Source ?? sourceNode) : extractCDATA(sourceNode);
  obj.source = src;
  if (src) obj.calls = extractCallsFromText(src);
}

/** The `<Attributes>` section in a GX9 export is a KB-wide catalog of every attribute's type/domain. */
function collectGX9AttributeCatalog(
  attributesNode: Record<string, unknown>,
  catalog: Map<string, { type: string; domain: string; length: number | null; decimals: number | null }>,
): void {
  for (const gxAtt of ensureArray(attributesNode.GXAtt as Record<string, unknown> | Record<string, unknown>[])) {
    const attNode = gxAtt.Attribute as Record<string, unknown> | undefined;
    if (!attNode || typeof attNode !== 'object') continue;
    const name = String(attNode.Name ?? '').trim();
    if (!name) continue;

    const attInfo = (gxAtt.AttInfo ?? {}) as Record<string, unknown>;
    catalog.set(name.toLowerCase(), {
      type: String(attNode.Type ?? '').trim(),
      domain: String(attInfo.Domain ?? '').trim(),
      length: toNumberOrNull(attNode.Length),
      decimals: toNumberOrNull(attNode.Decimals),
    });
  }
}

function enrichFromAttributeCatalog(
  classified: ClassifiedObjects,
  catalog: Map<string, { type: string; domain: string; length: number | null; decimals: number | null }>,
): void {
  if (catalog.size === 0) return;
  for (const typeKey of ['Transaction', 'Table'] as const) {
    for (const entity of classified[typeKey]) {
      for (const attr of entity.attributes) {
        const entry = catalog.get(attr.name.toLowerCase());
        if (!entry) continue;
        if (!attr.type && entry.type) attr.type = entry.type;
        if (!attr.domain && entry.domain) attr.domain = entry.domain;
        if (attr.length == null && entry.length != null) attr.length = entry.length;
        if (attr.decimals == null && entry.decimals != null) attr.decimals = entry.decimals;
      }
    }
  }
}

function parseGX9RulesText(text: string): GxRule[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*') && l !== '{' && l !== '}')
    .map((text) => ({ text, condition: '' }));
}

function extractParmDeclaration(source: string): GxParameter[] {
  const parmMatch = source.match(/Parm\s*\(([^)]+)\)/i);
  if (!parmMatch) return [];
  return parmMatch[1]!
    .split(',')
    .map((p) => {
      const trimmed = p.trim();
      const modeMatch = trimmed.match(/^(in|out|inout):\s*&?(\w+)/i);
      if (modeMatch) {
        const mode = modeMatch[1]!.toLowerCase();
        return {
          name: modeMatch[2]!,
          type: '',
          mode: mode === 'in' ? 'In' : mode === 'out' ? 'Out' : 'InOut',
        };
      }
      return { name: trimmed.replace(/^&/, ''), type: '', mode: 'In' };
    })
    .filter((p) => p.name);
}

/** Parses a GX9 `Event X ... EndEvent` / `Sub X ... EndSub` block of source text. */
function parseGX9EventsText(text: string): GxEvent[] {
  if (!text.trim()) return [];
  const events: GxEvent[] = [];
  const lines = text.split(/\r?\n/);
  let currentName: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const startMatch = trimmed.match(/^(?:Event|Sub)\s+(.+)$/i);
    const endMatch = /^(?:EndEvent|EndSub)\s*$/i.test(trimmed);

    if (startMatch) {
      if (currentName !== null) events.push({ name: currentName, source: currentLines.join('\n').trim() });
      currentName = startMatch[1]!.trim();
      currentLines = [];
    } else if (endMatch) {
      if (currentName !== null) {
        events.push({ name: currentName, source: currentLines.join('\n').trim() });
        currentName = null;
        currentLines = [];
      }
    } else if (currentName !== null) {
      currentLines.push(line);
    }
  }

  if (currentName !== null && currentLines.length > 0) {
    events.push({ name: currentName, source: currentLines.join('\n').trim() });
  }

  return events.filter((e) => e.name);
}

function extractCallsFromText(text: string): string[] {
  if (!text) return [];
  const refs = new Set<string>();
  const patterns = [
    /\bCall\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*[,)]/gi,
    /\bUdp\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*[,)]/gi,
    /\bnew\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gi,
    /\bFor\s+Each\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
    /\bDo\s+['"]([A-Za-z_][A-Za-z0-9_. ]*)['"]/gi,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const name = m[1]!.trim();
      if (name.length > 1 && name.length < 80) refs.add(name);
    }
  }
  return [...refs];
}

// ═══════════════════════════════════════════════════════════════════════
// GX18 — <KBObject Type="..." Name="...">
// ═══════════════════════════════════════════════════════════════════════

function parseGX18KBObject(
  obj: Record<string, unknown>,
  fileName: string,
  classified: ClassifiedObjects,
  warnings: string[],
): void {
  const typeRaw = String(obj['@_Type'] ?? obj.Type ?? '');
  const type = GX18_TYPE_MAP[typeRaw] ?? 'Other';
  const name = String(obj['@_Name'] ?? obj.Name ?? extractNameFromFile(fileName)).trim();
  const description = String(obj['@_Description'] ?? obj.Description ?? '').trim();

  const gxObj: GxObject = {
    id: String(obj['@_Id'] ?? obj.Id ?? generateId(name, type)),
    name,
    type,
    rawType: typeRaw,
    description,
    fileName,
    attributes: [],
    parameters: [],
    rules: [],
    events: [],
    variables: [],
    members: [],
    calls: [],
    source: '',
  };

  if (obj.Structure) {
    gxObj.attributes = extractGX18StructureAttributes(obj.Structure as Record<string, unknown>);
  } else if (obj.Attributes) {
    gxObj.attributes = extractGX18Attributes(obj.Attributes as Record<string, unknown>);
  }
  if (obj.Parameters) gxObj.parameters = extractGX18Parameters(obj.Parameters as Record<string, unknown>);
  if (obj.Rules) gxObj.rules = extractGX18Rules(obj.Rules as Record<string, unknown>);
  if (obj.Source || obj.Code) {
    gxObj.source = extractCDATA(obj.Source ?? obj.Code ?? '');
    gxObj.calls = extractCallsFromText(gxObj.source);
  }
  if (obj.Events) gxObj.events = extractGX18Events(obj.Events as Record<string, unknown>);
  if (obj.Variables) gxObj.variables = extractGX18Variables(obj.Variables as Record<string, unknown>);
  if (obj.Members) gxObj.members = extractGX18Members(obj.Members as Record<string, unknown>);

  pushToClassified(gxObj, classified, warnings);
}

function extractGX18Attributes(attrsNode: Record<string, unknown>): GxAttribute[] {
  return ensureArray(attrsNode.Attribute as Record<string, unknown> | Record<string, unknown>[]).map((attr) => ({
    name: String(attr['@_Name'] ?? attr.Name ?? ''),
    type: String(attr['@_Type'] ?? attr.Type ?? ''),
    isPK: attr['@_IsPK'] === true || attr['@_IsPK'] === 'true',
    isFK: attr['@_IsFK'] === true || attr['@_IsFK'] === 'true',
    nullable: attr['@_Nullable'] !== false && attr['@_Nullable'] !== 'false',
    description: String(attr['@_Description'] ?? attr.Description ?? ''),
    domain: String(attr['@_Domain'] ?? attr.Domain ?? ''),
    length: (attr['@_Length'] as number | undefined) ?? null,
    decimals: (attr['@_Decimals'] as number | undefined) ?? null,
    level: 'Root',
    levelTable: '',
    formula: String(attr['@_Formula'] ?? attr.Formula ?? ''),
    hasFormula: !!(attr['@_Formula'] ?? attr.Formula),
  }));
}

function extractGX18StructureAttributes(structure: Record<string, unknown>): GxAttribute[] {
  const attrs: GxAttribute[] = [];
  for (const level of ensureArray(structure.Level as Record<string, unknown> | Record<string, unknown>[])) {
    const levelName = String(level['@_Name'] ?? level.Name ?? 'Root');
    for (const attr of ensureArray(level.Attribute as Record<string, unknown> | Record<string, unknown>[])) {
      if (!attr || typeof attr !== 'object') continue;
      const formula = String(attr['@_Formula'] ?? attr.Formula ?? '');
      attrs.push({
        name: String(attr['@_Name'] ?? attr.Name ?? ''),
        type: String(attr['@_Type'] ?? attr.Type ?? ''),
        isPK: attr['@_IsPK'] === true || attr['@_IsPK'] === 'true',
        isFK: attr['@_IsFK'] === true || attr['@_IsFK'] === 'true',
        nullable: attr['@_Nullable'] !== false && attr['@_Nullable'] !== 'false',
        description: String(attr['@_Description'] ?? attr.Description ?? ''),
        domain: String(attr['@_Domain'] ?? attr.Domain ?? ''),
        length: (attr['@_Length'] as number | undefined) ?? null,
        decimals: (attr['@_Decimals'] as number | undefined) ?? null,
        level: levelName,
        levelTable: levelName,
        formula,
        hasFormula: !!formula,
      });
    }
    if (level.Level) attrs.push(...extractGX18StructureAttributes({ Level: level.Level }));
  }
  return attrs;
}

function extractGX18Parameters(p: Record<string, unknown>): GxParameter[] {
  return ensureArray(p.Parameter as Record<string, unknown> | Record<string, unknown>[]).map((param) => ({
    name: String(param['@_Name'] ?? param.Name ?? ''),
    type: String(param['@_Type'] ?? param.Type ?? ''),
    mode: String(param['@_Mode'] ?? param.Mode ?? 'In'),
  }));
}

function extractGX18Rules(r: Record<string, unknown>): GxRule[] {
  return ensureArray(r.Rule as Record<string, unknown> | Record<string, unknown>[])
    .map((rule) => ({
      text: String(rule['@_Text'] ?? rule.Text ?? rule['#text'] ?? ''),
      condition: String(rule['@_Condition'] ?? rule.Condition ?? ''),
    }))
    .filter((r) => r.text);
}

function extractGX18Events(e: Record<string, unknown>): GxEvent[] {
  return ensureArray(e.Event as Record<string, unknown> | Record<string, unknown>[]).map((event) => ({
    name: String(event['@_Name'] ?? event.Name ?? ''),
    source: extractCDATA(event.Source ?? event.Code ?? event['#text'] ?? ''),
  }));
}

function extractGX18Variables(v: Record<string, unknown>): GxObject['variables'] {
  return ensureArray(v.Variable as Record<string, unknown> | Record<string, unknown>[]).map((variable) => ({
    name: String(variable['@_Name'] ?? variable.Name ?? ''),
    type: String(variable['@_Type'] ?? variable.Type ?? ''),
    baseType: String(variable['@_BaseType'] ?? variable.BaseType ?? ''),
  }));
}

function extractGX18Members(m: Record<string, unknown>): GxObject['members'] {
  return ensureArray(m.Member as Record<string, unknown> | Record<string, unknown>[]).map((member) => ({
    name: String(member['@_Name'] ?? member.Name ?? ''),
    type: String(member['@_Type'] ?? member.Type ?? ''),
    isCollection: member['@_IsCollection'] === true || member['@_IsCollection'] === 'true',
    description: String(member['@_Description'] ?? member.Description ?? ''),
  }));
}

// ── Shared utilities ──────────────────────────────────────────────────

function makeAttribute(name: string, overrides: Partial<GxAttribute> = {}): GxAttribute {
  return {
    name,
    type: '',
    isPK: false,
    isFK: false,
    nullable: true,
    description: '',
    domain: '',
    length: null,
    decimals: null,
    level: 'Root',
    levelTable: 'Root',
    formula: '',
    hasFormula: false,
    ...overrides,
  };
}

function pushToClassified(obj: GxObject, classified: ClassifiedObjects, warnings: string[]): void {
  if (!obj.name) {
    warnings.push(`${obj.fileName}: object of type ${obj.type} has no name — skipped`);
    return;
  }
  const bucket = classified[obj.type];
  if (!bucket.find((o) => o.name === obj.name)) bucket.push(obj);
}

function extractNameFromFile(fileName: string): string {
  return (
    fileName
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/\.xml$/i, '') ?? 'Unknown'
  );
}

function extractCDATA(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractCDATA).join('\n').trim();
  if (typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)['#text']);
  }
  return '';
}

function generateId(name: string, type: string): string {
  return `${type || 'OBJ'}_${name.replace(/\s+/g, '_')}_${++idCounter}`;
}

function toNumberOrNull(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}
