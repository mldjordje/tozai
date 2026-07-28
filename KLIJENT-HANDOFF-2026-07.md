# TOZA AI — uputstvo za nove funkcije

Ovo uputstvo je namenjeno vlasniku sajta. Admin lozinka za sada ostaje aktivna
i koristi se kao i do sada.

Produkcijski sajt: `https://toza-ai.rs`

## 1. Gde se šta nalazi

### Javne stranice

- Početna i paketi: `https://toza-ai.rs/#paketi`
- Portfolio / radovi: `https://toza-ai.rs/portfolio`
- Rezultati su prikazani kao sekcija na početnoj strani.

### Klijentski nalog

Klijent se prijavljuje Google nalogom. Posle prijave dobija:

- Pregled naloga: `/nalog`
- Edukacija, kupljeni sati i termini: `/nalog/edukacija`
- Porudžbine i podaci za uplatu: `/nalog/porudzbine`
- Predračuni i fakture: `/nalog/fakture`
- Projekti i materijali: `/nalog/projekti`
- Podaci kupca/firme: `/nalog/profil`

### Admin panel

- Paketi i cene: `/admin/paketi`
- Portfolio Shorts linkovi: `/admin/portfolio`
- Slike rezultata: `/admin/rezultati`
- Tekstovi početne strane: `/admin/sadrzaj`
- Porudžbine i potvrda uplata: `/admin/porudzbine`
- Klijenti, ručno dodavanje sati i keš uplata: `/admin/klijenti`
- Slobodni termini za zakazivanje: `/admin/dostupnost`
- Podaci firme, banke i faktura: `/admin/podesavanja`
- Email tekstovi: `/admin/email-sabloni`

## 2. Kako radi edukacija

1. Posetilac na početnoj strani bira paket od 2, 5, 10 ili 20 sati.
2. Prijavljuje se Google nalogom.
3. Unosi podatke za račun i bira način plaćanja.
4. Ako bira uplatu na račun, odmah dobija predračun i podatke za uplatu.
5. U adminu otvori `/admin/porudzbine`, pronađi uplatu i klikni
   **Označi kao plaćeno** tek kada novac stvarno legne.
6. Kupljeni sati se tada automatski dodaju u klijentov wallet.
7. Klijent na `/nalog/edukacija` vidi raspoložive sate i bira termin.

Pakete, broj sati, cenu, opis i vidljivost menjaš u `/admin/paketi`.

### Kad neko plati kešom

Klijent koji plati na ruke nema porudžbinu u sistemu — upisuješ je ti, u
`/admin/klijenti`. Otvori klijenta (mora bar jednom da se prijavio Google
nalogom da bi postojao) i imaš dva dugmeta:

- **Dodaj sate** — sati odmah ulaze u wallet i klijent može da bira termin.
  Bez fakture, bez porudžbine. Za brz upis kad se dogovorite na licu mesta.
  Negativan broj je korekcija (skidanje sati koje si dodao greškom).
- **Evidentiraj paket** — pravi porudžbinu označenu kao plaćenu: izdaje se
  faktura sa brojem, dodaju se sati ili se otvara projekat, i klijent dobija
  isti mejl kao da je platio karticom. Ovo koristi kad keš treba da uđe u
  knjige. Iznos možeš da promeniš ako si dao popust.

Oba upisa se vide u istoriji wallet-a ispod klijenta, tako da se uvek zna
odakle je koji sat došao.

### Termini i kalendar

1. U `/admin/dostupnost` klikneš dan i uključiš sate koje klijent može da
   rezerviše. Prazan dan = zatvoreno.
2. Klijent sa satima na stanju u `/nalog/edukacija` vidi kalendar, bira dan,
   trajanje (1–4h) i početak. Nudi mu se samo ono što je zaista slobodno.
3. Rezervacija skida sate sa stanja i zaključava te termine za sve ostale.
4. Klijent može sam da otkaže najkasnije 24h pre početka — sati mu se tada
   vraćaju, a termin se oslobađa. Posle toga otkazivanje ide preko tebe.
