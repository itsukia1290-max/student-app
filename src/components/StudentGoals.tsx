// src/components/StudentGoals.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type GoalRow = {
  id: string;
  user_id: string;
  kind: "weekly" | "monthly";
  text: string | null;
  updated_at: string | null;
};

type Props = {
  userId: string;         // 対象ユーザー（生徒or自分）
  editable?: boolean;     // 編集可否（生徒本人 or 先生/管理者）
  className?: string;
};

/**
 * 学習目標（週刊/月間）を表示・編集するコンポーネント。
 * テーブル名: student_goals（id uuid, user_id uuid, kind text, text text, updated_at timestamptz）
 * 既存レコードが無ければ INSERT、あれば UPDATE。
 * ＊ユニーク制約が無くても動くように実装（SELECTして存在確認→分岐）。
 */
export default function StudentGoals({ userId, editable = false, className }: Props) {
  const [weekly, setWeekly] = useState<string>("");
  const [monthly, setMonthly] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [savingW, setSavingW] = useState<boolean>(false);
  const [savingM, setSavingM] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 読み込み
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setMsg(null);

      const { data, error } = await supabase
        .from("student_goals")
        .select("id,user_id,kind,text,updated_at")
        .eq("user_id", userId)
        .in("kind", ["weekly", "monthly"])
        .order("updated_at", { ascending: false });

      if (!alive) return;

      if (error) {
        setMsg("目標の読み込みに失敗しました: " + error.message);
        setLoading(false);
        return;
      }

      const w = (data ?? []).find((r) => r.kind === "weekly") as GoalRow | undefined;
      const m = (data ?? []).find((r) => r.kind === "monthly") as GoalRow | undefined;

      setWeekly(w?.text ?? "");
      setMonthly(m?.text ?? "");
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // 保存（共通ヘルパー）
  async function upsertGoal(kind: "weekly" | "monthly", text: string) {
    // まず存在確認
    const { data: existing, error: selErr } = await supabase
      .from("student_goals")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", kind)
      .maybeSingle();

    if (selErr && selErr.code !== "PGRST116") {
      // PGRST116は maybeSingle でレコードが無いときに出ることがある
      throw selErr;
    }

    if (existing?.id) {
      // UPDATE
      const { error } = await supabase
        .from("student_goals")
        .update({ text, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      // INSERT
      const { error } = await supabase
        .from("student_goals")
        .insert({
          user_id: userId,
          kind,
          text,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    }
  }

  // ボタンハンドラ
  async function saveWeekly() {
    try {
      setSavingW(true);
      setMsg(null);
      await upsertGoal("weekly", weekly);
      setMsg("週刊目標を保存しました。");
    } catch (e: any) {
      setMsg("週刊目標の保存に失敗しました: " + (e?.message ?? e));
    } finally {
      setSavingW(false);
    }
  }

  async function saveMonthly() {
    try {
      setSavingM(true);
      setMsg(null);
      await upsertGoal("monthly", monthly);
      setMsg("月間目標を保存しました。");
    } catch (e: any) {
      setMsg("月間目標の保存に失敗しました: " + (e?.message ?? e));
    } finally {
      setSavingM(false);
    }
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="p-4 rounded-xl border bg-white text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className={`grid md:grid-cols-2 gap-6 ${className ?? ""}`}>
      {/* 週刊目標 */}
      <section className="p-4 rounded-xl border bg-white">
        <h3 className="font-semibold mb-2">週刊目標</h3>
        <textarea
          className="w-full h-40 border rounded px-3 py-2"
          placeholder="今週の到達目標・やること（例：数学チャート20問、英単語200語、理科の復習 etc.）"
          value={weekly}
          onChange={(e) => setWeekly(e.target.value)}
          disabled={!editable}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveWeekly}
            disabled={!editable || savingW}
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {savingW ? "保存中..." : "保存"}
          </button>
        </div>
      </section>

      {/* 月間目標 */}
      <section className="p-4 rounded-xl border bg-white">
        <h3 className="font-semibold mb-2">月間目標</h3>
        <textarea
          className="w-full h-40 border rounded px-3 py-2"
          placeholder="今月の到達目標・やること（例：定期テストで○○点、模試偏差値○○以上、課題を全て期限内に提出 etc.）"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          disabled={!editable}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveMonthly}
            disabled={!editable || savingM}
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {savingM ? "保存中..." : "保存"}
          </button>
        </div>
      </section>

      {msg && (
        <div className="md:col-span-2 text-sm text-gray-700">{msg}</div>
      )}
    </div>
  );
}
