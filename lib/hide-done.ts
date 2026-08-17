"use client";
import { useCallback, useSyncExternalStore } from "react";

const KEY = "sweepy-hide-done";
const EVENT = "sweepy-hide-done";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(EVENT, onStoreChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(KEY) === "1";
}

export function useHideDone() {
  const hideDone = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const setHideDone = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(getSnapshot()) : next;
    window.localStorage.setItem(KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [hideDone, setHideDone] as const;
}
