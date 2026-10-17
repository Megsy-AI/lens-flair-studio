import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/dodo-webhook')({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env['DODO_WEBHOOK_SECRET'];
      if (!secret) return new Response('Webhook not configured', { status: 503 });
      try {
        const raw = await request.text();
        if (raw.length > 100000) return new Response('Too large', { status: 413 });
        const { Webhook } = await import('standardwebhooks');
        const p = new Webhook(secret).verify(raw, {
          'webhook-id': request.headers.get('webhook-id') ?? '',
          'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
          'webhook-signature': request.headers.get('webhook-signature') ?? '',
        });
        const body = z.object({ type: z.string(), data: z.object({ metadata: z.object({ lumen_order: z.string().uuid() }).optional() }).passthrough() }).parse(p);
        if (body.data.metadata?.lumen_order) {
          const { reconcileOrder } = await import('@/lib/payments.server');
          await reconcileOrder(body.data.metadata.lumen_order, { dodoKey: process.env['DODO_API_KEY'] });
        }
        return new Response('ok');
      } catch { return new Response('Invalid signature or payload', { status: 401 }); }
    },
  } },
});