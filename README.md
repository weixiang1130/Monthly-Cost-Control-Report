# Monthly Cost Report — Frontend Prototype

A standalone HTML/CSS/JS prototype that demonstrates the UX, layout, and business logic for a monthly cost-report data-entry tool, intended to replace a legacy Power Apps Canvas App. All sample data shown is synthetic; the prototype is not tied to any real database or organization.

## What it does

- Project selector + month selector
- Read-only financial figures sourced from a (mocked) reporting view
- Three independently saveable fields:
  - `TargetAmount` (monthly income)
  - `AmtDesc` (cost/income notes, HTML rich text)
  - `SolDesc` (warnings & actions, HTML rich text)
- Live recalculation: `cumulative income = previous month AccRealAmt + this month TargetAmount`
- Per-field unsaved indicator and toast on save
- Read-only payment list per project/month
- A floating dev panel that explains the calculation in real time

## How to run

Open `prototype/index.html` directly in any modern browser. No build step, no server, no Node required.

## Tech intent

This prototype is a stepping stone toward a server-side implementation in Blazor Server (.NET 8) with EF Core against SQL Server. The same component layout and business logic will carry over.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md) for the planned migration phases.

## Repo layout

```
prototype/
  index.html       — entry page
  style.css        — flat, form-style UI
  app.js           — state, calculation, save handlers
  mock-data.js     — synthetic projects, months, payments
docs/
  ARCHITECTURE.md  — read/write data flow
  BUSINESS-LOGIC.md — cumulative income formula
  ROADMAP.md       — 8-phase development plan
CHANGELOG.md
LICENSE
```

## Status

- [x] Layout & UX aligned with original legacy app
- [x] Three independent save buttons
- [x] Live cumulative recalculation
- [ ] Real DB integration (blocked on IT creating the target write table)
- [ ] Blazor Server migration (blocked on .NET SDK availability)

## License

MIT. See [LICENSE](LICENSE).
