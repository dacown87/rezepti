import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

type TestNode = TestRenderer.ReactTestInstance;

export { act };

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

function findByTestId(testID: string): TestNode | null {
  if (!currentTree) return null;
  const matches = currentTree.root.findAll(
    (node: TestNode) => (node.props as { testID?: string } | undefined)?.testID === testID,
  );
  return matches[0] ?? null;
}

function findByPlaceholderText(placeholder: string): TestNode | null {
  if (!currentTree) return null;
  const matches = currentTree.root.findAll(
    (node: TestNode) =>
      (node.props as { placeholder?: string } | undefined)?.placeholder === placeholder,
  );
  return matches[0] ?? null;
}

export function render(element: React.ReactElement) {
  act(() => {
    currentTree?.unmount();
    currentTree = TestRenderer.create(element);
  });
  return renderResult();
}

export async function renderAsync(element: React.ReactElement) {
  await act(async () => {
    currentTree?.unmount();
    currentTree = TestRenderer.create(element);
    await Promise.resolve();
  });
  return renderResult();
}

function renderResult() {
  return {
    toJSON: () => currentTree?.toJSON() ?? null,
    unmount: () => {
      act(() => {
        currentTree?.unmount();
      });
    },
    UNSAFE_queryAllByType(type: string) {
      if (!currentTree) return [];
      return currentTree.root.findAll((node: TestNode) => String(node.type) === type);
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
  getByTestId(testID: string) {
    const node = findByTestId(testID);
    if (!node) throw new Error(`Unable to find testID: ${testID}`);
    return node;
  },
  queryByTestId(testID: string) {
    return findByTestId(testID);
  },
  getByPlaceholderText(placeholder: string) {
    const node = findByPlaceholderText(placeholder);
    if (!node) throw new Error(`Unable to find placeholder: ${placeholder}`);
    return node;
  },
  queryByPlaceholderText(placeholder: string) {
    return findByPlaceholderText(placeholder);
  },
  UNSAFE_queryAllByType(type: string) {
    if (!currentTree) return [];
    return currentTree.root.findAll((node: TestNode) => String(node.type) === type);
  },
};

type EventHandler = (...args: unknown[]) => unknown;

function getEventHandler(node: TestNode, propName: string): EventHandler | null {
  let current: TestNode | null = node;
  while (current && typeof (current.props as Record<string, unknown>)[propName] !== 'function') {
    current = current.parent;
  }
  return ((current?.props as Record<string, unknown> | undefined)?.[propName] as EventHandler | undefined) ?? null;
}

async function fireEventByName(node: TestNode, eventName: string, ...args: unknown[]) {
  const propName = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
  const handler = getEventHandler(node, propName);
  if (handler) {
    return act(async () => {
      await handler(...args);
    });
  }
}

export const fireEvent = Object.assign(fireEventByName, {
  async press(node: TestNode) {
    const onPress = getEventHandler(node, 'onPress');
    if (onPress) {
      return act(async () => {
        await onPress();
      });
    }
  },
  async changeText(node: TestNode, value: string) {
    const onChangeText = getEventHandler(node, 'onChangeText');
    if (onChangeText) {
      return act(async () => {
        await onChangeText(value);
      });
    }
  },
});

export async function waitFor(assertion: () => void, timeoutMs = 1000) {
  const started = Date.now();
  let lastError: unknown = null;

  while (Date.now() - started < timeoutMs) {
    try {
      await act(async () => {
        for (let i = 0; i < 20; i += 1) {
          await Promise.resolve();
        }
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
