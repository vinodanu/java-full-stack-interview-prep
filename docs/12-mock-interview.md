[Repository home](../README.md) · [Previous chapter](11-behavioral-and-narrative.md)

## 12. Mock interview script: 25 questions, easy to hard

Use a 75-minute mock: questions 1–8 in 15 minutes, 9–17 in 25 minutes, and 18–25 in 35 minutes.

### 1. Tell me about yourself.

**Model answer:**  
“I’m a Java full stack engineer with over four years of experience in banking and capital-markets applications. My recent work includes Spring Boot services, Kafka event processing, and MongoDB-based restriction enrichment on a trading-compliance platform. I also have React and Angular experience, with documented performance and delivery improvements. I’m seeking a role with greater ownership of reliable services and full stack delivery.”

**Strong candidate includes:** Clear scope, relevant domain, personal contribution, and a focused next step.

### 2. How did Java 17 change the way you write Java?

**Model answer:**  
“I can use records for DTOs, sealed hierarchies for controlled domain alternatives, and `instanceof` patterns for cleaner type handling. Text blocks make multiline fixtures and queries easier to read. I distinguish stable switch expressions from preview pattern matching in Java 17. I would not use Java 21 APIs in a Java 17 project.”

**Strong candidate includes:** Version accuracy and practical uses.

### 3. Why must equals and hashCode agree?

**Model answer:**  
“Hash-based collections first narrow the search using a hash and then use equality to identify the key. Equal objects therefore need equal hash codes. Unequal objects may share a hash code without violating the contract. Fields participating in key equality should remain stable after insertion.”

**Strong candidate includes:** Collision distinction and mutable-key risk.

### 4. What happens during HashMap.put?

**Model answer:**  
“The map spreads the key hash and selects a bucket. It inserts into an empty bucket or checks existing entries for a matching key. A collision can create or extend a chain, while sufficient collision density can trigger a treeification attempt. The map may resize as its size or collision behavior requires.”

**Strong candidate includes:** Equality check, capacity mask, and accurate implementation thresholds.

### 5. Why choose constructor injection?

**Model answer:**  
“Constructor injection makes required dependencies explicit and permits final fields. It creates objects that are complete when constructed and makes unit tests straightforward. If constructor injection reveals a dependency cycle, I first examine the design rather than hiding the cycle.”

**Strong candidate includes:** Testability and architectural implications.

### 6. Strategy versus Factory?

**Model answer:**  
“Strategy represents interchangeable behavior, such as different restriction policies. A factory creates or resolves the appropriate strategy. In Spring, implementations can be injected into a resolver instead of being created manually. I introduce the abstraction when behavior actually varies.”

**Strong candidate includes:** A concrete domain example and avoidance of unnecessary abstraction.

### 7. What causes JPA N+1?

**Model answer:**  
“A query loads root entities, and accessing each association triggers further queries. I choose a fetch plan based on what the endpoint needs, using projections, fetch joins, entity graphs, or batching. I avoid solving every case by making associations eager. I verify the result with representative query counts.”

**Strong candidate includes:** SQL verification and collection-pagination caveats.

### 8. Topic, partition, and consumer group?

**Model answer:**  
“A topic is a stream divided into ordered partitions. Consumers in one group share those partitions, while another group has independent progress. One partition has at most one owner in a group at a time. Ordering is guaranteed within a partition, not across the topic.”

**Strong candidate includes:** Parallelism and ordering boundaries.

### 9. Explain your trading-compliance project.

**Model answer:**  
“I worked on Spring Boot services consuming and publishing compliance events through Kafka. The enrichment used MongoDB data to identify underliers and overliers associated with funds and apply the CMIC restriction flag. Enriched data was exposed through REST and supported downstream Kafka forwarding. I would explain my exact changes, test coverage, and operational responsibilities separately from the platform’s overall design.”

**Strong candidate includes:** A drawn data flow, precise terminology, and honest ownership.

### 10. How would you defend your 60% query improvement?

**Model answer:**  
“I would identify the exact query or stored procedure and the metric used for the claim. I would compare execution plans and explain the indexes and query changes. I would separate database execution time from connection-acquisition and application latency. If the benchmark had limitations, I would state them.”

**Strong candidate includes:** Evidence rather than a percentage alone.

### 11. What is the difference between volatile and atomic operations?

**Model answer:**  
“Volatile provides visibility and ordering for reads and writes of a variable. It does not make a read-modify-write sequence such as increment atomic. Atomic classes provide operations such as compare-and-set and atomic increment. Multi-field invariants may still need locking or a different design.”

**Strong candidate includes:** Correct distinction between visibility and atomicity.

### 12. Why does self-invocation bypass transactional advice?

**Model answer:**  
“Spring’s proxy mode intercepts calls entering through the proxy. An internal `this.inner()` call goes directly to the target. Therefore the inner method’s transaction annotation is not separately applied. I usually move that boundary to another injected service or use `TransactionTemplate`.”

**Strong candidate includes:** What happens when an outer transaction already exists.

### 13. REQUIRED versus REQUIRES_NEW?

