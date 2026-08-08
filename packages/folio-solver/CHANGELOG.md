# Changelog

All notable changes to `folio-solver` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-08-07

### Added

- Initial experimental release: `plan` and `apply` CLI commands.
- `planChanges`: condenses an `xpz-extract` manifest into a token-conscious inventory and asks
  Claude for a structured change plan, validated with `zod`.
- `generateObject` + the extract/rebuild strategy in `xmlExtract.ts`/`xmlBuilder.ts`: Claude's
  raw output is never trusted as XML structure, only mined for CDATA/attribute content, which is
  then rebuilt into guaranteed-valid GX9/GX18 XML.
- `packageXpz`: wraps generated objects into an importable `.xpz` matching each format's real
  envelope (one `<ExportFile>` for GX9, one `<KBObject>` file per object for GX18).

### Known limitations

See the [README](./README.md#limitations) — this is a prototype validated with functional
testing, not a production tool.
