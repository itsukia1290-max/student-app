/*
 * src/pages/MyPage.tsx
 * - スタッフ用: プロフィール編集のみ
 * - 生徒用: プロフィール / 目標 / 成績 / 記録（StudyLogs + Calendar）
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";
import StudentGroups from "../components/StudentGroups";
import StudentStudyLogs from "../components/StudentStudyLogs";
import CalendarBoard from "../components/CalendarBoard";
import Button from "../components/ui/Button";
import Input, { Textarea } from "../components/ui/Input";

type Profile = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
};

type Tab = "profile" | "goals" | "grades" | "records";

export default function MyPage() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("profile");

  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo")
        .eq("id", user.id)
        .maybeSingle();

      if (error) setMsg("読み込み失敗: " + error.message);
      else setForm(data as Profile);
    }
    load();
  }, [user]);

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

  // Staff view
  if (isStaff) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h2 className="text-xl font-bold mb-4">マイページ（スタッフ）</h2>
        {!form ? (
          <div className="card">読み込み中...</div>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <label className="block text-sm">氏名</label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: (e.target as HTMLInputElement).value })
                }
              />
            </div>
            <div>
              <label className="block text-sm">電話番号</label>
              <Input
                className="mt-1"
                value={form.phone ?? ""}
                onChange={(e) =>
                  setForm({ ...form, phone: (e.target as HTMLInputElement).value })
                }
              />
            </div>
            <div>
              <label className="block text-sm">メモ</label>
              <Textarea
                className="mt-1 h-28"
                value={form.memo ?? ""}
                onChange={(e) =>
                  setForm({ ...form, memo: (e.target as HTMLTextAreaElement).value })
                }
              />
            </div>

            <Button disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            {msg && <p className="text-sm text-gray-600 mt-2">{msg}</p>}
          </form>
        )}
      </div>
    );
  }

  // Student view
  return (
    <div className="min-h-[70vh]">
      <div className="flex gap-2 border-b bg-white p-3">
        {(["profile","goals","grades","records"] as Tab[]).map((k) => (
          <button
            key={k}
            className={`px-3 py-1 rounded ${
              tab === k ? "bg-black text-white" : "border"
            }`}
            onClick={() => setTab(k)}
          >
            {k === "profile" ? "プロフィール" : k === "goals" ? "目標" : k === "grades" ? "成績" : "記録"}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="p-6 max-w-xl mx-auto">
          <h2 className="text-xl font-bold mb-4">マイページ</h2>
          {!form ? (
            <div className="card">読み込み中...</div>
          ) : (
            <>
              <form onSubmit={onSave} className="space-y-4">
                <div>
                  <label className="block text-sm">氏名</label>
                  <Input
                    className="mt-1"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: (e.target as HTMLInputElement).value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm">電話番号</label>
                  <Input
                    className="mt-1"
                    value={form.phone ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, phone: (e.target as HTMLInputElement).value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm">メモ</label>
                  <Textarea
                    className="mt-1 h-28"
                    value={form.memo ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, memo: (e.target as HTMLTextAreaElement).value })
                    }
                  />
                </div>

                <Button disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
                {msg && <p className="text-sm text-gray-600 mt-2">{msg}</p>}
              </form>

              {user && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">所属グループ</h3>
                  <div className="rounded-xl border bg-white p-3">
                    <StudentGroups userId={user.id} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "goals" && user && (
        <div className="p-6 max-w-4xl mx-auto">
          <StudentGoals userId={user.id} editable={true} />
        </div>
      )}

      {tab === "grades" && user && (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border p-4">
            <h2 className="text-lg font-bold mb-3">問題集の成績</h2>
            <StudentGrades userId={user.id} editable={false} />
          </div>
        </div>
      )}

      {tab === "records" && user && (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border p-4">
            <h2 className="text-lg font-bold mb-3">勉強時間の記録</h2>
            <StudentStudyLogs userId={user.id} />
          </div>

          <div className="bg-white rounded-2xl border p-4">
            <h2 className="text-lg font-bold mb-3">カレンダー</h2>
            <CalendarBoard
              viewerRole="student"
              ownerUserId={user.id}
              canEditPersonal={true}
              canEditSchool={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
