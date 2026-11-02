"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactNumber, formatNumber } from "@/lib/money";

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const axis = { fill: "var(--muted)", fontSize: 12, fontWeight: 500, fontFamily: "var(--font-sans)" };

type Formatter = (value: number) => string;

/** Serializable formatting (Server Components can't pass functions): "PKR" → "PKR 12,500". */
function formatterFor(unit?: string): Formatter {
  return unit ? (v) => `${unit} ${formatNumber(v)}` : (v) => formatNumber(v);
}

// Recharts' payload entries vary by chart type; we only read a few display fields.
type TooltipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string; payload?: { fill?: string } };

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: readonly unknown[];
  label?: unknown;
  format: Formatter;
}) {
  if (!active || !payload?.length) return null;
  const entries = payload as TooltipEntry[];
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs shadow-pop">
      {label !== undefined ? <p className="mb-1.5 font-bold text-fg">{String(label)}</p> : null}
      {entries.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-fg-2">
          <span className="size-2.5 rounded-full" style={{ background: entry.color ?? entry.payload?.fill }} />
          <span>{String(entry.name ?? "")}</span>
          <span className="tabular ml-auto pl-4 font-bold text-fg">{format(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  );
}

/** Revenue vs expenses: rounded-cap bars, 2 series max. */
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
        <BarChart data={data} barGap={5} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => compactNumber(Number(v))} width={52} />
          <Tooltip cursor={{ fill: "var(--surface-2)", radius: 8 }} content={(props) => <ChartTooltip {...props} format={formatterFor(unit)} />} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[7, 7, 7, 7]} maxBarSize={14} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Running balance: 3px line with a gradient fill fading to zero. */
export function GradientAreaChart({
  data,
  dataKey,
  label,
  color = "var(--chart-1)",
  unit,
  height = 200,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  label: string;
  color?: string;
  unit?: string;
  height?: number;
}) {
  const id = React.useId().replace(/:/g, "");
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Area chart: ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} dy={8} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => compactNumber(Number(v))} width={52} />
          <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={(props) => <ChartTooltip {...props} format={formatterFor(unit)} />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color}
            strokeWidth={3}
            fill={`url(#area-${id})`}
            activeDot={{ r: 5, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
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
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} dy={8} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => compactNumber(Number(v))} width={48} />
          <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={(props) => <ChartTooltip {...props} format={formatterFor(unit)} />} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={3}
              dot={false}
              connectNulls
              activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with a centre label and a legend with percentages (plain SVG: theme-aware colours). */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
}: {
  data: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = data.length > 1 ? 1.6 : 0;
  const segments = data.map((d, i) => {
    const length = total ? (d.value / total) * circumference : 0;
    const offset = data.slice(0, i).reduce((sum, prev) => sum + (total ? (prev.value / total) * circumference : 0), 0);
    return { ...d, length, offset };
  });
  return (
    <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:gap-7">
      <div className="relative size-[168px] shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`Donut chart, total ${centerValue} ${centerLabel}`}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
          {segments.map((d) => {
            const dash = Math.max(d.length - gap, 0);
            return (
              <circle
                key={d.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-d.offset}
              >
                <title>{`${d.label}: ${total ? Math.round((d.value / total) * 100) : 0}%`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-xl font-extrabold">{centerValue}</span>
          <span className="text-[10px] font-semibold text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-3">
        {data.map((d) => (
          <li key={d.label} className="flex min-w-0 items-center gap-2.5 text-sm">
            <span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 truncate text-fg-2">{d.label}</span>
            <span className="tabular ml-auto shrink-0 pl-3 font-bold">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legend dots shown next to section headings (BankDash style). */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-4 text-[13px] text-fg-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span className="size-[11px] rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
