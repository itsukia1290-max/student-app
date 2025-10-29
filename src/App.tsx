import { useState } from "react";
import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyPage from "./pages/MyPage";
import Chat from "./pages/Chat";
import Students from "./pages/Students";
import { supabase } from "./lib/supabase";
import { useMyApproval } from "./hooks/useMyApproval";

type View = "home" | "mypage" | "chat" | "students";

function Shell() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("home");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between p-3 border-b bg-white">
        <nav className="flex gap-2">
          {(["home", "mypage", "chat", "students"] as const).map((v) => (
            <button
              key={v}
              className={`px-3 py-1 rounded ${view === v ? "bg-black text-white" : "border"}`}
              onClick={() => setView(v)}
            >
              {v === "home" ? "Home" : v === "mypage" ? "MyPage" : v === "chat" ? "Chat" : "Students"}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button className="px-3 py-1 rounded border" onClick={() => supabase.auth.signOut()}>
            ログアウト
          </button>
        </div>
      </header>

      {view === "home" && (
        <main className="grid place-items-center p-8">
          <div className="p-8 rounded-2xl shadow bg-white">
            <h1 className="text-2xl font-bold text-green-600">ログイン済み ✅</h1>
            <p className="mt-2 text-gray-600">Chat タブからメッセージを試せます。</p>
          </div>
        </main>
      )}
      {view === "mypage" && <MyPage />}
      {view === "chat" && <Chat />}
      {view === "students" && <Students />}
    </div>
  );
}

function PendingApproval() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <div className="bg-white shadow p-6 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">承認待ちです</h1>
        <p className="text-gray-600">教師による承認後にご利用いただけます。</p>
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

  // 未ログイン
  if (!session) {
    return mode === "login" ? (
      <Login onSignup={() => setMode("signup")} />
    ) : (
      <Signup onBack={() => setMode("login")} />
    );
  }

  // セッションはあるが承認状態を取得中 → 何も見せない（チラ見え防止）
  if (approved === null) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-gray-500">確認中...</div>
      </div>
    );
  }

  // 承認されていない → ペンディング画面（Shellは出さない）
  if (approved === false) {
    return <PendingApproval />;
  }

  // 承認済み
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
