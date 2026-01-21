// src/hooks/useNav.ts
import { createContext, useContext } from "react";

export type View = "home" | "mypage" | "chat" | "dm" | "students" | "schoolCalendar";
export type MyPageTab = "profile" | "goals" | "grades" | "records";
export type GoalPeriod = "week" | "month";

export type NavApi = {
  setView: (v: View) => void;

  openMyGoals: (period: GoalPeriod) => void;
  openMyRecords: () => void; // ★追加

  myPageInitialTab: MyPageTab;
  myPageInitialGoalPeriod: GoalPeriod;
};

export const NavContext = createContext<NavApi | null>(null);

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
