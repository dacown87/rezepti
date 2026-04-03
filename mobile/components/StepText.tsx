import { Text, View } from 'react-native';
import { RotateCcw, RotateCw, Thermometer, Wind } from 'lucide-react-native';

// Known Cookidoo Unicode symbols and their replacements
const COOKIDOO_SYMBOLS: { chars: string[]; label: string; icon: 'ccw' | 'cw' | 'temp' | 'steam' }[] = [
  { chars: ['↺', '🔄'], label: 'Linkslauf', icon: 'ccw' },
  { chars: ['↻', '⟳'], label: 'Rechtslauf', icon: 'cw' },
  { chars: ['⚙'], label: 'Garstufe', icon: 'temp' },
  { chars: ['〰'], label: 'Sanft', icon: 'steam' },
];

const ALL_SYMBOL_CHARS = COOKIDOO_SYMBOLS.flatMap(s => s.chars);
const SPLIT_RE = new RegExp(`([${ALL_SYMBOL_CHARS.join('')}])`, 'g');

function lookupSymbol(char: string) {
  return COOKIDOO_SYMBOLS.find(s => s.chars.includes(char));
}

type Segment = { type: 'text'; value: string } | { type: 'symbol'; label: string; icon: 'ccw' | 'cw' | 'temp' | 'steam' };

function parseSegments(text: string): Segment[] {
  const parts = text.split(SPLIT_RE);
  const segments: Segment[] = [];
  for (const part of parts) {
    if (!part) continue;
    const sym = lookupSymbol(part);
    if (sym) {
      segments.push({ type: 'symbol', label: sym.label, icon: sym.icon });
    } else {
      segments.push({ type: 'text', value: part });
    }
  }
  return segments;
}

const ICON_SIZE = 13;
const ICON_COLOR = '#7c3aed';

function SymbolIcon({ icon }: { icon: 'ccw' | 'cw' | 'temp' | 'steam' }) {
  switch (icon) {
    case 'ccw':   return <RotateCcw   size={ICON_SIZE} color={ICON_COLOR} />;
    case 'cw':    return <RotateCw    size={ICON_SIZE} color={ICON_COLOR} />;
    case 'temp':  return <Thermometer size={ICON_SIZE} color={ICON_COLOR} />;
    case 'steam': return <Wind        size={ICON_SIZE} color={ICON_COLOR} />;
  }
}

interface Props {
  children: string;
}

/**
 * Renders a recipe step, replacing known Cookidoo Unicode symbols
 * (↺ ↻ ⚙ …) with icon + label so they display correctly in React Native.
 * Falls back to a plain <Text> when no symbols are present.
 */
export function StepText({ children }: Props) {
  if (!SPLIT_RE.test(children)) {
    // Reset lastIndex after test()
    SPLIT_RE.lastIndex = 0;
    return <Text className="text-gray-700 flex-1 leading-6 text-sm">{children}</Text>;
  }
  SPLIT_RE.lastIndex = 0;

  const segments = parseSegments(children);

  return (
    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return (
            <Text key={i} className="text-gray-700 leading-6 text-sm">
              {seg.value}
            </Text>
          );
        }
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
            <SymbolIcon icon={seg.icon} />
            <Text className="text-purple-700 text-xs font-medium" style={{ marginLeft: 2 }}>
              {seg.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
