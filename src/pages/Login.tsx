import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return "不明なエラー"; }
}

// 承認待ちフラグのキー
const PENDING_KEY = "approval_pending_msg";

export default function Login({ onSignup }: { onSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ★ 再描画時に localStorage の承認待ちフラグを拾って表示
  useEffect(() => {
    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) {
      setMsg(pending);
      // 必要なら次回まで残す: 消したい場合は下行のコメントを外す
      // localStorage.removeItem(PENDING_KEY);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg("ログイン失敗: " + error.message);
      setLoading(false);
      return;
    }

    try {
      const uid = data.user?.id;
      if (!uid) throw new Error("ユーザーIDが取得できませんでした。");

      // プロフィール参照
      const { data: pr, error: pe } = await supabase
        .from("profiles")
        .select("is_approved, status, role")
        .eq("id", uid)
        .maybeSingle();
      if (pe) throw pe;

      // admin/teacher は常時許可
      if (pr?.role === "admin" || pr?.role === "teacher") {
        setMsg("ログインしました。");
        setLoading(false);
        return;
      }

      // 利用可否
      const ok = !!pr?.is_approved && pr?.status === "active";
      if (ok) {
        setMsg("ログインしました。");
        setLoading(false);
        return;
      }

      // ★ 未承認/停止中 → 承認リクエストを upsert
      const { error: arErr } = await supabase
        .from("approval_requests")
        .insert({ user_id: uid });
      if (arErr && !/duplicate key|already exists/i.test(arErr.message)) {
        console.warn("approval_requests insert:", arErr.message);
      }

      // ★ 承認待ちメッセージを localStorage に保存してから signOut
      const pendingMsg = "承認待ちです。先生の許可後にもう一度ログインしてください。";
      localStorage.setItem(PENDING_KEY, pendingMsg);

      await supabase.auth.signOut();

      // signOut 後も Login に戻るが、useEffect が localStorage から表示を復元
      setMsg(pendingMsg);
    } catch (err: unknown) {
      setMsg("確認中にエラー: " + getErrorMessage(err));
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <form onSubmit={onSubmit} className="bg-white shadow p-6 rounded-2xl w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4">ログイン</h1>

        {msg && (
          <div className="mb-3 text-sm rounded border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2">
            {msg}
          </div>
        )}

        <label className="block mb-3">
          <span className="text-sm">Email</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm">Password</span>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button disabled={loading} className="w-full py-2 rounded bg-black text-white disabled:opacity-50">
          {loading ? "ログイン中..." : "ログイン"}
        </button>

        <button type="button" onClick={onSignup} className="mt-4 w-full py-2 rounded border">
          新規登録へ →
        </button>

        {/* 「承認待ち」通知を明示的に消したい場合のボタン（任意） */}
        {/* <button type="button" onClick={() => { localStorage.removeItem(PENDING_KEY); setMsg(null); }} className="mt-2 text-xs text-gray-500 underline">通知を消す</button> */}
      </form>
    </div>
  );
}
