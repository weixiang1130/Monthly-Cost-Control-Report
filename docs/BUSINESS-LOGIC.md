# Business logic

## Cumulative income (the critical rule)

The cumulative income shown on screen is **not** read directly from the database — it is computed in the application layer:

```
cumulative_income_displayed
    = previous_month.AccRealAmt        (read from ProjectMonthlySummary)
    + this_month.TargetAmount           (user input, stored in MonthlyReportDesc)
```

This means:

- The user enters a single value (`TargetAmount`) for the current month.
- The displayed cumulative figure updates live as that value is edited.
- On save, only `TargetAmount` is written; the cumulative figure is **never persisted** as a column — it is always recomputed on read.

## Derived figures

| Field | Formula |
|---|---|
| Profit rate (original) | `(ContractAmt − BudgetAmt) / ContractAmt` |
| Profit rate (revised) | `(RevisedContractAmt − RevisedBudgetAmt) / RevisedContractAmt` |
| Cumulative diff | `cumulative_income_displayed − AccRealCost` |
| YTD cost diff | `YearEstCost − YearRealCost` |
| Paid ratio | `count(paid) / count(billed)` |
| Paid amount ratio | `sum(paid.Amount) / sum(billed.Amount)` |

## State machine

```
[Editable]  → user fills in fields, saves any time
    ↓ (admin runs month-close)
[Locked]    → entire month becomes read-only
    ↓ (admin unlocks for exception handling)
[Unlocked]  → editable again
```

There is no approval step. The locking model is enforced server-side; the prototype shows the visual states only.

## Roles

| Role | Permissions |
|---|---|
| Editor | Edit assigned projects, current month only |
| Admin | View all, lock/unlock months, manage permissions |
