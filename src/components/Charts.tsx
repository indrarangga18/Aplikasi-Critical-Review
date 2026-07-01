"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 11, fill: "#94a3b8" };
const GRAD = ["#818cf8", "#a78bfa", "#c084fc", "#e879f9", "#f472b6"];

function tooltipStyle() {
  return {
    contentStyle: {
      background: "rgba(15,23,42,.95)",
      border: "1px solid rgba(255,255,255,.12)",
      borderRadius: 12,
      color: "#e2e8f0",
      fontSize: 12,
    },
    cursor: { fill: "rgba(255,255,255,.05)" },
  };
}

export function HBar({
  data,
  height = 300,
  color = "#a78bfa",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const t = tooltipStyle();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,.06)" />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tick={AXIS}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...t} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GroupedBar({
  data,
  height = 300,
}: {
  data: { label: string; docFreq: number; totalOcc: number }[];
  height?: number;
}) {
  const t = tooltipStyle();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 30 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} height={50} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip {...t} />
        <Bar dataKey="docFreq" name="Dokumen" radius={[6, 6, 0, 0]} fill="#818cf8" />
        <Bar dataKey="totalOcc" name="Total muncul" radius={[6, 6, 0, 0]} fill="#f472b6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({
  data,
  height = 260,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const t = tooltipStyle();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...t} />
        <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 3, fill: "#f472b6" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DivergingBar({
  data,
  height = 260,
}: {
  data: { keyword: string; value: number }[];
  height?: number;
}) {
  const t = tooltipStyle();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 30 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" />
        <XAxis dataKey="keyword" tick={AXIS} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} height={50} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip {...t} />
        <Bar dataKey="value" radius={[6, 6, 6, 6]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? "#34d399" : "#fb7185"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Simple CSS-grid heatmap (recharts has no native heatmap).
export function Heatmap({
  labels,
  matrix,
  annotate = false,
}: {
  labels: string[];
  matrix: number[][];
  annotate?: boolean;
}) {
  const max = Math.max(1, ...matrix.flat());
  const cell = (v: number) => {
    const a = v / max;
    return `rgba(167,139,250,${0.12 + a * 0.85})`;
  };
  return (
    <div className="overflow-auto">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `120px repeat(${labels.length}, minmax(30px,1fr))` }}
      >
        <div />
        {labels.map((l) => (
          <div key={l} className="text-[10px] text-slate-400 truncate rotate-0 text-center pb-1" title={l}>
            {l.length > 8 ? l.slice(0, 8) + "…" : l}
          </div>
        ))}
        {matrix.map((row, i) => (
          <div key={i} className="contents">
            <div className="text-[11px] text-slate-300 truncate pr-2 flex items-center justify-end" title={labels[i]}>
              {labels[i].length > 14 ? labels[i].slice(0, 14) + "…" : labels[i]}
            </div>
            {row.map((v, j) => (
              <div
                key={j}
                className="aspect-square rounded-[4px] flex items-center justify-center text-[9px] text-white/90"
                style={{ background: i === j ? "rgba(255,255,255,.04)" : cell(v) }}
                title={`${labels[i]} × ${labels[j]}: ${v}`}
              >
                {annotate && i !== j && v > 0 ? v : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { GRAD };
