import { NextResponse } from "next/server";
import { TOKENS } from "@/lib/tokens";
import type { MarketData } from "@/lib/types";

// Live prices change constantly — never prerender this route.
// Upstream CoinGecko responses are cached for 60s via fetch revalidate.
export const dynamic = "force-dynamic";

const COINGECKO_IDS = TOKENS.filter((t) => t.coingeckoId)
  .map((t) => t.coingeckoId)
  .join(",");

interface CoinGeckoMarketRow {
  id: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
  total_volume: number | null;
  market_cap: number | null;
  sparkline_in_7d?: { price: number[] };
}

function seedData(): Record<string, MarketData> {
  return Object.fromEntries(
    TOKENS.map((t) => [
      t.symbol,
      {
        priceUsd: t.priceUsd,
        change24h: t.change24h,
        volume24h: t.volume24h,
        marketCap: t.marketCap,
        spark7d: [],
      },
    ]),
  );
}

export async function GET() {
  const out = seedData();

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINGECKO_IDS}&sparkline=true&price_change_percentage=24h`,
      { next: { revalidate: 60 } },
    );
    if (res.ok) {
      const rows: CoinGeckoMarketRow[] = await res.json();
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const t of TOKENS) {
        const r = t.coingeckoId ? byId.get(t.coingeckoId) : undefined;
        if (!r) continue;
        out[t.symbol] = {
          priceUsd: r.current_price ?? t.priceUsd,
          change24h: r.price_change_percentage_24h ?? 0,
          volume24h: r.total_volume ?? t.volume24h,
          marketCap: r.market_cap ?? t.marketCap,
          spark7d: r.sparkline_in_7d?.price ?? [],
        };
      }
    }
  } catch {
    // network/rate-limit failure → serve seed values, client retries in 60s
  }

  return NextResponse.json(out);
}
