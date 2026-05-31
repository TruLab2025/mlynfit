# Dane i aktualizacja

Docelowo katalog `public/data/` bedzie wypelniany plikami JSON generowanymi z Google Sheets.

Minimalny przeplyw:

1. Wlasciciel edytuje Google Sheets.
2. Prosty cron na VPS pobiera CSV/JSON z Google.
3. Skrypt zapisuje gotowe pliki do `public/data/`.
4. Strona pobiera tylko lokalne pliki JSON z Apache.

Na tym etapie pliki JSON sa wpisane recznie, zeby zbudowac i sprawdzic lokalna strukture.
