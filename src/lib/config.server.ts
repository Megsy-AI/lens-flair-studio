import { createHash, timingSafeEqual } from "node:crypto";
import { DEFAULT_MODES, type AIMode } from "./modes";

export type ApiKey = {
  id: string; label: string; key: string; enabled: boolean;
  uses: number; fails: number; blockedUntil: number; lastError?: string | undefined;
};
export type Config = {
  keys: ApiKey[];
  modes: AIMode[];
  kashier: { merchantId: string; apiKey: string; mode: "test" | "live"; currency: string; monthly: number; yearly: number };
};

const KEY = "lumen_config";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function defaultConfig(): Config {
  return {
    keys: [],
    modes: DEFAULT_MODES,
    kashier: { merchantId: "", apiKey: "", mode: "live", currency: "USD", monthly: 3, yearly: 0 },
  };
}

export async function loadConfig(): Promise<Config> {
  const db = await admin();
  const { data } = await db.from("bot_settings").select("value").eq("key", KEY).maybeSingle();
  const base = defaultConfig();
  if (!data?.value) return base;
  try {
    const c = JSON.parse(data.value) as Partial<Config>;
    return { ...base, ...c, kashier: { ...base.kashier, ...(c.kashier ?? {}) } };
  } catch { return base; }
}

export async function saveConfig(c: Config) {
  const db = await admin();
  const { error } = await db.from("bot_settings").upsert({ key: KEY, value: JSON.stringify(c) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export function checkPassword(input: string) {
  const expected = process.env["ADMIN_PASSWORD"] ?? "";
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return expected.length > 0 && timingSafeEqual(a, b);
}
