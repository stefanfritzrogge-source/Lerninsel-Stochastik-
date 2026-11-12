# Die Lerninsel – kollaboratives Stochastik-Lernspiel

**Für iPad (Safari), Laptop und digitale Tafel.** Sprache: Deutsch. Die gesamte App läuft im Browser; keine Schülerkonten, kein Tracking, keine kostenpflichtigen Softwarepakete. Das Spielfeld nutzt die mitgelieferte Bildvorlage aus der Unterrichtsplanung.

## Was die Lerninsel kann

- **19 Hexfelder** entsprechend der gelieferten Karte, davon 18 Rohstofffelder und eine Wüste; 36 antippbare Kreuzungen zwischen zwei oder drei Feldern.
- **1–8 Teams**, umbenennbare Teams mit Farben, zwei Siedlungen pro Team als Voreinstellung; Limit und Catan-Abstandsregel einstellbar.
- **1–10.000 Würfelrunden pro Knopfdruck**, in jeder Runde **genau zwei sechsseitige Würfel**. Bei passender Augensumme erhält jedes angrenzende Rohstofffeld einen Rohstoff der jeweiligen Art; die Wüste und die Summe 7 liefern hier keinen Rohstoff. Eine Siedlung kann gegebenenfalls in einer Runde mehr als einen Rohstoff erhalten.
- **Siedlungsbezogener Zähler direkt auf der Karte**, Rohstoffsorten und Teamsummen in der Übersicht, echte und erwartete Häufigkeiten im Histogramm.
- **Gemeinsame Räume mit sechsstelligen Codes und Einladungslink**: Alle angeschlossenen Geräte sehen über Server-Sent Events (SSE) denselben Spielstand und können ihn gemeinsam bearbeiten. Würfe und Prüfungen laufen zentral auf dem Server.
- **Sechs Lernstationen**: Entdecken → Ergebnismenge → Ereignisse → Laplace → Baumdiagramme → mathematisch entscheiden. Interaktive Multiple-Choice-Aufgaben mit erklärendem Feedback.

## Schnellstart für den Unterricht ohne Internet (Schul-WLAN)

