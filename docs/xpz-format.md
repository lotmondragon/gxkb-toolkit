# The `.xpz` format

A `.xpz` file is GeneXus's export format for a Knowledge Base (or a subset of one, filtered by
module/object selection at export time). Structurally, it's just a **ZIP archive** containing one
or more XML files — `xpz-extract`'s first step (`zip.ts`) is a plain unzip, nothing GeneXus-specific
about it yet.

The XML inside is where it gets format-specific. GeneXus has exported KBs in two incompatible
shapes across its versions, and both are still encountered in the wild:

## GX9 — `<ExportFile>` / `<GXObject>`

Older GeneXus versions (and some newer ones configured for legacy export compatibility) produce
one `<ExportFile>` root containing a `<GXObject>` element per KB object, plus a KB-wide
`<Attributes>` catalog:

```xml
<ExportFile>
  <Model>...</Model>
  <GXObject>
    <Transaction>
      <Info><Name>Customer</Name><Description>...</Description></Info>
      <Structure>
        <Source><![CDATA[
CustomerId*
CustomerName
        ]]></Source>
      </Structure>
      <Rules><![CDATA[
Serial(CustomerId, LastCustomerId, 1);
      ]]></Rules>
    </Transaction>
  </GXObject>
  <!-- more <GXObject> entries... -->
  <Attributes>
    <GXAtt><Attribute><Name>CustomerId</Name><Type>Numeric</Type><Length>8</Length></Attribute></GXAtt>
    <!-- one <GXAtt> per attribute in the whole KB -->
  </Attributes>
</ExportFile>
```

Characteristics:

- **CDATA-heavy.** A Transaction's structure, an object's rules, and a WebPanel's events are all
  plain text inside `<![CDATA[...]]>` blocks, not nested XML elements. Attribute *types* live
  separately, in the KB-wide `<Attributes>` catalog — a Transaction's own `<Structure>` only lists
  attribute *names* (with a trailing `*` marking a primary key), so `xpz-extract` cross-references
  the two to fill in type/length/domain.
- **Web layout is enormous.** `<HTMLForm>`/`<Webform>` sections can be 60-80% of a file's size and
  are full of `&nbsp;`/`&quot;` entities — `xpz-extract` strips them before parsing (after rescuing
  any event code nested inside, which some GX9 variants store there instead of at the top level).
- One `<ExportFile>` can contain the entire KB, so a single `.xpz` for a large KB may unzip to one
  multi-hundred-megabyte XML file.

## GX18 — `<KBObject>`

Newer GeneXus versions export one `<KBObject>` XML per object, attribute-based rather than
CDATA-based:

```xml
<KBObject Type="Transaction" Name="Customer" Description="...">
  <Structure>
    <Level Name="Customer">
      <Attribute Name="CustomerId" Type="Numeric" Length="8" IsPK="true"/>
      <Attribute Name="CustomerName" Type="Character" Length="60"/>
    </Level>
  </Structure>
  <Rules>
    <Rule Text="Serial(CustomerId, LastCustomerId, 1);" Condition=""/>
  </Rules>
</KBObject>
```

Characteristics:

- **Attribute-based**, not CDATA-based, for structural data — a Transaction's attributes,
  a Procedure's parameters, a WebPanel's declared variables are all XML attributes on their own
  elements, not text blobs.
- **Still uses CDATA for actual code** — `<Source>` and `<Event><Source>` content is GeneXus
  procedural code, wrapped in CDATA same as GX9.
- **Variables must be declared explicitly.** Unlike GX9, GX18 requires every `&variable` used in
  code to have a matching `<Variable Name="..." Type="..."/>` entry — GeneXus doesn't infer them.
- One `.xpz` typically contains one file per object, so a large KB export unzips to thousands of
  small files rather than one giant one.

## Format detection

`xpz-extract` detects the format per file (checking for an `<ExportFile>` root) and reports the
KB's overall format as whichever shape a majority of its files use — a `.xpz` is not expected to
mix both, but the detection is per-file defensively rather than assumed from the first file.

## What `xpz-extract` does with either shape

Both formats get normalized into the same internal `GxObject` shape (see
`packages/xpz-extract/src/types.ts`) before being written out — the Markdown files and
`manifest.json` you get from `xpz-extract extract` look identical regardless of which format the
source KB used.
