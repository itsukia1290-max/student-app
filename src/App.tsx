import { useState } from "react";
import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyPage from "./pages/MyPage";
import Chat from "./pages/Chat";
import Students from "./pages/Students";
import { supabase } from "./lib/supabase";

type View = "home" | "mypage" | "chat" | "students";

function Shell() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("home");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="flex items-center justify-between p-3 border-b bg-white">
        <nav className="flex gap-2">
          {(["home", "mypage", "chat", "students"] as const).map((v) => (
            <button
              key={v}
              className={`px-3 py-1 rounded ${
                view === v ? "bg-black text-white" : "border"
              }`}
              onClick={() => setView(v)}
            >
              {v === "home"
                ? "Home"
                : v === "mypage"
                ? "MyPage"
                : v === "chat"
                ? "Chat"
                : "Students"}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button
            className="px-3 py-1 rounded border"
            onClick={() => supabase.auth.signOut()}
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* メイン画面 */}
      {view === "home" && (
        <main className="grid place-items-center p-8">
          <div className="p-8 rounded-2xl shadow bg-white">
            <h1 className="text-2xl font-bold text-green-600">ログイン済み ✅</h1>
            <p className="mt-2 text-gray-600">
              Chat タブからメッセージを試せます。
            </p>
          </div>
        </main>
      )}
      {view === "mypage" && <MyPage />}
      {view === "chat" && <Chat />}
      {view === "students" && <Students />}
    </div>
  );
}

function AuthGate() {
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (!session) {
    return mode === "login" ? (
      <Login onSignup={() => setMode("signup")} />
    ) : (
      <Signup onBack={() => setMode("login")} />
    );
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
