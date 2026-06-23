# 變更紀錄

本檔案記錄原型每個版本的變動。

## [v0.5] — 2026-06-22

### 變更(對齊後端補充規格)
- 確認後端最新規格:`MonthlyReportDesc` 寫入表仍維持 5 個資料欄(`AmtDesc / SolDesc / TargetAmount` 三個使用者填寫欄 + 啟用旗標 + 稽核欄位),**未新增** monthly estimated cost 欄位。
- 「Monthly estimated cost」欄位重新定位:正式版改為從 `SubcontractMonthlySnapshot` view 自動讀取(月初快照,非使用者輸入);本原型暫時保留 input 作為 demo 用,但移除存檔按鈕並調整視覺(米色 dashed border)以表明是暫態占位。
- UI 提示明確標示「access pending」,提醒後端團隊需開放小包計彙總 view 的 SELECT 權限。

### 已知缺口
- 寫入表 `MonthlyReportDesc` 已建立但本帳號尚無 INSERT/UPDATE 權限。
- 小包計彙總快照 view 帳號無 SELECT 權限,無法驗證「monthly estimated cost」的真實計算方式。

## [v0.4] — 2026-06-22

### 變更(對齊既有系統公式)
- 新增第 4 個可編輯欄位:**Monthly estimated cost**(`MonthlyEstimatedCost`),含獨立存檔按鈕與「未儲存」標籤。
- 修正多項計算公式以對齊既有系統:
  - **累計實際投入** = 本月 `AccRealCost` + 本月 `MonthlyEstimatedCost`(使用者輸入)
  - **年度累計實際投入** = `YearRealCost` + 本月 `MonthlyEstimatedCost`
  - **年度投入差** = (顯示年度累計實際投入) − `YearEstCost`(超支為正)
  - **累計投入%** = (顯示累計實際投入) / `BudgetRevisedAmt`
  - **本月實際投入(預估)** 由 `RealCost` 改為使用者輸入的 `MonthlyEstimatedCost`
  - **本月達成率** = `MonthlyEstimatedCost` / 本月 `EstCost`(原本誤用 `YearCostExecRate`)
- 「累計實際收入」公式維持 `上月 AccRealAmt + 本月 TargetAmount`(經驗證正確)。
- 開發資訊面板擴增,同時顯示收入側與投入側兩條計算過程,並提示 schema 待加欄位。

### 已知缺口
- `MonthlyReportDesc` schema 目前沒有 `MonthlyEstimatedCost` 欄位,需後端團隊新增。前端寫回模擬會印 payload,等 schema 補齊即可真實寫入。

## [v0.3] — 2026-06-22

### 新增
- `docs/ARCHITECTURE.md` 改寫,加入 **9 張 Mermaid 圖**:當前原型系統地圖、目標 Blazor Server 架構、讀取流程序列圖、寫入流程序列圖、月份生命週期狀態機、元件圖、ER 圖、8 階段路線圖、資安邊界規範。
- `docs/TECH-STACK.md`:完整的技術盤點,涵蓋當前原型與目標正式版兩套技術棧,並列出每個選擇背後的限制與理由。

### 變更
- `README.md` 新增頂層的「現在 → 中期 → 目標」Mermaid 流程圖,並連到新的架構與技術棧文件。

## [v0.2] — 2026-06-22

### 變更
- 移除頂部的「移至新版面」與「月結公告數據」兩個按鈕,新系統不需要。
- 每個可編輯欄位都有**自己的存檔按鈕**:
  - 存檔本月實際收入(`TargetAmount`)
  - 存檔投入與收入說明(`AmtDesc`)
  - 存檔警示及具體做法(`SolDesc`)
- 新增「月份」下拉,可以瀏覽該專案的歷史月份。
- 新增每個欄位的「未儲存」標籤,以及頂部全域的「全部已儲存」/「未儲存變更」狀態。
- 修正日期顯示:ISO 日期一致顯示為 `YYYY/MM/DD`;舊版 `/Date(ms)/` 格式也能正確解析。

### 新增
- 開發資訊面板(右下浮動,可收合),即時顯示計算過程與每個欄位即將寫入的 UPSERT payload。

## [v0.1] — 2026-06-22

### 新增
- 初版獨立 HTML/CSS/JS 原型。
- 還原既有系統版面:頂部列、三欄財務網格、兩段富文本說明、付款彙總、付款明細、底部資訊。
- 10 個合成專案 × 每案 12 個月的歷史資料。
- `TargetAmount` 編輯時累計實際收入即時重算。
- Microsoft Word 風格的富文本工具列(粗體/斜體/底線/連結/清單/清除格式)。
- 模擬儲存 + toast 回饋。
