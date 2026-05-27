"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { getPriceHistory, getToken, type ChartRange } from "@/lib/mock-data";
import { formatUsd } from "@/lib/format";

const RANGES: ChartRange[] = ["1D", "1W", "1M", "1Y"];

export function PriceChart({
  symbol,
  range,
  onRangeChange,
  height = 280,
  showRanges = true,
}: {
  symbol: string;
  range: ChartRange;
  onRangeChange?: (r: ChartRange) => void;
  height?: number;
  showRanges?: boolean;
}) {
  const token = getToken(symbol);
  const data = getPriceHistory(symbol, range);
  const up = (token?.change24h ?? 0) >= 0;
  const stroke = up ? "var(--up)" : "var(--down)";
  const gradId = `grad-${symbol}-${range}`;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.15 || max * 0.05;

  return (
    <div>
      {showRanges && onRangeChange && (
        <div className="mb-3 flex justify-end">
          <div className="inline-flex rounded-full border border-[var(--border)] p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  r === range
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[min - pad, max + pad]} hide />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted)" }}
            itemStyle={{ color: "var(--foreground)" }}
            labelFormatter={(l) => `T-${l}`}
            formatter={(v) => [formatUsd(Number(v)), "Price"] as [string, string]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny inline sparkline for table rows */
export function Sparkline({ symbol }: { symbol: string }) {
  const data = getPriceHistory(symbol, "1W");
  const token = getToken(symbol);
  const up = (token?.change24h ?? 0) >= 0;
  return (
    <ResponsiveContainer width={88} height={36}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`spark-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={up ? "var(--up)" : "var(--down)"}
              stopOpacity={0.25}
            />
            <stop
              offset="100%"
              stopColor={up ? "var(--up)" : "var(--down)"}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="price"
          stroke={up ? "var(--up)" : "var(--down)"}
          strokeWidth={1.5}
          fill={`url(#spark-${symbol})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
