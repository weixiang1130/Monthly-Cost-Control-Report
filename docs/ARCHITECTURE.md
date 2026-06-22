# Architecture

This document describes the complete architecture of the Monthly Cost Report system, both the **current prototype** (static HTML/JS) and the **target production architecture** (Blazor Server).

---

## 1. System Architecture — Current Prototype (v0.2)

The prototype runs entirely in the browser. No server, no build step, no network calls.

```mermaid
flowchart TB
    User([User])
    Browser["Browser<br/>(Chrome / Edge)"]

    subgraph Static["Static Files (file://)"]
        HTML["index.html<br/>Layout, sections, controls"]
        CSS["style.css<br/>Flat form-style UI"]
        JS["app.js<br/>State, render, save handlers"]
        Data["mock-data.js<br/>Synthetic JSON snapshot"]
    end

    User -->|interacts| Browser
    Browser -->|loads| HTML
    HTML -->|<link>| CSS
    HTML -->|<script>| JS
    HTML -->|<script>| Data
    JS -->|reads| Data
    JS -->|simulates UPSERT| JS

    style Static fill:#fff5e6,stroke:#a14a00
```

**Key characteristics:**
- Single-file deployment — just copy the folder
- No persistence — refresh clears edits (intentional for prototype)
- Save is simulated and logged to `console.log`

---

## 2. System Architecture — Target Production (Blazor Server)

```mermaid
flowchart TB
    User([Internal User])
    Browser["Browser<br/>HTTPS + SignalR"]

    subgraph AppHost["IIS / Kestrel on Windows Server (intranet)"]
        Auth["Auth Middleware<br/>Windows Auth / Azure AD"]

        subgraph BlazorApp[".NET 8 Blazor Server App"]
            Pages["Pages / Components<br/>(.razor)"]
            Services["Services<br/>Business logic, validation"]
            Sanitizer["HTML Sanitizer<br/>(HtmlSanitizer NuGet)"]
            ReadRepo["Read Repository<br/>3 read-only views"]
            WriteRepo["Write Repository<br/>1 write-target table"]
        end

        Data["EF Core / Dapper"]
    end

    subgraph SQLServer["SQL Server"]
        Views["3 Views<br/>ProjectAttr<br/>ProjectMonthlySummary<br/>ProjectPayments"]
        WriteTable["1 Table<br/>MonthlyReportDesc"]
    end

    User --> Browser
    Browser -->|WebSocket| Auth
    Auth --> Pages
    Pages --> Services
    Services --> Sanitizer
    Services --> ReadRepo
    Services --> WriteRepo
    ReadRepo --> Data
    WriteRepo --> Data
    Data --> Views
    Data --> WriteTable

    style BlazorApp fill:#e6f1fb,stroke:#185fa5
    style SQLServer fill:#eaf3de,stroke:#3b6d11
```

**Why Blazor Server over a SPA:**
- No JavaScript build toolchain needed (no Node, no npm)
- End-to-end C# (single language, one team can maintain)
- Native Windows Auth / Azure AD integration
- Intranet deployment makes SignalR latency a non-issue
- A single .NET project compiles & deploys as one unit

---

## 3. Read Flow (sequence)

```mermaid
sequenceDiagram
    actor User
    participant UI as Blazor Page
    participant Svc as Service Layer
    participant Read as Read Repository
    participant DB as SQL Server

    User->>UI: Select project + month
    UI->>Svc: GetReport(projectId, monthEnd)

    par Parallel reads
        Svc->>Read: GetProjectAttr(projectId)
        Read->>DB: SELECT FROM ProjectAttr
        DB-->>Read: row
    and
        Svc->>Read: GetMonthSummary(projectId, monthEnd)
        Read->>DB: SELECT FROM ProjectMonthlySummary
        DB-->>Read: row
    and
        Svc->>Read: GetMonthSummary(projectId, prevMonthEnd)
        Read->>DB: SELECT prev month
        DB-->>Read: row (for cumulative income calc)
    and
        Svc->>Read: GetDesc(projectId, monthEnd)
        Read->>DB: SELECT FROM MonthlyReportDesc
        DB-->>Read: row or null
    and
        Svc->>Read: GetPayments(projectId, monthRange)
        Read->>DB: SELECT FROM ProjectPayments
        DB-->>Read: rows
    end

    Svc->>Svc: Compose view model<br/>Apply cumulative formula
    Svc-->>UI: ReportViewModel
    UI->>UI: Render
    UI->>User: Display
```

---

## 4. Write Flow (sequence) — Per-field Save

Each editable field has its own save button. Each save is an independent partial UPSERT.

```mermaid
sequenceDiagram
    actor User
    participant UI as Blazor Page
    participant Val as Validator
    participant San as HTML Sanitizer
    participant Svc as Service
    participant Write as Write Repository
    participant DB as SQL Server

    User->>UI: Edit field, click Save (for one field)
    UI->>Val: Validate input
    alt invalid
        Val-->>UI: error
        UI->>User: Show inline error
    else valid
        opt HTML field
            UI->>San: Sanitize HTML (strip dangerous tags)
            San-->>UI: clean HTML
        end
        UI->>Svc: SaveField(key, fieldName, value, audit)
        Svc->>Write: Upsert(key, partial: {fieldName: value})
        Write->>DB: MERGE MonthlyReportDesc<br/>WHEN MATCHED UPDATE the column<br/>WHEN NOT MATCHED INSERT row
        DB-->>Write: ok
        Write-->>Svc: ok
        Svc-->>UI: success
        UI->>User: Toast: "Saved [field name]"
        UI->>UI: Clear field dirty flag<br/>Update lastSaved timestamp
    end
```

---

