# Contributing

Thanks for considering a contribution to `gxkb-toolkit`.

## Development setup

```bash
git clone https://github.com/<owner>/gxkb-toolkit.git
cd gxkb-toolkit
pnpm install
pnpm run check   # lint + build + test, all packages
```

Each package under `packages/` is independent: its own `package.json`,
`tsconfig.json`, `src/`, and `tests/`. Run a single package's scripts with
`pnpm --filter <package-name> run <script>`, e.g.:

```bash
pnpm --filter xpz-extract run test
```

## Conventions

- **TypeScript, strict mode.** Public functions get a TSDoc comment and
  explicit types — no `any` unless truly unavoidable.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), scoped to the package they
  touch when relevant, e.g. `feat(xpz-extract): support nested subtype groups`.
- **No proprietary data.** Never commit a real `.xpz` file, real client/table/
  attribute names, or anything derived from a customer's Knowledge Base.
  Fixtures must be synthetic — see `packages/xpz-extract/fixtures/`.
- **Tests required.** Changes to parsing or classification logic need a
  fixture-backed test in `tests/`. CI runs lint, build, and test on every push
  and pull request.

## Reporting issues

Open a GitHub issue with the tool name in the title (e.g.
`[xpz-extract] ...`), the GeneXus export format involved (GX9 or GX18), and a
minimal reproduction if possible. Since real KBs can't be attached, a small
synthetic snippet reproducing the shape of the problem is the most useful
thing you can include.

## Scope note

`folio-solver` is explicitly experimental (see its
[README](packages/folio-solver/README.md)). Contributions there should keep
that status honest rather than implying production-readiness.
