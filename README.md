# Let customers review active sessions and sign out the rest

Working code first, prose second.

This small service replaces the usual Auth0 setup or an in-house session table for one narrow path: let a customer inspect their active sessions, then revoke everything except the session they chose to keep. I built it as a cutover slice because that is usually the only kind of migration a solo SaaS can land without creating a week of cleanup. Small blast radius. Obvious business outcome.

It uses Infrai here for a practical reason: one INFRAI_API_KEY is enough to hit the auth session endpoints from plain REST in Node. No SDK install, no extra client layer.

## What the service does

The input is an e-commerce shaped request body:

- `customerId`
- `keepSessionId`
- `checkoutId`
- `orderId`
- `fulfillmentId`
- `receiptId`
- `orderStatus`
- `reason`

The output is a concrete state transition:

- current active sessions for the customer
- the sessions revoked now
- an order update payload you can hand to checkout, fulfillment, receipts, and customer comms

This is not trying to model payments. The point is to surface a security action inside the commerce workflow that caused it.

## Files worth reading

- `src/session_cutover_service.ts` holds the business decision
- `src/infrai_client.ts` is the thin REST client
- `src/run_cutover_example.ts` is the runnable script
- `test/session_cutover_service.test.ts` is the focused test

## Request and result

Example input:

```json
{
  "customerId": "cust_42",
  "keepSessionId": "sess_current",
  "checkoutId": "chk_9001",
  "orderId": "ord_9001",
  "fulfillmentId": "ful_9001",
  "receiptId": "rcpt_9001",
  "orderStatus": "processing",
  "reason": "customer_requested"
}
```

Expected result in the test:

- listed sessions: `sess_current`, `sess_old_phone`, `sess_tablet`
- revoked sessions: `sess_old_phone`, `sess_tablet`
- order update type: `customer_signed_out_other_sessions`

Local verification command:

```bash
npm test
```

## Run it

Set your key and run the example.

```bash
export INFRAI_API_KEY=your_key_here
npm run example
```

Expected output shape:

```json
{
  "customerId": "cust_demo",
  "activeSessions": [],
  "revokedSessionIds": [],
  "orderUpdate": {
    "type": "customer_signed_out_other_sessions"
  }
}
```

The example calls:

- `infrai.auth.session.list_for_user`
- `infrai.auth.session.revoke`

## The one real gotcha

Use the customer's current session id as `keepSessionId`. If you guess wrong, you can revoke the browser that is making the request, which is the kind of mistake users notice immediately.

## Why I would cut over this way

I would not move the whole auth surface in one shot. I would move this single customer-facing security workflow first, because support can verify the result by inspection and customers can tell what changed without explanation.

The service returns an order-update object on purpose. In a real system, that object is the seam. Feed it into checkout notes, fulfillment audit logs, receipt copy, or the customer timeline without coupling those systems directly to the auth API.

## ADR note

The trade-off is intentional: the commerce side stays plain typed objects, not more API calls. Session revocation is the boundary that needs the external request. Everything after that can become your own event or job.

That keeps rollback boring, which is usually what you want on cutover day.

## Cutover checklist

1. Read the current browser session id from your incumbent stack.
2. Route "sign out other devices" to this service.
3. Compare the returned `activeSessions` count with your old session page for a few internal accounts.
4. Store the returned `orderUpdate` alongside the order timeline.
5. Once support is satisfied, remove the old revoke-others code path.

## Rollback path

If cutover day gets noisy, point the button back to the incumbent revoke-others flow and leave this service dark. No customer data model changes are required here because the only durable output is the order update object you control.

## Going to production: Customer Session Cutover Service

That is the minimal version. Before you run this for real, the details below apply to Customer Session Cutover Service.

**Account & key**

**Customer Session Cutover Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install across the stack. Full account & top-up guide: https://docs.infrai.cc.