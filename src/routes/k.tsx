import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Toaster, toast } from "sonner";
import { Plus, Trash2, Power, KeyRound, Sparkles, CreditCard, ChevronLeft, RotateCcw, Activity } from "lucide-react";
import { adminLoad, adminSave, adminTestKey } from "@/lib/admin.functions";
import { CATEGORIES, type AIMode } from "@/lib/modes";

export const Route = createFileRoute("/k")({
  head: () => ({ meta: [{ title: "Lumen — إدارة الكاميرا" }, { name: "description", content: "إدارة أوضاع Lumen ومفاتيح معالجة الصور." }, { property: "og:title", content: "Lumen — إدارة الكاميرا" }, { property: "og:description", content: "إدارة أوضاع الكاميرا وإعداداتها." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

type Cfg = Extract<Awaited<ReturnType<typeof adminLoad>>, { ok: true }>["config"];
const uid = () => Math.random().toString(36).slice(2, 10);

function Admin() {
  const load = useServerFn(adminLoad);
  const save = useServerFn(adminSave);
  const test = useServerFn(adminTestKey);
  const [pw, setPw] = useState("");
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [tab, setTab] = useState<"keys" | "modes" | "pay">("keys");
  const [newKey, setNewKey] = useState("");
  const [editing, setEditing] = useState<AIMode | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await load({ data: { password: pw } });
    if (r.ok) setCfg(r.config); else toast.error("كلمة السر غير صحيحة");
  };
  const persist = async (c: Cfg) => {
    setCfg(c);
    const r = await save({ data: { password: pw, config: c } });
    r.ok ? toast.success("تم الحفظ") : toast.error("فشل الحفظ");
  };

  if (!cfg) return (
    <form onSubmit={login} className="grid h-screen place-items-center p-6" dir="rtl">
      <Toaster theme="dark" position="top-center" />
      <div className="glass-strong w-full max-w-xs rounded-[2rem] p-6 text-center">
        <KeyRound className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-xl font-bold">لوحة الراوتر</h1>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة السر" autoFocus
          className="glass mt-5 w-full rounded-2xl bg-transparent px-4 py-3 text-center outline-none" />
        <button className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">دخول</button>
      </div>
    </form>
  );

  const now = Date.now();
  const status = (k: Cfg["keys"][number]) => !k.enabled ? ["محظور", "text-destructive"] : k.blockedUntil > now ? ["استراحة", "text-primary"] : ["نشط", "text-chart-2"];

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-32" dir="rtl">
      <Toaster theme="dark" position="top-center" />
      <div className="glass sticky top-0 z-20 flex items-center justify-between border-x-0 border-t-0 px-4 py-3">
        <Link to="/" className="flex items-center gap-1 text-primary"><ChevronLeft className="size-5 rotate-180" />التطبيق</Link>
        <h1 className="font-semibold">الراوتر K</h1>
        <span className="w-16" />
      </div>

      <div className="glass mx-4 mt-4 grid grid-cols-3 rounded-full p-1 text-sm">
        {([["keys", "المفاتيح", KeyRound], ["modes", "الأوضاع", Sparkles], ["pay", "الدفع", CreditCard]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center justify-center gap-1.5 rounded-full py-2 transition ${tab === k ? "bg-glass-strong text-primary" : "text-muted-foreground"}`}><I className="size-4" />{l}</button>
        ))}
      </div>

      {tab === "keys" && (
        <div className="space-y-3 p-4">
          <div className="glass grid grid-cols-3 rounded-3xl p-4 text-center text-xs">
            <div><b className="block text-2xl">{cfg.keys.filter((k) => k.enabled && k.blockedUntil < now).length}</b>نشط</div>
            <div><b className="block text-2xl">{cfg.keys.filter((k) => !k.enabled).length}</b>محظور</div>
            <div><b className="block text-2xl">{cfg.keys.reduce((s, k) => s + k.uses, 0)}</b>طلب</div>
          </div>
          <p className="px-1 text-xs text-muted-foreground">الراوتر بيوزّع الطلبات على المفتاح الأقل استخداماً. المفتاح الغلط بيتحظر تلقائياً، واللي خلص رصيده أو اتضغط بياخد استراحة ساعة ويرجع لوحده.</p>
          <div className="glass flex gap-2 rounded-3xl p-2">
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="sk-v1-…" dir="ltr" className="flex-1 bg-transparent px-3 text-sm outline-none" />
            <button onClick={() => {
              if (newKey.trim().length < 10) return;
              persist({ ...cfg, keys: [...cfg.keys, { id: uid(), label: `مفتاح ${cfg.keys.length + 1}`, key: newKey.trim(), enabled: true, uses: 0, fails: 0, blockedUntil: 0 }] });
              setNewKey("");
            }} className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />إضافة</button>
          </div>
          {cfg.keys.map((k, i) => {
            const [s, c] = status(k);
            const upd = (p: Partial<typeof k>) => persist({ ...cfg, keys: cfg.keys.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={k.id} className="glass rounded-3xl p-4">
                <div className="flex items-center gap-2">
                  <input defaultValue={k.label} onBlur={(e) => e.target.value !== k.label && upd({ label: e.target.value })} className="flex-1 bg-transparent font-semibold outline-none" />
                  <span className={`text-xs font-semibold ${c}`}>● {s}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">مفتاح محفوظ · {k.uses} طلب · {k.fails} فشل</p>
                {k.lastError && <p dir="ltr" className="mt-1 truncate text-[11px] text-destructive">{k.lastError}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button onClick={async () => { const r = await test({ data: { password: pw, key: k.key } }); r.ok ? toast.success("المفتاح شغال") : toast.error(`المفتاح لا يعمل (${r.status})`); }} className="glass flex items-center gap-1 rounded-full px-3 py-1.5"><Activity className="size-3.5" />اختبار</button>
                  <button onClick={() => upd({ enabled: !k.enabled, blockedUntil: 0, fails: 0 })} className="glass flex items-center gap-1 rounded-full px-3 py-1.5"><Power className="size-3.5" />{k.enabled ? "حظر" : "تفعيل"}</button>
                  {k.blockedUntil > now && <button onClick={() => upd({ blockedUntil: 0, fails: 0 })} className="glass flex items-center gap-1 rounded-full px-3 py-1.5"><RotateCcw className="size-3.5" />إنهاء الاستراحة</button>}
                  <button onClick={() => confirm("مسح المفتاح؟") && persist({ ...cfg, keys: cfg.keys.filter((_, j) => j !== i) })} className="glass flex items-center gap-1 rounded-full px-3 py-1.5 text-destructive"><Trash2 className="size-3.5" />مسح</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "modes" && (
        <div className="space-y-2 p-4">
          <button onClick={() => setEditing({ id: uid(), name: "", category: CATEGORIES[0]!, prompt: "" })} className="flex w-full items-center justify-center gap-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />وضع جديد</button>
          {cfg.modes.map((m) => (
            <div key={m.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <button onClick={() => setEditing(m)} className="flex-1 text-right">
                <p className={`font-semibold ${m.enabled === false ? "text-muted-foreground line-through" : ""}`}>{m.name}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{m.category} · {m.prompt}</p>
              </button>
              <button onClick={() => persist({ ...cfg, modes: cfg.modes.map((x) => x.id === m.id ? { ...x, enabled: x.enabled === false } : x) })}><Power className={`size-4 ${m.enabled === false ? "text-muted-foreground" : "text-primary"}`} /></button>
              <button onClick={() => confirm("مسح الوضع؟") && persist({ ...cfg, modes: cfg.modes.filter((x) => x.id !== m.id) })}><Trash2 className="size-4 text-destructive" /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "pay" && (
        <div className="space-y-3 p-4">
          <h2 className="text-xl font-semibold">Lumen Pro</h2>
          <p className="text-3xl font-semibold" dir="ltr">$3.00 <span className="text-sm text-muted-foreground">USD / month</span></p>
          <p className="text-sm text-muted-foreground">كاشير · بطاقات ومحافظ</p>
          <p className="text-sm text-muted-foreground">Dodo · Apple Pay وGoogle Pay</p>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-scrim backdrop-blur-xl">
          <div className="glass-strong mx-auto w-full max-w-2xl space-y-3 rounded-t-[2rem] p-5">
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="اسم الوضع" className="glass w-full rounded-2xl bg-transparent px-4 py-3 outline-none" />
            <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="glass w-full rounded-2xl bg-background px-4 py-3">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={editing.thumb ?? ""} onChange={(e) => setEditing({ ...editing, thumb: e.target.value || undefined })} placeholder="رابط صورة المعاينة (اختياري)" dir="ltr" className="glass w-full rounded-2xl bg-transparent px-4 py-3 text-sm outline-none" />
            <textarea value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} placeholder="البرومبت (بالإنجليزي أفضل)" rows={5} dir="ltr" className="glass w-full rounded-2xl bg-transparent px-4 py-3 text-sm outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="glass flex-1 rounded-full py-3">إلغاء</button>
              <button onClick={() => {
                if (!editing.name || !editing.prompt) { toast.error("الاسم والبرومبت مطلوبين"); return; }
                const exists = cfg.modes.some((m) => m.id === editing.id);
                persist({ ...cfg, modes: exists ? cfg.modes.map((m) => (m.id === editing.id ? editing : m)) : [...cfg.modes, editing] });
                setEditing(null);
              }} className="flex-1 rounded-full bg-primary py-3 font-semibold text-primary-foreground">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
