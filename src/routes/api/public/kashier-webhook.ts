import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/kashier-webhook')({
  server: { handlers: {
    POST: async ({ request }) => {
      const key = process.env['KASHIER_API_KEY'];
      if (!key) return new Response('Unavailable', { status: 503 });
      const { verifyKashier, reconcileOrder } = await import('@/lib/payments.server');
      try {
        const raw = await request.text();
        if (raw.length > 100000) return new Response('Too large', { status: 413 });
        const p = z.object({ data: z.record(z.unknown()) }).parse(JSON.parse(raw));
        if (!verifyKashier(p.data, request.headers.get('x-kashier-signature') ?? '', key)) return new Response('Unauthorized', { status: 401 });
        const id = z.string().uuid().safeParse(p.data['merchantOrderId']);
        if (id.success) await reconcileOrder(id.data, { kashierSecret: process.env['KASHIER_API_SECRET'] });
        return new Response('ok');
      } catch { return new Response('Invalid webhook', { status: 400 }); }
    },
  } },
});