export function bootstrapAdminEmails(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(
  email: string,
  configured: string | null | undefined = process.env.ADMIN_BOOTSTRAP_EMAILS,
): boolean {
  return bootstrapAdminEmails(configured).includes(email.trim().toLowerCase());
}

export function wantsAdminDestination(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}