**Model answer:**  
“REQUIRED joins an existing transaction or starts one if necessary. REQUIRES_NEW creates an independent transaction while suspending the outer one. That independence means it can commit even if the outer operation later fails. I also account for connection-pool pressure and whether that business behavior is desirable.”

**Strong candidate includes:** Physical transaction boundaries and resource implications.

### 14. How does JWT authentication work in your API?

**Model answer:**  
“The client obtains an access token from an authorization server. The resource server verifies its signature and validates issuer, time constraints, and intended audience. It then maps permissions and authorizes the requested resource. A valid token does not automatically grant access to every account or tenant.”

**Strong candidate includes:** Authentication versus authorization and token-validation boundaries.

### 15. How would you improve a React screen?

**Model answer:**  
“I would measure network, rendering, bundle, and interaction costs before changing code. Depending on the bottleneck, I might paginate data, reduce unnecessary requests, split bundles, or prevent expensive repeated renders. I would handle stale responses and cancellation so performance changes do not introduce incorrect state. I would compare the same metric under similar conditions.”

**Strong candidate includes:** Measurement, correctness, accessibility, and no automatic memoization everywhere.

### 16. How do you handle a Kafka poison message?

**Model answer:**  
“I classify the failure before deciding whether to retry. A transient dependency failure may receive bounded retries, while an invalid payload usually moves to a recovery path. The DLT retains useful metadata and must be monitored. Replay happens only after the cause is fixed and side effects are safe.”

**Strong candidate includes:** Deserialization failures and DLT publication failure.

### 17. What happens when a consumer joins or leaves?

**Model answer:**  
“The group’s partition ownership is recalculated according to its protocol and assignor. Consumers may revoke and acquire partitions, then resume from committed offsets. Work completed without a corresponding offset commit can repeat. The amount of disruption differs between eager, cooperative, and newer consumer protocols.”

**Strong candidate includes:** In-flight work, failure detection, and idempotency.

### 18. How do you select G1 or ZGC?

**Model answer:**  
“I begin with measured pause times, allocation rate, live heap, CPU, and request latency. G1 is a useful general-purpose starting point; ZGC targets lower pauses with resource trade-offs. Java 17 ZGC is non-generational. I compare under representative load instead of assuming the lowest GC pause gives the best overall service.”

**Strong candidate includes:** Workload evidence and version awareness.

### 19. How does a circuit breaker recover?

**Model answer:**  
“After observing enough failures or slow calls, a closed breaker can open and reject new calls. Following the wait period, half-open allows limited probes. Their results determine whether the breaker closes or opens again. Timeouts, retries, and bulkheads remain separate controls.”

**Strong candidate includes:** Minimum sample size and truthful fallback behavior.

### 20. How does outbox prevent lost events?

**Model answer:**  
“The business update and outbox record commit in the same database transaction. A relay publishes committed outbox records independently. If the relay crashes after publishing but before recording progress, it can publish again. I therefore retain event IDs and consumer deduplication.”

**Strong candidate includes:** Both crash windows and aggregate ordering.

### 21. How would you design payment idempotency?

**Model answer:**  
“I scope the key to the client or tenant and operation, then store a request hash and result. A uniqueness constraint resolves concurrent submissions. Reusing a key with another payload is rejected. Calls to the payment provider use its own idempotency support and reconciliation for ambiguous outcomes.”

**Strong candidate includes:** Atomic enforcement and external-system boundaries.

### 22. Explain a saga failure after payment authorization.

**Model answer:**  
“The orchestrator records the failed step and issues compensating commands for completed actions. It might void the authorization and release the reservation. Those compensations are independent transactions and can fail too. Durable state, idempotent commands, retries, and manual escalation are part of the design.”

**Strong candidate includes:** Compensation is not rollback; authorization versus settlement.

### 23. How would you maintain an accurate order-status projection?

**Model answer:**  
“I key events by order ID and persist deduplication and ordering metadata. The consumer validates source sequence and permitted state transitions before changing the projection. The UI gets a snapshot and a resumable update stream, with freshness information. I separately address upstream disorder because partition ordering only preserves arrival order.”

**Strong candidate includes:** Reconnect handling, audit history, and correctness invariants.

### 24. How would you investigate downtime after a Kubernetes rollout?

**Model answer:**  
“I would inspect rollout progress, readiness, endpoint membership, resource pressure, and termination timing. I would compare old and new version behavior and check API or schema compatibility. If needed, I would stop or roll back the application rollout while preserving data safety. Prevention would address the demonstrated failure rather than only increasing replicas.”

**Strong candidate includes:** Graceful shutdown, capacity, and migration compatibility.

### 25. Design a compliance platform that survives duplicates, outages, and stale data.

**Model answer:**  
“I would clarify correctness rules first, especially how stale restrictions affect decisions. I would use durable ingestion, versioned events, idempotent enrichment, and explicit publication boundaries such as outbox where applicable. Reads would expose freshness, while failure paths would distinguish unavailable decisions from permitted trades. Traces, lag, enrichment failures, DLT age, and reconciliation would make operational state visible.”

**Strong candidate includes:** Business invariants, ownership, recovery, and justified service boundaries.

---
