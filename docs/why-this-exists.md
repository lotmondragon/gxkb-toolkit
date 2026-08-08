# Why this exists

GeneXus is a model-driven low-code platform: you describe data structures and business rules at a
high level, and it generates a working application (.NET, Java, Angular, whatever back end you
target) from that model. That's a real productivity win for the kind of CRUD-heavy line-of-business
systems it's aimed at. It also comes with a specific cost that this toolkit exists to work around.

## The Knowledge Base is the only source of truth, and it's opaque

Everything — every Transaction, every Procedure, every business rule, every line of event code —
lives inside the Knowledge Base, a proprietary store GeneXus's IDE reads and writes. There is no
first-class notion of "a file per object" the way there is in essentially every other modern
development stack. That single fact cascades into a list of things you simply cannot do without
extra tooling:

- **No granular version control.** GeneXus does have KB history/versioning features, but they're
  not Git, don't produce a readable diff of *what changed in this object's logic*, and don't
  interoperate with the code-review tooling (GitHub/GitLab PRs, `git blame`, `git bisect`) that
  every other part of a modern engineering org already uses.
- **No IDE choice.** You work in the GeneXus IDE, full stop. There's no way to open "the codebase"
  in VS Code, JetBrains, or anything else, because there's no codebase on disk to open.
- **No automated testing against the logic as text.** Unit-testing GeneXus rules/events requires
  either GeneXus's own (limited) testing facilities or a running, generated application — there's
  no way to, say, grep for every place a business rule references a given attribute, or run a
  linter over the actual rule text.
- **No AI coding agents.** This is the sharpest edge in 2026: tools like Claude Code, Cursor, and
  Copilot Workspace are built around a filesystem and a Git repository. Point one at a GeneXus KB
  and there is, quite literally, nothing to point it at.

## `.xpz` is the escape hatch, but it isn't a project

GeneXus does let you *export* a KB (or part of one) to a `.xpz` file. That's the only artifact that
ever leaves the IDE's proprietary storage — but it's a single dense XML blob (see
[`docs/xpz-format.md`](./xpz-format.md)) designed to be *re-imported by GeneXus*, not read by a
human or a tool. Opening it in a text editor gets you thousands of lines of `<GXObject>` or
`<KBObject>` markup with business logic buried inside CDATA sections and cross-referenced against a
separate KB-wide attribute catalog. It technically contains everything, but "contains" and "usable"
are different claims.

## What this toolkit does about it

`xpz-extract` takes that same `.xpz` — the one artifact GeneXus already gives you — and turns it
into what should have existed all along: a directory tree with one readable file per object, so
that everything downstream (Git, an IDE, tests, an AI agent) has something real to work with.
`folio-solver` is the first experiment built on top of that: once the KB is legible as a project,
"which objects does this ticket touch, and what needs to change" becomes a question an AI assistant
can meaningfully help answer — with the obvious caveat that GeneXus's XML format is unforgiving of
mistakes, hence its experimental status.

Neither tool changes how GeneXus itself works, and neither requires giving up the GeneXus IDE — the
extracted project is a read/plan layer that sits alongside it, not a replacement.
