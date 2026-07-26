import "server-only";
import { getSql } from "@/lib/db";

export const VIDEO_REQUEST_STATUSES = [
  "submitted",
  "quoted",
  "accepted",
  "declined",
  "canceled",
] as const;

export type VideoRequestStatus = (typeof VIDEO_REQUEST_STATUSES)[number];

export type VideoRequestBrief = {
  idea: string;
};

export type VideoRequest = {
  id: number;
  package_id: number | null;
  service_name: string;
  project_title: string;
  brief: VideoRequestBrief;
  buyer_type: "individual" | "company";
  clip_count: number;
  business_name: string;
  business_description: string;
  budget_eur: number | null;
  status: VideoRequestStatus;
  quoted_amount: number | null;
  currency: string;
  turnaround_days: number | null;
  quote_valid_until: string | null;
  admin_note: string | null;
  revisions: number;
  quoted_at: string | null;
  responded_at: string | null;
  order_id: number | null;
  created_at: string;
};

export function cleanText(value: unknown, max: number, min = 0): string | null {
  if (typeof value !== "string") return min === 0 ? "" : null;
  const clean = value.trim().slice(0, max);
  return clean.length >= min ? clean : null;
}

export function isVideoRequestStatus(value: unknown): value is VideoRequestStatus {
  return (
    typeof value === "string" &&
    (VIDEO_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

export async function getUserVideoRequests(userId: number): Promise<VideoRequest[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, package_id, service_name, project_title, brief, buyer_type,
           clip_count, business_name, business_description, budget_eur::float8 AS budget_eur, status,
           quoted_amount::float8 AS quoted_amount, currency, turnaround_days,
           quote_valid_until::text AS quote_valid_until, admin_note, revisions,
           quoted_at, responded_at, order_id, created_at
    FROM video_requests
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 100
  `) as VideoRequest[];
}
