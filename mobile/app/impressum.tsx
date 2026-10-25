import { Linking, Pressable, Text } from 'react-native';
import { LegalHeading, LegalPage, LegalText } from '@/components/LegalPage';
import { LEGAL_OPERATOR } from '@/utils/legal-operator';

const SOURCE_CODE_URL = 'https://github.com/dacown87/rezepti';

export default function ImpressumScreen() {
  return (
    <LegalPage title="Impressum">
      <LegalHeading>Angaben gemäß § 18 Abs. 1 MStV und § 5 DDG</LegalHeading>
      <LegalText>
        {LEGAL_OPERATOR.name}
        {'\n'}
        {LEGAL_OPERATOR.careOf ? `${LEGAL_OPERATOR.careOf}\n` : ''}
        {LEGAL_OPERATOR.street}
        {'\n'}
        {LEGAL_OPERATOR.city}
        {'\n'}
        {LEGAL_OPERATOR.country}
      </LegalText>

      <LegalHeading>Kontakt</LegalHeading>
      <LegalText>E-Mail: {LEGAL_OPERATOR.email}</LegalText>

      <LegalHeading>Inhalte von Nutzerinnen und Nutzern / Meldung rechtswidriger Inhalte</LegalHeading>
      <LegalText>
        RecipeDeck importiert Rezepte aus Quellen, die Nutzerinnen und Nutzer selbst angeben, und verlinkt auf diese
        Originalquellen. Importierte Rezepte sind nur für dich bzw. deinen Haushalt sichtbar. Für die Inhalte der
        verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich. Rechtswidrige Inhalte kannst du uns
        unter {LEGAL_OPERATOR.email} melden; wir prüfen die Meldung und entfernen betroffene Inhalte unverzüglich.
      </LegalText>

      <LegalHeading>Hinweis zur Nutzung</LegalHeading>
      <LegalText>
        RecipeDeck ist ein nicht kommerzielles Open-Source-Projekt. Der Quellcode ist unter der GNU Affero General
        Public License v3.0 oder später (AGPL-3.0-or-later) lizenziert.
      </LegalText>
      <Pressable
        onPress={() => {
          void Linking.openURL(SOURCE_CODE_URL);
        }}
        accessibilityRole="link"
        accessibilityLabel="Quellcode auf GitHub öffnen"
      >
        <Text className="mb-3 text-sm leading-6 text-primary-500 underline dark:text-primary-400">
          {SOURCE_CODE_URL}
        </Text>
      </Pressable>
    </LegalPage>
  );
}
