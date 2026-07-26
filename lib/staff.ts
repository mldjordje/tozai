import "server-only";
import { getSql } from "@/lib/db";

// Team members who may open the admin panel. Rows are created by the owner;
// google_id is filled in the first time that person signs in with Google, so a
// staff record is matched by email until then.
export type StaffMember = {
  id: number;
  email: string;
  name: string;
  role: "owner" | "staff";
};

export async function getStaffByEmail(email: string): Promise<StaffMember | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, name, role
    FROM staff
    WHERE lower(email) = ${email.toLowerCase()} AND active
    LIMIT 1
  `) as StaffMember[];
  return rows[0] ?? null;
}
