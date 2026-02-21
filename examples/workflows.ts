/**
 * Workflow definitions for Temporal examples.
 */

import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "./activities";

// Create activity proxies
const {
  greet,
  fetchData,
  processData,
  checkInventory,
  reserveInventory,
  chargePayment,
  sendConfirmation,
  processOrder,
  deleteOrder,
  adminOverridePayment,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
});

// ============================================================================
// Basic Workflow
// ============================================================================

export interface BasicWorkflowInput {
  name: string;
  dataId: string;
}

export interface BasicWorkflowResult {
  greeting: string;
  processedData: Record<string, unknown>;
}

/**
 * Basic workflow demonstrating secured activities.
 *
 * All activities in this workflow are allowed by the policy.
 */
export async function basicWorkflow(input: BasicWorkflowInput): Promise<BasicWorkflowResult> {
  // This activity will be allowed
  const greeting = await greet(input.name);

  // This activity will be allowed
  const data = await fetchData(input.dataId);

  // This activity will be allowed
  const processedData = await processData(data);

  return {
    greeting,
    processedData,
  };
}

// ============================================================================
// Order Processing Workflow
// ============================================================================

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: string;
  customerEmail: string;
  items: OrderItem[];
}

export interface OrderResult {
  orderId: string;
  status: "completed" | "failed";
  transactionId?: string;
  confirmationSent?: boolean;
  reason?: string;
}

/**
 * E-commerce order processing workflow with Predicate authorization.
 *
 * All activities are checked against the policy before execution.
 */
export async function orderProcessingWorkflow(order: Order): Promise<OrderResult> {
  const { orderId, customerEmail: email, items } = order;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Step 1: Check inventory (allowed)
  const inventory = await checkInventory(items);

  if (!inventory.available) {
    return {
      orderId,
      status: "failed",
      reason: "inventory_unavailable",
    };
  }

  // Step 2: Reserve inventory (allowed)
  await reserveInventory(items);

  // Step 3: Process payment (allowed)
  const payment = await chargePayment(orderId, total, email);

  if (!payment.success) {
    return {
      orderId,
      status: "failed",
      reason: "payment_failed",
    };
  }

  // Step 4: Process order (allowed)
  await processOrder(order);

  // Step 5: Send confirmation (allowed)
  const confirmation = await sendConfirmation(email, orderId, payment.transactionId);

  return {
    orderId,
    status: "completed",
    transactionId: payment.transactionId,
    confirmationSent: confirmation.sent,
  };
}

// ============================================================================
// Malicious Workflow (Activities will be BLOCKED)
// ============================================================================

export interface MaliciousWorkflowResult {
  attempted: string[];
  blocked: string[];
}

/**
 * Workflow attempting unauthorized operations.
 *
 * These activities will be BLOCKED by Predicate Authority.
 */
export async function maliciousWorkflow(orderId: string): Promise<MaliciousWorkflowResult> {
  const results: MaliciousWorkflowResult = {
    attempted: [],
    blocked: [],
  };

  // Attempt 1: Try to delete an order (BLOCKED)
  try {
    await deleteOrder(orderId);
    results.attempted.push("deleteOrder");
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      results.blocked.push("deleteOrder");
    } else {
      throw error;
    }
  }

  // Attempt 2: Try admin override (BLOCKED)
  try {
    await adminOverridePayment(orderId);
    results.attempted.push("adminOverridePayment");
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      results.blocked.push("adminOverridePayment");
    } else {
      throw error;
    }
  }

  return results;
}
