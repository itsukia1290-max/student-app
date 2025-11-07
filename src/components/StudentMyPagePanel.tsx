// src/components/StudentMyPagePanel.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  studentId: string;
  canEdit?: boolean; // ★ admin/teacher のとき true
};

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  memo: string | null;
};

export default function StudentMyPagePanel({ studentId, canEdit = false }: Props) {
  const [data, setData] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo")
        .eq("id", studentId)
        .maybeSingle();

      if (!alive) return;
      if (error) setErr(error.message);
      else {
        setData(data as Profile);
        setForm(data as Profile);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [studentId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name,
        phone: form.phone,
        memo: form.memo,
      })
      .eq("id", form.id);
    if (error) {
      setMsg("保存に失敗: " + error.message);
    } else {
      setMsg("保存しました。");
      setData(form);
      setEditing(false);
    }
    setSaving(false);
  }

  function onCancel() {
    setForm(data);
    setEditing(false);
    setMsg(null);
  }

  return (
    <div className="rounded-2xl border bg-white">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="font-semibold">マイページ（{canEdit ? "閲覧/編集" : "閲覧"}）</div>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm border rounded px-2 py-1"
          >
            編集
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading && <div>読み込み中...</div>}
        {err && <div className="text-red-600">読み込み失敗: {err}</div>}

        {!editing && data && (
          <>
            <Item label="氏名" value={data.name ?? "（未設定）"} />
            <Item label="電話番号" value={data.phone ?? "-"} />
            <Item label="メモ" value={data.memo ?? "-"} pre />
          </>
        )}

        {editing && form && (
          <form onSubmit={onSave} className="space-y-4">
            <LabeledInput
              label="氏名"
              value={form.name ?? ""}
              onChange={(v) => setForm({ ...(form as Profile), name: v })}
            />
            <LabeledInput
              label="電話番号"
              value={form.phone ?? ""}
              onChange={(v) => setForm({ ...(form as Profile), phone: v })}
            />
            <LabeledTextarea
              label="メモ"
              value={form.memo ?? ""}
              onChange={(v) => setForm({ ...(form as Profile), memo: v })}
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded border"
                disabled={saving}
              >
                キャンセル
              </button>
            </div>
            {msg && <p className="text-sm text-gray-600">{msg}</p>}
          </form>
        )}

        {/* 成績（閲覧/編集）領域は後でここに拡張可能 */}
      </div>
    </div>
  );
}

function Item({ label, value, pre = false }: { label: string; value: string; pre?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={pre ? "whitespace-pre-wrap text-base" : "text-base"}>{value}</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-sm">{label}</div>
      <input
        className="mt-1 w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-sm">{label}</div>
      <textarea
        className="mt-1 w-full border rounded px-3 py-2 h-28"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
