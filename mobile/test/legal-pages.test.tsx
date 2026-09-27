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
}));

vi.mock('expo-router', () => ({ router: state.router }));
vi.mock('lucide-react-native', () => ({ ArrowLeft: () => React.createElement('Icon') }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', null, children),
}));
vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return { View: wrap('View'), Text: wrap('Text'), Pressable: wrap('Pressable'), ScrollView: wrap('ScrollView') };
});

describe('legal pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.router.canGoBack.mockImplementation(() => state.canGoBack);
  });

  it('renders the Impressum with operator contact and the draft notice while placeholders are open', async () => {
    const { default: ImpressumScreen } = await import('@/app/impressum');
    render(React.createElement(ImpressumScreen));

    expect(screen.getByText('Angaben gemäß § 5 DDG')).toBeTruthy();
    expect(screen.getByText('E-Mail: recipedeckapp@gmail.com')).toBeTruthy();
    expect(screen.getByText(/Entwurf: Einige Angaben zum Betreiber fehlen noch/)).toBeTruthy();
  });

  it('renders the privacy policy sections for every processor', async () => {
    const { default: DatenschutzScreen } = await import('@/app/datenschutz');
    render(React.createElement(DatenschutzScreen));

    for (const heading of ['1. Verantwortlicher', '6. Rezept-Import mit KI', '8. E-Mails', '12. Deine Rechte']) {
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

  it('links to both legal pages from the footer', async () => {
    const { LegalLinks } = await import('@/components/LegalPage');
    render(React.createElement(LegalLinks));

    fireEvent.press(screen.getByText('Impressum'));
    fireEvent.press(screen.getByText('Datenschutz'));

    expect(state.router.push).toHaveBeenCalledWith('/impressum');
    expect(state.router.push).toHaveBeenCalledWith('/datenschutz');
  });
});
