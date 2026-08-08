# Changelog

All notable changes to `xpz-extract` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-08-07

### Added

- Initial release: unzip → parse → classify → write-project pipeline for `.xpz` Knowledge Base
  exports.
- Auto-detection of GX9 (`<ExportFile><GXObject>`) vs GX18 (`<KBObject>`) export formats.
- Classification of Transaction, Procedure, WebPanel, WorkPanel, Report, SDT, DataProvider,
  Table, Domain, BusinessComponent, ExternalObject, WebService, and Module objects.
- Per-object Markdown output, a `manifest.json`, an `AI_INSTRUCTIONS.md`, and an inventory index.
- `extract` and `info` CLI commands.
- Synthetic GX9 and GX18 fixtures with a matching `.xpz` builder script.