1. ZIP entpacken. Auf einem Laptop oder Schulrechner **Node.js 20 oder neuer** installieren (falls noch nicht vorhanden; Download: https://nodejs.org/).
2. Ein Terminal/Eingabeaufforderung **im Ordner `katans_lerninsel`** öffnen und folgenden Befehl ausführen:

   ```bash
   npm start
   ```

   Auf dem Computer öffnet die Lehrkraft `http://localhost:3000`. Der Server muss während des Unterrichts laufen.
3. Die **lokale IP-Adresse** des Computers ermitteln: Windows: `ipconfig` (IPv4-Adresse der WLAN-Verbindung); macOS: Systemeinstellungen → WLAN → Details → TCP/IP.
4. Auf **dem Computer selbst und auf den iPads** die Adresse `http://RECHNER-IP:3000` öffnen, z. B. `http://192.168.1.25:3000`. Diese IP ist nur ein Beispiel; die tatsächliche IP des Rechners einsetzen. **Nicht `localhost` auf den iPads verwenden.** Falls nötig, den Port 3000 durch die Rechner-Firewall freigeben.
5. Auf dem Lehrkraft-Gerät **„Gemeinsamen Raum starten“** antippen. Danach den sechsstelligen Raumcode nennen oder den Einladungslink teilen. Die Lernenden öffnen die Adresse des Servers und tippen **„Raum beitreten“**, oder nutzen direkt den Link.
6. Teamzahl vor der ersten Siedlung festlegen, Team auswählen, helle Eckpunkte antippen und Würfelrunden simulieren. Nach der Entdeckungsphase rechts bzw. über die Reiter zur Station **„Ergebnismenge“** wechseln.

**Wichtig zum Schul-WLAN:** Rechner und iPads müssen sich gegenseitig im Netzwerk erreichen können. Manche Schul-WLANs blockieren die Kommunikation zwischen einzelnen Geräten (Client-Isolation). Wenn `http://RECHNER-IP:3000` auf einem iPad nicht lädt, verwendet stattdessen den öffentlichen Hosting-Weg unten.

## Öffentlich zugänglich machen (iPads auch ohne gemeinsames WLAN)

Das Projekt braucht einen **Node.js-Webserver**. **Nur die `index.html` auf einem statischen Hosting-Service hochzuladen genügt für die gemeinsame Nutzung nicht.**

### Beispiel: Render-Web-Service

1. Den **entpackten Projektordner** als neues Repository nach GitHub hochladen. Im Repository-Stamm müssen `server.mjs`, `shared.mjs`, `package.json` und der Ordner `public` liegen (nicht nur die ZIP-Datei).
2. Auf https://dashboard.render.com → **New → Web Service** und das GitHub-Repository verbinden.
3. Sprache/Runtime **Node** einstellen, **Build Command** `npm install`, **Start Command** `npm start`, **Health Check Path** `/healthz` (optional); bei Bedarf einen kostenlosen Tarif wählen, wenn verfügbar. Alternativ ist eine `render.yaml` im Projekt enthalten.
4. Nach dem Deploy die zugewiesene **HTTPS-Adresse** (`https://...onrender.com`) im Browser öffnen. Der Lehrkraft-Link wird auf allen iPads funktionieren. **Keinesfalls als „Static Site“ deployen**, denn die Synchronisierung benötigt den Server.

**Einschränkungen kostenloser Hosting-Tarife:** Kostenlose Render-Webservices können bei Inaktivität einschlafen. Bei Neustart/Neudeploy gehen die dort gespeicherten Raumdaten wegen des temporären Dateisystems möglicherweise verloren. Für den 45–90-Minuten-Unterricht ist ein dauerhaft laufender lokaler Rechner oft verlässlicher. Für längere Nutzung und dauerhafte Speicherung einen Server mit persistenter Datenspeicherung bzw. bezahltem persistenten Datenträger wählen. Stand: November 2026; Konditionen können sich ändern. Render-Dokumentation: https://render.com/docs/free

## Unterrichtsablauf (Vorschlag für 45–60 Minuten)

| Phase | Zeit | Schülerauftrag |
|---|---:|---|
| Entdecken | 10 Min | Teilt euch in Teams auf und wählt zwei Siedlungen. Prognostiziert, welche Siedlung mehr Rohstoffe erhält. |
| Experimentieren | 10 Min | Simuliert zunächst 1, dann 10, danach 100 Runden. Notiert die Beobachtungen und vergleicht sie mit den Markern. |
| Ergebnismenge & Ereignis | 10 Min | Unterscheidet 36 geordnete Würfelpaare von 11 möglichen Summen; bildet das Ereignis „Summe 7“. |
| Laplace | 8 Min | Berechnet P(Summe 6) und P(mindestens ein Rohstoff) für eine Siedlung. |
| Baumdiagramme & Transfer | 12–20 Min | Betrachtet Rohstoffarten und „kein Rohstoff“, fasst zu Erfolg/Misserfolg zusammen und entscheidet zwischen zwei Standorten. |

## Mathematische Hinweise

- Elementarergebnisse sind **geordnete Würfelpaare** `(1,1)` bis `(6,6)` mit je Wahrscheinlichkeit `1/36`. Die elf möglichen **Summen** sind nicht Laplace-gleichwahrscheinlich.
- Das Baumdiagramm zu einer Siedlung mit Wolle, Lehm und Getreide benötigt **drei mögliche Rohstoffäste plus den Ast „kein Rohstoff“**. Die drei Rohstoffäste allein sind kein vollständiger Wahrscheinlichkeitsraum.
- Falls mehrere angrenzende Felder **dieselbe Zahl** tragen, treten sie gleichzeitig auf. Die detaillierten Äste zeigen daher ein gemeinsames Rohstoffbündel, nicht mehrere fälschlich disjunkte Ergebnisse.
- Für das Ereignis „mindestens ein Rohstoff“ zählen die **verschiedenen gewinnbringenden Summen** nur einmal. `P(Erfolg) = Summe der Augensummen-Gewichte / 36`.
- Für die **erwartete Anzahl der Rohstoffe** zählt dagegen jedes Feld einzeln: `E(X) = Summe der Gewichte ALLER benachbarten Rohstofffelder / 36`. Diese zwei Kennzahlen können auseinanderfallen.
- Die gelieferte Bildvorlage enthält eine **nicht standardmäßige Zahlenverteilung**. Die App übernimmt genau diese Verteilung statt sie durch ein übliches Catan-Setup zu ersetzen.

## Datenhaltung und Datenschutz

- Es gibt keine Schüler-Logins; bitte Teamnamen statt echter Namen verwenden.
- Der Raumcode ist das Zugangsgeheimnis: Jede Person mit dem Code kann spielen und Einstellungen verändern. Das eignet sich für eine vertrauensbasierte Schulklasse, ist **aber keine manipulationsgeschützte Prüfungsplattform**.
- Im lokalen Modus werden Räume in `data/rooms.json` gespeichert und beim Serverstart wiederhergestellt. Der Einzelgerät-Modus speichert den Zustand im jeweiligen Browser. Ein gemeinsamer Raum benötigt einen laufenden Server.
- `data/rooms.json` kann bei lokaler Nutzung gelöscht werden, wenn alle gespeicherten Räume entfernt werden sollen.
- Das Bildmaterial stammt aus der bereitgestellten Unterrichtsvorlage. Vor einer Veröffentlichung über die eigene Klasse hinaus sollten die Nutzungsrechte am Bild geklärt werden. Die App ist keine offizielle Anwendung der Marke Catan.

## Entwicklercheck

```bash
npm test     # sechs automatische Tests der Geometrie, Wahrscheinlichkeiten und Spielregeln
npm start    # Server unter http://localhost:3000 starten
```

Es werden **keine externen Bibliotheken** benötigt. Node.js liefert den Server; modernes HTML, CSS und JavaScript liefern die iPad-Oberfläche.
