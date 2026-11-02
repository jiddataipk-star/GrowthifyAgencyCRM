"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, formatNumber } from "@/lib/money";

/** Brand-only palette: deep green, mid green, sage, black, mist, grey. */
export const CHART_COLORS = ["#0b3d2c", "#3f8f6c", "#9db8ab", "#0b1210", "#cfdcd6", "#5f6b66"];

const axis = { fill: "var(--muted)", fontSize: 11.5, fontWeight: 500, fontFamily: "var(--font-sans)" };

type Formatter = (value: number) => string;

/** Serializable formatting (Server Components can't pass functions): "PKR" → "PKR 12,500". */
function formatterFor(unit?: string): Formatter {
  return unit ? (v) => `${unit} ${formatNumber(v)}` : (v) => formatNumber(v);
}

// Recharts' payload entries vary by chart type; we only read a few display fields.
type TooltipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string; payload?: { fill?: string } };

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: readonly unknown[]; label?: unknown; format: Formatter }) {
  if (!active || !payload?.length) return null;
  const entries = payload as TooltipEntry[];
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-pop">
      {label !== undefined ? <p className="mb-1.5 font-semibold text-fg">{String(label)}</p> : null}
      {entries.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-fg-2">
          <span className="size-2.5 rounded-full" style={{ background: entry.color ?? entry.payload?.fill }} />
          <span>{String(entry.name ?? "")}</span>
          <span className="tabular ml-auto pl-4 font-semibold text-fg">{format(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  );
}

/** Money in vs money out per month (rounded bars) with the profit line on top. */
export function MoneyChart({ data, unit, height = 280 }: { data: { label: string; income: number; expense: number; profit: number }[]; unit?: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Money in, money out and profit per month">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barGap={4} barCategoryGap="30%" margin={{ top: 8, right: 4, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => compactNumber(Number(v))} width={50} />
          <Tooltip cursor={{ fill: "var(--surface-2)", radius: 6 }} content={(props) => <ChartTooltip {...props} format={formatterFor(unit)} />} />
          <Bar dataKey="income" name="Money in" fill="var(--chart-1)" radius={[6, 6, 2, 2]} maxBarSize={18} />
          <Bar dataKey="expense" name="Money out" fill="var(--chart-2)" radius={[6, 6, 2, 2]} maxBarSize={18} />
          <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--chart-3)" strokeWidth={2.25} dot={{ r: 2.5, fill: "var(--chart-3)", strokeWidth: 0 }} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-series rounded bars. */
export function DualBarChart({
  data,
  series,
  unit,
  height = 260,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  unit?: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Bar chart: ${series.map((s) => s.label).join(" vs ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} dy={8} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => compactNumber(Number(v))} width={50} />
          <Tooltip cursor={{ fill: "var(--surface-2)", radius: 6 }} content={(props) => <ChartTooltip {...props} format={formatterFor(unit)} />} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[6, 6, 2, 2]} maxBarSize={14} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Multi-series line chart (social followers per platform). */
export function MultiLineChart({
  data,
  series,
  unit,
  height = 260,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; label: string; color: string }[];
  unit?: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} dy={8} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => compactNumber(Number(v))} width={46} />
          <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={(props) => <ChartTooltip {...props} format={formatterFor(unit)} />} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.25} dot={false} connectNulls activeDot={{ r: 4, strokeWidth: 0, fill: s.color }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with a centre label and a legend with percentages (plain SVG). */
export function DonutChart({ data, centerValue, centerLabel }: { data: { label: string; value: number; color: string }[]; centerValue: string; centerLabel: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = data.length > 1 ? 1.4 : 0;
  const segments = data.map((d, i) => {
    const length = total ? (d.value / total) * circumference : 0;
    const offset = data.slice(0, i).reduce((sum, prev) => sum + (total ? (prev.value / total) * circumference : 0), 0);
    return { ...d, length, offset };
  });
  return (
    <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:gap-6">
      <div className="relative size-[150px] shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`Donut chart, total ${centerValue} ${centerLabel}`}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
          {segments.map((d) => {
            const dash = Math.max(d.length - gap, 0);
            return (
              <circle key={d.label} cx="50" cy="50" r={radius} fill="none" stroke={d.color} strokeWidth="12" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-d.offset}>
                <title>{`${d.label}: ${total ? Math.round((d.value / total) * 100) : 0}%`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display tabular text-lg font-bold">{centerValue}</span>
          <span className="text-[10px] font-medium text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {data.map((d) => (
          <li key={d.label} className="flex min-w-0 items-center gap-2.5 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 truncate text-fg-2">{d.label}</span>
            <span className="tabular ml-auto shrink-0 pl-3 font-semibold">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legend dots shown next to section headings. */
export function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {item.line ? <span className="h-0.5 w-3.5 rounded-full" style={{ background: item.color }} /> : <span className="size-2.5 rounded-sm" style={{ background: item.color }} />}
          {item.label}
        </span>
      ))}
    </div>
  );
}
