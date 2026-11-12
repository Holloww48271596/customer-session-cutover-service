import { InfraiClient } from './infrai_client.ts';
import { signOutOtherSessions } from './session_cutover_service.ts';

async function main(): Promise<void> {
  const infrai = new InfraiClient();

  const result = await signOutOtherSessions(infrai, {
    customerId: 'cust_demo',
    keepSessionId: 'sess_demo_current',
    checkoutId: 'chk_demo',
    orderId: 'ord_demo',
    fulfillmentId: 'ful_demo',
    receiptId: 'rcpt_demo',
    orderStatus: 'processing',
    reason: 'customer_requested'
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
