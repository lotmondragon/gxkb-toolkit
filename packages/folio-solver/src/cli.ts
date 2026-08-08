#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { createClaudeCaller } from './anthropic.js';
import { planChanges } from './plan.js';
import { generateObject } from './generate.js';
import { packageXpz } from './packager.js';
import { findObjectByName } from './inventory.js';
import type { ChangePlan, GeneratedObject, KbManifest } from './types.js';

const program = new Command();

program
  .name('folio-solver')
  .description(
    'EXPERIMENTAL — AI-assisted GeneXus folio triage on top of an xpz-extract manifest. ' +
      'Validated in functional testing only; review every generated .xpz before importing it.',
  )
  .version('0.1.0');

program
  .command('plan')
  .description('Ask Claude which KB objects a folio\'s requirements touch, and how')
  .requiredOption('-m, --manifest <path>', 'path to manifest.json from xpz-extract')
  .requiredOption('-f, --folio <path>', 'path to a text file with the folio requirements')
  .option('-o, --out <path>', 'write the plan JSON here instead of stdout')
  .option('--api-key <key>', 'Anthropic API key (defaults to $ANTHROPIC_API_KEY)')
  .action(async (opts: { manifest: string; folio: string; out?: string; apiKey?: string }) => {
    try {
      const manifest = await loadManifest(opts.manifest);
      const folioText = await readFile(opts.folio, 'utf-8');
      const caller = createClaudeCaller({ apiKey: opts.apiKey });

      const plan = await planChanges(manifest, folioText, caller);
      const json = JSON.stringify(plan, null, 2);

      if (opts.out) {
        await writeFile(opts.out, json, 'utf-8');
        console.log(`Plan written to ${opts.out} (${plan.items.length} item(s))`);
      } else {
        console.log(json);
      }
    } catch (e) {
      failWithMessage(e);
    }
  });

program
  .command('apply')
  .description('Generate XML for every item in a plan and package it as an importable .xpz')
  .requiredOption('-m, --manifest <path>', 'path to manifest.json from xpz-extract')
  .requiredOption('-p, --plan <path>', 'path to a plan.json produced by "plan"')
  .option('-o, --out <path>', 'output .xpz path', './folio-changes.xpz')
  .option('--api-key <key>', 'Anthropic API key (defaults to $ANTHROPIC_API_KEY)')
  .action(async (opts: { manifest: string; plan: string; out: string; apiKey?: string }) => {
    try {
      const manifest = await loadManifest(opts.manifest);
      const plan = JSON.parse(await readFile(opts.plan, 'utf-8')) as ChangePlan;
      const caller = createClaudeCaller({ apiKey: opts.apiKey });

      const generated: GeneratedObject[] = [];
      for (const item of plan.items) {
        console.log(`Generating ${item.objectName} (${item.action})...`);
        const existing = item.action === 'modify' ? findObjectByName(manifest, item.objectName) : undefined;
        generated.push(await generateObject(item, manifest.kbFormat, caller, existing));
      }

      const buffer = packageXpz(generated, manifest.kbFormat);
      await writeFile(opts.out, buffer);
      console.log(`\nWrote ${opts.out} with ${generated.length} object(s).`);
      console.log('This is EXPERIMENTAL output — review the XML before importing it into a real KB.');
    } catch (e) {
      failWithMessage(e);
    }
  });

async function loadManifest(path: string): Promise<KbManifest> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as KbManifest;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Manifest not found: ${path} — run "xpz-extract extract" first.`);
    }
    throw e;
  }
}

function failWithMessage(e: unknown): never {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
}

program.parseAsync(process.argv);
