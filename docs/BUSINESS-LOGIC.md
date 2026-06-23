# 商業邏輯

## 收入與投入兩條核心公式

畫面上的累計值**不是**從資料庫直接讀取,而是在應用層即時計算。兩個使用者輸入欄位(`TargetAmount` 與 `MonthlyEstimatedCost`)分別驅動收入側與投入側。

### 累計實際收入(收入側)

```
畫面顯示的累計實際收入
    = 上月的 AccRealAmt        (從 ProjectMonthlySummary 讀取)
    + 本月的 TargetAmount       (使用者輸入,儲存於 MonthlyReportDesc)
```

### 累計實際投入(投入側)

```
畫面顯示的累計實際投入
    = 本月的 AccRealCost              (從 ProjectMonthlySummary 讀取)
    + 本月的 MonthlyEstimatedCost     (使用者輸入)
```

兩條公式共通的設計:

- 使用者只填輸入值;畫面累計值隨輸入即時重算。
- 儲存時只寫使用者輸入欄位;累計值**永遠不存成欄位**,每次讀取重新計算。

## 衍生計算欄位

| 欄位 | 公式 |
|---|---|
| 原始利潤率 | `(ContractAmt − BudgetAmt) / ContractAmt` |
| 修正利潤率 | `(RevisedContractAmt − RevisedBudgetAmt) / RevisedContractAmt` |
| 累計收支差 | `畫面顯示的累計實際收入 − 畫面顯示的累計實際投入` |
| 年度累計實際投入 | `YearRealCost + MonthlyEstimatedCost` |
| 年度投入差 | `(年度累計實際投入) − YearEstCost`(超支為正) |
| 累計投入% | `(畫面顯示的累計實際投入) / BudgetRevisedAmt` |
| 本月達成率 | `MonthlyEstimatedCost / EstCost(本月)` |
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

## 寫入(UPSERT)範本

寫回採用 `MERGE`,以 `(ProjectID, MonthEnd)` 為複合主鍵。每個可編輯欄位可獨立呼叫,只更新自己負責的欄位 + 稽核資料。

```sql
MERGE dbo.MonthlyReportDesc AS T
USING (SELECT @ProjectID AS ProjectID,
              @MonthEnd  AS MonthEnd,
              @TargetAmount AS TargetAmount,
              @AmtDesc      AS AmtDesc,
              @SolDesc      AS SolDesc) AS S
ON T.ProjectID = S.ProjectID
   AND T.MonthEnd = S.MonthEnd
WHEN MATCHED THEN
  UPDATE SET
    TargetAmount = S.TargetAmount,
    AmtDesc      = S.AmtDesc,
    SolDesc      = S.SolDesc,
    UpdDate      = GETDATE(),
    UpdUserID    = @UserID,
    UpdUserName  = @UserName
WHEN NOT MATCHED THEN
  INSERT (ProjectID, MonthEnd,
          AmtDesc, SolDesc, TargetAmount,
          Active, CreateDate, CreateUserID, CreateUserName,
          UpdDate, UpdUserID, UpdUserName)
  VALUES (S.ProjectID, S.MonthEnd,
          S.AmtDesc, S.SolDesc, S.TargetAmount,
          1, GETDATE(), @UserID, @UserName,
          GETDATE(), @UserID, @UserName);
```

### 注意事項

- `UpdDate` 在實際 DB 為 NOT NULL 且無 default,INSERT 與 UPDATE 都必須帶 `GETDATE()`。
- 主鍵衝突會自動轉成 UPDATE,不會擲出例外。
- 對「每欄位獨立存檔」的設計,可將 `MERGE` 拆成只更新單一欄位的版本。
