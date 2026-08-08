import { describe, expect, it } from 'vitest';
import { buildGX18ObjectXml, buildGX9Block, buildGX9ExportFile, escapeXml, sanitizeName } from '../src/xmlBuilder.js';
import type { ExtractedObjectCode, GeneratedObject } from '../src/types.js';

const emptyCode: ExtractedObjectCode = {
  source: '',
  rules: '',
  attributes: [],
  parameters: [],
  variables: [],
  members: [],
  events: [],
};

describe('buildGX18ObjectXml', () => {
  it('builds a Transaction with Structure/Level/Attribute and Rules', () => {
    const xml = buildGX18ObjectXml('Customer', 'Transaction', 'Customer data', {
      ...emptyCode,
      attributes: [{ name: 'CustomerId', type: 'Numeric', length: '8', isPK: true, description: '' }],
      rules: 'Required(CustomerId);',
    });
    expect(xml).toContain('<KBObject Type="Transaction" Name="Customer" Description="Customer data">');
    expect(xml).toContain('<Level Name="Customer">');
    expect(xml).toContain('<Attribute Name="CustomerId" Type="Numeric" Length="8" IsPK="true"/>');
    expect(xml).toContain('<Rule Text="Required(CustomerId);" Condition=""/>');
  });

  it('falls back to a stub comment when no source was generated', () => {
    const xml = buildGX18ObjectXml('Foo', 'Procedure', '', emptyCode);
    expect(xml).toContain('// Implement Foo');
  });

  it('builds a WebPanel with declared Variables and named Events', () => {
    const xml = buildGX18ObjectXml('CustomerList', 'WebPanel', '', {
      ...emptyCode,
      variables: [{ name: 'x', type: 'Character', length: '50', dec: '', isCollection: false }],
      events: [{ name: 'Start', source: '&x = ""' }],
    });
    expect(xml).toContain('<Variable Name="x" Type="Character" Length="50"/>');
    expect(xml).toContain('<Event Name="Start">');
    expect(xml).toContain('&x = ""');
  });

  it('escapes XML-special characters in the description attribute', () => {
    const xml = buildGX18ObjectXml('Foo', 'Procedure', 'A "quoted" & <tagged> value', emptyCode);
    expect(xml).toContain('Description="A &quot;quoted&quot; &amp; &lt;tagged&gt; value"');
  });
});

describe('buildGX9Block / buildGX9ExportFile', () => {
  it('builds a Transaction block with Structure and Rules CDATA', () => {
    const block = buildGX9Block('Customer', 'Transaction', 'Customer data', {
      ...emptyCode,
      source: 'CustomerId*\nCustomerName',
      rules: 'Required(CustomerName);',
    });
    expect(block).toContain('<Transaction>');
    expect(block).toContain('CustomerId*');
    expect(block).toContain('<Rules><![CDATA[');
    expect(block).toContain('Required(CustomerName);');
  });

  it('wraps multiple blocks into one ExportFile, skipping duplicate names', () => {
    const objects: GeneratedObject[] = [
      { name: 'Foo', type: 'Procedure', description: '', xml: '  <GXObject><Procedure/></GXObject>' },
      { name: 'Foo', type: 'Procedure', description: '', xml: '  <GXObject><Procedure/></GXObject>' },
    ];
    const exportFile = buildGX9ExportFile(objects, 'folio-123');
    expect(exportFile).toContain('<ExportFile>');
    expect(exportFile.match(/<GXObject>/g)).toHaveLength(1); // second "Foo" deduplicated
  });
});

describe('escapeXml / sanitizeName', () => {
  it('escapes all five XML special characters', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('sanitizes unsafe filename characters and caps length', () => {
    expect(sanitizeName('Weird/Name:Here')).toBe('Weird_Name_Here');
    expect(sanitizeName('a'.repeat(100))).toHaveLength(60);
  });
});
