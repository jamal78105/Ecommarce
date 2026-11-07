# E-Commerce Platform — System Architecture

**Document Version:** 1.0
**Status:** Draft / Initial Architecture
**Architecture Style:** Microservices
**Runtime:** Node.js
**Language:** TypeScript
**HTTP Framework:** Express
**ORM:** Prisma
**Primary Database:** PostgreSQL
**Package Manager:** pnpm

---

# 1. Project Overview

This project is a production-oriented E-Commerce platform built using Node.js and TypeScript.

The system follows a Microservices Architecture where business capabilities are divided into independently deployable services.

The primary goals are:

* Maintain clear business boundaries.
* Allow services to evolve independently.
* Keep each service responsible for its own data.
* Support horizontal scalability.
* Provide reliable communication between services.
* Implement secure authentication and authorization.
* Support asynchronous event-driven workflows where appropriate.
* Provide production-grade observability, testing, and deployment practices.

The project is also designed as a learning-oriented production simulation. Architectural decisions will therefore be explicitly documented, including their trade-offs, alternatives, and possible future changes.

---

# 2. Architectural Principles

The system will follow these principles.

## 2.1 Service Independence

Each Microservice should own a clearly defined business capability.

A service should not directly access another service's database.

For example:

```text
Order Service
      │
      X
      │
      X──────> Product Database
```

This is not allowed.

Instead:

```text
Order Service
      │
      │ API / Event
      ▼
Product Service
      │
      ▼
Product Database
```

---

## 2.2 Database Ownership

Each service owns its own data.

Logical databases will be separated even when they run on the same PostgreSQL instance during development.

Example:

```text
PostgreSQL
│
├── auth_db
├── product_db
├── inventory_db
├── order_db
└── payment_db
```

The physical infrastructure may later be separated when scaling or operational requirements justify it.

---

## 2.3 Business Logic Must Not Depend Directly on Prisma

The application follows:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Prisma
    ↓
PostgreSQL
```

The Service layer contains business logic.

The Repository layer handles persistence.

The Controller handles HTTP concerns.

---

## 2.4 Repository Pattern

Repositories will be implemented as Classes.

We will not introduce repository interfaces by default.

Example:

```text
UserRepository
       ↓
     Prisma
       ↓
   PostgreSQL
```

The repository implementation will encapsulate database operations.

Example structure:

```text
auth/
├── auth.controller.ts
├── auth.service.ts
├── auth.repository.ts
├── auth.routes.ts
├── auth.schema.ts
└── auth.types.ts
```

---

## 2.5 Avoid Unnecessary Abstraction

The project will not introduce an abstraction simply because it is commonly associated with Clean Architecture.

Every abstraction should have a clear purpose.

Before introducing an abstraction, we will consider:

* What problem does it solve?
* What complexity does it introduce?
* What is the alternative?
* Is the abstraction justified by the current system?

---

# 3. Technology Stack

## 3.1 Backend

```text
Node.js
TypeScript
Express
```

Express will be used as the HTTP framework for all backend services unless a documented architectural decision changes this later.

---

## 3.2 Database

```text
PostgreSQL
```

PostgreSQL is the primary relational database.

Each Microservice owns its own logical data.

---

## 3.3 ORM

```text
Prisma
```

Prisma will be used as the initial database access layer.

Repositories will encapsulate Prisma operations.

---

## 3.4 Cache

```text
Redis
```

Redis will be introduced where caching, sessions, rate limiting, or other low-latency temporary storage requirements justify its use.

Redis will not automatically become the source of truth for business data.

---

## 3.5 Validation

```text
Zod
```

Zod will be used for request and input validation.

Validation will happen at the application boundary before data reaches business logic.

---

## 3.6 Logging

```text
Pino
```

Structured logging will be used instead of uncontrolled `console.log` statements in production code.

---

## 3.7 Testing

The initial testing stack will include:

```text
Vitest
Supertest
Testcontainers
```

Different testing levels will be used:

```text
Unit Tests
Integration Tests
End-to-End Tests
```

---

## 3.8 Containerization

```text
Docker
Docker Compose
```

Docker Compose will initially be used for local development and integration environments.

Kubernetes will be considered later when the operational requirements justify it.

---

## 3.9 Package Management

```text
pnpm
pnpm Workspaces
```

The project will initially use a Monorepo structure.

---

# 4. High-Level Architecture

The initial architecture is:

```text
                         ┌─────────────────┐
                         │     Client      │
                         │ Web / Mobile    │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   API Gateway   │
                         └────────┬────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
 ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
 │ Auth Service   │      │ Product        │      │ Order Service  │
 │                │      │ Service        │      │                │
 └───────┬────────┘      └───────┬────────┘      └───────┬────────┘
         │                        │                       │
         ▼                        ▼                       ▼
    ┌─────────┐             ┌──────────┐            ┌──────────┐
    │ Auth DB │             │Product DB│            │ Order DB │
    └─────────┘             └──────────┘            └──────────┘
                                  │
                                  ▼
                         ┌────────────────┐
                         │   Inventory    │
                         │    Service     │
                         └───────┬────────┘
                                 │
                                 ▼
                           ┌─────────────┐
                           │ Inventory DB│
                           └─────────────┘
