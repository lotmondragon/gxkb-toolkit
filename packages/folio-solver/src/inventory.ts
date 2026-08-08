import type { KbManifest } from './types.js';

const MAX_OBJECTS_PER_TYPE = 200;
const MAX_DESCRIPTION_LENGTH = 140;

/**
 * Renders a condensed, token-conscious inventory of the KB for the planning
 * prompt — object names and short descriptions only, never full source, and
 * capped per type so a large KB doesn't blow the context window.
 */
export function summarizeInventory(manifest: KbManifest): string {
  const lines: string[] = [];

  for (const [type, objects] of Object.entries(manifest.objects)) {
    if (!Array.isArray(objects) || objects.length === 0) continue;
    lines.push(`### ${type} (${objects.length})`);
    for (const obj of objects.slice(0, MAX_OBJECTS_PER_TYPE)) {
      const description = (obj.description ?? '').slice(0, MAX_DESCRIPTION_LENGTH);
      lines.push(`- ${obj.name}${description ? ` — ${description}` : ''}`);
    }
    if (objects.length > MAX_OBJECTS_PER_TYPE) {
      lines.push(`- ... and ${objects.length - MAX_OBJECTS_PER_TYPE} more (truncated)`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/** Finds one object by name across every type bucket in the manifest. */
export function findObjectByName(manifest: KbManifest, name: string) {
  for (const objects of Object.values(manifest.objects)) {
    const match = objects.find((o) => o.name.toLowerCase() === name.toLowerCase());
    if (match) return match;
  }
  return undefined;
}
