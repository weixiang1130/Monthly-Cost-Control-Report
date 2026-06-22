# 月報成本控制系統 — 前端原型

一個獨立執行的 HTML/CSS/JS 原型,展示用來取代既有 Power Apps Canvas App 的「月報填寫工具」的 UX、版面、與商業邏輯。畫面上所有資料皆為合成範例;原型未連接任何真實資料庫或組織內部資訊。

---

## 一眼總覽

```mermaid
flowchart LR
    Now["目前:本 repo<br/>靜態 HTML/JS 原型<br/>合成資料、無伺服器"]
    Mid["Phase 2-4:鎖定設計<br/>資料模型、骨架、UI"]
    Then["Phase 5-7:正式上線<br/>Blazor Server + SQL Server<br/>內網部署"]

    Now --> Mid --> Then

    style Now fill:#fff5e6,stroke:#a14a00
    style Mid fill:#e6f1fb,stroke:#185fa5
    style Then fill:#eaf3de,stroke:#3b6d11
```

---

## 它做什麼

- 專案下拉 + 月份切換
- 唯讀的財務數字(來自模擬的報表 view)
- 三個**獨立可儲存**的可編輯欄位:
  - `TargetAmount`(本月實際收入)
  - `AmtDesc`(投入與收入說明,HTML 富文本)
  - `SolDesc`(警示及具體做法,HTML 富文本)
- 即時重算:`累計實際收入 = 上月 AccRealAmt + 本月 TargetAmount`
- 每個欄位有獨立的「未儲存」提示與儲存 toast
- 唯讀的「當月付款明細」表
- 浮動的開發資訊面板,即時顯示計算過程

## 如何執行

直接用瀏覽器開啟 `prototype/index.html`。**不需要建置工具、不需要伺服器、不需要 Node**。

```
prototype/
  index.html       — 進入頁
  style.css        — 表單式扁平 UI
  app.js           — 狀態、計算、儲存處理
  mock-data.js     — 10 個合成專案 × 12 個月 × 約 110 筆付款
docs/
  ARCHITECTURE.md  — 系統架構圖(Mermaid)
  TECH-STACK.md    — 當前與目標技術棧
  BUSINESS-LOGIC.md — 累計收入公式
  ROADMAP.md       — 8 階段開發計畫
CHANGELOG.md
LICENSE
```

## 技術棧速覽

- **目前(原型)**:HTML5 + CSS3 + 原生 JavaScript (ES2017+),無建置、無 Node、無伺服器。
- **目標(正式版)**:Blazor Server (.NET 8 LTS) + EF Core / Dapper + SQL Server + Windows Auth 或 Azure AD,單一 Visual Studio 方案,部署到內網 IIS。

完整對照與選擇理由請見 [docs/TECH-STACK.md](docs/TECH-STACK.md)。

## 架構

請見 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),包含 9 張 Mermaid 圖:
- 當前原型系統地圖
- 目標 Blazor Server 架構
- 讀取流程(並行查詢)
- 寫入流程(per-field UPSERT)
- 月份生命週期狀態機
- 元件圖
- 實體關聯(ER)圖
- 8 階段路線圖

## 商業邏輯

最關鍵的一條規則,詳見 [docs/BUSINESS-LOGIC.md](docs/BUSINESS-LOGIC.md):

```
畫面顯示的累計實際收入
    = 上月的 AccRealAmt          (從 ProjectMonthlySummary 讀取)
    + 本月的 TargetAmount         (使用者輸入,儲存在 MonthlyReportDesc)
```

此值在應用層即時計算,**從未存成欄位**。

## 進度狀態

- [x] 版面與 UX 對齊既有系統
- [x] 三個獨立的存檔按鈕(每個可編輯欄位各一)
- [x] 即時累計重算
- [x] Mermaid 渲染的架構文件
- [ ] 真實 DB 介接(等待後端寫入表建立)
- [ ] Blazor Server 移植(等待本機 .NET SDK 可用)

## 授權

MIT License。詳見 [LICENSE](LICENSE)。
