// src/App.tsx
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

type View = "home" | "mypage" | "chat" | "dm" | "students";

function Shell() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("home");

  const tabs: { key: View; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "mypage", label: "MyPage" },
    { key: "chat", label: "Group" },    // ← 表示名を Group に変更
    { key: "dm", label: "DM" },
    { key: "students", label: "Students" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between p-3 border-b bg-white">
        <nav className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`px-3 py-1 rounded ${view === t.key ? "bg-black text-white" : "border"}`}
              onClick={() => setView(t.key)}
            >
              {t.label}
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
            <p className="mt-2 text-gray-600">Group または DM からメッセージを試せます。</p>
          </div>
        </main>
      )}
      {view === "mypage" && <MyPage />}
      {view === "chat" && <Chat />}   {/* ルーティングは従来どおり */}
      {view === "dm" && <DM />}
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
