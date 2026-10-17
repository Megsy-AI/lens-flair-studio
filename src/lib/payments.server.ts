import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { matchesPayment, monthExpiry } from "./payment-rules";

export const deviceHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const dodoBase = "https://live.dodopayments.com";
export async function paymentDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
export function verifyKashier(data: Record<string, unknown>, signature: string, key: string) {
  const keys = data['signatureKeys'];
  if (!Array.isArray(keys) || !['amount', 'currency', 'merchantOrderId', 'status'].every(k => keys.includes(k))) return false;
  if (!keys.every(k => typeof k === 'string' && ['string', 'number', 'boolean'].includes(typeof data[k]))) return false;
  const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const payload = [...keys].sort().map(k => `${k}=${encode(String(data[k]))}`).join('&');
  const expected = createHmac('sha256', key).update(payload).digest('hex');
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
export async function reconcileOrder(orderId: string, credentials: { kashierSecret?: string | undefined; dodoKey?: string | undefined }) {
  const db = await paymentDb();
  const { data: order } = await db.from('lumen_payment_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order?.provider_session) return false;
  if (order.provider === 'kashier' && credentials.kashierSecret) {
    const r = await fetch(`https://api.kashier.io/v3/payment/sessions/${encodeURIComponent(order.provider_session)}/payment`, { headers: { Authorization: credentials.kashierSecret }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return false;
    const result = await r.json() as { data?: { status?: string; amount?: string; currency?: string; merchantOrderId?: string } };
    const d = result.data;
    if (!d || d.status !== 'SUCCESS' || d.merchantOrderId !== order.id || !matchesPayment(Math.round(Number(d.amount) * 100), d.currency ?? '')) return false;
    if (order.status !== 'paid') await db.from('lumen_payment_orders').update({ status: 'paid', expires_at: monthExpiry(new Date()) }).eq('id', order.id).eq('status', 'pending');
    return true;
  }
  if (order.provider === 'dodo' && credentials.dodoKey) {
    const headers = { Authorization: `Bearer ${credentials.dodoKey}` };
    const r = await fetch(`${dodoBase}/checkouts/${encodeURIComponent(order.provider_session)}`, { headers, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return false;
    const session = await r.json() as { payment_id?: string; payment_status?: string };
    if (session.payment_status !== 'succeeded' || !session.payment_id) return false;
    const pr = await fetch(`${dodoBase}/payments/${encodeURIComponent(session.payment_id)}`, { headers, signal: AbortSignal.timeout(20000) });
    if (!pr.ok) return false;
    const p = await pr.json() as { total_amount: number; currency: string; metadata?: { lumen_order?: string }; subscription_id?: string };
    if (p.metadata?.lumen_order !== order.id || !matchesPayment(p.total_amount, p.currency) || !p.subscription_id) return false;
    const sr = await fetch(`${dodoBase}/subscriptions/${encodeURIComponent(p.subscription_id)}`, { headers, signal: AbortSignal.timeout(20000) });
    if (!sr.ok) return false;
    const s = await sr.json() as { status?: string; next_billing_date?: string };
    if (!['active', 'cancelled'].includes(s.status ?? '') || !s.next_billing_date || !Number.isFinite(Date.parse(s.next_billing_date))) return false;
    await db.from('lumen_payment_orders').update({ status: 'paid', expires_at: s.next_billing_date }).eq('id', order.id);
    return Date.parse(s.next_billing_date) > Date.now();
  }
  return false;
}