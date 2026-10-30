import { useEffect, useState } from 'react';

/**
 * Current time, available only after hydration. Rendering relative times
 * ("hace 5 min") from Date.now() on both server and client would produce
 * different HTML and break hydration.
 */
export function useNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
