/**
 * Error thrown when Predicate Authority denies an activity execution.
 */
export class PredicateAuthorizationError extends Error {
  /** The authorization reason code */
  public readonly reason: string;

  /** The policy rule that caused the denial, if any */
  public readonly violatedRule: string | undefined;

  /** Labels that were required but missing */
  public readonly missingLabels: readonly string[];

  /** The activity type that was denied */
  public readonly activityType: string;

  constructor(options: {
    activityType: string;
    reason: string;
    violatedRule?: string | undefined;
    missingLabels?: readonly string[];
  }) {
    const message = `Predicate Zero-Trust Denial: Activity '${options.activityType}' not authorized. Reason: ${options.reason}${
      options.violatedRule ? `, violated rule: ${options.violatedRule}` : ""
    }`;
    super(message);
    this.name = "PredicateAuthorizationError";
    this.reason = options.reason;
    this.violatedRule = options.violatedRule;
    this.missingLabels = options.missingLabels ?? [];
    this.activityType = options.activityType;
  }
}
