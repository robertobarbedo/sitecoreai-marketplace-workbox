/**
 * Guesses whether a workflow command moves an item backwards in the workflow,
 * going purely by its display name — the workflow definition doesn't say. Used
 * only for cosmetic hover color-coding (backwards = red, forwards = green), so
 * a wrong guess has no functional impact.
 */
const BACKWARD_TERMS = [
  "reject",
  "return",
  "back",
  "decline",
  "deny",
  "revert",
  "recall",
  "demote",
  "abort",
  "cancel",
  "withdraw",
  "revoke",
];

export function isBackwardCommand(displayName: string): boolean {
  const lower = displayName.toLowerCase();
  return BACKWARD_TERMS.some((term) => lower.includes(term));
}

/** Hover classes for an outline command button, by guessed direction. */
export function commandHoverClasses(displayName: string): string {
  return isBackwardCommand(displayName)
    ? "hover:border-danger hover:bg-white hover:text-danger-fg"
    : "hover:border-success hover:bg-white hover:text-success-fg";
}
