# Plan — CMS tekstovi, Rezultati + Blob, Portfolio (YT Shorts), Plaćanje fakturom, Admin samo Google

Datum: 2026-07-28. Poslednji audit: 2026-07-28.

Status:

- EPIC 2, 3, 4 i fakturisanje iz EPIC 5/6 su implementirani.
- Izbor kartica/predračun, PDF prilozi, podsetnici, domaći i strani dokumenti rade.
- Monri webhook i prava kartična naplata čekaju Monri kredencijale/dokumentaciju.
- Google admin ulaz je pripremljen, ali kredencijali nisu dostavljeni i postojeća
  admin lozinka namerno ostaje aktivna do posebne završne provere oba Google naloga.
- Resend je podešen na Vercelu i produkcijsko slanje je ručno potvrđeno.
  Promenljive namerno nisu kopirane u lokalni `.env.local`.
- Vercel Blob je povezan sa produkcijskim projektom `toza-ai.rs` i upload radi.
- Operativno uputstvo za klijenta: `KLIJENT-HANDOFF-2026-07.md`.

Ovaj dokument mapira sve taskove iz brifa i beleži šta u kodu **već postoji** (da se ne
piše dvaput) i šta su otvorena pitanja koja blokiraju posao.

---

## 0. Zatečeno stanje (bitno za planiranje)

| Oblast | Postoji | Nedostaje |
|---|---|---|
| Landing tekstovi | `site_content` tabela, `GET/PUT /api/admin/content`, `SadrzajTab` sa 7 polja | **Landing ne čita `site_content` uopšte** — `app/page.tsx` čita samo `packages` + kontakt. Polja su premalo. |
| Upload | `@vercel/blob` u package.json, `POST /api/admin/upload` (server-side `put()`) | `BLOB_READ_WRITE_TOKEN` nije u `.env.local`; server route puca na Vercelu za fajlove >4.5MB |
| Rezultati | `ResultsShowcase` sekcija sa **hardkodovanim** `SHOTS` nizom (`/media/results/*.png`) | tabela, admin tab, upload, redosled |
| Portfolio | `portfolio_categories` + `portfolio_works` tabele, pun admin CRUD (`PortfolioTab`), upload fajla | YouTube Shorts model (danas je "media_url = fajl"), **javna stranica ne postoji** (Nav link `#portfolio` vodi u prazno) |
| Plaćanje | `manualProvider` (proforma + poziv na broj `TZ-00012`), `monriProvider` (spreman, bez kredencijala), `mockProvider`, `fulfillPaidOrder()` idempotentan, admin "označi kao plaćeno" | Kupac **ne bira** način — bira `.env` (`getPaymentMode()`). Nema PDF-a (`invoices.pdf_url` uvek NULL → "PDF u pripremi"). Nema inostrane varijante. |
| Admin login | lozinka (`ADMIN_PASSWORD`) + **Google staff put već radi** (`/api/auth/google/callback` gleda `staff` tabelu i postavlja admin cookie) | gašenje lozinke, seed 2 naloga, dugme na login stranici je `disabled` |
| Email | `email_outbox` + Resend, `queueQuietly`, `email_templates` | `RESEND_API_KEY` / `EMAIL_FROM` nisu u `.env.local`; nema attachmenta (faktura u prilogu) |

---

## EPIC 0 — Env i infrastruktura (blokira ostalo)

### 0.1 Vercel Blob token — **odgovor na pitanje "šta radim sa secretom"**

Secret koji si dobio je `BLOB_READ_WRITE_TOKEN` (počinje sa `vercel_blob_rw_...`).
Tri koraka:

1. **Lokalno:** dodaj red u `.env.local`:
   ```
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
   ```
   Kod ga već čita — `app/api/admin/upload/route.ts` vraća 501 "Upload nije podešen"
   dok ga nema, i radi čim se pojavi. Ne treba nikakav drugi kod.
2. **Na Vercelu:** ako si Blob store kreirao kroz Vercel dashboard i povezao ga sa
   projektom, promenljiva je **već injektovana** u Production/Preview/Development —
   proveri u Project → Settings → Environment Variables. Ako nije, dodaj je ručno u sva tri.
3. **Nikad u git.** `.gitignore` već pokriva `.env.local` — proveriti da se ne commit-uje.

