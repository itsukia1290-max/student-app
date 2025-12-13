// src/App.tsx
/*
 * Responsibility: アプリケーションのルート。認証ゲート、グローバルなタブ/ナビゲーションを提供。
 * - Auth 関連の表示切替（ログイン/サインアップ/承認待ち）
 * - Shell コンポーネントが主要なページ（Home / MyPage / Chat / DM / Students）を切替
 * Note: スマホでは下部固定ナビ（Bottom Tab Bar）を表示（横幅いっぱい / safe-area / 選択中ライン / 未読バッジ）
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
import Home from "./pages/Home";
import { supabase } from "./lib/supabase";
import { useMyApproval } from "./hooks/useMyApproval";
import { useIsStaff } from "./hooks/useIsStaff";

export type View = "home" | "mypage" | "chat" | "dm" | "students";

type TabDef = { key: View; label: string; icon: string };

function Shell() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();
  const [view, setView] = useState<View>("home");

  // ✅ 未読バッジ（とりあえず0。後で Chat/DM から上げられる）
  const [unreadChat] = useState(0);
  const [unreadDm] = useState(0);

  const baseTabs: TabDef[] = [
    { key: "home", label: "Home", icon: "🏠" },
    { key: "mypage", label: "My", icon: "👤" },
    { key: "chat", label: "Group", icon: "💬" },
    { key: "dm", label: "DM", icon: "📩" },
  ];

  const tabs: TabDef[] = isStaff
    ? [...baseTabs, { key: "students", label: "Students", icon: "👨‍🏫" }]
    : baseTabs;

  // 生徒なのに何かの拍子で view==="students" になっていた場合のガード
  const effectiveView: View = !isStaff && view === "students" ? "home" : view;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー（スマホでも最低限：ログアウト） */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">塾管理</span>
              <span className="text-xs text-gray-500 hidden sm:inline">
                {user?.email}
              </span>
            </div>
            <button
              className="px-3 py-1 rounded border"
              onClick={() => supabase.auth.signOut()}
            >
              ログアウト
            </button>
          </div>

          {/* PC用ナビ（スマホは下部帯に移す） */}
          <nav
            className="hidden md:flex gap-2 pb-3"
            role="navigation"
            aria-label="Main"
          >
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
      </header>

      {/* コンテンツ：下部固定ナビの分だけ余白（pb-28くらい） */}
      <div className="max-w-5xl mx-auto px-4 py-4 pb-28">
        {effectiveView === "home" && <Home />}
        {effectiveView === "mypage" && <MyPage />}

        {/* 🔽 ここは後で未読数を上げたくなったら props を渡す形に変更してOK */}
        {effectiveView === "chat" && <Chat />}
        {effectiveView === "dm" && <DM />}

        {effectiveView === "students" && isStaff && <Students />}
      </div>

      {/* ✅ スマホ用：下部固定ナビ（全部盛り） */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50
                   pb-[env(safe-area-inset-bottom)]"
        role="navigation"
        aria-label="Bottom tabs"
      >
        {/* 上にうっすら影（帯っぽさUP） */}
        <div className="shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {/* タブの並び（横幅いっぱい） */}
          <div className={`grid ${isStaff ? "grid-cols-5" : "grid-cols-4"}`}>
            {tabs.map((t) => {
              const active = effectiveView === t.key;

              // 未読バッジ対象（chat/dm）
              const badge =
                t.key === "chat"
                  ? unreadChat
                  : t.key === "dm"
                  ? unreadDm
                  : 0;

              return (
                <button
                  key={t.key}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setView(t.key)}
                  className={`relative flex flex-col items-center justify-center
                              py-3 select-none
                              ${active ? "text-black font-semibold" : "text-gray-500"}`}
                >
                  {/* ✅ 選択中ライン（上側に細い線） */}
                  <span
                    className={`absolute top-0 left-3 right-3 h-[2px] rounded-full
                                ${active ? "bg-black" : "bg-transparent"}`}
                  />

                  {/* アイコン + バッジ */}
                  <span className="relative text-lg leading-none">
                    {t.icon}
                    {badge > 0 && (
                      <span
                        className="absolute -top-2 -right-3 min-w-[18px] h-[18px]
                                   px-1 rounded-full bg-red-600 text-white
                                   text-[10px] flex items-center justify-center"
                        aria-label="未読"
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </span>

                  {/* ラベル */}
                  <span className="text-[10px] mt-1">{t.label}</span>
                </button>
              );
            })}
          </div>
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
