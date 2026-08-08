# End-to-end walkthrough

This walks through both packages against the synthetic KB shipped in
`packages/xpz-extract/fixtures/` — a minimal, invented Knowledge Base (`Customer` transaction,
`GetCustomerBalance` procedure, `CustomerList` web panel) written for this project. Every command
below is copy-pasteable from a fresh clone.

## Setup

```bash
git clone https://github.com/122043254/gxkb-toolkit.git
cd gxkb-toolkit
pnpm install
pnpm --filter xpz-extract run build
```

## Part 1 — extract the synthetic KB

```bash
node packages/xpz-extract/dist/cli.js extract \
  packages/xpz-extract/fixtures/sample-gx18.xpz \
  -o /tmp/kb-extracted
```

Output:

```
Detected format: GX18
Extracted 3 objects into 7 files
Output: /tmp/kb-extracted
```

Look at what got written:

```bash
cat /tmp/kb-extracted/objects/README.md
```

```markdown
# Object inventory

## Transaction (1)

- [Customer](./Transaction/Customer.md)

## Procedure (1)

- [GetCustomerBalance](./Procedure/GetCustomerBalance.md)

## WebPanel (1)

- [CustomerList](./WebPanel/CustomerList.md)
```

And one object file in full:

```bash
cat /tmp/kb-extracted/objects/Transaction/Customer.md
```

`````markdown
# Customer

**Type:** Transaction
**Source file:** Customer.xml

Customer master data.

## Structure

| Attribute | Type | PK | FK | Nullable | Domain | Level |
|---|---|---|---|---|---|---|
| CustomerId | Numeric | Y |  | N | — | Root |
| CustomerName | Character |  |  | Y | — | Root |
| CustomerEmail | Character |  |  | Y | — | Root |
| CustomerBalance | Numeric |  |  | Y | — | Root |

## Rules

```genexus
Serial(CustomerId, LastCustomerId, 1);
Required(CustomerName);
```
`````

At this point `/tmp/kb-extracted` is a normal directory: open it in an editor, `git init` it,
point an AI coding agent at it (see
[`docs/usage-with-ai-agents.md`](../docs/usage-with-ai-agents.md)) — it behaves like any other
small project.

## Part 2 — plan a folio with `folio-solver` (experimental)

This part needs `ANTHROPIC_API_KEY` set and makes real API calls — skip it if you just want to see
`xpz-extract`'s output.

```bash
pnpm --filter folio-solver run build

echo "Customers need an IsActive flag so inactive accounts can be filtered out of CustomerList." \
  > /tmp/folio.txt

node packages/folio-solver/dist/cli.js plan \
  -m /tmp/kb-extracted/manifest.json \
  -f /tmp/folio.txt \
  -o /tmp/plan.json

cat /tmp/plan.json
```

Expect something like:

```json
{
  "summary": "Add an IsActive flag to Customer and filter it out in CustomerList.",
  "items": [
    { "objectName": "Customer", "objectType": "Transaction", "action": "modify", "reason": "needs the new IsActive attribute" },
    { "objectName": "CustomerList", "objectType": "WebPanel", "action": "modify", "reason": "needs to filter on IsActive" }
  ]
}
```

**Read the plan before continuing.** This is the review point — if it's targeting the wrong
objects or missed something, fix `plan.json` by hand or refine the folio text and re-run `plan`.

## Part 3 — generate and package the change

```bash
node packages/folio-solver/dist/cli.js apply \
  -m /tmp/kb-extracted/manifest.json \
  -p /tmp/plan.json \
  -o /tmp/folio-changes.xpz
```

```
Generating Customer (modify)...
Generating CustomerList (modify)...

Wrote /tmp/folio-changes.xpz with 2 object(s).
This is EXPERIMENTAL output — review the XML before importing it into a real KB.
```

`/tmp/folio-changes.xpz` is a ZIP with one `<KBObject>` XML per generated object (GX18) or a single
`<ExportFile>` (GX9), built entirely from this project's own XML templates — see
[`packages/folio-solver/README.md#how-generation-stays-safe`](../packages/folio-solver/README.md#how-generation-stays-safe)
for why that matters. Inspect it before importing:

```bash
unzip -p /tmp/folio-changes.xpz Customer.xml
```

## What this walkthrough intentionally skips

It doesn't cover importing the generated `.xpz` back into an actual GeneXus IDE — that step is
identical to importing any other `.xpz` GeneXus produces, and this repository has no real KB to
demonstrate it against (see the root README's note on why fixtures are synthetic).
