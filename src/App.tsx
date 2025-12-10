/*
 * src/App.tsx
 * Responsibility: アプリケーションのルート。認証ゲート、グローバルなタブ/ナビゲーションを提供。
 * - Auth 関連の表示切替（ログイン/サインアップ/承認待ち）
 * - Shell コンポーネントが主要なページ（MyPage/Chat/DM/Students）を切替
 * Note: レイアウトやヘッダーはレスポンシブ化済み。ナビのARIA属性が付与されています。
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

  // タブ一覧：生徒には Students を見せない
  const tabs: { key: View; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "mypage", label: "MyPage" },
    { key: "chat", label: "Group" },
    { key: "dm", label: "DM" },
  ];

  if (isStaff) {
    tabs.push({ key: "students", label: "Students" });
  }

  // 生徒なのに何かの拍子で view==="students" になっていた場合のガード
  const effectiveView: View =
    !isStaff && view === "students" ? "home" : view;

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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  {mobileMenuOpen ? (
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path d="M3 5h14M3 10h14M3 15h14" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>

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
              <button
                className="px-3 py-1 rounded border"
                onClick={() => supabase.auth.signOut()}
              >
                ログアウト
              </button>
            </div>
          </div>
          {/* mobile nav */}
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
        {effectiveView === "home" && (
          <main className="grid place-items-center p-8">
            <div className="p-8 rounded-2xl shadow bg-white">
              <h1 className="text-2xl font-bold text-green-600">ログイン済み ✅</h1>
              <p className="mt-2 text-gray-600">Group または DM からメッセージを試せます。</p>
            </div>
          </main>
        )}

        {effectiveView === "mypage" && <MyPage />}
        {effectiveView === "chat" && <Chat />}
        {effectiveView === "dm" && <DM />}
        {effectiveView === "students" && isStaff && <Students />}
      </div>
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
  const { approved } = useMyApproval(); // 未ログインでも常に呼ぶ

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
