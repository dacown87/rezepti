import { LegalHeading, LegalPage, LegalText } from '@/components/LegalPage';
import { LEGAL_OPERATOR } from '@/utils/legal-operator';

export default function ImpressumScreen() {
  return (
    <LegalPage title="Impressum">
      <LegalHeading>Angaben gemäß § 5 DDG</LegalHeading>
      <LegalText>
        {LEGAL_OPERATOR.name}
        {'\n'}
        {LEGAL_OPERATOR.street}
        {'\n'}
        {LEGAL_OPERATOR.city}
        {'\n'}
        {LEGAL_OPERATOR.country}
      </LegalText>

      <LegalHeading>Kontakt</LegalHeading>
      <LegalText>E-Mail: {LEGAL_OPERATOR.email}</LegalText>

      <LegalHeading>Verbraucherstreitbeilegung</LegalHeading>
      <LegalText>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </LegalText>

      <LegalHeading>Haftung für Inhalte und Links</LegalHeading>
      <LegalText>
        RecipeDeck importiert Rezepte aus Quellen, die Nutzerinnen und Nutzer selbst angeben, und verlinkt auf
        diese Originalquellen. Für die Inhalte der verlinkten Seiten sind ausschließlich deren Betreiber
        verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir betroffene Inhalte umgehend.
      </LegalText>
    </LegalPage>
  );
}
