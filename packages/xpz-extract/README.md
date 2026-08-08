# xpz-extract

**Status: Stable.** Extracts a GeneXus `.xpz` Knowledge Base export into a navigable, Git-friendly
code project — one Markdown file per object, plus a `manifest.json` for tooling and an
`AI_INSTRUCTIONS.md` for coding agents.

See the [root README](../../README.md) for why this exists and how it fits with
[`folio-solver`](../folio-solver).

## Install

From inside a clone of this monorepo:

```bash
pnpm install
pnpm --filter xpz-extract run build
node packages/xpz-extract/dist/cli.js --help
```

Or during development, run straight from TypeScript source (no build step):

```bash
cd packages/xpz-extract
pnpm run dev -- extract fixtures/sample-gx18.xpz -o /tmp/kb-extracted
```

## CLI

```bash
xpz-extract extract <file.xpz> -o <dir>   # write a full code project to <dir> (default ./kb-extracted)
xpz-extract info <file.xpz>               # print an object-count summary without writing anything
```

### Example, using the synthetic fixture

```bash
node dist/cli.js extract fixtures/sample-gx18.xpz -o /tmp/kb-extracted
```

```
Detected format: GX18
Extracted 3 objects into 7 files
Output: /tmp/kb-extracted
```

```
/tmp/kb-extracted/
├── README.md              # object-count summary for this extraction
├── AI_INSTRUCTIONS.md      # orientation doc for an AI coding agent working in this project
├── manifest.json           # every object's full structured data
└── objects/
    ├── README.md            # inventory index, grouped by type
    ├── Transaction/Customer.md
    ├── Procedure/GetCustomerBalance.md
    └── WebPanel/CustomerList.md
```

Each object file documents its structure (attributes/parameters/variables), GeneXus rules, event
source code, and any objects it references — see
[`docs/xpz-format.md`](../../docs/xpz-format.md) for what each section means and
[`examples/end-to-end-walkthrough.md`](../../examples/end-to-end-walkthrough.md) for a full
worked example.

## Library

```ts
import { extractKnowledgeBase, writeProject } from 'xpz-extract';
import { readFile } from 'node:fs/promises';

const buffer = await readFile('MyExport.xpz');
const result = extractKnowledgeBase(buffer); // { kbFormat, objects, warnings }
await writeProject(result, './kb-extracted', 'MyExport.xpz');
```

`extractKnowledgeBase` does the unzip → parse → classify pipeline in memory and returns
structured data; `writeProject` is the only part that touches the filesystem, so you can use the
classification result directly (e.g. to feed [`folio-solver`](../folio-solver)) without writing
anything to disk.

## Fixtures

`fixtures/` contains a minimal synthetic Knowledge Base (`Customer` transaction,
`GetCustomerBalance` procedure, `CustomerList` web panel) written for this project — not
exported from any real KB. It exists in both export formats:

- `fixtures/gx9-source/` / `fixtures/sample-gx9.xpz`
- `fixtures/gx18-source/` / `fixtures/sample-gx18.xpz`

Regenerate the `.xpz` files from the readable source XML after editing them:

```bash
pnpm run fixtures:build
```

## Development

```bash
pnpm run build   # tsc
pnpm run lint    # eslint
pnpm run test    # vitest
```
