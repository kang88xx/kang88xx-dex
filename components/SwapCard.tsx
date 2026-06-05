"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ChevronDown, Settings2 } from "lucide-react";
import { useAppKit } from "@reown/appkit/react";
import { TOKEN_MAP } from "@/lib/mock-data";
import { useBalance, useDexStore, useHydrated } from "@/lib/store";
import { formatNumber, formatUsd } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";
import { TokenSelectModal } from "./TokenSelectModal";
import { toast } from "./toast";
import { ArrowChip } from "./ui";

const SWAP_FEE = 0.003;

export function SwapCard() {
  const hydrated = useHydrated();
  const connected = useDexStore((s) => s.connected);
  const { open: openWalletModal } = useAppKit();
  const swap = useDexStore((s) => s.swap);

  const [from, setFrom] = useState("ETH");
  const [to, setTo] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [picker, setPicker] = useState<null | "from" | "to">(null);
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);

  const fromBal = useBalance(from);
  const tFrom = TOKEN_MAP[from];
  const tTo = TOKEN_MAP[to];

  const amountNum = parseFloat(amount) || 0;
  const rate = tFrom.priceUsd / tTo.priceUsd;
  const amountOut = useMemo(
    () => amountNum * rate * (1 - SWAP_FEE),
    [amountNum, rate],
  );
  const minReceived = amountOut * (1 - slippage / 100);

  const insufficient = hydrated && connected && amountNum > fromBal;

  const switchTokens = () => {
    setFrom(to);
    setTo(from);
    setAmount("");
  };

  const pick = (symbol: string) => {
    if (picker === "from") {
      if (symbol === to) setTo(from);
      setFrom(symbol);
    } else if (picker === "to") {
      if (symbol === from) setFrom(to);
      setTo(symbol);
    }
  };

  const doSwap = () => {
    const res = swap(from, to, amountNum);
    if (res.ok) {
      toast.success(
        `Swapped ${formatNumber(amountNum, 4)} ${from} for ${formatNumber(res.amountOut ?? 0, 4)} ${to}`,
      );
      setAmount("");
    } else {
      toast.error(res.error ?? "Swap failed");
    }
  };

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl shadow-black/[0.03]">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-base font-semibold">Swap</h2>
        <div className="relative">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)]"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          {showSettings && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowSettings(false)}
              />
              <div className="animate-fade-in absolute right-0 top-10 z-40 w-64 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
                <p className="text-sm font-medium">Slippage tolerance</p>
                <div className="mt-3 flex gap-2">
                  {[0.1, 0.5, 1].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={`flex-1 rounded-xl px-2 py-1.5 text-sm transition-colors ${
                        slippage === s
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* From */}
      <div className="rounded-2xl bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>You pay</span>
          {hydrated && connected && (
            <button
              onClick={() => setAmount(String(fromBal))}
              className="transition-colors hover:text-[var(--foreground)]"
            >
              Balance: {formatNumber(fromBal, 4)}{" "}
              <span className="font-medium text-[var(--accent)]">MAX</span>
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-[var(--muted-2)]"
          />
          <TokenPickerButton symbol={from} onClick={() => setPicker("from")} />
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          {formatUsd(amountNum * tFrom.priceUsd)}
        </div>
      </div>

      {/* Switch */}
      <div className="relative z-10 -my-3 flex justify-center">
        <button
          onClick={switchTokens}
          className="flex h-9 w-9 items-center justify-center rounded-xl border-4 border-[var(--card)] bg-[var(--surface-2)] text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      {/* To */}
      <div className="rounded-2xl bg-[var(--surface)] p-4">
        <span className="text-xs text-[var(--muted)]">You receive</span>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="w-full truncate text-3xl font-semibold text-[var(--foreground)]">
            {amountOut > 0 ? formatNumber(amountOut, 6) : "0"}
          </span>
          <TokenPickerButton symbol={to} onClick={() => setPicker("to")} />
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          {formatUsd(amountOut * tTo.priceUsd)}
        </div>
      </div>

      {/* Details */}
      {amountNum > 0 && (
        <div className="mt-2 space-y-1.5 rounded-2xl px-4 py-3 text-xs">
          <Row label="Rate">
            1 {from} = {formatNumber(rate, 6)} {to}
          </Row>
          <Row label="Fee (0.3%)">
            {formatUsd(amountNum * tFrom.priceUsd * SWAP_FEE)}
          </Row>
          <Row label={`Min. received (${slippage}% slippage)`}>
            {formatNumber(minReceived, 6)} {to}
          </Row>
        </div>
      )}

      {/* Action */}
      <div className="p-2 pt-1">
        {!hydrated ? (
          <div className="h-14 w-full rounded-2xl bg-[var(--surface-2)] animate-pulse-soft" />
        ) : !connected ? (
          <button
            onClick={() => openWalletModal()}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--accent)] text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Connect Wallet
            <ArrowChip variant="onAccent" />
          </button>
        ) : (
          <button
            disabled={amountNum <= 0 || insufficient}
            onClick={doSwap}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--accent)] text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
          >
            {insufficient
              ? `Insufficient ${from}`
              : amountNum <= 0
                ? "Enter an amount"
                : "Swap"}
            {!insufficient && amountNum > 0 && <ArrowChip variant="onAccent" />}
          </button>
        )}
      </div>

      <TokenSelectModal
        open={picker !== null}
        onClose={() => setPicker(null)}
        onSelect={pick}
        exclude={picker === "from" ? to : from}
      />
    </div>
  );
}

function TokenPickerButton({
  symbol,
  onClick,
}: {
  symbol: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] py-1.5 pl-1.5 pr-3 font-semibold shadow-sm transition-colors hover:bg-[var(--surface)]"
    >
      <TokenLogo symbol={symbol} size={26} />
      {symbol}
      <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
