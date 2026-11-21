import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "./supabase";

// React Native does not automatically pause/resume token refresh on backgrounding.
export function registerAuthLifecycle(): () => void {
  function handleState(state: AppStateStatus) {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  }
  handleState(AppState.currentState);
  const listener = AppState.addEventListener("change", handleState);
  return () => {
    listener.remove();
    supabase.auth.stopAutoRefresh();
  };
}
