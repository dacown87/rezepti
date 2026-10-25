// Operator details for Impressum (§ 18 Abs. 1 MStV, vorsorglich § 5 DDG) and
// Datenschutzerklärung (Art. 13 DSGVO). These values are filled in for the
// public launch; `LEGAL_PLACEHOLDERS_OPEN` renders a visible notice on both
// pages only while a placeholder (a value starting with "[") is still present.
export interface LegalOperator {
  name: string;
  street: string;
  city: string;
  country: string;
  email: string;
  // Zuständige Datenschutz-Aufsichtsbehörde richtet sich nach dem Wohnsitz bzw. Sitz des Betreibers.
  supervisoryAuthority: string;
  // Optional: nur bei schriftlicher Zustellvollmacht (Recherche 1.3). Ein reiner
  // Postweiterleitungsdienst reicht dafür nicht aus.
  careOf?: string;
}

export const LEGAL_OPERATOR: LegalOperator = {
  name: 'Patrick Hofmann',
  street: 'Aschaffenburgerstr. 37',
  city: '64739 Höchst',
  country: 'Deutschland',
  email: 'kontakt@recipedeckapp.de',
  supervisoryAuthority:
    'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit (HBDI), Postfach 3163, 65021 Wiesbaden, datenschutz.hessen.de',
};

export const LEGAL_LAST_UPDATED = '25. Oktober 2026';

export function hasOpenPlaceholders(values: unknown[]): boolean {
  return values.some((value) => typeof value === 'string' && value.startsWith('['));
}

export const LEGAL_PLACEHOLDERS_OPEN = hasOpenPlaceholders(Object.values(LEGAL_OPERATOR));
