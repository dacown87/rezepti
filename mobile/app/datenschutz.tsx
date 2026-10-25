import { LegalHeading, LegalList, LegalPage, LegalText } from '@/components/LegalPage';
import { LEGAL_OPERATOR } from '@/utils/legal-operator';

// Datenschutzerklärung (Art. 13 DSGVO). Describes what the app actually
// processes; keep it in sync when adding a provider or a new data category.
export default function DatenschutzScreen() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <LegalHeading>1. Verantwortlicher</LegalHeading>
      <LegalText>
        {LEGAL_OPERATOR.name}
        {'\n'}
        {LEGAL_OPERATOR.careOf ? `${LEGAL_OPERATOR.careOf}\n` : ''}
        {LEGAL_OPERATOR.street}, {LEGAL_OPERATOR.city}, {LEGAL_OPERATOR.country}
        {'\n'}
        E-Mail: {LEGAL_OPERATOR.email}
      </LegalText>
      <LegalText>
        Ein Datenschutzbeauftragter ist nicht benannt, da keine Pflicht besteht (Art. 37 DSGVO, § 38 BDSG).
      </LegalText>

      <LegalHeading>2. Überblick</LegalHeading>
      <LegalText>
        RecipeDeck ist eine App zum Sammeln, Planen und Kochen von Rezepten. Wir verarbeiten nur die Daten, die für
        den Betrieb nötig sind. RecipeDeck ist ein nicht kommerzielles Open-Source-Projekt. Es gibt keine Werbung,
        kein Tracking und keine Analyse-Tools, und wir verkaufen keine Daten.
      </LegalText>
      <LegalText>
        Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht
        statt.
      </LegalText>

      <LegalHeading>3. Konto und Anmeldung</LegalHeading>
      <LegalText>
        Für ein Konto speichern wir deine E-Mail-Adresse und dein Passwort (nur als kryptografischer Hash, nie im
        Klartext). Die Angabe dieser Daten ist für den Vertragsschluss erforderlich (Art. 13 Abs. 2 lit. e DSGVO). Die
        Nutzung setzt ein Mindestalter von 16 Jahren voraus. Beim Anmelden verarbeitet unser
        Authentifizierungsdienst technisch notwendige Daten wie IP-Adresse und Zeitpunkt, um Missbrauch zu verhindern.
        Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
      </LegalText>
      <LegalText>
        Dienstleister: Supabase Pte. Ltd. (Singapur) für Datenbank und Anmeldung, Server in der EU (Irland). Die
        Datenübermittlung erfolgt auf Grundlage der Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO); der
        Auftragsverarbeitungsvertrag ist Teil der allgemeinen Geschäftsbedingungen von Supabase.
      </LegalText>

      <LegalHeading>4. Deine Inhalte</LegalHeading>
      <LegalText>
        Wir speichern die Inhalte, die du in der App anlegst: Rezepte, Notizen, Bewertungen, Favoriten, Sammlungen,
        Einkaufslisten, Wochenpläne, Haushalte und deren Mitglieder. Dazu gehören auch Fotos, die du zu Rezepten
        hochlädst. Inhalte eines Haushalts sehen alle Mitglieder dieses Haushalts. Rechtsgrundlage ist Art. 6 Abs. 1
        lit. b DSGVO.
      </LegalText>
      <LegalText>
        Fehlerberichte, die du über „Problem melden“ sendest, enthalten technische Angaben wie App-Version,
        Betriebssystem, Browser (User-Agent), Bildschirmgröße, die aufgerufene Seite und den Zeitpunkt; bei
        Import-Fehlern zusätzlich Angaben wie die importierte Adresse und die Fehlermeldung. Rechtsgrundlage ist unser
        berechtigtes Interesse an der Fehlerbehebung (Art. 6 Abs. 1 lit. f DSGVO).
      </LegalText>
      <LegalText>
        Rezeptbilder werden direkt vom Server der Quellseite geladen; dabei erhält dieser deine IP-Adresse.
        Rechtsgrundlage ist unser berechtigtes Interesse an der Anzeige der Bilder (Art. 6 Abs. 1 lit. f DSGVO); du
        kannst dem widersprechen (siehe Abschnitt „Widerspruchsrecht“).
      </LegalText>

      <LegalHeading>5. Hosting und Server-Protokolle</LegalHeading>
      <LegalText>
        Die App läuft bei Northflank Ltd. auf Servern in Westeuropa. Unser Server protokolliert je Anfrage nur
        Methode, Pfad, Statuscode und Dauer, ohne IP-Adresse, Inhalte oder Nutzerkennung. Der Hosting-Anbieter
        verarbeitet beim Verbindungsaufbau technisch bedingt IP-Adressen. Zum Schutz vor Missbrauch verarbeitet unser
        Server deine IP-Adresse kurzzeitig im Arbeitsspeicher (z. B. zur Ratenbegrenzung). Rechtsgrundlage ist unser
        berechtigtes Interesse an einem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
      </LegalText>

      <LegalHeading>6. Rezept-Import mit KI</LegalHeading>
      <LegalText>
        Wenn du ein Rezept importierst, ruft unser Server die angegebene Seite oder das Video ab. Der Inhalt (Text,
        Untertitel, Audio oder Bild, bei Foto-Import dein hochgeladenes Foto) wird zur Erkennung des Rezepts an Groq
        übermittelt (Vertragspartner: Groq UK Limited, London; Verarbeitung auch auf Servern in den USA).
        Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Groq speichert Anfragen standardmäßig
        nicht dauerhaft; nur zur Fehleranalyse oder bei Verdacht auf Missbrauch können Anfragen bis zu 30 Tage
        protokolliert werden. Grundlage der Übermittlung sind EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c
        DSGVO); Groq ist nicht unter dem EU-US Data Privacy Framework zertifiziert. Lade deshalb keine Fotos hoch,
        auf denen Personen oder persönliche Informationen zu sehen sind.
      </LegalText>
      <LegalText>
        Verwendest du einen eigenen Groq-API-Schlüssel, wird er nur auf deinem Gerät gespeichert und mit der jeweiligen
        Anfrage an unseren Server gesendet, dort aber nicht gespeichert. Für die Nutzung deines eigenen Schlüssels
        gelten die Bedingungen und die Acceptable Use Policy von Groq.
      </LegalText>
      <LegalText>
        Für Bildvorschläge sendet unser Server den Rezeptnamen an die Rezeptsuche von Chefkoch. Dabei werden keine
        personenbezogenen Daten übermittelt. Die Vorschaubilder werden anschließend direkt von Chefkoch geladen.
      </LegalText>

      <LegalHeading>7. Cookidoo-Verbindung (optional)</LegalHeading>
      <LegalText>
        Wenn du dein Cookidoo-Konto verbindest, speichern wir E-Mail-Adresse, Passwort und Sitzungsdaten, um
        Rezepte in deinem Auftrag abzurufen. Passwort und Sitzungsdaten sind verschlüsselt gespeichert (AES-256-GCM).
        Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO); die Verarbeitung durch Vorwerk (Cookidoo)
        erfolgt in dessen eigener Verantwortung. Du kannst die Verbindung jederzeit in den Einstellungen trennen; die
        Daten werden dann gelöscht.
      </LegalText>

      <LegalHeading>8. E-Mails</LegalHeading>
      <LegalText>
        Bestätigungs- und Passwort-Mails sowie Rezept-Einladungen versenden wir über Brevo Inc. (823 Congress Ave.
        Ste 300, Austin, TX 78701, USA; Speicherorte Frankreich und Belgien). Bei einer Einladung übermittelst du uns
        die E-Mail-Adresse der eingeladenen Person; wir nutzen sie nur für diese Einladung und weisen die eingeladene
        Person dabei auf diese Datenschutzerklärung hin. Rechtsgrundlage ist die Vertragserfüllung bzw. unser
        berechtigtes Interesse an der Zustellung (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Mit Brevo besteht ein
        Vertrag zur Auftragsverarbeitung; die Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy
        Framework bzw. der Standardvertragsklauseln.
      </LegalText>

      <LegalHeading>9. Push-Benachrichtigungen (optional)</LegalHeading>
      <LegalText>
        Schaltest du Benachrichtigungen ein, speichern wir die von deinem Browser erzeugte Push-Adresse. Der Inhalt
        der Benachrichtigung ist verschlüsselt; der Push-Dienst sieht nur technische Zustelldaten. Die Zustellung
        läuft über den Push-Dienst deines Browsers (z. B. Google, Mozilla oder Apple); diese Dienste können ihren Sitz
        in den USA haben. Wir speichern die Push-Adresse, bis du Benachrichtigungen abschaltest oder dein Konto
        löschst. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).
      </LegalText>

      <LegalHeading>10. Speicherung auf deinem Gerät</LegalHeading>
      <LegalText>
        Die App speichert auf deinem Gerät deine Anmeldesitzung, Einstellungen, einen Offline-Zwischenspeicher deiner
        Rezepte und offline vorgenommene Änderungen, bis sie übertragen sind. Das ist für die Funktion der App
        erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Es werden keine Tracking-Cookies gesetzt. Der Offline-Zwischenspeicher
        wird beim Abmelden gelöscht.
      </LegalText>

      <LegalHeading>11. Speicherdauer</LegalHeading>
      <LegalText>
        Wir speichern deine Daten, solange dein Konto besteht. Laufende Import-Aufträge werden nach spätestens sieben
        Tagen gelöscht. Protokolle unserer Dienstleister werden nach deren Fristen gelöscht. Dein Konto kannst du
        jederzeit selbst löschen: in der App unter „Account“ → „Konto löschen“. Dabei werden deine Rezepte,
        Sammlungen, die Einkaufsliste, der Wochenplaner, die Cookidoo-Verbindung, Benachrichtigungs-Abos und offene
        Einladungen unwiderruflich entfernt. Kopien, die andere Nutzerinnen und Nutzer bereits erhalten haben (z. B.
        geteilte Rezepte), bleiben bestehen. Von dir gesendete Fehlerberichte bleiben ohne Bezug zu deinem Konto
        erhalten. Solange du dir einen Haushalt mit weiteren Mitgliedern teilst, ist die Selbstlöschung nicht möglich;
        schreib uns dann an {LEGAL_OPERATOR.email}.
      </LegalText>

      <LegalHeading>12. Deine Rechte</LegalHeading>
      <LegalList
        items={[
          'Auskunft über deine gespeicherten Daten (Art. 15 DSGVO)',
          'Berichtigung unrichtiger Daten (Art. 16 DSGVO)',
          'Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)',
          'Datenübertragbarkeit (Art. 20 DSGVO) — auf Anfrage als maschinenlesbare Datei',
          'Widerruf einer Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)',
        ]}
      />
      <LegalText>
        Wir beantworten deine Anfragen innerhalb eines Monats (Art. 12 Abs. 3 DSGVO). Wende dich dafür an{' '}
        {LEGAL_OPERATOR.email}. Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu
        beschweren. Zuständig ist: {LEGAL_OPERATOR.supervisoryAuthority}.
      </LegalText>

      <LegalHeading>13. Widerspruchsrecht (Art. 21 DSGVO)</LegalHeading>
      <LegalText>
        Du hast das Recht, aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit gegen die
        Verarbeitung dich betreffender personenbezogener Daten zu widersprechen, die auf Grundlage von Art. 6 Abs. 1
        lit. f DSGVO erfolgt. Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können zwingende
        schutzwürdige Gründe für die Verarbeitung nachweisen, die deine Interessen, Rechte und Freiheiten überwiegen,
        oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.
      </LegalText>

      <LegalHeading>14. Kontakt per E-Mail</LegalHeading>
      <LegalText>
        Wenn du uns unter {LEGAL_OPERATOR.email} kontaktierst, verarbeiten wir deine E-Mail-Adresse und die Inhalte
        deiner Nachricht zur Beantwortung deiner Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (bei
        Vertragsbezug) bzw. unser berechtigtes Interesse an der Bearbeitung sonstiger Anfragen (Art. 6 Abs. 1 lit. f
        DSGVO). Wir speichern die Korrespondenz bis zur abschließenden Bearbeitung, maximal 6 Monate. Unser Postfach
        wird von Google Ireland Ltd. bzw. Google LLC (USA) bereitgestellt; die Übermittlung in die USA erfolgt auf
        Grundlage des EU-US Data Privacy Framework.
      </LegalText>

      <LegalHeading>15. Empfänger und Drittlandübermittlung</LegalHeading>
      <LegalText>
        Wir übermitteln personenbezogene Daten an folgende Empfänger: Supabase Pte. Ltd. (Singapur, EU-Region Irland)
        auf Grundlage der Standardvertragsklauseln; Groq UK Limited (Großbritannien, Verarbeitung auch in den USA) auf
        Grundlage der Standardvertragsklauseln; Brevo Inc. (USA, Speicherorte Frankreich und Belgien) auf Grundlage
        des EU-US Data Privacy Framework bzw. der Standardvertragsklauseln; Google Ireland Ltd. bzw. Google LLC (USA)
        für das E-Mail-Postfach auf Grundlage des EU-US Data Privacy Framework. Beim direkten Laden von Rezeptbildern
        erhält außerdem die jeweilige Quell-Website bzw. deren CDN deine IP-Adresse.
      </LegalText>

      <LegalHeading>16. Änderungen dieser Datenschutzerklärung</LegalHeading>
      <LegalText>
        Wir passen diese Erklärung an, wenn sich unsere Verarbeitung oder die Rechtslage ändert. Die jeweils aktuelle
        Fassung findest du in der App.
      </LegalText>
    </LegalPage>
  );
}
