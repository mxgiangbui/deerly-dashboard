"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ComposedChart, Line,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — Tesla-inspired
// Background:   #111111
// Surface L1:   #1a1a1a  (cards)
// Surface L2:   #222222  (nested / hover)
// Border:       #2e2e2e  (subtle) / #3d3d3d (strong)
// Text primary: #f5f5f5
// Text muted:   #a3a3a3
// Text dim:     #525252
// Positive:     #4ade80  (green-400)
// Negative:     #f87171  (red-400)
// Warning:      #facc15  (yellow-400)
// Neutral info: #94a3b8  (slate-400)
// Chart rev:    #e2e8f0  (white-ish line)
// ─────────────────────────────────────────────────────────────────────────────

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

// Positive = #4ade80, Negative = #f87171
const cmColor = (v: number) => (v >= 0 ? "#4ade80" : "#f87171");
const cmText  = (v: number) => (v >= 0 ? "text-[#4ade80]" : "text-[#f87171]");

function formatDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}

function formatWeek(d: string) {
  const [, m, day] = d.split("-");
  return `W${parseInt(m)}/${parseInt(day)}`;
}

// Status badge config — monochromatic with subtle tints
const STATUS_CONFIG = {
  effective: {
    label: "Effective",
    dot: "bg-[#4ade80]",
    cls: "bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20",
  },
  watch: {
    label: "Watch",
    dot: "bg-[#facc15]",
    cls: "bg-[#facc15]/10 text-[#facc15] border border-[#facc15]/20",
  },
  test: {
    label: "Test",
    dot: "bg-[#94a3b8]",
    cls: "bg-[#94a3b8]/10 text-[#94a3b8] border border-[#94a3b8]/20",
  },
  kill: {
    label: "Kill",
    dot: "bg-[#f87171]",
    cls: "bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/20",
  },
};

