/**
 * E-commerce example demonstrating Predicate Temporal interceptor in a realistic scenario.
 *
 * This example simulates an order processing system with:
 * - Inventory management
 * - Payment processing
 * - Order confirmation
 * - Policy-based access control
 *
 * Prerequisites:
 * - Temporal server running locally (temporal server start-dev)
 * - Predicate Authority daemon running (./predicate-authorityd --port 8787 --policy-file policy.json)
 */

import { Client, Connection } from "@temporalio/client";
import { Worker } from "@temporalio/worker";
import { AuthorityClient } from "@predicatesystems/authority";
import { createPredicateInterceptors } from "@predicatesystems/temporal";

import * as activities from "./activities";
import type { Order } from "./activities";

async function main() {
  // Connect to Temporal
  const connection = await Connection.connect({ address: "localhost:7233" });
  const client = new Client({ connection });

  // Initialize Predicate Authority client
  const authorityClient = new AuthorityClient({
    baseUrl: "http://127.0.0.1:8787",
    timeoutMs: 5000,
    maxRetries: 2,
  });

  // Create the Predicate interceptors
  const interceptors = createPredicateInterceptors({
    authorityClient,
    principal: "temporal-worker",
    tenantId: "ecommerce-store",
  });

  // Create worker with the interceptor
  const worker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue: "ecommerce-queue",
    workflowsPath: require.resolve("./workflows"),
    activities,
    interceptors,
  });

  console.log("=".repeat(70));
  console.log("E-commerce Order Processing with Predicate Zero-Trust Authorization");
  console.log("=".repeat(70));

  // Run worker
  const workerPromise = worker.run();

  // Give worker time to start
  await sleep(1000);

  try {
    // Demo 1: Legitimate order processing
    console.log("\n[Demo 1] Processing a legitimate order...");
    console.log("-".repeat(50));

    const order: Order = {
      orderId: "ORD-12345",
      customerEmail: "customer@example.com",
      items: [
        { productId: "PROD-001", quantity: 2, price: 29.99 },
        { productId: "PROD-002", quantity: 1, price: 49.99 },
      ],
    };

    try {
      const result = await client.workflow.execute("orderProcessingWorkflow", {
        args: [order],
        workflowId: "order-workflow-1",
        taskQueue: "ecommerce-queue",
      });
      console.log(`  Order ID: ${result.orderId}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Transaction: ${result.transactionId ?? "N/A"}`);
      console.log(`  Confirmation sent: ${result.confirmationSent ?? false}`);
    } catch (error) {
      console.log(`  Error: ${error}`);
    }

    // Demo 2: Attempted malicious operations
    console.log("\n[Demo 2] Attempting unauthorized operations...");
    console.log("-".repeat(50));

    try {
      const result = await client.workflow.execute("maliciousWorkflow", {
        args: ["ORD-12345"],
        workflowId: "malicious-workflow-1",
        taskQueue: "ecommerce-queue",
      });
      console.log(`  Blocked activities: ${result.blocked.join(", ")}`);
      console.log("  (These activities were denied by Predicate Authority)");
    } catch (error) {
      console.log(`  Error: ${error}`);
    }

    console.log("\n" + "=".repeat(70));
    console.log("Demo complete! All dangerous operations were blocked.");
    console.log("=".repeat(70));
  } finally {
    // Shutdown
    worker.shutdown();
    await workerPromise;
    await connection.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
