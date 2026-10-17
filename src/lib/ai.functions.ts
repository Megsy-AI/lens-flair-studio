import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "openai/gpt-image-2.5-flare";

async function callFastRouter(key: string, image: string, prompt: string) {
  const m = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) throw new Error("صورة غير صالحة");
  const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", prompt);
  form.append("image", new Blob([bytes], { type: m[1]! }), "photo.jpg");
  const res = await fetch("https://api.fastrouter.ai/api/v1/images/edits", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
  });
  const text = await res.text();
  if (!res.ok) return { status: res.status, error: text.slice(0, 200) } as const;
  const item = JSON.parse(text)?.data?.[0];
  if (item?.b64_json) return { image: `data:image/png;base64,${item.b64_json}` } as const;
  if (item?.url) {
    const r = await fetch(item.url);
    const buf = new Uint8Array(await r.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { image: `data:${r.headers.get("content-type") ?? "image/png"};base64,${btoa(s)}` } as const;
  }
  return { status: 500, error: "no image" } as const;
}

export const aiEditImage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ image: z.string().min(20).max(15_000_000), prompt: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { loadConfig, saveConfig } = await import("./config.server");
    let cfg = null;
    try { cfg = await loadConfig(); } catch { cfg = null; }
    const now = Date.now();
    const pool = (cfg?.keys ?? [])
      .filter((k) => k.enabled && k.blockedUntil < now)
      .sort((a, b) => a.uses - b.uses);
    const envKey = process.env["FASTROUTER_API_KEY"];
    const tries: { id?: string; key: string }[] = pool.map((k) => ({ id: k.id, key: k.key }));
    if (envKey) tries.push({ key: envKey });
    if (!tries.length) throw new Error("لا يوجد مفتاح متاح حالياً");

    let lastErr = "";
    for (const t of tries) {
      const r = await callFastRouter(t.key, data.image, data.prompt);
      const k = cfg && t.id ? cfg.keys.find((x) => x.id === t.id) : undefined;
      if ("image" in r) {
        if (k && cfg) { k.uses++; k.fails = 0; await saveConfig(cfg).catch(() => {}); }
        return { image: r.image };
      }
      lastErr = `${r.status}`;
      if (k && cfg) {
        k.fails++; k.lastError = `${r.status}: ${r.error}`.slice(0, 160);
        if (r.status === 401 || r.status === 403) k.enabled = false; // invalid key → disable
        else if (r.status === 402 || r.status === 429) k.blockedUntil = now + 60 * 60 * 1000; // cooldown 1h
        else if (k.fails >= 3) k.blockedUntil = now + 10 * 60 * 1000;
        await saveConfig(cfg).catch(() => {});
      }
      if (r.status === 400) break; // bad request — other keys won't help
    }
    throw new Error(`فشل المعالجة (${lastErr})`);
  });

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { loadConfig, defaultConfig } = await import("./config.server");
  const c = await loadConfig().catch(() => defaultConfig());
  return {
    modes: c.modes.filter((m) => m.enabled !== false),
    prices: { monthly: 3, yearly: 0, currency: "USD" },
  };
});
