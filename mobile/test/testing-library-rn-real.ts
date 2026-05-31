import * as RNTL from '@testing-library/react-native/build/index.js';
import type * as React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import type { RenderOptions, RenderResult as RntlRenderResult } from '@testing-library/react-native/build/render';

const realRntl = ((RNTL as { default?: typeof RNTL }).default ?? RNTL) as typeof RNTL;

export const act = realRntl.act;
export const cleanup = realRntl.cleanup;
export const cleanupAsync = realRntl.cleanupAsync;
export const configure = realRntl.configure;
export const fireEvent = realRntl.fireEvent;
export const fireEventAsync = realRntl.fireEventAsync;
export const getDefaultNormalizer = realRntl.getDefaultNormalizer;
export const getQueriesForElement = realRntl.getQueriesForElement;
export const isHiddenFromAccessibility = realRntl.isHiddenFromAccessibility;
export const isInaccessible = realRntl.isInaccessible;

type UnsafeTypeMatcher = string | React.ComponentType<unknown>;
type RenderResult = Omit<
  RntlRenderResult,
  'UNSAFE_getByType' | 'UNSAFE_getAllByType' | 'UNSAFE_queryByType' | 'UNSAFE_queryAllByType'
> & {
  UNSAFE_getByType: (type: UnsafeTypeMatcher) => ReactTestInstance;
  UNSAFE_getAllByType: (type: UnsafeTypeMatcher) => Array<ReactTestInstance>;
  UNSAFE_queryByType: (type: UnsafeTypeMatcher) => ReactTestInstance | null;
  UNSAFE_queryAllByType: (type: UnsafeTypeMatcher) => Array<ReactTestInstance>;
};

export const render = (<T>(component: React.ReactElement<T>, options?: RenderOptions) =>
  realRntl.render(component, options) as RenderResult) as <T>(
  component: React.ReactElement<T>,
  options?: RenderOptions,
) => RenderResult;
export const renderAsync = realRntl.renderAsync;
export const renderHook = realRntl.renderHook;
export const userEvent = realRntl.userEvent;
export const waitFor = realRntl.waitFor;
export const waitForElementToBeRemoved = realRntl.waitForElementToBeRemoved;
export const within = realRntl.within;

export const screen = new Proxy(
  {},
  {
    get(_target, property) {
      return (realRntl.screen as unknown as Record<PropertyKey, unknown>)[property];
    },
  },
) as typeof RNTL.screen;
