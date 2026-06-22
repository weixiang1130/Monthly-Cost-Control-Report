# 系統架構

本文件描述月報成本控制系統的完整架構,包含 **當前原型**(靜態 HTML/JS)與 **目標正式版**(Blazor Server)。

---

## 1. 系統架構 — 當前原型 (v0.2)

原型完全在瀏覽器內執行。沒有伺服器、沒有建置步驟、沒有網路呼叫。

```mermaid
flowchart TB
    User([使用者])
    Browser["瀏覽器<br/>(Chrome / Edge)"]

    subgraph Static["靜態檔案 (file://)"]
        HTML["index.html<br/>版面、區段、控制項"]
        CSS["style.css<br/>表單式扁平 UI"]
        JS["app.js<br/>狀態、渲染、存檔處理"]
        Data["mock-data.js<br/>合成 JSON 快照"]
    end

    User -->|互動| Browser
    Browser -->|載入| HTML
    HTML -->|<link>| CSS
    HTML -->|<script>| JS
    HTML -->|<script>| Data
    JS -->|讀取| Data
    JS -->|模擬 UPSERT| JS

    style Static fill:#fff5e6,stroke:#a14a00
```

**特性:**
- 單一資料夾部署 — 複製整個資料夾即可
- 不做持久化 — 重新整理就清空(原型刻意如此)
- 儲存為模擬,寫到 `console.log`

---

## 2. 系統架構 — 目標正式版 (Blazor Server)

```mermaid
flowchart TB
    User([內部使用者])
    Browser["瀏覽器<br/>HTTPS + SignalR"]

    subgraph AppHost["Windows Server 內網(IIS / Kestrel)"]
        Auth["認證中介層<br/>Windows Auth / Azure AD"]

        subgraph BlazorApp[".NET 8 Blazor Server App"]
            Pages["Pages / Components<br/>(.razor)"]
            Services["Services<br/>商業邏輯與驗證"]
            Sanitizer["HTML Sanitizer<br/>(HtmlSanitizer NuGet)"]
            ReadRepo["Read Repository<br/>3 個唯讀 view"]
            WriteRepo["Write Repository<br/>1 張寫入目標表"]
        end

        Data["EF Core / Dapper"]
    end

    subgraph SQLServer["SQL Server"]
        Views["3 個 View<br/>ProjectAttr<br/>ProjectMonthlySummary<br/>ProjectPayments"]
        WriteTable["1 個 Table<br/>MonthlyReportDesc"]
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

**為什麼選 Blazor Server 而非 SPA:**
- 不需要 JavaScript 建置工具鏈(不需 Node、不需 npm)
- 端到端 C#(單一語言,單一團隊可維護)
- 原生整合 Windows Auth / Azure AD
- 內網部署,SignalR 延遲忽略不計
- 單一 .NET 專案編譯、單一部署單位

---

## 3. 讀取流程(序列圖)

```mermaid
sequenceDiagram
    actor User as 使用者
    participant UI as Blazor 頁面
    participant Svc as Service 層
    participant Read as Read Repository
    participant DB as SQL Server

    User->>UI: 選擇專案 + 月份
    UI->>Svc: GetReport(projectId, monthEnd)

    par 並行查詢
        Svc->>Read: GetProjectAttr(projectId)
        Read->>DB: SELECT FROM ProjectAttr
        DB-->>Read: row
    and
        Svc->>Read: GetMonthSummary(projectId, monthEnd)
        Read->>DB: SELECT FROM ProjectMonthlySummary
        DB-->>Read: row
    and
        Svc->>Read: GetMonthSummary(projectId, prevMonthEnd)
        Read->>DB: SELECT 上月
        DB-->>Read: row(供累計收入計算用)
    and
        Svc->>Read: GetDesc(projectId, monthEnd)
        Read->>DB: SELECT FROM MonthlyReportDesc
        DB-->>Read: row 或 null
    and
        Svc->>Read: GetPayments(projectId, monthRange)
        Read->>DB: SELECT FROM ProjectPayments
        DB-->>Read: rows
    end

    Svc->>Svc: 組合 View Model<br/>套用累計公式
    Svc-->>UI: ReportViewModel
    UI->>UI: 渲染
    UI->>User: 顯示
```

---

## 4. 寫入流程(序列圖)— 每個欄位獨立存檔

每個可編輯欄位都有自己的存檔按鈕。每次存檔是獨立的「部分 UPSERT」。

```mermaid
sequenceDiagram
    actor User as 使用者
    participant UI as Blazor 頁面
    participant Val as 驗證器
    participant San as HTML Sanitizer
    participant Svc as Service
    participant Write as Write Repository
    participant DB as SQL Server

    User->>UI: 編輯欄位,點「存檔」(僅針對該欄位)
    UI->>Val: 驗證輸入
    alt 不通過
        Val-->>UI: error
        UI->>User: 顯示行內錯誤訊息
    else 通過
        opt HTML 欄位
            UI->>San: 清洗 HTML(剝除危險標籤)
            San-->>UI: 乾淨 HTML
        end
        UI->>Svc: SaveField(key, fieldName, value, audit)
        Svc->>Write: Upsert(key, partial: {fieldName: value})
        Write->>DB: MERGE MonthlyReportDesc<br/>WHEN MATCHED 更新該欄<br/>WHEN NOT MATCHED 新增列
        DB-->>Write: ok
        Write-->>Svc: ok
        Svc-->>UI: 成功
        UI->>User: Toast:「已存檔 [欄位名]」
        UI->>UI: 清除該欄位 dirty 旗標<br/>更新 lastSaved 時間
    end
