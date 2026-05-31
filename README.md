# MLYNfit 2.0 - statyczna struktura

Pierwszy lokalny szkielet bez WordPressa, frameworkow i backendu.

## Struktura

```text
public/
├── index.html              landing page
├── terminarz/index.html    osobna podstrona grafiku
├── dla-firm/index.html     osobna podstrona dla firm
├── style.css               wspolny CSS
├── app.js                  wspolny Vanilla JS
└── data/
    ├── grafik.json
    ├── cennik.json
    ├── komunikaty.json
    └── site.json
```

Landing page zawiera:

- hero,
- dzisiejsze zajecia,
- o nas,
- oferte,
- cennik,
- poradnik,
- kontakt.

Osobne podstrony:

- `/terminarz/`,
- `/dla-firm/`.

Galeria na tym etapie jest celowo pominieta. Zdjecia powinny wejsc jako mocne assety hero i sekcyjne, a nie jako osobna podstrona.

## Uruchomienie lokalne

```bash
python3 -m http.server 8080 --directory public
```

Adres:

```text
http://127.0.0.1:8080/
```

## Dane

Na razie JSON-y sa lokalne i wpisane recznie. Docelowo:

```text
Google Sheets -> cron na VPS -> public/data/*.json -> frontend
```

Frontend nie pyta Google bezposrednio. Pobiera lokalne pliki JSON z Apache.

