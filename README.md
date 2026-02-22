# @predicatesystems/temporal

Temporal.io Worker Interceptor for Predicate Authority Zero-Trust authorization.

**Powered by [predicate-authority](https://github.com/PredicateSystems/predicate-authority) SDK:** [Python](https://github.com/PredicateSystems/predicate-authority) | [TypeScript](https://github.com/PredicateSystems/predicate-authority-ts)

This package provides a pre-execution security gate for all Temporal Activities, enforcing cryptographic authorization mandates before any activity code runs.

## Sidecar Prerequisite

This package requires the **Predicate Authority Sidecar** daemon to be running. The sidecar is a high-performance Rust binary that handles policy evaluation and mandate signing locally—no data leaves your infrastructure.

| Resource | Link |
|----------|------|
| Sidecar Repository | [predicate-authority-sidecar](https://github.com/PredicateSystems/predicate-authority-sidecar) |
| Download Binaries | [Latest Releases](https://github.com/PredicateSystems/predicate-authority-sidecar/releases) |
| License | MIT / Apache 2.0 |

### Quick Sidecar Setup

**Option A: Docker (Recommended)**
```bash
docker run -d -p 8787:8787 ghcr.io/predicatesystems/predicate-authorityd:latest
```

**Option B: Download Binary**
```bash
# macOS (Apple Silicon)
curl -fsSL https://github.com/PredicateSystems/predicate-authority-sidecar/releases/latest/download/predicate-authorityd-darwin-arm64.tar.gz | tar -xz
chmod +x predicate-authorityd
./predicate-authorityd --port 8787 --policy-file policy.json

# Linux x64
curl -fsSL https://github.com/PredicateSystems/predicate-authority-sidecar/releases/latest/download/predicate-authorityd-linux-x64.tar.gz | tar -xz
chmod +x predicate-authorityd
./predicate-authorityd --port 8787 --policy-file policy.json
```

See [all platform binaries](https://github.com/PredicateSystems/predicate-authority-sidecar/releases) for Linux ARM64, macOS Intel, and Windows.

**Verify it's running:**
```bash
curl http://localhost:8787/health
# {"status":"ok"}
```

## Installation

```bash
npm install @predicatesystems/temporal
# or
yarn add @predicatesystems/temporal
# or
pnpm add @predicatesystems/temporal
```

## Quick Start

```typescript
import { Worker } from "@temporalio/worker";
import { AuthorityClient } from "@predicatesystems/authority";
import { createPredicateInterceptors } from "@predicatesystems/temporal";

// Initialize the Predicate Authority client
const authorityClient = new AuthorityClient({
  baseUrl: "http://127.0.0.1:8787",
});

// Create interceptors
const interceptors = createPredicateInterceptors({
  authorityClient,
  principal: "temporal-worker",
});

// Create worker with the interceptors
const worker = await Worker.create({
  connection,
  namespace: "default",
  taskQueue: "my-task-queue",
  workflowsPath: require.resolve("./workflows"),
  activities,
  interceptors,
});
```

## How It Works

The interceptor sits in the Temporal activity execution pipeline:

1. Temporal dispatches an activity to your worker
2. **Before** the activity code runs, the interceptor extracts:
   - Activity type (action)
   - Activity arguments (context)
3. The interceptor calls `AuthorityClient.authorize()` to request a mandate
4. If **denied**: throws `PredicateAuthorizationError` - activity never executes
5. If **approved**: activity proceeds normally

This ensures that no untrusted code or payload reaches your OS until it has been cryptographically authorized.

## Configuration

### Interceptor Options

```typescript
import { createPredicateInterceptors } from "@predicatesystems/temporal";

const interceptors = createPredicateInterceptors({
  // Required: The Predicate Authority client
  authorityClient: new AuthorityClient({ baseUrl: "http://127.0.0.1:8787" }),

  // Optional: Principal ID (default: "temporal-worker")
  principal: "my-worker",

  // Optional: Tenant ID for multi-tenant setups
  tenantId: "tenant-123",

  // Optional: Session ID for request correlation
  sessionId: "session-456",

  // Optional: Custom resource identifier (default: "temporal:activity")
  resource: "temporal:my-queue",
});
```

### Policy File

Create a policy file for the Predicate Authority daemon:

```json
{
  "rules": [
    {
      "name": "allow-safe-activities",
      "effect": "allow",
      "principals": ["temporal-worker"],
      "actions": ["processOrder", "sendNotification"],
      "resources": ["*"]
    },
    {
      "name": "deny-dangerous-activities",
      "effect": "deny",
      "principals": ["*"],
      "actions": ["delete*", "admin*"],
      "resources": ["*"]
    }
  ]
}
```

## API Reference

### `createPredicateInterceptors(options)`

Creates the interceptor configuration object for `Worker.create()`.

**Parameters:**

- `options.authorityClient` (required): `AuthorityClient` - The Predicate Authority client instance
- `options.principal` (optional): `string` - Principal ID (default: `"temporal-worker"`)
- `options.tenantId` (optional): `string` - Tenant ID for multi-tenant setups
- `options.sessionId` (optional): `string` - Session ID for request correlation
- `options.resource` (optional): `string` - Resource identifier (default: `"temporal:activity"`)

**Returns:** `WorkerInterceptors` - The interceptor configuration for Temporal Worker

### `PredicateActivityInterceptor`

The activity interceptor class. Usually you don't need to instantiate this directly - use `createPredicateInterceptors()` instead.

### `PredicateAuthorizationError`

Custom error thrown when authorization is denied.

```typescript
import { PredicateAuthorizationError } from "@predicatesystems/temporal";

try {
  await workflow.executeActivity("dangerousActivity", args);
} catch (error) {
  if (error instanceof PredicateAuthorizationError) {
    console.log(`Denied: ${error.reason}`);
    console.log(`Violated rule: ${error.violatedRule}`);
  }
}
```

## Error Handling

When authorization is denied, the interceptor throws a `PredicateAuthorizationError`:

```typescript
import { ApplicationFailure } from "@temporalio/workflow";

try {
  await workflow.executeActivity("sensitiveActivity", args, {
    startToCloseTimeout: "30s",
  });
} catch (error) {
  if (error instanceof ApplicationFailure) {
    // Check if it's a Predicate denial
    if (error.message.includes("Predicate Zero-Trust Denial")) {
      // Handle authorization denial
      console.log("Activity was blocked by security policy");
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## License

MIT
