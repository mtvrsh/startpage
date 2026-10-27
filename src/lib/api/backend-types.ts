// Leaf module: backend identifiers live here so store validation can check
// `instanceType` without importing ./backend (which imports ./config at runtime
// and would create a cycle).
export const BACKEND_TYPES = ['piped', 'startpage'] as const

export type InstanceType = typeof BACKEND_TYPES[number]

export const isInstanceType = (value: unknown): value is InstanceType =>
  typeof value === 'string' && (BACKEND_TYPES as readonly string[]).includes(value)
