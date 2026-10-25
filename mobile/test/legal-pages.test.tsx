import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  canGoBack: false,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(),
  },
  linking: {
    openURL: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({ router: state.router }));
vi.mock('lucide-react-native', () => ({ ArrowLeft: () => React.createElement('Icon') }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', null, children),
}));
vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    Pressable: wrap('Pressable'),
    ScrollView: wrap('ScrollView'),
    Linking: state.linking,
  };
});

describe('legal pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.router.canGoBack.mockImplementation(() => state.canGoBack);
  });

  it('renders the Impressum with the operator contact and no draft notice', async () => {
    const { default: ImpressumScreen } = await import('@/app/impressum');
    render(React.createElement(ImpressumScreen));

    expect(screen.getByText('Angaben gemäß § 18 Abs. 1 MStV und § 5 DDG')).toBeTruthy();
    expect(screen.getByText('E-Mail: kontakt@recipedeckapp.de')).toBeTruthy();
    expect(screen.queryByText(/Entwurf: Einige Angaben zum Betreiber fehlen noch/)).toBeNull();
  });

  it('renders the privacy policy sections for every processor', async () => {
    const { default: DatenschutzScreen } = await import('@/app/datenschutz');
    render(React.createElement(DatenschutzScreen));

    for (const heading of [
      '1. Verantwortlicher',
      '6. Rezept-Import mit KI',
      '8. E-Mails',
      '12. Deine Rechte',
      '13. Widerspruchsrecht (Art. 21 DSGVO)',
      '15. Empfänger und Drittlandübermittlung',
    ]) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
    expect(screen.getAllByText(/Groq/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Brevo/).length).toBeGreaterThan(0);
  });

  it('falls back to the account screen when opened directly without history', async () => {
    const { default: ImpressumScreen } = await import('@/app/impressum');
    render(React.createElement(ImpressumScreen));

    fireEvent.press(screen.getByLabelText('Zurück'));

    expect(state.router.replace).toHaveBeenCalledWith('/account');
    expect(state.router.back).not.toHaveBeenCalled();
  });

  it('links to all legal pages from the footer', async () => {
    const { LegalLinks } = await import('@/components/LegalPage');
    render(React.createElement(LegalLinks));

    fireEvent.press(screen.getByText('Impressum'));
    fireEvent.press(screen.getByText('Datenschutz'));
    fireEvent.press(screen.getByText('Nutzungsbedingungen'));

    expect(state.router.push).toHaveBeenCalledWith('/impressum');
    expect(state.router.push).toHaveBeenCalledWith('/datenschutz');
    expect(state.router.push).toHaveBeenCalledWith('/nutzungsbedingungen');
  });

  it('renders the terms of service with the key sections', async () => {
    const { default: NutzungsbedingungenScreen } = await import('@/app/nutzungsbedingungen');
    render(React.createElement(NutzungsbedingungenScreen));

    for (const heading of ['1. Dienst und Verfügbarkeit', '2. Mindestalter', '3. Haftung', '7. Lizenz']) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
    expect(screen.getByText(/AGPL-3.0-or-later/)).toBeTruthy();
  });

  it('states the non-commercial open-source nature and links the source code', async () => {
    const { default: ImpressumScreen } = await import('@/app/impressum');
    render(React.createElement(ImpressumScreen));

    expect(screen.getByText(/nicht kommerzielles Open-Source-Projekt/)).toBeTruthy();
    expect(screen.getByText(/AGPL-3.0-or-later/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Quellcode auf GitHub öffnen'));
    expect(state.linking.openURL).toHaveBeenCalledWith('https://github.com/dacown87/rezepti');
  });

  it('shows no c/o line when the operator has no careOf set', async () => {
    const { default: ImpressumScreen } = await import('@/app/impressum');
    render(React.createElement(ImpressumScreen));

    expect(screen.queryByText(/c\/o/)).toBeNull();
  });
});

describe('legal placeholders', () => {
  it('treats optional and non-string fields as not open', async () => {
    const { hasOpenPlaceholders } = await import('@/utils/legal-operator');

    expect(hasOpenPlaceholders(['Patrick Hofmann', undefined, null, 42])).toBe(false);
    expect(hasOpenPlaceholders(['[Vor- und Nachname]'])).toBe(true);
  });
});
