const cache = new Map<string, string>();
const order: string[] = [];

export function frameCacheGet(key: string): string | undefined {
  return cache.get(key);
}

export function frameCacheSet(key: string, url: string, max: number): void {
  if (cache.has(key)) {
    const i = order.indexOf(key);
    if (i >= 0) order.splice(i, 1);
  }
  cache.set(key, url);
  order.push(key);
  while (order.length > max) {
    const old = order.shift();
    if (old) cache.delete(old);
  }
}

export function frameCacheClear(): void {
  cache.clear();
  order.length = 0;
}
