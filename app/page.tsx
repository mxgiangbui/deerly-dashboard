"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

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

interface PnLData {
  generated_at: string;
  all_time: MonthSummary;
  "2026-01": MonthSummary;
  "2026-02": MonthSummary;
  "2026-03": MonthSummary;
  daily: DailyRow[];
  _meta?: { updated_at?: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;

const fmtShort = (v: number) => {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return v < 0 ? `-${s}` : s;
};

const cmColor = (v: number) => (v >= 0 ? "#10b981" : "#ef4444");
const cmBg = (v: number) => (v >= 0 ? "bg-emerald-900/30 border-emerald-700" : "bg-red-900/30 border-red-700");
const cmText = (v: number) => (v >= 0 ? "text-emerald-400" : "text-red-400");

function formatDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: "green" | "red" | "neutral";
}) {
  const colors = {
    green: "text-emerald-400",
    red: "text-red-400",
    neutral: "text-amber-400",
  };
  return (
    <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${highlight ? colors[highlight] : "text-white"}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CmTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-[#1c1f2e] border border-slate-600 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className={`font-bold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(v)}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/daily_pnl.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 text-lg animate-pulse">Loading dashboard...</div>
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

  // Latest day with orders
  const latestWithOrders = [...data.daily].reverse().find((r) => r.orders > 0);
  const last30 = data.daily.slice(-30);
  const last14 = data.daily.slice(-14).reverse();

  const months = [
    { key: "2026-03", label: "Mar 2026" },
    { key: "2026-02", label: "Feb 2026" },
    { key: "2026-01", label: "Jan 2026" },
  ] as const;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">🦌 TheDeerly</h1>
          <p className="text-slate-400 text-sm">P&L Dashboard</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Last sync</p>
          <p className="text-xs text-slate-400">{data._meta?.updated_at ?? data.generated_at}</p>
        </div>
      </div>

      {/* ── KPI Cards — latest day ── */}
      {latestWithOrders && (
        <section>
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
            Latest Day — {latestWithOrders.date}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="CM"
              value={fmt(latestWithOrders.cm)}
              sub={latestWithOrders.cm_pct != null ? `${latestWithOrders.cm_pct}% of rev` : undefined}
              highlight={latestWithOrders.cm >= 0 ? "green" : "red"}
            />
            <KpiCard
              label="MER"
              value={latestWithOrders.mer != null ? `${latestWithOrders.mer}x` : "—"}
              sub="Meta spend / Revenue"
              highlight="neutral"
            />
            <KpiCard
              label="Orders"
              value={String(latestWithOrders.orders)}
              sub={`Rev: ${fmt(latestWithOrders.net_revenue)}`}
            />
            <KpiCard
              label="Ad Spend"
              value={fmt(latestWithOrders.ad_spend)}
              sub={`GP: ${fmt(latestWithOrders.gross_profit)}`}
            />
          </div>
        </section>
      )}

      {/* ── CM Trend Chart ── */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          CM Trend — Last 30 Days
        </h2>
        <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last30} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                interval={4}
              />
              <YAxis
                tickFormatter={(v) => fmtShort(v)}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                width={48}
              />
              <Tooltip content={<CmTooltip />} />
              <Bar dataKey="cm" radius={[3, 3, 0, 0]}>
                {last30.map((row, i) => (
                  <Cell key={i} fill={cmColor(row.cm)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Daily Table ── */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Daily Breakdown — Last 14 Days
        </h2>
        <div className="bg-[#1c1f2e] border border-slate-700 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                {["Date", "Orders", "Net Rev", "Ad Spend", "GP%", "CM", "CM%", "MER"].map((h) => (
                  <th key={h} className="px-3 py-3 text-right first:text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {last14.map((row) => (
                <tr key={row.date} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2 text-slate-300 font-mono text-xs">{row.date}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{row.orders}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{fmt(row.net_revenue)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{fmt(row.ad_spend)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {row.gp_pct != null ? `${row.gp_pct}%` : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold ${cmText(row.cm)}`}>
                    {fmt(row.cm)}
                  </td>
                  <td className={`px-3 py-2 text-right ${cmText(row.cm)}`}>
                    {row.cm_pct != null ? `${row.cm_pct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {row.mer != null ? `${row.mer}x` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Monthly Summary ── */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Monthly Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {months.map(({ key, label }) => {
            const m = data[key] as MonthSummary | undefined;
            if (!m || (!m.orders && !m.ad_spend)) return null;
            return (
              <div
                key={key}
                className={`border rounded-xl p-4 space-y-2 ${cmBg(m.cm)}`}
              >
                <p className="font-semibold text-slate-200">{label}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-slate-400">Orders</span>
                  <span className="text-right text-slate-200">{m.orders}</span>
                  <span className="text-slate-400">Net Rev</span>
                  <span className="text-right text-slate-200">{fmt(m.net_revenue)}</span>
                  <span className="text-slate-400">Ad Spend</span>
                  <span className="text-right text-slate-300">{fmt(m.ad_spend)}</span>
                  <span className="text-slate-400">CM</span>
                  <span className={`text-right font-bold ${cmText(m.cm)}`}>{fmt(m.cm)}</span>
                  <span className="text-slate-400">CM%</span>
                  <span className={`text-right ${cmText(m.cm)}`}>
                    {m.cm_pct != null ? `${m.cm_pct}%` : "—"}
                  </span>
                  <span className="text-slate-400">MER</span>
                  <span className="text-right text-amber-400">
                    {m.mer != null ? `${m.mer}x` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── All-time ── */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">All-Time</h2>
        <div className={`border rounded-xl p-4 ${cmBg(data.all_time.cm)}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Orders</p>
              <p className="text-white font-semibold text-lg">{data.all_time.orders}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Net Revenue</p>
              <p className="text-white font-semibold text-lg">{fmt(data.all_time.net_revenue)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Total CM</p>
              <p className={`font-bold text-lg ${cmText(data.all_time.cm)}`}>{fmt(data.all_time.cm)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">MER</p>
              <p className="text-amber-400 font-semibold text-lg">
                {data.all_time.mer != null ? `${data.all_time.mer}x` : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center text-xs text-slate-600 pb-4">
        TheDeerly Dashboard · Data synced daily 2:15PM GMT+7 · Built with ❤️ by Wally 🔧
      </footer>
    </main>
  );
}
