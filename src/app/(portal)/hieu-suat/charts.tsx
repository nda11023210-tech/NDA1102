"use client";

import { Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Bảng màu phân loại (đã kiểm tra mù màu: ΔE ≥ 9 giữa các cặp liền kề) – thứ tự cố định
export const SERIES = [
  { key: "timeliness", label: "Tiến độ (40%)", color: "#2a78d6" },
  { key: "workload", label: "Khối lượng (30%)", color: "#eb6834" },
  { key: "quality", label: "Chất lượng (30%)", color: "#1baf7a" },
] as const;

export type ScoreRow = { name: string; timeliness: number; workload: number; quality: number; total: number };

const axisTick = { fill: "#5b6b80", fontSize: 12 };

function ScoreTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + p.value, 0);
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-soft">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
            {SERIES.find((s) => s.key === p.dataKey)?.label}
          </span>
          <span className="font-medium text-ink tabular-nums">{p.value.toFixed(1)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold text-ink">
        <span>Tổng điểm</span>
        <span className="tabular-nums">{total.toFixed(1)}</span>
      </div>
    </div>
  );
}

/** Điểm tổng của từng giảng viên, tách theo đóng góp có trọng số của 3 thành phần */
export function ScoreBreakdownChart({ rows }: { rows: ScoreRow[] }) {
  const height = Math.max(240, rows.length * 34 + 70);
  return (
    <figure>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="#eef1f5" />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={150} tick={{ ...axisTick, fill: "#334155" }} axisLine={false} tickLine={false} />
          <Tooltip content={<ScoreTooltip />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
          <Legend
            verticalAlign="top"
            align="left"
            itemSorter={(item) => SERIES.findIndex((s) => s.key === item.dataKey)}
            iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#334155", paddingBottom: 8 }} />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="score"
              fill={s.color}
              stroke="#ffffff"
              strokeWidth={2}
              radius={i === SERIES.length - 1 ? [0, 4, 4, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">Biểu đồ cột ngang điểm hiệu suất tổng hợp theo giảng viên; số liệu chi tiết có trong bảng bên dưới.</figcaption>
    </figure>
  );
}

/** Ba thành phần (thang 100) của một người, so với trung bình Khoa */
export function PersonRadar({ me, avg }: { me: { timeliness: number; workload: number; quality: number }; avg: { timeliness: number; workload: number; quality: number } }) {
  const data = [
    { axis: "Tiến độ", me: me.timeliness, avg: avg.timeliness },
    { axis: "Khối lượng", me: me.workload, avg: avg.workload },
    { axis: "Chất lượng", me: me.quality, avg: avg.quality },
  ];
  return (
    <figure>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "#334155", fontSize: 13, fontWeight: 500 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name="Trung bình Khoa" dataKey="avg" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" fill="#94a3b8" fillOpacity={0.08} isAnimationActive={false} />
          <Radar name="Của tôi" dataKey="me" stroke="#2a78d6" strokeWidth={2} fill="#2a78d6" fillOpacity={0.18} dot={{ r: 4, fill: "#2a78d6", stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
          <Tooltip formatter={(v) => Number(v).toFixed(0)} contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        Biểu đồ radar: Tiến độ {me.timeliness}, Khối lượng {me.workload}, Chất lượng {me.quality} so với trung bình Khoa.
      </figcaption>
    </figure>
  );
}
