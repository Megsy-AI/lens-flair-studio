import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Check, ChevronLeft, CreditCard, Loader2, Smartphone, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createCheckout, verifyDeviceSubscription } from '@/lib/pay.functions';
import { deviceToken, setPro } from '@/lib/store';
import { type PaymentMethod } from '@/lib/payment-rules';
import paywallBg from '@/assets/paywall.jpg';

const methods: { id: PaymentMethod; name: string; symbol: string }[] = [
  { id: 'visa', name: 'Visa', symbol: 'VISA' },
  { id: 'mastercard', name: 'Mastercard', symbol: 'mastercard' },
  { id: 'vodafone', name: 'Vodafone Cash', symbol: 'vodafone' },
  { id: 'apple', name: 'Apple Pay', symbol: 'apple' },
  { id: 'google', name: 'Google Pay', symbol: 'G Pay' },
  { id: 'other', name: 'طرق أخرى', symbol: 'other' },
];
function MethodIcon({ method }: { method: (typeof methods)[number] }) {
  if (method.id === 'mastercard') return <span className="mastercard-mark flex w-9" aria-hidden><i /><i /></span>;
  if (method.id === 'vodafone') return <Smartphone className="text-destructive" />;
  if (method.id === 'apple') return <Wallet aria-hidden />;
  if (method.id === 'other') return <Wallet />;
  return <span aria-hidden className="text-xs font-bold">{method.symbol}</span>;
}

export function SubscriptionPage({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('visa');
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<{ url: string; orderId: string; provider: string } | null>(null);
  const [error, setError] = useState('');
  const checkout = useServerFn(createCheckout);
  const verify = useServerFn(verifyDeviceSubscription);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!payment) return;
    let stopped = false;
    let checking = false;
    const check = async () => {
      if (checking || stopped) return;
      checking = true;
      try {
        const result = await verify({ data: { device: deviceToken(), orderId: payment.orderId } });
        if (!stopped && result.active) {
          setPro(result.expiresAt);
          localStorage.removeItem('lumen_pending_order');
          toast.success('اشتراكك اتفعّل');
          closeRef.current();
        }
      } catch { /* Retry; provider may still be processing. */ }
      finally { checking = false; }
    };
    const id = setInterval(check, 5000);
    const h = (event: MessageEvent) => {
      if (event.origin === location.origin && event.data?.type === 'lumen-pay-return') check();
    };
    addEventListener('message', h);
    return () => { stopped = true; clearInterval(id); removeEventListener('message', h); };
  }, [payment, verify]);

  useEffect(() => {
    if (payment?.provider !== 'dodo') return;
    let stopped = false;
    let cleanup: (() => void) | undefined;
    import('dodopayments-checkout').then(({ DodoPayments }) => {
      if (stopped) return;
      DodoPayments.Initialize({ mode: 'live', displayType: 'inline', onEvent: () => {} });
      DodoPayments.Checkout.open({ checkoutUrl: payment.url, elementId: 'lumen-dodo-checkout', options: { manualRedirect: true } });
      cleanup = () => DodoPayments.Checkout.close();
    }).catch(() => setError('تعذر فتح الدفع؛ اقفل وجرب تاني'));
    return () => { stopped = true; cleanup?.(); };
  }, [payment]);

  const subscribe = async () => {
    setLoading(true); setError('');
    try {
      const result = await checkout({ data: { device: deviceToken(), method } });
      if ('url' in result && result.url) {
        localStorage.setItem('lumen_pending_order', result.orderId);
        setPayment(result);
      } else setError(result.error ?? 'تعذر بدء الدفع');
    } catch { setError('تعذر بدء الدفع؛ جرّب مرة تانية'); }
    finally { setLoading(false); }
  };
  return (
    <div className="relative h-full overflow-y-auto" dir="rtl">
      <img src={paywallBg} className="pointer-events-none absolute inset-0 h-full w-full object-cover" alt="" />
      <div className="pointer-events-none absolute inset-0 bg-scrim" />
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق الاشتراكات" className="glass absolute left-4 top-[max(env(safe-area-inset-top),14px)] z-10 size-10 rounded-full"><X /></Button>
      <div className="relative mx-auto flex min-h-full max-w-lg flex-col px-5 pb-[max(env(safe-area-inset-bottom),22px)] pt-[calc(max(env(safe-area-inset-top),14px)+54px)]">
        <h1 className="text-center text-4xl font-light" dir="ltr">lumen <span className="rounded-md border border-foreground px-2 text-3xl">pro</span></h1>
        <div className="min-h-10 flex-1" />
        <ul className="mb-5 space-y-2 text-sm font-medium">
          {['تحويلات الذكاء الاصطناعي', 'بدون إعلانات', 'استوديو الصور بالكامل'].map(x => <li key={x} className="flex items-center gap-2"><Check className="size-4" />{x}</li>)}
        </ul>
        <div className="glass flex items-center justify-between rounded-lg px-4 py-3"><div><h2 className="font-semibold">اشتراك شهري</h2><p className="mt-1 text-xs text-muted-foreground">{['apple', 'google', 'other'].includes(method) ? 'يتجدد شهرياً · يمكنك الإلغاء' : 'شهر واحد · بدون تجديد تلقائي'}</p></div><span className="text-3xl font-semibold" dir="ltr">$3<span className="ml-1 text-xs">USD</span></span></div>
        <h2 className="mb-2 mt-4 text-xs font-semibold">طريقة الدفع</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="طريقة الدفع">
          {methods.map(m => <Button variant="ghost" key={m.id} role="radio" aria-checked={method === m.id} aria-label={m.name} onClick={() => { setMethod(m.id); setError(''); }} className={`glass h-14 flex-col gap-1 rounded-lg px-1 text-[10px] ${method === m.id ? 'ring-1 ring-foreground' : 'text-muted-foreground'}`}><MethodIcon method={m} /><span>{m.name}</span></Button>)}
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-background p-3 text-xs text-destructive">{error}</p>}
        <Button onClick={subscribe} disabled={loading} className="mt-4 h-12 w-full rounded-full bg-pro text-base font-semibold text-pro-foreground hover:bg-pro/90">{loading ? <Loader2 className="animate-spin" /> : <>اشترك الآن <ChevronLeft /></>}</Button>
      </div>
      {payment && <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="glass flex shrink-0 items-center justify-between px-4 py-3"><span className="flex items-center gap-2 text-sm font-semibold"><CreditCard />الدفع الآمن · $3 USD</span><Button variant="ghost" size="icon" onClick={() => setPayment(null)} aria-label="إغلاق الدفع"><X /></Button></header>
        {payment.provider === 'dodo' ? <div id="lumen-dodo-checkout" className="min-h-0 flex-1 overflow-y-auto" /> : <iframe src={payment.url} title="الدفع بكاشير" className="min-h-0 w-full flex-1 border-0" allow="payment" />}
      </div>}
    </div>
  );
}