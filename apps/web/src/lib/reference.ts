"use client";

import { useRef, useState, useSyncExternalStore } from "react";

export function useReferenceId(): [string, (value: string) => void] {
  const stored = useRef<string | null>(null);
  const generated = useSyncExternalStore(
    () => () => {},
    () => {
      stored.current ??= crypto.randomUUID();
      return stored.current;
    },
    () => "",
  );
  const [override, setOverride] = useState<string | null>(null);
  return [override ?? generated, setOverride];
}
