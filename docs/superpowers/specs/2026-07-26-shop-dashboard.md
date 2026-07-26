# Kupovina, booking i klijentski dashboard — spec

Izvor istine: `TOZA_AI_Platform_Finalna_Specifikacija.pdf` (MVP V1).
Ovaj dokument razrađuje deo spec-a koji pokriva **Checkout / Plaćanje / Fakture /
Dashboard / Edukacije / Booking / Onboarding**, i definiše šemu i rute.

## 1. Dve prodajne rail-e

Spec propisuje dva strukturno različita proizvoda. Ne dele post-payment putanju.

| | AI klipovi (usluge) | 1‑na‑1 (edukacija, consulting) |
|---|---|---|
| `packages.grp` | `services` | `education` (+ consulting) |
| `packages.flow` | `project` | `hours` |
| Šta kupac dobija | projekat sa isporukom | **sate u wallet-u** |
| Kalendar u checkout-u | ne | **ne** |
| Posle plaćanja | onboarding brief → izrada | zakazivanje termina, sat po sat |

Ključno: kod edukacije **kupovina ≠ rezervacija**. Spec: *"Kupuju se sati
(2h/5h/10h/20h). Wallet prikazuje stanje. Rezervacijom termina automatski se
skidaju sati."* Zato je booking odvojen korak koji troši stanje wallet-a.

**AI Consulting (120 €/sat)** je u `services` grupi po cenovniku, ali je
funkcionalno 1‑na‑1 → `flow='hours'`, `hours=1`, `kind='consulting'`.
Sati se ne mešaju sa edukacijom (različita cena po satu) — razdvojeni su
`hour_entries.kind`.

## 2. Flow A — projekat (AI klipovi)

1. Kartica na `#paketi` → `/porudzbina/[slug]`
2. **Prijava** — Google OAuth obavezna. Projekat mora imati vlasnika koji ga
   prati u dashboardu.
3. **Podaci za račun** — fizičko / pravno lice. Pravno: naziv, PIB, MB, adresa,
   grad. Snima se na `users` i snapshot-uje u `orders.billing` (podaci na
   fakturi se ne smeju menjati kad korisnik kasnije edituje profil).
4. **Pregled + saglasnost** (Uslovi korišćenja) → plaćanje
5. **Webhook `paid`** (jedna funkcija, `lib/payments/fulfill.ts`) radi
   transakciono:
   - `orders.status='paid'`, `paid_at`
   - faktura: broj `TZ-<godina>-<redni>`, PDF u blob storage, red u `invoices`
   - `projects` red, `status='onboarding'`
   - email: zahvalnica + faktura + onboarding link
6. Redirect na `/nalog/projekti/[id]` → **onboarding forma**: opis projekta,
   ciljna publika, ton, referentni linkovi, materijali (WeTransfer link ili
   WhatsApp/Viber kontakt). Submit → `status='u_izradi'`.
7. **Timeline** vidljiv klijentu: `onboarding → u_izradi → na_reviziji →
   isporuceno`. Svaka promena → red u `project_updates` + email
   (`project_status` šablon).
8. **Isporuka**: admin dodaje `project_deliverables` (link/fajl). Klijent skida
   i može tražiti reviziju — broj rundi je limit iz paketa
   (`projects.revisions_left`).

## 3. Flow B — sati (edukacija / consulting)

1. `#edukacija` → paket 2/5/10/20h → isti checkout, **bez** brief koraka
2. Webhook `paid`:
   - faktura kao gore
   - `hour_entries` +N sati (`kind`, `order_id`)
   - email: zahvalnica + faktura + "zakaži prvi termin"
3. Redirect `/nalog/edukacija` → wallet kartica sa stanjem + *Zakaži termin*
4. **Booking UI**: mesečni kalendar → otvoreni dani iz `availability_days` →
   slobodni slotovi (dan minus zauzeti) → trajanje 1h/2h (kapirano stanjem) →
   tema sesije
