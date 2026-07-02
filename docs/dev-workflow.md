# 開發與版控流程

本文件說明本 repo 的協作與版本控制規範。

## 這個 repo 是什麼

這是成控月報前端的**去識別化公開鏡像**——所有專案名稱、數值、資料表名皆為虛構範例，僅供展示版面、互動與商業邏輯。實際開發使用內部真實資料，不在此 repo 內。

## 版控流程（PR-based）

**不直接 commit 到 `main`。每次變更都走 Pull Request。**

1. 從最新的 `main` 開分支：
   ```bash
   git checkout main && git pull
   git checkout -b <type>/<slug>     # 例：feat/review-view、fix/default-month、docs/xxx
   ```
2. 進行變更、commit（訊息簡潔說明「做了什麼、為什麼」）。
3. 推送分支並開 PR：
   ```bash
   git push -u origin <branch>
   ```
4. PR 由維護者審核後合併，`main` 永遠保持可用狀態。

### 分支命名

| 前綴 | 用途 |
|---|---|
| `feat/` | 新功能 |
| `fix/` | 修正 |
| `docs/` | 文件 |
| `chore/` | 雜項／設定 |

## 每次變更的檢查清單

- [ ] 更新 `CHANGELOG.md`（最上方加一段 `## [vX.Y] — YYYY-MM-DD`，列 Added/Changed/Fixed）
- [ ] 確認無任何真實／敏感資訊（本 repo 一律使用虛構範例資料）
- [ ] 前端為免建置靜態網頁，直接用瀏覽器開 `prototype/index.html` 即可驗證

## 版本節奏

版本號記錄於 `CHANGELOG.md`；原型採 `v0.x` 系列，每次有意義的變更遞增。
