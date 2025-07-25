'use client';

import { useState, useCallback } from 'react';
import type { NextAction, NextActionType } from '../types/call-outcome.types';

export function useNextActions() {
  const [actions, setActions] = useState<NextAction[]>([]);
  const [completedActions, setCompletedActions] = useState<number[]>([]);

  const addAction = useCallback((action: NextAction) => {
    setActions(prev => [...prev, action]);
  }, []);

  const removeAction = useCallback((index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const completeAction = useCallback((index: number) => {
    setCompletedActions(prev => [...prev, index]);
  }, []);

  const uncompleteAction = useCallback((index: number) => {
    setCompletedActions(prev => prev.filter(i => i !== index));
  }, []);

  const clearActions = useCallback(() => {
    setActions([]);
    setCompletedActions([]);
  }, []);

  const getPendingActions = useCallback(() => {
    return actions.filter((_, index) => !completedActions.includes(index));
  }, [actions, completedActions]);

  const getCompletedActions = useCallback(() => {
    return actions.filter((_, index) => completedActions.includes(index));
  }, [actions, completedActions]);

  const isActionCompleted = useCallback((index: number) => {
    return completedActions.includes(index);
  }, [completedActions]);

  return {
    actions,
    addAction,
    removeAction,
    completeAction,
    uncompleteAction,
    clearActions,
    getPendingActions,
    getCompletedActions,
    isActionCompleted,
    completedCount: completedActions.length,
    totalCount: actions.length
  };
} 