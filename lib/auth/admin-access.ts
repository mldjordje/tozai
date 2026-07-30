/**
 * Who may open the admin panel.
 *
 * Exactly one Google account. Two weaker doors used to stand beside it and both
 * are gone:
 *
 * - `ADMIN_PASSWORD`, a single shared secret that opened the studio's books to
 *   anyone it was ever pasted to, and that nothing rotated.
 * - `ADMIN_BOOTSTRAP_EMAILS`, which let the set of people who could reach those
 *   books be widened from a dashboard env var, with no code review and no trace
 *   in the repository.
 *
 * Changing who owns the panel is a code change on purpose — it should be
 * reviewable and it should show up in `git log`.
 */
export const ADMIN_OWNER_EMAIL = "tozaayt@gmail.com";

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** True only for the address that owns the panel. */
export function isAdminOwner(email: string | null | undefined): boolean {
  return normalizeEmail(email) === ADMIN_OWNER_EMAIL;
}

export function wantsAdminDestination(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}
