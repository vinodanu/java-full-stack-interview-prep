[Repository home](../README.md) · [Previous chapter](02-core-java-internals.md) · [Next chapter](04-spring-boot-internals.md)

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
