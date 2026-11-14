# U Mastina

## Webové upozornenia

1. V OneSignal vytvorte webovú aplikáciu pre origin `https://pelinho100.github.io`.
   V konfigurácii použite vlastný kód, bez automatických výziev. Service worker je
   na `/u-mastina-menu/OneSignalSDKWorker.js` a jeho rozsah je `/u-mastina-menu/`.
2. Verejné App ID uložte do `menu-notifications-config.json`. API kľúč uložte
   v nastaveniach repozitára pod Actions secrets ako `ONESIGNAL_API_KEY`.
3. Na Androide skontrolujte prihlásenie na odber a na iPhone ho overte cez
   ikonu webovej apky na ploche. Na skúšku použite testovací odber služby.

Tlačidlo sa zobrazí po pripojení OneSignal. Zverejnenie dátumu, ktorý ešte
nebol nahratý na GitHub, spustí workflow. Editácia existujúceho týždňa ho
nespustí. Ak spustenie zlyhá, workflow možno spustiť ručne pre aktuálne verejné
menu. Odoslanie používa rovnaký identifikátor pri opakovaní daného týždňa.
