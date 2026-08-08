import { extractXPZ } from './zip.js';
import { parseAllXMLs, isGeneXus9Format } from './xmlParser.js';
import { classifyObjects } from './classifier.js';
import type { ExtractionResult, KbFormat } from './types.js';

/**
 * Runs the full pipeline — unzip, parse, classify — on a .xpz file buffer.
 * Detects GX9 vs GX18 format by majority vote across the files found inside.
 */
export function extractKnowledgeBase(buffer: Buffer): ExtractionResult {
  const warnings: string[] = [];
  const xmlFiles = extractXPZ(buffer, warnings);
  const parsedFiles = parseAllXMLs(xmlFiles, warnings);

  if (parsedFiles.length === 0) {
    throw new Error('No XML content could be parsed from this .xpz file.');
  }

  const kbFormat = detectKbFormat(xmlFiles.map((f) => f.content));
  const objects = classifyObjects(parsedFiles, warnings);

  return { kbFormat, objects, warnings };
}

function detectKbFormat(contents: string[]): KbFormat {
  const gx9Count = contents.filter(isGeneXus9Format).length;
  return gx9Count > contents.length / 2 ? 'gx9' : 'gx18';
}
