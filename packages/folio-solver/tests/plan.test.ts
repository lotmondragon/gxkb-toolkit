import { describe, expect, it } from 'vitest';
import { emptyClassified } from 'xpz-extract';
import { parsePlanResponse, planChanges } from '../src/plan.js';
import type { ClaudeCaller } from '../src/anthropic.js';
import type { KbManifest } from '../src/types.js';

function fakeManifest(): KbManifest {
  const objects = emptyClassified();
  objects.Transaction.push({
    id: '1',
    name: 'Customer',
    type: 'Transaction',
    rawType: 'Transaction',
    description: 'Customer master data',
    fileName: 'Customer.xml',
    attributes: [],
    parameters: [],
    rules: [],
    events: [],
    variables: [],
    members: [],
    calls: [],
    source: '',
  });
  return { generatedAt: new Date().toISOString(), sourceFile: 'test.xpz', kbFormat: 'gx18', warnings: [], objects };
}

describe('parsePlanResponse', () => {
  it('parses a plain JSON object', () => {
    const plan = parsePlanResponse(
      '{"summary":"add email validation","items":[{"objectName":"Customer","objectType":"Transaction","action":"modify","reason":"add a rule"}]}',
    );
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.objectName).toBe('Customer');
  });

  it('strips markdown code fences', () => {
    const plan = parsePlanResponse('```json\n{"summary":"x","items":[]}\n```');
    expect(plan.summary).toBe('x');
  });

  it('throws a readable error on invalid JSON', () => {
    expect(() => parsePlanResponse('not json at all')).toThrow(/JSON/);
  });

  it('throws when the shape does not match the schema', () => {
    expect(() => parsePlanResponse('{"summary":"x","items":[{"objectName":"Foo"}]}')).toThrow(/expected shape/);
  });
});

describe('planChanges', () => {
  it('sends a condensed inventory and the folio text, and returns the parsed plan', async () => {
    let capturedUser = '';
    const fakeCaller: ClaudeCaller = {
      async call(_system, user) {
        capturedUser = user;
        return '{"summary":"ok","items":[]}';
      },
    };

    const plan = await planChanges(fakeManifest(), 'Add an email field to Customer.', fakeCaller);
    expect(plan.summary).toBe('ok');
    expect(capturedUser).toContain('Customer');
    expect(capturedUser).toContain('Add an email field to Customer.');
  });
});
