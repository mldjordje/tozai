# Fakture — provera za paušalca

Šta dokument sada sadrži, šta je popravljeno i šta ostaje na knjigovođi.
Nisam knjigovođa ni pravnik — ovo je provera koda protiv obaveznih elemenata
računa, ne poreski savet. Finalnu potvrdu daje knjigovođa.

## Poziv na broj — šta je to i zašto ga nemaš

Poziv na broj je polje na nalogu za prenos, ne element računa. Nije u obaveznim
elementima — služi banci i tebi da automatski upariš uplatu sa dokumentom. Zato ga
na tvojim fakturama nema i zato ti ništa ne fali.

Dve tehničke stvari zbog kojih je stari kod bio pogrešan:

- Polje prima **cifre**. Stari kod je štampao `TZ-00042` pod labelom "Poziv na
  broj" — to se ne može ukucati u e-banking, pa je kupac ili preskakao polje ili
  dobijao odbijen nalog.
- Kod **modela 97** prve dve cifre su kontrolni broj (ISO 7064, MOD 97-10) koji
  banka proverava. Referenca bez ispravnih kontrolnih cifara se odbija.

Sada je to podešavanje: Admin → Podešavanja → **Poziv na broj**.

- `Ne koristim` (podrazumevano) — dokument štampa **Svrha uplate: broj dokumenta**.
  Ovo odgovara tvojoj praksi i ništa se ne gubi.
- `Model 97` — generiše ispravnu numeričku referencu iz broja dokumenta i štampa
  `Model: 97` uz nju. Uključi samo ako želiš automatsko uparivanje uplata.

## Popravljeno

| Šta | Zašto |
| --- | --- |
| **Datum prometa** | Obavezan element i **nije** isto što i datum izdavanja — to je dan kada je usluga izvršena. Nije se štampao uopšte. Sada se čuva u bazi, štampa na računu, i može se uneti ručno kod manualnih faktura (bitno kad fakturišeš prošlomesečni rad). Predračun ga ne prikazuje jer promet još nije nastao. |
| **Mesto izdavanja** | Obavezno je "mesto **i** datum izdavanja"; štampala se samo polovina. Uzima se grad iz Podešavanja. |
| **Poziv na broj** | Vidi gore. |
| **Domaća uplata u dinarima** | Domaći račun u EUR je štampao EUR račun. Plaćanje između dva rezidenta ide u dinarima — cena u evrima je u redu (valutna klauzula), ali uplata nije. Sada se na domaćim računima štampa dinarski račun i napomena sa dinarskim iznosom po srednjem kursu NBS. Strani kupci nisu dirani. |
| **Datum i broj po beogradskom vremenu** | Datum i godina serije su se čitali sa servera, a on je na Vercelu u UTC. Sve izdato između 00:00 i 02:00 po lokalnom dobijalo je **prethodni dan** — a preko Nove godine i prethodnu godinu, što dokument stavlja u pogrešnu seriju. |

## Već je bilo u redu

- Predračun je jasno označen kao **PREDRAČUN** sa napomenom da nije poreska
  isprava — tako i treba.
- Bez pečata i potpisa je punovažno.
- Numeracija je sekvencijalna po godini i po vrsti dokumenta, dodeljuje se u istom
  upitu koji upisuje red, pa dva paralelna zahteva ne mogu dobiti isti broj.
- PDV se nigde ne obračunava i ne prikazuje.

## Ostaje na knjigovođi

1. **Tekst PDV napomene.** Admin → Podešavanja → `vat_note_domestic` i
   `vat_note_foreign`. Trenutno stoji `POPUNITI SA KNJIGOVOĐOM`. Za paušalca koji
   nije u sistemu PDV-a treba napomena o odredbi zakona po kojoj PDV nije
   obračunat — tačnu formulaciju i član daje knjigovođa. **Dokle god ovo nije
   popunjeno, računu fali obavezan element.**
2. **Napomena za strane kupce** — usluga stranom pravnom licu ima svoj režim;
   tekst ide u `vat_note_foreign`.
3. **e-Fakture (SEF).** Da li si u obavezi da izdaješ preko Sistema elektronskih
   faktura zavisi od tvog statusa i od toga kome fakturišeš. Nisam to proveravao
   i ovaj sistem ne šalje na SEF — ako obaveza postoji, ovi PDF-ovi je ne
   zadovoljavaju. Pitanje za knjigovođu.
4. **Šifra delatnosti i broj rešenja** — polja postoje u Podešavanjima; proveri sa
   knjigovođom da li ih treba na dokumentu.

## Migracija

Nove kolone (`invoices.supply_date`, `studio_settings.payment_reference_model`) su
već primenjene na bazu:

```bash
npm run db:migrate:invoice-legal
```

Idempotentno je — ponovno pokretanje ne menja ništa.
