import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractKnowledgeBase } from '../src/extract.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, '..', 'fixtures');

function loadFixture(name: string): Buffer {
  return readFileSync(path.join(fixturesDir, name));
}

describe('extractKnowledgeBase — GX9 fixture', () => {
  const result = extractKnowledgeBase(loadFixture('sample-gx9.xpz'));

  it('detects the GX9 format', () => {
    expect(result.kbFormat).toBe('gx9');
  });

  it('classifies the Customer transaction with its structure', () => {
    expect(result.objects.Transaction).toHaveLength(1);
    const customer = result.objects.Transaction[0]!;
    expect(customer.name).toBe('Customer');
    expect(customer.attributes.map((a) => a.name)).toEqual([
      'CustomerId',
      'CustomerName',
      'CustomerEmail',
      'CustomerBalance',
    ]);

    const pk = customer.attributes.find((a) => a.name === 'CustomerId')!;
    expect(pk.isPK).toBe(true);
    expect(pk.type).toBe('Numeric'); // filled in from the GX9 attribute catalog
    expect(pk.length).toBe(8);

    const email = customer.attributes.find((a) => a.name === 'CustomerEmail')!;
    expect(email.nullable).toBe(true); // from <AllowNulls>

    expect(customer.rules.map((r) => r.text)).toContain('Serial(CustomerId, LastCustomerId, 1);');
  });

  it('classifies the GetCustomerBalance procedure with parsed Parm() and source', () => {
    expect(result.objects.Procedure).toHaveLength(1);
    const proc = result.objects.Procedure[0]!;
    expect(proc.name).toBe('GetCustomerBalance');
    expect(proc.parameters).toEqual([
      { name: 'CustomerId', type: '', mode: 'In' },
      { name: 'Balance', type: '', mode: 'Out' },
    ]);
    expect(proc.source).toContain('for each');
  });

  it('classifies the CustomerList web panel with its events', () => {
    expect(result.objects.WebPanel).toHaveLength(1);
    const panel = result.objects.WebPanel[0]!;
    expect(panel.name).toBe('CustomerList');
    expect(panel.events.map((e) => e.name)).toEqual(['Start', 'Refresh']);
    const refresh = panel.events.find((e) => e.name === 'Refresh')!;
    expect(refresh.source).toContain('Call(GetCustomerBalance');
    expect(panel.calls).toContain('GetCustomerBalance');
  });

  it('produces no warnings for a well-formed export', () => {
    expect(result.warnings).toEqual([]);
  });
});

describe('extractKnowledgeBase — GX18 fixture', () => {
  const result = extractKnowledgeBase(loadFixture('sample-gx18.xpz'));

  it('detects the GX18 format', () => {
    expect(result.kbFormat).toBe('gx18');
  });

  it('classifies the Customer transaction from its Structure/Level/Attribute tree', () => {
    expect(result.objects.Transaction).toHaveLength(1);
    const customer = result.objects.Transaction[0]!;
    expect(customer.attributes).toHaveLength(4);
    const pk = customer.attributes.find((a) => a.name === 'CustomerId')!;
    expect(pk.isPK).toBe(true);
    expect(pk.type).toBe('Numeric');
    expect(pk.length).toBe(8);
  });

  it('classifies the GetCustomerBalance procedure with typed parameters', () => {
    expect(result.objects.Procedure).toHaveLength(1);
    const proc = result.objects.Procedure[0]!;
    expect(proc.parameters).toEqual([
      { name: 'CustomerId', type: 'Numeric', mode: 'In' },
      { name: 'Balance', type: 'Numeric', mode: 'Out' },
    ]);
    expect(proc.rules.map((r) => r.text)).toContain('Parm(in:&CustomerId, out:&Balance);');
    expect(proc.source).toContain('For each');
  });

  it('classifies the CustomerList web panel with named Source per event', () => {
    expect(result.objects.WebPanel).toHaveLength(1);
    const panel = result.objects.WebPanel[0]!;
    expect(panel.variables.map((v) => v.name)).toEqual(['SearchText', 'CustomerId', 'Balance']);
    const refresh = panel.events.find((e) => e.name === 'Refresh')!;
    expect(refresh.source).toContain('Call(GetCustomerBalance');
  });
});

describe('extractKnowledgeBase — error handling', () => {
  it('throws a readable error for a non-ZIP buffer', () => {
    expect(() => extractKnowledgeBase(Buffer.from('not a zip file'))).toThrow(/ZIP/);
  });
});
