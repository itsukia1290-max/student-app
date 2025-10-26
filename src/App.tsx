import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyPage from "./pages/MyPage";
import { supabase } from "./lib/supabase";
import { useState } from "react";

function Shell() {
  const { user } = useAuth();
  const [view, setView] = useState<"home"|"mypage">("home");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-3 border-b bg-white">
        <nav className="flex gap-2">
          <button className={`px-3 py-1 rounded ${view==='home'?'bg-black text-white':'border'}`}
                  onClick={()=>setView("home")}>Home</button>
          <button className={`px-3 py-1 rounded ${view==='mypage'?'bg-black text-white':'border'}`}
                  onClick={()=>setView("mypage")}>MyPage</button>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button className="px-3 py-1 rounded border"
                  onClick={()=>supabase.auth.signOut()}>
            ログアウト
          </button>
        </div>
      </header>

      {view === "home" ? (
        <main className="grid place-items-center p-8">
          <div className="p-8 rounded-2xl shadow bg-white">
            <h1 className="text-2xl font-bold text-green-600">ログイン済み ✅</h1>
            <p className="mt-2 text-gray-600">ここから機能を拡張していきます。</p>
          </div>
        </main>
      ) : (
        <MyPage />
      )}
    </div>
  );
}

function AuthGate() {
  const { session } = useAuth();
  const [mode, setMode] = useState<"login"|"signup">("login");
  if (!session) {
    return mode === "login"
      ? <Login onSignup={()=>setMode("signup")} />
      : <Signup onBack={()=>setMode("login")} />;
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