5. Svako zakazivanje i otkazivanje ti stiže na mejl studija.

### Šta radiš kad neko zakaže — `/admin/termini`

Sve rezervisane sesije su ovde. U meniju stoji brojač koliko predstojećih
termina **još nema link** — to je jedina stvar koju klijent ne može sam.

Za svaki termin:

- **Link za sastanak** — otvoriš Google Meet (ili Zoom, svejedno), nalepiš
  link i klikneš Sačuvaj. Klijent ga istog trena vidi na `/nalog/edukacija`
  i dobija mejl sa linkom. Prazno polje + Sačuvaj briše link.
- **Održano** — posle sesije. Sati ostaju potrošeni, klijentu u istoriji piše
  "Održano" umesto "Zakazano".
- **Otkaži + vrati sate** — termin se oslobađa, sati se vraćaju klijentu na
  stanje, klijent dobija mejl.
- **Nije se pojavio** — isto otkazivanje, ali **bez** vraćanja sati.
- **Snimak** — link na snimak sesije, vidi ga klijent u "Prethodni termini".

### Automatski Meet link — poveži Google kalendar

Na vrhu `/admin/termini` stoji **Poveži Google kalendar**. Klikneš, prijaviš se
nalogom studija, odobriš pristup kalendaru — i od tog trenutka **svaka nova
rezervacija sama dobija Meet sobu**: klijentu odmah stiže link u mejlu, tebi
se termin upiše u Google kalendar, a klijent dobije i pravi kalendarski poziv.
Otkazivanje briše događaj iz kalendara.

Za stare termine (one zakazane pre povezivanja) stoji dugme **Napravi Meet
link** na samoj kartici termina.

Pre prvog povezivanja, u Google Cloud Console projektu:

1. Uključi **Google Calendar API** (APIs & Services → Library → Calendar API →
   Enable). Bez ovoga Google odbija pravljenje događaja.
2. Na OAuth consent screen dodaj scope
   `https://www.googleapis.com/auth/calendar.events`.
3. Redirect URI **ne treba dodavati** — koristi se isti onaj koji već radi za
   prijavu (`/api/auth/google/callback`).

Povezivanje radi **samo sa produkcije** (`toza-ai.rs`), jer je taj redirect URI
registrovan. Lokalni `localhost:3005` nije.

Ako Google zakaže ili kalendar nije povezan, termin se svejedno rezerviše —
samo piše "Bez linka" i nalepiš ga ručno. Rezervacija nikad ne pada zbog
Google-a.

Napomena: još ne postoji automatski podsetnik 24h/1h pre termina — kolone su
spremne, ali treba cron da ih šalje.

## 3. Kako radi plaćanje preko predračuna

Dok čekamo Monri, uplata na račun je glavni način plaćanja.

1. Klijent bira **Predračun / uplata na račun**.
2. Sistem pravi predračun sa jedinstvenim brojem i pozivom na broj.
3. Klijent dokument preuzima u `/nalog/fakture`; podaci za uplatu ostaju
   sačuvani i u `/nalog/porudzbine`.
4. Ako uplata kasni, u `/admin/porudzbine` klikni **Pošalji podsetnik**.
5. Kada uplata legne, klikni **Označi kao plaćeno**.
6. Sistem tada izdaje konačnu fakturu, šalje je kupcu i aktivira kupljene sate
   ili otvara projekat.

Nemoj označavati porudžbinu kao plaćenu na osnovu screenshota kupca. Potvrdi je
tek kada je vidiš na izvodu banke.

## 4. Šta treba uneti za paušalnu firmu

Otvori `/admin/podesavanja` i popuni:

- pun naziv preduzetničke radnje;
- ime vlasnika, adresu i grad;
- PIB i matični broj;
- šifru delatnosti;
- broj rešenja/registracije, ako knjigovođa želi da stoji u evidenciji;
- domaći dinarski račun;
- rok plaćanja predračuna, npr. 5 dana;
- domaću PDV napomenu koju potvrdi knjigovođa.

