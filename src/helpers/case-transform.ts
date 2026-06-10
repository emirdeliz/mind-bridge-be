const toCamelKey = (key: string): string =>
  key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

const toSnakeKey = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const keysToCamel = <T>(value: unknown): T => {
  if (Array.isArray(value)) {
    return value.map((item) => keysToCamel(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value as T;
  }

  return Object.entries(value).reduce<Record<string, unknown>>(
    (acc, [key, entry]) => {
      acc[toCamelKey(key)] = keysToCamel(entry);
      return acc;
    },
    {}
  ) as T;
};

export const keysToSnake = <T>(value: unknown): T => {
  if (Array.isArray(value)) {
    return value.map((item) => keysToSnake(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value as T;
  }

  return Object.entries(value).reduce<Record<string, unknown>>(
    (acc, [key, entry]) => {
      acc[toSnakeKey(key)] = keysToSnake(entry);
      return acc;
    },
    {}
  ) as T;
};

export const listKeysToCamel = <T>(items: unknown[]): T[] =>
  items.map((item) => keysToCamel<T>(item));

export const toSnake = (value: string): string => toSnakeKey(value);

/** Use for Supabase insert/update payloads built from camelCase objects. */
export const toSnakeRecord = (
  value: Record<string, unknown>
): Record<string, unknown> => keysToSnake<Record<string, unknown>>(value);
