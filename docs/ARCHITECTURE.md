# Architecture

## High-level

```
[Browser]
   ↓ (HTML/JS today, Blazor Server SignalR later)
[App Server (.NET 8)]
   ├─ Read repository  →  3 read-only views (financial summary, project attributes, payments)
   └─ Write repository →  1 write target table (MonthlyReportDesc)
                          ↓
                       [SQL Server]
```

Today the prototype only has the browser layer (static HTML+JS) with a JSON snapshot. The right-hand side is documented but not implemented.

## Data model (intent, names are generic)

### Read-only views

| View | Key | Purpose |
|---|---|---|
| `ProjectAttr` | `ProjectID` | Project metadata, contract & budget amounts, dates |
| `ProjectMonthlySummary` | `ProjectID` + `MonthEnd` | Per-month financial summary, cumulative roll-ups |
| `ProjectPayments` | `PayNo` | Payment line items, joined by `ProjectID` |

### Write target

| Table | Key | Columns |
|---|---|---|
| `MonthlyReportDesc` | `ProjectID` + `MonthEnd` | `TargetAmount` (float), `AmtDesc` (HTML), `SolDesc` (HTML), plus audit columns |

## Write pattern

Each editable field has its own save button. Pressing save runs a `MERGE` (UPSERT) keyed on `ProjectID + MonthEnd` that only updates the column for that field plus audit metadata.

## Read pattern

On project + month selection:

1. Fetch a row from `ProjectAttr` by `ProjectID`.
2. Fetch a row from `ProjectMonthlySummary` by `ProjectID + MonthEnd`.
3. Fetch the **previous month's row** from `ProjectMonthlySummary` (used for cumulative income calculation; see [BUSINESS-LOGIC.md](BUSINESS-LOGIC.md)).
4. Fetch `MonthlyReportDesc` for the same key (may be null on first edit).
5. Fetch `ProjectPayments` filtered by `ProjectID` and the current month range.

## Security boundaries

- All credentials and connection strings live on the server, never in the browser.
- HTML rich-text fields are sanitized on the server before insert/update (an HTML sanitizer that whitelists basic formatting tags).
- Authentication is intended to be Windows / Azure AD integrated; the prototype has no auth UI.
