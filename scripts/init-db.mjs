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
const ownerEmail = (process.env.OWNER_EMAIL ?? "owner@tozai.local").toLowerCase();
await sql`
  INSERT INTO staff (email, name, role)
  SELECT ${ownerEmail}, 'Owner', 'owner'
  WHERE NOT EXISTS (SELECT 1 FROM staff WHERE role = 'owner')
`;

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

console.log("✅ TOZA AI schema ready:");
console.log("   staff, users, packages, portfolio_categories/works, faq,");
console.log("   email_templates, availability_days, hour_entries (+education_wallet view),");
console.log("   orders, invoices, projects (+updates/deliverables),");
console.log("   bookings (+booking_slots), site_content, studio_settings.");
