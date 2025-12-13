/*
 * src/App.tsx
 * Responsibility: アプリケーションのルート。認証ゲート、グローバルなナビゲーションを提供。
 * - スマホ：下部固定ナビ（文字のみ / 常時表示）
 * - PC：従来のヘッダーナビ
 */
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

type View = "home" | "mypage" | "chat" | "dm" | "students";

function Shell() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();
  const [view, setView] = useState<View>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: { key: View; label: string }[] = [
    { key: "home", label: "ホーム" },
    { key: "mypage", label: "マイページ" },
    { key: "chat", label: "グループ" },
    { key: "dm", label: "DM" },
  ];

  if (isStaff) {
    tabs.push({ key: "students", label: "生徒一覧" });
  }

  const effectiveView: View =
    !isStaff && view === "students" ? "home" : view;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* ===== Header ===== */}
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

              <nav className="hidden md:flex gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    aria-current={effectiveView === t.key ? "page" : undefined}
                    className={`px-3 py-1 rounded ${
                      effectiveView === t.key
                        ? "bg-black text-white"
                        : "border"
                    }`}
                    onClick={() => setView(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:inline">
                {user?.email}
              </span>
              <button
                className="px-3 py-1 rounded border"
                onClick={() => supabase.auth.signOut()}
              >
                ログアウト
              </button>
            </div>
          </div>

          {/* モバイル用 上部メニュー */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-3">
              <div className="flex flex-col gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    className={`text-left px-3 py-2 rounded ${
                      effectiveView === t.key
                        ? "bg-black text-white"
                        : "border"
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

      {/* ===== Main ===== */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {effectiveView === "home" && <div className="space-y-6">{/* Home は別で作成 */}</div>}
        {effectiveView === "mypage" && <MyPage />}
        {effectiveView === "chat" && <Chat />}
        {effectiveView === "dm" && <DM />}
        {effectiveView === "students" && isStaff && <Students />}
      </main>

      {/* ===== スマホ用 下部固定ナビ（文字のみ / 横幅100%） ===== */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50
                   pb-[env(safe-area-inset-bottom)]"
        role="navigation"
        aria-label="Bottom Navigation"
      >
        <div
          className={`grid ${
            isStaff ? "grid-cols-5" : "grid-cols-4"
          } text-xs text-center`}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              aria-current={effectiveView === t.key ? "page" : undefined}
              onClick={() => setView(t.key)}
              className={`py-3 ${
                effectiveView === t.key
                  ? "text-black font-semibold border-t-2 border-black"
                  : "text-gray-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function PendingApproval() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <div className="bg-white shadow p-6 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">承認待ちです</h1>
        <p className="text-gray-600">
          教師による承認後にご利用いただけます。
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-4 px-4 py-2 border rounded"
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

  if (approved === null) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-gray-500">確認中...</div>
      </div>
    );
  }

  if (approved === false) {
    return <PendingApproval />;
  }

  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
