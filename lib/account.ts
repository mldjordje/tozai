import "server-only";
import { getSql } from "@/lib/db";

// Read helpers for the client dashboard (/nalog). Every function is scoped by
// user_id — nothing here may be called with an id that did not come from the
// verified session cookie.

export type HourKind = "education" | "consulting";

export type WalletBalance = {
  kind: HourKind;
  purchased: number;
  used: number;
  remaining: number;
};

export type AccountProject = {
  id: number;
  title: string;
  status: string;
  brief_done: boolean;
  revisions_left: number;
  due_date: string | null;
  materials_method: string | null;
  materials_value: string | null;
  materials_received_at: string | null;
  created_at: string;
};

export type AccountBooking = {
  id: number;
  kind: string;
  date: string;
  start_slot: string;
  hours: number;
  status: string;
  topic: string | null;
  meet_url: string | null;
  recording_url: string | null;
};

export type AccountOrder = {
  id: number;
  item: string;
  amount: number;
  currency: string;
  status: string;
  flow: string;
  created_at: string;
};

export type AccountInvoice = {
  id: number;
  number: string;
  amount: number;
  currency: string;
  pdf_url: string | null;
  created_at: string;
};

// Balance per hour kind. Education and consulting hours cost different amounts,
// so they are separate pots and must never be spent against each other.
export async function getWalletBalances(userId: number): Promise<WalletBalance[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT kind,
           COALESCE(SUM(hours) FILTER (WHERE hours > 0), 0)::float8 AS purchased,
           COALESCE(-SUM(hours) FILTER (WHERE hours < 0), 0)::float8 AS used,
           COALESCE(SUM(hours), 0)::float8 AS remaining
    FROM hour_entries
    WHERE user_id = ${userId}
    GROUP BY kind
  `) as WalletBalance[];
  return rows;
}

export async function getWalletBalance(
  userId: number,
  kind: HourKind = "education",
): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COALESCE(SUM(hours), 0)::float8 AS remaining
    FROM hour_entries WHERE user_id = ${userId} AND kind = ${kind}
  `) as { remaining: number }[];
  return rows[0]?.remaining ?? 0;
}

export async function getProjects(userId: number): Promise<AccountProject[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, title, status, (brief IS NOT NULL) AS brief_done,
           revisions_left, due_date::text AS due_date, materials_method,
           materials_value, materials_received_at, created_at
    FROM projects WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `) as AccountProject[];
}

export type ProjectUpdate = {
  id: number;
  status: string | null;
  note: string | null;
  created_at: string;
};

export type ProjectDeliverable = {
  id: number;
  title: string;
  url: string;
  kind: string;
  created_at: string;
};

export type ProjectMaterial = {
  id: number;
  method: string;
  value: string;
  note: string | null;
  created_at: string;
};

export type ProjectDetail = AccountProject & {
  brief: Record<string, unknown> | null;
  package_name: string | null;
  order_id: number | null;
  updates: ProjectUpdate[];
  deliverables: ProjectDeliverable[];
  materials: ProjectMaterial[];
};

// Single project, scoped by user_id in the WHERE clause — an id belonging to
// someone else returns null rather than another customer's brief.
export async function getProjectDetail(
  userId: number,
  projectId: number,
): Promise<ProjectDetail | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT p.id, p.title, p.status, (p.brief IS NOT NULL) AS brief_done, p.brief,
           p.revisions_left, p.due_date::text AS due_date, p.materials_method,
           p.materials_value, p.materials_received_at, p.created_at, p.order_id,
           pk.name AS package_name
    FROM projects p
    LEFT JOIN packages pk ON pk.id = p.package_id
    WHERE p.id = ${projectId} AND p.user_id = ${userId}
  `) as (AccountProject & {
    brief: Record<string, unknown> | null;
    package_name: string | null;
    order_id: number | null;
  })[];
  const project = rows[0];
  if (!project) return null;

  const [updates, deliverables, materials] = await Promise.all([
    sql`
      SELECT id, status, note, created_at
      FROM project_updates WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT id, title, url, kind, created_at
      FROM project_deliverables WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT id, method, value, note, created_at
      FROM project_materials WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `,
  ]);

  return {
    ...project,
    updates: updates as ProjectUpdate[],
    deliverables: deliverables as ProjectDeliverable[],
    materials: materials as ProjectMaterial[],
  };
}

// Sessions from today onward, soonest first — what the dashboard calls
// "sledeći termin".
export async function getUpcomingBookings(userId: number): Promise<AccountBooking[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, kind, date::text AS date, start_slot, hours::float8 AS hours, status, topic,
           meet_url, recording_url
    FROM bookings
    WHERE user_id = ${userId} AND status = 'zakazano' AND date >= CURRENT_DATE
    ORDER BY date, start_slot
  `) as AccountBooking[];
}

export async function getPastBookings(userId: number): Promise<AccountBooking[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, kind, date::text AS date, start_slot, hours::float8 AS hours, status, topic,
           meet_url, recording_url
    FROM bookings
    WHERE user_id = ${userId} AND (status <> 'zakazano' OR date < CURRENT_DATE)
    ORDER BY date DESC, start_slot DESC
    LIMIT 50
  `) as AccountBooking[];
}

export async function getOrders(userId: number): Promise<AccountOrder[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, item, amount::float8 AS amount, currency, status, flow, created_at
    FROM orders WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `) as AccountOrder[];
}

export async function getInvoices(userId: number): Promise<AccountInvoice[]> {
  const sql = getSql();
  return (await sql`
    SELECT i.id, i.number, i.amount::float8 AS amount, i.currency, i.pdf_url, i.created_at
    FROM invoices i
    JOIN orders o ON o.id = i.order_id
    WHERE o.user_id = ${userId}
    ORDER BY i.created_at DESC
  `) as AccountInvoice[];
}

export type AccountProfile = {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_company: boolean;
  company_name: string | null;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
};

export async function getProfile(userId: number): Promise<AccountProfile | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, name, avatar_url, phone, is_company, company_name, pib, mb,
           address, city
    FROM users WHERE id = ${userId}
  `) as AccountProfile[];
  return rows[0] ?? null;
}

// Everything the /nalog landing page needs, in one round of parallel queries.
export async function getAccountOverview(userId: number) {
  const [wallets, projects, upcoming, orders, invoices] = await Promise.all([
    getWalletBalances(userId),
    getProjects(userId),
    getUpcomingBookings(userId),
    getOrders(userId),
    getInvoices(userId),
  ]);
  return { wallets, projects, upcoming, orders, invoices };
}
