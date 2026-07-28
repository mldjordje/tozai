# Resend — uputstvo za klijenta

Aplikacija već ume da šalje mejlove (`lib/email.ts` gađa Resend API). Fali samo
nalog, verifikovan domen i API ključ. Ovo je sve što klijent treba da uradi.

Kad se ključ upiše u env, mejlovi krenu sami — nema izmene koda.

---

## 1. Otvori nalog (2 min)

1. Idi na **https://resend.com/signup**.
2. Prijava preko Google naloga ili email + lozinka. **Kartica se ne traži.**
3. Potvrdi email adresu iz mejla koji stigne.

Free plan (proveri aktuelne brojeve na https://resend.com/pricing):
- ~3.000 mejlova mesečno, ~100 dnevno
- 1 domen
- logovi zadnjih 24h

Za obim koji TOZA AI šalje (procena za video, isporuka projekta) to je više nego dovoljno.

---

## 2. Dodaj i verifikuj domen (15 min + čekanje DNS-a)

Bez ovog koraka mejlovi mogu da idu **samo na tvoju sopstvenu adresu** (test režim).

1. U Resend panelu: **Domains → Add Domain**.
2. Upiši domen: `toza-ai.rs`
   - Preporuka: koristi subdomen za slanje — `mail.toza-ai.rs` ili `send.toza-ai.rs`.
     Ako slanje ikad završi na spam listi, glavni domen ostaje čist.
3. Region: **EU (Ireland)** — bliže korisnicima i lakše za GDPR.
4. Resend prikaže 3–4 DNS zapisa (MX, TXT za SPF, TXT/CNAME za DKIM, opcioni DMARC).
5. Uloguj se kod registrara domena (tamo gde je kupljen `toza-ai.rs`) → DNS podešavanja
   → dodaj **svaki** zapis tačno kako Resend piše. Ništa ne skraćuj i ne dopisuj.
6. Vrati se u Resend → **Verify**. Zeleno "Verified" ume da stigne za 5 minuta,
   ponekad traje do 24–48h (koliko registrar propagira DNS).

> Ako nemaš pristup DNS-u domena — javi, treba pristup nalogu kod registrara.

---

## 3. Napravi API ključ (1 min)

1. **API Keys → Create API Key**.
2. Ime: `tozai-produkcija`
3. Permission: **Sending access** (ne "Full access" — ključ služi samo za slanje).
4. Domain: izaberi verifikovan domen iz koraka 2.
5. **Kopiraj ključ odmah** — počinje sa `re_...` i prikazuje se **samo jednom**.
   Ako se izgubi, pravi se novi.

---

## 4. Pošalji podatke developeru

Tri stavke, preko sigurnog kanala (ne običan mejl / ne Viber):

| Šta | Primer |
|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxxxxxx` |
| `EMAIL_FROM` | `TOZA AI <no-reply@mail.toza-ai.rs>` |
| Adresa za odgovore | `office@toza-ai.rs` (na koju kupci odgovaraju) |

`EMAIL_FROM` mora biti na **verifikovanom** domenu iz koraka 2, inače Resend odbija slanje.

---

## 5. Šta developer radi (ne klijent)

```bash
# .env.local (dev) i env varijable na hostingu (produkcija)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="TOZA AI <no-reply@mail.toza-ai.rs>"
NEXT_PUBLIC_APP_URL=https://toza-ai.rs
```

`NEXT_PUBLIC_APP_URL` ide u linkove unutar mejla ("otvori svoj nalog"). Bez njega se
koristi origin requesta, što na produkciji ume da da pogrešan link.

Posle upisa: redeploy, pa test — u `/admin/video-zahtevi` pošalji procenu na svoj
nalog i proveri da mejl stigne. Isporuka projekta u `/admin/projekti` (status
`isporuceno`) šalje drugi automatski mejl.

---

## Šta se šalje

| Okidač | Kome |
|---|---|
| Admin pošalje procenu za AI video | kupcu koji je poslao upit |
| Admin obeleži projekat kao isporučen | kupcu |
| Klijent napravi porudžbinu preko računa | kupcu, sa PDF predračunom |
| Admin potvrdi uplatu | kupcu, sa PDF konačnom fakturom |
| Admin klikne „Pošalji podsetnik“ | kupcu, ponovo sa PDF predračunom |

Svaki mejl se prvo upisuje u tabelu `email_outbox`, pa tek onda šalje. Ako Resend
padne ili ključ fali, red ostaje u bazi sa statusom `failed` — ništa se ne gubi.

## Poznata ograničenja

- **`/admin/email-sabloni` trenutno ne utiče na poslate mejlove.** Šabloni se čuvaju
  u bazi, ali `lib/email.ts` prima tekst koji je već sklopljen na mestu slanja.
  Izmena šablona u panelu neće promeniti ono što kupac dobije dok se to ne poveže.
- Nema ekrana za `email_outbox` — neuspeli mejlovi se vide samo kroz bazu.
- Nema automatskog ponovnog slanja neuspelog mejla; poruka ostaje u outbox tabeli
  radi ručne provere.
