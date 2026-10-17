import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster, toast } from "sonner";
import {
  RefreshCw, Zap, ZapOff, Sparkles, Wand2, Crop, SlidersHorizontal, Trash2, Download, Crown, Check, ChevronLeft, Images,
  Share2, Pencil, X, RotateCw, FlipHorizontal, FlipVertical, Palette, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiEditImage, getPublicConfig } from "@/lib/ai.functions";
import { verifyDeviceSubscription } from "@/lib/pay.functions";
import { SubscriptionPage } from "@/components/subscription-page";
import { CAMERA_PROMPT, consumeTrial, deletePhoto, isPro, listPhotos, savePhoto, setPro, deviceToken, trialsLeft, DAILY_TRIALS, type Photo } from "@/lib/store";
import { DEFAULT_MODES, CATEGORIES, type AIMode } from "@/lib/modes";
import effectsGrid from "@/assets/effects-grid.jpg";
import paywallBg from "@/assets/paywall.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — كاميرا الذكاء الاصطناعي" },
      { name: "description", content: "كاميرا بتصميم iOS زجاجي تحسّن صورك بالذكاء الاصطناعي وتحوّلها لليجو وأنمي وأكثر." },
      { property: "og:title", content: "Lumen — كاميرا الذكاء الاصطناعي" },
      { property: "og:description", content: "التقط، حسّن، وحوّل صورك بالذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

const MODES = [
  { id: "night", label: "NIGHT", aspect: 3 / 4, extra: " Night mode: bright exposure, very low noise, preserve night ambience and city lights." },
  { id: "portrait", label: "PORTRAIT", aspect: 3 / 4, extra: " Portrait mode: strong creamy background blur f/1.4, subject in razor sharp focus, flattering skin." },
  { id: "photo", label: "PHOTO", aspect: 3 / 4, extra: "" },
  { id: "square", label: "SQUARE", aspect: 1, extra: "" },
  { id: "pano", label: "PANO", aspect: 16 / 9, extra: " Ultra wide panoramic landscape look, extended dynamic range." },
] as const;
type Mode = (typeof MODES)[number];

const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const loadImg = (src: string) => new Promise<HTMLImageElement>((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });

type Edit = { crop: number; rotate: number; flipX: boolean; flipY: boolean; filter: string; vignette: number };
async function render(src: string, e: Partial<Edit> = {}, max = 1280): Promise<string> {
  const img = await loadImg(src);
  const rot = ((e.rotate ?? 0) % 360 + 360) % 360;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  const base = rot % 180 ? img.height / img.width : img.width / img.height;
  if (e.crop) {
    const a = rot % 180 ? 1 / e.crop : e.crop;
    if (sw / sh > a) { const nw = sh * a; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / a; sy = (sh - nh) / 2; sh = nh; }
  }
  void base;
  const s = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * s), h = Math.round(sh * s);
  const c = document.createElement("canvas");
  c.width = rot % 180 ? h : w; c.height = rot % 180 ? w : h;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(e.flipX ? -1 : 1, e.flipY ? -1 : 1);
  if (e.filter) ctx.filter = e.filter;
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (e.vignette) {
    const g = ctx.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.3, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${e.vignette / 100})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  }
  return c.toDataURL("image/jpeg", 0.92);
}

type View = "camera" | "gallery" | "studio" | "pro";

