# Online křížovky – automatický výběr JSONů

Statická varianta pro GitHub Pages repozitář `velcovsky/kriz`. Nepoužívá token, administraci, databázi ani ručně udržovaný seznam.

## Nasazení

1. Rozbal ZIP.
2. Zkopíruj `online.html`, složky `css/`, `js/` a `krizovky/` do kořenové složky repozitáře `velcovsky/kriz`. Zachovej svůj stávající `kriz.html` a ostatní soubory.
3. Nahraj změny do GitHubu.
4. Otevři `https://velcovsky.github.io/kriz/online.html`.
5. Chceš-li na webu odkaz, přidej do navigace stávajícího `kriz.html` odkaz `<a href="online.html">Online křížovky</a>`.

## Přidání další křížovky – bez tokenu

**Stačí přidat nový soubor `.json` do složky `krizovky/` v repozitáři a změnu nahrát do GitHubu.** Roletové menu při otevření/obnovení stránky automaticky načte seznam souborů ze složky přes veřejné GitHub API. Není potřeba upravovat HTML/JavaScript, vytvářet manifest, spouštět administraci ani používat přístupový token.

Příklad:

```
krizovky/
  YARIS.json
  Moje_dalsi_krizovka.json
  Historicka.json
```

Nový soubor se v roletce objeví po zveřejnění změny v repozitáři a obnovení stránky. Pokud jej hned nevidíš, počkej chvíli a obnov stránku.

## Formát JSON

Soubor musí obsahovat `rows`, `cols` a dvourozměrné pole `cells` se správnými rozměry. Použij stejný formát jako přiložený `krizovky/YARIS.json` (typy buněk `W`, `C`, `L` a příslušná pole nápověd/odpovědí).

## Poznámky

- Repozitář musí být veřejný, aby web mohl načítat seznam přes veřejné GitHub API.
- Samotné GitHub Pages neumí zapisovat soubory zpět do repozitáře; nový JSON proto přidáváš běžným nahráním do GitHubu (webové rozhraní, GitHub Desktop nebo git). Žádný token se na webu nepoužívá.
- Vyplněná písmena se ukládají lokálně v prohlížeči.
- Odpovědi obsažené v JSONu jsou veřejně dostupné návštěvníkům, kteří si soubor prohlédnou.
