"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ComposedChart, Line,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyRow {
  date: string;
  orders: number;
  net_revenue: number;
  cod: number;
  cod_pct: number | null;
  risk_loss: number;
  gross_profit: number;
  gp_pct: number | null;
  ad_spend: number;
  cm: number;
  cm_pct: number | null;
  mer: number | null;
  meta_purchases: number;
  meta_conv_value: number;
}

interface MonthSummary {
  label: string;
  days: number;
  orders: number;
  net_revenue: number;
  cod: number;
  cod_pct: number | null;
  risk_loss: number;
  gross_profit: number;
  gp_pct: number | null;
  ad_spend: number;
  cm: number;
  cm_pct: number | null;
  mer: number | null;
}

interface AdsetRow {
  adset: string;
  spend_7d: number;
  purchases_7d: number;
  conv_value_7d: number;
  roas_7d: number;
  cpa_7d: number | null;
  atc_7d: number;
  status: "effective" | "test" | "watch" | "kill";
}

interface WeekRow {
  week_start: string;
  orders: number;
  net_revenue: number;
  ad_spend: number;
  cm: number;
  cm_pct: number | null;
  mer: number | null;
}

interface Breakeven {
  mer_breakeven: number;
  avg_cod_pct: number;
  avg_risk_pct: number;
  avg_gp_pct: number;
  note: string;
}