Napomena: token je **read-write, server-side**. Ne sme da završi u client bundle-u
(nikad `NEXT_PUBLIC_`). Client upload (task 0.1b) ga takođe ne izlaže — browser dobija
kratkotrajni potpisani token od našeg rute.

### 0.1b Client upload umesto server upload-a — *bug koji će se pojaviti tek u produkciji*

Trenutni `/api/admin/upload` prima fajl kroz `formData()` na serveru i propušta 50MB.
Na Vercelu je **limit tela zahteva 4.5MB** — svaki veći fajl (a portfolio/rezultati
screenshoti i video sigurno jesu) dobija 413 pre nego što kod uopšte krene.

Rešenje: `@vercel/blob/client` → `upload()` u browseru + `handleUpload()` u rutu
(`/api/admin/blob/upload`), fajl ide direktno browser→Blob, server samo potpisuje.
Limit postaje 5TB. **Ovo treba uraditi pre EPIC 3.**

### 0.2 Google OAuth kredencijali
`GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` **nisu** u `.env.local` (samo
`ADMIN_PASSWORD`, `AUTH_JWT_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PAYMENTS_MOCK`).
Bez njih EPIC 1 ne može da se testira lokalno. Treba: Google Cloud Console → OAuth client
(Web), Authorized redirect URI `http://localhost:3000/api/auth/google/callback` +
produkcijski domen.

### 0.3 Resend
`RESEND_API_KEY` + `EMAIL_FROM` nisu podešeni → mejlovi se samo queue-uju u `email_outbox`,
ne šalju. Potrebno pre EPIC 5 (faktura na mejl). Vidi `RESEND-SETUP.md`.

### 0.4 `NEXT_PUBLIC_APP_URL`
Koristi se u `fulfillPaidOrder()` za linkove u mejlu. Nije postavljen → linkovi su relativni/prazni.

---

## EPIC 1 — Admin ulaz samo preko dva Google naloga

Dozvoljeni: `svetozartoza.markovic02@gmail.com`, `tozaayt@gmail.com`.

> ⚠️ Ovo je nepovratna promena pristupa. Redosled je bitan — **prvo dokazati da Google
> ulaz radi, tek onda gasiti lozinku**, inače se zaključavaš iz sopstvenog panela.

- **1.1** Seed `staff` redova za oba mejla (`role='owner'`, `active=true`) u `scripts/init-db.mjs`,
  idempotentno (`ON CONFLICT (email) DO NOTHING`). Ukloniti postojeći `owner@tozai.local` seed.
- **1.2** Podesiti Google OAuth (task 0.2) i **verifikovati** da oba naloga uđu u `/admin`.
  Put već postoji u `app/api/auth/google/callback/route.ts:112-135`.
- **1.3** Login stranica `app/admin/login/page.tsx`: skloniti password formu, aktivirati
  Google dugme → `/api/auth/google?next=/admin`.
- **1.4** Obrisati `app/api/admin/login/route.ts` i `ADMIN_PASSWORD` iz env-a + `middleware.ts`
  izuzetak za `/api/admin/login`.
- **1.5** *Safety net:* env `ADMIN_BOOTSTRAP_EMAILS` (comma-separated) koji callback proverava
  **pored** `staff` tabele. Ako se DB red slučajno obriše, ulaz i dalje postoji. Bez ovoga
  jedan `DELETE FROM staff` znači trajno zaključavanje.
- **1.6** Poruka odbijanja: mejl koji nije na listi trenutno se tiho loguje kao običan kupac i
  ide na `/nalog`. Za pokušaj ka `/admin` treba jasno "Nemaš pristup panelu".
- **1.7** Test: nedozvoljen Google nalog ne dobija admin cookie; dozvoljen dobija oba cookie-ja.

---

## EPIC 2 — Tekstovi na landingu izmenjivi iz admina

Ključni problem: `SadrzajTab` **piše** u `site_content['landing']`, ali landing to nikad ne
čita. Napisan tekst danas ne stiže nigde.

- **2.1** `lib/content/landing.ts` — tipizovana šema svih tekstualnih polja + `DEFAULTS`
  (trenutni hardkodovani stringovi iz `app/page.tsx`, `Hero`, `TextStrip`, `Packages`,
  `Education`, `Footer`) + `getLandingContent()` koja merge-uje DB preko default-a i
  **ne ruši stranicu** ako je DB nedostupan (isti obrazac kao `getPublicContact()`).
