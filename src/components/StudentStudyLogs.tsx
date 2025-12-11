// src/components/StudentStudyLogs.tsx
// Responsibility: 勉強時間の記録（科目＋時間＋日付）
// - editable=true  : 生徒用（入力フォーム＋日別合計＋内訳）
// - editable=false : 先生用（閲覧のみ・日別合計＋内訳）

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Button from "./ui/Button";
import Input, { Textarea } from "./ui/Input";

type Props = {
  userId: string;
  editable?: boolean; // ★ 追加（デフォルト true）
};

type StudyLog = {
  id: string;
  subject: string;
  minutes: number;
  studied_at: string; // YYYY-MM-DD
  memo: string | null;
  created_at: string;
};

type DayGroup = {
  date: string;
  totalMinutes: number;
  logs: StudyLog[];
};

export default function StudentStudyLogs({
  userId,
  editable = true,
}: Props) {
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 入力フォーム（editable=true のときだけ使う）
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState<string>("1"); // 表示は「時間」、保存は「分」
  const [studiedAt, setStudiedAt] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });
  const [memo, setMemo] = useState("");

  // どの日付の内訳を開いているか
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  // 勉強記録の読み込み
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("study_logs")
        .select("id, subject, minutes, studied_at, memo, created_at")
        .eq("user_id", userId)
        .order("studied_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) {
          console.error("❌ load study_logs:", error.message);
          setError("勉強記録の読み込みに失敗しました。");
        } else {
          setLogs((data ?? []) as StudyLog[]);
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 日付ごとにログをまとめて、合計時間を計算
  const groupedByDay: DayGroup[] = useMemo(() => {
    const map: Record<string, StudyLog[]> = {};

    for (const log of logs) {
      if (!map[log.studied_at]) {
        map[log.studied_at] = [];
      }
      map[log.studied_at].push(log);
    }

    const groups: DayGroup[] = Object.entries(map).map(([date, items]) => {
      const totalMinutes = items.reduce(
        (sum, l) => sum + l.minutes,
        0
      );
      const sorted = [...items].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
      return { date, totalMinutes, logs: sorted };
    });

    groups.sort((a, b) => (a.date < b.date ? 1 : -1)); // 新しい日付が上
    return groups;
  }, [logs]);

  function toggleDate(date: string) {
    setOpenDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return; // 念のため

    setError(null);

    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setError("科目を入力してください。");
      return;
    }

    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0) {
      setError("時間は 0 より大きい数値で入力してください。");
      return;
    }
    const minutes = Math.round(h * 60);

    if (!studiedAt) {
      setError("学習日を選択してください。");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("study_logs")
      .insert({
        user_id: userId,
        subject: trimmedSubject,
        minutes,
        studied_at: studiedAt,
        memo: memo.trim() || null,
      })
      .select("id, subject, minutes, studied_at, memo, created_at")
      .single();

    if (error) {
      console.error("❌ insert study_logs:", error.message);
      setError("勉強記録の保存に失敗しました。");
    } else if (data) {
      setLogs((prev) => [data as StudyLog, ...prev]);
      setSubject("");
      setHours("1");
      setMemo("");

      // 新しく記録した日の内訳を自動で開く
      setOpenDates((prev) => ({
        ...prev,
        [(data as StudyLog).studied_at]: true,
      }));
    }

    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* 入力フォーム（生徒用 only） */}
      {editable && (
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-2xl border bg-white p-4"
        >
          <h3 className="text-lg font-bold">今日の勉強を記録する</h3>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="block text-sm">科目</label>
              <Input
                className="mt-1"
                placeholder="例: 数学、英語、物理 など"
                value={subject}
                onChange={(e) =>
                  setSubject((e.target as HTMLInputElement).value)
                }
              />
            </div>

            <div>
              <label className="block text-sm">時間（時間単位）</label>
              <Input
                type="number"
                min={0.25}
                step={0.25}
                className="mt-1"
                value={hours}
                onChange={(e) =>
                  setHours((e.target as HTMLInputElement).value)
                }
              />
            </div>

            <div>
              <label className="block text-sm">日付</label>
              <Input
                type="date"
                className="mt-1"
                value={studiedAt}
                onChange={(e) =>
                  setStudiedAt((e.target as HTMLInputElement).value)
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm">メモ（任意）</label>
            <Textarea
              className="mt-1 h-20"
              placeholder="どんな勉強をしたか簡単にメモ（例: 過去問○年分、ワークP.50〜60 など）"
              value={memo}
              onChange={(e) =>
                setMemo((e.target as HTMLTextAreaElement).value)
              }
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "保存中..." : "記録する"}
            </Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>
      )}

      {/* 日付ごとの合計＋内訳（生徒・先生共通） */}
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="text-lg font-bold mb-3">
          {editable ? "過去の勉強記録" : "勉強記録（閲覧）"}
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : groupedByDay.length === 0 ? (
          <p className="text-sm text-gray-500">
            まだ勉強記録がありません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 px-2 text-left">日付</th>
                  <th className="py-1 px-2 text-right">合計時間</th>
                  <th className="py-1 px-2 text-left">内訳</th>
                </tr>
              </thead>
              <tbody>
                {groupedByDay.map((group) => {
                  const isOpen = openDates[group.date] ?? false;
                  return (
                    <Fragment key={group.date}>
                      <tr
                        className="border-b cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleDate(group.date)}
                      >
                        <td className="py-2 px-2">{group.date}</td>
                        <td className="py-2 px-2 text-right">
                          {(group.totalMinutes / 60).toFixed(2)} h
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-xs text-gray-500">
                            {isOpen
                              ? "クリックして閉じる"
                              : "クリックして内訳を表示"}
                          </span>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b bg-gray-50/50">
                          <td className="py-2 px-2" colSpan={3}>
                            <div className="text-xs text-gray-700">
                              <div className="font-semibold mb-1">
                                内訳
                              </div>
                              <div className="space-y-1">
                                {group.logs.map((log) => (
                                  <div
                                    key={log.id}
                                    className="flex flex-col md:flex-row md:items-baseline md:gap-3"
                                  >
                                    <span className="font-medium">
                                      {log.subject}
                                    </span>
                                    <span className="md:ml-auto">
                                      {(log.minutes / 60).toFixed(2)} h
                                    </span>
                                    {log.memo && (
                                      <span className="text-gray-500 md:ml-3">
                                        {log.memo}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
