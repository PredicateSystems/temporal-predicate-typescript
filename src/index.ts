/**
 * Temporal.io Worker Interceptor for Predicate Authority Zero-Trust authorization.
 *
 * @packageDocumentation
 */

export {
  PredicateActivityInterceptor,
  createPredicateInterceptors,
  type PredicateInterceptorOptions,
} from "./interceptor.js";

export { PredicateAuthorizationError } from "./errors.js";
