// Shared airdrop campaigns (incl. whitelists + onchainId), server-only.
// Source of truth for ALL users — replaces per-browser localStorage so an
// admin-created/launched campaign is visible and claimable everywhere.
import "server-only";
import { kvGet, kvSet } from "./kv";
import type { AirdropCampaign } from "./types";

const KEY = "ioi:campaigns:v1";

export async function readCampaigns(): Promise<AirdropCampaign[]> {
  const raw = await kvGet(KEY);
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list as AirdropCampaign[];
    } catch {
      // corrupt value — fall through to empty
    }
  }
  return [];
}

export async function writeCampaigns(list: AirdropCampaign[]): Promise<void> {
  await kvSet(KEY, JSON.stringify(list));
}