## 5. State Machine — Month Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Editable: Month opens
    Editable --> Editable: User edits + saves (any time)
    Editable --> Locked: Admin runs<br/>month-close
    Locked --> Unlocked: Admin unlocks<br/>(exception handling)
    Unlocked --> Locked: Admin re-locks

    note right of Editable
        Default state for the current month.
        All three editable fields accept input.
    end note

    note right of Locked
        Read-only. UI shows lock badge.
        No save buttons render.
    end note
```

---

## 6. Component Diagram — Current Prototype

```mermaid
flowchart TB
    subgraph HTML["index.html"]
        Banner["Banner (status + meta)"]
        TopBar["Top bar<br/>Project select / Month / Save status"]
        Grid["6-row financial grid<br/>(read-only)"]
        Edit1["Editable block 1<br/>TargetAmount + Save button"]
        Edit2["Editable block 2<br/>AmtDesc rich text + Save button"]
        PayKPI["Payment KPIs (4 figures)"]
        PayTable["Payment table"]
        Edit3["Editable block 3<br/>SolDesc rich text + Save button"]
        Footer["Footer"]
        DevPanel["Dev panel (floating, collapsible)"]
    end

    subgraph JS["app.js"]
        State["state object<br/>currentProjectId, currentMonthEnd,<br/>targetAmount, amtDesc, solDesc,<br/>dirty flags, lastSaved times"]
        Fmt["formatters<br/>num / pct / date / rocDate"]
        Calc["business logic<br/>profit rate, cumulative income"]
        Render["render functions<br/>render, renderPayments, renderDevPanel"]
        Handlers["save handlers<br/>setupSaveButton(target, amt, sol)"]
    end

    subgraph DATA["mock-data.js"]
        Projects["10 synthetic projects"]
        Months["120 month-summary rows"]
        Payments["~110 payment records"]
    end

    HTML --> JS
    JS --> DATA
```

---

## 7. Data Model (intent — names are deliberately generic)

### Read-only views (existing in DB)

| View | Key | Purpose |
|---|---|---|
| `ProjectAttr` | `ProjectID` | Project metadata, contract & budget amounts, dates |
| `ProjectMonthlySummary` | `ProjectID` + `MonthEnd` | Per-month financial summary, cumulative roll-ups |
| `ProjectPayments` | `PayNo` | Payment line items (joined by `ProjectID`) |

### Write target (to be created)

| Table | Key | Columns |
|---|---|---|
| `MonthlyReportDesc` | `ProjectID` + `MonthEnd` | `TargetAmount` (float), `AmtDesc` (HTML), `SolDesc` (HTML), plus audit columns |

### Entity-relationship

```mermaid
erDiagram
    ProjectAttr ||--o{ ProjectMonthlySummary : "has many"
    ProjectAttr ||--o{ ProjectPayments : "has many"
    ProjectAttr ||--o{ MonthlyReportDesc : "has many"
    ProjectMonthlySummary ||--o| MonthlyReportDesc : "1-1 per month"

    ProjectAttr {
        nvarchar ProjectID PK
        nvarchar ProjectName
        nvarchar ProjectStatus
        float ContractAmt
        float ContractRevisedAmt
        float BudgetAmt
        float BudgetRevisedAmt
        date ExpStartDate
        date ExpEndDate
        date ExtentionEndDate
    }

    ProjectMonthlySummary {
        nvarchar ProjectID PK
        char MonthEnd PK
        float RealAmt
        float RealCost
        float AccRealAmt
        float AccRealCost
        decimal AccRealCostRate
        float YearEstCost
        float YearRealCost
        decimal YearCostExecRate
    }

    ProjectPayments {
        nvarchar PayNo PK
        nvarchar ProjectID FK
        nvarchar VendorName
        nvarchar ContractName
        bit IsPay
        bit IsBill
        float Amount
        nvarchar PayDate
    }

    MonthlyReportDesc {
        nvarchar ProjectID PK
        char MonthEnd PK
        float TargetAmount
        nvarchar AmtDesc
        nvarchar SolDesc
        bit Active
        datetime CreateDate
        nvarchar CreateUserID
        datetime UpdDate
        nvarchar UpdUserID
    }
```

---

## 8. Phase Roadmap

```mermaid
flowchart LR
    P0[Phase 0<br/>Discovery] -->|done| P1[Phase 1<br/>Data Contract]
    P1 -->|main line| P5[Phase 5<br/>Real DB Integration]
    P0 -.->|side line| P2[Phase 2<br/>Data Models]
    P2 --> P3[Phase 3<br/>App Scaffold]
    P3 --> P4[Phase 4<br/>UI Implementation]
    P4 --> P5
    P5 --> P6[Phase 6<br/>Test + Data Migration]
    P6 --> P7[Phase 7<br/>Deploy]

    classDef done fill:#c8e6c9,stroke:#2e7d32
    classDef active fill:#fff4e5,stroke:#ef6c00
    classDef pending fill:#e3f2fd,stroke:#1565c0
    class P0 done
    class P1 active
    class P2,P3,P4,P5,P6,P7 pending
```

The **main line** (Phase 1 → 5 → 6 → 7) is the critical path and depends on backend readiness. The **side line** (Phase 2 → 3 → 4) can proceed in parallel using mock data — this is what the current prototype represents.

---

## 9. Security Boundaries

- Connection strings, credentials, and tokens live **only** on the server, never in the browser.
- HTML rich-text fields are sanitized server-side before insert/update — a whitelist of formatting tags (`b`, `i`, `u`, `p`, `ul`, `ol`, `li`, `a`, `br`).
- All write operations include audit metadata (`CreateUserID`, `UpdUserID`) populated from the authenticated SSO identity.
- Row-level access control: the read repository filters projects by the user's department or assignment list (driven by an `IsActiveAssignee(userId, projectId)` predicate).
