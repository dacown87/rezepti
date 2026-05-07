import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

type TestNode = TestRenderer.ReactTestInstance;

let currentTree: TestRenderer.ReactTestRenderer | null = null;

function getTextContent(node: TestNode): string {
  const children = node.children ?? [];
  return children
    .map((child: string | number | TestNode) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      return getTextContent(child as TestNode);
    })
    .join('');
}

function findByText(text: string): TestNode | null {
  if (!currentTree) return null;
  const matches = currentTree.root.findAll(
    (node: TestNode) => String(node.type) === 'Text' && getTextContent(node).includes(text),
  );
  return matches[0] ?? null;
}

export function render(element: React.ReactElement) {
  act(() => {
    currentTree = TestRenderer.create(element);
  });
  return {
    toJSON: () => currentTree?.toJSON() ?? null,
    unmount: () => {
      act(() => {
        currentTree?.unmount();
      });
    },
  };
}

export const screen = {
  getByText(text: string) {
    const node = findByText(text);
    if (!node) throw new Error(`Unable to find text: ${text}`);
    return node;
  },
  queryByText(text: string) {
    return findByText(text);
  },
  UNSAFE_queryAllByType(type: string) {
    if (!currentTree) return [];
    return currentTree.root.findAll((node: TestNode) => String(node.type) === type);
  },
};

export const fireEvent = {
  press(node: TestNode) {
    const onPress = (node.props as { onPress?: () => void }).onPress;
    if (typeof onPress === 'function') onPress();
  },
};

export async function waitFor(assertion: () => void, timeoutMs = 1000) {
  const started = Date.now();
  let lastError: unknown = null;

  while (Date.now() - started < timeoutMs) {
    try {
      await act(async () => {
        assertion();
      });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  throw lastError ?? new Error('waitFor timed out');
}
