import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GX_OBJECT_TYPES } from './types.js';
import type { ClassifiedObjects, ExtractionResult, GxObject } from './types.js';

export interface ProjectWriteSummary {
  outDir: string;
  objectCount: number;
  filesWritten: number;
}

/**
 * Writes an {@link ExtractionResult} to disk as a navigable code project:
 * one Markdown file per object (grouped by type), a `manifest.json` with the
 * full structured data, and an `AI_INSTRUCTIONS.md` for coding agents.
 */
export async function writeProject(
  result: ExtractionResult,
  outDir: string,
  sourceFileName: string,
): Promise<ProjectWriteSummary> {
  await mkdir(outDir, { recursive: true });

  let filesWritten = 0;
  let objectCount = 0;
  const objectsDir = path.join(outDir, 'objects');

  for (const type of GX_OBJECT_TYPES) {
    const objects = result.objects[type];
    if (objects.length === 0) continue;

    const typeDir = path.join(objectsDir, type);
    await mkdir(typeDir, { recursive: true });

    for (const obj of objects) {
      const fileName = `${sanitizeFileName(obj.name)}.md`;
      await writeFile(path.join(typeDir, fileName), renderObjectMarkdown(obj), 'utf-8');
      filesWritten++;
      objectCount++;
    }
  }

  await writeFile(path.join(objectsDir, 'README.md'), renderInventory(result.objects), 'utf-8');
  filesWritten++;

  await writeFile(path.join(outDir, 'manifest.json'), renderManifest(result, sourceFileName), 'utf-8');
  filesWritten++;

  await writeFile(path.join(outDir, 'AI_INSTRUCTIONS.md'), renderAiInstructions(result, sourceFileName), 'utf-8');
  filesWritten++;

  await writeFile(path.join(outDir, 'README.md'), renderProjectReadme(result, sourceFileName), 'utf-8');
  filesWritten++;

  return { outDir, objectCount, filesWritten };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'unnamed';
}

function renderObjectMarkdown(obj: GxObject): string {
  const lines: string[] = [];
  lines.push(`# ${obj.name}`, '');
  lines.push(`**Type:** ${obj.type}  `);
  lines.push(`**Source file:** \`${obj.fileName}\``);
  if (obj.description) lines.push('', obj.description);

  if (obj.attributes.length > 0) {
    lines.push('', '## Structure', '', '| Attribute | Type | PK | FK | Nullable | Domain | Level |', '|---|---|---|---|---|---|---|');
    for (const a of obj.attributes) {
      lines.push(
        `| ${a.name} | ${a.type || '—'} | ${a.isPK ? 'Y' : ''} | ${a.isFK ? 'Y' : ''} | ${a.nullable ? 'Y' : 'N'} | ${a.domain || '—'} | ${a.level} |`,
      );
    }
  }

  if (obj.parameters.length > 0) {
    lines.push('', '## Parameters', '', '| Name | Type | Mode |', '|---|---|---|');
    for (const p of obj.parameters) {
      lines.push(`| ${p.name} | ${p.type || '—'} | ${p.mode} |`);
    }
  }

  if (obj.variables.length > 0) {
    lines.push('', '## Variables', '', '| Name | Type |', '|---|---|');
    for (const v of obj.variables) {
      lines.push(`| ${v.name} | ${v.type || v.baseType || '—'} |`);
    }
  }

  if (obj.members.length > 0) {
    lines.push('', '## Members', '', '| Name | Type | Collection |', '|---|---|---|');
    for (const m of obj.members) {
      lines.push(`| ${m.name} | ${m.type || '—'} | ${m.isCollection ? 'Y' : ''} |`);
    }
  }

  if (obj.rules.length > 0) {
    lines.push('', '## Rules', '', '```genexus');
    for (const r of obj.rules) lines.push(r.text);
    lines.push('```');
  }

  if (obj.events.length > 0) {
    lines.push('', '## Events');
    for (const e of obj.events) {
      lines.push('', `### ${e.name}`, '', '```genexus', e.source, '```');
    }
  }

  if (obj.source && obj.events.length === 0) {
    lines.push('', '## Source', '', '```genexus', obj.source, '```');
  }

  if (obj.calls.length > 0) {
    lines.push('', '## References', '', obj.calls.map((c) => `- ${c}`).join('\n'));
  }

  return lines.join('\n') + '\n';
}

