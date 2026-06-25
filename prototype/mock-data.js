// 假資料 — 完全去識別化,無任何真實資料
// 結構與商業邏輯與真實版本一致,只是數值與名稱皆為虛構
window.APP_DATA = (() => {
  const projects = [
    { ProjectID: "P001", ProjectName: "Project Alpha — Sample Tower A",     ProjectStatus: "執行中",   DeptName: "Dept-A", ExpStartDate: "2023-01-01", ExpEndDate: "2026-12-31", ExtentionEndDate: "2027-03-31", ContractAmt: 1200000000, ContractRevisedAmt: 1280000000, BudgetAmt:  950000000, BudgetRevisedAmt:  990000000 },
    { ProjectID: "P002", ProjectName: "Project Beta — Sample Plaza",        ProjectStatus: "執行中",   DeptName: "Dept-A", ExpStartDate: "2022-06-15", ExpEndDate: "2025-12-31", ExtentionEndDate: "2026-04-30", ContractAmt:  840000000, ContractRevisedAmt:  860000000, BudgetAmt:  680000000, BudgetRevisedAmt:  695000000 },
    { ProjectID: "P003", ProjectName: "Project Gamma — Demo Station",       ProjectStatus: "執行中",   DeptName: "Dept-B", ExpStartDate: "2024-03-01", ExpEndDate: "2028-06-30", ExtentionEndDate: "2028-09-30", ContractAmt: 2300000000, ContractRevisedAmt: 2450000000, BudgetAmt: 1900000000, BudgetRevisedAmt: 1980000000 },
    { ProjectID: "P004", ProjectName: "Project Delta — Sample Mall",        ProjectStatus: "預算未鎖檔", DeptName: "Dept-B", ExpStartDate: "2025-01-01", ExpEndDate: "2027-12-31", ExtentionEndDate: null,         ContractAmt:  450000000, ContractRevisedAmt:  450000000, BudgetAmt:  370000000, BudgetRevisedAmt:  370000000 },
    { ProjectID: "P005", ProjectName: "Project Epsilon — Sample Hospital",  ProjectStatus: "已結算",   DeptName: "Dept-C", ExpStartDate: "2020-09-01", ExpEndDate: "2024-08-31", ExtentionEndDate: "2024-12-31", ContractAmt: 1850000000, ContractRevisedAmt: 1900000000, BudgetAmt: 1500000000, BudgetRevisedAmt: 1540000000 },
    { ProjectID: "P006", ProjectName: "Project Zeta — Sample Office",       ProjectStatus: "執行中",   DeptName: "Dept-A", ExpStartDate: "2023-09-01", ExpEndDate: "2026-08-31", ExtentionEndDate: null,         ContractAmt:  680000000, ContractRevisedAmt:  690000000, BudgetAmt:  550000000, BudgetRevisedAmt:  560000000 },
    { ProjectID: "P007", ProjectName: "Project Eta — Sample Residence",     ProjectStatus: "執行中",   DeptName: "Dept-C", ExpStartDate: "2024-01-15", ExpEndDate: "2027-03-31", ExtentionEndDate: null,         ContractAmt:  920000000, ContractRevisedAmt:  945000000, BudgetAmt:  740000000, BudgetRevisedAmt:  760000000 },
    { ProjectID: "P008", ProjectName: "Project Theta — Sample Warehouse",   ProjectStatus: "執行中",   DeptName: "Dept-B", ExpStartDate: "2024-08-01", ExpEndDate: "2026-12-31", ExtentionEndDate: null,         ContractAmt:  320000000, ContractRevisedAmt:  330000000, BudgetAmt:  260000000, BudgetRevisedAmt:  268000000 },
    { ProjectID: "P009", ProjectName: "Project Iota — Demo Hotel",          ProjectStatus: "執行中",   DeptName: "Dept-A", ExpStartDate: "2022-12-01", ExpEndDate: "2026-06-30", ExtentionEndDate: "2026-12-31", ContractAmt: 1500000000, ContractRevisedAmt: 1570000000, BudgetAmt: 1200000000, BudgetRevisedAmt: 1250000000 },
    { ProjectID: "P010", ProjectName: "Project Kappa — Sample Bridge",      ProjectStatus: "執行中",   DeptName: "Dept-B", ExpStartDate: "2025-03-01", ExpEndDate: "2028-12-31", ExtentionEndDate: null,         ContractAmt: 3200000000, ContractRevisedAmt: 3200000000, BudgetAmt: 2600000000, BudgetRevisedAmt: 2600000000 },
  ];

  // 為每個專案產生最近 12 個月的月報歷史(結束於當前月,讓畫面預設停在當月)
  const months = [];
  const now = new Date();
  projects.forEach(p => {
    let accRealAmt = 0, accRealCost = 0, yearRealCost = 0;
    for (let i = 11; i >= 0; i--) {                                      // 舊→新:當月-11 ... 當月
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);  // (當月 - i) 的最後一天
      const MonthEnd = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
      const mi = 11 - i;                                                 // 月份序(0=最舊 .. 11=當月)
      const seed = (parseInt(p.ProjectID.replace('P','')) * 1000 + mi);
      const realAmt = Math.round((30 + (seed % 50)) * 1000000);
      const realCost = Math.round((28 + (seed % 40)) * 1000000);
      accRealAmt += realAmt;
      accRealCost += realCost;
      yearRealCost += realCost;
      months.push({
        ProjectID: p.ProjectID, ProjectName: p.ProjectName, MonthEnd,
        EstAmt: realAmt, EstCost: realCost,
        RealAmt: realAmt, RealCost: realCost,
        AccRealAmt: accRealAmt, AccRealCost: accRealCost,
        AccRealCostRate: p.BudgetRevisedAmt ? accRealCost / p.BudgetRevisedAmt : 0,
        AccRealAmtRate: p.ContractRevisedAmt ? accRealAmt / p.ContractRevisedAmt : 0,
        AccCostOKRate: 0.85 + (seed % 20) / 100,
        YearEstCost: realCost * 12 * 0.95,
        YearRealCost: yearRealCost,
        YearCostExecRate: yearRealCost / (realCost * 12),
        EstCostORG: realCost * 1.05,
        AmtRealDiff: realAmt - realCost,
      });
    }
  });

  // 為前 3 個專案產生假付款(每月 3-5 筆)
  const payments = [];
  const vendors = ["Vendor A 工程", "Vendor B 機電", "Vendor C 裝修", "Vendor D 材料", "Vendor E 顧問"];
  const contracts = ["合約樣本-結構", "合約樣本-機電", "合約樣本-裝修", "合約樣本-材料", "合約樣本-顧問"];
  let payNo = 100000;
  projects.slice(0, 3).forEach(p => {
    months.filter(m => m.ProjectID === p.ProjectID).forEach((m, mi) => {
      const cnt = 3 + (mi % 3);
      for (let k = 0; k < cnt; k++) {
        const vi = (parseInt(p.ProjectID.replace('P','')) + mi + k) % vendors.length;
        const isPay = (mi + k) % 3 !== 0;
        const day = String(5 + k * 5).padStart(2, '0');
        const md = m.MonthEnd.split('/');
        const rocYear = String(parseInt(md[0]) - 1911).padStart(2, '0');
        payments.push({
          PayNo: 'PAY' + (++payNo),
          ProjectID: p.ProjectID,
          VendorName: vendors[vi],
          ContractName: contracts[vi] + " — Phase " + (k + 1),
          ContractNo: 'C' + payNo,
          PayPhase: (k + 1),
          PayDate: `${rocYear}-${md[1]}-${day}`,
          IsPay: isPay,
          IsBill: true,
          IsNotice: false,
          Amount: Math.round((1 + (vi + k)) * 500000),
          Status: isPay ? "簽核完成" : "簽核中",
        });
      }
    });
  });

  return {
    generated_at: new Date().toISOString().substring(0, 19).replace('T', ' '),
    db_source: "Generic SQL Server (sample data)",
    db_user: "demo_user",
    counts: { projects: projects.length, months: months.length, payments: payments.length },
    projects, months, payments,
  };
})();
