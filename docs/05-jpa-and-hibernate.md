[Repository home](../README.md) · [Previous chapter](04-spring-boot-internals.md) · [Next chapter](06-microservices-and-distributed-systems.md)

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
