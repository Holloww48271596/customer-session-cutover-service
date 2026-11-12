import { z } from 'zod';
import { InfraiClient } from './infrai_client.ts';

export const signOutOtherSessionsSchema = z.object({
  customerId: z.string().min(1),
  keepSessionId: z.string().min(1),
  checkoutId: z.string().min(1),
  orderId: z.string().min(1),
  fulfillmentId: z.string().min(1),
  receiptId: z.string().min(1),
  orderStatus: z.string().min(1),
  reason: z.enum(['customer_requested', 'suspicious_activity', 'support_reset'])
});

export type SignOutOtherSessionsInput = z.infer<typeof signOutOtherSessionsSchema>;

export type CustomerSessionSummary = {
  sessionId: string;
  isCurrent: boolean;
};

export type CustomerOrderUpdate = {
  type: 'customer_signed_out_other_sessions';
  checkoutId: string;
  orderId: string;
  fulfillmentId: string;
  receiptId: string;
  orderStatus: string;
  reason: SignOutOtherSessionsInput['reason'];
  keptSessionId: string;
  revokedSessionIds: string[];
};

export type SignOutOtherSessionsResult = {
  customerId: string;
  activeSessions: CustomerSessionSummary[];
  revokedSessionIds: string[];
  orderUpdate: CustomerOrderUpdate;
};

function pickSessionId(session: unknown): string | null {
  if (!session || typeof session !== 'object') return null;
  const value = (session as Record<string, unknown>).session_id;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function signOutOtherSessions(
  infrai: InfraiClient,
  rawInput: unknown
): Promise<SignOutOtherSessionsResult> {
  const input = signOutOtherSessionsSchema.parse(rawInput);

  const listedSessions = await infrai.auth.session.list_for_user(input.customerId);

  const activeSessions = listedSessions
    .map((session) => pickSessionId(session))
    .filter((sessionId): sessionId is string => sessionId !== null)
    .map((sessionId) => ({
      sessionId,
      isCurrent: sessionId === input.keepSessionId
    }));

  const revokedSessionIds: string[] = [];

  for (const session of activeSessions) {
    if (session.sessionId === input.keepSessionId) continue;
    await infrai.auth.session.revoke(session.sessionId);
    revokedSessionIds.push(session.sessionId);
  }

  return {
    customerId: input.customerId,
    activeSessions,
    revokedSessionIds,
    orderUpdate: {
      type: 'customer_signed_out_other_sessions',
      checkoutId: input.checkoutId,
      orderId: input.orderId,
      fulfillmentId: input.fulfillmentId,
      receiptId: input.receiptId,
      orderStatus: input.orderStatus,
      reason: input.reason,
      keptSessionId: input.keepSessionId,
      revokedSessionIds
    }
  };
}
