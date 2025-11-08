// src/components/StudentProfileEditor.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
};

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

export default function StudentProfileEditor({ userId }: Props) {
  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo")
        .eq("id", userId)
        .maybeSingle();
      if (error) setMsg("読み込み失敗: " + error.message);
      else setForm(data as Profile);
    }
    load();
  }, [userId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ name: form.name, phone: form.phone, memo: form.memo })
      .eq("id", form.id);
    if (error) setMsg("保存失敗: " + error.message);
    else setMsg("保存しました。");
    setSaving(false);
  }

  if (!form) return <div>読み込み中...</div>;

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div>
        <label className="block text-sm">氏名</label>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={form.name ?? ""}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm">電話番号</label>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={form.phone ?? ""}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm">メモ</label>
        <textarea
          className="mt-1 w-full border rounded px-3 py-2 h-28"
          value={form.memo ?? ""}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
        />
      </div>

      <button
        disabled={saving}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存"}
      </button>
      {msg && <p className="text-sm text-gray-600 mt-2">{msg}</p>}
    </form>
  );
}
