import { describe, expect, it } from 'vitest';
import { generateObject } from '../src/generate.js';
import type { ClaudeCaller } from '../src/anthropic.js';
import type { PlanItem } from '../src/types.js';

describe('generateObject', () => {
  it('builds valid GX18 XML from a fake Claude response, never trusting its raw structure', async () => {
    const fakeCaller: ClaudeCaller = {
      async call() {
        // Deliberately malformed structure (mismatched closing tag) — extraction must
        // still succeed because it never parses this as XML.
        return `<KBObject Type="Procedure" Name="GetBalance">
  <Parameters><Parameter Name="id" Type="Numeric" Mode="In"/></Parameters>
  <Source><![CDATA[
&balance = 0
For each
  Where Id = &id
  &balance = Balance
EndFor
  ]]></Source>
  <Rules><![CDATA[Parm(in:&id, out:&balance);]]></Rules>
</WebPanel>`;
      },
    };

    const item: PlanItem = { objectName: 'GetBalance', objectType: 'Procedure', action: 'create', reason: 'new lookup' };
    const generated = await generateObject(item, 'gx18', fakeCaller);

    expect(generated.name).toBe('GetBalance');
    expect(generated.xml).toContain('<KBObject Type="Procedure" Name="GetBalance"');
    expect(generated.xml).toContain('&balance = 0');
    expect(generated.xml).toContain('Parm(in:&amp;id, out:&amp;balance);'); // & correctly re-escaped for the XML attribute
    expect(generated.xml).not.toContain('</WebPanel>'); // malformed tag never survives into the rebuilt XML
  });

  it('builds a GX9 GXObject block for a "create" Transaction', async () => {
    const fakeCaller: ClaudeCaller = {
      async call() {
        return `<GXObject><Transaction><Structure><Source><![CDATA[OrderId*\nOrderDate]]></Source></Structure></Transaction></GXObject>`;
      },
    };

    const item: PlanItem = { objectName: 'Order', objectType: 'Transaction', action: 'create', reason: 'new entity' };
    const generated = await generateObject(item, 'gx9', fakeCaller);

    expect(generated.xml).toContain('<Transaction>');
    expect(generated.xml).toContain('OrderId*');
  });
});
