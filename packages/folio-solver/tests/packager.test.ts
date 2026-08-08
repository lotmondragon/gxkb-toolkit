import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { packageXpz } from '../src/packager.js';
import type { GeneratedObject } from '../src/types.js';

describe('packageXpz', () => {
  it('packages GX18 objects as one XML file per object', () => {
    const objects: GeneratedObject[] = [
      { name: 'Customer', type: 'Transaction', description: '', xml: '<KBObject Type="Transaction" Name="Customer"/>' },
      { name: 'GetBalance', type: 'Procedure', description: '', xml: '<KBObject Type="Procedure" Name="GetBalance"/>' },
    ];
    const buffer = packageXpz(objects, 'gx18', 'folio-42');
    const zip = new AdmZip(buffer);
    const names = zip.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(['Customer.xml', 'GetBalance.xml']);
  });

  it('packages GX9 objects as a single ExportFile', () => {
    const objects: GeneratedObject[] = [
      { name: 'Customer', type: 'Transaction', description: '', xml: '  <GXObject><Transaction/></GXObject>' },
    ];
    const buffer = packageXpz(objects, 'gx9', 'folio-42');
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.entryName).toBe('folio-42_1.xml');
    expect(zip.readAsText(entries[0]!)).toContain('<ExportFile>');
  });
});
