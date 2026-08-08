#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { extractKnowledgeBase } from './extract.js';
import { writeProject } from './projectWriter.js';
import { GX_OBJECT_TYPES } from './types.js';

const program = new Command();

program
  .name('xpz-extract')
  .description('Extract a GeneXus .xpz Knowledge Base export into a navigable, Git-friendly code project.')
  .version('0.1.0');

program
  .command('extract')
  .description('Extract a .xpz file into a directory of readable per-object files')
  .argument('<file>', 'path to the .xpz file')
  .option('-o, --out <dir>', 'output directory', './kb-extracted')
  .action(async (file: string, opts: { out: string }) => {
    try {
      const buffer = await readFileOrFail(file);
      const result = extractKnowledgeBase(buffer);
      const summary = await writeProject(result, opts.out, path.basename(file));

      console.log(`Detected format: ${result.kbFormat.toUpperCase()}`);
      console.log(`Extracted ${summary.objectCount} objects into ${summary.filesWritten} files`);
      console.log(`Output: ${path.resolve(summary.outDir)}`);
      if (result.warnings.length > 0) {
        console.log(`\n${result.warnings.length} warning(s):`);
        for (const w of result.warnings.slice(0, 10)) console.log(`  - ${w}`);
        if (result.warnings.length > 10) console.log(`  ... and ${result.warnings.length - 10} more`);
      }
    } catch (e) {
      failWithMessage(e);
    }
  });

program
  .command('info')
  .description('Print an object-count summary of a .xpz file without writing anything to disk')
  .argument('<file>', 'path to the .xpz file')
  .action(async (file: string) => {
    try {
      const buffer = await readFileOrFail(file);
      const result = extractKnowledgeBase(buffer);

      console.log(`Format: ${result.kbFormat.toUpperCase()}`);
      for (const type of GX_OBJECT_TYPES) {
        const count = result.objects[type].length;
        if (count > 0) console.log(`  ${type.padEnd(18)} ${count}`);
      }
      if (result.warnings.length > 0) {
        console.log(`\n${result.warnings.length} warning(s) — run "extract" to see them inline with the output.`);
      }
    } catch (e) {
      failWithMessage(e);
    }
  });

async function readFileOrFail(file: string): Promise<Buffer> {
  try {
    return await readFile(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${file}`);
    }
    throw e;
  }
}

function failWithMessage(e: unknown): never {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
}

program.parseAsync(process.argv);
