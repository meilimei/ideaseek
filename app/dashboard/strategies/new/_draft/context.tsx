'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { StrategyDraft } from './types';

type DraftContextValue = {
  draft: StrategyDraft;
  updateDraft: (patch: Partial<StrategyDraft>) => void;
  resetDraft: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);
const STORAGE_KEY = 'strategy_draft_v1';

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<StrategyDraft>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setDraft(parsed as StrategyDraft);
      }
    } catch {
      // Ignore malformed storage entries.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage write errors.
    }
  }, [draft]);

  const updateDraft = (patch: Partial<StrategyDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const resetDraft = () => {
    setDraft({});
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage removal errors.
    }
  };

  const value = useMemo(
    () => ({ draft, updateDraft, resetDraft }),
    [draft],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) {
    throw new Error('useDraft must be used within DraftProvider');
  }
  return ctx;
}
