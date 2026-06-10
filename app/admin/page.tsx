"use client";

import { useState } from "react";
import { erc20Abi, parseUnits, parseEventLogs } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Lock,
  Plus,
  Trash2,
  LogOut,
  UserPlus,
  X,
  Power,
  Coins,
  Droplets,
  Check,
  Users,
  Wallet,
  TrendingUp,
  ListFilter,
  Rocket,
  Loader2,
} from "lucide-react";
import { useDexStore, useHydrated } from "@/lib/store";
import { useTokenRegistry, tokenTradable } from "@/lib/token-registry";
import { usePoolStats } from "@/lib/pool-stats";
import { useCampaignAdmin, campaignId } from "@/lib/campaigns";
import { CHAIN_ID } from "@/lib/chain";
import { TOKEN_MAP } from "@/lib/tokens";
import { merkleRoot } from "@/lib/merkle";
import { AIRDROP_ABI, AIRDROP_CONTRACT, airdropLive } from "@/lib/airdrop";
import {
  daysUntil,
  formatUsd,
  shortAddress,
} from "@/lib/format";
import { TokenLogo, TokenPair } from "@/components/TokenLogo";
import { toast } from "@/components/toast";
import { Eyebrow } from "@/components/ui";
import type { AirdropCampaign, Eligibility } from "@/lib/types";

const DAY = 1000 * 60 * 60 * 24;

const INPUT =
  "w-full rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => {
    const m: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return m[c];
  });

/**
 * Opens a standalone HTML window listing a campaign's claim recipients —
 * wallet, allocated amount (받을 수량), received amount (받은 수량) — with a
 * client-side address search box. Whitelist campaigns expose per-wallet data;
 * others only track an aggregate count.
 */
