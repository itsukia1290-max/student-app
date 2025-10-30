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

      const { data: profile, error: pe } = await supabase
        .from("profiles")
        .select("id, is_approved, name, role, phone")
        .eq("id", uid)
        .maybeSingle();
      if (pe) throw pe;

      // admin は常時許可
      if (profile?.role === "admin") {
        setMsg(`管理者としてログインしました。ようこそ、${profile.name ?? "Admin"} さん。`);
        return;
      }

      // 未承認 → 承認リクエストを（未解決が無いときだけ）作成
      if (!profile || profile.is_approved !== true) {
        // 既に未解決リクエストがあるか軽く確認
        const { data: existing } = await supabase
          .from("approval_requests")
          .select("id")
          .eq("user_id", uid)
          .is("resolved_at", null)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("approval_requests").insert({
            user_id: uid,
            email,
            name: profile?.name ?? null,
            phone: profile?.phone ?? null,
          });
        }

        setMsg("承認待ちです。教師による承認後にログインできます。");
        // ここでは signOut しない（App 側の承認ゲートが Pending を出し続けます）
        return;
      }

      // 承認済み
      setMsg(`ようこそ、${profile.name ?? "ユーザー"} さん。`);
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

        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}

        <button type="button" onClick={onSignup} className="mt-4 w-full py-2 rounded border">
          新規登録へ →
        </button>
      </form>
    </div>
  );
}
