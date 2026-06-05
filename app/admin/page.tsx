"use client";

import { useState } from "react";
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
} from "lucide-react";
import { POOLS, TOKENS } from "@/lib/mock-data";
import { useDexStore, useHydrated } from "@/lib/store";
import {
  daysUntil,
  formatUsd,
  shortAddress,
} from "@/lib/format";
import { TokenLogo } from "@/components/TokenLogo";
import { toast } from "@/components/toast";
import { Eyebrow } from "@/components/ui";
import type { AirdropCampaign, Eligibility } from "@/lib/types";

const DAY = 1000 * 60 * 60 * 24;

const INPUT =
  "w-full rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

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
  const campaigns = useDexStore((s) => s.campaigns);
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
    </div>
  );
}

function CampaignForm() {
  const createCampaign = useDexStore((s) => s.createCampaign);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("IOI");
  const [amountPerClaim, setAmountPerClaim] = useState("100");
  const [totalAllocation, setTotalAllocation] = useState("100000");
  const [eligibility, setEligibility] = useState<Eligibility>("public");
  const [requiredPoolId, setRequiredPoolId] = useState(POOLS[0].id);
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
    const amt = parseFloat(amountPerClaim);
    const total = parseFloat(totalAllocation);
    const days = parseFloat(durationDays);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 1e12)
      return toast.error("Reward must be between 0 and 1e12");
    if (!Number.isFinite(total) || total < amt || total > 1e15)
      return toast.error("Allocation must be ≥ reward and ≤ 1e15");
    if (!Number.isFinite(days) || days <= 0 || days > 3650)
      return toast.error("Duration must be 1–3650 days");

    createCampaign({
      name: name.trim(),
      description:
        description.trim() || "Claim your reward from this campaign.",
      tokenSymbol,
      amountPerClaim: amt,
      totalAllocation: total,
      eligibility,
      whitelist: [],
      requiredPoolId: eligibility === "lp" ? requiredPoolId : undefined,
      active: true,
      endsAt: Date.now() + days * DAY,
    });
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
          <div className="grid grid-cols-3 gap-2">
            {["IOI", "ARB", "USDC"].map((sym) => (
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Reward / wallet">
            <input
              type="number"
              value={amountPerClaim}
              onChange={(e) => setAmountPerClaim(e.target.value)}
              className={INPUT}
            />
          </Field>
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
          <div className="grid grid-cols-3 gap-2">
            {(["public", "whitelist", "lp"] as Eligibility[]).map((e) => (
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
                {e === "lp" ? "LP" : e}
              </button>
            ))}
          </div>
        </Field>

        {eligibility === "lp" && (
          <Field label="Required pool">
            <select
              value={requiredPoolId}
              onChange={(e) => setRequiredPoolId(e.target.value)}
              className={INPUT}
            >
              {POOLS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.token0} / {p.token1}
                </option>
              ))}
            </select>
          </Field>
        )}

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
  const updateCampaign = useDexStore((s) => s.updateCampaign);
  const deleteCampaign = useDexStore((s) => s.deleteCampaign);
  const claimedAlloc = c.claimedCount * c.amountPerClaim;

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
              {c.eligibility} · {c.amountPerClaim} {c.tokenSymbol} / wallet ·{" "}
              {daysUntil(c.endsAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
        <Mini label="Claims" value={String(c.claimedCount)} />
        <Mini
          label="Distributed"
          value={`${claimedAlloc.toLocaleString()} ${c.tokenSymbol}`}
        />
        <Mini
          label="Pool value"
          value={formatUsd(
            c.totalAllocation *
              (TOKENS.find((t) => t.symbol === c.tokenSymbol)?.priceUsd ?? 0),
            { compact: true },
          )}
        />
      </div>

      {c.eligibility === "whitelist" && <WhitelistManager campaign={c} />}
    </div>
  );
}

function WhitelistManager({ campaign: c }: { campaign: AirdropCampaign }) {
  const address = useDexStore((s) => s.address);
  const addToWhitelist = useDexStore((s) => s.addToWhitelist);
  const removeFromWhitelist = useDexStore((s) => s.removeFromWhitelist);
  const [input, setInput] = useState("");

  const add = (addr: string) => {
    const a = addr.trim();
    if (!a) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(a))
      return toast.error("Invalid EVM address");
    addToWhitelist(c.id, a);
    toast.success(`Whitelisted ${shortAddress(a)}`);
    setInput("");
  };

  return (
    <div className="mt-4 rounded-2xl bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--muted)]">
        Whitelist ({c.whitelist.length})
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x… wallet address"
          className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={() => add(input)}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-3 text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {address && (
        <button
          onClick={() => add(address)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add my connected wallet ({shortAddress(address)})
        </button>
      )}

      {c.whitelist.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.whitelist.map((w) => (
            <span
              key={w}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 font-mono text-xs"
            >
              {shortAddress(w)}
              <button
                onClick={() => removeFromWhitelist(c.id, w)}
                className="text-[var(--muted)] hover:text-[var(--down)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
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
