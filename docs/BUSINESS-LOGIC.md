# 商業邏輯

## 累計實際收入(關鍵規則)

畫面上顯示的「累計實際收入」**不是**從資料庫直接讀取,而是在應用層即時計算:

```
畫面顯示的累計實際收入
    = 上月的 AccRealAmt        (從 ProjectMonthlySummary 讀取)
    + 本月的 TargetAmount       (使用者輸入,儲存於 MonthlyReportDesc)
```

意思是:

- 使用者只填一個值(`TargetAmount`)代表本月。
- 顯示的累計值會隨使用者輸入即時重算。
- 儲存時只寫 `TargetAmount`;累計值**永遠不存成欄位**,每次讀取都重新計算。

## 衍生計算欄位

| 欄位 | 公式 |
|---|---|
| 原始利潤率 | `(ContractAmt − BudgetAmt) / ContractAmt` |
| 修正利潤率 | `(RevisedContractAmt − RevisedBudgetAmt) / RevisedContractAmt` |
| 累計收支差 | `畫面顯示的累計實際收入 − AccRealCost` |
| 年度投入差 | `YearEstCost − YearRealCost` |
| 付款比例 | `count(已付款) / count(已計價)` |
| 付款金額比例 | `sum(已付款.Amount) / sum(已計價.Amount)` |

## 狀態機

```
[可編輯]  → 使用者填寫欄位,隨時可存檔
    ↓ (管理員執行月結)
[月結鎖定] → 整個月份變唯讀
    ↓ (管理員解鎖,例外處理)
[解鎖]    → 重新可編輯
```

沒有審核流程。鎖定機制由伺服器強制執行;原型只呈現視覺狀態。

## 角色

| 角色 | 權限 |
|---|---|
| 填報人 Editor | 編輯自己負責的專案、僅當月 |
| 管理員 Admin | 全部專案檢視、執行月結/解鎖、權限管理 |
