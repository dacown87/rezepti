# RecipeDeck — Design-Implementierung

**Branch:** ReactNative  
**Status:** Ready to implement  
**Approved:** 2026-04-08  
**Mockup:** `~/.gstack/projects/dacown87-rezepti/designs/recipedeck-mobile-redesign-20260408/design-final.html`

## Entschieden

- **Light Mode:** Variant C — Weiß + Terrakotta + Gold + Kakao
- **Dark Mode:** Variant B — Espresso + Terrakotta + Saffron
- **Nav:** Logo links + "Recipe**Deck**" (Deck in Terrakotta `#C84B31`)
- **Kein Purple mehr.** Kein generisches Gray.

---

## Schritt 1 — `mobile/constants/Colors.ts`

```ts
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
```

---

## Schritt 2 — `mobile/tailwind.config.js`

Komplette Ersetzung der `colors`-Sektion:

```js
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'media',   // ← NEU: dark mode aktivieren
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#FEF5F3',
          100: '#FDE8E4',
          200: '#FAC8BF',
          300: '#F4A090',
          400: '#E8674D',
          500: '#C84B31',   // Haupt-Terrakotta
          600: '#B03E27',
          700: '#8C3020',
          800: '#6B2418',
          900: '#4A1810',
        },
        gold: {
          400: '#ECAD4B',
          500: '#D4A853',
          600: '#B8922E',
        },
        warm: {
          50:  '#FAFAFA',
          100: '#F7F3EF',
          200: '#F0EBE4',
          300: '#D4C4B8',
          400: '#BBA898',
          500: '#9E8878',
          600: '#8B7355',
          700: '#6B5540',
          800: '#4A3828',
          900: '#2C1810',
        },
        espresso: {
          700: '#3D2018',
          800: '#2D1810',
          900: '#1A0F0A',
        },
      },
    },
  },
  plugins: [],
};
```

---

## Schritt 3 — `mobile/app/(tabs)/_layout.tsx`

```tsx
import { Image } from 'react-native';
import Colors from '@/constants/Colors';

// Tab bar style:
tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tabIconSelected,
tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
tabBarStyle: {
  backgroundColor: Colors[colorScheme ?? 'light'].background,
  borderTopColor: Colors[colorScheme ?? 'light'].border,
},

// Header left (Logo + Titel):
headerLeft: () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
    <Image
      source={require('../../public/Logo.png')}
      style={{ width: 28, height: 28, borderRadius: 6 }}
    />
    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors[colorScheme ?? 'light'].text }}>
      Recipe<Text style={{ color: '#C84B31' }}>Deck</Text>
    </Text>
  </View>
),
```

---

## Schritt 4 — Klassen-Mapping (Search & Replace)

Alle 12 Dateien in `mobile/app/` per Find & Replace:

