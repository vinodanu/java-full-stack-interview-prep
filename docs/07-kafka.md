[Repository home](../README.md) · [Previous chapter](06-microservices-and-distributed-systems.md) · [Next chapter](08-cloud-and-devops.md)

## 7. Kafka

### Concepts

| Term | Meaning |
|---|---|
| Topic | Named event stream |
| Partition | Ordered log and unit of parallelism |
| Key | Typically determines partition; supports per-key ordering |
| Consumer group | Consumers sharing partition ownership |
| Offset | Position within a partition |
| Committed offset | Usually the next record the group should read |
| Retention | Determines how long records remain, independently of consumption |
| Rebalance | Changes partition ownership when membership or assignments change |

Within a group, one partition is assigned to at most one consumer at a time. Different groups consume independently. Ordering is per partition, not across the whole topic.

Increasing partitions can change key placement for later events; consider ordering implications.

### Delivery semantics

| Semantics | Typical sequence | Failure consequence |
|---|---|---|
| At most once | Commit before processing | Records can be skipped |
| At least once | Process, then commit | Work can replay |
| Exactly once within Kafka | Transactional output plus offsets; `read_committed` readers | Atomic Kafka processing boundary |

Kafka transactions do not automatically make external database writes, emails, or payment calls exactly once. See [Kafka’s processing design](https://kafka.apache.org/42/design/design/).

An idempotent producer deduplicates retries using producer identity and sequence tracking. It does not eliminate arbitrary repeated application sends or consumer side effects.

### Rebalancing

Discuss:

- Heartbeats and session failure detection.
- `max.poll.interval.ms` when processing takes too long.
- Committing completed work during revocation where possible.
- Replayed work after a crash or lost assignment.
- Static membership and cooperative assignment as ways to reduce disruption.
- Classic eager rebalance versus newer protocols.

Kafka’s newer consumer protocol is version-dependent; do not describe every rebalance as a full stop of every partition. See [Kafka rebalance protocol documentation](https://kafka.apache.org/42/operations/consumer-rebalance-protocol/).

### Code/configuration

```yaml
spring:
  kafka:
    producer:
      acks: all
      properties:
        enable.idempotence: true
        max.in.flight.requests.per.connection: 5
    consumer:
      group-id: compliance-enrichment
      enable-auto-commit: false
      auto-offset-reset: earliest
    listener:
      ack-mode: record
```

`auto-offset-reset` applies when a usable committed offset is absent, not on every restart. `acks=all` must be understood with replication and `min.insync.replicas`.

A Spring Kafka poison-message policy:

```java
@Configuration
class KafkaFailureConfig {
    @Bean
    DefaultErrorHandler errorHandler(
            KafkaTemplate<Object, Object> template) {

        DeadLetterPublishingRecoverer recoverer =
                new DeadLetterPublishingRecoverer(
                        template,
                        (record, exception) ->
                                new TopicPartition(
                                        record.topic() + ".DLT",
                                        record.partition()));

        // Do not consider recovery successful if DLT publication fails.
        recoverer.setFailIfSendResultIsError(true);

        DefaultErrorHandler handler = new DefaultErrorHandler(
                recoverer,
                new FixedBackOff(1_000L, 2L));

        handler.addNotRetryableExceptions(
                IllegalArgumentException.class);

        return handler;
    }
}
```

Use compatible Spring Kafka APIs for the selected Boot version. Create the DLT with sufficient partitions for this resolver. Configure `ErrorHandlingDeserializer` for failures before listener invocation.

**Poison-message workflow:** classify → bounded retry → durable DLT → alert → inspect/fix → controlled replay. Keep original topic, partition, offset, event ID, error, and schema version; protect sensitive payloads.

### Interview questions and answers

**Ten consumers and six partitions?**  
At most six consumers receive partition assignments for that topic in one group; the others are idle.

**Why can a consumer repeat a successful database write?**  
It can crash after the database commit but before its offset commit.

**Should every exception be retried?**  
No. Transient failures may recover; malformed payloads or invalid business data usually need classification and recovery instead.

---
