# Vercel Analytics u admin panelu

Admin → **Analitika** ima sekciju "Saobraćaj na sajtu": pregledi, posetioci,
najgledanije strane, izvori, zemlje, uređaji. Podaci se čitaju sa Vercel Web
Analytics API-ja, isti oni koje pokazuje Vercel dashboard.

Dok promenljive nisu postavljene, sekcija ispisuje šta nedostaje. Ostatak taba
(prihod, porudžbine, klijenti) radi nezavisno i ne zavisi od ovoga.

## Šta treba postaviti

| Promenljiva | Obavezna | Šta je |
| --- | --- | --- |
| `WEB_ANALYTICS_TOKEN` | da | Vercel access token |
| `WEB_ANALYTICS_PROJECT_ID` | da\* | `prj_...` id projekta |
| `WEB_ANALYTICS_TEAM_ID` | samo za team projekte | `team_...` id |

\* Na Vercel deploymentu se koristi `VERCEL_PROJECT_ID` ako je sistemska
promenljiva izložena, pa je eksplicitna potrebna prvenstveno za lokalni rad.

Imena ne počinju sa `VERCEL_` jer Vercel rezerviše taj prefiks i ne dozvoljava
kreiranje sopstvenih promenljivih pod njim.

## Koraci

1. **Web Analytics mora biti uključen** za projekat — bez toga API vraća grešku
   čak i sa ispravnim tokenom.

2. **Napravi access token**: Vercel → Account Settings → Tokens → Create.
   Scope postavi na account/team koji je vlasnik projekta (`djordje@adspire.rs`),
   ne na lični. Token se prikazuje jednom.

3. **Nađi projectId**: Project Settings → General → Project ID (`prj_...`).

4. **Team ili lični account?** Ako projekat drži tim, uzmi `team_...` iz Team
   Settings i postavi `WEB_ANALYTICS_TEAM_ID`. Ako je projekat na ličnom
   accountu, **ostavi je nepostavljenu** — poslata prazna/pogrešna vrednost je
   greška, ne "ignoriše se".

5. **Dodaj promenljive** u Project Settings → Environment Variables (Production,
   i Preview ako želiš i tamo).

6. **Redeploy.** Env promenljive se čitaju u runtime-u novog deploymenta; postojeći
   ne vidi ništa novo.

Lokalno: isti ključevi idu u `.env.local`.

## Ako sekcija javi grešku

Poruka je Vercel-ova, prosleđena kroz. Najčešće:

- `403` — token nema scope za taj account/team, ili Web Analytics nije uključen.
- `404` — pogrešan `projectId`, ili je poslat `teamId` za projekat koji nije
  timski (i obrnuto).
- `400` na dužim periodima — Hobby plan ima kratak reporting window, pa 90 dana
  može biti izvan njega. Prebaci na 7 ili 30 dana. Ukupni brojevi ("Pregleda
  ukupno") idu preko count endpointa koji nije ograničen tim prozorom, pa oni
  rade i kad grafikon ne radi.

Token nikada ne izlazi u browser: čita se samo na serveru, a `/api/admin/*` je
zaštićen staff sesijom kroz `middleware.ts`.
