# Using an extracted KB with an AI coding agent

This is the end-to-end flow from a `.xpz` file to an AI agent (Claude Code, Cursor, or similar)
that can meaningfully answer questions about — or help plan changes to — a GeneXus Knowledge Base.

## 1. Extract the KB

```bash
xpz-extract extract MyKB.xpz -o my-kb-project
```

This produces a directory with:

```
my-kb-project/
├── README.md              # object-count summary
├── AI_INSTRUCTIONS.md      # orientation doc — read this first
├── manifest.json           # every object's full structured data
└── objects/
    ├── README.md            # inventory index, grouped by type
    └── <Type>/<ObjectName>.md
```

## 2. Point the agent at `my-kb-project/`

Open the extracted directory as a normal project — in Claude Code, that's simply starting a
session with `my-kb-project` as the working directory (or `cd`-ing into it). Two things make this
work better than pointing an agent at a raw `.xpz`:

- **`AI_INSTRUCTIONS.md` is written for exactly this.** It explains the layout, what GeneXus's
  `&variable`/`Parm()`/`Rules`-vs-`Events` conventions mean, and what "References" at the bottom
  of an object file do and don't guarantee. Most agents will read a root-level instructions file
  unprompted; if yours doesn't, paste its contents into the first message.
- **`manifest.json` is grep/search-friendly.** An agent (or you) can search it directly for an
  attribute or object name instead of guessing which Markdown file to open first.

## 3. Ask real questions

Once the agent has the project in context, the kinds of questions that were previously "open
GeneXus and go looking" become ordinary codebase questions:

- *"Which objects reference the `CustomerBalance` attribute?"* — grep `objects/` or `manifest.json`.
- *"What does the `Refresh` event on `CustomerList` do?"* — read `objects/WebPanel/CustomerList.md`.
- *"If I add an `IsActive` flag to `Customer`, what else might need to change?"* — the agent can
  follow the heuristic `References` links from `Customer.md` to find likely callers, same as it
  would follow imports in any other codebase (with the same caveat that they're heuristic — see
  the root README's Limitations section).

## 4. Planning a change: where `folio-solver` picks up

`xpz-extract`'s output is read-only documentation-as-code — there's no way to "run" or re-import
it. If the next step is an actual GeneXus-importable change, that's what
[`folio-solver`](../packages/folio-solver) is for: it takes the same `manifest.json` plus a ticket
description and produces a change plan and a candidate `.xpz`, which a developer reviews before
importing. See its README for the full workflow and its explicit experimental-status caveats.

If you're just using the extracted project for read-oriented work — code review prep, onboarding
a new developer, answering "where is X" questions, documentation — step 3 above is the whole
workflow, and `folio-solver` isn't needed at all.
