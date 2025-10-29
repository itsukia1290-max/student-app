import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Signup({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    // ▼ ここが追加：既登録(422)は「ログインしてください」と案内
    if (error) {
      // Supabase-js v2 は message に "User already registered" が入る
      if (error.message?.toLowerCase().includes("already")) {
        setMsg("このメールはすでに登録済みです。ログインして、教師の承認を待ってください。");
      } else {
        setMsg("登録失敗: " + error.message);
      }
      setLoading(false);
      return;
    }

    try {
      const session = data.session ?? (await supabase.auth.getSession()).data.session;

      if (session && name.trim()) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ name: name.trim() })
          .eq("id", session.user.id);
        if (upErr) throw upErr;
      }
      // 承認制なのでいったんサインアウト
      await supabase.auth.signOut();
      setMsg("登録完了。教師の承認後にログインできます（承認が必要です）。");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "不明なエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <form onSubmit={onSubmit} className="bg-white shadow p-6 rounded-2xl w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4">新規登録</h1>

        <label className="block mb-3">
          <span className="text-sm">氏名（任意）</span>
          <input className="mt-1 w-full border rounded px-3 py-2"
            value={name} onChange={(e)=>setName(e.target.value)} />
        </label>

        <label className="block mb-3">
          <span className="text-sm">Email</span>
          <input className="mt-1 w-full border rounded px-3 py-2" type="email"
            value={email} onChange={(e)=>setEmail(e.target.value)} required />
        </label>

        <label className="block mb-4">
          <span className="text-sm">Password</span>
          <input className="mt-1 w-full border rounded px-3 py-2" type="password"
            value={password} onChange={(e)=>setPassword(e.target.value)} required />
        </label>

        <button disabled={loading} className="w-full py-2 rounded bg-black text-white disabled:opacity-50">
          {loading ? "登録中..." : "登録"}
        </button>

        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}

        <button type="button" onClick={onBack} className="mt-4 w-full py-2 rounded border">
          ← ログインに戻る
        </button>
      </form>
    </div>
  );
}
