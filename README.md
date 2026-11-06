# gxkb-toolkit

Modern tooling for GeneXus Knowledge Bases — Git, IDEs, tests, and AI coding agents where GeneXus gives you none of them.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/lotmondragon/gxkb-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/lotmondragon/gxkb-toolkit/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

Español: [README.es.md](./README.es.md)

## The problem

GeneXus stores an entire application — Transactions, Procedures, WebPanels, business rules,
event code — inside one opaque Knowledge Base. There's no per-object file on disk to point a
normal IDE at, no granular `git diff`, no way to run a test suite against the logic, and no way
to point an AI coding agent at "the codebase" — because outside of GeneXus itself, there isn't
one. `.xpz` exports are the only escape hatch, and they're a single dense XML blob, not a
project. This toolkit turns that blob into one.

## Tools

| Tool | What it does | Status | |
|---|---|---|---|
| [`xpz-extract`](./packages/xpz-extract) | Parses a `.xpz` Knowledge Base export and reconstructs it as a navigable, Git-friendly code project | **Stable** | [→](./packages/xpz-extract) |
| [`folio-solver`](./packages/folio-solver) | AI-assisted triage: given a support ticket and an `xpz-extract` manifest, suggests which objects to change and generates an importable `.xpz` | **Experimental** | [→](./packages/folio-solver) |

## Quick start

```bash
git clone https://github.com/lotmondragon/gxkb-toolkit.git
cd gxkb-toolkit
pnpm install
pnpm --filter xpz-extract run build

# Extract the synthetic example KB shipped in fixtures/
node packages/xpz-extract/dist/cli.js extract \
  packages/xpz-extract/fixtures/sample-gx18.xpz \
  -o kb-extracted

ls kb-extracted/objects/Transaction   # Customer.md
cat kb-extracted/AI_INSTRUCTIONS.md   # what to hand an AI coding agent
```

Or run it straight from source with the global CLI installed via `pnpm link`, or through `npx tsx`
during development — see [`packages/xpz-extract/README.md`](./packages/xpz-extract/README.md) for
every install path.

## How KB tooling fits together

```mermaid
flowchart LR
  KB[GeneXus Knowledge Base] -->|Export| XPZ[.xpz file]
  XPZ --> Extract[xpz-extract]
  Extract --> Project[Navigable code project]
  Project --> IDE[IDE]
  Project --> Git[Git / GitHub]
  Project --> Tests[Automated tests]
  Project --> Agent[AI coding agent]
  Project -.manifest.json.-> Folio[folio-solver — experimental]
  Ticket[Support ticket] --> Folio
  Folio -.generates.-> NewXpz[.xpz with proposed change]
  NewXpz -.import.-> KB
```

`xpz-extract` is the foundation both tools and every downstream workflow build on.
`folio-solver` consumes its output; it does not re-parse `.xpz` files itself. See
[`docs/architecture.md`](./docs/architecture.md) for how the two packages relate.

## How it works

`xpz-extract` runs a three-stage pipeline (see [`docs/xpz-format.md`](./docs/xpz-format.md) for the
full format reference):

1. **Unzip** — a `.xpz` is a ZIP archive; each entry is decoded from its declared XML encoding
   (GeneXus exports are frequently `iso-8859-1`/`windows-1252`, not UTF-8).
2. **Parse** — GeneXus exports come in two incompatible XML shapes that must both be handled:
   **GX9** (`<ExportFile><GXObject>`, CDATA-heavy) and **GX18** (`<KBObject>`, attribute-based).
   The format is auto-detected per file. GX9's web-layout sections are stripped before parsing —
   they're routinely 60-80% of a file's size and full of the stray HTML entities that break XML
   parsers.
3. **Classify & write** — every object is normalized into one shape (attributes, rules, events,
   parameters, source) regardless of which format it came from, then rendered as one Markdown
   file per object plus a `manifest.json` with the same data as structured JSON.

## Limitations

Read this before trusting the output on a real KB:

- **Object types covered**: Transaction, Procedure, WebPanel, WorkPanel, Report, SDT,
  DataProvider, Table, Domain, BusinessComponent, ExternalObject, WebService, Module. Anything
  else lands in a generic `Other` bucket with just its name/description.
- **No cross-object foreign-key inference.** GeneXus infers FKs implicitly (reusing another
  Transaction's PK attribute name), but `xpz-extract` does not currently compute this — each
  object's attributes are reported as declared, not cross-referenced.
- **`References` are heuristic**, extracted via regex over `Call()`, `Udp()`, `new X()`,
  `For Each X`, and `Do 'X'` patterns. They're a hint for navigation, not a verified dependency
  graph.
- **Very large exports (100+ MB)** are parsed fully in-memory; there's no streaming path yet (see
  Roadmap).
- **`folio-solver` is explicitly experimental** — see its own README before using it on anything
  you care about.
- Tested against **GeneXus 9 and GeneXus 18** export shapes. Older/newer format variants may
  need adjustments to the parser's format detection.

## Roadmap

- [ ] Streaming extraction for very large (100+ MB) `.xpz` exports
- [ ] Cross-object foreign-key inference in the manifest
- [ ] A `--diff` mode: compare two extractions of the same KB across export dates
- [ ] Expand `folio-solver`'s validated test coverage toward a "beta" status
- [ ] Additional object types (Pattern-generated objects, Themes) in the classifier

## This toolkit is generic

Both packages are provider-agnostic tooling with **no proprietary code, client names, or
production data** anywhere in this repository. All fixtures under `packages/xpz-extract/fixtures/`
are a synthetic Knowledge Base (`Customer` / `GetCustomerBalance` / `CustomerList`) written for
this project — not exported from any real KB. Nothing here requires access to a specific
organization's GeneXus environment to build, test, or use.

## License

[MIT](./LICENSE)
