# Cenovnik — stanje i korišćenje

Admin i javni cenovnik su povezani. Sve što se sačuva u `/admin/paketi` čita se
iz iste `packages` tabele i prikazuje na početnoj strani.

## Data contract

Table `packages` (see `scripts/init-db.mjs`). Read it via the server helper —
do not query the DB directly from the section component:

```ts
import { getPublicPackages } from "@/lib/packages";

// all active packages, or one rail:
const services  = await getPublicPackages("services");   // AI usluge
const education = await getPublicPackages("education");   // hour packs 2/5/10/20h
```

`Package` shape (from `lib/packages.ts`):

| field         | type       | notes                                             |
|---------------|------------|---------------------------------------------------|
| `id`          | number     |                                                   |
| `grp`         | string     | `"services"` \| `"education"` (rail)              |
| `category`    | string?    | e.g. "AI UGC"                                     |
| `name`        | string     | card title                                        |
| `price`       | number?    | null = "na upit"                                  |
| `currency`    | string     | default "EUR"                                     |
| `unit`        | string?    | e.g. "/ mesečno", "/ 5h", "/ projekat"           |
| `description` | string?    | one-line subtitle                                 |
| `features`    | string[]   | bullet list                                       |
| `highlighted` | boolean    | render as the "popular" card                      |
| `cta_label`   | string?    | button text (fallback to a default if null)       |
| `cta_href`    | string?    | button link (fallback e.g. `/kontakt`)            |
| `sort`        | number     | already ordered by the helper                     |
| `active`      | boolean    | helper only returns `active = true`               |

## Pravila koja su implementirana

- Za `flow='project'` (AI video) javna kartica **nikada ne renderuje `price`**,
  čak i kada admin interno čuva referentnu cenu. CTA vodi na privatni upit.
- `price` se javno prikazuje samo za `flow='hours'` proizvode, poput edukacije.
- **Server component** reads `getPublicPackages()` — it's `server-only`, never
  import into a client component. Pass the result down as props.
- The helper already filters `active` and orders by `sort`. Don't re-sort.
- If the table is unreachable the helper returns `[]` — render an empty/fallback
  state, don't crash.
- Admin izmene revalidiraju početnu stranicu.

## Aktuelni katalog (jul 2026)

Seeded by `npm run db:packages:2026-07` (`scripts/set-packages-2026-07.mjs`):
6 `services` rows (AI Performance Ads, AI Virality Growth, AI Cinematic Ads,
AI VSL Architect, 3D Medical Vision, AI Toon Storytelling — all `flow='project'`,
`price IS NULL`, quoted per brief) and 5 `education` rows (1h/€99, 2h/€180,
5h/€400, 10h/€700, 20h/€1200).

The rows that preceded them were **retired** (`active = false`), not deleted:
`orders`, `projects` and `video_requests` reference `packages(id)` with
`ON DELETE SET NULL`, so deleting them would erase which package each historical
order was for. They are invisible on the site and can be deleted one at a time
from `/admin/paketi` once that history is no longer wanted.

Re-running the script is safe — it upserts by `slug`. Prices and copy are meant
to be edited in `/admin/paketi` afterwards; the script is only the seed. The
static mirror in `lib/content/offerings.ts` is what renders if the DB read fails,
so re-seeding a different catalogue means updating both.

## Admin

- Editor: `app/admin/PaketiTab.tsx` → `/admin/paketi`
- API: `app/api/admin/packages/route.ts` (GET all / POST / PATCH / DELETE)

Za klijentsko uputstvo vidi `KLIJENT-HANDOFF-2026-07.md`.
