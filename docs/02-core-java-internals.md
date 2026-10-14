[Repository home](../README.md) · [Previous chapter](01-java-17.md) · [Next chapter](03-solid-and-design-patterns.md)

## 2. Core Java internals

### Concepts

#### HashMap

The important OpenJDK 17 implementation details are:

- Spread hash: `h ^ (h >>> 16)`.
- Bucket index: `(capacity - 1) & spreadHash`; capacity is a power of two.
- Same bucket does not imply equal keys. Matching uses hash and key equality.
- Defaults: capacity 16 when allocated, load factor 0.75.
- Ordinary load-based growth occurs when size exceeds the threshold.
- During doubling, nodes stay at the old index or move by the old capacity using one hash bit.
- Constants: `TREEIFY_THRESHOLD = 8`, `MIN_TREEIFY_CAPACITY = 64`, `UNTREEIFY_THRESHOLD = 6`.
- In the ordinary `put` list path, appending to an existing eight-node chain triggers the treeification attempt. Below capacity 64, it resizes instead.
- Untreeification during removal also depends on tree shape; “always untreeifies at six” is too broad.
- Tree bins improve collision handling, but identical hashes with non-comparable keys can still require broad searches.

These are implementation details, not promises of the `Map` interface. See [OpenJDK 17 HashMap source](https://raw.githubusercontent.com/openjdk/jdk17u/master/src/java.base/share/classes/java/util/HashMap.java).

Expected lookup and insertion are O(1) with well-distributed hashes. Iteration costs depend on capacity plus size. `HashMap` is unsafe for unsynchronized concurrent mutation, and fail-fast iteration is only a best-effort bug detector. See [Java 17 HashMap API](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/HashMap.html).

#### ConcurrentHashMap

Java 17 does not use the old segmented design. It uses techniques including CAS, bin-level synchronization, and cooperative resizing. Reads generally avoid locking; compound updates should use operations such as `compute`, `merge`, or `putIfAbsent`.

No null keys or values are allowed. Iterators are weakly consistent, and a concurrent `size()` result is not an atomic snapshot. Thread-safe storage does not make mutable values or multi-key business operations automatically safe. See [ConcurrentHashMap API](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html).

#### Java Memory Model

| Mechanism | What it provides |
|---|---|
| `volatile` | Visibility and ordering; no mutual exclusion |
| `synchronized` | Mutual exclusion plus visibility through monitor release/acquisition |
| Atomic classes | Atomic operations with specified memory semantics |
| `final` fields | Initialization guarantees when constructed and published correctly |
| Happens-before | A formal ordering that guarantees visibility between actions |

A volatile write happens-before a subsequent read of that variable. Unlocking a monitor happens-before a subsequent lock of the same monitor. `Thread.start()` and successful `join()` also establish ordering. See [Java 17 threads and locks specification](https://docs.oracle.com/javase/specs/jls/se17/html/jls-17.html).

#### Garbage collection

| Aspect | G1 in Java 17 | ZGC in Java 17 |
|---|---|---|
| Design | Region-based, generational | Concurrent, non-generational |
| Aim | Balance throughput and pause goals | Very low pauses |
| Expensive work | Mix of concurrent work and stop-the-world evacuation | Much work performed concurrently |
| Trade-off | Reasonable general-purpose starting point | CPU/headroom and throughput trade-offs |
| Selection | `-XX:+UseG1GC` | `-XX:+UseZGC` |

Java 17 ZGC is **not generational ZGC**. Neither collector provides an application latency guarantee. Compare GC pauses, allocation rate, live heap, CPU, and request percentiles under representative load. See [Oracle’s Java 17 collector guide](https://docs.oracle.com/en/java/javase/17/gctuning/available-collectors.html).

#### Equality and strings

- `equals` must be reflexive, symmetric, transitive, consistent, and false for null.
- Equal objects must have equal hash codes; equal hash codes do not prove equality.
- Do not mutate fields used by a key’s equality/hash after insertion.
- String literals and constant expressions use interned strings.
- `new String("x")` creates a distinct string object; `intern()` returns the canonical reference.
- Use `.equals()` for content, not `==`.
- Since Java 9, compact strings can use byte-based internal storage; do not assume Java 8’s internal representation.

### Code

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.LongAdder;

record RestrictionKey(String fundId, String instrumentId) {}

class ConcurrentMetrics {
    private final ConcurrentHashMap<String, LongAdder> counts =
            new ConcurrentHashMap<>();

    private final AtomicInteger activeRequests = new AtomicInteger();
    private volatile boolean stopping;

    void record(String eventType) {
        counts.computeIfAbsent(eventType, ignored -> new LongAdder())
              .increment();
    }

    int beginRequest() {
        return activeRequests.incrementAndGet();
    }

    void stop() {
        stopping = true;
    }

    boolean isStopping() {
        return stopping;
    }
}
```

`LongAdder` suits contended statistics; its sum is not a linearizable counter snapshot. Use `AtomicInteger` or `AtomicLong` when the exact returned value matters.

### Interview questions and answers

**Why is `volatile int count; count++` unsafe?**  
Increment is a read-modify-write sequence. Visibility does not prevent two threads from reading the same old value.

**Why can a mutable map key become unreachable?**  
Lookup uses the key’s current hash, while the entry remains in the bucket selected when inserted.

**How would you investigate latency spikes?**  
Correlate traces with GC logs, allocation, thread activity, pool saturation, and database latency. Change the collector only after identifying GC as a meaningful contributor.

---
