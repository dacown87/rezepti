const primary = '#C84B31';      // Terrakotta (Logo-Farbe)
const primaryLight = '#E8674D';
const gold = '#D4A853';
const goldDark = '#ECAD4B';

export default {
  light: {
    text: '#2C1810',
    textSecondary: '#9E8878',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    border: '#F0EBE4',
    tint: primary,
    tabIconDefault: '#BBA898',
    tabIconSelected: primary,
    searchBg: '#F7F3EF',
    tagBg: '#FEF5F3',
    emojiBg: '#FEF5F3',
    cardAccent: primary,
    star: gold,
  },
  dark: {
    text: '#FFFBF5',
    textSecondary: '#8B7355',
    background: '#1A0F0A',
    surface: '#2D1810',
    border: 'rgba(139,115,85,0.15)',
    tint: primary,
    tabIconDefault: '#8B7355',
    tabIconSelected: primary,
    searchBg: 'rgba(139,115,85,0.12)',
    tagBg: 'rgba(200,75,49,0.18)',
    emojiBg: 'rgba(200,75,49,0.12)',
    cardAccent: primary,
    star: goldDark,
  },
};
