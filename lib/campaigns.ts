"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AirdropCampaign } from "./types";

const KEY = ["campaigns"];

async function fetchCampaigns(): Promise<AirdropCampaign[]> {
  const res = await fetch("/api/campaigns");
  if (!res.ok) throw new Error("campaigns fetch failed");
  return res.json();
}

/** Shared campaign list (public read), refreshed every 30s. */
export function useCampaigns() {
  return useQuery<AirdropCampaign[]>({
    queryKey: KEY,
    queryFn: fetchCampaigns,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

/** Short unique id matching the previous store style (`camp_xxxxxxxx`). */
export function campaignId(): string {
  return "camp_" + Math.random().toString(36).slice(2, 10);
}

/**
 * Admin view: the campaign list plus `save(next)` which optimistically updates
 * the cache and PUTs the whole list to the backend (rolls back on failure).
 * All admin components share one react-query cache, so no prop threading.
 */
export function useCampaignAdmin() {
  const qc = useQueryClient();
  const { data: campaigns = [], isLoading } = useCampaigns();

  const save = async (next: AirdropCampaign[]): Promise<void> => {
    const prev = qc.getQueryData<AirdropCampaign[]>(KEY);
    qc.setQueryData(KEY, next); // optimistic
    try {
      const res = await fetch("/api/campaigns", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      qc.setQueryData(KEY, prev); // rollback
      throw err;
    }
  };

  const create = (c: AirdropCampaign) => save([c, ...campaigns]);
  const remove = (id: string) => save(campaigns.filter((c) => c.id !== id));
  const updateOne = (
    id: string,
    fn: (c: AirdropCampaign) => AirdropCampaign,
  ) => save(campaigns.map((c) => (c.id === id ? fn(c) : c)));

  return { campaigns, isLoading, save, create, remove, updateOne };
}
