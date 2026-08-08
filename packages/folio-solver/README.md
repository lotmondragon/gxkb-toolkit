# folio-solver

> **Status: Experimental.** This is a prototype, validated only with functional/manual testing
> against synthetic and real Knowledge Bases — it has **not** reached production status. Every
> command here is a *suggestion* for a developer to review, never an unattended change. Expect
> rough edges, and read [Limitations](#limitations) before pointing it at anything you care about.

AI-assisted triage for GeneXus support tickets ("folios"), built on top of an
[`xpz-extract`](../xpz-extract) manifest: given a folio's requirements, it suggests which KB
objects to create or modify, then generates a `.xpz` you can review and import.

## Prerequisites

- An [`xpz-extract`](../xpz-extract) `manifest.json` for the target KB (`xpz-extract extract ...`).
- An Anthropic API key in `ANTHROPIC_API_KEY`, or passed via `--api-key`.

## Install

```bash
pnpm install
pnpm --filter xpz-extract run build   # folio-solver depends on it
pnpm --filter folio-solver run build
```

## CLI

### 1. `plan` — what should change, and why

```bash
folio-solver plan \
  -m kb-extracted/manifest.json \
  -f folio-requirements.txt \
  -o plan.json
```

Sends a condensed inventory of the KB (object names + short descriptions, never full source) plus
the folio text to Claude, and asks for a structured plan: which objects to create or modify, and
why. **Review `plan.json` before running `apply`** — this is the step where a human should catch
a wrong or over-broad plan.

### 2. `apply` — generate and package the change

```bash
folio-solver apply \
  -m kb-extracted/manifest.json \
  -p plan.json \
  -o folio-changes.xpz
```

For each plan item, asks Claude to generate that object's code, then rebuilds it into valid GX9 or
GX18 XML (see [How generation stays safe](#how-generation-stays-safe) below) and packages every
generated object into one importable `.xpz`.

**Always review the generated XML — and ideally the objects it touches — in a test KB before
importing into anything real.**

## How generation stays safe

The naive approach — ask Claude for a complete `<KBObject>`/`<GXObject>` XML block and import it
verbatim — is fragile: Claude occasionally emits mismatched tags, or nests a whole extra XML
document inside a CDATA block. Trusting that structure directly is what turns "mostly works" into
"corrupts an import."

Instead, folio-solver **never parses Claude's response as XML**. It extracts only the pieces it
needs — CDATA bodies (source, rules, event code) and leaf-attribute values (`Name=`, `Type=`,
`Mode=`, ...) — via targeted pattern matching (`src/xmlExtract.ts`), then rebuilds guaranteed-valid
GX9/GX18 XML from those pieces using this project's own templates (`src/xmlBuilder.ts`). Malformed
structure in Claude's output simply never reaches the final file. This is the one piece of the
original prototype's design that testing specifically validated, so it's kept as-is here.

## Limitations

- **No live-KB feedback loop.** Generation is one-shot per object — there's no compile/import
  check in the loop, so a generated object can still be logically wrong even though it's
  structurally valid XML.
- **`modify` actions need the object's existing code in the manifest** to avoid regenerating (and
  potentially losing) logic that already exists. If `xpz-extract` couldn't fully parse an object,
  `apply` will say so rather than inventing content.
- **No cross-object consistency checking.** If a plan touches three objects, each is generated
  independently — nothing verifies they stay in sync with each other beyond what's in the prompt.
- **Attribute/domain generation is conservative.** New attributes are described inline on the
  Transaction rather than resolving to shared KB-wide Domains, since domain reuse requires broader
  KB context than a single manifest currently carries.
- **Not fuzz-tested against arbitrary folios.** Prompts and extraction were validated against a
  working set of realistic tickets, not an adversarial or exhaustive one.

## Development

```bash
pnpm run build   # tsc
pnpm run lint    # eslint
pnpm run test    # vitest — all tests use a fake Claude client, no API key or network needed
```
