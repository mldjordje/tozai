# Cenovnik — handoff for the public pricing section

The admin side is done. The public "Cenovnik" section on the landing must read
the **same `packages` table** the admin edits. Do **not** invent a second store.

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

## Rules

- Za `flow='project'` (AI video) javna kartica **nikada ne renderuje `price`**,
  čak i kada admin interno čuva referentnu cenu. CTA vodi na privatni upit.
- `price` se javno prikazuje samo za `flow='hours'` proizvode, poput edukacije.
- **Server component** reads `getPublicPackages()` — it's `server-only`, never
  import into a client component. Pass the result down as props.
- The helper already filters `active` and orders by `sort`. Don't re-sort.
- If the table is unreachable the helper returns `[]` — render an empty/fallback
  state, don't crash.
- The landing is fine to ISR-cache; the admin PATCH/POST routes should
  `revalidatePath("/")` if you add caching (currently they don't cache).
- Seeded rows already exist (6 services + 4 education packs) so you have live
  data to design against right now.

## Admin side (already built — for reference)

- Editor: `app/admin/PaketiTab.tsx` → `/admin/paketi`
- API: `app/api/admin/packages/route.ts` (GET all / POST / PATCH / DELETE)

Everything the owner edits in `/admin/paketi` flows straight to `packages`, so
your public section updates the moment they save (subject to any cache you add).
