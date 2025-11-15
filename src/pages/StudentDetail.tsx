// src/pages/StudentDetail.tsx
import { useEffect, useState } from "react";
import { useIsStaff } from "../hooks/useIsStaff";
import { supabase } from "../lib/supabase";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";

type Props = {
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    memo: string | null;
  };
  onBack: () => void;
  onDeleted?: (id: string) => void;
};

type Tab = "profile" | "grades" | "goals";

type GroupMini = {
  id: string;
  name: string;
  type: "class" | "dm" | string;
};

export default function StudentDetail({ student, onBack, onDeleted }: Props) {
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("profile");

  // --- プロフィール編集用 ---
  const [formName, setFormName] = useState(student.name ?? "");
  const [formPhone, setFormPhone] = useState(student.phone ?? "");
  const [formMemo, setFormMemo] = useState(student.memo ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
    // 生徒が切り替わったとき用に同期
    setFormName(student.name ?? "");
    setFormPhone(student.phone ?? "");
    setFormMemo(student.memo ?? "");
  }, [student]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isStaff) return;

    setSavingProfile(true);
    setProfileMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        name: formName,
        phone: formPhone || null,
        memo: formMemo || null,
      })
      .eq("id", student.id);

    if (error) {
      setProfileMsg("プロフィール保存に失敗しました: " + error.message);
    } else {
      setProfileMsg("プロフィールを保存しました。");
    }
    setSavingProfile(false);
  }

  // --- 所属グループ表示用（MyPage と同じ2段階ロジック） ---
  const [groups, setGroups] = useState<GroupMini[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupsLoading(true);

      // 1. group_members から group_id を取得
      const { data: gm, error: e1 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", student.id);

      if (e1) {
        console.error("❌ load student groups (step1):", e1.message);
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      const ids = (gm ?? []).map((r) => r.group_id as string);
      if (ids.length === 0) {
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      // 2. groups テーブルから名前などを取得
      const { data: gs, error: e2 } = await supabase
        .from("groups")
        .select("id,name,type")
        .in("id", ids)
        .order("name", { ascending: true });

      if (e2) {
        console.error("❌ load student groups (step2):", e2.message);
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      if (!cancelled) {
        setGroups(
          (gs ?? []).map((g) => ({
            id: g.id as string,
            name: (g.name as string) ?? "(名称未設定)",
            type: (g.type as string) ?? "class",
          }))
        );
      }
      setGroupsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  // --- 退会（利用停止） ---
  async function revokeApproval() {
    if (!isStaff) return;
    const ok = confirm(
      `この生徒 (${student.name ?? "未設定"}) を『退会（利用停止）』にしますか？\n再利用には教師の再承認が必要になります。`
    );
    if (!ok) return;

    const { error } = await supabase.rpc("suspend_student", {
      uid: student.id,
    });
    if (error) {
      alert("退会処理失敗: " + error.message);
    } else {
      alert("退会（利用停止）にしました。");
      if (onDeleted) onDeleted(student.id);
      onBack();
    }
  }

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={onBack}
        className="border rounded px-3 py-1 hover:bg-gray-100"
      >
        ← 一覧に戻る
      </button>

      <h1 className="text-2xl font-bold">
        {student.name ?? "（未設定）"}
      </h1>
      <p className="text-sm text-gray-600">
        電話番号: {student.phone ?? "-"}
      </p>
      <p className="text-sm text-gray-600">
        メモ: {student.memo ?? "-"}
      </p>

      {/* タブ */}
      <div className="flex gap-2 border-b mt-4">
        <button
          className={`px-3 py-1 rounded-t ${
            tab === "profile" ? "bg-black text-white" : "border"
          }`}
          onClick={() => setTab("profile")}
        >
          プロフィール
        </button>
        <button
          className={`px-3 py-1 rounded-t ${
            tab === "grades" ? "bg-black text-white" : "border"
          }`}
          onClick={() => setTab("grades")}
        >
          成績
        </button>
        <button
          className={`px-3 py-1 rounded-t ${
            tab === "goals" ? "bg-black text-white" : "border"
          }`}
          onClick={() => setTab("goals")}
        >
          目標
        </button>
      </div>

      {/* プロフィール＋所属グループ */}
      {tab === "profile" && (
        <div className="space-y-6">
          {/* 編集フォーム */}
          <form onSubmit={saveProfile} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm">氏名</label>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm">電話番号</label>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm">メモ</label>
              <textarea
                className="mt-1 w-full border rounded px-3 py-2 h-28"
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
              />
            </div>

            <div className="flex gap-3 items-center">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
              >
                {savingProfile ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                onClick={revokeApproval}
                className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                退会（利用停止）
              </button>
            </div>
            {profileMsg && (
              <p className="text-sm text-gray-700 mt-1">{profileMsg}</p>
            )}
          </form>

          {/* 所属グループ一覧 */}
          <section className="max-w-xl">
            <h2 className="font-semibold mb-2">所属グループ</h2>
            {groupsLoading ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-gray-500">
                所属グループはありません。
              </p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {groups.map((g) => (
                  <li key={g.id}>
                    {g.name}
                    {g.type === "dm" && (
                      <span className="ml-2 text-xs text-gray-500">
                        （DM）
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* 成績タブ：教師は編集可 */}
      {tab === "grades" && (
        <div className="bg-white border rounded-2xl p-4">
          <StudentGrades userId={student.id} editable={true} />
        </div>
      )}

      {/* 目標タブ：教師編集可 */}
      {tab === "goals" && (
        <div className="bg-white border rounded-2xl p-4">
          <StudentGoals userId={student.id} editable={true} />
        </div>
      )}
    </div>
  );
}
