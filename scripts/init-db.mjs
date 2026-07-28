// One-time / idempotent DB setup for the TOZA AI admin platform on Neon.
// Run: npm run db:init   (reads DATABASE_URL from .env.local)
//
// Mirrors the "Admin" scope of the spec: users/CRM, cene+paketi, portfolio,
// FAQ, email šabloni, dostupnost kalendara, analitika — plus the groundwork
// tables (orders, invoices, education wallet) the dashboard/analytics read.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}

const sql = neon(url);

/* ---------------------------------------------------------------- staff --- */
// Owner + (future) team. Password login maps to the owner; Google login for
// staff is added later, matched by email then google_id filled in on first login.
await sql`
  CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    active BOOLEAN NOT NULL DEFAULT true,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
const ownerEmails = [
  "svetozartoza.markovic02@gmail.com",
  "tozaayt@gmail.com",
];
for (const email of ownerEmails) {
  await sql`
    INSERT INTO staff (email, name, role, active)
    VALUES (${email}, 'Owner', 'owner', true)
    ON CONFLICT (email) DO UPDATE SET role = 'owner', active = true
  `;
}
await sql`DELETE FROM staff WHERE email = 'owner@tozai.local'`;

/* --------------------------------------------------------------- clients --- */
// CRM: clients register via Google (later) or are created at checkout. Company
// fields cover pravno lice (PIB/MB) per the checkout spec.
await sql`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id TEXT UNIQUE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    phone TEXT,
    is_company BOOLEAN NOT NULL DEFAULT false,
    company_name TEXT,
    pib TEXT,
    mb TEXT,
    address TEXT,
    city TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS users_email ON users (lower(email))`;

/* -------------------------------------------------------------- packages --- */
// Cenovnik. `grp` groups the pricing rails (services vs education hour packs).
// features[] renders as the bullet list. Public pricing section reads this
// table (see CENOVNIK-HANDOFF.md).
await sql`
  CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    grp TEXT NOT NULL DEFAULT 'services',
    category TEXT,
    name TEXT NOT NULL,
    price NUMERIC,
    currency TEXT NOT NULL DEFAULT 'EUR',
    unit TEXT,
    description TEXT,
    features TEXT[] NOT NULL DEFAULT '{}',
    highlighted BOOLEAN NOT NULL DEFAULT false,
    cta_label TEXT,
    cta_href TEXT,
    sort INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS packages_grp_sort ON packages (grp, sort)`;

// Seed a starter cenovnik once (services from the spec + education hour packs).
const pkgCount = await sql`SELECT count(*)::int AS count FROM packages`;
if (pkgCount[0].count === 0) {
  const seed = [
    { grp: "services", category: "AI UGC", name: "AI UGC", price: 490, unit: "/ paket", description: "Autentični AI kreatori za tvoj proizvod.", features: ["5 UGC videa", "AI glumci i glasovi", "2 runde revizija", "Isporuka 5–7 dana"], sort: 0 },
    { grp: "services", category: "AI Commercials", name: "AI Commercials", price: 890, unit: "/ projekat", description: "Kinematske AI reklame za brend.", features: ["30–60s reklama", "Scenario + storyboard", "Muzika i zvuk", "4K render"], highlighted: true, sort: 1 },
    { grp: "services", category: "AI Product Ads", name: "AI Product Ads", price: 390, unit: "/ paket", description: "Performans video reklame za proizvode.", features: ["3 varijante", "Hook A/B test", "9:16 / 1:1 / 16:9", "Spremno za Meta/TikTok"], sort: 2 },
    { grp: "services", category: "AI Avatars", name: "AI Avatars", price: 590, unit: "/ mesečno", description: "Tvoj digitalni AI avatar prezenter.", features: ["Custom avatar", "Neograničeni scenariji*", "Više jezika", "Brend glas"], sort: 3 },
    { grp: "services", category: "AI Consulting", name: "AI Consulting", price: 120, unit: "/ sat", description: "1-na-1 strategija primene AI u biznisu.", features: ["Audit procesa", "AI workflow plan", "Alati i automatizacije", "Snimak sesije"], sort: 4 },
    { grp: "services", category: "Instagram Growth", name: "Instagram Growth", price: 450, unit: "/ mesečno", description: "AI-vođen rast naloga i sadržaja.", features: ["Content plan", "AI reels", "Analitika", "Mesečni izveštaj"], sort: 5 },

    { grp: "education", category: "Edukacija", name: "2 sata", price: 90, unit: "/ 2h", description: "Intro AI sesija 1-na-1.", features: ["2 sata uživo online", "Snimak sesije", "Materijali"], sort: 0 },
    { grp: "education", category: "Edukacija", name: "5 sati", price: 210, unit: "/ 5h", description: "Fokusirani AI trening.", features: ["5 sati (fleksibilno)", "Wallet sistem", "Snimci", "Podrška"], sort: 1 },
    { grp: "education", category: "Edukacija", name: "10 sati", price: 390, unit: "/ 10h", description: "Dubinski AI program.", features: ["10 sati (fleksibilno)", "Wallet sistem", "Projekti uživo", "Prioritet termini"], highlighted: true, sort: 2 },
    { grp: "education", category: "Edukacija", name: "20 sati", price: 720, unit: "/ 20h", description: "Kompletna AI transformacija.", features: ["20 sati (fleksibilno)", "Wallet sistem", "Custom kurikulum", "1-na-1 mentorstvo"], sort: 3 },
  ];
  for (const p of seed) {
    await sql`
      INSERT INTO packages (grp, category, name, price, unit, description, features, highlighted, sort)
      VALUES (${p.grp}, ${p.category}, ${p.name}, ${p.price}, ${p.unit}, ${p.description},
              ${p.features}, ${p.highlighted ?? false}, ${p.sort})
    `;
  }
  console.log("packages seeded (6 services + 4 education packs).");
}

/* ------------------------------------------------------------- portfolio --- */
await sql`
  CREATE TABLE IF NOT EXISTS portfolio_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sort INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS portfolio_works (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES portfolio_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    client TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    poster_url TEXT,
    description TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    featured BOOLEAN NOT NULL DEFAULT true,
    sort INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
// Seed the spec's case-study categories once.
const catCount = await sql`SELECT count(*)::int AS count FROM portfolio_categories`;
if (catCount[0].count === 0) {
  const cats = ["AI UGC", "AI Commercials", "AI Product Ads", "AI Avatars", "AI Consulting", "Instagram Growth"];
  for (let i = 0; i < cats.length; i++) {
    const slug = cats[i].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await sql`INSERT INTO portfolio_categories (name, slug, sort) VALUES (${cats[i]}, ${slug}, ${i})`;
  }
  console.log("portfolio_categories seeded (6 case-study categories).");
}

/* -------------------------------------------------------------------- faq --- */
await sql`
  CREATE TABLE IF NOT EXISTS faq (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/* -------------------------------------------------------- email templates --- */
// key is the automation trigger; subject/body are admin-editable. {{var}}
// placeholders are filled at send time.
await sql`
  CREATE TABLE IF NOT EXISTS email_templates (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
const templates = [
  { key: "thank_you", name: "Zahvalnica", subject: "Hvala na porudžbini, {{ime}}!", body: "Zdravo {{ime}},\n\nHvala na poverenju. Tvoja porudžbina je primljena i uskoro krećemo.\n\nTOZA AI" },
  { key: "invoice", name: "Faktura", subject: "Faktura {{broj}} — TOZA AI", body: "Zdravo {{ime}},\n\nU prilogu je faktura {{broj}} na iznos {{iznos}}.\n\nTOZA AI" },
  { key: "onboarding", name: "Onboarding", subject: "Dobrodošao u TOZA AI 🚀", body: "Zdravo {{ime}},\n\nHajde da počnemo. Popuni onboarding formu i dostavi materijale.\n\nTOZA AI" },
  { key: "reminder", name: "Podsetnik", subject: "Podsetnik: termin {{datum}} u {{vreme}}", body: "Zdravo {{ime}},\n\nPodsećamo te na zakazan termin {{datum}} u {{vreme}}.\nMeet link: {{link}}\n\nTOZA AI" },
  { key: "project_status", name: "Status projekta", subject: "Update na tvom projektu", body: "Zdravo {{ime}},\n\nStatus tvog projekta: {{status}}.\n\nTOZA AI" },
  { key: "project_done", name: "Završetak projekta", subject: "Tvoj projekat je gotov 🎉", body: "Zdravo {{ime}},\n\nProjekat je završen. Materijali su ti dostupni na dashboardu.\n\nTOZA AI" },
  { key: "video_quote", name: "Procena za AI video", subject: "Stigla je procena za {{projekat}}", body: "Zdravo {{ime}},\n\nTvoja procena je spremna: {{cena}}, vreme izrade {{vreme}} dana. Ponuda važi do {{vazi_do}}.\n\nOtvori svoj TOZA AI nalog da pregledaš i potvrdiš ponudu.\n\n{{link}}\n\nTOZA AI" },
  { key: "proforma_issued", name: "Izdat predračun", subject: "Predračun {{broj}} — TOZA AI", body: "Zdravo {{ime}},\n\nU prilogu je predračun {{broj}} sa podacima za uplatu.\n\nTOZA AI" },
  { key: "invoice_issued", name: "Izdata faktura", subject: "Faktura {{broj}} — TOZA AI", body: "Zdravo {{ime}},\n\nU prilogu je konačna faktura {{broj}}.\n\nTOZA AI" },
  { key: "payment_reminder", name: "Podsetnik za uplatu", subject: "Podsetnik za predračun {{broj}}", body: "Zdravo {{ime}},\n\nLjubazan podsetnik da predračun {{broj}} još čeka uplatu. Dokument je ponovo u prilogu.\n\nTOZA AI" },
];
for (const t of templates) {
  await sql`
    INSERT INTO email_templates (key, name, subject, body)
    VALUES (${t.key}, ${t.name}, ${t.subject}, ${t.body})
    ON CONFLICT (key) DO NOTHING
  `;
}

/* ------------------------------------------------------------ availability --- */
// Owner-defined open days for consults/education. slots[] = "HH:MM" strings the
// client can book. Empty/absent day = closed.
await sql`
  CREATE TABLE IF NOT EXISTS availability_days (
    date DATE PRIMARY KEY,
    slots TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/* ------------------------------------------------------------ hour ledger --- */
// Education/consulting hours are a ledger, not a counter: a purchase is a
// positive row, a booking a negative one, a cancellation a positive one again.
// Balance = SUM(hours). This is what makes refund-on-cancel and the CRM history
// ("when was what spent") possible — see docs/.../shop-dashboard.md.
await sql`
  CREATE TABLE IF NOT EXISTS hour_entries (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'education',
    hours NUMERIC NOT NULL,
    reason TEXT NOT NULL DEFAULT 'purchase',
    order_id INT,
    booking_id INT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS hour_entries_user ON hour_entries (user_id, kind)`;

/* -------------------------------------------------- orders + invoices (CRM) --- */
// Payment integration (Monri) fills these via webhook later; admin/analytics
// read them now so the panel is real from day one.
await sql`
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    package_id INT REFERENCES packages(id) ON DELETE SET NULL,
    item TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS orders_user ON orders (user_id)`;
await sql`CREATE INDEX IF NOT EXISTS orders_status ON orders (status)`;
await sql`
  CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    number TEXT NOT NULL UNIQUE,
    pdf_url TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/* ------------------------------------------------------------ site content --- */
await sql`
  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/* --------------------------------------------------------------- settings --- */
// Single row (id=1). Holds brand + legal (PIB, MB, žiro račun) per the spec's
// Legal static page.
await sql`
  CREATE TABLE IF NOT EXISTS studio_settings (
    id INT PRIMARY KEY DEFAULT 1,
    name TEXT,
    logo_url TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    locale TEXT NOT NULL DEFAULT 'sr',
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    company_name TEXT,
    pib TEXT,
    mb TEXT,
    bank_account TEXT,
    instagram TEXT,
    tiktok TEXT,
    youtube TEXT,
    linkedin TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`
  INSERT INTO studio_settings (id, name, currency, locale)
  VALUES (1, 'TOZA AI', 'EUR', 'sr')
  ON CONFLICT (id) DO NOTHING
`;

/* ============================================================================
   Shop / dashboard layer — checkout, projects, bookings.
   See docs/superpowers/specs/2026-07-26-shop-dashboard.md.
   Everything below is additive + idempotent, safe to re-run.
   ========================================================================== */

/* ------------------------------------------------- packages: sales routing --- */
// `flow` decides what a purchase produces: a project to deliver, or hours in
// the wallet. `slug` is the checkout URL segment.
await sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS flow TEXT NOT NULL DEFAULT 'project'`;
await sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS hours NUMERIC`;
await sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS slug TEXT`;
await sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS revisions INT NOT NULL DEFAULT 2`;

// Education packs and 1-on-1 consulting sell hours; everything else is a project.
await sql`
  UPDATE packages SET flow = 'hours'
  WHERE flow = 'project' AND (grp = 'education' OR category = 'AI Consulting')
`;
// Hours per pack come from the unit label ("/ 5h"); consulting is sold per hour.
await sql`
  UPDATE packages
  SET hours = COALESCE(
    NULLIF(substring(COALESCE(unit, '') from '([0-9]+)\\s*h'), '')::numeric,
    1
  )
  WHERE flow = 'hours' AND hours IS NULL
`;
await sql`
  UPDATE packages
  SET slug = trim(both '-' from regexp_replace(lower(grp || '-' || name), '[^a-z0-9]+', '-', 'g'))
  WHERE slug IS NULL
`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS packages_slug ON packages (slug)`;

/* --------------------------------------------------- orders: checkout data --- */
// `billing` is a snapshot taken at checkout — the invoice must not change when
// the customer later edits their profile.
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS flow TEXT NOT NULL DEFAULT 'project'`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind TEXT`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS hours NUMERIC`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_type TEXT NOT NULL DEFAULT 'individual'`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing JSONB`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider TEXT`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_ref TEXT`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT`;

/* -------------------------------------------------------------- projects --- */
// One row per paid `flow='project'` order. status drives the client-visible
// timeline: onboarding → u_izradi → na_reviziji → isporuceno.
await sql`
  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE SET NULL,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id INT REFERENCES packages(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'onboarding',
    brief JSONB,
    revisions_left INT NOT NULL DEFAULT 2,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS projects_user ON projects (user_id, status)`;

// Append-only status/note trail shown as the timeline in the client dashboard.
await sql`
  CREATE TABLE IF NOT EXISTS project_updates (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT,
    note TEXT,
    author TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS project_updates_project ON project_updates (project_id, created_at)`;

await sql`
  CREATE TABLE IF NOT EXISTS project_deliverables (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'video',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS project_deliverables_project ON project_deliverables (project_id)`;

/* ------------------------------------------------------- video requests --- */
// AI video services are sold through a private quote, never a public fixed
// price. The client sends a brief, the admin replies with price + delivery
// deadline, and only an accepted quote becomes a payable order.
await sql`
  CREATE TABLE IF NOT EXISTS video_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id INT REFERENCES packages(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    project_title TEXT NOT NULL,
    brief JSONB NOT NULL,
    buyer_type TEXT NOT NULL DEFAULT 'individual',
    clip_count INT NOT NULL DEFAULT 1,
    business_name TEXT NOT NULL DEFAULT '',
    business_description TEXT NOT NULL DEFAULT '',
    budget_eur NUMERIC,
    status TEXT NOT NULL DEFAULT 'submitted',
    quoted_amount NUMERIC,
    currency TEXT NOT NULL DEFAULT 'EUR',
    turnaround_days INT,
    quote_valid_until DATE,
    admin_note TEXT,
    revisions INT NOT NULL DEFAULT 2,
    quoted_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    order_id INT UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS video_requests_user ON video_requests (user_id, created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS video_requests_status ON video_requests (status, created_at DESC)`;
await sql`ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS buyer_type TEXT NOT NULL DEFAULT 'individual'`;
await sql`ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS clip_count INT NOT NULL DEFAULT 1`;
await sql`ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS business_description TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS budget_eur NUMERIC`;
await sql`ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS turnaround_days INT`;
// Invoice details are frozen when the request is sent. A later profile edit
// must not silently change the buyer attached to an already accepted quote.
await sql`ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS billing JSONB`;
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS quote_request_id INT REFERENCES video_requests(id) ON DELETE SET NULL`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS orders_quote_request ON orders (quote_request_id) WHERE quote_request_id IS NOT NULL`;

// Materials arrive only after payment. We store the chosen hand-off channel
// separately from the creative brief so "brief sent" and "files received" are
// unambiguous states in both dashboards.
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS materials_method TEXT`;
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS materials_value TEXT`;
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS materials_received_at TIMESTAMPTZ`;

// A hand-off is not one event. Clients send a first WeTransfer, then remember
// the logo, then re-send after the link expires — so every drop is its own row
// and projects.materials_* keeps mirroring the most recent one for the summary
// views that only ever needed "did anything arrive".
//
// seen_at is the admin's unread marker: NULL means nobody has opened it yet,
// which is what the sidebar badge counts.
await sql`
  CREATE TABLE IF NOT EXISTS project_materials (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    value TEXT NOT NULL,
    note TEXT,
    seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS project_materials_project ON project_materials (project_id, created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS project_materials_unseen ON project_materials (created_at DESC) WHERE seen_at IS NULL`;

// Carry over hand-offs made before the table existed, so no client's link is
// lost and the admin list is complete from day one.
await sql`
  INSERT INTO project_materials (project_id, method, value, seen_at, created_at)
  SELECT p.id, p.materials_method, p.materials_value, now(),
         COALESCE(p.materials_received_at, p.updated_at)
  FROM projects p
  WHERE p.materials_method IS NOT NULL
    AND p.materials_value IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM project_materials m WHERE m.project_id = p.id)
`;

/* --------------------------------------------------------- email outbox --- */
// Transactional email is durable: if the provider is missing or temporarily
// down, the message remains queued instead of silently disappearing.
await sql`
  CREATE TABLE IF NOT EXISTS email_outbox (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    template_key TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_ref TEXT,
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS email_outbox_status ON email_outbox (status, created_at)`;
await sql`ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb`;

/* -------------------------------------------------------------- bookings --- */
// A session booked against the hour wallet. `booking_slots` carries one row per
// occupied hour and its PRIMARY KEY (date, slot) is what actually prevents a
// double booking — a check-then-insert would race.
await sql`
  CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'education',
    date DATE NOT NULL,
    start_slot TEXT NOT NULL,
    hours NUMERIC NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'zakazano',
    topic TEXT,
    meet_url TEXT,
    gcal_event_id TEXT,
    recording_url TEXT,
    reminded_24h BOOLEAN NOT NULL DEFAULT false,
    reminded_1h BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS bookings_user ON bookings (user_id, date)`;
await sql`CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date, status)`;
await sql`
  CREATE TABLE IF NOT EXISTS booking_slots (
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    slot TEXT NOT NULL,
    PRIMARY KEY (date, slot)
  )
`;
await sql`CREATE INDEX IF NOT EXISTS booking_slots_booking ON booking_slots (booking_id)`;

/* ------------------------------------------- education_wallet: table → view --- */
// The old single-row-per-user counter cannot express refunds or history. It is
// replaced by a view over `hour_entries` keeping the exact same column names,
// so /api/admin/clients keeps working untouched. Existing rows are folded into
// the ledger before the table is dropped.
const walletRel = (await sql`
  SELECT c.relkind FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'education_wallet' AND n.nspname = 'public'
`);
if (walletRel[0]?.relkind === "r") {
  await sql`
    INSERT INTO hour_entries (user_id, kind, hours, reason, note)
    SELECT user_id, 'education', hours_purchased, 'purchase', 'migrirano iz education_wallet'
    FROM education_wallet WHERE hours_purchased > 0
  `;
  await sql`
    INSERT INTO hour_entries (user_id, kind, hours, reason, note)
    SELECT user_id, 'education', -hours_used, 'booking', 'migrirano iz education_wallet'
    FROM education_wallet WHERE hours_used > 0
  `;
  await sql`DROP TABLE education_wallet`;
  console.log("education_wallet: table folded into hour_entries, replaced by a view.");
}
await sql`
  CREATE OR REPLACE VIEW education_wallet AS
  SELECT user_id,
         COALESCE(SUM(hours) FILTER (WHERE hours > 0), 0) AS hours_purchased,
         COALESCE(-SUM(hours) FILTER (WHERE hours < 0), 0) AS hours_used,
         MAX(created_at) AS updated_at
  FROM hour_entries
  WHERE kind = 'education'
  GROUP BY user_id
`;

/* =========================================================================
   Payment method + invoicing.
   The buyer chooses card or bank transfer at checkout; choosing transfer
   issues a proforma immediately and the final invoice only once the money is
   confirmed (a flat-tax business records income on receipt, so an invoice
   before payment would be wrong).
   ======================================================================== */

// NULL, not a default: orders placed before the choice existed genuinely had
// no method, and pretending otherwise would falsify the history.
await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT`;

// One order now has up to two documents — the proforma the buyer pays against
// and the invoice issued after it clears — so `kind` is what distinguishes
// them and the "already invoiced" guards must be kind-aware.
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'invoice'`;
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'domestic'`;
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_at DATE`;
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE`;
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS blob_pathname TEXT`;
// The document must keep the numbers it was printed with. A rate looked up
// again next month would silently restate an issued invoice.
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_rsd NUMERIC`;
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fx_rate NUMERIC`;
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fx_date DATE`;
// Buyer details frozen at issue time, same reasoning as orders.billing.
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer JSONB`;
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS item TEXT`;
await sql`UPDATE invoices SET issued_at = created_at::date WHERE issued_at IS NULL`;
// At most one proforma and one invoice per order — the guard that makes
// re-running fulfilment idempotent.
await sql`CREATE UNIQUE INDEX IF NOT EXISTS invoices_order_kind ON invoices (order_id, kind)`;

// Payee details. `bank_account` is the domestic dinar account; IBAN/SWIFT are
// the foreign-currency ones, which a Serbian flat-tax business needs before it
// can be paid from abroad at all.
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS iban TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS swift TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS bank_name TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS bank_address TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS activity_code TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS registration_number TEXT`;
// The VAT sentence is legal text, not copy: it is left for the studio's
// accountant to fill in rather than guessed at here, and it is printed on
// every document verbatim.
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS vat_note_domestic TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS vat_note_foreign TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS invoice_due_days INT NOT NULL DEFAULT 5`;
await sql`
  UPDATE studio_settings
  SET vat_note_domestic = COALESCE(vat_note_domestic, 'POPUNITI SA KNJIGOVOĐOM — napomena o PDV-u (paušalac nije u sistemu PDV-a).'),
      vat_note_foreign = COALESCE(vat_note_foreign, 'FILL IN WITH ACCOUNTANT — VAT note for services supplied to a foreign business.')
  WHERE id = 1
`;

// Country decides which invoice template a buyer gets. Serbia (or unset) is
// domestic; anything else is the foreign, English, EUR document.
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT`;

/* ------------------------------------------------- portfolio: YouTube --- */
// Works are published Shorts, not uploaded files: the studio pastes the link it
// got from YouTube and the public page embeds it. `media_url` keeps the pasted
// URL (so the admin sees what it typed) while `youtube_id` is the parsed id the
// player actually needs — parsing on every render would repeat the same work
// and hide a bad link until someone visits the page.
//
// media_type gains the value 'youtube' alongside the existing 'image'/'video'
// rows, which stay valid for anything hosted in Blob.
// Visibility already has a flag — `featured`, which the admin UI labels
// "Prikaži na sajtu". Adding an `active` beside it would give the studio two
// switches for one decision.
await sql`ALTER TABLE portfolio_works ADD COLUMN IF NOT EXISTS youtube_id TEXT`;
await sql`CREATE INDEX IF NOT EXISTS portfolio_works_sort ON portfolio_works (sort, id)`;

/* ---------------------------------------------------------- result shots --- */
// The proof rail on the landing (#portfolio): screenshots of the accounts the
// studio runs. Uploaded from /admin/rezultati straight to Vercel Blob.
//
// `blob_pathname` is what makes deleting a row also delete the file — without
// it the store silently fills with images nothing references any more. It is
// NULL for the shots that shipped in /public, which must not be deleted.
//
// `width`/`height` are the natural pixel size, read in the browser before
// upload: next/image needs them, and deriving them from the `wide` flag (as the
// hard-coded version did) distorts anything with a different aspect ratio.
await sql`
  CREATE TABLE IF NOT EXISTS result_shots (
    id SERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    blob_pathname TEXT,
    alt TEXT NOT NULL DEFAULT '',
    handle TEXT NOT NULL DEFAULT '',
    stat TEXT NOT NULL DEFAULT '',
    width INT,
    height INT,
    wide BOOLEAN NOT NULL DEFAULT false,
    sort INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS result_shots_sort ON result_shots (sort, id) WHERE active`;

// Seed the six shots that were hard-coded in ResultsShowcase, so the studio
// opens the tab and finds its existing proof already editable instead of a
// blank page.
const shotCount = await sql`SELECT count(*)::int AS count FROM result_shots`;
if (shotCount[0].count === 0) {
  const shots = [
    { image_url: "/media/results/ig-toza.png", handle: "toza.aii", stat: "187K pratilaca · Instagram", alt: "toza.aii — Instagram profil, 187K pratilaca, verifikovan", wide: true, width: 1358, height: 1158 },
    { image_url: "/media/results/tt-toza.png", handle: "@tozaai", stat: "69.5K pratilaca · 609K lajkova", alt: "Toza Ai — TikTok profil, 69.5K pratilaca, 609K lajkova", wide: false, width: 853, height: 1846 },
    { image_url: "/media/rezultati.png", handle: "TikTok Insights", stat: "43K+ lajkova po objavi", alt: "TikTok Insights — desetine hiljada lajkova po objavi", wide: false, width: 853, height: 1846 },
    { image_url: "/media/results/tt-darija.png", handle: "@darijaaai", stat: "22.1K pratilaca · 753K lajkova", alt: "Darija Ai — TikTok profil, 22.1K pratilaca, 753K lajkova", wide: false, width: 853, height: 1846 },
    { image_url: "/media/results/ig-kaja.png", handle: "kajasretic", stat: "12.3K pratilaca · Instagram", alt: "Kaja Sretic — Instagram AI profil, 12.3K pratilaca", wide: true, width: 1358, height: 1158 },
    { image_url: "/media/results/tt-kajina.png", handle: "kajina.perspektiva", stat: "15.3K pratilaca · 183K lajkova", alt: "kajina.perspektiva — TikTok profil, 15.3K pratilaca, 183K lajkova", wide: false, width: 853, height: 1846 },
  ];
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    await sql`
      INSERT INTO result_shots (image_url, alt, handle, stat, width, height, wide, sort)
      VALUES (${s.image_url}, ${s.alt}, ${s.handle}, ${s.stat}, ${s.width}, ${s.height}, ${s.wide}, ${i})
    `;
  }
  console.log("result_shots seeded (6 shots migrated from the hard-coded rail).");
}

console.log("✅ TOZA AI schema ready:");
console.log("   staff, users, packages, portfolio_categories/works, faq,");
console.log("   email_templates, availability_days, hour_entries (+education_wallet view),");
console.log("   orders, invoices, projects (+updates/deliverables),");
console.log("   bookings (+booking_slots), site_content, studio_settings, result_shots.");
