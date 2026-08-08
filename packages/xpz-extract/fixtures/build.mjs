#!/usr/bin/env node
// Builds the synthetic .xpz fixtures used by tests and the README quick start
// from the readable source XML in gx9-source/ and gx18-source/.
//
// Run with: node fixtures/build.mjs   (from packages/xpz-extract/)

import AdmZip from 'adm-zip';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

buildXpz(path.join(here, 'gx9-source'), path.join(here, 'sample-gx9.xpz'));
buildXpz(path.join(here, 'gx18-source'), path.join(here, 'sample-gx18.xpz'));

function buildXpz(sourceDir, outFile) {
  const zip = new AdmZip();
  for (const fileName of readdirSync(sourceDir).sort()) {
    if (!fileName.endsWith('.xml')) continue;
    const content = readFileSync(path.join(sourceDir, fileName));
    zip.addFile(fileName, content);
  }
  zip.writeZip(outFile);
  console.log(`Built ${path.relative(process.cwd(), outFile)}`);
}
