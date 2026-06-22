# Changelog

All notable changes to the prototype are recorded here.

## [v0.3] — 2026-06-22

### Added
- `docs/ARCHITECTURE.md` rewritten with **9 mermaid diagrams**: current prototype system map, target Blazor Server architecture, read flow sequence, write flow sequence, month-lifecycle state machine, component diagram, ER diagram, phase roadmap, security boundaries.
- `docs/TECH-STACK.md` — comprehensive tech inventory for both current prototype and target production stack, plus the constraints that drove each choice.

### Changed
- `README.md` now includes a top-level mermaid "now → mid → then" map and points to the new architecture & tech-stack docs.

## [v0.2] — 2026-06-22

### Changed
- Removed the legacy "switch layout" and "month-close announcement" buttons from the top bar — out of scope for the new app.
- Each editable field now has its **own** save button:
  - Save monthly income (`TargetAmount`)
  - Save cost/income notes (`AmtDesc`)
  - Save warnings & actions (`SolDesc`)
- Added month selector to browse historical months per project.
- Added per-field unsaved indicator and global "all saved" / "unsaved changes" badge.
- Fixed date display: ISO date strings now render as `YYYY/MM/DD` consistently; legacy `/Date(ms)/` format is also parsed correctly.

### Added
- Dev panel (collapsible, bottom right) showing real-time calculation breakdown and pending UPSERT payload for each editable field.

## [v0.1] — 2026-06-22

### Added
- Initial standalone HTML/CSS/JS prototype.
- Layout reproducing the legacy app: top bar, three-column financial grid, two rich-text sections, payment summary, payment list, footer.
- Synthetic sample data for 10 projects with 12 months of history each.
- Live cumulative income recalculation as `TargetAmount` is edited.
- Microsoft Word style rich-text toolbar for the two HTML fields (bold/italic/underline/link/list/clear).
- Simulated save with toast feedback.
