/**
 * Activity definitions for Temporal examples.
 *
 * These activities will be secured by Predicate Authority.
 */

// ============================================================================
// Basic Activities (allowed by policy)
// ============================================================================

export async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}

export async function fetchData(dataId: string): Promise<Record<string, unknown>> {
  // Simulate fetching data
  await sleep(100);
  return {
    id: dataId,
    value: "sample_data",
    status: "active",
    timestamp: new Date().toISOString(),
  };
}

export async function processData(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Simulate processing
  await sleep(50);
  return {
    ...data,
    processed: true,
    processedBy: "temporal-worker",
    processedAt: new Date().toISOString(),
  };
}

// ============================================================================
// E-commerce Activities (allowed by policy)
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

export async function checkInventory(
  items: OrderItem[]
): Promise<{ available: boolean; checkedItems: string[] }> {
  console.log(`[Activity] Checking inventory for ${items.length} items`);
  await sleep(100);

  return {
    available: true,
    checkedItems: items.map((item) => item.productId),
  };
}

export async function reserveInventory(
  items: OrderItem[]
): Promise<{ reserved: boolean; reservationId: string }> {
  console.log(`[Activity] Reserving ${items.length} items`);
  await sleep(100);

  return {
    reserved: true,
    reservationId: `res-${randomId()}`,
  };
}

export async function chargePayment(
  orderId: string,
  amount: number,
  email: string
): Promise<{ success: boolean; transactionId: string; amount: number }> {
  console.log(`[Activity] Charging $${amount.toFixed(2)} for order ${orderId}`);
  await sleep(200);

  return {
    success: true,
    transactionId: `txn-${randomId()}`,
    amount,
  };
}

export async function refundPayment(
  transactionId: string,
  amount: number
): Promise<{ refunded: boolean; refundId: string }> {
  console.log(`[Activity] Refunding $${amount.toFixed(2)} for transaction ${transactionId}`);
  await sleep(100);

  return {
    refunded: true,
    refundId: `ref-${randomId()}`,
  };
}

export async function sendConfirmation(
  email: string,
  orderId: string,
  transactionId: string
): Promise<{ sent: boolean; email: string; orderId: string }> {
  console.log(`[Activity] Sending confirmation to ${email} for order ${orderId}`);
  await sleep(100);

  return {
    sent: true,
    email,
    orderId,
  };
}

export async function processOrder(
  order: Order
): Promise<{ processed: boolean; orderId: string }> {
  console.log(`[Activity] Processing order ${order.orderId}`);
  await sleep(150);

  return {
    processed: true,
    orderId: order.orderId,
  };
}

// ============================================================================
// Dangerous Activities (BLOCKED by policy)
// ============================================================================

export async function deleteOrder(orderId: string): Promise<{ deleted: boolean; orderId: string }> {
  // This will NEVER execute due to Predicate authorization
  console.log(`[Activity] DANGER: Deleting order ${orderId}`);
  return { deleted: true, orderId };
}

export async function adminOverridePayment(
  orderId: string
): Promise<{ overridden: boolean; orderId: string }> {
  // This will NEVER execute due to Predicate authorization
  console.log(`[Activity] DANGER: Admin override for ${orderId}`);
  return { overridden: true, orderId };
}

export async function dropDatabase(): Promise<{ dropped: boolean }> {
  // This will NEVER execute due to Predicate authorization
  console.log("[Activity] DANGER: Dropping database!");
  return { dropped: true };
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 8);
}
