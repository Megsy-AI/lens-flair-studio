import { describe, it, expect } from 'vitest';
import { MONTHLY_USD_CENTS, matchesPayment, providerFor, monthExpiry } from '@/lib/payment-rules';
import { verifyKashier, deviceHash } from '@/lib/payments.server';
import { createHmac } from 'node:crypto';

describe('Device subscriptions', () => {
  it('charges the requested monthly price of exactly 3 USD', () => {
    expect(MONTHLY_USD_CENTS).toBe(300);
    expect(matchesPayment(300, 'USD')).toBe(true);
    expect(matchesPayment(300, 'EGP')).toBe(false);
    expect(matchesPayment(299, 'USD')).toBe(false);
  });
  it.each(['visa', 'mastercard', 'vodafone'] as const)('routes %s to Kashier', method => expect(providerFor(method)).toBe('kashier'));
  it.each(['apple', 'google', 'other'] as const)('routes %s to Dodo', method => expect(providerFor(method)).toBe('dodo'));
  it('isolates two devices', () => expect(deviceHash('device-a')).not.toBe(deviceHash('device-b')));
  it('gives one calendar month, clamping month-end dates', () => expect(monthExpiry(new Date('2026-01-31T12:00:00Z'))).toBe('2026-02-28T12:00:00.000Z'));
  it('rejects forged signatures and tampered amounts', () => {
    const d = { signatureKeys: ['status', 'amount', 'currency', 'merchantOrderId'], status: 'SUCCESS', amount: '3.00', currency: 'USD', merchantOrderId: 'order' };
    const key = 'unit-test-only';
    const sig = createHmac('sha256', key).update('amount=3.00&currency=USD&merchantOrderId=order&status=SUCCESS').digest('hex');
    expect(verifyKashier(d, sig, key)).toBe(true);
    expect(verifyKashier({ ...d, amount: '0.01' }, sig, key)).toBe(false);
    expect(verifyKashier(d, 'invalid', key)).toBe(false);
  });
});