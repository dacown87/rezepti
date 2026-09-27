import { LegalHeading, LegalList, LegalPage, LegalText } from '@/components/LegalPage';
import { LEGAL_OPERATOR } from '@/utils/legal-operator';

// Draft privacy policy (Art. 13 DSGVO). Describes what the app actually
// processes; keep it in sync when adding a provider or a new data category.
export default function DatenschutzScreen() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <LegalHeading>1. Verantwortlicher</LegalHeading>
      <LegalText>
        {LEGAL_OPERATOR.name}, {LEGAL_OPERATOR.street}, {LEGAL_OPERATOR.city}, {LEGAL_OPERATOR.country}
        {'\n'}
        E-Mail: {LEGAL_OPERATOR.email}
      </LegalText>

      <LegalHeading>2. Überblick</LegalHeading>
      <LegalText>
        RecipeDeck ist eine App zum Sammeln, Planen und Kochen von Rezepten. Wir verarbeiten nur die Daten, die für
        den Betrieb nötig sind. Es gibt keine Werbung, kein Tracking und keine Analyse-Tools, und wir verkaufen keine
        Daten.
      </LegalText>

      <LegalHeading>3. Konto und Anmeldung</LegalHeading>
      <LegalText>
        Für ein Konto speichern wir deine E-Mail-Adresse und dein Passwort (nur als verschlüsselter Hash). Beim
        Anmelden verarbeitet unser Authentifizierungsdienst technisch notwendige Daten wie IP-Adresse und Zeitpunkt,
        um Missbrauch zu verhindern. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
      </LegalText>
      <LegalText>
        Dienstleister: Supabase Inc. (Datenbank und Anmeldung), Server in der EU (Irland). Mit Supabase besteht ein
        Vertrag zur Auftragsverarbeitung.
      </LegalText>

      <LegalHeading>4. Deine Inhalte</LegalHeading>
      <LegalText>
        Wir speichern die Inhalte, die du in der App anlegst: Rezepte, Notizen, Bewertungen, Favoriten, Sammlungen,
        Einkaufslisten, Wochenpläne, Haushalte und deren Mitglieder sowie Fehlerberichte, die du über „Problem
        melden“ sendest. Inhalte eines Haushalts sehen alle Mitglieder dieses Haushalts. Rechtsgrundlage ist Art. 6
        Abs. 1 lit. b DSGVO.
      </LegalText>

      <LegalHeading>5. Hosting und Server-Protokolle</LegalHeading>
      <LegalText>
        Die App läuft bei Northflank Ltd. auf Servern in Westeuropa. Unser Server protokolliert je Anfrage nur
        Methode, Pfad, Statuscode und Dauer, ohne IP-Adresse, Inhalte oder Nutzerkennung. Der Hosting-Anbieter
        verarbeitet beim Verbindungsaufbau technisch bedingt IP-Adressen. Rechtsgrundlage ist unser berechtigtes
        Interesse an einem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
      </LegalText>

      <LegalHeading>6. Rezept-Import mit KI</LegalHeading>
      <LegalText>
        Wenn du ein Rezept importierst, ruft unser Server die angegebene Seite oder das Video ab. Der Inhalt (Text,
        Untertitel, Audio oder Bild, bei Foto-Import dein hochgeladenes Foto) wird zur Erkennung des Rezepts an Groq,
        Inc. (USA) übermittelt. Groq verarbeitet die Daten nur zur Beantwortung der Anfrage. Die Übermittlung in die
        USA stützt sich auf [EU-US Data Privacy Framework bzw. Standardvertragsklauseln – prüfen]. Lade deshalb keine
        Fotos hoch, auf denen Personen oder persönliche Informationen zu sehen sind.
      </LegalText>
      <LegalText>
        Verwendest du einen eigenen Groq-API-Schlüssel, wird er nur auf deinem Gerät gespeichert und mit der jeweiligen
        Anfrage an unseren Server gesendet, dort aber nicht gespeichert.
      </LegalText>
      <LegalText>
        Für Bildvorschläge sendet unser Server den Rezeptnamen an die Rezeptsuche von Chefkoch. Dabei werden keine
        personenbezogenen Daten übermittelt.
      </LegalText>

      <LegalHeading>7. Cookidoo-Verbindung (optional)</LegalHeading>
      <LegalText>
        Wenn du dein Cookidoo-Konto verbindest, speichern wir E-Mail-Adresse, Passwort und Sitzungsdaten, um
        Rezepte in deinem Auftrag abzurufen. Passwort und Sitzungsdaten sind verschlüsselt gespeichert (AES-256).
        Du kannst die Verbindung jederzeit in den Einstellungen trennen; die Daten werden dann gelöscht.
      </LegalText>

      <LegalHeading>8. E-Mails</LegalHeading>
      <LegalText>
        Bestätigungs- und Passwort-Mails sowie Rezept-Einladungen versenden wir über Brevo (Sendinblue SAS,
        Frankreich). Bei einer Einladung übermittelst du uns die E-Mail-Adresse der eingeladenen Person; wir nutzen sie
        nur für diese Einladung. Mit Brevo besteht ein Vertrag zur Auftragsverarbeitung.
      </LegalText>

      <LegalHeading>9. Push-Benachrichtigungen (optional)</LegalHeading>
      <LegalText>
        Schaltest du Benachrichtigungen ein, speichern wir die von deinem Browser erzeugte Push-Adresse. Die Zustellung
        läuft über den Push-Dienst deines Browsers (z. B. Google, Mozilla oder Apple). Du kannst Benachrichtigungen
        jederzeit in den Einstellungen oder im Browser abschalten. Rechtsgrundlage ist deine Einwilligung (Art. 6
        Abs. 1 lit. a DSGVO).
      </LegalText>

      <LegalHeading>10. Speicherung auf deinem Gerät</LegalHeading>
      <LegalText>
        Die App speichert auf deinem Gerät deine Anmeldesitzung, Einstellungen, einen Offline-Zwischenspeicher deiner
        Rezepte und offline vorgenommene Änderungen, bis sie übertragen sind. Das ist für die Funktion der App
        erforderlich (§ 25 Abs. 2 TDDDG). Es werden keine
        Tracking-Cookies gesetzt.
      </LegalText>

      <LegalHeading>11. Speicherdauer</LegalHeading>
      <LegalText>
        Wir speichern deine Daten, solange dein Konto besteht. Laufende Import-Aufträge werden nach spätestens sieben
        Tagen gelöscht. Protokolle unserer Dienstleister werden nach deren Fristen gelöscht, in der Regel nach wenigen
        Tagen. Eine Löschung deines Kontos kannst du derzeit per E-Mail an {LEGAL_OPERATOR.email} anfordern.
      </LegalText>

      <LegalHeading>12. Deine Rechte</LegalHeading>
      <LegalList
        items={[
          'Auskunft über deine gespeicherten Daten (Art. 15 DSGVO)',
          'Berichtigung unrichtiger Daten (Art. 16 DSGVO)',
          'Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)',
          'Datenübertragbarkeit (Art. 20 DSGVO)',
          'Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO)',
          'Widerruf einer Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)',
        ]}
      />
      <LegalText>
        Wende dich dafür an {LEGAL_OPERATOR.email}. Du hast außerdem das Recht, dich bei einer
        Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel bei: {LEGAL_OPERATOR.supervisoryAuthority}.
      </LegalText>
    </LegalPage>
  );
}
