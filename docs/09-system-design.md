[Repository home](../README.md) · [Previous chapter](08-cloud-and-devops.md) · [Next chapter](10-coding-patterns.md)

## 9. System design: five practice problems

Use this interview sequence: **requirements → estimates → API/data model → architecture → failure handling → trade-offs → observability.**

The numbers below are practice assumptions, not claims about your employers.

### 1. Payment processing service

**Requirements**

- Accept payments, expose status, process provider callbacks.
- Prevent duplicate charges.
- Support refunds and reconciliation.
- Practice scale: 100 requests/second; provider response time dominates.

**High-level design**

Client → gateway → payment service → PostgreSQL. Persist `PENDING` plus an outbox event. A worker calls the provider using a stable idempotency key. Webhooks and reconciliation jobs update the payment state.

Core fields: payment ID, tenant, request key/hash, amount/currency, provider reference, state, version, timestamps.

**Trade-offs**

- Asynchronous acceptance improves resilience but requires pending-state UX.
- A database transaction protects local state, not the provider call.
- Ledger entries should preserve financial history rather than overwrite it.
- Provider timeouts require an `UNKNOWN`/reconciliation path.

**Follow-up questions and answers**

**What if the provider charges but your service times out?**  
Query/reconcile using the provider reference or idempotency key; do not blindly charge again.

**What if two identical requests arrive simultaneously?**  
Use a database uniqueness constraint and return the established result.

**What if webhook events arrive out of order?**  
Deduplicate them and validate permitted state transitions; use provider sequencing where available.

---

### 2. Distributed rate limiter

**Requirements**

- Per-user and per-tenant limits.
- Return `429` with retry guidance.
- Practice scale: 20,000 requests/second across gateway instances.

**High-level design**

Gateways execute an atomic Redis operation implementing token bucket or a sliding-window policy. Key by trusted tenant/user identity. Track tokens and last refill time; apply TTLs.

**Trade-offs**

- Token bucket permits controlled bursts.
- Fixed windows are simpler but allow boundary bursts.
- Exact sliding logs use more memory.
- Per-region limits improve latency but weaken global exactness.
- Fail-open preserves access; fail-closed protects downstream capacity.

**Follow-up questions and answers**

**Why is read-then-write unsafe?**  
Concurrent gateways can approve the same remaining capacity; use atomic server-side execution.

**What if Redis is unavailable?**  
Choose a documented failure policy and possibly a conservative local fallback.

**What about hot keys?**  
A large tenant can create contention; hierarchical limits or allocated regional quotas can help.

---

### 3. Notification system

**Requirements**

- Email, SMS, and push.
- Preferences, priority, retries, auditability.
- Practice scale: one million notifications/day with bursts.

**High-level design**

Producer → notification API/outbox → queue or Kafka → channel workers → providers. Persist request and delivery attempts. Apply preference checks and deduplication before sending.

**Trade-offs**

- Separate channel queues isolate slow providers.
- “Provider accepted” differs from “delivered” and “read.”
- Retries can duplicate messages if providers lack idempotency.
- Strict ordering can reduce throughput.

**Follow-up questions and answers**

**How do you stop a retry storm?**  
Backoff with jitter, attempt limits, rate limits, and circuit breakers.

**How do you respect an opt-out?**  
Recheck preferences near delivery for nonmandatory notifications.

**What happens to a poison message?**  
Send it to a DLT with metadata and support controlled replay.

---

### 4. Trading order-status tracker

**Requirements**

- Track received, accepted, partially filled, filled, cancelled, and rejected orders.
- Support live UI updates and reconnect.
- Handle duplicate, delayed, and out-of-order events.
- Practice scale: 10,000 events/second.

**High-level design**

Order events → Kafka keyed by order ID → projection consumer → PostgreSQL/read cache → REST snapshot plus SSE or WebSocket updates.

Store event ID, source sequence/version, cumulative filled quantity, current status, and last applied position. Preserve an audit history.

**Trade-offs**

- Materialized views make reads fast but can lag.
- Kafka partition ordering cannot fix upstream events that were already emitted out of order.
- SSE is simpler for server-to-browser updates; WebSocket supports bidirectional interaction.
- Cancellation requests and execution reports can race.

**Follow-up questions and answers**

**How do you stop a filled order becoming accepted again?**  
Validate sequence/version and state-transition rules rather than accepting every latest arrival.

**How does the UI reconnect safely?**  
Fetch a snapshot and resume from an appropriate cursor/version, reconciling any overlap.

**How do you show stale data?**  
Expose update timestamps and projection lag rather than silently displaying it as current.

---

### 5. URL shortener

**Requirements**

- Create short links, redirect, expire links, and collect analytics.
- Practice scale: 100 creations/second and 10,000 redirects/second.

**High-level design**

API → code generator → database with unique code constraint. Redirect service uses a cache. Analytics flow asynchronously to a stream.

**Trade-offs**

- Base62 IDs are compact but may be enumerable.
- Random codes need collision detection.
- `301` can be cached aggressively; `302` better supports changeable destinations.
- Analytics should not block redirects.

**Follow-up questions and answers**

**What if two requests generate the same code?**  
The unique constraint rejects one; retry generation.

**How do you invalidate an expired link?**  
Use bounded cache TTLs or explicit invalidation and enforce expiration at read time.

**How do you prevent unsafe destinations?**  
Validate schemes, enforce abuse policy, and separate scanning from the redirect critical path.

### Small API shape to practice

```java
record CreatePaymentRequest(
        String accountId,
        long amountPaise,
        String currency) {}

record PaymentStatusResponse(
        String paymentId,
        String status,
        String updatedAt) {}
```

For every design, explicitly name the invariant. Examples: “one idempotency key represents one request” and “cumulative filled quantity never decreases.”

---
