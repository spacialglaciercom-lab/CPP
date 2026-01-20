/**
 * Turn Penalties Context
 * Manages configurable penalties for different turn types
 * Used by the routing algorithm to customize route behavior
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface TurnPenalties {
  straight: number;      // 0-100, default 0
  rightTurn: number;     // 0-200, default 10
  leftTurn: number;      // 0-500, default 50
  uTurn: number;         // 0-1000, default 500
}

export const DEFAULT_PENALTIES: TurnPenalties = {
  straight: 0,
  rightTurn: 10,
  leftTurn: 50,
  uTurn: 500,
};

interface TurnPenaltiesContextType {
  penalties: TurnPenalties;
  setPenalties: (penalties: TurnPenalties) => void;
  resetToDefaults: () => void;
  updatePenalty: (key: keyof TurnPenalties, value: number) => void;
}

const TurnPenaltiesContext = createContext<TurnPenaltiesContextType | undefined>(undefined);

export function TurnPenaltiesProvider({ children }: { children: ReactNode }) {
  const [penalties, setPenalties] = useState<TurnPenalties>(DEFAULT_PENALTIES);

  const resetToDefaults = () => {
    setPenalties(DEFAULT_PENALTIES);
  };

  const updatePenalty = (key: keyof TurnPenalties, value: number) => {
    setPenalties(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <TurnPenaltiesContext.Provider value={{ penalties, setPenalties, resetToDefaults, updatePenalty }}>
      {children}
    </TurnPenaltiesContext.Provider>
  );
}

export function useTurnPenalties() {
  const context = useContext(TurnPenaltiesContext);
  if (!context) {
    throw new Error('useTurnPenalties must be used within TurnPenaltiesProvider');
  }
  return context;
}