5. **Potvrda** (server, u jednoj transakciji):
   - stanje ≥ trajanje
   - slot još slobodan — garantuje `UNIQUE(date, slot)` na `booking_slots`, ne
     provera-pa-upis (race)
   - `bookings` + `booking_slots` + `hour_entries` −N
   - email potvrda + `.ics` prilog
6. **Podsetnici** T‑24h i T‑1h — cron ruta
7. **Otkazivanje**: ≥24h pre termina → sati se vraćaju (`hour_entries` +N,
   `reason='cancel'`), slotovi oslobođeni. <24h → sati se ne vraćaju (pravilo
   ispisano u UI pre potvrde).
8. Posle sesije: admin `status='odrzano'` + link na snimak → vidi se u dashboardu.

### Zašto ledger a ne `education_wallet`

Postojeća tabela je jedan red po korisniku (`hours_purchased`, `hours_used`) —
nema istoriju, pa otkazivanje/refund sati i CRM istorija ("kada je šta
potrošeno") nisu izvodljivi. Zamenjuje je `hour_entries` (± redovi) plus **view**
`education_wallet` sa istim kolonama, tako da postojeće admin rute
(`/api/admin/clients`) rade bez izmene.

## 4. Plaćanje

Monri kredencijali još ne postoje. Checkout se gradi na pluggable provideru:

```
lib/payments/provider.ts   interface: createCheckout(order) -> {redirectUrl}
lib/payments/manual.ts     V1: predračun / uplata na račun
lib/payments/monri.ts      kasnije
lib/payments/fulfill.ts    fulfillPaidOrder(orderId) — jedina tačka koja
                           kreira fakturu/projekat/sate; zovu je i webhook i
                           admin dugme "označi kao plaćeno"
```

Bitno: `fulfillPaidOrder` mora biti idempotentna (webhook se ume ponoviti) —
guard preko `orders.paid_at IS NULL`.

## 5. Rute

```
/porudzbina/[slug]        checkout
/nalog                    pregled: projekti, wallet, sledeći termin, fakture
/nalog/projekti           lista
/nalog/projekti/[id]      timeline, brief, isporuke, revizije
/nalog/edukacija          wallet + kalendar + termini
/nalog/porudzbine         narudžbine
/nalog/fakture            fakture (PDF)
/nalog/profil             profil + podaci za račun

/api/auth/google          start OAuth (PKCE)
/api/auth/google/callback razmena koda, upis korisnika, sesija
/api/auth/logout
/api/nalog/*              dashboard API (gate-ovan u middleware)
```

Middleware gate-uje `/nalog/*` i `/api/nalog/*` klijentskom sesijom, `/admin/*`
i `/api/admin/*` admin sesijom — dva odvojena kolačića koja se ne preklapaju.

## 6. Šema — izmene

```sql
packages   + flow ('project'|'hours'), hours NUMERIC, slug TEXT UNIQUE,
             revisions INT
orders     + flow, hours, kind, buyer_type ('individual'|'company'),
             billing JSONB, paid_at, provider, provider_ref, notes
projects   NEW  order_id, user_id, title, status, brief JSONB,
                revisions_left, due_date
project_updates      NEW  project_id, status, note, created_at
project_deliverables NEW  project_id, title, url, kind
hour_entries         NEW  user_id, kind, hours NUMERIC (±), order_id,
                          booking_id, reason
education_wallet     VIEW nad hour_entries (kompatibilnost sa admin CRM-om)
bookings             NEW  user_id, kind, date, start_slot, hours, status,
                          topic, meet_url, gcal_event_id, recording_url
booking_slots        NEW  booking_id, date, slot  UNIQUE(date, slot)
```

## 7. Van opsega V1

- Google Calendar / Meet API (V1: `.ics` u mejlu, Meet link admin unosi ručno)
- Monri (V1: manual provider)
- PWA push, kuponi, affiliate, više jezika — spec ih vodi kao "Budućnost"
