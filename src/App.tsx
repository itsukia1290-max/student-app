import { useState } from "react";
import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyPage from "./pages/MyPage";
import Chat from "./pages/Chat";
import Students from "./pages/Students";
import DM from "./pages/DM";
import { supabase } from "./lib/supabase";
import { useMyApproval } from "./hooks/useMyApproval";
import { useIsStaff } from "./hooks/useIsStaff";
import BottomNav from "./components/ui/BottomNav";
import SchoolCalendarPage from "./pages/SchoolCalendar"; // ← 先生用塾カレンダーページがある想定

type View = "home" | "mypage" | "chat" | "dm" | "students" | "schoolCalendar";

function Shell() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();
  const [view, setView] = useState<View>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ✅ 生徒は必ず4つ
  const studentTabs: { key: View; label: string }[] = [
    { key: "home", label: "レポート" },
    { key: "chat", label: "グループ" },
    { key: "dm", label: "DM" },
    { key: "mypage", label: "マイページ" },
  ];

  // ✅ 先生/管理者は増える
  const staffTabs: { key: View; label: string }[] = [
    { key: "home", label: "レポート" },
    { key: "chat", label: "グループ" },
    { key: "dm", label: "DM" },
    { key: "students", label: "生徒" },
    { key: "schoolCalendar", label: "塾カレン" },
    { key: "mypage", label: "マイページ" },
  ];

  const tabs = isStaff ? staffTabs : studentTabs;

  // 生徒が students/schoolCalendar に入れないガード
  const effectiveView: View =
    !isStaff && (view === "students" || view === "schoolCalendar") ? "home" : view;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden px-2 py-1 border rounded"
                aria-label="メニュー"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((s) => !s)}
              >
                ☰
              </button>

              {/* PC用タブ */}
              <nav className="hidden md:flex gap-2" role="navigation" aria-label="Main">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    aria-current={effectiveView === t.key ? "page" : undefined}
                    className={`px-3 py-1 rounded ${
                      effectiveView === t.key ? "bg-black text-white" : "border"
                    }`}
                    onClick={() => setView(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:inline">{user?.email}</span>
              <button className="px-3 py-1 rounded border" onClick={() => supabase.auth.signOut()}>
                ログアウト
              </button>
            </div>
          </div>

          {/* mobile drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-3">
              <div className="flex flex-col gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    aria-current={effectiveView === t.key ? "page" : undefined}
                    className={`text-left px-3 py-2 rounded ${
                      effectiveView === t.key ? "bg-black text-white" : "border"
                    }`}
                    onClick={() => {
                      setView(t.key);
                      setMobileMenuOpen(false);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {effectiveView === "home" && <div>{/* レポートページ本体 */}</div>}
        {effectiveView === "mypage" && <MyPage />}
        {effectiveView === "chat" && <Chat />}
        {effectiveView === "dm" && <DM />}
        {effectiveView === "students" && isStaff && <Students />}
        {effectiveView === "schoolCalendar" && isStaff && <SchoolCalendarPage />}
      </div>

      {/* ✅ スマホ下部固定ナビ */}
      <BottomNav tabs={tabs} effectiveView={effectiveView} setView={setView} />
    </div>
  );
}

function PendingApproval() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <div className="bg-white shadow p-6 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">承認待ちです</h1>
        <p className="text-gray-600">教師による承認後にご利用いただけます。</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-4 px-4 py-2 border rounded">
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
    return mode === "login" ? <Login onSignup={() => setMode("signup")} /> : <Signup onBack={() => setMode("login")} />;
  }

  if (approved === null) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-gray-500">確認中...</div>
      </div>
    );
  }

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
