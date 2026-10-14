# Java Full Stack Interview Preparation Guide — Vinod Kumar Anantha

This guide targets Senior Software Engineer and Java Full Stack interviews, using your banking and trading-compliance experience as the main thread.

Your strongest positioning is: **a Java full stack engineer who understands event-driven banking workflows, data enrichment, performance improvement, and reliable delivery.** At four years, strong interviews depend on explaining implementation details, failure modes, and your personal contribution.

**Conventions:** Java examples use Java 17. Spring examples assume Spring Boot 3.x, Spring Framework 6.x, and Jakarta Persistence. Snippets are independent; routine imports and application-specific collaborators are omitted unless needed.

Before interviewing, prepare evidence for these claims:

| Claim | What you should be able to explain |
|---|---|
| 60% query improvement | Query, execution plan, indexes, workload, before/after measurement; distinguish indexing effects from connection-pool effects |
| 50% faster releases | Previous and revised release duration, pipeline changes, sample period, your contribution |
| 25% faster page loads | Metric used, browser/device conditions, improvements, measurement method |
| 25% API improvement | Latency percentile, workload, Lambda cold starts, DynamoDB access pattern |
| 40% downtime reduction | This appears in your profile but not the resume; use only with a concrete incident history and calculation |
| Morgan Stanley work | Explain LanceSoft employment and Morgan Stanley client assignment accurately; distinguish ownership from contribution |

---

## 1. Java 17 deep dive

### Concepts

| Feature | Status in Java 17 | When to use | Interview trap |
|---|---|---|---|
| Records | Final; introduced in Java 16 | DTOs, immutable value carriers, event payloads | Component references are final; referenced objects can still be mutable |
| Sealed classes/interfaces | Final in Java 17 | Closed domain hierarchies | Direct subclasses must be `final`, `sealed`, or `non-sealed` |
| `instanceof` pattern matching | Final; introduced in Java 16 | Type checks with safe binding | Variable scope depends on control flow |
| Switch expressions | Final; introduced in Java 14 | Return a value from exhaustive alternatives | Different from pattern matching in `switch` |
| Pattern matching for `switch` | **Preview in Java 17** | Explore type-based dispatch | Requires preview compilation and runtime flags |
| Text blocks | Final; introduced in Java 15 | SQL, JSON, multiline fixtures | Still strings; SQL interpolation remains unsafe |
| Sequenced collections | **Unavailable in Java 17; introduced in Java 21** | Know the concept for version questions | Do not use `SequencedCollection` or Java 21 collection methods |

