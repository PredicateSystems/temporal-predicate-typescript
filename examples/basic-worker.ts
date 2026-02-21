/**
 * Basic example demonstrating Predicate Temporal interceptor.
 *
 * This example shows:
 * 1. Setting up a Temporal worker with Predicate authorization
 * 2. Defining activities that will be secured
 * 3. Running a workflow that executes those activities
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

async function main() {
  // Connect to Temporal
  const connection = await Connection.connect({ address: "localhost:7233" });
  const client = new Client({ connection });

  // Initialize Predicate Authority client
  const authorityClient = new AuthorityClient({
    baseUrl: "http://127.0.0.1:8787",
    timeoutMs: 5000,
  });

  // Create the Predicate interceptors
  const interceptors = createPredicateInterceptors({
    authorityClient,
    principal: "temporal-worker",
  });

  // Create worker with the interceptor
  const worker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue: "predicate-demo-queue",
    workflowsPath: require.resolve("./workflows"),
    activities,
    interceptors,
  });

  console.log("Starting worker with Predicate authorization...");
  console.log("=".repeat(60));

  // Run worker
  const workerPromise = worker.run();

  // Give worker time to start
  await sleep(1000);

  try {
    // Execute the basic workflow - should succeed
    console.log("\n[1] Running basicWorkflow (should succeed)...");
    try {
      const result = await client.workflow.execute("basicWorkflow", {
        args: [{ name: "Alice", dataId: "data-123" }],
        workflowId: "basic-workflow-1",
        taskQueue: "predicate-demo-queue",
      });
      console.log(`    Greeting: ${result.greeting}`);
      console.log(`    Processed data: ${JSON.stringify(result.processedData, null, 2)}`);
      console.log("    Status: SUCCESS");
    } catch (error) {
      console.log(`    Status: FAILED - ${error}`);
    }

    // Execute the malicious workflow - activities should be blocked
    console.log("\n[2] Running maliciousWorkflow (activities should be blocked)...");
    try {
      const result = await client.workflow.execute("maliciousWorkflow", {
        args: ["ORD-12345"],
        workflowId: "malicious-workflow-1",
        taskQueue: "predicate-demo-queue",
      });
      console.log(`    Blocked activities: ${result.blocked.join(", ")}`);
      console.log("    (These activities were denied by Predicate Authority)");
    } catch (error) {
      console.log(`    Error: ${error}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Demo complete!");
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
