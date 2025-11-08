import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";

type Goal = {
  id: string;
  user_id: string;
  kind: "monthly" | "weekly";
  period_start: string; // ISO date (YYYY-MM-DD)
  title: string;
  notes: string | null;
  progress: number;
  updated_at: string;
};

type Props = {
  /** whose goals to show. typically the logged-in user's id */
  userId: string;
  /** allow editing? staff may pass true when viewing students */
  editable?: boolean;
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function mondayOfWeek(d = new Date()) {
  const tmp = new Date(d);
  const day = (tmp.getDay() + 6) % 7; // Mon=0 ... Sun=6
  tmp.setDate(tmp.getDate() - day);
  tmp.setHours(0, 0, 0, 0);
  return tmp;
}

export default function GoalsSection({ userId, editable = true }: Props) {
  const { isStaff } = useIsStaff();
  const canEdit = editable || isStaff;

  // 入力フォーム用 state
  const [mPeriod, setMPeriod] = useState(ymd(firstDayOfMonth()));
  const [wPeriod, setWPeriod] = useState(ymd(mondayOfWeek()));
  const [mTitle, setMTitle]   = useState("");
  const [mNotes, setMNotes]   = useState("");
  const [wTitle, setWTitle]   = useState("");
  const [wNotes, setWNotes]   = useState("");
  const [saving, setSaving]   = useState(false);

  // 表示用
  const [monthly, setMonthly] = useState<Goal | null>(null);
  const [weekly,  setWeekly]  = useState<Goal | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // 現在期間のレコードをロード
  useEffect(() => {
    async function load() {
      if (!userId) return;

      const { data: m } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("kind", "monthly")
        .eq("period_start", mPeriod)
        .maybeSingle();
      setMonthly((m as Goal) ?? null);
      setMTitle(m?.title ?? "");
      setMNotes(m?.notes ?? "");

      const { data: w } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("kind", "weekly")
        .eq("period_start", wPeriod)
        .maybeSingle();
      setWeekly((w as Goal) ?? null);
      setWTitle(w?.title ?? "");
      setWNotes(w?.notes ?? "");
    }
    load();
  }, [userId, mPeriod, wPeriod]);

  async function save(kind: "monthly" | "weekly") {
    if (!userId || !canEdit) return;
    setSaving(true); setMsg(null);

    const isMonthly = kind === "monthly";
    const period = isMonthly ? mPeriod : wPeriod;
    const title  = isMonthly ? mTitle  : wTitle;
    const notes  = isMonthly ? mNotes  : wNotes;

    if (!title.trim()) {
      setMsg("タイトルは必須です。");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .upsert({
        user_id: userId,
        kind,
        period_start: period,
        title: title.trim(),
        notes: notes?.trim() || null,
      }, { onConflict: "user_id,kind,period_start" })
      .select()
      .maybeSingle();

    if (error) {
      setMsg("保存失敗: " + error.message);
    } else {
      setMsg("保存しました。");
      if (isMonthly) setMonthly(data as Goal);
      else setWeekly(data as Goal);
    }
    setSaving(false);
  }

  async function setProgress(kind: "monthly" | "weekly", progress: number) {
    if (!userId || !canEdit) return;
    const period = kind === "monthly" ? mPeriod : wPeriod;
    const { data, error } = await supabase
      .from("goals")
      .update({ progress })
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("period_start", period)
      .select()
      .maybeSingle();
    if (!error && data) {
      if (kind === "monthly") setMonthly(data as Goal);
      else setWeekly(data as Goal);
    }
  }

  const monthLabel = useMemo(() => {
    const d = new Date(mPeriod);
    return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
  }, [mPeriod]);

  const weekLabel = useMemo(() => {
    const d = new Date(wPeriod);
    const end = new Date(d); end.setDate(d.getDate() + 6);
    return `${d.getMonth() + 1}/${d.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  }, [wPeriod]);

  return (
    <section className="mt-8 space-y-8">
      <h3 className="text-lg font-bold">目標（Monthly / Weekly）</h3>

      {/* 月間 */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">月の開始日</label>
          <input
            type="date"
            value={mPeriod}
            onChange={(e) => setMPeriod(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <span className="text-sm text-gray-500">{monthLabel}</span>
        </div>

        <div>
          <label className="block text-sm">月間目標（タイトル）</label>
          <input
            disabled={!canEdit}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="例：今月は英単語を2000語覚える"
            value={mTitle}
            onChange={(e) => setMTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm">メモ</label>
          <textarea
            disabled={!canEdit}
            className="mt-1 w-full border rounded px-3 py-2 h-24"
            placeholder="達成方法・締切・評価基準など"
            value={mNotes}
            onChange={(e) => setMNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm">進捗</label>
          <input
            type="range"
            min={0}
            max={100}
            value={monthly?.progress ?? 0}
            onChange={(e) => setProgress("monthly", Number(e.target.value))}
            disabled={!monthly || !canEdit}
          />
          <span className="text-sm w-12 text-right">
            {monthly?.progress ?? 0}%
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => save("monthly")}
            disabled={!canEdit || saving}
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {saving ? "保存中..." : "月間目標を保存"}
          </button>
          {monthly && (
            <span className="text-xs text-gray-500 self-center">
              更新: {new Date(monthly.updated_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* 週間 */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">週の開始日（例：月曜）</label>
          <input
            type="date"
            value={wPeriod}
            onChange={(e) => setWPeriod(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <span className="text-sm text-gray-500">{weekLabel}</span>
        </div>

        <div>
          <label className="block text-sm">週間目標（タイトル）</label>
          <input
            disabled={!canEdit}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="例：3回模試の復習を完了する"
            value={wTitle}
            onChange={(e) => setWTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm">メモ</label>
          <textarea
            disabled={!canEdit}
            className="mt-1 w-full border rounded px-3 py-2 h-24"
            placeholder="具体的タスク・締切など"
            value={wNotes}
            onChange={(e) => setWNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm">進捗</label>
          <input
            type="range"
            min={0}
            max={100}
            value={weekly?.progress ?? 0}
            onChange={(e) => setProgress("weekly", Number(e.target.value))}
            disabled={!weekly || !canEdit}
          />
          <span className="text-sm w-12 text-right">
            {weekly?.progress ?? 0}%
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => save("weekly")}
            disabled={!canEdit || saving}
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {saving ? "保存中..." : "週間目標を保存"}
          </button>
          {weekly && (
            <span className="text-xs text-gray-500 self-center">
              更新: {new Date(weekly.updated_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-gray-600">{msg}</p>}
    </section>
  );
}
