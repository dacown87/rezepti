import { LegalHeading, LegalPage, LegalText } from '@/components/LegalPage';
import { LEGAL_OPERATOR, LEGAL_LAST_UPDATED } from '@/utils/legal-operator';

// Statische Nutzungsbedingungen (unentgeltlicher, nicht kommerzieller Dienst).
// Bewusst ohne Zustimmungs-Gate oder Versionierung (Betreiberentscheidung 2026-10-09).
export default function NutzungsbedingungenScreen() {
  return (
    <LegalPage title="Nutzungsbedingungen" lastUpdated={LEGAL_LAST_UPDATED}>
      <LegalHeading>1. Dienst und Verfügbarkeit</LegalHeading>
      <LegalText>
        RecipeDeck ist ein unentgeltlicher Dienst. Es besteht kein Anspruch auf eine dauerhafte Verfügbarkeit. Wir
        können den Dienst jederzeit ändern oder einstellen.
      </LegalText>

      <LegalHeading>2. Mindestalter</LegalHeading>
      <LegalText>Die Nutzung setzt ein Mindestalter von 16 Jahren voraus.</LegalText>

      <LegalHeading>3. Haftung</LegalHeading>
      <LegalText>
        Wir haften unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie für
        Schäden, die auf Vorsatz oder grober Fahrlässigkeit beruhen. Im Übrigen ist die Haftung im Rahmen des § 309
        Nr. 7 BGB beschränkt.
      </LegalText>

      <LegalHeading>4. Deine Pflichten</LegalHeading>
      <LegalText>
        Du darfst keine rechtswidrigen Inhalte einstellen oder verarbeiten. Beim Import von Rezepten beachtest du das
        Urheberrecht; ein Import ist nur für den privaten Gebrauch zulässig.
      </LegalText>

      <LegalHeading>5. Meldung rechtswidriger Inhalte</LegalHeading>
      <LegalText>
        Rechtswidrige Inhalte kannst du uns unter {LEGAL_OPERATOR.email} melden. Wir prüfen Meldungen und entfernen
        betroffene Inhalte unverzüglich.
      </LegalText>

      <LegalHeading>6. Eigener Groq-Schlüssel (BYOK)</LegalHeading>
      <LegalText>
        Verwendest du einen eigenen Groq-API-Schlüssel, läuft die Verarbeitung über dein eigenes Groq-Konto; es gelten
        die Bedingungen und die Acceptable Use Policy von Groq.
      </LegalText>

      <LegalHeading>7. Lizenz</LegalHeading>
      <LegalText>
        Der Quellcode von RecipeDeck steht unter der GNU Affero General Public License v3.0 oder später
        (AGPL-3.0-or-later). Die Lizenz betrifft den Code, nicht den Betrieb dieses Dienstes.
      </LegalText>
    </LegalPage>
  );
}
