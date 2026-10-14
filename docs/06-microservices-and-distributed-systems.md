[Repository home](../README.md) · [Previous chapter](05-jpa-and-hibernate.md) · [Next chapter](07-kafka.md)

## 6. Microservices and distributed systems

### Concepts

#### Decomposition

Decompose around business capabilities and ownership, not database tables. A plausible compliance architecture separates ingestion, restriction enrichment, decision/query APIs, and downstream delivery—only if independent scaling, release, or ownership justifies those boundaries.

A modular monolith is valid when service overhead outweighs those benefits.

| Concern | Interview-ready explanation |
|---|---|
| API gateway | Routing, coarse authentication, rate limiting, request limits; avoid centralizing all business logic |
| Discovery | Kubernetes Service/DNS or a registry in other environments |
| Timeouts | Bound each dependency call and the total request deadline |
| Circuit breaker | Stop repeated calls to an unhealthy dependency |
| Bulkhead | Limit resource consumption by one dependency |
| Retry | Bounded, jittered, and safe only with idempotency |
| Tracing | Propagate trace context across HTTP and Kafka; link asynchronous work |
| Observability | Combine logs, metrics, traces, and business correctness signals |

#### Circuit breaker

Closed allows calls. Open rejects calls. Half-open allows limited probes. Recovery depends on the probe results and configured thresholds; a breaker is neither a retry mechanism nor a concurrency limiter.

```yaml
resilience4j:
  circuitbreaker:
    instances:
      restrictionLookup:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 20
        minimumNumberOfCalls: 10
        failureRateThreshold: 50
        slowCallRateThreshold: 50
        slowCallDurationThreshold: 800ms
        waitDurationInOpenState: 10s
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: false
```

These are practice values, not universal production settings. Configure HTTP timeouts separately, decide which exceptions count as failures, and consider how retries affect the breaker’s samples. See [Resilience4j circuit breaker documentation](https://resilience4j.readme.io/docs/circuitbreaker).

#### Saga

| Orchestration | Choreography |
|---|---|
| Coordinator issues commands and tracks state | Services react to events |
| Easier workflow visibility | Lower central coordination |
| Coordinator must be durable and recoverable | Event chains can become difficult to understand |
| Good for explicit multi-step financial workflows | Good for limited, loosely coupled workflows |

A compensation is a new business action, not a database rollback across services. A payment authorization can be voided; a settled payment may require a refund.

#### Outbox and idempotency

Write business state and an outbox row in one local database transaction. A relay or CDC process publishes the event later. Publishing and then crashing before marking the row can produce duplicates; consumers still need deduplication.

For incoming commands, scope an idempotency key to the tenant/client and operation. Store a request hash and result; enforce uniqueness in the database. Reject the same key used with a different payload.

```java
record PaymentCommand(
        String idempotencyKey,
        String accountId,
        long amountPaise) {}

@Service
class PaymentApplicationService {
    private final PaymentRepository payments;
    private final OutboxRepository outbox;

    PaymentApplicationService(
            PaymentRepository payments,
            OutboxRepository outbox) {
        this.payments = payments;
        this.outbox = outbox;
    }

    @Transactional
    public void accept(PaymentCommand command) {
        // Repository insert must enforce a UNIQUE scoped idempotency key.
        // Duplicate-request resolution belongs at a deliberate boundary.
        Payment payment = payments.insertPending(command);

        outbox.insert(
                payment.id(),
                "PaymentAccepted",
                payment.toEventJson());
    }
}
```

For consumer side effects, a unique processed-event marker and database changes should commit in the same transaction. An external payment call needs the provider’s idempotency mechanism too.

#### CAP and eventual consistency

CAP concerns behavior during a network partition: both linearizable consistency and availability for every request cannot be guaranteed simultaneously.

Eventual consistency says replicas converge if updates stop and propagation succeeds. It does not automatically provide read-your-writes, bounded staleness, or monotonic reads.

In compliance workflows, define how stale restrictions affect decisions. Returning “allowed” because a lookup timed out is usually an unacceptable fallback.

### Tailored extensions

**React/TypeScript:** Explain typed API contracts, server versus local state, request cancellation, stale response prevention, stable list keys, accessibility, and measured optimization. Keep secrets and authorization decisions out of the frontend.

**GenAI:** Prepare a small compliance-document RAG demo: ingestion → chunking → embeddings → filtered retrieval → model response with citations. Discuss document-level access controls, prompt injection, freshness, evaluation sets, latency, and cost. Describe Spring AI as exploration unless you have delivered it; use deterministic rules for actual trading restrictions.

### Interview questions and answers

**Does outbox guarantee exactly-once delivery?**  
No. It closes the database-write/publication gap, but relays can publish duplicates.

**Why are retries dangerous for payments?**  
A timeout does not reveal whether the remote payment succeeded. Use idempotency and status reconciliation before creating another charge.

**How do you debug an asynchronous failure?**  
Follow event ID, aggregate ID, trace context, processing attempt, consumer lag, and downstream status. Avoid relying only on a synchronous HTTP trace.

---