```

Additional services will be introduced as the system evolves.

---

# 5. Initial Business Domains

The initial business domains are:

```text
Identity
Users
Catalog
Inventory
Cart
Order
Payment
Shipping
Notification
```

These domains represent business capabilities, not necessarily the final number of Microservices.

A domain may remain part of another service if separating it would introduce unnecessary complexity.

---

# 6. Initial Microservices

The initial service candidates are:

```text
auth-service
product-service
inventory-service
order-service
payment-service
```

Additional services may be introduced later.

For example:

```text
notification-service
shipping-service
search-service
```

will only become independent services when their requirements justify independent deployment and ownership.

---

# 7. Service Responsibilities

## 7.1 Auth Service

Responsible for:

* User authentication.
* Password hashing.
* Login.
* Access tokens.
* Refresh tokens.
* Refresh token rotation.
* Sessions.
* Logout.
* Session revocation.
* Authentication-related security.

The Auth Service owns authentication-related persistence.

---

## 7.2 Product Service

Responsible for:

* Products.
* Categories.
* Product descriptions.
* Product images.
* Product status.
* Product metadata.

The Product Service owns product catalog data.

---

## 7.3 Inventory Service

Responsible for:

* Stock quantities.
* Inventory items.
* Stock reservations.
* Inventory release.
* Inventory adjustments.

The Inventory Service owns inventory data.

---

## 7.4 Order Service

Responsible for:

* Creating orders.
* Order lifecycle.
* Order items.
* Order status.
* Order history.
* Checkout orchestration.

The Order Service owns order data.

---

## 7.5 Payment Service

Responsible for:

* Payment creation.
* Payment status.
* Payment provider integration.
* Payment confirmation.
* Payment failure.
* Refund workflows.

The Payment Service owns payment-related data.

---

# 8. Service Communication

There will be two primary communication styles.

## 8.1 Synchronous Communication

Used when the caller needs an immediate response.

Example:

```text
Client
  │
  │ HTTP
  ▼
API Gateway
  │
  │ HTTP
  ▼
Product Service
```

REST APIs will be the initial synchronous communication mechanism.

---

## 8.2 Asynchronous Communication

Used when the operation can be processed asynchronously or when multiple services need to react to an event.

Example:

```text
Order Service
      │
      │ OrderCreated
      ▼
 Message Broker
      │
 ┌────┼─────────────┐
 ▼    ▼             ▼
Inventory        Notification
Service          Service
```

A message broker will be introduced when the project reaches the stage where asynchronous communication provides a real architectural benefit.

The specific broker will be decided later after comparing available alternatives.

---

# 9. Data Ownership

The system follows:

> A service owns its data and other services interact with that data through the service boundary.

Example:

```text
Product Service
      │
      ▼
Product DB
```

The Order Service must not execute:

```sql
SELECT * FROM products;
```

against the Product Service's database.

Instead:

```text
Order Service
      │
      │ API / Event
      ▼
Product Service
```

This preserves service ownership.

---

# 10. Internal Service Architecture

Each service will initially follow this structure:

```text
HTTP Request
     │
     ▼
┌─────────────────┐
│    Controller   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Service     │
│ Business Logic  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │
│      Class      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      Prisma     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘
```

---

# 11. Controller Responsibilities

Controllers are responsible for HTTP-related concerns.

They should:

* Receive the request.
* Extract input.
* Trigger validation.
* Call the Service.
* Return the appropriate response.
* Handle HTTP-specific concerns.

Controllers should not contain business rules.

Bad example:

```typescript
const user = await prisma.user.findUnique(...);

if (user.balance > 1000) {
  // business rule
}
```

Business rules belong in the Service layer.

---

# 12. Service Responsibilities

The Service layer contains business logic.

Example:

```text
AuthService
    │
    ├── Validate credentials
    ├── Verify password
    ├── Create session
    ├── Generate tokens
    └── Return authentication result
```

The Service should not be responsible for HTTP response formatting.

---

# 13. Repository Responsibilities

The Repository is responsible for persistence operations.

Example:

```text
UserRepository
    │
    ├── findById()
    ├── findByEmail()
    ├── create()
    ├── update()
    └── delete()
