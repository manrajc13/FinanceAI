"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Currency } from "@/lib/format";
import type { ProfileName } from "@/lib/labels";

export type RangeKey = "1Y" | "3Y" | "5Y";
export type Freq = "M" | "Q";

export type Settings = {
  currency: Currency;
  amount: string; // decimal string, never a float
  profile: ProfileName;
  range: RangeKey;
  freq: Freq;
  hideDust: boolean;
  useLlm: boolean;
  showBenchmark: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  currency: "INR",
  amount: "1000000.00",
  profile: "medium",
  range: "5Y",
  freq: "Q",
  hideDust: false,
  useLlm: false,
  showBenchmark: true,
};

type SettingsStore = Settings & {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
};

// Storage can throw (private mode, blocked site data); settings then live in memory only.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "financeai-settings",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (state): Settings => ({
        currency: state.currency, amount: state.amount, profile: state.profile, range: state.range,
        freq: state.freq, hideDust: state.hideDust, useLlm: state.useLlm, showBenchmark: state.showBenchmark,
      }),
    },
  ),
);

/** Rehydrate once on the client; render skeletons until it returns true to avoid hydration mismatch. */
export function useSettingsHydrated(): boolean {
  useEffect(() => {
    if (!useSettings.persist.hasHydrated()) void useSettings.persist.rehydrate();
  }, []);
  return useSyncExternalStore(
    (onChange) => useSettings.persist.onFinishHydration(onChange),
    () => useSettings.persist.hasHydrated(),
    () => false,
  );
}
