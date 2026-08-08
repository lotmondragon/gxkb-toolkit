import type { KbFormat } from 'xpz-extract';

/**
 * Condensed GeneXus XML export rules for the code-generation prompt. These
 * are the load-bearing rules that made generated objects actually importable
 * during testing — getting any of them wrong is the most common way a
 * generated .xpz fails to import or imports with no real logic.
 */
export function buildSystemPrompt(kbFormat: KbFormat): string {
  const formatRules =
    kbFormat === 'gx9'
      ? `GX9 format specifics:
- Root per object: <GXObject><Transaction>|<Procedure>|<WebPanel>|...
- Parm() ALWAYS goes in <Rules>, as one CDATA block with plain-text rule lines — never in <Source>.
- Transaction structure is plain text inside <Structure><Source><![CDATA[...]]>, one attribute per line,
  trailing "*" marks a primary key (e.g. "CustomerId*").
- WebPanel/WorkPanel: <Events> (CDATA, "Event Name ... EndEvent" blocks) and <Rules> (CDATA) are direct
  siblings — there is no <Layout> and no <EventsAndRules> wrapper.
- Procedure/Report/DataProvider: real code goes in <Layout><Block><CodeBlock><Source><![CDATA[...]]>.
- SDT: members go in <SDTXml><Source><![CDATA[<types><CGxExpandClassDef>...]]> — never <Structure><Attr/>.`
      : `GX18 format specifics:
- Root per object: <KBObject Type="Transaction|Procedure|WebPanel|..." Name="..." Description="...">
- Parm() ALWAYS goes in <Rules><Rule Text="Parm(in:&amp;x, out:&amp;y);" Condition=""/> — never in <Source>.
- Every &variable used in Source/Events MUST be declared in <Variables><Variable Name="v" Type="..."/>
  — GeneXus does not infer undeclared variables on import.
- Transaction structure: <Structure><Level Name="..."><Attribute Name="..." Type="..." IsPK="true"/></Level></Structure>.
- WebPanel: events are <Events><Event Name="Start"><Source><![CDATA[...]]></Source></Event></Events>;
  user-defined events are quoted, e.g. Name="'Search'"; system events (Start, Refresh, Load) are not.
- SDT: <Members><Member Name="..." Type="..." IsCollection="true"/></Members>.`;

  return `You generate GeneXus Knowledge Base objects as XML for import.

Critical rules (apply to both formats unless noted):
- ALL GeneXus code (rules, source, events) must be inside <![CDATA[...]]>. The characters & and < are
  illegal in XML outside CDATA.
- In XML ATTRIBUTES (e.g. Text="..."), & must be written as &amp;. Never put a raw GeneXus variable
  reference in an attribute value.
- Rules (Parm, Required, Default, ...) are declarative and belong in <Rules>. Source/Events are
  imperative code. Never mix the two, and never put Parm() in <Source>.
- When asked to "modify" an existing object, reproduce ALL of its existing logic verbatim except for
  the specific change requested. Never write a placeholder comment like "// unchanged" in place of
  real code that already exists.
- Output ONLY the XML for the one object requested — no markdown fences, no explanation.

${formatRules}`;
}
