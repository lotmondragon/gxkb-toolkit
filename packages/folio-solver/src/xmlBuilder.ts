import type { GxObjectType } from 'xpz-extract';
import type { ExtractedObjectCode, ExtractedVariable, GeneratedObject } from './types.js';

/**
 * Builds a valid GX9 `<GXObject>` block from extracted code — never from
 * Claude's raw XML structure. Falls back to a `// Implement <name>` stub if
 * no source was recovered, so the object still imports (as a to-do) instead
 * of failing.
 */
export function buildGX9Block(name: string, type: GxObjectType, description: string, code: ExtractedObjectCode): string {
  const safeName = escapeXml(name);
  const desc = escapeXml(description);
  const now = timestamp();
  const mainCode = code.source || code.rules || `// Implement ${name}`;
  const rulesBlock = code.rules ? `      <Rules><![CDATA[\n${escapeCdata(code.rules)}\n]]></Rules>\n` : '';

  switch (type) {
    case 'Transaction':
      return `  <GXObject>
    <Transaction>
      <Info>
        <Name>${safeName}</Name>
        <Description>${desc}</Description>
      </Info>
      <LastUpdate>${now}</LastUpdate>
      <Structure>
        <Source><![CDATA[
${escapeCdata(mainCode)}
]]></Source>
        <LevelInfo>
          <KeyId>1</KeyId>
          <Name>${safeName}</Name>
          <Description>${desc}</Description>
        </LevelInfo>
      </Structure>
${rulesBlock}    </Transaction>
  </GXObject>`;

    case 'SDT': {
      const sdtCdata = code.source || '<types>\n  <!-- no structure was generated -->\n</types>';
      return `  <GXObject>
    <StructureDataType>
      <Info>
        <Name>${safeName}</Name>
        <Description>${desc}</Description>
      </Info>
      <LastUpdate>${now}</LastUpdate>
      <SDTXml>
        <Source><![CDATA[${escapeCdata(sdtCdata)}]]></Source>
      </SDTXml>
    </StructureDataType>
  </GXObject>`;
    }

    case 'Report':
      return `  <GXObject>
    <Report>
      <Info>
        <Name>${safeName}</Name>
        <Description>${desc}</Description>
      </Info>
      <LastUpdate>${now}</LastUpdate>
      <Layout>
        <Block>
          <CodeBlock>
            <left>0</left>
            <top>0</top>
            <right>2540</right>
            <bottom>1000</bottom>
            <Source><![CDATA[
${escapeCdata(mainCode)}
]]></Source>
          </CodeBlock>
        </Block>
      </Layout>
${rulesBlock}    </Report>
  </GXObject>`;

    case 'WebPanel':
    case 'WorkPanel':
      return `  <GXObject>
    <${type}>
      <Info>
        <Name>${safeName}</Name>
        <Description>${desc}</Description>
      </Info>
      <LastUpdate>${now}</LastUpdate>
      <Events><![CDATA[
${escapeCdata(mainCode)}
]]></Events>
${rulesBlock}    </${type}>
  </GXObject>`;

    case 'DataProvider':
      return `  <GXObject>
    <DataProvider>
      <Info>
        <Name>${safeName}</Name>
        <Description>${desc}</Description>
      </Info>
      <LastUpdate>${now}</LastUpdate>
      <Layout>
        <Block>
          <CodeBlock>
            <left>0</left>
            <top>0</top>
            <right>2540</right>
            <bottom>1000</bottom>
            <Source><![CDATA[
${escapeCdata(mainCode)}
]]></Source>
          </CodeBlock>
        </Block>
      </Layout>
    </DataProvider>
  </GXObject>`;

    default: // Procedure and anything else GX9 represents with Layout/Block/CodeBlock
      return `  <GXObject>
    <Procedure>
      <Info>
        <Name>${safeName}</Name>
        <Description>${desc}</Description>
      </Info>
      <LastUpdate>${now}</LastUpdate>
      <Layout>
        <Block>
          <CodeBlock>
            <left>0</left>
            <top>0</top>
            <right>2540</right>
            <bottom>1000</bottom>
            <Source><![CDATA[
${escapeCdata(mainCode)}
]]></Source>
          </CodeBlock>
        </Block>
      </Layout>
${rulesBlock}    </Procedure>
  </GXObject>`;
  }
}

/** Wraps every generated GX9 block into one `<ExportFile>` document — GX9 imports as a single XML file. */
export function buildGX9ExportFile(objects: GeneratedObject[], folioId: string): string {
  const now = timestamp();
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const obj of objects) {
    if (!obj.name || seen.has(obj.name)) continue;
    seen.add(obj.name);
    blocks.push(obj.xml);
  }

  return `<?xml version='1.0' encoding='UTF-8'?>
<ExportFile>
  <Model>
    <Id>1</Id>
    <Name>Folio_${sanitizeName(folioId)}</Name>
    <Type>Prototype</Type>
    <ExportDate>${now}</ExportDate>
  </Model>
${blocks.join('\n')}
</ExportFile>`;
}