function renderInventory(objects: ClassifiedObjects): string {
  const lines = ['# Object inventory', ''];
  for (const type of GX_OBJECT_TYPES) {
    const items = objects[type];
    if (items.length === 0) continue;
    lines.push(`## ${type} (${items.length})`, '');
    for (const obj of items) {
      lines.push(`- [${obj.name}](./${type}/${sanitizeFileName(obj.name)}.md)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderManifest(result: ExtractionResult, sourceFileName: string): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceFile: sourceFileName,
      kbFormat: result.kbFormat,
      warnings: result.warnings,
      objects: result.objects,
    },
    null,
    2,
  );
}

function renderProjectReadme(result: ExtractionResult, sourceFileName: string): string {
  const counts = GX_OBJECT_TYPES.map((t) => [t, result.objects[t].length] as const).filter(([, n]) => n > 0);
  const total = counts.reduce((sum, [, n]) => sum + n, 0);

  const lines = [
    `# ${sourceFileName} — extracted KB project`,
    '',
    `Extracted with [xpz-extract](https://github.com/) from a **${result.kbFormat.toUpperCase()}** GeneXus export.`,
    '',
    `${total} objects across ${counts.length} types:`,
    '',
    '| Type | Count |',
    '|---|---|',
    ...counts.map(([t, n]) => `| ${t} | ${n} |`),
    '',
    'See [`objects/README.md`](./objects/README.md) for the full inventory, ',
    '[`manifest.json`](./manifest.json) for structured data, and ',
    '[`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) if you are an AI coding assistant working in this project.',
  ];
  if (result.warnings.length > 0) {
    lines.push('', `> ${result.warnings.length} warning(s) were produced during extraction — see below.`, '', '<details><summary>Warnings</summary>', '');
    lines.push(...result.warnings.map((w) => `- ${w}`));
    lines.push('', '</details>');
  }
  return lines.join('\n') + '\n';
}

function renderAiInstructions(result: ExtractionResult, sourceFileName: string): string {
  return `# Working in this project

This directory is a GeneXus Knowledge Base (\`${sourceFileName}\`, ${result.kbFormat.toUpperCase()} format)
extracted by [xpz-extract](https://github.com/) into plain files so it can be
browsed, searched, diffed, and edited with normal developer tooling.

## Layout

- \`objects/<Type>/<ObjectName>.md\` — one file per GeneXus object (Transaction,
  Procedure, WebPanel, ...). Each file documents the object's structure
  (attributes/parameters/variables), its GeneXus rules, event source code, and
  any objects it calls or references.
- \`objects/README.md\` — inventory index, grouped by type.
- \`manifest.json\` — the same data as the Markdown files, as structured JSON.
  Prefer this for programmatic access (grep-ability, tooling, scripts).

## What this project is NOT

This is a **read-oriented extraction**, not a compiled/importable GeneXus
project. There is no build step and no way to "run" this code directly — the
source of truth remains the original \`.xpz\` / the GeneXus Knowledge Base
itself. Treat this project as documentation-as-code: a way to read, search,
and reason about the KB with an editor, Git, and an AI assistant, not a
replacement for GeneXus.

## Conventions worth knowing

- GeneXus code shown in \`\`\`genexus\`\`\` blocks uses GeneXus's own procedural
  language, not a mainstream language — variables are prefixed with \`&\`,
  and \`Parm()\` declares a Procedure/Report's parameters.
  Rules (\`Rules\`) declare structural properties (\`Parm\`, \`Default\`,
  \`Required\`, ...); \`Events\` contain imperative event-handler code.
- An attribute marked \`PK\` in a Transaction's Structure table is that
  transaction's primary key. GeneXus infers foreign keys implicitly: an
  attribute that is the PK of *another* transaction and appears (non-PK) here
  is a reference to that transaction — xpz-extract does not currently compute
  this across objects (see the project README's Limitations section).
- \`References\` at the bottom of an object file are extracted heuristically
  from \`Call()\`, \`Udp()\`, \`new X()\`, \`For Each X\`, and \`Do 'X'\` patterns in
  its source/rules — they are a best-effort dependency hint, not a guarantee.

## Suggested workflow

1. Start from \`objects/README.md\` to see what exists.
2. Search \`manifest.json\` or grep the \`objects/\` tree for the object you need.
3. When asked to plan a change, read the relevant object file(s) fully before
   proposing edits — GeneXus rules/events are dense and order-sensitive.
`;
}