- **2.2** `app/page.tsx` + sekcijske komponente primaju tekst kao props umesto konstanti.
  Sekcije: Hero (naslov, podnaslov, 2 CTA), Brojevi (4 × value+label — sad hardkodovano
  `STATS`), TextStrip, Rezultati (naslov/CTA), Paketi (eyebrow/naslov/opis), Edukacija,
  Booking (badge, naslov, CTA), Footer.
- **2.3** `SadrzajTab` prepisan: polja grupisana po sekcijama, repeatable liste (Brojevi),
  live preview link. Trenutnih 7 polja postaje ~30.
- **2.4** `revalidatePath("/")` u `PUT /api/admin/content` — landing je `revalidate = 60`,
  bez toga izmena čeka do minut.
- **2.5** Migracija: postojeći ključevi (`hero_title` itd.) zadržati ili mapirati, da se
  već unet tekst ne izgubi.

---

## EPIC 3 — Stranica "Rezultati" (admin uploaduje preglede)

Zavisi od 0.1 + 0.1b.

- **3.1** Tabela `result_shots`: `id, image_url, blob_pathname, alt, handle, stat, platform,
  width, height, wide, sort, active, created_at`.
  `blob_pathname` je potreban da brisanje reda obriše i fajl iz Blob-a (inače se skladište curi).
  `width/height` se čitaju pri upload-u — `next/image` ih traži, a danas su izvedeni iz
  `wide` flag-a što deformiše slike drugog odnosa stranica.
- **3.2** `/api/admin/results` — GET/POST/PATCH/DELETE (+ Blob `del()` pri brisanju).
- **3.3** Novi admin tab `Rezultati`: upload (drag&drop), polja handle/stat/alt,
  drag-reorder, toggle vidljivosti, brisanje.
- **3.4** `ResultsShowcase` čita iz baze; postojeći `SHOTS` niz ostaje kao fallback kad je
  lista prazna (isti obrazac kao paketi), da sekcija nikad ne bude prazna.
- **3.5** `next.config.ts` → `images.remotePatterns` za `*.public.blob.vercel-storage.com`,
  inače `next/image` odbija Blob URL-ove.
- **3.6** Odluka: da li je ovo i **zasebna stranica** `/rezultati` ili samo sekcija na landingu?
  Brif kaže "rezultati stranica". Predlog: sekcija ostaje (proof u toku scroll-a),
  a `/rezultati` je puna galerija sa svim uploadima. Nav "Rezultati" tada vodi na nju.

---

## EPIC 4 — Portfolio = YouTube Shorts linkovi, embed bez YT izgleda

Admin **ne uploaduje** fajl — nalepi link Shorts-a; javna strana ga embeduje.

- **4.1** Šema: `portfolio_works` dobija `youtube_id TEXT`, `media_type` dobija vrednost
  `'youtube'`. Postojeće kolone (`media_url`, `poster_url`) ostaju za stare radove.
- **4.2** Parser linka: prihvatiti `youtube.com/shorts/ID`, `youtu.be/ID`,
  `youtube.com/watch?v=ID`, `youtube.com/embed/ID` → izvući ID. Validacija u admin formi
  sa live preview thumbnaila.
- **4.3** Thumbnail: `https://i.ytimg.com/vi/ID/maxresdefault.jpg` (fallback `hqdefault.jpg`),
  ili oEmbed za naslov. Dodati `i.ytimg.com` u `remotePatterns`.
  Opciono: pri čuvanju povući thumbnail i **prekopirati u Blob**, da javna stranica ne zavisi
  od YT CDN-a i da se ne menja ako se video izbriše.
- **4.4** Admin `PortfolioTab`: kada je `media_type='youtube'`, polje "Medij (URL)" postaje
  "YouTube Shorts link", upload dugme se sakriva.
- **4.5** Javna stranica `/portfolio` + sekcija na landingu sa `id="portfolio"`
  (Nav `components/layout/Nav.tsx:12` danas linkuje na nepostojeći anchor — mrtav link).
  Grid 9:16 kartica, filter po kategoriji, klik → lightbox.
