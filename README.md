# Java Full Stack Interview Preparation

A Java 17 interview preparation guide tailored to Vinod Kumar Anantha's four-plus years of banking, fintech, and capital-markets experience. It covers backend and full stack topics, practical code, interview answers, system design, and eight interactive browser animations.

https://vinodanu.github.io/java-full-stack-interview-prep/

## Start here

1. Read the [profile and achievement evidence checklist](docs/profile-and-evidence.md).
2. Follow the chapters below or use the [complete guide](docs/complete-guide.md).
3. Work through the [four-week study plan](docs/study-plan.md).
4. Open [index.html](index.html) locally to explore the animation gallery.
5. Rehearse the [25-question mock interview](docs/12-mock-interview.md).

## Chapters

| Chapter | Topic |
| --- | --- |
| 01 | [Java 17 deep dive](docs/01-java-17.md) |
| 02 | [Core Java internals](docs/02-core-java-internals.md) |
| 03 | [SOLID and design patterns](docs/03-solid-and-design-patterns.md) |
| 04 | [Spring Boot internals](docs/04-spring-boot-internals.md) |
| 05 | [JPA and Hibernate](docs/05-jpa-and-hibernate.md) |
| 06 | [Microservices and distributed systems](docs/06-microservices-and-distributed-systems.md) |
| 07 | [Kafka](docs/07-kafka.md) |
| 08 | [Cloud and DevOps](docs/08-cloud-and-devops.md) |
| 09 | [System design practice](docs/09-system-design.md) |
| 10 | [Coding patterns](docs/10-coding-patterns.md) |
| 11 | [Behavioral and narrative](docs/11-behavioral-and-narrative.md) |
| 12 | [25-question mock interview](docs/12-mock-interview.md) |

## Interactive animations

All animations are self-contained HTML files with inline CSS and JavaScript. Each has Play, Pause, Step, and Reset controls, plus captions. No installation, backend, or network connection is required to run them.

- [HashMap put operations](animations/hashmap.html): Hashing, collision chaining, resizing, and treeification.
- [Kafka consumer rebalancing](animations/kafka.html): Partition ownership when consumers join or leave.
- [Circuit breaker](animations/circuit-breaker.html): Closed, Open, and Half-Open request flow.
- [Saga orchestration](animations/saga.html): Successful execution and compensating transactions.
- [Spring proxy-based AOP](animations/spring-aop.html): Why self-invocation bypasses transaction advice.
- [Sliding window and two pointers](animations/pointers.html): Step-by-step movement on a sample array.
- [Kubernetes rolling update](animations/rolling-update.html): Readiness and old/new pod replacement.
- [JWT authentication](animations/jwt.html): Client, identity provider, gateway, and service flow.

Download/clone the repository and double-click `index.html` or any file under `animations/`. GitHub's file view displays HTML source; it does not run the animations.

## Layout

```text
java-full-stack-interview-prep/
├── README.md
├── index.html                  # Offline animation gallery
├── docs/                       # 12 chapters, complete guide, profile, study plan
├── animations/                 # Eight standalone interactive HTML files
├── scripts/                    # Animation and local-link checks
└── .github/workflows/          # GitHub Actions validation
```

## Validation

Node.js 20 or later is needed only for checks, not for viewing animations:

```sh
node scripts/check-animations.cjs
node scripts/check-links.cjs
```

The animation check runs the inline scripts with a lightweight DOM model and verifies rendering, controls, final-state behavior, and reset. It is not a browser layout or accessibility audit. The link check verifies local Markdown and HTML file targets.

## Version and interview accuracy

- Java examples target Java 17. The pattern-matching switch example is explicitly preview-only.
- Sequenced collections are discussed for version awareness but are not used in Java 17 examples.
- Spring examples assume Boot 3.x, Framework 6.x, and Jakarta Persistence; most are independent snippets, not one compilable application.
- Diagrams simplify implementation details and document their assumptions.
- Behavioral drafts include placeholders for facts not established by the supplied resume. Use only verified achievements and real incidents.
- Spring AI/RAG is presented as exploration, not an invented production accomplishment.

Official technical references are linked beside the relevant explanations. No credentials, raw chat logs, phone number, or full resume are included.
