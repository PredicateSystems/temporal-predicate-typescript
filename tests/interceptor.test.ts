import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PredicateActivityInterceptor,
  createPredicateInterceptors,
} from "../src/interceptor.js";
import { PredicateAuthorizationError } from "../src/errors.js";

// Mock AuthorityClient
interface MockAuthorizationResponse {
  allowed: boolean;
  reason: string;
  violatedRule?: string | null;
  missingLabels?: string[];
  mandate?: unknown;
}

function createMockAuthorityClient(response: MockAuthorizationResponse) {
  return {
    authorize: vi.fn().mockResolvedValue(response),
  };
}

// Mock ActivityExecuteInput
interface MockActivityInput {
  activityType: string;
  args: unknown[];
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
      mandate: { id: "m_123" },
    });

    const interceptor = new PredicateActivityInterceptor({
      authorityClient: mockClient as never,
      principal: "test-worker",
    });

    const input: MockActivityInput = {
      activityType: "processOrder",
      args: [{ orderId: 123 }],
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
      violatedRule: "deny-dangerous",
    });

    const interceptor = new PredicateActivityInterceptor({
      authorityClient: mockClient as never,
      principal: "test-worker",
    });

    const input: MockActivityInput = {
      activityType: "dangerousActivity",
      args: [],
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
      violatedRule: "require-approval",
      missingLabels: ["approved", "reviewed"],
    });

    const interceptor = new PredicateActivityInterceptor({
      authorityClient: mockClient as never,
    });

    const input: MockActivityInput = {
      activityType: "sensitiveActivity",
      args: [],
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
    });

    const interceptor = new PredicateActivityInterceptor({
      authorityClient: mockClient as never,
    });

    const input: MockActivityInput = {
      activityType: "testActivity",
      args: [],
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.principal?.principalId).toBe("temporal-worker");
  });

  it("should include tenant and session IDs when provided", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
    });

    const interceptor = new PredicateActivityInterceptor({
      authorityClient: mockClient as never,
      principal: "custom-worker",
      tenantId: "tenant-123",
      sessionId: "session-456",
    });

    const input: MockActivityInput = {
      activityType: "testActivity",
      args: [],
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.principal).toEqual({
      principalId: "custom-worker",
      tenantId: "tenant-123",
      sessionId: "session-456",
    });
  });

  it("should hash activity arguments for state evidence", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
    });

    const interceptor = new PredicateActivityInterceptor({
      authorityClient: mockClient as never,
    });

    const input: MockActivityInput = {
      activityType: "testActivity",
      args: [{ data: "test" }, 123],
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.stateEvidence?.stateHash).toBeDefined();
    expect(authorizeCall?.stateEvidence?.stateHash).toHaveLength(64); // SHA-256 hex
    expect(authorizeCall?.stateEvidence?.source).toBe("temporal-worker");
  });

  it("should use custom resource when provided", async () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
    });

    const interceptor = new PredicateActivityInterceptor({
      authorityClient: mockClient as never,
      resource: "temporal:custom-queue",
    });

    const input: MockActivityInput = {
      activityType: "testActivity",
      args: [],
    };

    await interceptor.execute(input as never, mockNext);

    const authorizeCall = mockClient.authorize.mock.calls[0]?.[0];
    expect(authorizeCall?.actionSpec?.resource).toBe("temporal:custom-queue");
  });
});

describe("createPredicateInterceptors", () => {
  it("should return WorkerInterceptors with activity interceptor", () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
    });

    const interceptors = createPredicateInterceptors({
      authorityClient: mockClient as never,
      principal: "test-worker",
    });

    expect(interceptors).toBeDefined();
    expect(interceptors.activity).toBeDefined();
    expect(typeof interceptors.activity).toBe("function");

    // Call the factory to get the interceptors
    const activityInterceptors = interceptors.activity?.();
    expect(activityInterceptors?.inbound).toBeInstanceOf(PredicateActivityInterceptor);
  });

  it("should pass all options to the interceptor", () => {
    const mockClient = createMockAuthorityClient({
      allowed: true,
      reason: "allowed",
    });

    const interceptors = createPredicateInterceptors({
      authorityClient: mockClient as never,
      principal: "custom-worker",
      tenantId: "tenant-123",
      sessionId: "session-456",
      resource: "custom:resource",
    });

    const activityInterceptors = interceptors.activity?.();
    const interceptor = activityInterceptors?.inbound as PredicateActivityInterceptor;

    // Access private properties via type casting for testing
    expect((interceptor as unknown as { principal: string }).principal).toBe("custom-worker");
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
