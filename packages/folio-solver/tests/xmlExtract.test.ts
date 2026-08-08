import { describe, expect, it } from 'vitest';
import { extractObjectCode } from '../src/xmlExtract.js';

describe('extractObjectCode', () => {
  it('extracts the largest non-XML CDATA block as source', () => {
    const xml = `<KBObject Type="Procedure" Name="Foo">
  <Source><![CDATA[
&Balance = 0
For each
  &Balance = &Balance + 1
EndFor
  ]]></Source>
</KBObject>`;
    const result = extractObjectCode(xml);
    expect(result.source).toContain('For each');
  });

  it('digs into a nested XML wrapper for the innermost CDATA', () => {
    const xml = `<KBObject Type="Procedure" Name="Foo">
  <Source><![CDATA[<?xml version="1.0"?><KBObject Type="Procedure"><Source><![CDATA[&x = 1]]></Source></KBObject>]]></Source>
</KBObject>`;
    const result = extractObjectCode(xml);
    expect(result.source).toBe('&x = 1');
  });

  it('extracts rules from a CDATA Rules block', () => {
    const xml = `<Procedure><Rules><![CDATA[
Parm(in:&x, out:&y);
]]></Rules></Procedure>`;
    expect(extractObjectCode(xml).rules).toBe('Parm(in:&x, out:&y);');
  });

  it('extracts rules from Rule Text attributes when no CDATA rules exist', () => {
    const xml = `<KBObject><Rules><Rule Text="Parm(in:&amp;x);" Condition=""/></Rules></KBObject>`;
    expect(extractObjectCode(xml).rules).toBe('Parm(in:&amp;x);');
  });

  it('extracts Attribute, Parameter, Variable, Member, and Event elements', () => {
    const xml = `<KBObject Type="Transaction" Name="Customer">
  <Structure>
    <Level Name="Customer">
      <Attribute Name="CustomerId" Type="Numeric" Length="8" IsPK="true" Description="PK"/>
      <Attribute Name="CustomerName" Type="Character" Length="60"/>
    </Level>
  </Structure>
  <Parameters>
    <Parameter Name="x" Type="Numeric" Mode="In" Length="8"/>
  </Parameters>
  <Variables>
    <Variable Name="v" Type="Character" Length="50" IsCollection="true"/>
  </Variables>
  <Members>
    <Member Name="m" Type="Character" Length="10" IsCollection="false"/>
  </Members>
  <Events>
    <Event Name="Start"><Source><![CDATA[&v = ""]]></Source></Event>
  </Events>
</KBObject>`;
    const result = extractObjectCode(xml);

    expect(result.attributes).toEqual([
      { name: 'CustomerId', type: 'Numeric', length: '8', isPK: true, description: 'PK' },
      { name: 'CustomerName', type: 'Character', length: '60', isPK: false, description: '' },
    ]);
    expect(result.parameters).toEqual([{ name: 'x', type: 'Numeric', mode: 'In', length: '8' }]);
    expect(result.variables).toEqual([{ name: 'v', type: 'Character', length: '50', dec: '', isCollection: true }]);
    expect(result.members).toEqual([{ name: 'm', type: 'Character', length: '10', isCollection: false }]);
    expect(result.events).toEqual([{ name: 'Start', source: '&v = ""' }]);
  });

  it('returns empty fields for empty input', () => {
    const result = extractObjectCode('');
    expect(result).toEqual({ source: '', rules: '', attributes: [], parameters: [], variables: [], members: [], events: [] });
  });
});