- **4.6** **Embed bez YouTube izgleda** — realno šta je moguće:
  - façade obrazac: renderuje se naša 9:16 kartica sa našim thumbnailom i našim play
    dugmetom; iframe se ubacuje **tek na klik** (brže učitavanje + čist izgled u mirovanju);
  - iframe: `youtube-nocookie.com/embed/ID?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=ID`;
  - `controls=0` sklanja traku; naslov/kanal gore i "Watch on YouTube" se **ne mogu ukloniti**
    kroz javni embed i po YouTube ToS-u se **ne smeju** prekrivati. Vizuelno se ublažavaju
    okvirom/zaobljenjem i tamnim gradijentom **izvan** iframe-a.
  - Ako je zahtev "nula YouTube tragova", jedina čista opcija je **hostovati mp4 na Blob-u**
    i pustiti `<video>`. Onda YT link postaje samo referenca. → **odluka potrebna (vidi Pitanja).**

---

## EPIC 5 — Plaćanje: kupac bira kartica vs. faktura

Danas način plaćanja bira `.env` (`getPaymentMode()`), ne kupac. Cela mehanika uplatnice
(`manualProvider`: primalac, račun, PIB, poziv na broj `TZ-00012`) **već postoji** i prikazuje
se u `CheckoutFlow` → komponenta `Placed`. Posao je: dići to na nivo izbora + napraviti PDF.

- **5.1** `orders.payment_method TEXT` (`'card' | 'invoice'`), snimljen pri kreiranju porudžbine.
- **5.2** `getPaymentProvider()` → `getProviderFor(method)`. Kartica dostupna samo kad Monri
  kredencijali postoje; dok ih nema, opcija je vidljiva ali disabled ("uskoro"), ne nestaje —
  kupac vidi da će postojati.
- **5.3** Novi korak u `CheckoutFlow` (između "Podaci za račun" i "Pregled"): izbor načina
  plaćanja, sa objašnjenjem šta sledi kod fakture (mobilna banka / menjačnica / uplatnica).
- **5.4** `POST /api/nalog/porudzbina` prima `paymentMethod`, validira da je metod aktivan
  (nikad ne verovati klijentu da je kartica dostupna).
- **5.5** Izbor "faktura" → odmah se generiše **predračun (proforma)**, ne konačna faktura.
  Konačna faktura nastaje tek kad admin potvrdi uplatu (`fulfillPaidOrder`, već postoji).
  Ovo je i poresko pitanje — paušalac prihod evidentira po naplati.
- **5.6** `invoices` tabela dobija: `kind` (`'proforma'|'invoice'`), `scope` (`'domestic'|'foreign'`),
  `issued_at`, `due_date`, `blob_pathname`, `amount_rsd`, `fx_rate`, `fx_date`, `buyer` (JSONB snapshot).
  Numeracija: odvojene serije po godini i po tipu (`PR-2026-0001` vs `TZ-2026-0001`).
  Postojeća logika dodele broja u `fulfill.ts` je već race-safe — proširiti je, ne prepisivati.
- **5.7** **PDF generisanje** — trenutno ne postoji nijedna PDF biblioteka u projektu.
  Predlog: `pdf-lib` ili `@react-pdf/renderer` (oba rade u Node runtime-u na Vercelu; Puppeteer
  ne — pretežak za serverless). PDF se upisuje u Blob (privatni pristup, potpisani URL) i
  `invoices.pdf_url` se popunjava. `/nalog/fakture` već ume da prikaže dugme "Preuzmi PDF".
- **5.8** Prikaz računa na dashboardu: `/nalog/porudzbine` kartica sa statusom "Čeka uplatu" +
  svi podaci za uplatu (primalac, račun, iznos, poziv na broj, model 97 ako ide) + dugme
  "Preuzmi predračun". Danas se ti podaci vide **samo jednom**, odmah posle checkout-a, i
  nestanu kad kupac osveži stranicu — to je najveća praktična rupa.
- **5.9** Mejl sa PDF-om u prilogu: `lib/email.ts` trenutno šalje samo `text`. Dodati
  `attachments` (Resend podržava base64/URL). Novi šabloni: `proforma_issued`, `invoice_issued`.
- **5.10** Admin: u `PorudzbineTab` filter "čeka uplatu", prikaz poziva na broj radi
  uparivanja sa izvodom, dugme "Pošalji podsetnik".
- **5.11** Monri (kad stignu podaci): webhook ruta + verifikacija potpisa (danas postoji samo
  `success` return ruta, što nije pouzdano — kupac može zatvoriti tab pre povratka).