// ── Primitives ────────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function Badge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const s = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Divider() {
  return <div className="h-px bg-[#2e2e2e]" />;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, valueColor }: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <Card className="p-4 flex flex-col gap-1.5">
      <span className="text-[11px] text-[#525252] uppercase tracking-widest font-medium">{label}</span>
      <span className={`text-2xl font-semibold tracking-tight ${valueColor ?? "text-[#f5f5f5]"}`}>{value}</span>
      {sub && <span className="text-[11px] text-[#525252]">{sub}</span>}
    </Card>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h2 className="text-[11px] text-[#525252] uppercase tracking-widest font-semibold">{title}</h2>
      {sub && <span className="text-[11px] text-[#525252]">{sub}</span>}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(1, Math.min(100, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Chart Tooltip ─────────────────────────────────────────────────────────────

function CmTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#222222] border border-[#3d3d3d] rounded-lg p-3 text-sm shadow-2xl space-y-1">
      <p className="text-[#525252] text-xs">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.dataKey === "cm" ? cmColor(p.value) : "#e2e8f0" }} className="font-medium">
          {p.dataKey === "cm" ? `CM: ${fmt(p.value)}` : `Rev: ${fmt(p.value)}`}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "adsets" | "weekly">("overview");

  useEffect(() => {
    fetch("/data/dashboard.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() =>
        fetch("/data/daily_pnl.json")
          .then((r) => r.json())
          .then((d) => { setData(d); setLoading(false); })
          .catch(() => setLoading(false))
      );
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <p className="text-[#525252] text-sm tracking-widest uppercase animate-pulse">Loading…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <p className="text-[#f87171] text-sm">Failed to load data</p>
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

  // ── Forecast ────────────────────────────────────────────────────────────────
  const CM_OPEX_TARGET = 5400;
  const today          = new Date();
  const lastDOM        = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining  = lastDOM - today.getDate();
  const daysPassed     = today.getDate();

  const curMonth   = data["2026-03"] as MonthSummary | undefined;
  const cmToDate   = curMonth?.cm ?? 0;

  const daysWithOrders = [...data.daily].reverse().filter((d) => d.orders > 0).slice(0, 3);
  const avg3Rev    = daysWithOrders.length ? daysWithOrders.reduce((s, d) => s + d.net_revenue, 0) / daysWithOrders.length : 0;
  const avg3Spend  = daysWithOrders.length ? daysWithOrders.reduce((s, d) => s + d.ad_spend, 0) / daysWithOrders.length : 0;
  const avg3CM     = daysWithOrders.length ? daysWithOrders.reduce((s, d) => s + d.cm, 0) / daysWithOrders.length : 0;
  const avg3MER    = avg3Spend > 0 ? avg3Rev / avg3Spend : 0;

  const forecastCMAdd   = avg3CM * daysRemaining;
  const forecastRevAdd  = avg3Rev * daysRemaining;
  const forecastSpendAdd= avg3Spend * daysRemaining;
  const forecastCMTotal = cmToDate + forecastCMAdd;

  const gp_pct = be ? be.avg_gp_pct / 100 : 0.59;
  function neededMER(target: number) {
    const spendRem = avg3Spend * daysRemaining;
    if (spendRem <= 0) return null;
    const revNeeded = (target - cmToDate + spendRem) / gp_pct;
    return Math.round((revNeeded / spendRem) * 100) / 100;
  }
  const merNeededBreakeven = neededMER(0);
  const merNeededOpex      = neededMER(CM_OPEX_TARGET);

  // Pre-computed progress values (no IIFE in JSX)
  const beHit         = cmToDate >= 0;
  const opexHit       = cmToDate >= CM_OPEX_TARGET;
  const opexPct       = Math.max(0, Math.min(100, (cmToDate / CM_OPEX_TARGET) * 100));
  const beBarPct      = beHit ? 100 : Math.max(5, Math.min(95, 100 - (Math.abs(cmToDate) / (Math.abs(cmToDate) + Math.abs(forecastCMAdd) + 1)) * 100));

  // Adsets
  const effectiveCount  = adsets.filter((a) => a.status === "effective").length;
  const killCount       = adsets.filter((a) => a.status === "kill").length;
  const effectiveSpend  = adsets.filter((a) => a.status === "effective").reduce((s, a) => s + a.spend_7d, 0);
  const totalAdsetSpend = adsets.reduce((s, a) => s + a.spend_7d, 0);
  const spendMix        = totalAdsetSpend > 0 ? Math.round((effectiveSpend / totalAdsetSpend) * 100) : 0;

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "adsets",   label: "Adsets" },
    { id: "weekly",   label: "Weekly" },
  ] as const;

  return (
    <main className="min-h-screen bg-[#111111] text-[#f5f5f5]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* ── Header ── */}
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#f5f5f5]">TheDeerly</h1>
            <p className="text-[#525252] text-sm mt-0.5">P&L Dashboard</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#525252] uppercase tracking-widest">Last sync</p>
            <p className="text-xs text-[#a3a3a3] mt-0.5">{data._meta?.updated_at ?? data.generated_at}</p>
          </div>
        </header>

        <Divider />

        {/* ── KPI Strip — Latest Day ── */}
        {latestDay && (
          <section>
            <SectionHeader title={`Latest — ${latestDay.date}`} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="CM"
                value={fmt(latestDay.cm)}
                sub={latestDay.cm_pct != null ? `${latestDay.cm_pct}% of revenue` : undefined}
                valueColor={cmText(latestDay.cm)}
              />
              <KpiCard
                label="MER"
                value={latestDay.mer != null ? `${latestDay.mer}x` : "—"}
                sub={be ? `Breakeven ≥ ${be.mer_breakeven}x` : "Net Revenue / Ad Spend"}
                valueColor={latestDay.mer != null && be && latestDay.mer >= be.mer_breakeven ? "text-[#4ade80]" : "text-[#f5f5f5]"}
              />
              <KpiCard
                label="Orders"
                value={String(latestDay.orders)}
                sub={`Rev ${fmt(latestDay.net_revenue)}`}
              />
              <KpiCard
                label="Ad Spend"
                value={fmt(latestDay.ad_spend)}
                sub={`GP ${fmt(latestDay.gross_profit)}`}
              />
            </div>
          </section>
        )}

        {/* ── Targets & Forecast ── */}
        <section>
          <SectionHeader
            title={`${today.toLocaleString("en-US", { month: "long", year: "numeric" })} — Targets`}
            sub={`${daysPassed}d passed · ${daysRemaining}d remaining`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* CM Progress */}
            <Card className="p-5 space-y-5">
              <p className="text-[11px] text-[#525252] uppercase tracking-widest font-semibold">CM Progress</p>

              {/* Breakeven */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-[#a3a3a3]">Breakeven</span>
                  <span className={`text-sm font-medium ${beHit ? "text-[#4ade80]" : "text-[#f5f5f5]"}`}>
                    {beHit ? "Hit ✓" : fmt(cmToDate)}
                  </span>
                </div>
                <ProgressBar pct={beBarPct} color={beHit ? "#4ade80" : "#facc15"} />
                {!beHit && merNeededBreakeven != null && (
                  <p className="text-[11px] text-[#525252]">
                    Need MER <span className="text-[#facc15]">{merNeededBreakeven}x</span> avg over {daysRemaining} remaining days
                  </p>
                )}
              </div>

              <Divider />

              {/* Opex Target */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-[#a3a3a3]">Opex Target</span>
                  <span className={`text-sm font-medium ${opexHit ? "text-[#4ade80]" : "text-[#f5f5f5]"}`}>
                    {opexHit ? "Hit ✓" : `${fmt(cmToDate)} / $${CM_OPEX_TARGET.toLocaleString()}`}
                  </span>
                </div>
                <ProgressBar
                  pct={opexPct}
                  color={opexHit ? "#4ade80" : opexPct > 50 ? "#facc15" : "#3d3d3d"}
                />
                <div className="flex justify-between text-[11px] text-[#525252]">
                  <span>{opexPct.toFixed(0)}% of ${CM_OPEX_TARGET.toLocaleString()}</span>
                  {!opexHit && <span>Still need {fmt(CM_OPEX_TARGET - cmToDate)}</span>}
                </div>
                {!opexHit && merNeededOpex != null && (
                  <p className="text-[11px] text-[#525252]">
                    Need MER <span className="text-[#facc15]">{merNeededOpex}x</span> avg over {daysRemaining} remaining days
                  </p>
                )}
              </div>
            </Card>

            {/* 3-Day Forecast */}
            <Card className="p-5 space-y-4">
              <p className="text-[11px] text-[#525252] uppercase tracking-widest font-semibold">3-Day Avg → Forecast</p>
              <p className="text-[11px] text-[#525252]">
                Based on: {daysWithOrders.map((d) => d.date.slice(5)).join(", ")}
              </p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: "Avg Daily Rev",   value: fmt(avg3Rev),   color: "text-[#f5f5f5]" },
                  { label: "Avg Daily Spend",  value: fmt(avg3Spend), color: "text-[#a3a3a3]" },
                  { label: "Avg Daily CM",     value: fmt(avg3CM),    color: cmText(avg3CM) },
                  { label: "Avg MER",          value: avg3MER > 0 ? `${avg3MER.toFixed(2)}x` : "—",
                    color: avg3MER >= (be?.mer_breakeven ?? 1.7) ? "text-[#4ade80]" : "text-[#f5f5f5]" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-[11px] text-[#525252]">{label}</p>
                    <p className={`text-sm font-medium mt-0.5 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <Divider />

              <div className="space-y-1">
                <p className="text-[11px] text-[#525252]">Month-end forecast ({daysRemaining}d remaining)</p>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <p className="text-[11px] text-[#525252]">+Rev</p>
                    <p className="text-sm text-[#a3a3a3]">{fmt(forecastRevAdd)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#525252]">+Spend</p>
                    <p className="text-sm text-[#525252]">{fmt(forecastSpendAdd)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#525252]">CM Total</p>
                    <p className={`text-sm font-semibold ${forecastCMTotal >= CM_OPEX_TARGET ? "text-[#4ade80]" : forecastCMTotal >= 0 ? "text-[#facc15]" : "text-[#f87171]"}`}>
                      {fmt(forecastCMTotal)}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-[#525252] mt-1">
                  {forecastCMTotal >= CM_OPEX_TARGET
                    ? "On track — opex covered"
                    : forecastCMTotal >= 0
                    ? "On track — breakeven"
                    : "Below breakeven at current pace"}
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* ── Tabs ── */}
        <div>
          <div className="flex gap-1 border-b border-[#2e2e2e]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "border-[#f5f5f5] text-[#f5f5f5]"
                    : "border-transparent text-[#525252] hover:text-[#a3a3a3]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB: OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-8 pt-8">

              {/* CM Trend */}
              <section>
                <SectionHeader title="CM Trend — Last 30 Days" sub="bars = CM · line = Net Revenue" />
                <Card className="p-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={last30} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                      <XAxis dataKey="date" tickFormatter={formatDate}
                        tick={{ fill: "#525252", fontSize: 10 }} interval={4} />
                      <YAxis yAxisId="cm" tickFormatter={fmtShort}
                        tick={{ fill: "#525252", fontSize: 10 }} width={48} />
                      <YAxis yAxisId="rev" orientation="right" tickFormatter={fmtShort}
                        tick={{ fill: "#525252", fontSize: 10 }} width={48} />
                      <Tooltip content={<CmTooltip />} />
                      <ReferenceLine yAxisId="cm" y={0} stroke="#3d3d3d" strokeDasharray="4 4" />
                      <Bar yAxisId="cm" dataKey="cm" radius={[3, 3, 0, 0]}>
                        {last30.map((row, i) => (
                          <Cell key={i} fill={cmColor(row.cm)} fillOpacity={0.8} />
                        ))}
                      </Bar>
                      <Line yAxisId="rev" type="monotone" dataKey="net_revenue"
                        stroke="#e2e8f0" strokeWidth={1.5} dot={false} strokeOpacity={0.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              </section>

              {/* Daily Table */}
              <section>
                <SectionHeader title="Daily Breakdown — Last 14 Days" />
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#2e2e2e] text-[#525252] text-[11px] uppercase">
                        {["Date","Orders","Net Rev","Ad Spend","GP%","CM","CM%","MER"].map((h) => (
                          <th key={h} className="px-4 py-3 text-right first:text-left font-medium tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {last14.map((row) => (
                        <tr key={row.date} className="border-b border-[#1a1a1a] hover:bg-[#222222] transition-colors">
                          <td className="px-4 py-2.5 text-[#a3a3a3] font-mono text-xs">{row.date}</td>
                          <td className="px-4 py-2.5 text-right text-[#f5f5f5]">{row.orders}</td>
                          <td className="px-4 py-2.5 text-right text-[#f5f5f5]">{fmt(row.net_revenue)}</td>
                          <td className="px-4 py-2.5 text-right text-[#a3a3a3]">{fmt(row.ad_spend)}</td>
                          <td className="px-4 py-2.5 text-right text-[#a3a3a3]">{row.gp_pct != null ? `${row.gp_pct}%` : "—"}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${cmText(row.cm)}`}>{fmt(row.cm)}</td>
                          <td className={`px-4 py-2.5 text-right text-xs ${cmText(row.cm)}`}>{row.cm_pct != null ? `${row.cm_pct}%` : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-[#a3a3a3]">{row.mer != null ? `${row.mer}x` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>

              {/* Monthly Summary */}
              <section>
                <SectionHeader title="Monthly Summary" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {months.map(({ key, label }) => {
                    const m = data[key] as MonthSummary | undefined;
                    if (!m || (!m.orders && !m.ad_spend)) return null;
                    const positive = m.cm >= 0;
                    return (
                      <Card key={key} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-[#f5f5f5]">{label}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${positive ? "bg-[#4ade80]/10 text-[#4ade80]" : "bg-[#f87171]/10 text-[#f87171]"}`}>
                            {m.cm_pct != null ? `${m.cm_pct}%` : "—"}
                          </span>
                        </div>
                        <Divider />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {[
                            ["Orders",   String(m.orders),          "text-[#f5f5f5]"],
                            ["Net Rev",  fmt(m.net_revenue),         "text-[#f5f5f5]"],
                            ["Ad Spend", fmt(m.ad_spend),            "text-[#a3a3a3]"],
                            ["CM",       fmt(m.cm),                  cmText(m.cm) + " font-semibold"],
                            ["MER",      m.mer != null ? `${m.mer}x` : "—", "text-[#a3a3a3]"],
                            ["GP%",      m.gp_pct != null ? `${m.gp_pct}%` : "—", "text-[#a3a3a3]"],
                          ].map(([lbl, val, cls]) => (
                            <>
                              <span className="text-[#525252] text-xs">{lbl}</span>
                              <span className={`text-right text-xs ${cls}`}>{val}</span>
                            </>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* All-time */}
              <section>
                <SectionHeader title="All-Time" />
                <Card className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { label: "Orders",      value: String(data.all_time.orders),    color: "text-[#f5f5f5]" },
                      { label: "Net Revenue", value: fmt(data.all_time.net_revenue),  color: "text-[#f5f5f5]" },
                      { label: "Total CM",    value: fmt(data.all_time.cm),           color: cmText(data.all_time.cm) },
                      { label: "MER",         value: data.all_time.mer != null ? `${data.all_time.mer}x` : "—", color: "text-[#a3a3a3]" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-[11px] text-[#525252] uppercase tracking-widest">{label}</p>
                        <p className={`text-xl font-semibold mt-1 ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            </div>
          )}

          {/* ── TAB: ADSETS ── */}
          {activeTab === "adsets" && (
            <div className="space-y-6 pt-8">

              {/* Summary strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Effective" value={String(effectiveCount)}
                  sub="≥ 2 purchases / 7d" valueColor="text-[#4ade80]" />
                <KpiCard label="Kill" value={String(killCount)}
                  sub="> $20 spent, 0 ATC" valueColor={killCount > 0 ? "text-[#f87171]" : "text-[#f5f5f5]"} />
                <KpiCard
                  label="Effective Spend %"
                  value={`${spendMix}%`}
                  sub={`$${effectiveSpend.toFixed(0)} / $${totalAdsetSpend.toFixed(0)} · Target 80%`}
                  valueColor={spendMix >= 75 ? "text-[#4ade80]" : spendMix >= 50 ? "text-[#facc15]" : "text-[#f87171]"}
                />
                <KpiCard label="Active Adsets" value={String(adsets.length)}
                  sub="Last 7 days with spend" />
              </div>

              {/* Adset table */}
              <section>
                <SectionHeader title="Adset Performance — Last 7 Days" />
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-[#2e2e2e] text-[#525252] text-[11px] uppercase">
                        <th className="px-4 py-3 text-left font-medium tracking-wider">Adset</th>
                        <th className="px-4 py-3 text-right font-medium tracking-wider">Spend</th>
                        <th className="px-4 py-3 text-right font-medium tracking-wider">Purch</th>
                        <th className="px-4 py-3 text-right font-medium tracking-wider">ROAS</th>
                        <th className="px-4 py-3 text-right font-medium tracking-wider">CPA</th>
                        <th className="px-4 py-3 text-right font-medium tracking-wider">ATC</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adsets.map((row) => (
                        <tr key={row.adset} className="border-b border-[#1a1a1a] hover:bg-[#222222] transition-colors">
                          <td className="px-4 py-2.5 text-[#a3a3a3] text-xs font-mono max-w-[200px] truncate">{row.adset}</td>
                          <td className="px-4 py-2.5 text-right text-[#f5f5f5]">{fmt(row.spend_7d)}</td>
                          <td className="px-4 py-2.5 text-right text-[#f5f5f5]">{row.purchases_7d}</td>
                          <td className={`px-4 py-2.5 text-right font-medium ${
                            row.roas_7d >= 1.7 ? "text-[#4ade80]" : row.roas_7d >= 1 ? "text-[#facc15]" : "text-[#f87171]"
                          }`}>
                            {row.roas_7d > 0 ? `${row.roas_7d}x` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[#a3a3a3]">
                            {row.cpa_7d != null ? fmt(row.cpa_7d) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[#a3a3a3]">{row.atc_7d}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <p className="text-[11px] text-[#525252] mt-2">
                  Effective = ≥ 2 purchases / 7d · Kill = spend &gt; $20 &amp; 0 ATC · Watch = low spend, 0 ATC
                </p>
              </section>

              {/* Adset bar chart */}
              {adsets.length > 0 && (
                <section>
                  <SectionHeader title="Spend by Adset — Last 7 Days" />
                  <Card className="p-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={adsets.slice(0, 10).map((a) => ({
                          name: a.adset.split("_").slice(-1)[0] || a.adset.slice(-8),
                          spend: a.spend_7d,
                          status: a.status,
                        }))}
                        margin={{ top: 4, right: 8, bottom: 24, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                        <XAxis dataKey="name" tick={{ fill: "#525252", fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: "#525252", fontSize: 10 }} width={44} tickFormatter={fmtShort} />
                        <Tooltip
                          contentStyle={{ background: "#222222", border: "1px solid #3d3d3d", borderRadius: 8 }}
                          labelStyle={{ color: "#a3a3a3" }}
                          itemStyle={{ color: "#f5f5f5" }}
                        />
                        <Bar dataKey="spend" name="Spend" radius={[3, 3, 0, 0]}>
                          {adsets.slice(0, 10).map((a, i) => (
                            <Cell key={i}
                              fill={a.status === "effective" ? "#4ade80" : a.status === "kill" ? "#f87171" : a.status === "watch" ? "#facc15" : "#525252"}
                              fillOpacity={0.75}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </section>
              )}
            </div>
          )}

          {/* ── TAB: WEEKLY ── */}
          {activeTab === "weekly" && (
            <div className="space-y-6 pt-8">

              <section>
                <SectionHeader title="Weekly CM — Last 8 Weeks" />
                <Card className="p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[...weekly].reverse()} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                      <XAxis dataKey="week_start" tickFormatter={formatWeek}
                        tick={{ fill: "#525252", fontSize: 10 }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fill: "#525252", fontSize: 10 }} width={48} />
                      <Tooltip
                        formatter={(v: unknown) => [fmt(Number(v)), "CM"]}
                        contentStyle={{ background: "#222222", border: "1px solid #3d3d3d", borderRadius: 8 }}
                        labelStyle={{ color: "#a3a3a3" }}
                        itemStyle={{ color: "#f5f5f5" }}
                      />
                      <ReferenceLine y={0} stroke="#3d3d3d" strokeDasharray="4 4" />
                      <Bar dataKey="cm" radius={[3, 3, 0, 0]}>
                        {[...weekly].reverse().map((row, i) => (
                          <Cell key={i} fill={cmColor(row.cm)} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </section>

              <section>
                <SectionHeader title="Weekly P&L" />
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b border-[#2e2e2e] text-[#525252] text-[11px] uppercase">
                        {["Week of","Orders","Net Rev","Ad Spend","CM","CM%","MER"].map((h) => (
                          <th key={h} className="px-4 py-3 text-right first:text-left font-medium tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weekly.map((row) => (
                        <tr key={row.week_start} className="border-b border-[#1a1a1a] hover:bg-[#222222] transition-colors">
                          <td className="px-4 py-2.5 text-[#a3a3a3] font-mono text-xs">{row.week_start}</td>
                          <td className="px-4 py-2.5 text-right text-[#f5f5f5]">{row.orders}</td>
                          <td className="px-4 py-2.5 text-right text-[#f5f5f5]">{fmt(row.net_revenue)}</td>
                          <td className="px-4 py-2.5 text-right text-[#a3a3a3]">{fmt(row.ad_spend)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${cmText(row.cm)}`}>{fmt(row.cm)}</td>
                          <td className={`px-4 py-2.5 text-right text-xs ${cmText(row.cm)}`}>{row.cm_pct != null ? `${row.cm_pct}%` : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-[#a3a3a3]">{row.mer != null ? `${row.mer}x` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="pt-4 border-t border-[#2e2e2e] text-center">
          <p className="text-[11px] text-[#525252]">TheDeerly Dashboard · Synced daily 2:15 PM GMT+7</p>
        </footer>

      </div>
    </main>
  );
}
