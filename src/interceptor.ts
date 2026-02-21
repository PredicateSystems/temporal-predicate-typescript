/**
 * Predicate Authority interceptor for Temporal.io activities.
 *
 * This module provides a pre-execution security gate for all Temporal Activities,
 * enforcing cryptographic authorization mandates before any activity code runs.
 */

import type {
  ActivityExecuteInput,
  ActivityInboundCallsInterceptor,
  Next,
  WorkerInterceptors,
} from "@temporalio/worker";
import type { AuthorityClient, AuthorizeRequest } from "@predicatesystems/authority";
import { createHash } from "node:crypto";
import { PredicateAuthorizationError } from "./errors.js";

/**
 * Options for creating Predicate interceptors.
 */
export interface PredicateInterceptorOptions {
  /** The Predicate Authority client for authorization */
  authorityClient: AuthorityClient;

  /** Principal ID used for authorization requests (default: "temporal-worker") */
  principal?: string;

  /** Optional tenant ID for multi-tenant setups */
  tenantId?: string;

  /** Optional session ID for request correlation */
  sessionId?: string;

  /** Optional resource identifier (default: "temporal:activity") */
  resource?: string;
}

/**
 * Activity interceptor that enforces Predicate Authority authorization.
 *
 * This interceptor sits in the Temporal activity execution pipeline and ensures
 * that every activity is authorized before execution. If authorization is denied,
 * a PredicateAuthorizationError is thrown and the activity never executes.
 */
export class PredicateActivityInterceptor implements ActivityInboundCallsInterceptor {
  private readonly authorityClient: AuthorityClient;
  private readonly principal: string;
  private readonly tenantId: string | undefined;
  private readonly sessionId: string | undefined;
  private readonly resource: string;

  constructor(options: PredicateInterceptorOptions) {
    this.authorityClient = options.authorityClient;
    this.principal = options.principal ?? "temporal-worker";
    this.tenantId = options.tenantId;
    this.sessionId = options.sessionId;
    this.resource = options.resource ?? "temporal:activity";
  }

  /**
   * Execute activity with Predicate Authority authorization check.
   *
   * This method intercepts the activity execution, extracts the activity type
   * and arguments, and requests authorization from Predicate Authority.
   * If denied, throws PredicateAuthorizationError. If approved, proceeds with execution.
   */
  async execute(
    input: ActivityExecuteInput,
    next: Next<ActivityInboundCallsInterceptor, "execute">
  ): Promise<unknown> {
    const activityType = input.activityType;
    const activityArgs = input.args;

    // Hash the arguments for state evidence
    const argsJson = JSON.stringify(activityArgs);
    const argsHash = createHash("sha256").update(argsJson).digest("hex");

    const request: AuthorizeRequest = {
      principal: {
        principalId: this.principal,
        tenantId: this.tenantId,
        sessionId: this.sessionId,
      },
      actionSpec: {
        action: activityType,
        resource: this.resource,
        intent: `execute:${activityType}`,
      },
      stateEvidence: {
        source: "temporal-worker",
        stateHash: argsHash,
        schemaVersion: "v1",
      },
      verificationEvidence: {
        signals: [],
      },
    };

    const decision = await this.authorityClient.authorize(request);

    if (!decision.allowed) {
      throw new PredicateAuthorizationError({
        activityType,
        reason: decision.reason,
        violatedRule: decision.violatedRule ?? undefined,
        missingLabels: decision.missingLabels ?? [],
      });
    }

    return next(input);
  }
}

/**
 * Creates Temporal worker interceptors that enforce Predicate Authority authorization.
 *
 * @example
 * ```typescript
 * import { Worker } from "@temporalio/worker";
 * import { AuthorityClient } from "@predicatesystems/authority";
 * import { createPredicateInterceptors } from "@predicatesystems/temporal";
 *
 * const authorityClient = new AuthorityClient({
 *   baseUrl: "http://127.0.0.1:8787",
 * });
 *
 * const interceptors = createPredicateInterceptors({
 *   authorityClient,
 *   principal: "temporal-worker",
 * });
 *
 * const worker = await Worker.create({
 *   connection,
 *   taskQueue: "my-task-queue",
 *   workflowsPath: require.resolve("./workflows"),
 *   activities,
 *   interceptors,
 * });
 * ```
 */
export function createPredicateInterceptors(
  options: PredicateInterceptorOptions
): WorkerInterceptors {
  return {
    activity: () => ({
      inbound: new PredicateActivityInterceptor(options),
    }),
  };
}
