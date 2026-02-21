import { beforeEach, describe, expect, it, vi } from "vitest";
import { PredicateAuthorizationError } from "../src/errors.js";
import {
  PredicateActivityInterceptor,
  type PredicateAuthorizationResponse,
  createPredicateInterceptors,
} from "../src/interceptor.js";

// Mock Context from @temporalio/activity
interface MockContext {
  info: {
    activityType: string;
  };
}

function createMockContext(activityType: string): MockContext {
  return {
    info: {
      activityType,
    },
  };
}

// Mock AuthorityClient
function createMockAuthorityClient(response: PredicateAuthorizationResponse) {
  return {
    authorize: vi.fn().mockResolvedValue(response),
  };
}

// Mock ActivityExecuteInput
interface MockActivityInput {
  args: unknown[];
  headers: Map<string, unknown>;
}

describe("PredicateActivityInterceptor", () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNext = vi.fn().mockResolvedValue("activity_result");
  });

  it("should allow authorized activities to proceed", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
      mandate_id: "m_123",
      violated_rule: null,
      missing_labels: [],
    });

    const mockCtx = createMockContext("processOrder");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
      principal: "test-worker",
    });

    const input: MockActivityInput = {
      args: [{ orderId: 123 }],
      headers: new Map(),
    };

    const result = await interceptor.execute(input as never, mockNext);

    expect(result).toBe("activity_result");
    expect(mockClient.authorize).toHaveBeenCalledOnce();
    expect(mockNext).toHaveBeenCalledWith(input);
  });

  it("should throw PredicateAuthorizationError when denied", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: false,
      reason: "explicit_deny",
      mandate_id: null,
      violated_rule: "deny-dangerous",
      missing_labels: [],
    });

    const mockCtx = createMockContext("dangerousActivity");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
      principal: "test-worker",
    });

    const input: MockActivityInput = {
      args: [],
      headers: new Map(),
    };

    await expect(interceptor.execute(input as never, mockNext)).rejects.toThrow(
      PredicateAuthorizationError
    );

    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should include violation details in error", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: false,
      reason: "missing_required_verification",
      mandate_id: null,
      violated_rule: "require-approval",
      missing_labels: ["approved", "reviewed"],
    });

    const mockCtx = createMockContext("sensitiveActivity");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
    });

    const input: MockActivityInput = {
      args: [],
      headers: new Map(),
    };

    try {
      await interceptor.execute(input as never, mockNext);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PredicateAuthorizationError);
      const authError = error as PredicateAuthorizationError;
      expect(authError.activityType).toBe("sensitiveActivity");
      expect(authError.reason).toBe("missing_required_verification");
      expect(authError.violatedRule).toBe("require-approval");
      expect(authError.missingLabels).toEqual(["approved", "reviewed"]);
    }
  });

  it("should use default principal when not specified", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
      mandate_id: null,
      violated_rule: null,
      missing_labels: [],
    });

    const mockCtx = createMockContext("testActivity");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
    });

    const input: MockActivityInput = {
      args: [],
      headers: new Map(),
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.principal).toBe("temporal-worker");
  });

  it("should include tenant and session IDs in context when provided", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
      mandate_id: null,
      violated_rule: null,
      missing_labels: [],
    });

    const mockCtx = createMockContext("testActivity");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
      principal: "custom-worker",
      tenantId: "tenant-123",
      sessionId: "session-456",
    });

    const input: MockActivityInput = {
      args: [],
      headers: new Map(),
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.principal).toBe("custom-worker");
    expect(authorizeCall?.context?.tenant_id).toBe("tenant-123");
    expect(authorizeCall?.context?.session_id).toBe("session-456");
  });

  it("should hash activity arguments for state evidence", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
      mandate_id: null,
      violated_rule: null,
      missing_labels: [],
    });

    const mockCtx = createMockContext("testActivity");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
    });

    const input: MockActivityInput = {
      args: [{ data: "test" }, 123],
      headers: new Map(),
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.context?.state_hash).toBeDefined();
    expect(authorizeCall?.context?.state_hash).toHaveLength(64); // SHA-256 hex
  });

  it("should use custom resource when provided", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
      mandate_id: null,
      violated_rule: null,
      missing_labels: [],
    });

    const mockCtx = createMockContext("testActivity");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
      resource: "temporal:custom-queue",
    });

    const input: MockActivityInput = {
      args: [],
      headers: new Map(),
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.resource).toBe("temporal:custom-queue");
  });

  it("should use activity type from context", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
      mandate_id: null,
      violated_rule: null,
      missing_labels: [],
    });

    const mockCtx = createMockContext("mySpecificActivity");
    const interceptor = new PredicateActivityInterceptor(mockCtx as never, {
      authorityClient: mockClient,
    });

    const input: MockActivityInput = {
      args: [],
      headers: new Map(),
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.action).toBe("mySpecificActivity");
  });
});

describe("createPredicateInterceptors", () => {
  it("should return WorkerInterceptors with activity interceptor factory array", () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
      mandate_id: null,
      violated_rule: null,
      missing_labels: [],
    });

    const interceptors = createPredicateInterceptors({
      authorityClient: mockClient,
      principal: "test-worker",
    });

    expect(interceptors).toBeDefined();
    expect(interceptors.activity).toBeDefined();
    expect(Array.isArray(interceptors.activity)).toBe(true);
    expect(interceptors.activity).toHaveLength(1);

    // Call the factory to get the interceptors
    const mockCtx = createMockContext("testActivity");
    const factory = interceptors.activity?.[0];
    const activityInterceptors = factory?.(mockCtx as never);
    expect(activityInterceptors?.inbound).toBeInstanceOf(PredicateActivityInterceptor);
  });
});

describe("PredicateAuthorizationError", () => {
  it("should format error message correctly", () => {
    const error = new PredicateAuthorizationError({
      activityType: "deleteUser",
      reason: "explicit_deny",
      violatedRule: "deny-admin-actions",
    });

    expect(error.message).toContain("Predicate Zero-Trust Denial");
    expect(error.message).toContain("deleteUser");
    expect(error.message).toContain("explicit_deny");
    expect(error.message).toContain("deny-admin-actions");
  });

  it("should handle missing violated rule", () => {
    const error = new PredicateAuthorizationError({
      activityType: "unknownActivity",
      reason: "no_matching_policy",
    });

    expect(error.message).not.toContain("violated rule");
    expect(error.violatedRule).toBeUndefined();
  });

  it("should have correct error name", () => {
    const error = new PredicateAuthorizationError({
      activityType: "test",
      reason: "denied",
    });

    expect(error.name).toBe("PredicateAuthorizationError");
  });

  it("should store missing labels", () => {
    const error = new PredicateAuthorizationError({
      activityType: "test",
      reason: "missing_required_verification",
      missingLabels: ["approved", "verified"],
    });

    expect(error.missingLabels).toEqual(["approved", "verified"]);
  });

  it("should default missing labels to empty array", () => {
    const error = new PredicateAuthorizationError({
      activityType: "test",
      reason: "denied",
    });

    expect(error.missingLabels).toEqual([]);
  });
});
