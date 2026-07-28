# Vercel Blob — produkcijsko podešavanje

> Status produkcije: Blob store je već povezan sa Vercel projektom
> `toza-ai.rs` i upload je podešen. Koraci ispod služe samo za proveru ili
> ponovno povezivanje u budućnosti.

Upload rezultata i medija koristi Vercel Blob direktno iz browsera, kako veliki
fajlovi ne bi udarili u limit Vercel funkcija.

## Potrebno

1. U Vercel projektu otvoriti **Storage → Blob**.
2. Povezati Blob store sa produkcijskim projektom.
3. U **Settings → Environment Variables** proveriti da postoje:
   - `BLOB_READ_WRITE_TOKEN`
   - `BLOB_STORE_ID` ako ga Vercel doda za taj store.
4. Promenljive moraju važiti za Production i Preview.
5. Uraditi redeploy posle izmene env varijabli.

Token nikad ne stavljati u `NEXT_PUBLIC_*`, git, email ili screenshot.

## Provera

U `/admin/rezultati` uploadovati jednu probnu sliku, proveriti da se pojavljuje
na početnoj strani, zatim je obrisati. Brisanje uklanja i bazni red i Blob fajl.