These version boundaries are documented in [Oracle’s Java 17 language changes](https://docs.oracle.com/en/java/javase/17/language/java-language-changes-release.html) and [Oracle’s Java 21 collection guide](https://docs.oracle.com/en/java/javase/21/core/java-core-libraries-developer-guide.pdf).

### What changed from Java 8 and 11?

| Baseline | Features worth discussing |
|---|---|
| Java 8 | Lambdas, streams, functional interfaces, default methods, `java.time`, `CompletableFuture` |
| Java 11 | Local-variable `var` available since 10; standard HTTP client; `String.isBlank()`, `lines()`, `strip()`; `Files.readString()` |
| Java 17 | Records, sealed types, text blocks, switch expressions, `instanceof` patterns; stronger encapsulation can affect reflection-heavy libraries |

`var` provides compile-time local type inference. It does not introduce dynamic typing and cannot replace field types or normal method parameter types.

### Code

```java
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

record RestrictionRequest(String fundId, List<String> instruments) {
    RestrictionRequest {
        Objects.requireNonNull(fundId);
        instruments = List.copyOf(instruments); // Defensive copy
    }
}

sealed interface RestrictionResult permits Allowed, Blocked {}

record Allowed(String instrumentId) implements RestrictionResult {}

record Blocked(String instrumentId, String reason)
        implements RestrictionResult {}

class RestrictionExamples {
    static String describe(RestrictionResult result) {
        if (result instanceof Blocked blocked) {
            return "Blocked: " + blocked.reason();
        }
        return "Allowed";
    }

    enum Status { RECEIVED, ENRICHED, REJECTED }

    static int priority(Status status) {
        return switch (status) {
            case RECEIVED -> 1;
            case ENRICHED -> 2;
            case REJECTED -> 3;
        };
    }

    static String query() {
        return """
               SELECT fund_id, restriction_flag
               FROM restrictions
               WHERE fund_id = ?
               """;
    }

    static BigDecimal amount(String value) {
        return new BigDecimal(value); // Avoid binary floating-point money
    }
}
```

For pattern matching in `switch`, prefer the stable `instanceof` version above in ordinary Java 17 projects. If an interviewer explicitly requests the Java 17 preview syntax:

```java
// Java 17 PREVIEW ONLY.
// Compile: javac --enable-preview --release 17 PreviewExample.java
// Run:     java --enable-preview PreviewExample
public class PreviewExample {
    static String describe(Object value) {
        return switch (value) {
            case null -> "missing";
            case String text -> text.strip();
            case Integer number -> "number=" + number;
            default -> value.toString();
        };
    }

    public static void main(String[] args) {
        System.out.println(describe(" compliance "));
    }
}
```

This uses type patterns, not Java 21 record patterns.

### Interview questions and answers

**Can a record be a JPA entity?**  
A standard JPA entity requires entity-oriented construction and identity semantics that records do not provide. Use records for DTOs and projections; use ordinary classes for entities.

**Are records deeply immutable?**  
No. A record containing a mutable list can expose mutable state unless you defensively copy it.

**When would you use a sealed hierarchy?**  
For a deliberately closed set of outcomes, such as allowed, blocked, or pending compliance decisions. Use an open interface when third parties must add implementations.

---

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

## 3. SOLID and design patterns in practice

### SOLID: concept, violation, refactoring, interview answer

#### S — Single Responsibility Principle

**Concept:** A class should have one coherent reason to change.

```java
// Violates SRP: business rules and transport logic change independently.
class BadRestrictionService {
    boolean evaluate(String instrumentId) {
        return !instrumentId.isBlank();
    }

    void publish(String instrumentId) {
        System.out.println("Kafka event: " + instrumentId);
    }
}

// Refactored
interface RestrictionPublisher {
    void publish(String instrumentId);
}

class RestrictionEvaluator {
    boolean evaluate(String instrumentId) {
        return !instrumentId.isBlank();
    }
}

class RestrictionWorkflow {
    private final RestrictionEvaluator evaluator;
    private final RestrictionPublisher publisher;

    RestrictionWorkflow(RestrictionEvaluator evaluator,
                        RestrictionPublisher publisher) {
        this.evaluator = evaluator;
        this.publisher = publisher;
    }

    void process(String instrumentId) {
        if (evaluator.evaluate(instrumentId)) {
            publisher.publish(instrumentId);
        }
    }
}
```

**One-line answer:** “I separate responsibilities that change for different reasons, such as restriction rules and event transport.”

#### O — Open/Closed Principle

**Concept:** Add behavior through extension without repeatedly editing stable orchestration.

```java
// Violates OCP: every new channel modifies this class.
class BadNotifier {
    void send(String channel, String message) {
        if ("EMAIL".equals(channel)) {
            System.out.println("Email: " + message);
        } else if ("SMS".equals(channel)) {
            System.out.println("SMS: " + message);
        }
    }
}

// Refactored
interface NotificationChannel {
    void send(String message);
}

class NotificationService {
    private final NotificationChannel channel;

    NotificationService(NotificationChannel channel) {
        this.channel = channel;
    }

    void notifyUser(String message) {
        channel.send(message);
    }
}
```

**One-line answer:** “I make variable behavior pluggable so new implementations do not disturb established workflows.”

#### L — Liskov Substitution Principle

**Concept:** A subtype must preserve the behavioral expectations of its abstraction.

```java
// Violates LSP: callers reasonably expect withdraw to work.
class Account {
    void withdraw(long paise) {
        // Debit account.
    }
}

class FixedDeposit extends Account {
    @Override
    void withdraw(long paise) {
        throw new UnsupportedOperationException();
    }
}

// Refactored: express actual capabilities.
interface BalanceReadable {
    long balancePaise();
}

interface Withdrawable extends BalanceReadable {
    void withdraw(long paise);
}

class SavingsAccount implements Withdrawable {
    private long balance;

    SavingsAccount(long balance) {
        this.balance = balance;
    }

    public long balancePaise() {
        return balance;
    }

    public void withdraw(long paise) {
        if (paise <= 0 || paise > balance) {
            throw new IllegalArgumentException("Invalid withdrawal");
        }
        balance -= paise;
    }
}

record FixedDepositView(long balancePaise) implements BalanceReadable {}
```

**One-line answer:** “An implementation must honor the abstraction’s contract without surprising callers with stronger restrictions.”

#### I — Interface Segregation Principle

**Concept:** Consumers should depend only on capabilities they need.

```java
// Violates ISP.
interface TradingOperations {
    void placeOrder();
    void cancelOrder();
    void exportComplianceReport();
}

// Refactored
interface OrderWriter {
    void placeOrder();
    void cancelOrder();
}

interface ComplianceReporter {
    void exportComplianceReport();
}

class ReportController {
    private final ComplianceReporter reporter;

    ReportController(ComplianceReporter reporter) {
        this.reporter = reporter;
    }

    void export() {
        reporter.exportComplianceReport();
    }
}
```

**One-line answer:** “I split broad interfaces into client-focused capabilities to reduce unnecessary coupling.”

#### D — Dependency Inversion Principle

**Concept:** High-level business policy depends on abstractions, with infrastructure implementing those abstractions.

```java
// Violates DIP.
class BadEnrichmentService {
    private final MongoRestrictionStore store = new MongoRestrictionStore();

    String enrich(String fundId) {
        return store.find(fundId);
    }
}

class MongoRestrictionStore {
    String find(String fundId) {
        return fundId;
    }
}

// Refactored
interface RestrictionLookup {
    String find(String fundId);
}

@org.springframework.stereotype.Service
class EnrichmentService {
    private final RestrictionLookup lookup;

    EnrichmentService(RestrictionLookup lookup) {
        this.lookup = lookup;
    }

    String enrich(String fundId) {
        return lookup.find(fundId);
    }
}
```

**One-line answer:** “Business logic depends on a lookup contract; MongoDB is an injected implementation detail.”

Dependency injection is a wiring technique. Dependency inversion is an architectural dependency direction.

### Eight backend patterns

| Pattern | Suitable example | Main distinction |
|---|---|---|
| Strategy | Different restriction policies | Select an interchangeable algorithm |
| Factory | Resolve notifier by channel | Centralize creation or resolution |
| Builder | Construct a validated request | Handle optional fields and invariants |
| Decorator | Add metrics around a publisher | Preserve interface while adding behavior |
| Observer | Notify local listeners of events | In-process notification; not durable messaging |
| Adapter | Normalize a legacy provider | Translate an incompatible interface |
| Template Method | Shared import workflow | Fixed skeleton with extension hooks |
| Chain of Responsibility | Ordered eligibility checks | Handlers can continue or stop processing |

### Spring-based examples

#### Strategy and Factory

```java
interface RestrictionPolicy {
    String type();
    boolean blocked(String instrumentId);
}

@org.springframework.stereotype.Component
class CmicPolicy implements RestrictionPolicy {
    public String type() { return "CMIC"; }

    public boolean blocked(String instrumentId) {
        return instrumentId.startsWith("RESTRICTED-"); // Demo rule only
    }
}

@org.springframework.stereotype.Component
class PolicyFactory {
    private final java.util.Map<String, RestrictionPolicy> policies;

    PolicyFactory(java.util.List<RestrictionPolicy> candidates) {
        policies = candidates.stream().collect(
                java.util.stream.Collectors.toUnmodifiableMap(
                        RestrictionPolicy::type, policy -> policy));
    }

    RestrictionPolicy resolve(String type) {
        RestrictionPolicy policy = policies.get(type);
        if (policy == null) {
            throw new IllegalArgumentException("Unknown policy: " + type);
        }
        return policy;
    }
}
```

Spring creates the strategies. This factory resolves an existing strategy rather than manually constructing beans.

#### Builder

```java
record SearchRequest(String fundId, int limit, boolean includeExpired) {
    SearchRequest {
        if (fundId == null || fundId.isBlank()) {
            throw new IllegalArgumentException("fundId required");
        }
        if (limit < 1 || limit > 500) {
            throw new IllegalArgumentException("limit out of range");
        }
    }

    static class Builder {
        private String fundId;
        private int limit = 100;
        private boolean includeExpired;

        Builder fundId(String value) {
            fundId = value;
            return this;
        }

        Builder limit(int value) {
            limit = value;
            return this;
        }

        Builder includeExpired(boolean value) {
            includeExpired = value;
            return this;
        }

        SearchRequest build() {
            return new SearchRequest(fundId, limit, includeExpired);
        }
    }
}
```

For a two-field DTO, a record constructor is usually simpler than a builder.

#### Decorator

```java
interface EventPublisher {
    void publish(String event);
}

@org.springframework.stereotype.Component("kafkaPublisher")
class KafkaEventPublisher implements EventPublisher {
    public void publish(String event) {
        // Delegate to KafkaTemplate and handle acknowledgement.
    }
}

@org.springframework.stereotype.Component
@org.springframework.context.annotation.Primary
class MeteredPublisher implements EventPublisher {
    private final EventPublisher delegate;

    MeteredPublisher(
            @org.springframework.beans.factory.annotation.Qualifier(
                    "kafkaPublisher") EventPublisher delegate) {
        this.delegate = delegate;
    }

    public void publish(String event) {
        long started = System.nanoTime();
        try {
            delegate.publish(event);
        } finally {
            long elapsed = System.nanoTime() - started;
            // Record duration with Micrometer.
        }
    }
}
```

#### Observer

```java
record RestrictionChanged(String instrumentId) {}

@org.springframework.stereotype.Component
class ComplianceListener {
    @org.springframework.context.event.EventListener
    public void on(RestrictionChanged event) {
        // Update an in-process view or perform local notification.
    }
}
```

Publish through `ApplicationEventPublisher`. Spring events are synchronous by default and do not survive process failure. A transaction-bound listener can run after commit, but that still does not replace a durable outbox.

#### Adapter

```java
interface PriceProvider {
    java.math.BigDecimal price(String symbol);
}

interface LegacyMarketApi {
    long priceInPaise(String symbol);
}

@org.springframework.stereotype.Component
class LegacyPriceAdapter implements PriceProvider {
    private final LegacyMarketApi legacy;

    LegacyPriceAdapter(LegacyMarketApi legacy) {
        this.legacy = legacy;
    }

    public java.math.BigDecimal price(String symbol) {
        return java.math.BigDecimal.valueOf(
                legacy.priceInPaise(symbol), 2);
    }
}
```

#### Template Method

```java
abstract class ComplianceImporter {
    public final void run(String source) {
        String raw = read(source);
        validate(raw);
        persist(raw);
    }

    protected abstract String read(String source);
    protected abstract void persist(String raw);

    protected void validate(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Empty import");
        }
    }
}

@org.springframework.stereotype.Component
class CsvComplianceImporter extends ComplianceImporter {
    protected String read(String source) {
        return source; // Replace with actual CSV parsing.
    }

    protected void persist(String raw) {
        // Delegate to a separately injected transactional service.
    }
}
```

The separate transactional service avoids expecting an internal template-method call to cross a Spring proxy.

#### Chain of Responsibility

```java
record Trade(String accountId, long quantity) {}

interface TradeCheck {
    void check(Trade trade);
}

@org.springframework.stereotype.Component
@org.springframework.core.annotation.Order(10)
class QuantityCheck implements TradeCheck {
    public void check(Trade trade) {
        if (trade.quantity() <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
    }
}

@org.springframework.stereotype.Service
class TradeValidationChain {
    private final java.util.List<TradeCheck> checks;

    TradeValidationChain(java.util.List<TradeCheck> checks) {
        this.checks = checks;
    }

    void validate(Trade trade) {
        for (TradeCheck check : checks) {
            check.check(trade); // Exception stops this fail-fast chain.
        }
    }
}
```

### Interview questions and answers

**Strategy versus Factory?**  
Strategy supplies behavior. Factory creates or resolves the implementation that supplies it; they often work together.

**Decorator versus Adapter?**  
Decorator adds behavior while preserving the interface. Adapter translates an interface.

**When would you avoid a pattern?**  
When a direct implementation is clearer and variation is hypothetical. Explain the change pressure before introducing abstraction.

---

## 4. Spring Boot internals

### Concepts

#### Bean lifecycle

A simplified lifecycle:

1. Bean definitions are discovered or registered.
2. `BeanFactoryPostProcessor` implementations can alter definitions.
3. Spring constructs the bean and injects dependencies.
4. Applicable aware callbacks run.
5. Before-initialization processing runs; `@PostConstruct` is invoked through lifecycle processing.
6. Initialization callbacks run, including `InitializingBean` and configured init methods.
7. After-initialization processors can expose a proxy.
8. Shutdown invokes destruction callbacks such as `@PreDestroy`.

Do not assume `@Transactional` on `@PostConstruct` works through the final proxy.

#### Dependency injection

Prefer constructor injection: dependencies are explicit, required, and easy to test. Resolve multiple implementations with `@Qualifier` or `@Primary`.

Constructor cycles cannot be resolved by normal construction. Refactor responsibilities, introduce an orchestration service, or use events where appropriate. `@Lazy` can defer resolution but often conceals the design problem.

#### AOP and self-invocation

JDK proxies implement interfaces; class-based proxies subclass the target. Class-based interception cannot override final methods, and private methods are unsuitable interception boundaries.

A call through `this` bypasses the proxy. If an outer transaction already exists, the inner method still runs within that transaction, but its own propagation or isolation annotation is not separately applied. See [Spring’s proxy documentation](https://github.com/spring-projects/spring-framework/blob/main/framework-docs/modules/ROOT/pages/core/aop/proxying.adoc).

#### Transaction propagation

| Propagation | Behavior | Typical use |
|---|---|---|
| `REQUIRED` | Join existing transaction or create one | Normal business workflow |
| `REQUIRES_NEW` | Suspend outer transaction; create independent transaction | Deliberately independent audit entry |
| `NESTED` | Use savepoint where supported | Partial rollback within one physical transaction |
| `SUPPORTS` | Join if present; otherwise nontransactional | Optional transaction context |
| `MANDATORY` | Require existing transaction | Internal operation with required boundary |
| `NOT_SUPPORTED` | Suspend transaction | Work intentionally outside transaction |
| `NEVER` | Fail if a transaction exists | Enforce nontransactional use |

`REQUIRES_NEW` can need another database connection while the outer transaction holds one. An inner `REQUIRED` scope marking rollback-only can cause `UnexpectedRollbackException` at the outer commit. `NESTED` depends on transaction-manager and driver support; it is not universally available for JPA. See [Spring transaction propagation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html).

#### Isolation

| Level | Broad guarantee | Trade-off |
|---|---|---|
| `READ_UNCOMMITTED` | Dirty reads may occur | Weak correctness |
| `READ_COMMITTED` | Prevent dirty reads | Repeated reads can change |
| `REPEATABLE_READ` | Prevent dirty and nonrepeatable reads | Phantom/write-skew behavior depends on database |
| `SERIALIZABLE` | Equivalent to serial execution for committed transactions | Blocking or serialization retries |

PostgreSQL maps `READ_UNCOMMITTED` to `READ_COMMITTED`. Its repeatable-read snapshot prevents phantoms but can permit serialization anomalies. Do not apply generic isolation tables blindly across PostgreSQL, SQL Server, and MySQL.

By default, Spring rolls back on unchecked exceptions and errors, not all checked exceptions. `readOnly=true` is an optimization hint, not a universal write prohibition. Joining an existing transaction normally retains its existing isolation. See [Spring transactional annotation semantics](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html).

#### Auto-configuration

`@SpringBootApplication` combines Boot configuration, component scanning, and auto-configuration. Boot evaluates conditions involving classes, properties, beans, and application type.

Auto-configuration often backs off when you define your own bean. Modern Boot libraries register candidates through `AutoConfiguration.imports`; older Boot versions used `spring.factories`. Diagnose unexpected wiring with the conditions report. See [Boot auto-configuration](https://docs.spring.io/spring-boot/reference/using/auto-configuration.html) and [custom auto-configuration](https://docs.spring.io/spring-boot/reference/features/developing-auto-configuration.html).

#### Security

OAuth 2.0 is an authorization framework; JWT is a token format; OpenID Connect adds identity.

For a React SPA, discuss Authorization Code with PKCE or a backend-for-frontend. For service identities, discuss client credentials. Validate access tokens and enforce permissions close to the business resource.

### Code: fix self-invocation

```java
@org.springframework.stereotype.Service
class RestrictionWorkflowService {
    private final RestrictionWriter writer;

    RestrictionWorkflowService(RestrictionWriter writer) {
        this.writer = writer;
    }

    public void process(String instrumentId) {
        // Enrichment outside the DB transaction.
        writer.save(instrumentId); // Crosses another Spring bean's proxy.
    }
}

@org.springframework.stereotype.Service
class RestrictionWriter {
    @org.springframework.transaction.annotation.Transactional
    public void save(String instrumentId) {
        // Persist restriction and outbox entry in the same DB transaction.
    }
}
```

### Code: JWT resource server

```java
@Configuration
@EnableMethodSecurity
class SecurityConfig {
    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        return http
                // Appropriate here only for a bearer-token API that does not
                // authenticate using browser-sent session cookies.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**").permitAll()
                        .requestMatchers("/restrictions/**")
                        .hasAuthority("SCOPE_compliance.read")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(Customizer.withDefaults()))
                .build();
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${security.issuer}") String issuer,
            @Value("${security.audience}") String audience) {

        NimbusJwtDecoder decoder = JwtDecoders.fromIssuerLocation(issuer);

        OAuth2TokenValidator<Jwt> audienceValidator = jwt -> {
            if (jwt.getAudience().contains(audience)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error(
                            "invalid_token", "Invalid audience", null));
        };

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                audienceValidator));

        return decoder;
    }
}
```

Configure the permitted signature algorithm for the issuer’s actual keys. Never accept an algorithm chosen solely from an untrusted token header. Handle CORS deliberately and avoid logging bearer tokens.

Spring resource-server support verifies and decodes JWTs, maps scopes to authorities, and supports custom validators. See [Spring Security JWT documentation](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html).

### Reducing boilerplate

| Tool | Use | Caveat |
|---|---|---|
| Lombok | Constructors, logging, selected accessors | Avoid blanket `@Data` on entities; equality and recursion can be harmful |
| MapStruct | Compile-time entity/DTO mapping | Mapping a lazy association can still trigger SQL |
| Records | API DTOs, projections, event values | Defensive copying may be necessary |

```java
record RestrictionDto(Long id, String instrumentId) {}

@org.mapstruct.Mapper(
        componentModel = "spring",
        unmappedTargetPolicy = org.mapstruct.ReportingPolicy.ERROR)
interface RestrictionMapper {
    RestrictionDto toDto(RestrictionEntity entity);
}
```

### Interview questions and answers

**Does `@Transactional` make a Kafka publication and database write atomic?**  
Not automatically. A database transaction does not create one atomic commit across arbitrary external resources; use an outbox or explicitly analyze coordinated transaction boundaries.

**Why does a transactional method sometimes run without a transaction?**  
Check whether the object is Spring-managed, whether the call crossed the proxy, and whether the chosen proxy can intercept the method.

**How do you test this?**  
Use a Spring integration test and verify rollback or persisted state. A plain Mockito test cannot establish proxy behavior.

---

## 5. JPA and Hibernate

### Concepts

JPA defines persistence contracts; Hibernate implements them. The persistence context tracks managed entities, provides first-level identity, and detects changes. SQL may execute at flush rather than immediately when a setter runs.

#### Relationships and ownership

| Relationship | Default fetch | Main concern |
|---|---|---|
| `ManyToOne` | EAGER | Hidden secondary queries; usually choose LAZY |
| `OneToOne` | EAGER | Lazy behavior can depend on mapping/enhancement |
| `OneToMany` | LAZY | Large collections and N+1 |
| `ManyToMany` | LAZY | Shared ownership; explicit join entity often clearer |

The owning side controls the relationship’s database mapping. `mappedBy` identifies the inverse side. Keep both sides synchronized in memory.

#### Cascades and orphan removal

| Option | Meaning |
|---|---|
| `PERSIST` | Propagate persist |
| `MERGE` | Propagate merge |
| `REMOVE` | Propagate deletion |
| `REFRESH` | Propagate refresh |
| `DETACH` | Propagate detach |
| `ALL` | All of the above |
| `orphanRemoval=true` | Delete an owned child removed from its relationship |

Use removal semantics for genuinely owned children. Do not cascade removal from a trade to a shared instrument or from one user to a shared role. See [Hibernate relationship and cascade guide](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html).

#### N+1 and lazy loading

N+1 means an initial query followed by additional association queries for individual results. EAGER does not guarantee one SQL query.

| Remedy | Good use | Limitation |
|---|---|---|
| Fetch join | Load a known graph | Collection pagination is problematic |
| Entity graph | Declare query-specific fetch needs | Inspect generated SQL |
| Batch fetching | Reduce repeated lazy loads | Still multiple queries |
| DTO projection | Read-only API shape | More explicit query design |
| Two-step ID pagination | Page roots, then fetch relationships | Must preserve order and handle consistency |

Avoid accessing lazy associations after closing the persistence context. Map DTOs inside the service transaction and consider disabling Open Session in View. See [Hibernate fetch guidance](https://docs.jboss.org/hibernate/orm/6.5/userguide/html_single/Hibernate_User_Guide.html).

### Code

```java
@Entity
@Table(name = "trade_orders")
class TradeOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private long version;

    @OneToMany(
            mappedBy = "order",
            cascade = CascadeType.ALL,
            orphanRemoval = true)
    private List<OrderLeg> legs = new ArrayList<>();

    protected TradeOrder() {}

    void addLeg(OrderLeg leg) {
        legs.add(leg);
        leg.setOrder(this);
    }

    void removeLeg(OrderLeg leg) {
        legs.remove(leg);
        leg.setOrder(null);
    }
}

@Entity
class OrderLeg {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private TradeOrder order;

    protected OrderLeg() {}

    void setOrder(TradeOrder order) {
        this.order = order;
    }
}

interface OrderRepository extends JpaRepository<TradeOrder, Long> {
    @Query("""
           select distinct o
           from TradeOrder o
           left join fetch o.legs
           where o.id = :id
           """)
    Optional<TradeOrder> findWithLegs(@Param("id") Long id);
}
```

### Interview questions and answers

**Cascade REMOVE versus orphan removal?**  
Cascade REMOVE propagates parent deletion. Orphan removal deletes an owned child when removed from the association.

**How would you prove N+1 is fixed?**  
Use representative data, inspect SQL/query counts, and check latency. A one-row test can hide the problem.

**Optimistic versus pessimistic locking?**  
Optimistic locking detects conflicting versions and requires retry handling. Pessimistic locking reserves database resources earlier and can increase blocking or deadlocks.

---

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

## 8. Cloud and DevOps

### Concepts

#### Docker

Use a multi-stage build to separate compilation from runtime. Run as a non-root user, keep secrets outside images, and use reproducible dependency/image versions in production.

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B clean package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build --chown=app:app \
    /workspace/target/compliance-service.jar /app/app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

Set Maven’s final artifact name accordingly. Pin image digests for reproducibility; the tags above are illustrative.

#### Kubernetes

| Object/concept | Purpose |
|---|---|
| Pod | Smallest scheduling unit; containers share network and volumes |
| Deployment | Manages ReplicaSets and application rollouts |
| Service | Stable access to selected ready endpoints |
| HPA | Adjusts replicas using configured metrics |
| Requests | Scheduling and utilization baseline |
| Limits | Runtime resource bounds |
| Readiness | Whether traffic should reach the pod |
| Liveness | Whether the container should restart |
| Startup probe | Protects slow initialization from premature liveness failures |

Readiness should reflect serving ability. Liveness should not depend on every remote service: a shared database outage should not trigger a fleet-wide restart storm. See [Kubernetes probe documentation](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/).

### Kubernetes example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: compliance
spec:
  replicas: 3
  minReadySeconds: 5
  progressDeadlineSeconds: 120
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: compliance
  template:
    metadata:
      labels:
        app: compliance
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: example/compliance:1.0.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
          startupProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            periodSeconds: 5
            failureThreshold: 30
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: compliance
spec:
  selector:
    app: compliance
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: compliance
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: compliance
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

Enable Actuator probes and graceful shutdown:

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 20s
management:
  endpoint:
    health:
      probes:
        enabled: true
```

CPU-based HPA needs the metrics pipeline and CPU requests. Kafka workers may benefit more from lag-based scaling; partition count still constrains active consumers.

Rolling updates mix old and new versions, so APIs, events, and database changes must remain compatible. `progressDeadlineSeconds` reports a failed rollout; it does not itself perform an automatic rollback. See [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).

### AWS architecture map

| Service | Role | Interview concern |
|---|---|---|
| EC2 | Compute instances | Patching, scaling, availability |
| EKS | Managed Kubernetes control plane | Worker capacity, IAM, networking |
| S3 | Objects, reports, archives | Encryption, lifecycle, access policy |
| IAM | Roles and permissions | Least privilege; temporary credentials |
| SNS | Fan-out notifications | Subscriber failure handling |
| SQS | Durable work queues | Visibility timeout, retries, DLT, duplicates |
| Lambda | Event-driven compute | Cold starts, concurrency, timeout, DB connections |
| API Gateway | Managed API entry | Auth, throttling, integrations |
| CloudWatch | Logs, metrics, alarms | Correlation, retention, actionable alarms |
| RDS/PostgreSQL | Relational persistence | Transactions, indexes, failover |
| DynamoDB | Key-based access | Partition design, conditional writes |
| Secrets Manager/KMS | Secrets and encryption keys | Rotation and access boundaries |

SQS Standard can deliver duplicates. FIFO provides ordering per message group and bounded producer deduplication; application side effects still need idempotency and failure analysis. See [SQS FIFO deduplication](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html).

### Interview questions and answers

**Does Kubernetes guarantee zero downtime?**  
No. Capacity, probes, shutdown, request draining, compatibility, and dependency behavior determine availability.

**How would you explain your Jenkins improvement?**  
Describe the original manual stages, automated build/test/deploy steps, quality gates, rollback approach, and measured release duration.

**Why did Lambda improve your API?**  
Explain the workload and data-access changes. Moving to Lambda alone does not prove better latency.

---

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

## 10. Coding patterns

Put these methods inside a practice class with `import java.util.*;`. State input assumptions before coding and explain the invariant while coding.

### 1. Sliding window

**Recognize:** contiguous ranges, fixed-size sums, longest valid substring.

```java
static long maxWindowSum(int[] values, int k) {
    if (k <= 0 || k > values.length) {
        throw new IllegalArgumentException("Invalid window size");
    }

    long sum = 0;
    for (int i = 0; i < k; i++) {
        sum += values[i];
    }

    long best = sum;
    for (int right = k; right < values.length; right++) {
        sum += values[right];
        sum -= values[right - k];
        best = Math.max(best, sum);
    }
    return best;
}
```

**Complexity:** O(n) time, O(1) space.  
**Practice:** Maximum Average Subarray I; Longest Substring Without Repeating Characters.  
**Q: When does shrinking a sum-based window fail?** With arbitrary negative values, the monotonic property used by many variable-window algorithms disappears.

### 2. Two pointers

**Recognize:** sorted arrays, pair sums, in-place compaction.

```java
static int[] pairSum(int[] sorted, long target) {
    int left = 0;
    int right = sorted.length - 1;

    while (left < right) {
        long sum = (long) sorted[left] + sorted[right];
        if (sum == target) {
            return new int[] { left, right };
        }
        if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
    return new int[] { -1, -1 };
}
```

**Complexity:** O(n) time, O(1) extra space.  
**Practice:** Two Sum II; Container With Most Water.  
**Q: Why is pointer movement correct?** Sorted order lets you eliminate impossible candidates; Container With Most Water uses a different height-based proof.

### 3. Fast/slow pointers

**Recognize:** linked-list cycle, middle node, repeated-state cycles.

```java
static class Node {
    int value;
    Node next;

    Node(int value) {
        this.value = value;
    }
}

static boolean hasCycle(Node head) {
    Node slow = head;
    Node fast = head;

    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) {
            return true;
        }
    }
    return false;
}
```

**Complexity:** O(n) time, O(1) space.  
**Practice:** Linked List Cycle; Linked List Cycle II.  
**Q: Why do they meet?** Inside a cycle, the relative distance changes modulo the cycle length by one per iteration.

### 4. BFS/DFS

**Recognize:** connectivity, traversal, unweighted shortest paths.

```java
static int[] bfsDistances(List<List<Integer>> graph, int start) {
    int[] distance = new int[graph.size()];
    Arrays.fill(distance, -1);

    Queue<Integer> queue = new ArrayDeque<>();
    queue.add(start);
    distance[start] = 0;

    while (!queue.isEmpty()) {
        int node = queue.remove();
        for (int next : graph.get(node)) {
            if (distance[next] == -1) {
                distance[next] = distance[node] + 1;
                queue.add(next); // Mark visited when enqueuing.
            }
        }
    }
    return distance;
}

static void dfs(
        List<List<Integer>> graph, int node, boolean[] visited) {
    visited[node] = true;
    for (int next : graph.get(node)) {
        if (!visited[next]) {
            dfs(graph, next, visited);
        }
    }
}
```

**Complexity:** O(V+E) time, O(V) auxiliary space.  
**Practice:** Number of Islands; Rotting Oranges.  
**Q: When is BFS the shortest-path algorithm?** When edges have equal weight; weighted graphs need another approach. Deep recursive DFS can overflow the stack.

### 5. Topological sort

**Recognize:** prerequisite ordering and directed dependency cycles.

```java
static List<Integer> topologicalOrder(
        List<List<Integer>> graph) {

    int[] indegree = new int[graph.size()];
    for (List<Integer> edges : graph) {
        for (int next : edges) {
            indegree[next]++;
        }
    }

    Queue<Integer> ready = new ArrayDeque<>();
    for (int node = 0; node < graph.size(); node++) {
        if (indegree[node] == 0) {
            ready.add(node);
        }
    }

    List<Integer> order = new ArrayList<>();
    while (!ready.isEmpty()) {
        int node = ready.remove();
        order.add(node);
        for (int next : graph.get(node)) {
            if (--indegree[next] == 0) {
                ready.add(next);
            }
        }
    }

    if (order.size() != graph.size()) {
        throw new IllegalArgumentException("Directed cycle");
    }
    return order;
}
```

**Complexity:** O(V+E) time, O(V) extra space.  
**Practice:** Course Schedule; Course Schedule II.  
**Q: How is a cycle detected?** A cycle prevents all vertices from reaching zero indegree.

### 6. Merge intervals

**Recognize:** overlapping schedules and ranges.

```java
static List<int[]> mergeIntervals(int[][] intervals) {
    Arrays.sort(intervals,
            Comparator.comparingInt(interval -> interval[0]));

    List<int[]> merged = new ArrayList<>();
    for (int[] interval : intervals) {
        if (merged.isEmpty()
                || merged.get(merged.size() - 1)[1] < interval[0]) {
            merged.add(interval.clone());
        } else {
            int[] last = merged.get(merged.size() - 1);
            last[1] = Math.max(last[1], interval[1]);
        }
    }
    return merged;
}
```

**Complexity:** O(n log n) time, O(n) output space.  
**Practice:** Merge Intervals; Insert Interval.  
**Q: Do touching intervals overlap?** This template merges touching closed intervals. For half-open intervals, change the boundary rule deliberately.

### 7. Dynamic programming basics

**Recognize:** repeated subproblems with an optimal-value recurrence.

```java
static int minimumCoins(int[] coins, int amount) {
    if (amount < 0) {
        throw new IllegalArgumentException("Negative amount");
    }
    for (int coin : coins) {
        if (coin <= 0) {
            throw new IllegalArgumentException("Positive coins required");
        }
    }

    int unreachable = amount + 1;
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, unreachable);
    dp[0] = 0;

    for (int value = 1; value <= amount; value++) {
        for (int coin : coins) {
            if (coin <= value && dp[value - coin] != unreachable) {
                dp[value] = Math.min(
                        dp[value], dp[value - coin] + 1);
            }
        }
    }
    return dp[amount] == unreachable ? -1 : dp[amount];
}
```

Assume interview-sized amounts that permit this array allocation.

**Complexity:** O(amount × number of coins) time, O(amount) space.  
**Practice:** Coin Change; House Robber.  
**Q: What should you explain before coding?** State, transition, base case, iteration order, and answer location.

### 8. Heaps

**Recognize:** top K, running priorities, merging sorted streams.

```java
static int kthLargest(int[] values, int k) {
    if (k <= 0 || k > values.length) {
        throw new IllegalArgumentException("Invalid k");
    }

    PriorityQueue<Integer> smallestOfTopK = new PriorityQueue<>();
    for (int value : values) {
        smallestOfTopK.add(value);
        if (smallestOfTopK.size() > k) {
            smallestOfTopK.remove();
        }
    }
    return smallestOfTopK.element();
}
```

**Complexity:** O(n log k) time, O(k) space.  
**Practice:** Kth Largest Element in an Array; Merge k Sorted Lists.  
**Q: Why a min-heap for largest K?** Its root is the weakest retained candidate, which is removed when the heap exceeds K.

**Coding-round checklist:** clarify → example → brute force → invariant → implementation → edge cases → complexity. Test empty inputs where valid, duplicates, overflow, negative values, and boundary conditions.

---

## 11. Behavioral and narrative

The following are practice drafts. Replace bracketed facts with your actual experience. Do not present an invented incident, disagreement, departure reason, or metric.

### “Tell me about yourself”

**Situation:**  
“I’m Vinod, a Java full stack engineer based in Bangalore with over four years of experience in enterprise banking and capital-markets applications.”

**Task:**  
“My work has involved building backend services, integrating data flows, and delivering frontend features.”

**Action:**  
“At SLK, I worked with Java 17, Spring Boot, WebFlux, Angular, and Kafka. More recently, through LanceSoft on Morgan Stanley’s trading-compliance platform, I developed Spring Boot services, Kafka event flows, and MongoDB-based restriction enrichment, including identifying related instruments and applying restriction flags.”

**Result and direction:**  
“My resume includes improvements in query performance, frontend performance, and release automation that I can explain with specific examples. I’m now targeting roles where I can take greater ownership of Java services and full stack delivery, especially in fintech or capital markets.”

Prepare a 60-second version and a two-minute version.

### “Why are you leaving?”

Your resume shows the last role ending in August 2026. If that is correct, frame this as your next move.

**Situation:**  
“My most recent role ended in August 2026 because [actual reason].”

**Task:**  
“I’m looking for the next role that fits my Java full stack and banking experience.”

**Action:**  
“I’m focusing on teams where I can contribute to backend reliability, event-driven workflows, and user-facing features while growing my ownership of design and delivery.”

**Result:**  
“This role interests me because [specific responsibility or product connection].”

Do not claim that a contract ended, the client changed direction, or you resigned unless that is true.

### “Describe a production incident you resolved”

The supplied resume does not identify a specific incident. Use this scaffold for a real one:

**Situation:**  
“During [actual release/time], [specific symptom] affected [actual users or workflow].”

**Task:**  
“My responsibility was [your precise role], and the immediate goal was restoring service while preserving data correctness.”

**Action:**  
“I checked [actual metrics/logs], narrowed the issue to [verified cause], coordinated [actual participants], and applied [rollback/configuration/code/data fix]. I verified recovery through [actual signal] and checked whether any events needed replay or reconciliation.”

**Result:**  
“Service recovered in [measured time]. We then added [actual prevention], and [verified follow-up result].”

If you supported rather than led resolution, say so. Use the 40% downtime figure only if you can explain the baseline, period, and attribution.

### “A time you disagreed with a technical decision”

**Situation:**  
“On [real project], the team proposed [actual decision].”

**Task:**  
“I needed to assess whether it met our performance, correctness, and maintenance needs.”

**Action:**  
“I raised [specific concern], compared alternatives, and used [benchmark, prototype, failure analysis, or design review] to make the discussion concrete. I listened to the constraints behind the original proposal and documented the trade-off.”

**Result:**  
“We chose [actual outcome]. I supported the final decision, and we learned [specific lesson].”

A suitable story might concern query optimization, synchronous versus asynchronous integration, or deployment automation—but use only an event that happened.

### “Explain a short tenure or employment gap”

#### Altimetrik: March–May 2025

**Situation:**  
“My Altimetrik tenure was about three months.”

**Task:**  
“During that period, I completed structured full stack training and strengthened my Java fundamentals.”

**Action:**  
“I completed the training and earned the Oracle Java SE 8 certification with an 86% score.”

**Result:**  
“My next role involved hands-on trading-compliance development. The reason the tenure ended was [actual reason].”

Training explains the work performed, not the departure reason; be ready for both.

#### Since August 2026

As of October 2026, this is roughly a two-month interval, depending on the exact end date.

**Situation:**  
“My last role ended in August 2026.”

**Task:**  
“I have been preparing for a suitable next opportunity.”

**Action:**  
“During this period, I have [actual job-search, study, project, or personal activities].”

**Result:**  
“I’m ready to contribute in a Java full stack role and can discuss the technical work I’ve completed during this period.”

### Interview questions and answers

**Should you memorize these word for word?**  
No. Memorize the facts and structure; keep the delivery conversational.

**How do you make an achievement credible?**  
Name the baseline, change, measurement, sample period, and your contribution.

**How do you explain many technologies on the resume?**  
Separate production depth, supporting exposure, and current learning. Expect deep questions on Java, Spring, Kafka, MongoDB enrichment, SQL, and CI/CD.

---

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

## Interactive animations

The ready-to-open files are below. Their controls and frame progression passed automated checks; the diagrams are teaching models rather than production simulators.

| Animation | File |
|---|---|
| HashMap | [Open HashMap animation](../animations/hashmap.html) |
| Kafka rebalance | [Open Kafka animation](../animations/kafka.html) |
| Circuit breaker | [Open circuit breaker animation](../animations/circuit-breaker.html) |
| Saga | [Open saga animation](../animations/saga.html) |
| Spring proxy | [Open Spring AOP animation](../animations/spring-aop.html) |
| Coding pointers | [Open pointer animation](../animations/pointers.html) |
| Kubernetes rollout | [Open rolling-update animation](../animations/rolling-update.html) |
| JWT | [Open JWT animation](../animations/jwt.html) |

Each code block below is independently runnable, with inline CSS/JavaScript and no external dependencies.

### 1. HashMap put, collisions, resizing, treeification

Save as `hashmap.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HashMap put</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px;white-space:pre-wrap}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>HashMap put</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>Schematic Java 17 put path; tree shape does not show exact red-black rotations.</small>
<script>
const frames=[
["Capacity 4; load factor 0.75; threshold 3.",
 [["Table",["0: empty","1: empty","2: empty","3: empty"]]]],
["A hash=1; spread=h^(h>>>16)=1; index=(4-1)&1=1.",
 [["Hash",["*A → 1 → bucket 1"]]]],
["Put A into empty bucket 1.",
 [["Table",["0: empty","*1: A","2: empty","3: empty"]]]],
["B hash=5; index=3&5=1. Unequal keys form a chain.",
 [["Hash",["*B → 5 → bucket 1"]],["Table",["*1: A → B"]]]],
["Put C(hash 2), D(hash 3). Size 4 exceeds threshold 3.",
 [["Capacity 4",["1: A → B","2: C","*3: D"]]]],
["Double to 8. A stays; B moves because (5 & oldCapacity 4) is nonzero.",
 [["Capacity 8",["1: A","2: C","3: D","*5: B"]],
  ["Split",["hash & oldCapacity = 0: stay","Otherwise: index + oldCapacity"]]]],
["Separate case: capacity 64; eight comparable keys have identical hashes.",
 [["Bucket 1",["*K1 → K2 → K3 → K4 → K5 → K6 → K7 → K8"]]]],
["Ordinary put of K9 attempts treeification. Capacity is at least 64.",
 [["Tree schematic",["*          K5","     K3        K7","  K2   K4   K6    K8","K1                   K9"]],
  ["Constants",["TREEIFY_THRESHOLD=8","MIN_TREEIFY_CAPACITY=64","Below 64: resize instead"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

### 2. Kafka consumer-group rebalancing

Save as `kafka.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kafka rebalancing</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>Kafka rebalancing</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>Classic eager rebalance illustration. Cooperative/new protocols can move fewer partitions.</small>
<script>
const frames=[
["C1 owns all six partitions.",
 [["C1",["*P0 P1 P2 P3 P4 P5"]],["Offsets",["Persist per group and partition"]]]],
["C2 joins; coordinator starts a new generation.",
 [["Coordinator",["*Join / synchronize"]],["C1",["P0–P5"]],["C2",["Waiting"]]]],
["Revoke assignments; handle in-flight work and completed offsets.",
 [["C1",["*P0–P5 revoked"]],["C2",["Waiting"]]]],
["Assignor redistributes partitions.",
 [["C1",["*P0 P1 P2"]],["C2",["*P3 P4 P5"]]]],
["Resume from committed positions; uncommitted work can replay.",
 [["C1",["*Consume P0–P2"]],["C2",["*Consume P3–P5"]]]],
["C2 fails; coordinator detects lost membership.",
 [["C1",["P0 P1 P2"]],["C2",["*Offline"]],["Coordinator",["*Rebalance"]]]],
["C1 acquires all partitions. Deduplicate repeated side effects.",
 [["C1",["*P0 P1 P2 P3 P4 P5"]],["Application",["Event ID → idempotent handling"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

### 3. Circuit breaker transitions

Save as `circuit-breaker.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Circuit breaker</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>Circuit breaker</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>Window=4; minimum calls=4; failure threshold=50%; half-open probes=2. Timing is simulated.</small>
<script>
const frames=[
["Closed permits request 1; success is recorded.",
 [["Client",["*Request → breaker"]],["CLOSED",["*Allow → dependency","Window: S"]]]],
["Request 2 fails; not enough samples to evaluate.",
 [["CLOSED",["*Allow → failure","Window: S F"]]]],
["Request 3 succeeds; still below minimum calls.",
 [["CLOSED",["*Allow → success","Window: S F S"]]]],
["Request 4 fails. 2/4 failures reaches 50%; open.",
 [["OPEN",["*Window: S F S F","Block future calls"]]]],
["Next request is rejected locally; dependency receives no call.",
 [["Client",["*CallNotPermittedException"]],["OPEN",["*Blocked"]],["Dependency",["No request"]]]],
["Wait expires; next call enters half-open. Probe 1 succeeds.",
 [["HALF-OPEN",["*Probe 1 → success","Two probes permitted"]]]],
["Probe 2 succeeds; close and reset the closed window.",
 [["CLOSED",["*Probe 2 → success","Resume normal traffic"]]]],
["Alternative branch: one of two probes fails; reopen at 50%.",
 [["HALF-OPEN",["Probe 1: success","*Probe 2: failure"]],["OPEN",["*Wait again"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

### 4. Saga success and compensation

Save as `saga.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Saga orchestration</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>Saga orchestration</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>Compensations are new local transactions. A settled payment needs refund semantics.</small>
<script>
const frames=[
["Success branch: persist saga S1 as STARTED.",
 [["Orchestrator",["*S1 STARTED"]],["Inventory",["Available"]],["Payment",["Not authorized"]]]],
["Reserve inventory in a local transaction.",
 [["Orchestrator",["*Command S1/1"]],["Inventory",["*Reserved → success event"]]]],
["Authorize payment using an idempotency key.",
 [["Orchestrator",["*Command S1/2"]],["Payment",["*Authorized → success event"]]]],
["Confirm order; persist COMPLETED.",
 [["Order",["*CONFIRMED"]],["Orchestrator",["*S1 COMPLETED"]]]],
["Failure branch S2: reservation and authorization succeeded; confirmation fails.",
 [["Inventory",["Reserved"]],["Payment",["Authorized"]],["Order",["*Failed"]],["Orchestrator",["*COMPENSATING"]]]],
["Void authorization: compensate completed actions in reverse order.",
 [["Payment",["*Authorization voided"]],["Inventory",["Still reserved"]]]],
["Release inventory; persist COMPENSATED.",
 [["Inventory",["*Reservation released"]],["Orchestrator",["*S2 COMPENSATED"]]]],
["Alternative: failed compensation remains durable and is retried or escalated.",
 [["Orchestrator",["*COMPENSATION_PENDING"]],["Recovery",["Idempotent retries","Deadlines and manual review"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

### 5. Spring AOP and self-invocation

Save as `spring-aop.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spring proxy and self-invocation</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>Spring proxy and self-invocation</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>outer() has no transaction; public inner() is annotated @Transactional. Proxy mode.</small>
<script>
const frames=[
["Controller holds a proxy wrapping the service target.",
 [["Controller",["*service.outer()"]],["Proxy",["Transaction interceptor"]],["Target",["outer()","@Transactional inner()"]]]],
["Call enters proxy; outer() has no transaction metadata.",
 [["Proxy",["*No transaction started"]],["Target",["outer() executing"]]]],
["outer() invokes this.inner(); receiver is the target.",
 [["Target",["*outer() → this.inner()"]],["Proxy",["Bypassed"]]]],
["inner() runs; its annotation was not intercepted.",
 [["Target",["*@Transactional inner()"]],["Transaction",["None in this example"]]]],
["Fix: inject another Spring service and call its proxy.",
 [["Outer service",["*innerService.inner()"]],["Inner proxy",["*BEGIN"]],["Inner target",["Perform writes"]]]],
["Interceptor commits or rolls back according to outcome and rollback rules.",
 [["Inner target",["Return / throw"]],["Inner proxy",["*COMMIT / ROLLBACK"]]]],
["If outer already has a transaction, self-called inner runs in it.",
 [["Existing transaction",["*Shared with inner"]],["Caveat",["Inner propagation/isolation annotation still bypassed"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

### 6. Sliding window and two-pointer movement

Save as `pointers.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sliding window and two pointers</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px;white-space:pre-wrap}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>Sliding window and two pointers</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>Two separate algorithms: fixed window size 3; unique pair enumeration with target 6.</small>
<script>
const frames=[
["Window [0,2]: sum 6.",
 [["Array",["*1[L]  2  3[R]  4  5"]],["Window",["sum=1+2+3=6","best=6"]]]],
["Move window right: subtract outgoing 1, add incoming 4.",
 [["Array",["*1  2[L]  3  4[R]  5"]],["Window",["sum=6−1+4=9","best=9"]]]],
["Move again: subtract 2, add 5.",
 [["Array",["*1  2  3[L]  4  5[R]"]],["Window",["sum=9−2+5=12","best=12"]]]],
["Reset for two pointers: L=0,R=4; 1+5=6.",
 [["Array",["*1[L]  2  3  4  5[R]"]],["Pairs",["Found (1,5); move both"]]]],
["L=1,R=3; 2+4=6.",
 [["Array",["*1  2[L]  3  4[R]  5"]],["Pairs",["Found (2,4); move both"]]]],
["Pointers meet: stop; cannot use one element twice.",
 [["Array",["*1  2  3[L=R]  4  5"]],["Rules",["sum < target: L++","sum > target: R--","Requires sorted input"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

### 7. Kubernetes rolling update

Save as `rolling-update.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kubernetes rolling update</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>Kubernetes rolling update</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>Replicas=3, maxSurge=1, maxUnavailable=0. Assume capacity and healthy new pods.</small>
<script>
const frames=[
["Three v1 pods are Ready.",
 [["v1",["*A Ready","*B Ready","*C Ready"]],["v2",["None"]],["Endpoints",["A B C"]]]],
["Create D(v2). It exists but is not Ready.",
 [["v1",["A Ready","B Ready","C Ready"]],["v2",["*D Starting"]],["Endpoints",["A B C"]]]],
["D becomes Ready and joins traffic.",
 [["v1",["A Ready","B Ready","C Ready"]],["v2",["*D Ready"]],["Endpoints",["A B C D"]]]],
["Drain A; create E. Three Ready pods remain.",
 [["v1",["*A Terminating","B Ready","C Ready"]],["v2",["D Ready","*E Starting"]],["Endpoints",["B C D"]]]],
["E becomes Ready; drain B and create F.",
 [["v1",["*B Terminating","C Ready"]],["v2",["D Ready","E Ready","*F Starting"]],["Endpoints",["C D E"]]]],
["F becomes Ready; drain C.",
 [["v1",["*C Terminating"]],["v2",["*D Ready","*E Ready","*F Ready"]],["Endpoints",["D E F"]]]],
["Rollout completes; unhealthy new pods would stall progress.",
 [["v2",["*D Ready","*E Ready","*F Ready"]],["Rules",["Readiness gates traffic","Graceful shutdown drains work","Terminating pods may temporarily raise total pod count"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

### 8. JWT authentication flow

Save as `jwt.html`, then double-click it to open in your browser.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>JWT authentication</title>
<style>
body{font:16px system-ui;background:#101827;color:#eef3ff;max-width:1000px;margin:32px auto;padding:16px}
button{padding:10px 16px;margin:4px;cursor:pointer}
#stage{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}
section{background:#1e2b42;padding:16px;border-radius:12px;flex:1;min-width:180px}
.node{padding:12px;margin:8px 0;background:#314967;border-radius:6px}
.active{background:#12674f}small{color:#bdcce5}
</style>
<h1>JWT authentication</h1>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="step">Step</button><button id="reset">Reset</button>
<div id="stage"></div><p id="caption" aria-live="polite"></p>
<small>Browser flow uses Authorization Code + PKCE. Access-token audience must cover the intended API.</small>
<script>
const frames=[
["Client begins login with a PKCE challenge.",
 [["Client",["*Generate verifier and challenge"]],["Identity provider",["Authenticate user"]]]],
["Exchange returned code and verifier for tokens.",
 [["Client",["*Code + verifier → token endpoint"]],["Identity provider",["*Signed access JWT"]]]],
["Client sends access token to gateway over TLS.",
 [["Client",["*Authorization: Bearer token"]],["Gateway",["Validate allowed algorithm, signature, issuer, time, audience"]]]],
["Gateway routes request; service validates the propagated token.",
 [["Gateway",["*Authenticated → route"]],["Service",["*Independent token validation"]]]],
["Service checks scope and tenant/resource ownership.",
 [["Service",["*compliance.read","*Account/tenant permission"]],["Client",["200 response"]]]],
["Invalid signature, issuer, audience, or expired token fails authentication.",
 [["Gateway / service",["*401 Unauthorized"]],["Client",["Use permitted identity-provider refresh flow"]]]],
["Valid token without required permission is denied.",
 [["Service",["*403 Forbidden"]],["Remember",["Signed does not mean encrypted","Use access token, not ID token","Do not trust unsigned identity headers"]]]]
];
let i=0,t=null;
const stage=document.getElementById("stage");
function draw(){
 stage.replaceChildren();
 for(const [title,items] of frames[i][1]){
  const box=document.createElement("section"),h=document.createElement("h2");
  h.textContent=title;box.append(h);
  for(const text of items){
   const n=document.createElement("div");
   n.className="node"+(text.startsWith("*")?" active":"");
   n.textContent=text.replace(/^\*/,"");box.append(n);
  }stage.append(box);
 }
 document.getElementById("caption").textContent=
  `${i+1}/${frames.length} — ${frames[i][0]}`;
 document.getElementById("step").disabled=i===frames.length-1;
}
function pause(){clearInterval(t);t=null}
function step(){if(i<frames.length-1){i++;draw()}if(i===frames.length-1)pause()}
document.getElementById("play").onclick=()=>{
 if(t!==null)return;if(i===frames.length-1)i=0;
 draw();t=setInterval(step,1500);
};
document.getElementById("pause").onclick=pause;
document.getElementById("step").onclick=()=>{pause();step()};
document.getElementById("reset").onclick=()=>{pause();i=0;draw()};
draw();
</script>
</html>
```

---

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