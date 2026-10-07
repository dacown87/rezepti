// Operator details for Impressum (§ 5 DDG) and Datenschutzerklärung (Art. 13 DSGVO).
// Values in [eckigen Klammern] are placeholders and must be filled in before the
// app is opened to the public. `LEGAL_PLACEHOLDERS_OPEN` renders a visible notice
// on both pages until then.
export const LEGAL_OPERATOR = {
  name: '[Vor- und Nachname des Betreibers]',
  street: '[Straße und Hausnummer]',
  city: '[PLZ Ort]',
  country: 'Deutschland',
  email: 'recipedeckapp@gmail.com',
  // Zuständige Datenschutz-Aufsichtsbehörde richtet sich nach dem Wohnsitz bzw. Sitz des Betreibers.
  supervisoryAuthority: '[Landesdatenschutzbehörde des Bundeslandes des Betreibers]',
} as const;

export const LEGAL_LAST_UPDATED = '7. Oktober 2026';

export const LEGAL_PLACEHOLDERS_OPEN = Object.values(LEGAL_OPERATOR).some((value) => value.startsWith('['));