function App() {
  const [view, setView] = useState<View>("camera");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [studioPhoto, setStudioPhoto] = useState<Photo | null>(null);
  const [modes, setModes] = useState<AIMode[]>(DEFAULT_MODES);
  const verifySubscription = useServerFn(verifyDeviceSubscription);
  const edit = useServerFn(aiEditImage);
  const cfgFn = useServerFn(getPublicConfig);

  const refresh = useCallback(() => listPhotos().then(setPhotos), []);
  useEffect(() => { refresh(); cfgFn().then((c) => { if (c.modes.length) setModes(c.modes); }).catch(() => {}); }, [refresh, cfgFn]);

  useEffect(() => {
    const orderId = localStorage.getItem("lumen_pending_order");
    verifySubscription({ data: { device: deviceToken(), ...(orderId ? { orderId } : {}) } }).then(r => setPro(r.expiresAt)).catch(() => setPro(null));
  }, [verifySubscription]);

  const runAI = useCallback(async (source: string, prompt: string, label: string, original?: string) => {
    const id = uid();
    const pending: Photo = { id, src: source, original: original ?? source, createdAt: Date.now(), label, pending: true };
    setPhotos((p) => [pending, ...p]);
    try {
      const { image } = await edit({ data: { image: source, prompt } });
      const done: Photo = { ...pending, src: image, pending: false };
      await savePhoto(done);
      setPhotos((p) => p.map((x) => (x.id === id ? done : x)));
      return done;
    } catch (e) {
      const fallback: Photo = { ...pending, pending: false, label: "أصلية" };
      await savePhoto(fallback);
      setPhotos((p) => p.map((x) => (x.id === id ? fallback : x)));
      toast.error(e instanceof Error ? e.message : "فشل المعالجة");
      return null;
    }
  }, [edit]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground select-none" dir="ltr">
      <Toaster position="top-center" theme="dark" />
      <div key={view} className="pop-in h-full">
        {view === "camera" && (
          <Camera last={photos[0]} onCapture={(img, m) => runAI(img, CAMERA_PROMPT + m.extra, "محسّنة")}
            onGallery={() => setView("gallery")} onPro={() => setView("pro")} />
        )}
        {view === "gallery" && (
          <Gallery photos={photos} onBack={() => setView("camera")}
            onEdit={(p) => { setStudioPhoto(p); setView("studio"); }}
            onDelete={async (id) => { await deletePhoto(id); refresh(); }} />
        )}
        {view === "studio" && (
          <Studio photos={photos} photo={studioPhoto} setPhoto={setStudioPhoto} modes={modes} onBack={() => setView("camera")}
            onPaywall={() => setView("pro")} runAI={runAI} onSaved={refresh} />
        )}
        {view === "pro" && <SubscriptionPage onClose={() => setView("camera")} />}
      </div>
    </div>
  );
}

/* ---------------- Camera ---------------- */
const ZOOM_STOPS = [0.5, 1, 2, 5, 10, 25, 50, 100];
const toPos = (z: number) => Math.log(z / 0.5) / Math.log(200); // 0..1
const fromPos = (p: number) => Math.round(0.5 * Math.pow(200, p) * 10) / 10;

