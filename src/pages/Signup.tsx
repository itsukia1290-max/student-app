/*
 * src/pages/Signup.tsx
 */

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

    if (error) {
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
      const uid = session?.user?.id;

      if (!uid) throw new Error("ユーザーIDが取得できませんでした（session null）");

      // 1) profiles の氏名更新（任意）
      if (name.trim()) {
        const { error: upErr } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", uid);
        if (upErr) throw upErr;
      }

      // 2) ★ approval_requests に申請行を作る（先生側がこれを見る前提）
      //    既にあれば作らない（重複防止）
      const { data: existing, error: exErr } = await supabase
        .from("approval_requests")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();

      if (exErr) throw exErr;

      if (!existing) {
        const { error: insErr } = await supabase.from("approval_requests").insert({
          user_id: uid,
          email: email.trim(),
          name: name.trim() || null,
          phone: null,
          approved: null,       // ★ 未処理 = NULL
          resolved_at: null,
          resolved_by: null,
        });
        if (insErr) throw insErr;
      }

      // 3) 承認制なのでサインアウト
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
          <input className="mt-1 w-full border rounded px-3 py-2" value={name} onChange={(e)=>setName(e.target.value)} />
        </label>

        <label className="block mb-3">
          <span className="text-sm">Email</span>
          <input className="mt-1 w-full border rounded px-3 py-2" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        </label>

        <label className="block mb-4">
          <span className="text-sm">Password</span>
          <input className="mt-1 w-full border rounded px-3 py-2" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
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
