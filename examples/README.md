# Predicate Temporal TypeScript Examples

This directory contains examples demonstrating how to use `@predicatesystems/temporal` to secure Temporal activities.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install @temporalio/client @temporalio/worker @temporalio/workflow
   npm install @predicatesystems/authority @predicatesystems/temporal
   ```

2. Start the Predicate Authority daemon:
   ```bash
   # Download from https://github.com/PredicateSystems/predicate-authority-sidecar/releases
   ./predicate-authorityd --port 8787 --policy-file policy.json
   ```

3. Start a local Temporal server:
   ```bash
   temporal server start-dev
   ```

## Examples

### Basic Example

A minimal example showing:
- Setting up a worker with Predicate interceptor
- Defining secured activities
- Running workflows

```bash
npx ts-node basic-worker.ts
```

### E-commerce Example

A realistic e-commerce scenario with:
- Order processing activities
- Payment handling
- Inventory management
- Policy-based access control

```bash
npx ts-node ecommerce-worker.ts
```

## Policy File

The `policy.json` file defines which activities are allowed:

```json
{
  "rules": [
    {
      "name": "allow-order-processing",
      "effect": "allow",
      "principals": ["temporal-worker"],
      "actions": ["processOrder", "checkInventory", "sendConfirmation"],
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

## Running the Examples

1. Compile TypeScript:
   ```bash
   npx tsc
   ```

2. Run the worker:
   ```bash
   node dist/examples/basic-worker.js
   ```

Or use ts-node for development:
```bash
npx ts-node examples/basic-worker.ts
```