| Alt | Neu | Kontext |
|-----|-----|---------|
| `bg-purple-600` | `bg-primary-500` | Buttons, Progress, Toggle aktiv |
| `bg-purple-500` | `bg-primary-500` | — |
| `bg-purple-300` | `bg-primary-300` | — |
| `bg-purple-200` | `bg-primary-200` | — |
| `bg-purple-50` | `bg-primary-50` | Emoji-Box, Tag-BG, Hover |
| `text-purple-600` | `text-primary-500` | Links, aktive Labels |
| `text-purple-800` | `text-primary-700` | — |
| `text-purple-500` | `text-primary-500` | — |
| `text-purple-400` | `text-primary-400` | — |
| `border-purple-600` | `border-primary-500` | — |
| `border-purple-400` | `border-primary-400` | — |
| `border-purple-300` | `border-primary-300` | — |
| `border-purple-200` | `border-primary-200` | — |
| `border-purple-100` | `border-primary-100` | — |
| `bg-gray-50` | `bg-warm-50` | Screen Background |
| `bg-gray-100` | `bg-warm-100` | Inputs, Divider |
| `bg-gray-200` | `bg-warm-200` | Skeleton |
| `bg-gray-700` | `bg-espresso-700` | Cook Mode Elemente |
| `bg-gray-800` | `bg-espresso-800` | — |
| `bg-gray-900` | `bg-espresso-900` | Cook Mode Background |
| `text-gray-900` | `text-warm-900` | Primärtext |
| `text-gray-800` | `text-warm-800` | — |
| `text-gray-700` | `text-warm-700` | Sekundärtext dunkel |
| `text-gray-600` | `text-warm-600` | — |
| `text-gray-500` | `text-warm-500` | Metadaten |
| `text-gray-400` | `text-warm-500` | Placeholder |
| `text-gray-200` | `text-warm-300` | — |
| `border-gray-800` | `border-espresso-800` | Cook Mode |
| `border-gray-700` | `border-espresso-700` | Cook Mode |
| `border-gray-200` | `border-warm-200` | Card Border |
| `border-gray-100` | `border-warm-200` | Card Border |
| `border-gray-50` | `border-warm-100` | — |
| `text-amber-500` | `text-gold-500` | Sterne |
| `fill-amber-500` | Hardcode `fill="#D4A853"` | Star SVG fill |
| `color="#9333ea"` | `color="#C84B31"` | Icon color props |
| `color="#9ca3af"` | `color="#9E8878"` | Meta icon colors |

---

## Schritt 5 — Hardcoded Hex-Werte in `settings.tsx`

```tsx
color="#6B7280"  →  color="#9E8878"
color="#4B5563"  →  color="#8B7355"
placeholderTextColor="#9CA3AF"  →  placeholderTextColor="#9E8878"
```

Status-Farben (grün/gelb für Prozent-Anzeige) bleiben unverändert.

---

## Schritt 6 — Card-Stil in allen Screens

Jede Recipe-Card bekommt einen Terrakotta-Akzent links (konsistent Light + Dark):

```tsx
// Vorher:
className="... border border-gray-100"

// Nachher:
className="... border border-warm-200 border-l-2 border-l-primary-500"
// oder per style:
style={{ borderLeftColor: '#C84B31', borderLeftWidth: 2 }}
```

---

## Schritt 7 — Web Build

```bash
cd mobile
npx expo export --platform web
# Output: mobile/dist/
cp -r dist/* ../public/
```

---

## Verifikation

Nach Implementierung checken:
1. `npx expo start` → iOS Simulator: Light Mode sieht aus wie Mockup C
2. Simulator auf Dark Mode stellen: Espresso BG, lesbare Tabs (#8B7355), Terrakotta-Akzente
3. "RecipeDeck" in der Nav: "Deck" ist #C84B31
4. Logo erscheint links in der Nav (28×28px)
5. Keine purple/violet Farben mehr sichtbar
6. Expo Web Build läuft durch

---

## Dateien die geändert werden

1. `mobile/constants/Colors.ts` — Token-System
2. `mobile/tailwind.config.js` — Tailwind-Farben + darkMode
3. `mobile/app/(tabs)/_layout.tsx` — Tab-Farben + Header mit Logo
4. `mobile/app/(tabs)/index.tsx` — RecipeList
5. `mobile/app/(tabs)/extract.tsx` — Extraction
6. `mobile/app/(tabs)/planner.tsx` — Planner
7. `mobile/app/(tabs)/shopping.tsx` — Shopping
8. `mobile/app/(tabs)/scanner.tsx` — Scanner
9. `mobile/app/(tabs)/settings.tsx` — Settings (+ Hex-Werte)
10. `mobile/app/recipe/[id].tsx` — RecipeDetail + CookMode
11. `mobile/app/_layout.tsx` — Root layout theme
12. `mobile/app/modal.tsx` — Modal

## Assets

- Logo: `mobile/public/Logo.png` (bereits vorhanden, terrakotta #C84B31)
- Kein neues Asset nötig
