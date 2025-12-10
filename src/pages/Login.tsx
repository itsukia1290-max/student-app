/*
 * src/pages/Login.tsx
 * Responsibility: ログイン画面
 * - Supabase によるメール/パスワードでの認証処理
 * - 承認フローのトリガー（承認待ちユーザーの登録）
 */

import { useState } from "react";
import { supabase } from "../lib/supabase";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return "不明なエラー"; }
}

export default function Login({ onSignup }: { onSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensureApprovalRequest(uid: string) {
  const { data: existing } = await supabase
    .from("approval_requests")
    .select("id")
    .eq("user_id", uid)
    .is("resolved_at", null)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { error: insErr } = await supabase
    .from("approval_requests")
    .insert({ user_id: uid });

  // ← 409(重複)は既存未解決があるだけなので無視
  if (insErr && !/409|duplicate key|already exists/i.test(insErr.message)) {
    console.warn("approval_requests insert:", insErr.message);
  }
}

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

      // 1) profiles で role / 承認状態を確認（admin/teacher はバイパス）
      const { data: profile, error: pe } = await supabase
        .from("profiles")
        .select("id, is_approved, name, role, status")
        .eq("id", uid)
        .maybeSingle();
      if (pe) throw pe;

      if (profile?.role === "admin" || profile?.role === "teacher") {
        setMsg("ログインしました。（管理者/教師）");
        setLoading(false);
        return;
      }

      // 2) 一般ユーザーの承認チェック
      const approved = !!profile?.is_approved && (profile?.status ?? "active") === "active";
      if (!approved) {
        await ensureApprovalRequest(uid);
        setMsg("承認待ちです。教師による承認後にもう一度ログインしてください。");
        setLoading(false);
        return;
      }

      // 3) 承認済みユーザー
      setMsg(`ようこそ、${profile?.name ?? "ユーザー"} さん。`);
    } catch (err: unknown) {
      setMsg("確認中にエラー: " + getErrorMessage(err));
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
      </form>
    </div>
  );
}
