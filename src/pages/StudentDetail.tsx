/*
 * src/pages/StudentDetail.tsx
 * - プロフィールタブ内に: 名前/電話/メモ編集 + 所属グループ + 生徒カレンダー閲覧
 * - 成績タブ: StudentGrades + (必要ならRecords)
 * - 目標タブ: StudentGoals
 * - 先生は塾予定(school)を編集でき、生徒personalは閲覧のみ
 */
import { useEffect, useState } from "react";
import { useIsStaff } from "../hooks/useIsStaff";
import { supabase } from "../lib/supabase";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";
import CalendarBoard from "../components/CalendarBoard";

type Props = {
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    memo: string | null;
  };
  onBack: () => void;
};

type Tab = "profile" | "grades" | "goals";

type GroupMini = {
  id: string;
  name: string;
  type: "class" | "dm" | string;
};

export default function StudentDetail({ student, onBack }: Props) {
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("profile");

  const [formName, setFormName] = useState(student.name ?? "");
  const [formPhone, setFormPhone] = useState(student.phone ?? "");
  const [formMemo, setFormMemo] = useState(student.memo ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
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

    if (error) setProfileMsg("プロフィール保存に失敗しました: " + error.message);
    else setProfileMsg("プロフィールを保存しました。");
    setSavingProfile(false);
  }

  // groups
  const [groups, setGroups] = useState<GroupMini[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupsLoading(true);

      const { data: gm, error: e1 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", student.id);

      if (e1) {
        console.error("❌ load student groups step1:", e1.message);
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      const ids = (gm ?? []).map((r: { group_id?: string }) => r.group_id as string);
      if (ids.length === 0) {
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      const { data: gs, error: e2 } = await supabase
        .from("groups")
        .select("id,name,type")
        .in("id", ids)
        .order("name", { ascending: true });

      if (e2) {
        console.error("❌ load student groups step2:", e2.message);
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      if (!cancelled) {
        setGroups(
          (gs ?? []).map((g: { id: string; name?: string; type?: string }) => ({
            id: g.id as string,
            name: g.name ?? "(名称未設定)",
            type: g.type ?? "class",
          }))
        );
      }
      setGroupsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={onBack}
        className="border rounded px-3 py-1 hover:bg-gray-100"
      >
        ← 一覧に戻る
      </button>

      {/* タブ */}
      <div className="flex gap-2 border-b mt-4">
        <button
          className={`px-3 py-1 rounded-t ${tab === "profile" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("profile")}
        >
          プロフィール
        </button>
        <button
          className={`px-3 py-1 rounded-t ${tab === "grades" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("grades")}
        >
          成績
        </button>
        <button
          className={`px-3 py-1 rounded-t ${tab === "goals" ? "bg-black text-white" : "border"}`}
          onClick={() => setTab("goals")}
        >
          目標
        </button>
      </div>

      {/* プロフィールタブ：ここに全部集約 */}
      {tab === "profile" && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">{student.name ?? "（未設定）"}</h1>

          <form onSubmit={saveProfile} className="space-y-4 max-w-xl bg-white border rounded-2xl p-4">
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
            </div>

            {profileMsg && <p className="text-sm text-gray-700 mt-1">{profileMsg}</p>}
          </form>

          <section className="max-w-xl bg-white border rounded-2xl p-4">
            <h2 className="font-semibold mb-2">所属グループ</h2>
            {groupsLoading ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-gray-500">所属グループはありません。</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {groups.map((g) => (
                  <li key={g.id}>
                    {g.name}
                    {g.type === "dm" && <span className="ml-2 text-xs text-gray-500">（DM）</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 生徒カレンダー（先生は閲覧＋塾予定編集） */}
          <section className="bg-white border rounded-2xl p-4">
            <h2 className="text-lg font-bold mb-3">カレンダー</h2>
            <CalendarBoard
              viewerRole="teacher"
              ownerUserId={student.id}
              canEditPersonal={false}  // 生徒personalは閲覧のみ
              canEditSchool={true}     // 塾予定は先生が編集
            />
          </section>
        </div>
      )}

      {tab === "grades" && (
        <div className="space-y-6">
          <div className="bg-white border rounded-2xl p-4">
            <h2 className="text-lg font-bold mb-3">問題集の成績</h2>
            <StudentGrades userId={student.id} editable={true} />
          </div>
        </div>
      )}

      {tab === "goals" && (
        <div className="bg-white border rounded-2xl p-4">
          <StudentGoals userId={student.id} editable={true} />
        </div>
      )}
    </div>
  );
}
