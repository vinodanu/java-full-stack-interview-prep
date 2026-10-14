[Repository home](../README.md)

## Four-week study plan

**Daily budget:** 30 minutes reading, 60 minutes hands-on work, 30 minutes coding-pattern practice, and 15 minutes speaking answers aloud. Use review days for a longer mock.

Build one small **restriction-enrichment demo** throughout the month: REST ingestion, PostgreSQL persistence/outbox, MongoDB lookup data, Kafka events, a React status screen, tests, and deployment manifests. Implement incrementally rather than creating every component on day one.

### Week 1 — Java foundations and coding

| Day | Reading | Hands-on/coding | Mock practice |
|---|---|---|---|
| 1 | Java 17 feature boundaries | Records, sealed results; sliding window | Introduction and Java version questions |
| 2 | HashMap internals | Collision keys and resize experiments; two pointers | Explain `put` using animation |
| 3 | ConcurrentHashMap/JMM | Demonstrate unsafe increment and atomic fix | Visibility versus atomicity |
| 4 | G1/ZGC and profiling | Collect GC logs from an allocation workload | Diagnose a latency spike |
| 5 | SOLID | Refactor one oversized service; fast/slow pointers | One example per principle |
| 6 | Design patterns | Policy strategies, resolver, decorator; BFS/DFS | Pattern trade-offs |
| 7 | Review | Re-solve two missed problems without notes | 45-minute Java/coding mock |

### Week 2 — Spring, persistence, and full stack

| Day | Reading | Hands-on/coding | Mock practice |
|---|---|---|---|
| 8 | Lifecycle and auto-configuration | Inspect bean wiring and conditions | Explain startup and DI |
| 9 | AOP and transactions | Reproduce self-invocation failure, then fix it | Transaction-boundary questions |
| 10 | Propagation and isolation | Verify rollback; compare concurrent updates | REQUIRED versus REQUIRES_NEW |
| 11 | JPA relationships | Owned children, orphan removal, version field | Ownership and cascade |
| 12 | Fetch plans | Reproduce N+1; fix and count SQL | Explain evidence |
| 13 | JWT and React state | Protect endpoint; typed UI with cancellation | Auth flow and frontend performance |
| 14 | Testing | JUnit/Mockito plus Testcontainers; topological sort | 60-minute Spring/JPA mock |

### Week 3 — Kafka and distributed correctness

| Day | Reading | Hands-on/coding | Mock practice |
|---|---|---|---|
| 15 | Kafka fundamentals | Keyed events and two consumer groups | Partition ordering |
| 16 | Offsets and rebalancing | Add/remove consumers; observe replay | Rebalance animation explanation |
| 17 | Retries and DLT | Poison payload and controlled recovery | Failure classification |
| 18 | Outbox and idempotency | Duplicate command/event handling | Crash-window analysis |
| 19 | Circuit breaker | Slow/failing dependency with timeouts | Explain thresholds and probes |
| 20 | Saga and consistency | Durable workflow states and compensation; intervals | Payment and CAP discussion |
| 21 | Review | Restart components during processing | 60-minute distributed-systems mock |

### Week 4 — Design, deployment, and narrative

| Day | Reading | Hands-on/coding | Mock practice |
|---|---|---|---|
| 22 | Docker/Kubernetes | Build container and deploy with probes | Explain rolling update |
| 23 | AWS architecture | Map demo to AWS; review IAM and queue semantics | Defend cloud choices |
| 24 | Payment/rate-limiter designs | Draw both; implement heap problem | Two 25-minute design drills |
| 25 | Notifications/order tracker | Define ordering, replay, reconnect; DP problem | Domain-heavy design mock |
| 26 | URL shortener and GenAI | Design shortener; optional cited RAG demo | Explain production versus exploration |
| 27 | Resume evidence and STAR | Finalize metric notes and actual stories | Full 75-minute mock |
| 28 | Targeted review | Re-solve weakest problems; check demo failure paths | Final mock and concise project walkthrough |

Track each topic as **can explain**, **can implement**, and **can defend under follow-up**. Before interviews, prioritize transaction boundaries, Kafka replay, query-performance evidence, restriction-enrichment details, and truthful career narratives.