```

---

## 5. 月份生命週期(狀態機)

```mermaid
stateDiagram-v2
    [*] --> Editable: 月份開放
    Editable --> Editable: 使用者編輯 + 存檔(隨時)
    Editable --> Locked: 管理員執行<br/>月結
    Locked --> Unlocked: 管理員解鎖<br/>(例外處理)
    Unlocked --> Locked: 管理員再次鎖定

    note right of Editable
        當月的預設狀態。
        3 個可編輯欄位皆可填寫。
    end note

    note right of Locked
        唯讀。UI 顯示鎖定徽章。
        不渲染任何存檔按鈕。
    end note
```

---

## 6. 元件圖 — 當前原型

```mermaid
flowchart TB
    subgraph HTML["index.html"]
        Banner["Banner(狀態 + 中繼資訊)"]
        TopBar["頂部列<br/>專案下拉 / 月份 / 存檔狀態"]
        Grid["6 列財務網格<br/>(唯讀)"]
        Edit1["可編輯區塊 1<br/>TargetAmount + 存檔鈕"]
        Edit2["可編輯區塊 2<br/>AmtDesc 富文本 + 存檔鈕"]
        PayKPI["付款彙總(4 個指標)"]
        PayTable["付款明細表"]
        Edit3["可編輯區塊 3<br/>SolDesc 富文本 + 存檔鈕"]
        Footer["底部資訊"]
        DevPanel["開發資訊面板(浮動,可收合)"]
    end

    subgraph JS["app.js"]
        State["state 物件<br/>currentProjectId、currentMonthEnd、<br/>targetAmount、amtDesc、solDesc、<br/>dirty 旗標、lastSaved 時間"]
        Fmt["格式化函式<br/>num / pct / date / rocDate"]
        Calc["商業邏輯<br/>利潤率、累計收入"]
        Render["渲染函式<br/>render、renderPayments、renderDevPanel"]
        Handlers["存檔處理<br/>setupSaveButton(target, amt, sol)"]
    end

    subgraph DATA["mock-data.js"]
        Projects["10 個合成專案"]
        Months["120 筆月報資料"]
        Payments["約 110 筆付款"]
    end

    HTML --> JS
    JS --> DATA
```

---

## 7. 資料模型(命名刻意通用化)

### 唯讀 view(DB 既有)

| View | Key | 用途 |
|---|---|---|
| `ProjectAttr` | `ProjectID` | 專案屬性、合約與預算金額、日期 |
| `ProjectMonthlySummary` | `ProjectID` + `MonthEnd` | 當月財務彙總、累計值 |
| `ProjectPayments` | `PayNo` | 付款明細(以 `ProjectID` 關聯) |

### 寫入目標(待建)

| Table | Key | 欄位 |
|---|---|---|
| `MonthlyReportDesc` | `ProjectID` + `MonthEnd` | `TargetAmount` (float)、`AmtDesc` (HTML)、`SolDesc` (HTML),加上稽核欄位 |

### 實體關聯

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

## 8. 階段路線圖

```mermaid
flowchart LR
    P0[Phase 0<br/>需求盤點] -->|完成| P1[Phase 1<br/>資料合約]
    P1 -->|主線| P5[Phase 5<br/>真實 DB 介接]
    P0 -.->|副線| P2[Phase 2<br/>資料模型]
    P2 --> P3[Phase 3<br/>專案骨架]
    P3 --> P4[Phase 4<br/>UI 實作]
    P4 --> P5
    P5 --> P6[Phase 6<br/>測試與遷移]
    P6 --> P7[Phase 7<br/>內網部署]

    classDef done fill:#c8e6c9,stroke:#2e7d32
    classDef active fill:#fff4e5,stroke:#ef6c00
    classDef pending fill:#e3f2fd,stroke:#1565c0
    class P0 done
    class P1 active
    class P2,P3,P4,P5,P6,P7 pending
```

**主線**(Phase 1 → 5 → 6 → 7)是關鍵路徑,依賴後端就緒。**副線**(Phase 2 → 3 → 4)可用 Mock 資料平行進行,目前的原型就是副線的階段性產出。

---

## 9. 資安邊界

- 連線字串、帳密、權杖只存在於伺服器,**絕不**出現在瀏覽器。
- HTML 富文本欄位在伺服器端統一過 sanitizer,白名單允許 `b`、`i`、`u`、`p`、`ul`、`ol`、`li`、`a`、`br`。
- 所有寫入動作含稽核欄位(`CreateUserID`、`UpdUserID`),由 SSO 身分自動填入。
- 列級存取控制:Read Repository 依使用者部門或指派清單過濾專案(透過 `IsActiveAssignee(userId, projectId)` 判定式)。
