// src/App.tsx
import { useMemo, useState } from "react";
import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyPage from "./pages/MyPage";
import Chat from "./pages/Chat";
import Students from "./pages/Students";
import SchoolCalendar from "./pages/SchoolCalendar";
import DM from "./pages/DM";
import GradeManagement from "./pages/GradeManagement";
import { supabase } from "./lib/supabase";
import { useMyApproval } from "./hooks/useMyApproval";
import { useIsStaff } from "./hooks/useIsStaff";
import BottomNav from "./components/ui/BottomNav";
import Report from "./pages/Report";

import { NavContext } from "./hooks/useNav";
import type { View, MyPageTab, GoalPeriod, NavApi } from "./hooks/useNav";

function NavProvider({ value, children }: { value: NavApi; children: React.ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

function Shell() {
  const { isStaff } = useIsStaff();
  const [view, setView] = useState<View>("home");

  // MyPage 初期表示制御（Report → MyPage へ飛ばす用）
  const [myPageInitialTab, setMyPageInitialTab] = useState<MyPageTab>("profile");
  const [myPageInitialGoalPeriod, setMyPageInitialGoalPeriod] = useState<GoalPeriod>("week");

  const openMyGoals = (period: GoalPeriod) => {
    setMyPageInitialTab("goals");
    setMyPageInitialGoalPeriod(period);
    setView("mypage");
  };

  const openMyRecords = () => {
    setMyPageInitialTab("records");
    setView("mypage");
  };

  const tabs = useMemo((): { key: View; label: string }[] => {
    const studentTabs: { key: View; label: string }[] = [
      { key: "home", label: "レポート" },
      { key: "chat", label: "グループ" },
      { key: "dm", label: "DM" },
      { key: "mypage", label: "マイページ" },
    ];

    if (!isStaff) return studentTabs;

    return [
      { key: "home", label: "生徒" },
      { key: "gradeManagement", label: "成績編集" },
      { key: "chat", label: "グループ" },
      { key: "dm", label: "DM" },
      { key: "schoolCalendar", label: "塾カレンダー" },
      { key: "mypage", label: "マイページ" },
    ];
  }, [isStaff]);

  const effectiveView: View = !isStaff && (view === "schoolCalendar" || view === "gradeManagement") ? "home" : view;

  return (
    <NavProvider
      value={{
        setView,
        openMyGoals,
        openMyRecords, // ★追加
        myPageInitialTab,
        myPageInitialGoalPeriod,
      }}
    >
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-5xl mx-auto px-4 py-6">
          {effectiveView === "home" && (isStaff ? <Students /> : <Report />)}
          {effectiveView === "gradeManagement" && isStaff && <GradeManagement />}
          {effectiveView === "mypage" && (
            <MyPage initialTab={myPageInitialTab} initialGoalPeriod={myPageInitialGoalPeriod} />
          )}
          {effectiveView === "chat" && <Chat />}
          {effectiveView === "dm" && <DM />}
          {effectiveView === "schoolCalendar" && isStaff && <SchoolCalendar />}
        </main>

        <BottomNav tabs={tabs} effectiveView={effectiveView} setView={setView} />
      </div>
    </NavProvider>
  );
}

function PendingApproval() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="bg-white p-6 rounded-2xl shadow text-center">
        <h1 className="text-xl font-bold">承認待ち</h1>
        <button onClick={() => supabase.auth.signOut()} className="mt-4 border px-4 py-2 rounded">
          ログアウト
        </button>
      </div>
    </div>
  );
}

function AuthGate() {
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { approved } = useMyApproval();

  if (!session) {
    return mode === "login" ? (
      <Login onSignup={() => setMode("signup")} />
    ) : (
      <Signup onBack={() => setMode("login")} />
    );
  }

  if (approved === false) return <PendingApproval />;
  if (approved === null) return <div className="text-center">確認中...</div>;

  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
