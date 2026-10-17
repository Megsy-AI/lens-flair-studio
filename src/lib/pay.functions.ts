import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { MONTHLY_USD_CENTS, DODO_MONTHLY_PRODUCT, PAYMENT_METHODS, providerFor } from "./payment-rules";

const device = z.string().regex(/^[a-f0-9]{64}$/);

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ device: device, method: z.enum(PAYMENT_METHODS) }).parse(d))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { paymentDb, deviceHash, dodoBase } = await import('./payments.server');
    const provider = providerFor(data.method);
    const key = provider === 'dodo' ? process.env['DODO_API_KEY'] : process.env['KASHIER_API_KEY'];
    const secret = process.env['KASHIER_API_SECRET'];
    const merchantId = process.env['KASHIER_MERCHANT_ID'];
    if (!key || (provider === 'kashier' && (!secret || !merchantId))) return { error: 'وسيلة الدفع غير متاحة حالياً' };
    const db = await paymentDb();
    const hash = deviceHash(data.device);
    const { count } = await db.from('lumen_payment_orders').select('id', { count: 'exact', head: true }).eq('device_hash', hash).gte('created_at', new Date(Date.now() - 3600000).toISOString());
    if ((count ?? 0) >= 10) return { error: 'طلبات كثيرة؛ جرّب بعد شوية' };
    const { data: order, error } = await db.from('lumen_payment_orders').insert({ device_hash: hash, provider, amount: MONTHLY_USD_CENTS, currency: 'USD' }).select('id').single();
    if (error || !order) return { error: 'تعذر تجهيز طلب الدفع' };
    const requestUrl = new URL(getRequest().url);
    const origin = ['localhost', '127.0.0.1'].includes(requestUrl.hostname) ? 'https://project--8be0a869-847d-45f9-911e-6a5a4ccc1fa2-dev.lovable.app' : requestUrl.origin;
    try {
      const r = await fetch(provider === 'dodo' ? `${dodoBase}/checkouts` : 'https://api.kashier.io/v3/payment/sessions', {
        method: 'POST', headers: provider === 'dodo' ? { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } : { Authorization: secret ?? '', 'api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(provider === 'dodo' ? {
          product_cart: [{ product_id: DODO_MONTHLY_PRODUCT, quantity: 1 }], return_url: `${origin}/pay-done`, metadata: { lumen_order: order.id },
          allowed_payment_method_types: data.method === 'apple' ? ['apple_pay'] : data.method === 'google' ? ['google_pay'] : undefined,
        } : {
          expireAt: new Date(Date.now() + 3600000).toISOString(), maxFailureAttempts: 3, paymentType: 'credit', amount: '3.00', currency: 'USD', order: order.id, merchantId,
          merchantRedirect: `${origin}/pay-done`, serverWebhook: `${origin}/api/public/kashier-webhook`, display: 'ar', type: 'one-time', enable3DS: true,
          allowedMethods: data.method === 'vodafone' ? 'wallet' : 'card', defaultMethod: data.method === 'vodafone' ? 'wallet' : 'card', description: 'Lumen Pro - one month', metaData: { lumen_order: order.id }, customer: { reference: order.id },
        }), signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) return { error: data.method === 'vodafone' ? 'كاشير لم يقبل الدفع بالمحفظة بالدولار؛ جرّب بطاقة أو وسيلة أخرى' : 'شركة الدفع لم تقبل الطلب؛ راجع تفعيل حساب التاجر' };
      const c = await r.json() as { sessionUrl?: string; _id?: string; checkout_url?: string; session_id?: string };
      const url = provider === 'dodo' ? c.checkout_url : c.sessionUrl;
      const id = provider === 'dodo' ? c.session_id : c._id;
      if (!url || !id || !/^https:\/\//.test(url)) return { error: 'لم يتم تجهيز صفحة الدفع' };
      const saved = await db.from('lumen_payment_orders').update({ provider_session: id }).eq('id', order.id);
      if (saved.error) return { error: 'تعذر حفظ طلب الدفع' };
      return { url, orderId: order.id, provider };
    } catch { return { error: 'تعذر الاتصال بشركة الدفع' }; }
  });

export const verifyDeviceSubscription = createServerFn({ method: 'POST' })
  .inputValidator(d => z.object({ device, orderId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { paymentDb, deviceHash, reconcileOrder } = await import('./payments.server');
    const db = await paymentDb();
    const hash = deviceHash(data.device);
    if (data.orderId) {
      const { data: owned } = await db.from('lumen_payment_orders').select('id').eq('id', data.orderId).eq('device_hash', hash).maybeSingle();
      if (!owned) return { active: false, expiresAt: null };
      await reconcileOrder(owned.id, { kashierSecret: process.env['KASHIER_API_SECRET'], dodoKey: process.env['DODO_API_KEY'] }).catch(() => false);
    }
    const { data: paid } = await db.from('lumen_payment_orders').select('expires_at').eq('device_hash', hash).eq('status', 'paid').gt('expires_at', new Date().toISOString()).order('expires_at', { ascending: false }).limit(1).maybeSingle();
    return { active: !!paid, expiresAt: paid?.expires_at ?? null };
  });