---

## EPIC 6 — Faktura za inostranstvo (srpska paušalna firma)

Da, moguće je i **treba** da bude poseban dokument. Razlike u odnosu na domaću:

- **6.1** Detekcija: `country` polje ne postoji ni na `users` ni u `orders.billing` — dodati ga
  u profil i u checkout. `scope = country === 'RS' ? 'domestic' : 'foreign'`.
- **6.2** Sadržaj inostrane fakture (engleski, EUR):
  - "Invoice", ne "Faktura"; kupčev VAT/EORI broj ako ga ima;
  - **devizni račun**: IBAN + SWIFT/BIC + naziv i adresa banke — nema ih danas u
    `studio_settings` (postoji samo `bank_account`). Dodati `iban`, `swift`, `bank_name`, `bank_address`.
  - napomena o PDV-u: paušalac nije u sistemu PDV-a; kod usluga stranom pravnom licu mesto
    prometa je sedište primaoca → PDV se ne obračunava. Tačna formulacija i članovi zakona
    **moraju proći kroz knjigovođu** — ne upisujem broj člana napamet u dokument koji ide klijentu.
  - "šifra plaćanja" i model 97 su domaći koncepti, izostavljaju se.
- **6.3** Domaća faktura: RSD kao valuta obračuna. Ako je cena u EUR, treba srednji kurs NBS
  na dan izdavanja + prikaz oba iznosa (`amount_rsd`, `fx_rate`, `fx_date` iz 5.6).
- **6.4** Šabloni: dva PDF layout-a (sr/domaći, en/inostrani), ista pipeline funkcija.
- **6.5** Otvorene stvari za knjigovođu (vidi Pitanja): devizni priliv i NBS izveštavanje,
  limit paušalca (8M RSD), eFaktura/SEF obaveza, da li se za inostranstvo traži ugovor/faktura
  na engleskom kao osnov priliva.

---

## EPIC 7 — Popratno

- **7.1** `scripts/init-db.mjs`: sve nove tabele/kolone (idempotentno, kao i dosad).
- **7.2** `studio_settings`: nova polja (IBAN, SWIFT, banka, delatnost/šifra, broj rešenja).
- **7.3** `email_templates`: `proforma_issued`, `invoice_issued`, `payment_reminder`.
- **7.4** Testovi u `tests/` za: parser YT linka, numeraciju faktura, izbor providera po metodu,
  admin allowlist.
- **7.5** Ažurirati `CENOVNIK-HANDOFF.md` i `RESEND-SETUP.md`; napisati `BLOB-SETUP.md`.

---

## Redosled izvođenja

```
0.1 + 0.1b (Blob)  ─┬─> EPIC 3 (Rezultati)
0.2 (Google)       ─┼─> EPIC 1 (Admin auth)     [nezavisno]
                    ├─> EPIC 2 (Tekstovi)       [nezavisno, bez blokera]
                    └─> EPIC 4 (Portfolio YT)   [treba samo 0.1 za thumbnail-e]

0.3 (Resend) ──> EPIC 5 (izbor plaćanja + PDF) ──> EPIC 6 (inostranstvo)
```

Preporuka: **EPIC 1 i 2 prvi** — mali su, bez spoljnih zavisnosti, i odmah daju vidljiv efekat.
EPIC 5+6 su najveći blok (PDF pipeline + poresko) i idu na kraj.

---

## Otvorena pitanja (blokiraju odluke)

1. **Portfolio embed:** prihvatljivo da se u gornjem uglu vidi naslov + "Watch on YouTube"
   (jedino što javni embed dozvoljava), ili hostujemo mp4 na Blob-u za potpuno čist izgled?
2. **Rezultati:** zasebna stranica `/rezultati` + sekcija na landingu, ili samo jedno?
3. **Valuta:** cene su u EUR. Monri u Srbiji naplaćuje u RSD. Da li cenovnik prelazi na RSD,
   ili se prikazuje EUR a naplaćuje RSD po kursu?
4. **Knjigovođa:** formulacija PDV napomene (domaća i inostrana), obaveza SEF/eFakture za
   paušalca, devizni račun i prijava priliva. Ovo ne izmišljam — treba potvrda.
5. **Predračun vs faktura:** potvrdi da je tok predračun → uplata → faktura (a ne odmah faktura).
