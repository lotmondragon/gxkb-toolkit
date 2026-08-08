import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractKnowledgeBase } from '../src/extract.js';
import { writeProject } from '../src/projectWriter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, '..', 'fixtures');

let outDir: string;

beforeEach(async () => {
  outDir = await mkdtemp(path.join(tmpdir(), 'xpz-extract-test-'));
});

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe('writeProject', () => {
  it('writes one Markdown file per object, a manifest, and an AI instructions file', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'sample-gx18.xpz'));
    const result = extractKnowledgeBase(buffer);

    const summary = await writeProject(result, outDir, 'sample-gx18.xpz');
    expect(summary.objectCount).toBe(3); // Customer, GetCustomerBalance, CustomerList

    const rootFiles = await readdir(outDir);
    expect(rootFiles).toEqual(expect.arrayContaining(['README.md', 'AI_INSTRUCTIONS.md', 'manifest.json', 'objects']));

    const transactionFiles = await readdir(path.join(outDir, 'objects', 'Transaction'));
    expect(transactionFiles).toEqual(['Customer.md']);

    const customerMd = await readFile(path.join(outDir, 'objects', 'Transaction', 'Customer.md'), 'utf-8');
    expect(customerMd).toContain('# Customer');
    expect(customerMd).toContain('CustomerId');
    expect(customerMd).toContain('## Rules');

    const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf-8'));
    expect(manifest.kbFormat).toBe('gx18');
    expect(manifest.objects.Procedure).toHaveLength(1);
  });

  it('sanitizes object names that contain filesystem-unsafe characters', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'sample-gx9.xpz'));
    const result = extractKnowledgeBase(buffer);
    result.objects.Procedure[0]!.name = 'Weird/Name:Here';

    await writeProject(result, outDir, 'sample-gx9.xpz');
    const files = await readdir(path.join(outDir, 'objects', 'Procedure'));
    expect(files).toEqual(['Weird_Name_Here.md']);
  });
});
