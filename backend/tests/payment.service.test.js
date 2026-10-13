const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const AppError = require('../src/utils/AppError');

function setup({ status = 'succeeded', owner = '129', amount = 2561, intents = [], refunded = false, refundStatus = 'succeeded' } = {}) {
  const calls = [];
  let orderStatus = 'CREATED';
  const intent = { id: 'pi_test', status, metadata: { order_id: owner }, amount: 2561,
    amount_received: amount, currency: 'usd', latest_charge: { refunded } };
  const stripe = {
    paymentIntents: {
      retrieve: async () => intent,
      list: () => (async function* () { yield* intents; })(),
      cancel: async (id) => calls.push(['cancel', id]),
    },
    refunds: { create: async (params, options) => {
      calls.push(['refund', params, options]);
      return { id: 're_test', status: refundStatus, amount: 2561 };
    } },
  };
  const db = { call: async (name, args) => {
    calls.push([name, args]);
    if (name === 'sp_order_mark_paid') orderStatus = 'PAID';
    if (name === 'sp_order_get') return [[{ id: 129, total_amount: '25.61',
      location_id: 1, status_name: orderStatus, fulfillment_type: 'PICKUP', created_at: '2026-10-10T19:32:45Z' }]];
    return [[]];
  } };
  const dependencies = {
    '../../config/stripe': stripe, '../../config/db': db, '../../config/env': {},
    '../../utils/AppError': AppError, '../../sockets': { getIO: () => ({
      of: () => ({ to: () => ({ emit: (event, payload) => calls.push([event, payload]) }) }),
    }) },
    '../delivery/delivery.service': {},
  };
  const context = { module: { exports: {} }, require: (name) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/modules/payment/payment.service'), 'utf8'), context);
  return { service: context.module.exports, calls, intent };
}

test('successful redirect verifies Stripe and records payment', async () => {
  const { service, calls } = setup();
  assert.equal((await service.confirmPayment(129, 'pi_test')).status, 'PAID');
  assert.equal(calls.filter(([name]) => name === 'sp_order_mark_paid').length, 1);
  assert.ok(calls.some(([name, payload]) => name === 'order_paid' && payload.order_id === 129));
});

for (const status of ['processing', 'requires_payment_method', 'canceled']) {
  test(`${status} does not mark the order paid`, async () => {
    const { service, calls } = setup({ status });
    assert.equal((await service.confirmPayment(129, 'pi_test')).status, status);
    assert.equal(calls.length, 0);
  });
}

test('rejects an intent belonging to another order', async () => {
  const { service, calls } = setup({ owner: '130' });
  await assert.rejects(service.confirmPayment(129, 'pi_test'), /does not belong/);
  assert.equal(calls.length, 0);
});

test('rejects a successful charge with the wrong amount', async () => {
  const { service, calls } = setup({ amount: 100 });
  await assert.rejects(service.confirmPayment(129, 'pi_test'), /amount does not match/);
  assert.ok(!calls.some(([name]) => name === 'sp_order_mark_paid'));
});

test('CREATED order refunds an unrecorded successful charge with an idempotency key', async () => {
  const state = setup();
  const { service, calls, intent } = setup({ intents: [state.intent] });
  assert.equal((await service.refundOrder(129, { allowUnpaid: true })).refunds[0].status, 'succeeded');
  assert.ok(calls.some(([name, , options]) => name === 'refund' && options.idempotencyKey.includes(intent.id)));
  assert.ok(calls.some(([name]) => name === 'sp_payment_record'));
});

test('abandoned checkout cancels its intent without refunding', async () => {
  const { intent } = setup({ status: 'requires_payment_method' });
  const { service, calls } = setup({ intents: [intent] });
  assert.equal(await service.refundOrder(129, { allowUnpaid: true }), null);
  assert.ok(calls.some(([name]) => name === 'cancel'));
  assert.ok(!calls.some(([name]) => name === 'refund'));
});

test('processing intent blocks cancellation without moving money', async () => {
  const { intent } = setup({ status: 'processing' });
  const { service, calls } = setup({ intents: [intent] });
  await assert.rejects(service.refundOrder(129, { allowUnpaid: true }), /still processing/);
  assert.ok(!calls.some(([name]) => ['refund', 'cancel'].includes(name)));
});

test('already refunded Stripe charge is recorded without a second refund', async () => {
  const { intent } = setup();
  const { service, calls } = setup({ intents: [intent], refunded: true });
  await service.refundOrder(129, { allowUnpaid: true });
  assert.ok(!calls.some(([name]) => name === 'refund'));
  assert.ok(calls.some(([name]) => name === 'sp_payment_record'));
});

test('failed refund is not recorded as refunded', async () => {
  const { intent } = setup();
  const { service, calls } = setup({ intents: [intent], refundStatus: 'failed' });
  await assert.rejects(service.refundOrder(129, { allowUnpaid: true }), /refund failed/);
  assert.ok(!calls.some(([name]) => name === 'sp_payment_record'));
});
