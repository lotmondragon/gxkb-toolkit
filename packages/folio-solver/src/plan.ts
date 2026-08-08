import { z } from 'zod';
import { GX_OBJECT_TYPES } from 'xpz-extract';
import type { ClaudeCaller } from './anthropic.js';
import { summarizeInventory } from './inventory.js';
import type { ChangePlan, KbManifest } from './types.js';

const SYSTEM_PROMPT = `You are helping a GeneXus developer triage a support ticket ("folio") against an existing Knowledge Base.

You will receive:
1. An inventory of the KB's existing objects (name + short description, grouped by type).
2. The folio's requirements, as given to a developer.

Identify which KB objects need to be created or modified to satisfy the requirements, and respond with ONLY a JSON object (no markdown fences, no prose) of this exact shape:

{
  "summary": "one paragraph describing the overall change",
  "items": [
    { "objectName": "string", "objectType": "Transaction|Procedure|WebPanel|WorkPanel|Report|SDT|DataProvider|Table|Domain|BusinessComponent|ExternalObject|WebService|Module|Other", "action": "create|modify", "reason": "why this object is involved" }
  ]
}

Rules:
- Prefer modifying existing objects over creating new ones when the requirement can be satisfied that way.
- objectName must exactly match an existing KB object's name when action is "modify".
- Keep "reason" to one sentence.
- If the folio is too vague to identify concrete objects, return an empty items array and explain why in "summary".`;

const planItemSchema = z.object({
  objectName: z.string().min(1),
  objectType: z.enum(GX_OBJECT_TYPES as unknown as [string, ...string[]]),
  action: z.enum(['create', 'modify']),
  reason: z.string().min(1),
});

const changePlanSchema = z.object({
  summary: z.string(),
  items: z.array(planItemSchema),
});

/**
 * Asks Claude to turn a folio's requirements into a change plan against the
 * given KB manifest. This is the experimental core of folio-solver — the
 * plan is a *suggestion* a developer should review, not an executable spec.
 */
export async function planChanges(
  manifest: KbManifest,
  folioText: string,
  caller: ClaudeCaller,
): Promise<ChangePlan> {
  const inventory = summarizeInventory(manifest);
  const userPrompt = `## Knowledge Base inventory (${manifest.kbFormat.toUpperCase()})\n\n${inventory}\n\n## Folio requirements\n\n${folioText}`;

  const raw = await caller.call(SYSTEM_PROMPT, userPrompt);
  return parsePlanResponse(raw);
}

/** Exported for testing — parses/validates Claude's raw text into a {@link ChangePlan}. */
export function parsePlanResponse(raw: string): ChangePlan {
  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Claude did not return valid JSON for the change plan: ${(e as Error).message}`);
  }

  const result = changePlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Claude's change plan did not match the expected shape: ${result.error.message}`);
  }
  return result.data as ChangePlan;
}

/** Strips markdown code fences Claude sometimes wraps JSON in, and isolates the {...} block. */
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]!.trim() : text.trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Could not locate a JSON object in Claude\'s response.');
  }
  return candidate.slice(start, end + 1);
}
