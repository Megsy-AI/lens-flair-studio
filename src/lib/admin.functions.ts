import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pw = z.object({ password: z.string().max(200) });

export const adminLoad = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.parse(d))
  .handler(async ({ data }) => {
    const { checkPassword, loadConfig } = await import("./config.server");
    if (!checkPassword(data.password)) return { ok: false as const };
    const c = await loadConfig();
    return { ok: true as const, config: c };
  });

const mode = z.object({ id: z.string(), name: z.string(), category: z.string(), prompt: z.string(), thumb: z.string().optional(), tile: z.number().optional(), enabled: z.boolean().optional() });
const key = z.object({ id: z.string(), label: z.string(), key: z.string(), enabled: z.boolean(), uses: z.number(), fails: z.number(), blockedUntil: z.number(), lastError: z.string().optional() });

export const adminSave = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    pw.extend({
      config: z.object({
        keys: z.array(key), modes: z.array(mode),
        kashier: z.object({ merchantId: z.string(), apiKey: z.string(), mode: z.enum(["test", "live"]), currency: z.string(), monthly: z.number(), yearly: z.number() }),
      }),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { checkPassword, saveConfig } = await import("./config.server");
    if (!checkPassword(data.password)) return { ok: false as const };
    await saveConfig(data.config);
    return { ok: true as const };
  });

export const adminTestKey = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.extend({ key: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { checkPassword } = await import("./config.server");
    if (!checkPassword(data.password)) return { ok: false, status: 0 };
    const r = await fetch("https://api.fastrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${data.key}` } });
    return { ok: r.ok, status: r.status };
  });
