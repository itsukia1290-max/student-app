import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("ログイン失敗: " + error.message);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <form onSubmit={onSubmit} className="bg-white shadow p-6 rounded-2xl w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4">ログイン</h1>
        <label className="block mb-2">
          <span className="text-sm">Email</span>
          <input className="mt-1 w-full border rounded px-3 py-2" type="email" value={email}
                 onChange={(e)=>setEmail(e.target.value)} required />
        </label>
        <label className="block mb-4">
          <span className="text-sm">Password</span>
          <input className="mt-1 w-full border rounded px-3 py-2" type="password" value={password}
                 onChange={(e)=>setPassword(e.target.value)} required />
        </label>
        <button className="w-full py-2 rounded bg-black text-white">Sign in</button>
      </form>
    </div>
  );
}