Dok podaci nisu provereni, ne šalji stvarne fakture kupcima. Posebno proveri
tačan naziv firme, PIB, račun i tekst o tome da preduzetnik nije u sistemu PDV-a.

## 5. Kada banka dostavi devizne podatke

U `/admin/podesavanja`, u odeljku **Devizno plaćanje**, unesi:

- IBAN;
- SWIFT/BIC;
- naziv banke;
- adresu banke;
- inostranu VAT napomenu na engleskom, prema tekstu knjigovođe.

Kupac koji u profilu/checkoutu izabere državu van Srbije automatski dobija
engleski dokument u EUR sa IBAN/SWIFT podacima. Kupac iz Srbije dobija domaći
dokument sa RSD protivvrednošću po srednjem kursu na dan izdavanja.

Od knjigovođe traži pisanu potvrdu za:

- domaću PDV napomenu;
- englesku VAT napomenu;
- da li konkretni kupci zahtevaju SEF/eFakturu;
- evidenciju deviznog priliva i eventualne obaveze prema NBS;
- praćenje limita paušalnog oporezivanja.

## 6. Portfolio i rezultati

### Portfolio

U `/admin/portfolio`:

1. Dodaj ili izaberi kategoriju.
2. Kao tip rada izaberi **YouTube Shorts (link)**.
3. Nalepi Shorts, `youtu.be` ili običan YouTube link.
4. Proveri naslovnu sliku i uključi **Prikaži na sajtu**.
5. Rad se pojavljuje na `/portfolio`.

Kartica na sajtu je u TOZA AI dizajnu. Kada se video pokrene, YouTube može
prikazati svoj naslov ili „Watch on YouTube“; to javni embed ne dozvoljava da se
legalno ukloni.

### Rezultati

U `/admin/rezultati` možeš:

- dodati screenshot;
- promeniti naziv naloga, statistiku i alt tekst;
- izabrati široku/usku karticu;
- menjati redosled;
- sakriti ili obrisati rezultat.

## 7. Tekstovi sajta

Otvori `/admin/sadrzaj`. Tekstovi su grupisani po sekcijama početne strane.
Sačuvana promena se objavljuje na sajtu; ponekad je potrebno osvežiti stranicu
posle nekoliko sekundi.

## 8. Email slanje

Resend je već podešen na Vercelu i produkcijsko slanje je testirano. Nije
potrebno da klijent ponovo pravi nalog ili šalje API ključ.

PDF predračun ili faktura se automatski dodaje kao prilog. Podsetnik za uplatu
se šalje iz `/admin/porudzbine`.

Resend promenljive namerno nisu postavljene lokalno. Produkcijske vrednosti
ostaju bezbedno sačuvane u Vercel projektu `toza-ai.rs`.

## 9. Google ulaz u admin

Google admin pristup je pripremljen za:

- `svetozartoza.markovic02@gmail.com`
- `tozaayt@gmail.com`

Za aktivaciju treba napraviti Google OAuth Web Client i dodati produkcijski
redirect:

`https://toza-ai.rs/api/auth/google/callback`

Potrebne Vercel promenljive:

- `GOOGLE_CLIENT_ID`;
- `GOOGLE_CLIENT_SECRET`;
- `ADMIN_BOOTSTRAP_EMAILS` sa oba emaila, odvojena zarezom.

Admin lozinka se **za sada ne uklanja**. Tek kada se potvrdi da oba Google naloga
ulaze u panel, u posebnom poslednjem koraku može se ugasiti lozinka.

## 10. Monri

Monri je jedina veća integracija koja je svesno na čekanju. Kada stignu njihovi
podaci, developeru proslediti:

- merchant key;
- auth token;
- da li je nalog testni ili produkcijski;
- dokumentaciju za webhook/potpis;
- valutu i pravila RSD naplate.

Do tada je kartična opcija isključena za kupce, a predračun radi normalno.