```

The Repository hides Prisma-specific operations from the Service layer.

The Repository itself will be implemented as a Class.

Example:

```typescript
export class UserRepository {
  constructor(
    private readonly prisma: PrismaClient
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}
```

---

# 14. Monorepo Structure

The project will initially use:

```text
ecommerce/
│
├── apps/
│   ├── auth-service/
│   ├── product-service/
│   ├── inventory-service/
│   ├── order-service/
│   └── payment-service/
│
├── packages/
│   ├── config/
│   ├── logger/
│   ├── errors/
│   └── types/
│
├── docs/
│
├── docker/
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

The shared packages will remain intentionally small.

We will avoid creating a large shared package that couples all Microservices together.

---

# 15. Documentation Architecture

Documentation is a first-class part of the project.

Every major architectural decision, implementation area, and Sprint will have corresponding Markdown documentation.

Initial structure:

```text
docs/
│
├── architecture/
│   ├── system-architecture.md
│   ├── service-boundaries.md
│   ├── data-ownership.md
│   └── communication-patterns.md
│
├── decisions/
│   ├── 001-express.md
│   ├── 002-repository-pattern.md
│   ├── 003-no-repository-interfaces.md
│   └── 004-monorepo.md
│
├── sprints/
│   ├── sprint-00.md
│   ├── sprint-01.md
│   └── ...
│
├── services/
│   ├── auth-service.md
│   ├── product-service.md
│   ├── inventory-service.md
│   ├── order-service.md
│   └── payment-service.md
│
├── database/
├── security/
├── testing/
├── infrastructure/
└── operations/
```

---

# 16. Architectural Decision Records

Important architectural decisions will be documented using ADR-style Markdown files.

Each ADR should contain:

```text
Decision
Context
Alternatives
Reasons
Trade-offs
Consequences
When to Reconsider
```

Example:

```text
ADR
 │
 ├── Context
 ├── Decision
 ├── Alternatives
 ├── Trade-offs
 ├── Consequences
 └── Revisit Conditions
```

This prevents architectural decisions from becoming undocumented assumptions.

---

# 17. Initial Architectural Trade-offs

## 17.1 Express vs Fastify

### Decision

Use Express.

### Benefit

* Mature ecosystem.
* Large community.
* Extensive middleware ecosystem.
* Familiar programming model.
* Appropriate for the project's requirements.

### Cost

* Some performance characteristics may differ from alternatives.
* More responsibility may remain with the application for selecting middleware and architecture.

### Reconsider When

If future requirements demonstrate that Express is creating a measurable bottleneck or operational limitation, the decision can be revisited.

---

## 17.2 Repository Pattern

### Decision

Use Repository Pattern.

### Benefit

It separates persistence concerns from business logic.

The Service does not need to know how Prisma queries are constructed.

### Cost

Additional classes and an additional abstraction layer are introduced.

### Reconsider When

If the Repository layer becomes a simple pass-through for almost every operation without providing meaningful separation, the architecture should be reviewed.

---

## 17.3 Repository Interfaces

### Decision

Do not use repository interfaces initially.

Repositories will be concrete Classes.

Example:

```text
UserService
     │
     ▼
UserRepository
     │
     ▼
Prisma
```

### Benefit

* Less boilerplate.
* Fewer files.
* Simpler dependency graph.
* Faster development.

### Cost

* Less flexibility for replacing implementations.
* Testing may require a different mocking strategy.
* Stronger coupling between the Service and the concrete Repository class.

### Reconsider When

If multiple repository implementations become a real requirement, interfaces may be introduced at that point.

---

## 17.4 Monorepo

### Decision

Use a Monorepo initially.

### Benefit

* Easier development.
* Shared tooling.
* Centralized configuration.
* Easier refactoring.
* Easier local development.

### Cost

* CI/CD requires careful service-specific pipelines.
* Shared packages can create unwanted coupling.
* Repository size increases as services grow.

### Reconsider When

If organizational or operational requirements demand independent repositories, a Polyrepo architecture may be considered.

---

## 17.5 Database per Service

### Decision

Use logical database ownership per service.

During development, databases may exist within the same PostgreSQL instance.

### Benefit

* Clear ownership.
* Reduced direct database coupling.
* Easier future physical separation.

### Cost

* More complex data consistency.
* Cross-service queries are not allowed.
* Distributed workflows become more complicated.

### Reconsider When

Physical database separation may be introduced when scaling, security, compliance, or operational requirements justify it.

---

# 18. Consistency Model

The system will not assume that all distributed operations are immediately consistent.

Within a single service and database transaction, strong consistency can be used.

Across multiple services, eventual consistency may be required.

Example:

```text
Order Created
      │
      ▼
Payment Processing
      │
      ▼
Inventory Reservation
      │
      ▼
Notification
```

These operations may not all complete inside one database transaction.

Distributed transaction strategies will be addressed later.

Potential approaches include:

```text
Saga Pattern
Outbox Pattern
Idempotency
Compensation
```

The specific approach will be selected based on the actual workflow.

---

# 19. Security Principles

Security will be considered from the beginning rather than added at the end.

Initial principles include:

* Passwords must never be stored in plaintext.
* Authentication tokens must have controlled lifetimes.
* Refresh token rotation will be implemented.
* Sessions must be revocable.
* Input must be validated.
* Sensitive configuration must use environment variables or secret management.
* Authorization must be enforced at the service boundary.
* Rate limiting will be considered for sensitive endpoints.
* Logs must not expose secrets or sensitive credentials.

---

# 20. Testing Strategy

Testing will exist at multiple levels.

## Unit Tests

Test business logic in isolation.

```text
AuthService
OrderService
PaymentService
```

## Integration Tests

Test interaction with infrastructure.

```text
Service
   ↓
Repository
   ↓
PostgreSQL
```

## End-to-End Tests

Test complete user flows.

Example:

```text
Register
   ↓
Login
   ↓
Browse Product
   ↓
Add Cart
   ↓
Checkout
   ↓
Payment
   ↓
Order Confirmation
```

---

# 21. Observability

Production observability will eventually include:

```text
Logs
Metrics
Traces
```

Potential technologies:

```text
Pino
OpenTelemetry
Prometheus
Grafana
```

These technologies will be introduced when the project reaches the corresponding operational requirements.

---

# 22. Deployment Strategy

The initial environment:

```text
Developer Machine
       │
       ▼
Docker Compose
       │
       ├── PostgreSQL
       ├── Redis
       ├── Services
       └── Message Broker
```

Later:

```text
CI/CD
  │
  ▼
Container Registry
  │
  ▼
Production Infrastructure
```

Kubernetes will be considered as a later stage rather than being introduced immediately.

---

# 23. Architecture Evolution

The architecture is not considered permanently fixed.

The project will evolve through Sprints.

Initial:

```text
Microservices
+
REST
+
PostgreSQL
+
Prisma
+
Repository Classes
```

Later, based on actual requirements:

```text
Redis
     ↓
Message Broker
     ↓
Outbox Pattern
     ↓
Saga
     ↓
Observability
     ↓
Kubernetes
```

Each major architectural change must be documented.

---

# 24. Definition of Done for Architecture

The initial architecture phase is considered complete when:

* [ ] Business domains are identified.
* [ ] Initial service boundaries are documented.
* [ ] Data ownership is documented.
* [ ] Communication strategy is documented.
* [ ] Repository architecture is documented.
* [ ] Major trade-offs are documented.
* [ ] Monorepo structure is defined.
* [ ] Documentation structure is defined.
* [ ] Initial technology stack is documented.
* [ ] Architecture diagram is available.
* [ ] Sprint 0 documentation is completed.

---

# 25. Next Step

After this document is reviewed and accepted, the next step is:

**Sprint 0 — Step 2: Domain Decomposition & Service Boundaries**

We will determine exactly:

```text
Which domain belongs to which service?

Who owns each entity?

Which database stores each entity?

Which service is allowed to communicate with which service?

Which communication is synchronous?

Which communication is asynchronous?

Which operations require transactions?

Which operations can use eventual consistency?
```

No production service implementation should begin until these boundaries are sufficiently clear.

---

# 26. Architecture Decision Summary

Current decisions:

| Decision                  | Choice                              |
| ------------------------- | ----------------------------------- |
| Runtime                   | Node.js                             |
| Language                  | TypeScript                          |
| HTTP Framework            | Express                             |
| Architecture              | Microservices                       |
| Repository Pattern        | Yes                                 |
| Repository Implementation | Concrete Classes                    |
| Repository Interfaces     | No, initially                       |
| ORM                       | Prisma                              |
| Database                  | PostgreSQL                          |
| Cache                     | Redis                               |
| API Style                 | REST                                |
| Validation                | Zod                                 |
| Logging                   | Pino                                |
| Testing                   | Vitest + Supertest + Testcontainers |
| Package Manager           | pnpm                                |
| Repository Structure      | Monorepo                            |
| Containerization          | Docker                              |
| Local Orchestration       | Docker Compose                      |
| Documentation             | Markdown                            |
| Architecture Decisions    | ADR-style Markdown                  |
| Database Ownership        | Per Service                         |
| Async Communication       | Introduced when justified           |
| Kubernetes                | Later stage                         |
| Observability             | Later stage                         |

---

# 27. Current Status

```text
Architecture Design
        │
        ▼
      Sprint 0
        │
        ├── Requirements        [Pending]
        ├── Domain Decomposition [Pending]
        ├── Service Boundaries   [Pending]
        ├── Data Ownership       [Pending]
        ├── Communication        [Pending]
        └── Project Bootstrap    [Pending]
```

The architecture described in this document represents the current baseline and may evolve as the project progresses.

Every significant change should be documented through an updated architecture document or an Architecture Decision Record (ADR).
