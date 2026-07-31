/**
 * Why a hand-written wallet entry exists.
 *
 * The ledger is the only record of where a client's hours went, and the two
 * reasons a human takes hours off mean opposite things when you read it back
 * months later: `offline` is the client actually using an hour that happened
 * over the phone, `correction` is the studio erasing its own mis-keyed grant.
 * Filing both as "correction" — which is what the panel did while the only way
 * to subtract was to type a minus sign — loses that distinction permanently.
 */

/** Reasons a human may give for taking hours off a wallet. */
export const DEDUCTION_REASONS = ["offline", "correction"] as const;

export type DeductionReason = (typeof DEDUCTION_REASONS)[number];
export type LedgerReason = "manual" | DeductionReason;

function isDeductionReason(value: unknown): value is DeductionReason {
  return (
    typeof value === "string" && DEDUCTION_REASONS.includes(value as DeductionReason)
  );
}

/**
 * The `reason` to store for a manual entry of `hours`.
 *
 * Adding is always "manual" — there is only one way hours arrive by hand.
 * Subtracting takes the caller's reason when it is one we recognise, and falls
 * back to "correction" for anything else, including an older client that sends
 * no reason at all.
 */
export function ledgerReason(hours: number, requested?: unknown): LedgerReason {
  if (hours > 0) return "manual";
  return isDeductionReason(requested) ? requested : "correction";
}