interface DashboardData {
  generated_at: string;
  all_time: MonthSummary;
  "2026-01": MonthSummary;
  "2026-02": MonthSummary;
  "2026-03": MonthSummary;
  daily: DailyRow[];
  adset_summary?: AdsetRow[];
  weekly?: WeekRow[];
  breakeven?: Breakeven;
  _meta?: { updated_at?: string; adset_count?: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;

const fmtShort = (v: number) => {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return v < 0 ? `-${s}` : s;
};

const cmColor  = (v: number) => (v >= 0 ? "#10b981" : "#ef4444");
const cmText   = (v: number) => (v >= 0 ? "text-emerald-400" : "text-red-400");
const cmBg     = (v: number) => (v >= 0 ? "bg-emerald-900/20 border-emerald-700/50" : "bg-red-900/20 border-red-700/50");

function formatDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}

function formatWeek(d: string) {
  const [, m, day] = d.split("-");
  return `W${parseInt(m)}/${parseInt(day)}`;
}

const STATUS_CONFIG = {
  effective: { label: "✅ Effective", cls: "bg-emerald-900/40 text-emerald-400 border border-emerald-700/50" },
  watch:     { label: "👀 Watch",     cls: "bg-yellow-900/40 text-yellow-400 border border-yellow-700/50" },
  test:      { label: "🧪 Test",      cls: "bg-blue-900/40 text-blue-400 border border-blue-700/50" },
  kill:      { label: "💀 Kill",      cls: "bg-red-900/40 text-red-400 border border-red-700/50" },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, highlight, accent }: {
  label: string; value: string; sub?: string;
  highlight?: "green" | "red" | "neutral" | "amber";
  accent?: boolean;
}) {
  const colors: Record<string, string> = {
    green: "text-emerald-400", red: "text-red-400",
    neutral: "text-white", amber: "text-amber-400",
  };
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-1 border ${accent ? "bg-amber-900/10 border-amber-700/40" : "bg-[#1c1f2e] border-slate-700"}`}>
      <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${highlight ? colors[highlight] : "text-white"}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function CmTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1f2e] border border-slate-600 rounded-lg p-3 text-sm shadow-xl space-y-1">
      <p className="text-slate-400 text-xs">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={`font-semibold ${p.dataKey === "cm" ? (p.value >= 0 ? "text-emerald-400" : "text-red-400") : "text-amber-300"}`}>
          {p.dataKey === "cm" ? `CM: ${fmt(p.value)}` : `Rev: ${fmt(p.value)}`}
        </p>
      ))}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{title}</h2>
      {sub && <span className="text-xs text-slate-600">{sub}</span>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "adsets" | "weekly">("overview");

  useEffect(() => {
    fetch("/data/dashboard.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => {
        // fallback to daily_pnl.json
        fetch("/data/daily_pnl.json")
          .then((r) => r.json())
          .then((d) => { setData(d); setLoading(false); })
          .catch(() => setLoading(false));
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 text-lg animate-pulse">Loading TheDeerly Dashboard...</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Failed to load data</div>
      </div>
    );
  }

  const latestDay = [...data.daily].reverse().find((r) => r.orders > 0);
  const last30    = data.daily.slice(-30);
  const last14    = data.daily.slice(-14).reverse();
  const adsets    = data.adset_summary ?? [];
  const weekly    = data.weekly ?? [];
  const be        = data.breakeven;

  const months = [
    { key: "2026-03" as const, label: "Mar 2026" },
    { key: "2026-02" as const, label: "Feb 2026" },
    { key: "2026-01" as const, label: "Jan 2026" },
  ];

  // ── Forecast calc ──────────────────────────────────────────────────────────
  const CM_OPEX_TARGET = 5400;

  // Current month actuals (March)
  const curMonth = data["2026-03"] as MonthSummary | undefined;
  const cmToDate = curMonth?.cm ?? 0;
  const revToDate = curMonth?.net_revenue ?? 0;
  const spendToDate = curMonth?.ad_spend ?? 0;

  // Days remaining this month (from today)
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDayOfMonth - today.getDate(); // days after today
  const daysPassed = today.getDate();

  // 3-day rolling avg (last 3 days with orders)
  const daysWithOrders = [...data.daily].reverse().filter((d) => d.orders > 0).slice(0, 3);
  const avg3Rev   = daysWithOrders.length > 0 ? daysWithOrders.reduce((s, d) => s + d.net_revenue, 0) / daysWithOrders.length : 0;
  const avg3Spend = daysWithOrders.length > 0 ? daysWithOrders.reduce((s, d) => s + d.ad_spend, 0) / daysWithOrders.length : 0;
  const avg3CM    = daysWithOrders.length > 0 ? daysWithOrders.reduce((s, d) => s + d.cm, 0) / daysWithOrders.length : 0;
  const avg3MER   = avg3Spend > 0 ? avg3Rev / avg3Spend : 0;

  // Forecast if trend holds
  const forecastRevAdd   = avg3Rev * daysRemaining;
  const forecastSpendAdd = avg3Spend * daysRemaining;
  const forecastCMAdd    = avg3CM * daysRemaining;
  const forecastCMTotal  = cmToDate + forecastCMAdd;

  // What MER do we need in remaining days to hit targets?
  // CM_needed = target - cmToDate
  // CM_remaining = Rev_remaining * gp_pct - Spend_remaining
  // If we assume spend stays same (avg3Spend * daysRemaining):
  //   Rev_needed = (CM_needed + Spend_remaining) / gp_pct
  //   MER_needed = Rev_needed / Spend_remaining
  const gp_pct = be ? be.avg_gp_pct / 100 : 0.59;

  function neededMER(target: number) {
    const cmNeeded = target - cmToDate;
    const spendRemaining = avg3Spend * daysRemaining;
    if (spendRemaining <= 0) return null;
    const revNeeded = (cmNeeded + spendRemaining) / gp_pct;
    return Math.round((revNeeded / spendRemaining) * 100) / 100;
  }
  const merNeededBreakeven = neededMER(0);
  const merNeededOpex      = neededMER(CM_OPEX_TARGET);

  const effectiveCount = adsets.filter((a) => a.status === "effective").length;
  const killCount      = adsets.filter((a) => a.status === "kill").length;
  const effectiveSpend = adsets.filter((a) => a.status === "effective").reduce((s, a) => s + a.spend_7d, 0);
  const totalAdsetSpend= adsets.reduce((s, a) => s + a.spend_7d, 0);
  const spendMix       = totalAdsetSpend > 0 ? Math.round((effectiveSpend / totalAdsetSpend) * 100) : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">🦌 TheDeerly</h1>
          <p className="text-slate-400 text-sm">P&amp;L Dashboard</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-600">Last sync</p>
          <p className="text-xs text-slate-400">{data._meta?.updated_at ?? data.generated_at}</p>
        </div>
      </div>

      {/* ── KPI Cards — latest day ── */}
      {latestDay && (
        <section>
          <SectionHeader title={`Latest Day — ${latestDay.date}`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="CM" value={fmt(latestDay.cm)}
              sub={latestDay.cm_pct != null ? `${latestDay.cm_pct}% of rev` : undefined}
              highlight={latestDay.cm >= 0 ? "green" : "red"} accent />
            <KpiCard label="MER" value={latestDay.mer != null ? `${latestDay.mer}x` : "—"}
              sub={be ? `Breakeven: ≥${be.mer_breakeven}x` : "Net Revenue / Ad Spend"} highlight="amber" />
            <KpiCard label="Orders" value={String(latestDay.orders)}
              sub={`Rev: ${fmt(latestDay.net_revenue)}`} />
            <KpiCard label="Ad Spend" value={fmt(latestDay.ad_spend)}
              sub={`GP: ${fmt(latestDay.gross_profit)}`} />
          </div>
        </section>
      )}

      {/* ── Targets & Forecast ── */}
      <section>
        <SectionHeader title={`📅 ${today.toLocaleString("en-US",{month:"long",year:"numeric"})} Targets`} sub={`${daysPassed} days passed · ${daysRemaining} days remaining`} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Left: CM progress toward targets */}
          <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl p-4 space-y-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">CM Progress</p>

            {/* Breakeven target: CM ≥ 0 */}
            {(() => {
              const pct = cmToDate >= 0 ? 100 : Math.max(0, Math.min(100, ((cmToDate + Math.abs(cmToDate * 2)) / Math.abs(cmToDate * 2)) * 100));
              const hit = cmToDate >= 0;
              return (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Breakeven (CM ≥ $0)</span>
                    <span className={hit ? "text-emerald-400" : "text-amber-400"}>
                      {hit ? "✅ Hit" : `${fmt(cmToDate)} / $0`}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${hit ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: hit ? "100%" : `${Math.max(5, Math.min(95, 100 - (Math.abs(cmToDate) / (Math.abs(cmToDate) + forecastCMAdd + 1)) * 100))}%` }} />
                  </div>
                  {!hit && merNeededBreakeven != null && (
                    <p className="text-xs text-slate-500 mt-1">
                      Need avg MER <span className="text-amber-300">{merNeededBreakeven}x</span> over {daysRemaining} remaining days
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Opex target: CM ≥ $5,400 */}
            {(() => {
              const hit = cmToDate >= CM_OPEX_TARGET;
              const pct = Math.max(0, Math.min(100, (cmToDate / CM_OPEX_TARGET) * 100));
              return (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Opex Target (CM = ${CM_OPEX_TARGET.toLocaleString()})</span>
                    <span className={hit ? "text-emerald-400" : "text-slate-300"}>
                      {hit ? "✅ Hit" : `${fmt(cmToDate)} / $${CM_OPEX_TARGET.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${hit ? "bg-emerald-500" : pct > 50 ? "bg-amber-500" : "bg-slate-600"}`}
                      style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>{pct.toFixed(0)}% of target</span>
                    {!hit && <span>Still need <span className="text-slate-400">{fmt(CM_OPEX_TARGET - cmToDate)}</span></span>}
                  </div>
                  {!hit && merNeededOpex != null && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Need avg MER <span className="text-amber-300">{merNeededOpex}x</span> over {daysRemaining} remaining days
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right: 3-day rolling avg + forecast */}
          <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">3-Day Avg → Month Forecast</p>
            <p className="text-xs text-slate-600">
              Based on last 3 active days:{" "}
              {daysWithOrders.map((d) => d.date.slice(5)).join(", ")}
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Avg Daily Rev</p>
                <p className="text-white font-semibold">{fmt(avg3Rev)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg Daily Spend</p>
                <p className="text-slate-300 font-semibold">{fmt(avg3Spend)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg Daily CM</p>
                <p className={`font-semibold ${avg3CM >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(avg3CM)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg MER</p>
                <p className={`font-semibold ${avg3MER >= (be?.mer_breakeven ?? 1.7) ? "text-emerald-400" : "text-amber-400"}`}>
                  {avg3MER > 0 ? `${avg3MER.toFixed(2)}x` : "—"}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-1">
              <p className="text-xs text-slate-400 font-medium">If trend holds ({daysRemaining}d remaining):</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">+Rev forecast</p>
                  <p className="text-amber-300">{fmt(forecastRevAdd)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">+Spend forecast</p>
                  <p className="text-slate-400">{fmt(forecastSpendAdd)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">Month-end CM forecast</p>
                  <p className={`font-bold text-lg ${forecastCMTotal >= CM_OPEX_TARGET ? "text-emerald-400" : forecastCMTotal >= 0 ? "text-amber-400" : "text-red-400"}`}>
                    {fmt(forecastCMTotal)}
                    {forecastCMTotal >= CM_OPEX_TARGET
                      ? " 🎯 Opex covered!"
                      : forecastCMTotal >= 0
                      ? " ✅ Breakeven"
                      : " ⚠️ Still negative"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-slate-700 pb-0">
        {(["overview", "adsets", "weekly"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
              activeTab === tab
                ? "bg-[#1c1f2e] text-amber-400 border border-b-0 border-slate-700"
                : "text-slate-500 hover:text-slate-300"
            }`}>
            {tab === "overview" ? "📊 Overview" : tab === "adsets" ? "🎯 Adsets" : "📅 Weekly"}
          </button>
        ))}
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB: OVERVIEW */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-8">

          {/* CM Trend + Revenue line */}
          <section>
            <SectionHeader title="CM Trend — Last 30 Days" sub="bars = CM · line = Net Revenue" />
            <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={last30} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tickFormatter={formatDate}
                    tick={{ fill: "#64748b", fontSize: 10 }} interval={4} />
                  <YAxis yAxisId="cm" tickFormatter={fmtShort}
                    tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
                  <YAxis yAxisId="rev" orientation="right" tickFormatter={fmtShort}
                    tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
                  <Tooltip content={<CmTooltip />} />
                  {be && (
                    <ReferenceLine yAxisId="cm" y={0} stroke="#475569" strokeDasharray="4 4" label={{ value: "BE", fill: "#64748b", fontSize: 10 }} />
                  )}
                  <Bar yAxisId="cm" dataKey="cm" radius={[3, 3, 0, 0]}>
                    {last30.map((row, i) => (
                      <Cell key={i} fill={cmColor(row.cm)} fillOpacity={0.85} />
                    ))}
                  </Bar>
                  <Line yAxisId="rev" type="monotone" dataKey="net_revenue"
                    stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeOpacity={0.6} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Daily Table */}
          <section>
            <SectionHeader title="Daily Breakdown — Last 14 Days" />
            <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase">
                    {["Date","Orders","Net Rev","Ad Spend","GP%","CM","CM%","MER"].map((h) => (
                      <th key={h} className="px-3 py-3 text-right first:text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {last14.map((row) => (
                    <tr key={row.date} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 text-slate-300 font-mono text-xs">{row.date}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{row.orders}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{fmt(row.net_revenue)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{fmt(row.ad_spend)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{row.gp_pct != null ? `${row.gp_pct}%` : "—"}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${cmText(row.cm)}`}>{fmt(row.cm)}</td>
                      <td className={`px-3 py-2 text-right text-xs ${cmText(row.cm)}`}>{row.cm_pct != null ? `${row.cm_pct}%` : "—"}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{row.mer != null ? `${row.mer}x` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Monthly Summary */}
          <section>
            <SectionHeader title="Monthly Summary" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {months.map(({ key, label }) => {
                const m = data[key] as MonthSummary | undefined;
                if (!m || (!m.orders && !m.ad_spend)) return null;
                return (
                  <div key={key} className={`border rounded-xl p-4 space-y-2 ${cmBg(m.cm)}`}>
                    <p className="font-semibold text-slate-200">{label}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {[
                        ["Orders", String(m.orders), "text-slate-200"],
                        ["Net Rev", fmt(m.net_revenue), "text-slate-200"],
                        ["Ad Spend", fmt(m.ad_spend), "text-slate-300"],
                        ["CM", fmt(m.cm), cmText(m.cm) + " font-bold"],
                        ["CM%", m.cm_pct != null ? `${m.cm_pct}%` : "—", cmText(m.cm)],
                        ["MER", m.mer != null ? `${m.mer}x` : "—", "text-amber-400"],
                      ].map(([lbl, val, cls]) => (
                        <>
                          <span className="text-slate-400">{lbl}</span>
                          <span className={`text-right ${cls}`}>{val}</span>
                        </>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* All-time */}
          <section>
            <SectionHeader title="All-Time" />
            <div className={`border rounded-xl p-4 ${cmBg(data.all_time.cm)}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {[
                  ["Orders", String(data.all_time.orders), "text-white"],
                  ["Net Revenue", fmt(data.all_time.net_revenue), "text-white"],
                  ["Total CM", fmt(data.all_time.cm), cmText(data.all_time.cm) + " font-bold"],
                  ["MER", data.all_time.mer != null ? `${data.all_time.mer}x` : "—", "text-amber-400"],
                ].map(([lbl, val, cls]) => (
                  <div key={lbl as string}>
                    <p className="text-slate-400 text-xs">{lbl}</p>
                    <p className={`font-semibold text-lg ${cls}`}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB: ADSETS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "adsets" && (
        <div className="space-y-6">

          {/* Adset health summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Effective Adsets" value={String(effectiveCount)}
              sub="≥2 purchases / 7d" highlight="green" />
            <KpiCard label="Kill Candidates" value={String(killCount)}
              sub=">$20 spent, 0 ATC" highlight="red" />
            <KpiCard label="Effective Spend %" value={`${spendMix}%`}
              sub={`Target: 80% · $${effectiveSpend.toFixed(0)} / $${totalAdsetSpend.toFixed(0)}`}
              highlight={spendMix >= 75 ? "green" : spendMix >= 50 ? "amber" : "red"} />
            <KpiCard label="Total Adsets" value={String(adsets.length)}
              sub="Last 7 days active" />
          </div>

          {/* Adset table */}
          <section>
            <SectionHeader title="Adset Performance — Last 7 Days" sub="sorted: Effective → Watch → Test → Kill" />
            <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase">
                    <th className="px-3 py-3 text-left font-medium">Adset</th>
                    <th className="px-3 py-3 text-right font-medium">Spend</th>
                    <th className="px-3 py-3 text-right font-medium">Purch</th>
                    <th className="px-3 py-3 text-right font-medium">ROAS</th>
                    <th className="px-3 py-3 text-right font-medium">CPA</th>
                    <th className="px-3 py-3 text-right font-medium">ATC</th>
                    <th className="px-3 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adsets.map((row) => {
                    const sc = STATUS_CONFIG[row.status];
                    return (
                      <tr key={row.adset} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2 text-slate-300 text-xs font-mono max-w-[200px] truncate">{row.adset}</td>
                        <td className="px-3 py-2 text-right text-slate-200">{fmt(row.spend_7d)}</td>
                        <td className="px-3 py-2 text-right text-slate-200">{row.purchases_7d}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${row.roas_7d >= 1.7 ? "text-emerald-400" : row.roas_7d >= 1 ? "text-amber-400" : "text-red-400"}`}>
                          {row.roas_7d > 0 ? `${row.roas_7d}x` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {row.cpa_7d != null ? fmt(row.cpa_7d) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">{row.atc_7d}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Rules: Effective = ≥2 purchases/7d · Kill = spend &gt;$20 &amp; 0 ATC · Watch = low spend, no ATC
            </p>
          </section>

          {/* Adset bar chart */}
          {adsets.length > 0 && (
            <section>
              <SectionHeader title="Spend vs Purchases by Adset" />
              <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={adsets.slice(0, 10).map(a => ({
                      name: a.adset.split("_").slice(-1)[0] || a.adset.slice(-8),
                      spend: a.spend_7d,
                      purch: a.purchases_7d,
                      status: a.status,
                    }))}
                    margin={{ top: 4, right: 8, bottom: 20, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={44} tickFormatter={fmtShort} />
                    <Tooltip
                      contentStyle={{ background: "#1c1f2e", border: "1px solid #334155", borderRadius: 8 }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Bar dataKey="spend" name="Spend" radius={[3, 3, 0, 0]}>
                      {adsets.slice(0, 10).map((a, i) => (
                        <Cell key={i} fill={a.status === "effective" ? "#10b981" : a.status === "kill" ? "#ef4444" : "#f59e0b"} fillOpacity={0.75} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB: WEEKLY */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "weekly" && (
        <div className="space-y-6">
          {/* Weekly chart */}
          <section>
            <SectionHeader title="Weekly CM — Last 8 Weeks" />
            <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[...weekly].reverse()} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="week_start" tickFormatter={formatWeek} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tickFormatter={fmtShort} tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
                  <Tooltip
                    formatter={(v: unknown) => [fmt(Number(v)), "CM"]}
                    contentStyle={{ background: "#1c1f2e", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                  <Bar dataKey="cm" radius={[3, 3, 0, 0]}>
                    {[...weekly].reverse().map((row, i) => (
                      <Cell key={i} fill={cmColor(row.cm)} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Weekly table */}
          <section>
            <SectionHeader title="Weekly P&L Table" />
            <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase">
                    {["Week of", "Orders", "Net Rev", "Ad Spend", "CM", "CM%", "MER"].map((h) => (
                      <th key={h} className="px-3 py-3 text-right first:text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekly.map((row) => (
                    <tr key={row.week_start} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 text-slate-300 font-mono text-xs">{row.week_start}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{row.orders}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{fmt(row.net_revenue)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{fmt(row.ad_spend)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${cmText(row.cm)}`}>{fmt(row.cm)}</td>
                      <td className={`px-3 py-2 text-right text-xs ${cmText(row.cm)}`}>{row.cm_pct != null ? `${row.cm_pct}%` : "—"}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{row.mer != null ? `${row.mer}x` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="text-center text-xs text-slate-700 pb-4 pt-2 border-t border-slate-800">
        🦌 TheDeerly Dashboard · Synced daily 2:15 PM GMT+7 · Built with ❤️ by Wally 🔧
      </footer>
    </main>
  );
}
