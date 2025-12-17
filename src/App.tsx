// src/App.tsx
import { useState } from "react";
import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyPage from "./pages/MyPage";
import Chat from "./pages/Chat";
import Students from "./pages/Students";
import SchoolCalendar from "./pages/SchoolCalendar";
import DM from "./pages/DM";
import { supabase } from "./lib/supabase";
import { useMyApproval } from "./hooks/useMyApproval";
import { useIsStaff } from "./hooks/useIsStaff";
import BottomNav from "./components/ui/BottomNav";
import Report from "./pages/Report";


type View = "home" | "mypage" | "chat" | "dm" | "students" | "schoolCalendar";

function Shell() {
  // We don't currently use `user` in Shell, but AuthGate reads session via useAuth.
  // Keep the import available for AuthGate, but don't destructure here to avoid unused variable errors.
  const { isStaff } = useIsStaff();
  const [view, setView] = useState<View>("home");

  const tabs: { key: View; label: string }[] = [
    { key: "home", label: "レポート" },
    { key: "chat", label: "グループ" },
    { key: "dm", label: "DM" },
    { key: "mypage", label: "マイページ" },
  ];

  if (isStaff)
    tabs.splice(3, 0, { key: "students", label: "生徒" }, { key: "schoolCalendar", label: "塾カレンダー" });

  const effectiveView: View =
    !isStaff && (view === "students" || view === "schoolCalendar") ? "home" : view;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* メイン */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {effectiveView === "home" && <Report />}

        {effectiveView === "mypage" && <MyPage />}
        {effectiveView === "chat" && <Chat />}
        {effectiveView === "dm" && <DM />}
        {effectiveView === "students" && isStaff && <Students />}
        {effectiveView === "schoolCalendar" && isStaff && <SchoolCalendar />}
      </main>

      {/* スマホ下部固定ナビ（ポータル経由で body に配置して VC の影響を受けないようにする） */}
      <BottomNav tabs={tabs} effectiveView={effectiveView} setView={setView} />
    </div>
  );
}

function PendingApproval() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="bg-white p-6 rounded-2xl shadow text-center">
        <h1 className="text-xl font-bold">承認待ち</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-4 border px-4 py-2 rounded"
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
