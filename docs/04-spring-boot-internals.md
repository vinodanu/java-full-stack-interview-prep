[Repository home](../README.md) · [Previous chapter](03-solid-and-design-patterns.md) · [Next chapter](05-jpa-and-hibernate.md)

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
