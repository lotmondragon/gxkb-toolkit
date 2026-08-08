import type { GxObject, KbFormat } from 'xpz-extract';
import type { ClaudeCaller } from './anthropic.js';
import { buildSystemPrompt } from './promptRules.js';
import { extractObjectCode } from './xmlExtract.js';
import { buildGX9Block, buildGX18ObjectXml } from './xmlBuilder.js';
import type { GeneratedObject, PlanItem } from './types.js';

/**
 * Generates one KB object's XML for a plan item. Never trusts Claude's raw
 * XML structure directly — {@link extractObjectCode} pulls out CDATA/attribute
 * content and the xmlBuilder templates rebuild guaranteed-valid XML from it.
 *
 * When `existingObject` is provided (for `action: "modify"` items), its
 * current source/rules/attributes are given to Claude as the object to
 * extend or edit, matching how `xpz-extract`'s per-object Markdown
 * represents it.
 */
export async function generateObject(
  planItem: PlanItem,
  kbFormat: KbFormat,
  caller: ClaudeCaller,
  existingObject?: GxObject,
): Promise<GeneratedObject> {
  const system = buildSystemPrompt(kbFormat);
  const user = buildUserPrompt(planItem, existingObject);

  const raw = await caller.call(system, user);
  const code = extractObjectCode(raw);

  const description = existingObject?.description ?? planItem.reason;
  const xml =
    kbFormat === 'gx9'
      ? buildGX9Block(planItem.objectName, planItem.objectType, description, code)
      : buildGX18ObjectXml(planItem.objectName, planItem.objectType, description, code);

  return { name: planItem.objectName, type: planItem.objectType, description, xml };
}

function buildUserPrompt(planItem: PlanItem, existingObject?: GxObject): string {
  const parts = [
    `Object to ${planItem.action}: ${planItem.objectName} (${planItem.objectType})`,
    `Why: ${planItem.reason}`,
  ];

  if (planItem.action === 'modify' && existingObject) {
    parts.push('', 'Existing object — reproduce everything below verbatim except for the requested change:', '');
    if (existingObject.attributes.length > 0) {
      parts.push(
        'Attributes: ' +
          existingObject.attributes.map((a) => `${a.name}${a.isPK ? '*' : ''}:${a.type || '?'}`).join(', '),
      );
    }
    if (existingObject.parameters.length > 0) {
      parts.push('Parameters: ' + existingObject.parameters.map((p) => `${p.mode}:${p.name}`).join(', '));
    }
    if (existingObject.rules.length > 0) {
      parts.push('Existing rules:', existingObject.rules.map((r) => r.text).join('\n'));
    }
    if (existingObject.source) {
      parts.push('Existing source:', existingObject.source);
    }
    if (existingObject.events.length > 0) {
      for (const e of existingObject.events) {
        parts.push(`Existing event ${e.name}:`, e.source);
      }
    }
  } else if (planItem.action === 'modify' && !existingObject) {
    parts.push(
      '',
      'WARNING: this object was not found in the KB manifest. Do not invent its existing content —',
      'generate only the new logic and note the gap in a comment.',
    );
  }

  return parts.join('\n');
}
