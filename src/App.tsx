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
import ResetPassword from "./pages/ResetPassword";
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
  const { status, refetch } = useMyApproval();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const resubmit = async () => {
    if (!uid) return;
    try {
      // 承認リクエストを再申請
      const { ensureApprovalRequest } = await import("./lib/approval");
      await ensureApprovalRequest(uid);

      // status を active に戻す (再承認待ち)
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", uid);

      if (error) throw error;
      refetch();
      alert("再申請しました。承認をお待ちください。");
    } catch (e) {
      console.error(e);
      alert("再申請に失敗しました。");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ backgroundColor: "#f8fafc" }}>
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-xl text-center"
        style={{ backgroundColor: "#ffffff" }}
      >
        {status === "withdrawn" && (
          <>
            <h1 className="text-xl font-bold mb-4" style={{ color: "#dc2626" }}>
              アカウント停止
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
              このアカウントは利用停止されています。詳細はお問い合わせください。
            </p>
          </>
        )}

        {status === "suspended" && (
          <>
            <h1 className="text-xl font-bold mb-4" style={{ color: "#ea580c" }}>
              承認が却下されました
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
              再度申請することができます。
            </p>
            <button
              onClick={resubmit}
              className="w-full py-3 rounded-lg font-medium mb-4"
              style={{ backgroundColor: "#3b82f6", color: "#ffffff" }}
            >
              再申請する
            </button>
          </>
        )}

        {status !== "withdrawn" && status !== "suspended" && (
          <>
            <h1 className="text-xl font-bold mb-4" style={{ color: "#3b82f6" }}>
              承認待ち
            </h1>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
              管理者の承認をお待ちください。
            </p>
          </>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full py-3 rounded-lg font-medium border"
          style={{ borderColor: "#d1d5db", color: "#374151" }}
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}

function AuthGate() {
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { approved, status, loading } = useMyApproval();

  if (window.location.pathname === "/reset-password") {
    return <ResetPassword />;
  }

  if (!session) {
    return mode === "login" ? (
      <Login onSignup={() => setMode("signup")} />
    ) : (
      <Signup onBack={() => setMode("login")} />
    );
  }

  if (loading) return <div className="text-center">確認中...</div>;

  // withdrawn または suspended は PendingApproval で専用案内
  if (status === "withdrawn" || status === "suspended") {
    return <PendingApproval />;
  }

  // active だが is_approved=false なら承認待ち
  if (approved === false) return <PendingApproval />;

  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