function openClaimDetail(c: AirdropCampaign) {
  const isWl = c.eligibility === "whitelist";
  const rows = isWl
    ? c.whitelist.map((w) => ({
        address: w.address,
        allocated: w.amount,
        received: w.claimed ? w.amount : 0,
        claimed: w.claimed,
      }))
    : [];
  const totalAlloc = rows.reduce((s, r) => s + r.allocated, 0);
  const totalRecv = rows.reduce((s, r) => s + r.received, 0);
  const claimedCount = rows.filter((r) => r.claimed).length;
  const sym = esc(c.tokenSymbol);
  const note = isWl
    ? `받은 인원 ${claimedCount}/${rows.length}명 · 받을 수량 합계 ${totalAlloc.toLocaleString()} ${sym} · 받은 수량 합계 ${totalRecv.toLocaleString()} ${sym}`
    : `이 캠페인은 개별 지갑 클레임 내역을 추적하지 않습니다 (화이트리스트 캠페인만 지원) · 총 ${c.claimedCount}건 클레임`;

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(c.name)} · 클레임 내역</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px;
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #0b0d12; color: #e7e9ee; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { margin: 0 0 18px; color: #8a91a0; font-size: 13px; }
  input.search { width: 100%; max-width: 420px; margin-bottom: 18px;
    padding: 9px 14px; border-radius: 999px; border: 1px solid #232838;
    background: #11151f; color: #e7e9ee; font: inherit; font-size: 13px; outline: none; }
  input.search:focus { border-color: #6366f1; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  thead th { text-align: left; font-size: 12px; font-weight: 600; color: #8a91a0;
    padding: 10px 12px; border-bottom: 1px solid #232838; }
  thead th.num, tbody td.num { text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #161b27; }
  tbody tr:hover { background: #11151f; }
  td.addr { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
  td.empty { text-align: center; color: #6b7384; padding: 40px 12px; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pill.y { background: rgba(34,197,94,.15); color: #4ade80; }
  .pill.n { background: #1b2030; color: #8a91a0; }
</style>
</head>
<body>
  <h1>${esc(c.name)} · 클레임 내역</h1>
  <p class="sub">${note}</p>
  <input id="q" class="search" type="search" placeholder="지갑주소 검색…" autocomplete="off" />
  <table>
    <thead><tr>
      <th>지갑주소</th>
      <th class="num">받을 수량</th>
      <th class="num">받은 수량</th>
      <th>상태</th>
    </tr></thead>
    <tbody id="rows"></tbody>
  </table>
<script>
  var SYM = ${JSON.stringify(c.tokenSymbol)};
  var ROWS = ${JSON.stringify(rows)};
  function fmt(n) { return Number(n).toLocaleString(); }
  function render(q) {
    q = (q || "").trim().toLowerCase();
    var list = q ? ROWS.filter(function (r) { return r.address.toLowerCase().indexOf(q) !== -1; }) : ROWS;
    var body = document.getElementById("rows");
    if (!list.length) {
      body.innerHTML = '<tr><td class="empty" colspan="4">' +
        (ROWS.length ? "검색 결과가 없습니다." : "내역이 없습니다.") + "</td></tr>";
      return;
    }
    body.innerHTML = list.map(function (r) {
      var pill = r.claimed
        ? '<span class="pill y">받음</span>'
        : '<span class="pill n">대기</span>';
      return "<tr><td class='addr'>" + r.address +
        "</td><td class='num'>" + fmt(r.allocated) + " " + SYM +
        "</td><td class='num'>" + fmt(r.received) + " " + SYM +
        "</td><td>" + pill + "</td></tr>";
    }).join("");
  }
  document.getElementById("q").addEventListener("input", function (e) { render(e.target.value); });
  render("");
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Server-verified admin session (HTTP-only cookie, see /api/admin/*) */
function useAdminSession() {
  return useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin-session"],
    queryFn: async () => {
      const res = await fetch("/api/admin/session");
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
    staleTime: 60_000,
  });
}

export default function AdminPage() {
  const hydrated = useHydrated();
  const { data: session, isLoading } = useAdminSession();

  if (!hydrated || isLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <div className="h-72 rounded-3xl bg-[var(--surface-2)] animate-pulse-soft" />
      </div>
    );
  }

  return session?.isAdmin ? <AdminDashboard /> : <AdminLogin />;
}

function AdminLogin() {
  const queryClient = useQueryClient();
  const [pw, setPw] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        toast.success("Admin access granted");
        await queryClient.invalidateQueries({ queryKey: ["admin-session"] });
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(body?.error ?? "Login failed");
        setPw("");
      }
    } catch {
      toast.error("Login failed — network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
        <Lock className="h-7 w-7 text-[var(--accent)]" />
      </span>
      <h1 className="mt-5 text-xl font-bold">Admin access</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Manage airdrop campaigns and whitelists.
      </p>
      <form onSubmit={submit} className="mt-6 w-full">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Enter admin password"
          className="w-full rounded-2xl border border-[var(--border-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={submitting}
          className="mt-3 w-full rounded-2xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const { campaigns } = useCampaignAdmin();
  const queryClient = useQueryClient();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    toast.info("Logged out of admin");
    await queryClient.invalidateQueries({ queryKey: ["admin-session"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Eyebrow dot="orange" className="mb-4">
        05 — Admin Console
      </Eyebrow>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
            <ShieldCheck className="h-6 w-6 text-[var(--accent)]" />
          </span>
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Admin Panel</h1>
            <p className="text-sm text-[var(--muted)]">
              {campaigns.length} campaign{campaigns.length !== 1 && "s"} ·
              manage rewards & whitelists
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface)]"
        >
          <LogOut className="h-4 w-4" />
          Exit admin
        </button>
      </div>

      <AnalyticsPanel />

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <CampaignForm />
        </div>
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">Campaigns</h2>
          <div className="space-y-4">
            {campaigns.map((c) => (
              <CampaignAdminRow key={c.id} campaign={c} />
            ))}
            {campaigns.length === 0 && (
              <div className="rounded-3xl border border-dashed border-[var(--border-strong)] py-12 text-center text-sm text-[var(--muted)]">
                No campaigns yet — create one on the left.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <SwapTokensManager />
      </div>

      <div className="mt-10">
        <PoolsManager />
      </div>
    </div>
  );
}

/** Admin management of liquidity pools (only pools that actually exist). */
function PoolsManager() {
  const pools = useDexStore((s) => s.pools);
  const addPool = useDexStore((s) => s.addPool);
  const removePool = useDexStore((s) => s.removePool);
  const { tradable } = useTokenRegistry();
  const symbols = tradable.map((t) => t.symbol);

  const [token0, setToken0] = useState(symbols[0] ?? "BNB");
  const [token1, setToken1] = useState(symbols[1] ?? "USDT");
  const [feeTier, setFeeTier] = useState("0.25");
  // TVL / volume / APR are computed live from on-chain reserves + 24h volume
  // (see usePoolStats), so they're no longer entered here — stored as 0.
  const stats = usePoolStats(pools);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token0 === token1) return toast.error("Pick two different tokens");
    if (
      pools.some(
        (p) =>
          (p.token0 === token0 && p.token1 === token1) ||
          (p.token0 === token1 && p.token1 === token0),
      )
    )
      return toast.error(`${token0}/${token1} pool already exists`);
    const fee = parseFloat(feeTier);
    if (!Number.isFinite(fee) || fee < 0 || fee > 100)
      return toast.error("Fee must be 0–100%");

    addPool({ token0, token1, feeTier: fee, tvlUsd: 0, volume24h: 0, apr: 0 });
    toast.success(`Created ${token0}/${token1} pool`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Create pool */}
      <form
        onSubmit={submit}
        className="lg:col-span-2 h-fit rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Droplets className="h-4 w-4 text-[var(--accent)]" />
          Create pool
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          List a pool that exists on-chain. Seed real liquidity on PancakeSwap
          first, then record it here. TVL & APR are computed live from on-chain
          reserves and 24h volume — no need to enter them.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Token A">
              <select
                value={token0}
                onChange={(e) => setToken0(e.target.value)}
                className={INPUT}
              >
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Token B">
              <select
                value={token1}
                onChange={(e) => setToken1(e.target.value)}
                className={INPUT}
              >
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Fee % (PancakeSwap V2 = 0.25)">
            <input
              type="number"
              value={feeTier}
              onChange={(e) => setFeeTier(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <button
          type="submit"
          className="mt-5 w-full rounded-2xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Create pool
        </button>
      </form>

      {/* Pool list */}
      <div className="lg:col-span-3">
        <h2 className="mb-3 text-sm font-semibold">Pools ({pools.length})</h2>
        <div className="space-y-2">
          {pools.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[var(--border-strong)] py-12 text-center text-sm text-[var(--muted)]">
              No pools — create one on the left.
            </div>
          )}
          {pools.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <TokenPair token0={p.token0} token1={p.token1} />
                <div>
                  <div className="text-sm font-semibold">
                    {p.token0} / {p.token1}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {p.feeTier}% fee ·{" "}
                    {stats[p.id]?.loading
                      ? "…"
                      : stats[p.id]?.available
                        ? `${formatUsd(stats[p.id].tvlUsd, { compact: true })} TVL · ${stats[p.id].apr.toLocaleString(undefined, { maximumFractionDigits: 2 })}% APR`
                        : "no on-chain liquidity"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  removePool(p.id);
                  toast.info(`Removed ${p.token0}/${p.token1} pool`);
                }}
                title="Remove pool"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--down)] transition-colors hover:bg-[var(--down-soft)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Admin control of which tokens are swappable + adding custom tokens. */
function SwapTokensManager() {
  const { all } = useTokenRegistry();
  const adminTokens = useDexStore((s) => s.adminTokens);
  const disabledTokens = useDexStore((s) => s.disabledTokens);
  const addAdminToken = useDexStore((s) => s.addAdminToken);
  const removeAdminToken = useDexStore((s) => s.removeAdminToken);
  const setTokenEnabled = useDexStore((s) => s.setTokenEnabled);

  const [address, setAddress] = useState("");
  // Manual edits, scoped to the address they were typed for, so switching
  // addresses re-shows that token's auto-detected values (no effect needed).
  const [edits, setEdits] = useState<{
    addr: string;
    symbol?: string;
    name?: string;
    decimals?: string;
  }>({ addr: "" });

  const adminSymbols = new Set(adminTokens.map((t) => t.symbol));

  // Auto-detect: read symbol/name/decimals straight from the contract so the
  // admin only pastes an address. Values are derived (not stored) — manual
  // edits override the detected ones until the address changes.
  const addrTrim = address.trim();
  const addrKey = addrTrim.toLowerCase();
  const validAddr = /^0x[a-fA-F0-9]{40}$/.test(addrTrim);

  const { data: tokenInfo, isLoading: infoLoading } = useReadContracts({
    contracts: validAddr
      ? ([
          { address: addrTrim as `0x${string}`, abi: erc20Abi, functionName: "symbol", chainId: CHAIN_ID },
          { address: addrTrim as `0x${string}`, abi: erc20Abi, functionName: "name", chainId: CHAIN_ID },
          { address: addrTrim as `0x${string}`, abi: erc20Abi, functionName: "decimals", chainId: CHAIN_ID },
        ] as const)
      : [],
    query: { enabled: validAddr },
  });

  const auto = {
    symbol:
      tokenInfo?.[0]?.status === "success" ? String(tokenInfo[0].result) : undefined,
    name:
      tokenInfo?.[1]?.status === "success" ? String(tokenInfo[1].result) : undefined,
    decimals:
      tokenInfo?.[2]?.status === "success" ? String(tokenInfo[2].result) : undefined,
  };

  const detectFailed =
    validAddr && !infoLoading && tokenInfo?.[0]?.status === "failure";

  // Effective (displayed) values: this-address edits → auto-detected → default.
  const ov: { symbol?: string; name?: string; decimals?: string } =
    edits.addr === addrKey ? edits : {};
  const symbol = ov.symbol ?? auto.symbol ?? "";
  const name = ov.name ?? auto.name ?? "";
  const decimals = ov.decimals ?? auto.decimals ?? "18";

  const setEdit = (patch: Partial<typeof edits>) =>
    setEdits((e) => ({ addr: addrKey, ...(e.addr === addrKey ? e : {}), ...patch }));
  const setSymbol = (v: string) => setEdit({ symbol: v });
  const setName = (v: string) => setEdit({ name: v });
  const setDecimals = (v: string) => setEdit({ decimals: v });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const addr = address.trim();
    const dec = parseInt(decimals, 10);
    if (!sym) return toast.error("Enter a token symbol");
    if (all.some((t) => t.symbol === sym))
      return toast.error(`${sym} already exists`);
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr))
      return toast.error("Invalid BSC contract address");
    if (!Number.isInteger(dec) || dec < 0 || dec > 36)
      return toast.error("Decimals must be 0–36");

    addAdminToken({
      symbol: sym,
      name: name.trim() || sym,
      address: addr,
      decimals: dec,
      color: "#6366f1",
    });
    toast.success(`Added ${sym} to the swap list`);
    setAddress("");
    setEdits({ addr: "" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Add custom token */}
      <form
        onSubmit={submit}
        className="lg:col-span-2 h-fit rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="h-4 w-4 text-[var(--accent)]" />
          Add swap token
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Paste a contract address — symbol, name and decimals are read straight
          from the token (editable). On testnet, use your deployed test-token
          address.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Contract address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… paste to auto-fill"
              className={`${INPUT} font-mono`}
            />
          </Field>
          {validAddr && (
            <p className="-mt-1 text-xs">
              {infoLoading ? (
                <span className="text-[var(--muted)]">
                  토큰 정보 읽는 중…
                </span>
              ) : detectFailed ? (
                <span className="text-[var(--down)]">
                  온체인 정보를 못 읽었습니다 — 아래를 직접 입력하세요.
                </span>
              ) : (
                <span className="text-[var(--up)]">
                  ✓ 온체인에서 자동 입력됨 (수정 가능)
                </span>
              )}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="USDT"
                className={INPUT}
              />
            </Field>
            <Field label="Decimals">
              <input
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Test Tether"
              className={INPUT}
            />
          </Field>
        </div>

        <button
          type="submit"
          className="mt-5 w-full rounded-2xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Add token
        </button>
      </form>

      {/* Token list with enable/disable */}
      <div className="lg:col-span-3">
        <h2 className="mb-3 text-sm font-semibold">
          Swap tokens ({all.filter((t) => !disabledTokens.includes(t.symbol)).length}{" "}
          enabled)
        </h2>
        <div className="space-y-2">
          {all.map((t) => {
            const enabled = !disabledTokens.includes(t.symbol);
            const custom = adminSymbols.has(t.symbol);
            return (
              <div
                key={t.symbol}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={t.symbol} size={34} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{t.symbol}</span>
                      {custom && (
                        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                          Custom
                        </span>
                      )}
                      {!tokenTradable(t) && (
                        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                          No contract
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {t.address ? shortAddress(t.address) : "native"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTokenEnabled(t.symbol, !enabled)}
                    title={enabled ? "Disable for swapping" : "Enable for swapping"}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)] ${
                      enabled ? "text-[var(--up)]" : "text-[var(--muted-2)]"
                    }`}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  {custom && (
                    <button
                      onClick={() => {
                        removeAdminToken(t.symbol);
                        toast.info(`Removed ${t.symbol}`);
                      }}
                      title="Remove custom token"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--down)] transition-colors hover:bg-[var(--down-soft)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface AnalyticsSummary {
  day: string;
  visitors: number;
  visitorsTotal: number;
  connections: number;
  volumeUsd: number;
}

function AnalyticsPanel() {
  const { data } = useQuery<AnalyticsSummary>({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("analytics fetch failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const num = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString();

  const detailBtn = (href: string) => (
    <button
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
    >
      <ListFilter className="h-3 w-3" />
      Detail
    </button>
  );

  const cards = [
    {
      label: "방문자 (오늘)",
      value: num(data?.visitors),
      sub:
        data === undefined
          ? undefined
          : `총 누적 ${data.visitorsTotal.toLocaleString()}명`,
      icon: <Users className="h-4 w-4" />,
      action: detailBtn("/api/analytics/visitors"),
    },
    {
      label: "지갑 연결 (총 누적)",
      value: num(data?.connections),
      sub: undefined as string | undefined,
      icon: <Wallet className="h-4 w-4" />,
      action: detailBtn("/api/analytics/connections"),
    },
    {
      label: "거래량 (금일)",
      value:
        data === undefined
          ? "—"
          : formatUsd(data.volumeUsd, { compact: true }),
      sub: undefined as string | undefined,
      icon: <TrendingUp className="h-4 w-4" />,
      action: null as React.ReactNode,
    },
  ];

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          방문자·거래량은 오늘(KST) · 지갑 연결은 총 누적
        </h2>
        {data && (
          <span className="font-mono text-xs text-[var(--muted-2)]">
            {data.day}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <span className="text-[var(--accent)]">{c.icon}</span>
                {c.label}
              </div>
              {c.action}
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums">
              {c.value}
            </div>
            {c.sub && (
              <div className="mt-1 text-xs font-medium text-[var(--muted-2)]">
                {c.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignForm() {
  const { create } = useCampaignAdmin();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("IOI");
  const [amountPerClaim, setAmountPerClaim] = useState("100");
  const [totalAllocation, setTotalAllocation] = useState("100000");
  const [eligibility, setEligibility] = useState<Eligibility>("public");
  const [durationDays, setDurationDays] = useState("14");

  const reset = () => {
    setName("");
    setDescription("");
    setAmountPerClaim("100");
    setTotalAllocation("100000");
    setEligibility("public");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Enter a campaign name");
    // Whitelist amounts are set per-wallet later, so reward/wallet is unused
    // here (defaults to 0); other eligibilities need a positive reward.
    const isWl = eligibility === "whitelist";
    const amt = isWl ? 0 : parseFloat(amountPerClaim);
    const total = parseFloat(totalAllocation);
    const days = parseFloat(durationDays);
    if (!isWl && (!Number.isFinite(amt) || amt <= 0 || amt > 1e12))
      return toast.error("Reward must be between 0 and 1e12");
    if (!Number.isFinite(total) || total < amt || total > 1e15)
      return toast.error(
        isWl ? "Allocation must be 0–1e15" : "Allocation must be ≥ reward and ≤ 1e15",
      );
    if (!Number.isFinite(days) || days <= 0 || days > 3650)
      return toast.error("Duration must be 1–3650 days");

    create({
      id: campaignId(),
      claimedCount: 0,
      createdAt: Date.now(),
      name: name.trim(),
      description:
        description.trim() || "Claim your reward from this campaign.",
      tokenSymbol,
      amountPerClaim: amt,
      totalAllocation: total,
      eligibility,
      whitelist: [],
      active: true,
      endsAt: Date.now() + days * DAY,
    }).catch(() => toast.error("저장 실패 — 다시 시도하세요"));
    toast.success(`Created "${name.trim()}"`);
    reset();
  };

  return (
    <form
      onSubmit={submit}
      className="sticky top-20 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Plus className="h-4 w-4 text-[var(--accent)]" />
        New campaign
      </h2>

      <div className="mt-4 space-y-3">
        <Field label="Campaign name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer Rewards"
            className={INPUT}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short description for users"
            className={`${INPUT} resize-none`}
          />
        </Field>

        <Field label="Reward token">
          <div className="grid grid-cols-2 gap-2">
            {["KANG", "XP", "USDT", "IOI"].map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => setTokenSymbol(sym)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-medium transition-colors ${
                  tokenSymbol === sym
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                <TokenLogo symbol={sym} size={18} />
                {sym}
              </button>
            ))}
          </div>
        </Field>

        <div className={eligibility === "whitelist" ? "" : "grid grid-cols-2 gap-3"}>
          {/* Whitelist sets per-wallet amounts individually (see whitelist
              manager), so a single reward/wallet value isn't needed there. */}
          {eligibility !== "whitelist" && (
            <Field label="Reward / wallet">
              <input
                type="number"
                value={amountPerClaim}
                onChange={(e) => setAmountPerClaim(e.target.value)}
                className={INPUT}
              />
            </Field>
          )}
          <Field label="Total allocation">
            <input
              type="number"
              value={totalAllocation}
              onChange={(e) => setTotalAllocation(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label="Eligibility">
          <div className="grid grid-cols-2 gap-2">
            {(["public", "whitelist"] as Eligibility[]).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEligibility(e)}
                className={`rounded-xl border py-2 text-xs font-medium capitalize transition-colors ${
                  eligibility === e
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Duration (days)">
          <input
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      <button
        type="submit"
        className="mt-5 w-full rounded-2xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
      >
        Create campaign
      </button>
    </form>
  );
}

function CampaignAdminRow({ campaign: c }: { campaign: AirdropCampaign }) {
  const { remove, updateOne } = useCampaignAdmin();
  const updateCampaign = (id: string, patch: Partial<AirdropCampaign>) =>
    updateOne(id, (x) => ({ ...x, ...patch })).catch(() =>
      toast.error("저장 실패"),
    );
  const deleteCampaign = (id: string) =>
    remove(id).catch(() => toast.error("삭제 실패"));
  // Whitelist campaigns track claims per-wallet; others use the flat counter.
  const isWl = c.eligibility === "whitelist";
  const wlClaimed = c.whitelist.filter((w) => w.claimed);
  const claimsCount = isWl ? wlClaimed.length : c.claimedCount;
  const claimedAlloc = isWl
    ? wlClaimed.reduce((sum, w) => sum + w.amount, 0)
    : c.claimedCount * c.amountPerClaim;

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenLogo symbol={c.tokenSymbol} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{c.name}</h3>
              {c.active ? (
                <span className="rounded-full bg-[var(--up-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--up)]">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                  Paused
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] capitalize">
              {c.eligibility} ·{" "}
              {isWl
                ? `${c.tokenSymbol} (per-wallet amounts)`
                : `${c.amountPerClaim} ${c.tokenSymbol} / wallet`}{" "}
              · {daysUntil(c.endsAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openClaimDetail(c)}
            title="클레임 내역 보기"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          >
            <ListFilter className="h-3 w-3" />
            Detail
          </button>
          <button
            onClick={() => updateCampaign(c.id, { active: !c.active })}
            title={c.active ? "Pause" : "Activate"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface)]"
          >
            <Power className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              deleteCampaign(c.id);
              toast.info(`Deleted "${c.name}"`);
            }}
            title="Delete"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--down)] transition-colors hover:bg-[var(--down-soft)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-3 text-center">
        <Mini
          label={isWl ? "Received" : "Claims"}
          value={isWl ? `${claimsCount}/${c.whitelist.length}` : String(claimsCount)}
        />
        <Mini
          label="Distributed"
          value={`${claimedAlloc.toLocaleString()} ${c.tokenSymbol}`}
        />
        <Mini
          label="Allocation"
          value={`${c.totalAllocation.toLocaleString()} ${c.tokenSymbol}`}
        />
      </div>

      {c.eligibility === "whitelist" && <WhitelistManager campaign={c} />}
    </div>
  );
}

interface ParsedRow {
  line: number;
  raw: string;
  address?: string;
  amount?: number;
  error?: string;
}

/**
 * Parse the bulk box: one allocation per line — "0xaddr, amount" (comma, space
 * or tab separated). A line with only an address uses `defaultAmount`.
 */
function parseBulk(text: string, defaultAmount: number): ParsedRow[] {
  return text
    .split("\n")
    .map((raw, i) => ({ raw, line: i + 1 }))
    .filter((r) => r.raw.trim() !== "")
    .map(({ raw, line }): ParsedRow => {
      const parts = raw.trim().split(/[\s,]+/).filter(Boolean);
      const [addr, amtStr] = parts;
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr ?? ""))
        return { line, raw, error: "invalid address" };
      const amount = amtStr !== undefined ? parseFloat(amtStr) : defaultAmount;
      if (!Number.isFinite(amount) || amount <= 0)
        return { line, raw, error: "invalid amount" };
      return { line, raw, address: addr.toLowerCase(), amount };
    });
}

function WhitelistManager({ campaign: c }: { campaign: AirdropCampaign }) {
  const address = useDexStore((s) => s.address);
  const { updateOne } = useCampaignAdmin();
  const fail = () => toast.error("저장 실패 — 다시 시도하세요");

  // Backend-backed whitelist mutations (shared across all users).
  const addManyToWhitelist = (
    id: string,
    entries: { address: string; amount: number }[],
  ) =>
    updateOne(id, (x) => {
      const map = new Map(x.whitelist.map((w) => [w.address, { ...w }]));
      for (const e of entries) {
        const addr = e.address.trim().toLowerCase();
        if (!addr || !Number.isFinite(e.amount) || e.amount <= 0) continue;
        const ex = map.get(addr);
        if (ex) ex.amount += e.amount;
        else map.set(addr, { address: addr, amount: e.amount, claimed: false });
      }
      return { ...x, whitelist: [...map.values()] };
    }).catch(fail);

  const removeFromWhitelist = (id: string, addr: string) =>
    updateOne(id, (x) => ({
      ...x,
      whitelist: x.whitelist.filter((w) => w.address !== addr.toLowerCase()),
    })).catch(fail);

  const setWhitelistClaimed = (id: string, addr: string, claimed: boolean) =>
    updateOne(id, (x) => ({
      ...x,
      whitelist: x.whitelist.map((w) =>
        w.address === addr.toLowerCase()
          ? { ...w, claimed, claimedAt: claimed ? Date.now() : undefined }
          : w,
      ),
    })).catch(fail);

  const updateCampaign = (id: string, patch: Partial<AirdropCampaign>) =>
    updateOne(id, (x) => ({ ...x, ...patch })).catch(fail);

  const { address: wallet, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [launching, setLaunching] = useState(false);
  const [bulk, setBulk] = useState("");
  const [defaultAmount, setDefaultAmount] = useState(
    c.amountPerClaim ? String(c.amountPerClaim) : "",
  );

  // Once launched on-chain the Merkle root is fixed, so allocations are locked.
  const locked = c.onchainId != null;

  const parsed = parseBulk(bulk, parseFloat(defaultAmount));
  const valid = parsed.filter((r) => r.address && r.amount !== undefined);
  const invalid = parsed.filter((r) => r.error);

  const apply = () => {
    if (locked) return toast.error("온체인 발행됨 — 할당 수정 불가");
    if (valid.length === 0)
      return toast.error("No valid rows to apply");
    addManyToWhitelist(
      c.id,
      valid.map((r) => ({ address: r.address!, amount: r.amount! })),
    );
    toast.success(
      `Applied ${valid.length} allocation${valid.length !== 1 ? "s" : ""}` +
        (invalid.length ? ` · skipped ${invalid.length} invalid` : ""),
    );
    setBulk("");
  };

  const addMyWallet = () => {
    if (!address) return;
    setBulk((b) => (b.trim() ? `${b.replace(/\n*$/, "")}\n${address}` : address));
  };

  const totalAllocated = c.whitelist.reduce((sum, w) => sum + w.amount, 0);
  const rewardToken = TOKEN_MAP[c.tokenSymbol];

  /**
   * Build the Merkle root from the whitelist, approve the airdrop contract for
   * the total, and createCampaign (funds it). Saves the on-chain id so users
   * can claim. Must be run by the contract owner with enough reward tokens.
   */
  const launchOnChain = async () => {
    if (!airdropLive)
      return toast.error("에어드랍 컨트랙트가 아직 배포/설정되지 않았습니다");
    if (!wallet || !publicClient) return toast.error("지갑을 연결하세요");
    if (chainId !== CHAIN_ID)
      return toast.error("지갑 네트워크를 BSC로 전환하세요");
    if (!rewardToken?.address)
      return toast.error(
        `${c.tokenSymbol}는 컨트랙트가 없어 온체인 발행 불가 (네이티브 토큰)`,
      );
    if (c.whitelist.length === 0)
      return toast.error("화이트리스트가 비어 있습니다");

    try {
      setLaunching(true);
      const decimals = rewardToken.decimals;
      const allocs = c.whitelist.map((w) => ({
        address: w.address,
        amountWei: parseUnits(String(w.amount), decimals).toString(),
      }));
      const root = merkleRoot(allocs);
      const totalWei = c.whitelist.reduce(
        (s, w) => s + parseUnits(String(w.amount), decimals),
        0n,
      );
      const endsAtSec = BigInt(Math.floor(c.endsAt / 1000));
      const tokenAddr = rewardToken.address as `0x${string}`;
      const contract = AIRDROP_CONTRACT as `0x${string}`;

      toast.info("1/2 토큰 사용 승인 중… 지갑에서 확인하세요");
      const approveHash = await writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [contract, totalWei],
        chainId: CHAIN_ID,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      toast.info("2/2 캠페인 생성·충전 중… 지갑에서 확인하세요");
      const createHash = await writeContractAsync({
        address: contract,
        abi: AIRDROP_ABI,
        functionName: "createCampaign",
        args: [tokenAddr, root, totalWei, endsAtSec],
        chainId: CHAIN_ID,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: createHash,
      });
      if (receipt.status !== "success")
        return toast.error("온체인 생성 트랜잭션 실패");

      const logs = parseEventLogs({
        abi: AIRDROP_ABI,
        eventName: "CampaignCreated",
        logs: receipt.logs,
      });
      const id = logs.length ? Number(logs[0].args.id) : undefined;
      if (id === undefined)
        return toast.error("캠페인 ID를 읽지 못했습니다 (수동 확인 필요)");

      updateCampaign(c.id, { onchainId: id });
      toast.success(`온체인 캠페인 #${id} 발행·충전 완료 — 이제 클레임 가능`);
    } catch {
      toast.error(
        "온체인 발행 실패 — 지갑 거부 / 잔액 부족 / 소유자 아님 등을 확인하세요",
      );
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--muted)]">
          Whitelist ({c.whitelist.length})
        </p>
        <p className="text-xs text-[var(--muted-2)]">
          {totalAllocated.toLocaleString()} {c.tokenSymbol} allocated
        </p>
      </div>

      {/* On-chain launch / status */}
      {locked ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--up)]/30 bg-[var(--up-soft)] px-3 py-2 text-xs font-medium text-[var(--up)]">
          <Check className="h-4 w-4" />
          온체인 발행됨 · 캠페인 #{c.onchainId} — 사용자 클레임 가능 (할당 수정 잠김)
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
          <span className="text-xs text-[var(--muted)]">
            {airdropLive
              ? "준비되면 온체인에 발행 — 토큰을 컨트랙트에 충전하고 클레임을 엽니다."
              : "온체인 발행하려면 먼저 에어드랍 컨트랙트를 배포하세요 (npm run deploy:airdrop)."}
          </span>
          <button
            onClick={launchOnChain}
            disabled={!airdropLive || launching || c.whitelist.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            {launching ? "발행 중…" : "온체인 발행"}
          </button>
        </div>
      )}

      {/* Bulk entry: paste many, apply at once. Duplicates accumulate. */}
      {!locked && (
      <div className="mt-2">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">기본 금액</span>
          <input
            type="number"
            value={defaultAmount}
            onChange={(e) => setDefaultAmount(e.target.value)}
            placeholder="100"
            title={`Default amount when a line omits one (${c.tokenSymbol})`}
            className="w-28 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
          />
          <span className="text-xs text-[var(--muted-2)]">{c.tokenSymbol} / 미기재 시 적용</span>
        </div>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder={
            "한 줄에 하나씩:\n0xabc…, 100\n0xdef…, 250\n0x123…       ← 금액 생략 시 기본 금액"
          }
          className="w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[var(--up)]">유효 {valid.length}</span>
            {invalid.length > 0 && (
              <span
                className="text-[var(--down)]"
                title={invalid
                  .map((r) => `line ${r.line}: ${r.error}`)
                  .join("\n")}
              >
                오류 {invalid.length}
              </span>
            )}
            {address && (
              <button
                onClick={addMyWallet}
                className="inline-flex items-center gap-1 font-medium text-[var(--accent)]"
              >
                <UserPlus className="h-3.5 w-3.5" />내 지갑 추가
              </button>
            )}
          </div>
          <button
            onClick={apply}
            disabled={valid.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            할당 반영 ({valid.length})
          </button>
        </div>
      </div>
      )}

      {/* Entries: per-wallet amount + received toggle */}
      {c.whitelist.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {c.whitelist.map((w) => (
            <div
              key={w.address}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"
            >
              <span className="font-mono">{shortAddress(w.address)}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">
                  {w.amount.toLocaleString()} {c.tokenSymbol}
                </span>
                <button
                  onClick={() =>
                    setWhitelistClaimed(c.id, w.address, !w.claimed)
                  }
                  title={
                    w.claimed ? "Mark as not received" : "Mark as received"
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                    w.claimed
                      ? "bg-[var(--up-soft)] text-[var(--up)]"
                      : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {w.claimed && <Check className="h-3 w-3" />}
                  {w.claimed ? "Received" : "Pending"}
                </button>
                {!locked && (
                  <button
                    onClick={() => removeFromWhitelist(c.id, w.address)}
                    className="text-[var(--muted)] hover:text-[var(--down)]"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
