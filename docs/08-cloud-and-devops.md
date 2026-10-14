[Repository home](../README.md) · [Previous chapter](07-kafka.md) · [Next chapter](09-system-design.md)

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
