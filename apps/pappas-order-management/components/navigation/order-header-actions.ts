import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { create } from 'zustand';

export type OrderHeaderActions = {
  onRefresh: () => void;
  refreshing?: boolean;
  onToggleFilters?: () => void;
  filtersExpanded?: boolean;
  activeFilterCount?: number;
};
type HeaderRegistration = { path: string; owner: symbol; actions: OrderHeaderActions };
export const useOrderHeaderActionsStore = create<{ registration: HeaderRegistration | null }>(() => ({ registration: null }));

/** Screen state stays in its mounted tab; only the focused screen owns toolbar actions. */
export function useOrderHeaderActions(actions: OrderHeaderActions) {
  const path = usePathname();
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    const owner = Symbol('order-header');
    useOrderHeaderActionsStore.setState({ registration: { path, owner, actions } });
    return () => {
      if (useOrderHeaderActionsStore.getState().registration?.owner === owner) {
        useOrderHeaderActionsStore.setState({ registration: null });
      }
    };
  }, [path, focused, actions.onRefresh, actions.refreshing, actions.onToggleFilters, actions.filtersExpanded, actions.activeFilterCount]);
}
