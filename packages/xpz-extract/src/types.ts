/** GeneXus export format detected in the .xpz file. */
export type KbFormat = 'gx9' | 'gx18';

/** A single XML file (or XML block, for stream-split GX9 exports) pulled out of the .xpz zip. */
export interface XmlFile {
  name: string;
  content: string;
}

/** Result of parsing one {@link XmlFile} into a JS object tree. */
export interface ParsedXml {
  fileName: string;
  parsed: Record<string, unknown>;
  isGX9: boolean;
}

/** A structural attribute belonging to a Transaction or Table. */
export interface GxAttribute {
  name: string;
  type: string;
  isPK: boolean;
  isFK: boolean;
  nullable: boolean;
  description: string;
  domain: string;
  length: number | null;
  decimals: number | null;
  level: string;
  levelTable: string;
  formula: string;
  hasFormula: boolean;
}

export interface GxParameter {
  name: string;
  type: string;
  mode: string;
}

export interface GxRule {
  text: string;
  condition: string;
}

export interface GxEvent {
  name: string;
  source: string;
}

export interface GxVariable {
  name: string;
  type: string;
  baseType: string;
}

export interface GxMember {
  name: string;
  type: string;
  isCollection: boolean;
  description: string;
}

/** The object types xpz-extract recognizes and buckets objects into. */
export const GX_OBJECT_TYPES = [
  'Transaction',
  'Procedure',
  'WebPanel',
  'WorkPanel',
  'Report',
  'SDT',
  'DataProvider',
  'Table',
  'Domain',
  'BusinessComponent',
  'ExternalObject',
  'WebService',
  'Module',
  'Other',
] as const;

export type GxObjectType = (typeof GX_OBJECT_TYPES)[number];

/** A single GeneXus KB object, normalized across GX9/GX18 into one shape. */
export interface GxObject {
  id: string;
  name: string;
  type: GxObjectType;
  rawType: string;
  description: string;
  fileName: string;
  attributes: GxAttribute[];
  parameters: GxParameter[];
  rules: GxRule[];
  events: GxEvent[];
  variables: GxVariable[];
  members: GxMember[];
  calls: string[];
  source: string;
}

export type ClassifiedObjects = Record<GxObjectType, GxObject[]>;

/** Everything xpz-extract learned from one .xpz file. */
export interface ExtractionResult {
  kbFormat: KbFormat;
  objects: ClassifiedObjects;
  warnings: string[];
}

export function emptyClassified(): ClassifiedObjects {
  return {
    Transaction: [],
    Procedure: [],
    WebPanel: [],
    WorkPanel: [],
    Report: [],
    SDT: [],
    DataProvider: [],
    Table: [],
    Domain: [],
    BusinessComponent: [],
    ExternalObject: [],
    WebService: [],
    Module: [],
    Other: [],
  };
}