function Camera({ last, onCapture, onGallery, onPro }: {
  last: Photo | undefined; onCapture: (img: string, mode: Mode) => void; onGallery: () => void; onPro: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const hwRef = useRef<{ min: number; max: number } | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [modeIdx, setModeIdx] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [dial, setDial] = useState(false);
  const [flash, setFlash] = useState(false);
  const [blink, setBlink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [spin, setSpin] = useState(0);
  const mode = MODES[modeIdx]!;

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        stream = s; if (videoRef.current) videoRef.current.srcObject = s; setErr("");
        const t = s.getVideoTracks()[0]!; trackRef.current = t;
        const cap = (t.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } };
        hwRef.current = cap.zoom ? { min: cap.zoom.min, max: cap.zoom.max } : null;
      })
      .catch(() => setErr("اسمح بالوصول للكاميرا لبدء التصوير"));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [facing]);

  // split zoom into hardware (optical/sensor) + digital remainder
  const hw = hwRef.current;
  const hwZoom = hw ? Math.min(hw.max, Math.max(hw.min, zoom)) : 1;
  const digital = Math.max(1, zoom / hwZoom);
  useEffect(() => {
    const t = trackRef.current;
    if (t && hw) t.applyConstraints({ advanced: [{ zoom: hwZoom } as MediaTrackConstraintSet] }).catch(() => {});
    if (t && "torch" in ((t.getCapabilities?.() ?? {}) as object)) t.applyConstraints({ advanced: [{ torch: flash } as MediaTrackConstraintSet] }).catch(() => {});
  }, [hwZoom, hw, flash]);

  const grab = (v: HTMLVideoElement) => {
    const c = document.createElement("canvas");
    const w = v.videoWidth / digital, h = v.videoHeight / digital;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, w, h);
    return c;
  };

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || busy) return;
    setBusy(true);
    if (flash && !hw) { setBlink(true); await new Promise((r) => setTimeout(r, 160)); }
    let canvas = grab(v);
    if (mode.id === "night") {
      // multi-frame stacking: average 6 frames to cut noise, then lift exposure
      const N = 6; const ctx = canvas.getContext("2d")!;
      const acc = new Float32Array(canvas.width * canvas.height * 4);
      for (let n = 0; n < N; n++) {
        const d = grab(v).getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < d.length; i++) acc[i]! += d[i]!;
        await new Promise((r) => setTimeout(r, 70));
      }
      const out = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < acc.length; i++) out.data[i] = acc[i]! / N;
      ctx.putImageData(out, 0, 0);
      const c2 = document.createElement("canvas"); c2.width = canvas.width; c2.height = canvas.height;
      const x2 = c2.getContext("2d")!; x2.filter = "brightness(1.35) contrast(1.08) saturate(1.1)"; x2.drawImage(canvas, 0, 0);
      canvas = c2;
    }
    setBlink(true); setTimeout(() => setBlink(false), 140);
    const img = await render(canvas.toDataURL("image/jpeg", 0.92), { crop: mode.aspect, vignette: mode.id === "portrait" ? 25 : 0 }, 1536);
    onCapture(img, mode);
    setBusy(false);
  };

  const touchX = useRef(0);
  const dialRef = useRef<HTMLDivElement>(null);
  const onDial = (clientX: number) => {
    const r = dialRef.current!.getBoundingClientRect();
    setZoom(Math.max(0.5, fromPos(Math.min(1, Math.max(0, (clientX - r.left) / r.width)))));
  };
  const zLabel = zoom < 1 ? `.${Math.round(zoom * 10)}` : zoom >= 10 ? Math.round(zoom) : zoom.toFixed(zoom % 1 ? 1 : 0);

  return (
    <div className="relative flex h-full w-full flex-col"
      onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (dial) return;
        const dx = e.changedTouches[0]!.clientX - touchX.current;
        if (Math.abs(dx) > 50) setModeIdx((i) => Math.min(MODES.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1))));
      }}>
      <div className="relative z-20 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] pb-3">
        <button onClick={() => setFlash((f) => !f)} className="glass grid size-10 place-items-center rounded-full transition ease-ios active:scale-90" aria-label="الفلاش">
          {flash ? <Zap className="size-5 text-primary" fill="currentColor" /> : <ZapOff className="size-5" />}
        </button>
        <button onClick={onPro} className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold tracking-wide transition ease-ios active:scale-90" aria-label="الاشتراك">
          PRO
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative w-full overflow-hidden transition-[aspect-ratio] duration-700 ease-ios"
          style={{ aspectRatio: mode.aspect === 1 ? "1" : mode.aspect > 1 ? "16/9" : "3/4", maxHeight: "100%" }}>
          <video ref={videoRef} autoPlay playsInline muted
            className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-500 ease-ios"
            style={{ transform: `scale(${digital}) ${facing === "user" ? "scaleX(-1)" : ""}`, filter: mode.id === "night" ? "brightness(1.3) contrast(1.05)" : undefined }} />
          {mode.id === "portrait" && <div className="pop-in pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_50px_var(--scrim)]" />}
          {err && <div className="absolute inset-0 grid place-items-center p-8 text-center text-muted-foreground">{err}</div>}
          {blink && <div className="absolute inset-0 bg-shutter" />}
        </div>

        <div className="absolute bottom-4 left-1/2 w-[86%] -translate-x-1/2">
          {dial ? (
            <div className="glass pop-in rounded-full px-4 py-2">
              <div ref={dialRef} className="relative h-8 touch-none"
                onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); onDial(e.clientX); }}
                onPointerMove={(e) => e.buttons && onDial(e.clientX)}
                onPointerUp={() => setTimeout(() => setDial(false), 1400)}>
                {Array.from({ length: 41 }).map((_, i) => (
                  <span key={i} className={`absolute top-1/2 w-px -translate-y-1/2 bg-foreground/60 ${i % 5 ? "h-2" : "h-4"}`} style={{ left: `${(i / 40) * 100}%` }} />
                ))}
                {ZOOM_STOPS.map((z) => (
                  <span key={z} className="absolute -bottom-1 -translate-x-1/2 text-[9px] text-muted-foreground" style={{ left: `${toPos(z) * 100}%` }}>{z}</span>
                ))}
                <span className="absolute top-0 h-8 w-0.5 -translate-x-1/2 rounded bg-primary transition-[left] duration-150 ease-ios" style={{ left: `${toPos(zoom) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="glass mx-auto flex w-fit gap-1 rounded-full p-1">
              {[0.5, 1, 2, 5, 10].map((z) => {
                const near = (z === 10 ? zoom >= 10 : z === 5 ? zoom >= 5 && zoom < 10 : z === 2 ? zoom >= 2 && zoom < 5 : z === 1 ? zoom >= 1 && zoom < 2 : zoom < 1);
                return (
                  <button key={z} onClick={() => setZoom(z)} onDoubleClick={() => setDial(true)} onContextMenu={(e) => { e.preventDefault(); setDial(true); }}
                    className={`grid size-9 place-items-center rounded-full text-[11px] font-bold transition-all duration-300 ease-ios ${near ? "scale-110 bg-scrim text-primary" : ""}`}>
                    {near ? `${zLabel}×` : z === 0.5 ? ".5" : z}
                  </button>
                );
              })}
              <button onClick={() => setDial(true)} className="grid h-9 place-items-center rounded-full px-2 text-[10px] font-bold text-muted-foreground">100</button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="camera-modes glass relative mx-auto grid h-12 w-full max-w-lg grid-cols-5 rounded-full p-1" role="tablist" aria-label="أوضاع التصوير">
          <span className="mode-indicator absolute bottom-1 top-1 rounded-full" style={{ width: "calc((100% - 8px) / 5)", left: `calc(4px + (100% - 8px) / 5 * ${modeIdx})` }} />
          {MODES.map((m, i) => (
            <Button variant="ghost" key={m.id} role="tab" aria-selected={i === modeIdx} onClick={() => setModeIdx(i)}
              className={`relative z-10 h-10 min-w-0 rounded-full px-0 text-[10px] font-semibold transition-all duration-500 ease-ios ${i === modeIdx ? "text-primary" : "text-muted-foreground"}`}>
              {({ night: "ليلي", portrait: "بورتريه", photo: "صورة", square: "مربع", pano: "بانوراما" })[m.id]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 pt-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        <button onClick={onGallery} className="relative size-14 overflow-hidden rounded-xl border-2 border-glass-border bg-glass transition ease-ios active:scale-90" aria-label="المعرض">
          {last ? <img src={last.src} className="h-full w-full object-cover" alt="" /> : <Images className="m-auto size-6 text-muted-foreground" />}
          {last?.pending && <div className="shimmer absolute inset-0" />}
        </button>
        <button onClick={shoot} aria-label="التقاط" className="grid size-[78px] place-items-center rounded-full border-4 border-shutter transition ease-ios active:scale-90">
          <span className={`size-[62px] rounded-full bg-shutter transition-all duration-300 ease-ios ${busy ? "scale-75 opacity-70" : ""}`} />
        </button>
        <button onClick={() => { setSpin((s) => s + 180); setFacing((f) => (f === "user" ? "environment" : "user")); setZoom(1); }}
          className="glass grid size-14 place-items-center rounded-full" aria-label="قلب الكاميرا">
          <RefreshCw className="size-6 transition-transform duration-500 ease-ios" style={{ transform: `rotate(${spin}deg)` }} />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Gallery ---------------- */
async function share(p: Photo) {
  const blob = await (await fetch(p.src)).blob();
  const file = new File([blob], `lumen-${p.id}.jpg`, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Lumen" }).catch(() => {});
  else toast.info("المشاركة غير مدعومة على هذا المتصفح");
}
function download(p: Photo) {
  const a = document.createElement("a"); a.href = p.src; a.download = `lumen-${p.id}.jpg`; a.click();
  toast.success("تم الحفظ");
}
const dayLabel = (t: number) => {
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return "اليوم";
  if (new Date(n.getTime() - 864e5).toDateString() === d.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
};

function Gallery({ photos, onBack, onEdit, onDelete }: {
  photos: Photo[]; onBack: () => void; onEdit: (p: Photo) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState<Photo | null>(null);
  const [filter, setFilter] = useState<"all" | "ai" | "edit">("all");
  const [columns, setColumns] = useState<2 | 3>(3);
  const list = photos.filter((p) => filter === "all" || (filter === "edit" ? p.label === "معدّلة" : p.label !== "معدّلة" && p.label !== "أصلية"));
  const groups = useMemo(() => {
    const g: [string, Photo[]][] = [];
    for (const p of list) { const l = dayLabel(p.createdAt); const last = g[g.length - 1]; if (last && last[0] === l) last[1].push(p); else g.push([l, [p]]); }
    return g;
  }, [list]);
  return (
    <div className="gallery-page flex h-full flex-col" dir="rtl">
      <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-[max(env(safe-area-inset-top),18px)]">
        <Button variant="ghost" size="icon" onClick={onBack} className="glass size-11 rounded-full" aria-label="العودة للكاميرا"><ChevronLeft className="size-5 rotate-180" /></Button>
        <span className="text-sm font-medium text-muted-foreground">LUMEN</span>
        <Button variant="ghost" size="icon" onClick={() => setColumns(columns === 3 ? 2 : 3)} className="glass size-11 rounded-full" aria-label="تغيير حجم الصور"><Images className="size-5" /></Button>
      </header>
      <div className="px-6 pb-5">
        <div className="flex items-end justify-between"><h1 className="text-[36px] font-bold leading-tight">مكتبتك</h1><span className="pb-1 text-sm tabular-nums text-muted-foreground">{photos.length} صورة</span></div>
        <div className="glass relative mt-5 grid h-11 grid-cols-3 rounded-full p-1">
          {([["all", "كل الصور"], ["ai", "محسّنة"], ["edit", "معدّلة"]] as const).map(([k, l]) => (
            <Button variant="ghost" key={k} onClick={() => setFilter(k)} className={`h-9 rounded-full px-2 text-xs transition-all duration-300 ease-ios ${filter === k ? "bg-glass-strong text-foreground" : "text-muted-foreground"}`}>{l}</Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),24px)]">
        {list.length === 0 && <div className="flex h-3/5 flex-col items-center justify-center gap-4 text-muted-foreground"><div className="glass grid size-20 place-items-center rounded-full"><Images className="size-8" /></div><p className="text-lg font-medium">{photos.length ? "لا توجد صور هنا" : "لحظاتك تبدأ بصورة"}</p>{!photos.length && <Button variant="ghost" onClick={onBack} className="text-primary">افتح الكاميرا <ChevronLeft className="size-4" /></Button>}</div>}
        {groups.map(([label, items]) => (
          <section key={label} className="mb-6">
            <div className="flex items-center justify-between px-2 pb-3"><h2 className="text-base font-semibold">{label}</h2><span className="text-xs text-muted-foreground">{items.length}</span></div>
            <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {items.map((p) => <Button variant="ghost" key={p.id} disabled={p.pending} aria-label={`عرض الصورة ${p.id}`} onClick={() => setOpen(p)} className="relative h-auto aspect-[3/4] overflow-hidden rounded-lg bg-muted p-0 transition duration-500 ease-ios active:scale-95">
                <img src={p.src} className={`h-full w-full object-cover ${p.pending ? "blur-sm" : ""}`} alt="صورة من مكتبتك" />
                {p.pending && <div className="shimmer absolute inset-0" aria-label="جاري المعالجة" />}
              </Button>)}
            </div>
          </section>
        ))}
      </div>
      {open && <Viewer photo={open} onClose={() => setOpen(null)} onEdit={() => { onEdit(open); setOpen(null); }} onDelete={() => { onDelete(open.id); setOpen(null); }} />}
    </div>
  );
}

function Viewer({ photo, onClose, onEdit, onDelete }: { photo: Photo; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const [orig, setOrig] = useState(false);
  const [chrome, setChrome] = useState(true);
  return (
    <div className="pop-in fixed inset-0 z-40 bg-background" dir="rtl">
      <div className="absolute inset-0 grid place-items-center"
        onClick={() => setChrome((c) => !c)}
        onPointerDown={() => setTimeout(() => setOrig(true), 0)} onPointerUp={() => setOrig(false)} onPointerLeave={() => setOrig(false)}>
        <img src={orig && photo.original ? photo.original : photo.src} className="max-h-full max-w-full object-contain transition-opacity duration-300" alt="" />
      </div>
      <div className={`absolute inset-x-0 top-0 flex items-center px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3 transition-all duration-500 ease-ios ${chrome ? "" : "-translate-y-full opacity-0"}`}>
        <button onClick={onClose} className="glass flex h-10 items-center gap-1 rounded-full pl-4 pr-2 text-sm"><ChevronLeft className="size-5 rotate-180" />رجوع</button>
      </div>
      <div className={`absolute bottom-[max(env(safe-area-inset-bottom),22px)] left-1/2 -translate-x-1/2 transition-all duration-500 ease-ios ${chrome ? "" : "translate-y-[200%] opacity-0"}`}>
        <div className="glass-strong flex gap-2 rounded-full p-2">
          {([[Download, "حفظ", () => download(photo), ""], [Share2, "مشاركة", () => share(photo), ""], [Pencil, "تعديل", onEdit, "text-primary"], [Trash2, "مسح", onDelete, "text-destructive"]] as const).map(([I, l, fn, c]) => (
            <button key={l} onClick={fn} className={`flex w-16 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] transition ease-ios active:scale-90 ${c}`}><I className="size-5" />{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Studio ---------------- */
const CROPS = [{ l: "حر", v: 0 }, { l: "1:1", v: 1 }, { l: "4:5", v: 4 / 5 }, { l: "3:4", v: 3 / 4 }, { l: "2:3", v: 2 / 3 }, { l: "9:16", v: 9 / 16 }, { l: "4:3", v: 4 / 3 }, { l: "16:9", v: 16 / 9 }];
const ADJ = [
  { k: "exposure", l: "التعريض", min: -50, max: 50, d: 0 },
  { k: "brightness", l: "السطوع", min: 50, max: 150, d: 100 },
  { k: "contrast", l: "التباين", min: 50, max: 150, d: 100 },
  { k: "saturate", l: "التشبع", min: 0, max: 200, d: 100 },
  { k: "warmth", l: "الدفء", min: -50, max: 50, d: 0 },
  { k: "tint", l: "الصبغة", min: -90, max: 90, d: 0 },
  { k: "fade", l: "البهتان", min: 0, max: 60, d: 0 },
  { k: "mono", l: "أبيض وأسود", min: 0, max: 100, d: 0 },
  { k: "blur", l: "النعومة", min: 0, max: 10, d: 0 },
  { k: "vignette", l: "التظليل", min: 0, max: 80, d: 0 },
] as const;
type Adj = Record<(typeof ADJ)[number]["k"], number>;
const ADJ0 = Object.fromEntries(ADJ.map((a) => [a.k, a.d])) as Adj;
const PRESETS: { l: string; a: Partial<Adj> }[] = [
  { l: "أصلي", a: {} }, { l: "زاهي", a: { saturate: 140, contrast: 110 } }, { l: "دافئ", a: { warmth: 30, brightness: 104 } },
  { l: "بارد", a: { warmth: -30, tint: 10 } }, { l: "دراما", a: { contrast: 140, saturate: 80, vignette: 50 } },
  { l: "فضي", a: { mono: 100, contrast: 120 } }, { l: "نوار", a: { mono: 100, contrast: 150, brightness: 90, vignette: 60 } },
  { l: "فيلم", a: { fade: 25, warmth: 15, saturate: 85 } }, { l: "حالم", a: { blur: 1, brightness: 110, fade: 20 } }, { l: "غروب", a: { warmth: 45, tint: -15, saturate: 120 } },
];
const cssOf = (a: Adj) => `brightness(${(a.brightness + a.exposure) / 100}) contrast(${(a.contrast - a.fade * 0.5) / 100}) saturate(${a.saturate / 100}) sepia(${Math.max(0, a.warmth) / 100}) hue-rotate(${a.tint + (a.warmth < 0 ? a.warmth : 0)}deg) grayscale(${a.mono / 100}) blur(${a.blur}px)`;

function Thumb({ m, src }: { m: AIMode; src: string }) {
  if (m.thumb) return <img src={m.thumb} className="h-full w-full object-cover" alt="" loading="lazy" />;
  if (m.tile !== undefined) return <span className="block h-full w-full" style={{ backgroundImage: `url(${effectsGrid})`, backgroundSize: "400% 400%", backgroundPosition: `${(m.tile % 4) * 33.333}% ${Math.floor(m.tile / 4) * 33.333}%` }} />;
  return <img src={src} className="h-full w-full object-cover saturate-150" alt="" />;
}

function Studio({ photos, photo, setPhoto, modes, onBack, onPaywall, runAI, onSaved }: {
  photos: Photo[]; photo: Photo | null; setPhoto: (p: Photo | null) => void; modes: AIMode[]; onBack: () => void; onPaywall: () => void;
  runAI: (src: string, prompt: string, label: string, original?: string) => Promise<Photo | null>; onSaved: () => void;
}) {
  const [tab, setTab] = useState<"ai" | "filters" | "adjust" | "crop">("ai");
  const [cat, setCat] = useState("الكل");
  const [crop, setCrop] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [flip, setFlip] = useState({ x: false, y: false });
  const [adj, setAdj] = useState<Adj>(ADJ0);
  const [active, setActive] = useState<(typeof ADJ)[number]["k"]>("exposure");
  const [busy, setBusy] = useState(false);
  const [ad, setAd] = useState<null | (() => void)>(null);
  const [left, setLeft] = useState(DAILY_TRIALS);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setLeft(trialsLeft()), [ad]);
  const cats = ["الكل", ...CATEGORIES.filter((c) => modes.some((m) => m.category === c)), ...[...new Set(modes.map((m) => m.category))].filter((c) => !CATEGORIES.includes(c))];

  if (!photo) {
    return (
      <div className="h-full overflow-y-auto pb-20" dir="rtl">
        <div className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3">
          <button onClick={onBack} className="glass grid size-10 place-items-center rounded-full"><ChevronLeft className="size-5 rotate-180" /></button>
          <h1 className="text-[17px] font-semibold">اختر صورة</h1>
          <button onClick={() => fileRef.current?.click()} className="text-sm text-primary">من الجهاز</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const r = new FileReader();
          r.onload = async () => setPhoto({ id: uid(), src: await render(r.result as string), createdAt: Date.now() });
          r.readAsDataURL(f);
        }} />
        {photos.length === 0 && <p className="mt-32 text-center text-muted-foreground">المعرض فارغ — ارفع صورة من جهازك</p>}
        <div className="grid grid-cols-3 gap-[3px] p-[3px]">
          {photos.filter((p) => !p.pending).map((p) => (
            <button key={p.id} onClick={() => setPhoto(p)} className="aspect-square overflow-hidden rounded-[6px]"><img src={p.src} className="h-full w-full object-cover" alt="" /></button>
          ))}
        </div>
      </div>
    );
  }

  const reset = () => { setCrop(0); setRotate(0); setFlip({ x: false, y: false }); setAdj(ADJ0); };
  const applyEffect = (m: AIMode) => {
    const go = async () => { setBusy(true); const res = await runAI(photo.src, m.prompt, m.name, photo.src); setBusy(false); if (res) setPhoto(res); };
    if (isPro()) return go();
    if (trialsLeft() <= 0) return onPaywall();
    setAd(() => () => { consumeTrial(); go(); });
  };
  const saveManual = async () => {
    const out = await render(photo.src, { crop, rotate, flipX: flip.x, flipY: flip.y, filter: cssOf(adj), vignette: adj.vignette }, 2048);
    const p: Photo = { id: uid(), src: out, original: photo.src, createdAt: Date.now(), label: "معدّلة" };
    await savePhoto(p); onSaved(); setPhoto(p); reset();
    toast.success("تم الحفظ في المعرض");
  };
  const cur = ADJ.find((a) => a.k === active)!;
  const shown = modes.filter((m) => cat === "الكل" || m.category === cat);

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)] pb-2">
        <button onClick={() => { reset(); setPhoto(null); }} className="glass rounded-full px-4 py-2 text-sm">إلغاء</button>
        <button onClick={onPaywall} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
          {isPro() ? <><Crown className="size-3.5 text-primary" /> Pro</> : <>متبقي اليوم {left}/{DAILY_TRIALS}</>}
        </button>
        <button onClick={saveManual} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">تم</button>
      </div>

      <div className="relative grid flex-1 place-items-center overflow-hidden p-4">
        <div className="relative max-h-full max-w-full overflow-hidden rounded-2xl transition-all duration-500 ease-ios"
          style={{ ...(crop ? { aspectRatio: String(crop), height: crop < 1 ? "100%" : undefined, width: crop >= 1 ? "100%" : undefined } : {}), transform: `rotate(${rotate}deg) scale(${flip.x ? -1 : 1}, ${flip.y ? -1 : 1})` }}>
          <img src={photo.src} style={{ filter: cssOf(adj) }} className={`h-full w-full ${crop ? "object-cover" : "max-h-[55vh] object-contain"} ${busy ? "scale-105 blur-md" : ""} transition`} alt="" />
          {adj.vignette > 0 && <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 ${adj.vignette * 2}px ${adj.vignette}px oklch(0 0 0 / ${adj.vignette / 100})` }} />}
          {busy && <div className="shimmer absolute inset-0 grid place-items-center"><span className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">جاري المعالجة…</span></div>}
        </div>
      </div>

      <div key={tab} className="pop-in min-h-[170px] px-3">
        {tab === "ai" && (
          <>
            <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1 text-xs transition ease-ios ${cat === c ? "bg-foreground text-background" : "glass text-muted-foreground"}`}>{c}</button>)}
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none]">
              {shown.map((m) => (
                <button key={m.id} disabled={busy} onClick={() => applyEffect(m)} className="flex shrink-0 flex-col items-center gap-1.5 disabled:opacity-40">
                  <span className="glass block size-[76px] overflow-hidden rounded-2xl p-0 transition ease-ios active:scale-90"><Thumb m={m} src={photo.src} /></span>
                  <span className="w-[76px] truncate text-center text-[11px] text-muted-foreground">{m.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {tab === "filters" && (
          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-2 [scrollbar-width:none]">
            {PRESETS.map((p) => {
              const a = { ...ADJ0, ...p.a };
              const on = JSON.stringify(a) === JSON.stringify(adj);
              return (
                <button key={p.l} onClick={() => setAdj(a)} className="flex shrink-0 flex-col items-center gap-1.5">
                  <span className={`block size-[72px] overflow-hidden rounded-2xl border-2 transition ease-ios ${on ? "border-primary" : "border-transparent"}`}><img src={photo.src} style={{ filter: cssOf(a) }} className="h-full w-full object-cover" alt="" /></span>
                  <span className={`text-[11px] ${on ? "text-primary" : "text-muted-foreground"}`}>{p.l}</span>
                </button>
              );
            })}
          </div>
        )}
        {tab === "adjust" && (
          <div className="pt-1">
            <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none]">
              {ADJ.map((a) => (
                <button key={a.k} onClick={() => setActive(a.k)} className="flex shrink-0 flex-col items-center gap-1">
                  <span className={`grid size-12 place-items-center rounded-full border text-[11px] tabular-nums transition ease-ios ${active === a.k ? "border-primary text-primary" : "border-glass-border text-muted-foreground"}`}>{adj[a.k] - a.d}</span>
                  <span className="text-[10px] text-muted-foreground">{a.l}</span>
                </button>
              ))}
            </div>
            <input type="range" min={cur.min} max={cur.max} value={adj[cur.k]} onChange={(e) => setAdj({ ...adj, [cur.k]: +e.target.value })} onDoubleClick={() => setAdj({ ...adj, [cur.k]: cur.d })} className="w-full accent-primary" />
          </div>
        )}
        {tab === "crop" && (
          <div className="space-y-3 pt-2">
            <div className="flex justify-center gap-3">
              {([[RotateCw, "تدوير", () => setRotate((r) => r + 90)], [FlipHorizontal, "عكس أفقي", () => setFlip((f) => ({ ...f, x: !f.x }))], [FlipVertical, "عكس رأسي", () => setFlip((f) => ({ ...f, y: !f.y }))], [X, "إعادة", reset]] as const).map(([I, l, fn]) => (
                <button key={l} onClick={fn} className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground"><span className="glass grid size-11 place-items-center rounded-full"><I className="size-5 text-foreground" /></span>{l}</button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {CROPS.map((c) => <button key={c.l} onClick={() => setCrop(c.v)} className={`shrink-0 rounded-full px-4 py-2 text-sm transition ease-ios ${crop === c.v ? "bg-primary text-primary-foreground" : "glass"}`}>{c.l}</button>)}
            </div>
          </div>
        )}
      </div>

      <div className="glass-strong mx-auto mb-[max(env(safe-area-inset-bottom),18px)] flex gap-1 rounded-full p-1.5">
        {([["ai", "ذكاء", Sparkles], ["filters", "فلاتر", Palette], ["adjust", "ضبط", SlidersHorizontal], ["crop", "قص", Crop]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all duration-300 ease-ios ${tab === k ? "bg-glass-strong text-primary" : "text-muted-foreground"}`}><I className="size-4" />{l}</button>
        ))}
      </div>

      {ad && <AdModal onDone={() => { const f = ad; setAd(null); f(); }} onCancel={() => setAd(null)} />}
    </div>
  );
}

/* ---------------- Ad ---------------- */
function AdModal({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [t, setT] = useState(5);
  useEffect(() => { if (t <= 0) return; const id = setTimeout(() => setT(t - 1), 1000); return () => clearTimeout(id); }, [t]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-scrim p-6 backdrop-blur-xl" dir="rtl">
      <div className="glass-strong pop-in w-full max-w-sm rounded-[2rem] p-6 text-center">
        <p className="text-xs text-muted-foreground">إعلان</p>
        <div className="my-5 grid aspect-video place-items-center rounded-2xl bg-muted"><span className="text-4xl">📺</span></div>
        <p className="text-sm">شاهد الإعلان لفتح تجربة مجانية</p>
        {t > 0 ? (
          <div className="mt-5 flex items-center justify-between">
            <button onClick={onCancel} className="text-sm text-muted-foreground">إلغاء</button>
            <span className="glass rounded-full px-4 py-2 text-sm tabular-nums">{t} ث</span>
          </div>
        ) : <button onClick={onDone} className="mt-5 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">متابعة</button>}
      </div>
    </div>
  );
}

