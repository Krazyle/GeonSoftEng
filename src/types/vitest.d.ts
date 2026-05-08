import "vitest";

interface CustomMatchers<R = unknown> {
  toBeLeft(): R;
  toBeRight(): R;
  toBeNothing(): R;
  toBeJust(): R;
  toEqualRight(expected: unknown): R;
  toEqualLeft(expected: unknown): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
