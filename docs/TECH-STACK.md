# 技術棧

兩套技術棧:**當前原型**(本 repo 內容)與 **目標正式版**(後端就緒後將建置的版本)。

---

## 當前 — 原型 (v0.2)

刻意採用最精簡的技術棧,讓原型零安裝、任何地方都能跑。

| 層 | 技術 | 為什麼 |
|---|---|---|
| 標記 | HTML5 | 直接、不靠框架 |
| 樣式 | CSS3(原生) | 表單版面、扁平美學、不用前處理器 |
| 邏輯 | 原生 JavaScript (ES2017+) | 無建置、無 `node_modules`、無轉譯 |
| 狀態 | 純 JS 物件 | 對單頁原型來說剛好夠用 |
| 富文本 | `contenteditable` + `document.execCommand` | 瀏覽器內建;符合既有系統行為 |
| 資料 | 內嵌的 `mock-data.js`(合成資料) | 避免 `file://` 環境下的 `fetch()` CORS 問題 |
| 執行 | 直接用瀏覽器打開 `index.html` | 不需要伺服器、不需要安裝任何東西 |

**刻意沒有的東西:**
- 沒有框架(React/Vue/Angular)
- 沒有打包工具(Vite/Webpack)
- 沒有套件管理(npm/yarn)
- 沒有建置步驟
- 沒有真實網路呼叫

這是**視覺與互動的參考實作**,不是正式產品的程式碼。

### 用到的瀏覽器特性

| 特性 | 用途 |
|---|---|
| `contenteditable` | 富文本欄位 |
| `document.execCommand` | 粗體/斜體/清單/連結 工具列 |
| `Intl.NumberFormat`(透過 `toLocaleString`) | 數字格式化 |
| `localStorage` | _尚未使用;可用於保存草稿_ |

---

## 目標 — 正式版(Phase 3 起)

選擇與微軟生態對齊的全套技術,理由是:
- UI + 後端 採用同一語言(C#)
- 原生整合公司 Windows / Azure AD
- 無 JavaScript 建置工具鏈
- 伺服器端渲染 + SignalR 提供反應式互動

### 應用層

| 層 | 技術 | 版本 | 備註 |
|---|---|---|---|
| Runtime | .NET | 8 LTS | 長期支援至 2026 年 11 月 |
| 應用框架 | ASP.NET Core | 8 | 承載 Blazor Server |
| UI 框架 | Blazor Server | 8 | 用 C# 寫元件(.razor) |
| 元件庫 | MudBlazor(優先)或 FluentUI Blazor | 最新 | Material 或 Fluent 風格元件 |
| 富文本 | TinyMCE Blazor 或 Syncfusion Blazor RTE | 最新 | 取代 `contenteditable`,改用受控元件 |
| HTML 清洗 | `HtmlSanitizer` NuGet | 最新 | 伺服器端白名單 |
| 認證 | Negotiate(Windows Auth)或 `Microsoft.Identity.Web` | 2.x | 依 IT 偏好決定 |
| 記錄 | Serilog + Console / File sinks | 最新 | 每個 request 帶 correlation ID |

### 資料存取

| 層 | 技術 | 備註 |
|---|---|---|
| ORM | EF Core 8 | 讀取模型(LINQ over views) |
| Micro-ORM | Dapper | 高吞吐寫入與臨時 SQL |
| 驅動 | Microsoft.Data.SqlClient | 新版 ADO.NET driver |

### 資料庫

| 層 | 技術 | 備註 |
|---|---|---|
| 引擎 | SQL Server | 2022(依 IT 提供) |
| Schema | 3 個讀 view + 1 個寫 table | 詳見 ARCHITECTURE.md |

### 開發工具

| 工具 | 用途 |
|---|---|
| Visual Studio 2022 或 VS Code + C# Dev Kit | IDE |
| dotnet CLI | 建置、還原、執行 |
| `dotnet user-secrets` | 本機連線字串儲存(永不 commit) |
| Git | 版本控制 |

### 部署

| 層 | 技術 | 備註 |
|---|---|---|
| 主機 | Windows Server 內網的 IIS | Kestrel 可選 |
| 程序 | In-process(IIS) | 單一部署單位 |
| 反向代理 | IIS 或無 | 依 IT 既有架構決定 |

---

## 為何選這套 — 對應的設計限制

| 限制 | 技術棧如何對應 |
|---|---|
| 本機不可安裝 Node.js(公司資安政策) | Blazor Server 完全不需要 JavaScript 建置鏈 |
| 公司是微軟生態(SQL Server、AD、Windows Server) | C# / EF Core / Windows Auth 都是原生 |
| 內部應用,僅內網 | SignalR 延遲可接受;無需公網安全強化 |
| 交接後由小型團隊維護 | 端到端單一語言 |
| 未來可延伸到更廣的 BI 套件 | View 命名通用,讀寫倉解耦 |

---

## 原型與正式版的差異

| 面向 | 原型 | 正式版 |
|---|---|---|
| 版面與樣式 | HTML + CSS | `.razor` 元件,外觀一致 |
| 狀態 | 純 JS 物件 | `@code` 區塊,session-scoped |
| 存檔動作 | `setTimeout` + `console.log` | 真實的 `MERGE`(EF Core / Dapper) |
| 資料 | 合成的 `mock-data.js` | 即時 SQL 查詢 |
| 認證 | 無 | Windows Auth 或 Azure AD |
| 驗證 | 行內 JS | DataAnnotations + 自訂驗證 |
| 富文本 | `contenteditable` | 受控元件(TinyMCE / Syncfusion) |
| 清洗 | 無 | `HtmlSanitizer` NuGet + 白名單 |
| 持久化 | 無 | SQL Server |

**版面、商業邏輯、UX 流程** 在原型階段一次設計到位,再原封不動移植到 Blazor。原型就是規格。
