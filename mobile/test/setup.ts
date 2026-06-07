import { vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const originalConsoleError = console.error.bind(console);

console.error = (...args: unknown[]) => {
  const [firstArg] = args;
  if (
    typeof firstArg === 'string' &&
    firstArg.includes('react-test-renderer is deprecated')
  ) {
    return;
  }

  originalConsoleError(...args);
};

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  useFocusEffect: vi.fn(),
}));

vi.mock('expo-linking', () => ({
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  createURL: vi.fn((path?: string) => `recipedeck://${path?.replace(/^\//, '') ?? ''}`),
  getInitialURL: vi.fn(async () => null),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  },
}));

vi.mock('react-native-reanimated', () => ({
  default: {},
  useSharedValue: vi.fn((value: unknown) => ({ value })),
  useAnimatedStyle: vi.fn(() => ({})),
  withTiming: vi.fn((value: unknown) => value),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
