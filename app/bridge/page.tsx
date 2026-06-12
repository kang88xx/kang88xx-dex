import { ArrowLeftRight, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { BridgePanel } from "@/components/BridgePanel";
import { Eyebrow } from "@/components/ui";
import { BRIDGE_ENABLED, BRIDGE_SIDES, BRIDGE_CHAIN_IDS } from "@/lib/bridge";

export const metadata = {
  title: "Bridge — IOI",
};

export default function BridgePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Eyebrow dot="blue" className="mb-5">
        Transfer · Bridge
      </Eyebrow>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
          <ArrowLeftRight className="h-6 w-6 text-[var(--accent)]" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Bridge</h1>
            {BRIDGE_ENABLED ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
                Testnet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
                <Sparkles className="h-3 w-3" />
                Coming soon
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--muted)]">
            {BRIDGE_ENABLED
              ? `Move USDT between ${BRIDGE_SIDES[BRIDGE_CHAIN_IDS[0]].short} and ${BRIDGE_SIDES[BRIDGE_CHAIN_IDS[1]].short}.`
              : "Move assets across chains into BNB Smart Chain."}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {BRIDGE_ENABLED ? <BridgePanel /> : <ComingSoon />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder shown until the bridge contracts are configured (and on
// mainnet, where no production bridge exists yet).
// ---------------------------------------------------------------------------

const PREVIEW_ROUTES = [
  { from: "Ethereum", to: "BNB Chain", token: "USDT", time: "~3 min" },
  { from: "Arbitrum", to: "BNB Chain", token: "ETH", time: "~5 min" },
  { from: "Polygon", to: "BNB Chain", token: "USDC", time: "~4 min" },
];

function ComingSoon() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
      <div className="grid gap-8 p-8 sm:p-12 md:grid-cols-2 md:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            One bridge, every chain.
          </h2>
          <p className="mt-3 max-w-md text-[var(--muted)] leading-relaxed">
            Bridge tokens from Ethereum, Arbitrum, Polygon and more into BNB
            Smart Chain in a few clicks — with the best routes and lowest
            fees. We&apos;re putting the finishing touches on it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              disabled
              className="cursor-not-allowed rounded-full bg-[var(--surface-2)] px-5 py-2.5 text-sm font-semibold text-[var(--muted-2)]"
            >
              Notify me (soon)
            </button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-6">
            <Feature icon={<Zap className="h-4 w-4" />} label="Fast routes" />
            <Feature icon={<ShieldCheck className="h-4 w-4" />} label="Audited" />
            <Feature
              icon={<ArrowLeftRight className="h-4 w-4" />}
              label="Multi-chain"
            />
          </div>
        </div>

        {/* Preview routes (disabled) */}
        <div className="space-y-3">
          {PREVIEW_ROUTES.map((r) => (
            <div
              key={`${r.from}-${r.token}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
            >
              <div className="flex items-center gap-3">
                <TokenLogo symbol={r.token} size={38} />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {r.from}
                    <ArrowLeftRight className="h-3.5 w-3.5 text-[var(--muted-2)]" />
                    {r.to}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {r.token} · {r.time}
                  </div>
                </div>
              </div>
              <button
                disabled
                className="cursor-not-allowed rounded-full bg-[var(--surface-2)] px-3.5 py-1.5 text-xs font-semibold text-[var(--muted-2)]"
              >
                Bridge
              </button>
            </div>
          ))}
          <p className="pt-1 text-center text-xs text-[var(--muted-2)]">
            Preview only — bridging is not live yet.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--accent)]">
        {icon}
      </span>
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
    </div>
  );
}