/** Builds a valid GX18 `<KBObject>` document from extracted code. */
export function buildGX18ObjectXml(name: string, type: GxObjectType, description: string, code: ExtractedObjectCode): string {
  const safeName = escapeXml(name);
  const desc = escapeXml(description);
  const mainCode = code.source || `// Implement ${name}`;

  if (type === 'Transaction') {
    const attrXml =
      code.attributes.length > 0
        ? code.attributes
            .map((a) => {
              const pk = a.isPK ? ' IsPK="true"' : '';
              const len = a.length ? ` Length="${escapeXml(a.length)}"` : '';
              const d = a.description ? ` Description="${escapeXml(a.description)}"` : '';
              return `      <Attribute Name="${escapeXml(a.name)}" Type="${escapeXml(a.type)}"${len}${pk}${d}/>`;
            })
            .join('\n')
        : '';
    const structure = `  <Structure>\n    <Level Name="${safeName}">\n${attrXml}\n    </Level>\n  </Structure>`;
    const rulesXml = buildRulesXml(code.rules);
    return `<?xml version="1.0" encoding="UTF-8"?>
<KBObject Type="Transaction" Name="${safeName}" Description="${desc}">
${structure}
${rulesXml}
</KBObject>`;
  }

  if (type === 'SDT') {
    const membersXml =
      code.members.length > 0
        ? code.members
            .map((m) => {
              const col = m.isCollection ? ' IsCollection="true"' : '';
              const len = m.length ? ` Length="${escapeXml(m.length)}"` : '';
              return `    <Member Name="${escapeXml(m.name)}" Type="${escapeXml(m.type)}"${len}${col}/>`;
            })
            .join('\n')
        : `    <Member Name="Item" Type="Character" Length="100"/>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<KBObject Type="SDT" Name="${safeName}" Description="${desc}">
  <Members>
${membersXml}
  </Members>
</KBObject>`;
  }

  if (type === 'WebPanel' || type === 'WorkPanel') {
    const eventsXml =
      code.events.length > 0
        ? `  <Events>\n${code.events
            .map(
              (e) =>
                `    <Event Name="${escapeXml(e.name)}">\n      <Source><![CDATA[\n${escapeCdata(e.source)}\n]]></Source>\n    </Event>`,
            )
            .join('\n')}\n  </Events>`
        : `  <Events>\n    <Event Name="Start">\n      <Source><![CDATA[\n${escapeCdata(mainCode)}\n]]></Source>\n    </Event>\n  </Events>`;

    const varList: ExtractedVariable[] =
      code.variables.length > 0
        ? code.variables
        : code.parameters.map((p) => ({ name: `v${p.name}`, type: p.type, length: p.length, dec: '', isCollection: false }));
    const varsXml = varList.length > 0 ? `  <Variables>\n${varList.map(buildVariableXml).join('\n')}\n  </Variables>` : '';
    const rulesXml = buildRulesXml(code.rules);

    return `<?xml version="1.0" encoding="UTF-8"?>
<KBObject Type="${type}" Name="${safeName}" Description="${desc}">
${varsXml}
${eventsXml}
${rulesXml}
</KBObject>`;
  }

  // Procedure / Report / DataProvider / default
  const paramsXml =
    code.parameters.length > 0
      ? `  <Parameters>\n${code.parameters
          .map((p) => `    <Parameter Name="${escapeXml(p.name)}" Type="${escapeXml(p.type)}" Mode="${escapeXml(p.mode || 'In')}"/>`)
          .join('\n')}\n  </Parameters>`
      : '';
  const varsXml = code.variables.length > 0 ? `  <Variables>\n${code.variables.map(buildVariableXml).join('\n')}\n  </Variables>` : '';
  const rulesXml = buildRulesXml(code.rules);

  return `<?xml version="1.0" encoding="UTF-8"?>
<KBObject Type="${type}" Name="${safeName}" Description="${desc}">
${paramsXml}
${varsXml}
  <Source><![CDATA[
${escapeCdata(mainCode)}
  ]]></Source>
${rulesXml}
</KBObject>`;
}

function buildVariableXml(v: ExtractedVariable): string {
  const len = v.length ? ` Length="${escapeXml(v.length)}"` : '';
  const dec = v.dec ? ` Dec="${escapeXml(v.dec)}"` : '';
  const col = v.isCollection ? ' IsCollection="true"' : '';
  return `    <Variable Name="${escapeXml(v.name)}" Type="${escapeXml(v.type)}"${len}${dec}${col}/>`;
}

function buildRulesXml(rules: string): string {
  if (!rules) return '';
  const lines = rules
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  const items = lines.map((r) => `    <Rule Text="${escapeXml(r)}" Condition=""/>`).join('\n');
  return `  <Rules>\n${items}\n  </Rules>`;
}

/** Escapes `]]>` inside CDATA content so it can't prematurely close the block. */
export function escapeCdata(str: string): string {
  return str.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeName(name: string): string {
  return (name || 'object').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + 'GMT';
}
