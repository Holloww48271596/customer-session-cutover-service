import test from 'node:test';
import assert from 'node:assert/strict';
import { signOutOtherSessions } from '../src/session_cutover_service.ts';

class FakeInfraiClient {
  auth = {
    session: {
      list_for_user: async (userId: string) => {
        assert.equal(userId, 'cust_42');
        return [
          { session_id: 'sess_current' },
          { session_id: 'sess_old_phone' },
          { session_id: 'sess_tablet' }
        ];
      },
      revoke: async (sessionId: string) => {
        revoked.push(sessionId);
        return { session_id: sessionId };
      }
    }
  };
}

const revoked: string[] = [];

test('keeps the current session, revokes the others, and returns an order update payload', async () => {
  revoked.length = 0;
  const infrai = new FakeInfraiClient();

  const result = await signOutOtherSessions(infrai as never, {
    customerId: 'cust_42',
    keepSessionId: 'sess_current',
    checkoutId: 'chk_9001',
    orderId: 'ord_9001',
    fulfillmentId: 'ful_9001',
    receiptId: 'rcpt_9001',
    orderStatus: 'processing',
    reason: 'customer_requested'
  });

  assert.deepEqual(result.activeSessions, [
    { sessionId: 'sess_current', isCurrent: true },
    { sessionId: 'sess_old_phone', isCurrent: false },
    { sessionId: 'sess_tablet', isCurrent: false }
  ]);

  assert.deepEqual(revoked, ['sess_old_phone', 'sess_tablet']);
  assert.equal(result.orderUpdate.type, 'customer_signed_out_other_sessions');
  assert.deepEqual(result.orderUpdate.revokedSessionIds, ['sess_old_phone', 'sess_tablet']);
});
