'use client';
import React, { useMemo, useState, useEffect } from "react";

const currency = (v:number) => v.toLocaleString(undefined, { style: "currency", currency: "USD" });
const toNum = (v:string) => {
  const s = (v ?? "").replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

function computeFixedCost(usage:number[], C:number, priceCommit:number, priceOverage:number){
  const rows = usage.map(u => {
    const over = Math.max(u - C, 0);
    const unused = Math.max(C - u, 0);
    const base = C * priceCommit;
    const overCost = over * priceOverage;
    const total = base + overCost;
    return { usage:u, commit:C, overage:over, unused, baseCost:base, overageCost:overCost, total };
  });
  const totals = rows.reduce((a,r)=>({
    usage:a.usage+r.usage, commit:a.commit+r.commit, overage:a.overage+r.overage, unused:a.unused+r.unused,
    baseCost:a.baseCost+r.baseCost, overageCost:a.overageCost+r.overageCost, total:a.total+r.total
  }), {usage:0, commit:0, overage:0, unused:0, baseCost:0, overageCost:0, total:0});
  return { rows, totals };
}
function computeOptimalCommit(usage:number[], priceCommit:number, priceOverage:number){
  const candidates = Array.from(new Set([0, ...usage])).sort((a,b)=>a-b);
  let best = { C: 0, cost: Infinity };
  for(const C of candidates){
    const { totals } = computeFixedCost(usage, C, priceCommit, priceOverage);
    if(totals.total < best.cost) best = { C, cost: totals.total };
  }
  return best;
}

export default function OveragesCalculator(){
  const [months, setMonths] = useState<string[]>(["Feb","March","April","May","June","July"]);
  const [usage, setUsage] = useState<string[]>(["44,974","72,587","83,792","124,560","79,550","36,160"]);
  const [years, setYears] = useState<string[]>(["2025","2025","2025","2025","2025","2025"]);
  const labels = useMemo(()=> months.map((m,i)=> `${m}${years[i] ? " " + years[i] : ""}`), [months, years]);

  const [autoYears, setAutoYears] = useState(true);
  const monthToIdx = (m:string)=>{
    const s = (m||"").trim().toLowerCase();
    const map:any = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
    return (s in map) ? map[s] : null;
  };
  useEffect(()=>{
    if(!autoYears) return;
    const y0 = Number(years[0]);
    if(!Number.isFinite(y0)) return;
    let curYear = y0;
    const next = [...years];
    next[0] = String(y0);
    let prevIdx = monthToIdx(months[0]);
    for(let i=1;i<months.length;i++){
      const idx = monthToIdx(months[i]);
      if(prevIdx!==null && idx!==null && idx<prevIdx) curYear += 1;
      next[i] = String(curYear);
      if(idx!==null) prevIdx = idx;
    }
    if(JSON.stringify(next)!==JSON.stringify(years)) setYears(next);
  }, [months, years[0], autoYears]);

  const [yearInput, setYearInput] = useState("2025");
  const autofillJanDec = ()=>{
    const months12 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    setMonths(months12);
    setYears(months12.map(()=> yearInput || ""));
    setUsage(months12.map(()=> "0"));
    setAutoYears(false);
  };
  const resetSample = ()=>{
    setMonths(["Feb","March","April","May","June","July"]);
    setUsage(["44,974","72,587","83,792","124,560","79,550","36,160"]);
    setYears(["2025","2025","2025","2025","2025","2025"]);
    setAutoYears(true);
  };

  const [commitList, setCommitList] = useState("0.20");
  const [commitDiscPct, setCommitDiscPct] = useState("0");
  const [overageList, setOverageList] = useState("0.25");
  const [overageDiscPct, setOverageDiscPct] = useState("0");
  const priceCommit = useMemo(()=> Math.max(0, toNum(commitList) * (1 - Math.min(Math.max(toNum(commitDiscPct),0),100)/100)), [commitList, commitDiscPct]);
  const priceOverage = useMemo(()=> Math.max(0, toNum(overageList) * (1 - Math.min(Math.max(toNum(overageDiscPct),0),100)/100)), [overageList, overageDiscPct]);

  const [commit, setCommit] = useState("45,000");
  const usageNums = useMemo(()=> usage.map(u => Math.max(0, Math.round(toNum(u)))), [usage]);
  const optimal = useMemo(()=> computeOptimalCommit(usageNums, priceCommit, priceOverage), [usageNums, priceCommit, priceOverage]);
  const scenario = useMemo(()=> computeFixedCost(usageNums, Math.max(0, Math.round(toNum(commit))), priceCommit, priceOverage), [usageNums, commit, priceCommit, priceOverage]);
  const overageOnlyCost = useMemo(()=> usageNums.reduce((s,u)=> s + u*priceOverage, 0), [usageNums, priceOverage]);
  const variableMonthlyCost = useMemo(()=> usageNums.reduce((s,u)=> s + u*priceCommit, 0), [usageNums, priceCommit]);

  const downloadCsv = (label:string, detail:any) => {
    const header = ["Month","Usage_GB","Commit_GB","Overage_GB","Unused_GB","Base_Cost","Overage_Cost","Total_Cost"];
    const lines = [header.join(",")];
    detail.rows.forEach((r:any, idx:number)=>{
      lines.push([labels[idx], r.usage, r.commit, r.overage, r.unused, r.baseCost.toFixed(2), r.overageCost.toFixed(2), r.total.toFixed(2)].join(","));
    });
    const t = detail.totals;
    lines.push(["TOTAL", t.usage, t.commit, t.overage, t.unused, t.baseCost.toFixed(2), t.overageCost.toFixed(2), t.total.toFixed(2)].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${label}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const sheetFromDetail = (detail:any, labels:string[]) => {
    const header = ["Month","Usage_GB","Commit_GB","Overage_GB","Unused_GB","Base_Cost","Overage_Cost","Total_Cost"];
    const rows = detail.rows.map((r:any, i:number)=> [labels[i], r.usage, r.commit, r.overage, r.unused, Number(r.baseCost.toFixed(2)), Number(r.overageCost.toFixed(2)), Number(r.total.toFixed(2))]);
    const t = detail.totals;
    const total = ["TOTAL", t.usage, t.commit, t.overage, t.unused, Number(t.baseCost.toFixed(2)), Number(t.overageCost.toFixed(2)), Number(t.total.toFixed(2))];
    return [header, ...rows, total];
  };
  const downloadXlsx = async (label:string, detail:any) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetFromDetail(detail, labels)), "Breakdown");
    const inputs = [
      ["Commit list ($/GB)", commitList],
      ["Commit discount (%)", commitDiscPct],
      ["Effective commit ($/GB)", priceCommit],
      ["Overage list ($/GB)", overageList],
      ["Overage discount (%)", overageDiscPct],
      ["Effective overage ($/GB)", priceOverage],
      ["Fixed commit (GB/mo)", Math.round(toNum(commit))],
      ["Optimal commit (GB/mo)", optimal.C]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inputs), "Inputs");
    XLSX.writeFile(wb, `${label}.xlsx`);
  };
  const downloadXlsxAll = async () => {
    const XLSX = await import("xlsx");
    const current = scenario;
    const optimalDetail = computeFixedCost(usageNums, optimal.C, priceCommit, priceOverage);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetFromDetail(current, labels)), `Breakdown_${Math.round(toNum(commit))}GB`);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetFromDetail(optimalDetail, labels)), `Breakdown_Optimal_${optimal.C}GB`);
    const inputs = [
      ["Commit list ($/GB)", commitList],
      ["Commit discount (%)", commitDiscPct],
      ["Effective commit ($/GB)", priceCommit],
      ["Overage list ($/GB)", overageList],
      ["Overage discount (%)", overageDiscPct],
      ["Effective overage ($/GB)", priceOverage],
      ["Fixed commit (GB/mo)", Math.round(toNum(commit))],
      ["Optimal commit (GB/mo)", optimal.C]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inputs), "Inputs");
    XLSX.writeFile(wb, `overages_all_${Math.round(toNum(commit))}GB_vs_optimal.xlsx`);
  };

  return (
    <div className="w-full mx-auto p-4 grid gap-4 md:gap-6">
      <div className="rounded-2xl border p-4 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Overages Calculator</h1>
        <div className="flex items-center gap-2 mb-4">
          <input className="h-10 w-28 rounded-xl border px-3 py-2 text-sm" value={yearInput} onChange={(e)=>setYearInput(e.target.value)} placeholder="2025" />
          <button className="rounded-2xl border px-3 py-2 text-sm" onClick={autofillJanDec}>Autofill Jan–Dec</button>
          <button className="rounded-2xl border px-3 py-2 text-sm" onClick={resetSample}>Reset sample</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border p-3 grid gap-3">
            <h3 className="font-semibold">Pricing</h3>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-sm">Commit list price ($/GB)</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={commitList} onChange={(e)=>setCommitList(e.target.value)} placeholder="0.20" />
              </div>
              <div>
                <label className="text-sm">Commit discount (%)</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={commitDiscPct} onChange={(e)=>setCommitDiscPct(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="text-sm text-gray-600">Effective commit: <span className="font-medium">{currency(priceCommit)}</span>/GB</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-sm">Overage list price ($/GB)</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={overageList} onChange={(e)=>setOverageList(e.target.value)} placeholder="0.25" />
              </div>
              <div>
                <label className="text-sm">Overage discount (%)</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={overageDiscPct} onChange={(e)=>setOverageDiscPct(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="text-sm text-gray-600">Effective overage: <span className="font-medium">{currency(priceOverage)}</span>/GB</div>
          </div>

          <div className="rounded-2xl border p-3 grid gap-3">
            <h3 className="font-semibold">Commit Scenario</h3>
            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="text-sm">Fixed commit (GB / month)</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={commit} onChange={(e)=>setCommit(e.target.value)} placeholder="45000" />
              </div>
              <button className="rounded-2xl border px-3 py-2 text-sm bg-black text-white" onClick={()=> setCommit(String(optimal.C))}>
                Use optimal ({optimal.C.toLocaleString()})
              </button>
            </div>
            <div className="text-sm text-gray-600">No rollover. You always pay the base commit each month; usage above commit is billed at the overage rate.</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border p-3">
            <div className="text-sm mb-1 font-medium">Optimal fixed commit</div>
            <div className="text-2xl font-semibold">{optimal.C.toLocaleString()} GB/mo</div>
            <div className="text-sm">Total cost: <span className="font-medium">{currency(optimal.cost)}</span></div>
          </div>
          <div className="rounded-2xl border p-3">
            <div className="text-sm mb-1 font-medium">Current scenario ({Math.round(toNum(commit)).toLocaleString()} GB)</div>
            <div className="text-2xl font-semibold">{currency(scenario.totals.total)}</div>
            <div className="text-sm">Base: {currency(scenario.totals.baseCost)} • Overage: {currency(scenario.totals.overageCost)}</div>
          </div>
          <div className="rounded-2xl border p-3">
            <div className="text-sm mb-1 font-medium">References</div>
            <div className="text-sm">All overage: <span className="font-medium">{currency(overageOnlyCost)}</span></div>
            <div className="text-sm">Variable monthly commit: <span className="font-medium">{currency(variableMonthlyCost)}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Monthly Usage</h2>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={autoYears} onChange={(e)=>setAutoYears(e.target.checked)} />
            Auto-fill years from first year (increment on month rollover)
          </label>
        </div>
        <div className="grid gap-3 mt-2">
          {months.map((m,i)=>(
            <div key={i} className="grid grid-cols-3 gap-2 items-end p-2 rounded-2xl border">
              <div>
                <label className="text-xs">Month</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={months[i]} onChange={(e)=>{ const next=[...months]; next[i]=e.target.value; setMonths(next); }} />
              </div>
              <div>
                <label className="text-xs">Year</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={years[i]||""} onChange={(e)=>{ const next=[...years]; next[i]=e.target.value; setYears(next); }} />
              </div>
              <div>
                <label className="text-xs">Usage (GB)</label>
                <input className="h-10 w-full rounded-xl border px-3 py-2 text-sm" value={usage[i]} onChange={(e)=>{ const next=[...usage]; next[i]=e.target.value; setUsage(next); }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Month-by-month breakdown ({Math.round(toNum(commit)).toLocaleString()} GB commit)</h2>
          <div className="flex gap-2">
            <button className="rounded-2xl border px-3 py-2 text-sm" onClick={()=> downloadCsv(`breakdown_${Math.round(toNum(commit))}GB`, scenario)}>Download CSV</button>
            <button className="rounded-2xl border px-3 py-2 text-sm" onClick={()=> downloadXlsx(`breakdown_${Math.round(toNum(commit))}GB`, scenario)}>Download XLSX</button>
            <button className="rounded-2xl border px-3 py-2 text-sm" onClick={downloadXlsxAll}>Export All to XLSX</button>
          </div>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Usage (GB)</th>
                <th className="text-right py-2 px-3">Commit (GB)</th>
                <th className="text-right py-2 px-3">Overage (GB)</th>
                <th className="text-right py-2 px-3">Unused (GB)</th>
                <th className="text-right py-2 px-3">Base Cost</th>
                <th className="text-right py-2 px-3">Overage Cost</th>
                <th className="text-right py-2 px-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {scenario.rows.map((r:any, idx:number)=>(
                <tr key={idx} className="border-b">
                  <td className="py-2 px-3">{labels[idx]}</td>
                  <td className="text-right py-2 px-3">{r.usage.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">{r.commit.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">{r.overage.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">{r.unused.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">{currency(r.baseCost)}</td>
                  <td className="text-right py-2 px-3">{currency(r.overageCost)}</td>
                  <td className="text-right py-2 px-3 font-medium">{currency(r.total)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 px-3 font-medium">TOTAL</td>
                <td className="text-right py-2 px-3 font-medium">{scenario.totals.usage.toLocaleString()}</td>
                <td className="text-right py-2 px-3 font-medium">{scenario.totals.commit.toLocaleString()}</td>
                <td className="text-right py-2 px-3 font-medium">{scenario.totals.overage.toLocaleString()}</td>
                <td className="text-right py-2 px-3 font-medium">{scenario.totals.unused.toLocaleString()}</td>
                <td className="text-right py-2 px-3 font-semibold">{currency(scenario.totals.baseCost)}</td>
                <td className="text-right py-2 px-3 font-semibold">{currency(scenario.totals.overageCost)}</td>
                <td className="text-right py-2 px-3 font-semibold">{currency(scenario.totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Optimal commit snapshot</h2>
          <div className="flex gap-2">
            <button className="rounded-2xl border px-3 py-2 text-sm" onClick={()=> downloadCsv(`breakdown_${Math.round(toNum(commit))}GB`, scenario)}>Download CSV</button>
            <button className="rounded-2xl border px-3 py-2 text-sm" onClick={()=> downloadXlsx(`breakdown_${Math.round(toNum(commit))}GB`, scenario)}>Download XLSX</button>
            <button className="rounded-2xl border px-3 py-2 text-sm" onClick={downloadXlsxAll}>Export All to XLSX</button>
          </div>
        </div>
        <div className="text-sm grid gap-1 mt-2">
          <div>Optimal commit: <span className="font-medium">{optimal.C.toLocaleString()} GB/month</span> at effective rates {currency(priceCommit)}/GB (commit) and {currency(priceOverage)}/GB (overage)</div>
          <div>Total cost at optimum: <span className="font-medium">{currency(optimal.cost)}</span></div>
        </div>
      </div>
    </div>
  );
}
