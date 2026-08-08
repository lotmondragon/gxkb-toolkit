import type { ClassifiedObjects, GxObjectType, KbFormat } from 'xpz-extract';

/** The `manifest.json` written by `xpz-extract extract`. */
export interface KbManifest {
  generatedAt: string;
  sourceFile: string;
  kbFormat: KbFormat;
  warnings: string[];
  objects: ClassifiedObjects;
}

export interface PlanItem {
  objectName: string;
  objectType: GxObjectType;
  action: 'create' | 'modify';
  reason: string;
}

export interface ChangePlan {
  summary: string;
  items: PlanItem[];
}

/** Fields pulled out of Claude's generated XML — never the XML structure itself. */
export interface ExtractedObjectCode {
  source: string;
  rules: string;
  attributes: ExtractedAttribute[];
  parameters: ExtractedParameter[];
  variables: ExtractedVariable[];
  members: ExtractedMember[];
  events: ExtractedEvent[];
}

export interface ExtractedAttribute {
  name: string;
  type: string;
  length: string;
  isPK: boolean;
  description: string;
}

export interface ExtractedParameter {
  name: string;
  type: string;
  mode: string;
  length: string;
}

export interface ExtractedVariable {
  name: string;
  type: string;
  length: string;
  dec: string;
  isCollection: boolean;
}

export interface ExtractedMember {
  name: string;
  type: string;
  length: string;
  isCollection: boolean;
}

export interface ExtractedEvent {
  name: string;
  source: string;
}

export interface GeneratedObject {
  name: string;
  type: GxObjectType;
  description: string;
  xml: string;
}
