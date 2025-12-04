// src/components/StudentGoals.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  editable: boolean;
};

type PeriodType = "week" | "month";

type Goal = {
  id: string;
  user_id: string;
  period_type: PeriodType;
  period_key: string; // "2025-W11" とか "2025-03"
  title: string | null;
  detail: string | null;
  created_at: string;
  updated_at: string;
};

// ------- 期間キーの計算系ユーティリティ -------

// ISO 週番号をざっくり出す関数（よくある実装）
function getISOWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // 木曜日の週を基準にする
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

function getCurrentWeekKey(now = new Date()): string {
  const year = now.getFullYear();
  const week = getISOWeek(now);
  return `${year}-W${String(week).padStart(2, "0")}`; // 例: 2025-W03
}

function getCurrentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`; // 例: 2025-03
}

function labelOfPeriod(type: PeriodType, key: string): string {
  if (type === "week") {
    // "2025-W03" → "2025年第3週"
    const [y, w] = key.split("-W");
    return `${y}年第${parseInt(w ?? "0", 10)}週`;
  } else {
    // "2025-03" → "2025年3月"
    const [y, m] = key.split("-");
    return `${y}年${parseInt(m ?? "0", 10)}月`;
  }
}

// ----------------------------------------------------

export default function StudentGoals({ userId, editable }: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>("week");

  const currentKey = useMemo(
    () =>
      periodType === "week" ? getCurrentWeekKey(new Date()) : getCurrentMonthKey(new Date()),
    [periodType]
  );

  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  // 期間切り替え・ユーザー変更時にロード
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMsg(null);

      // 1. 現在期間の目標 1件
      const { data: cur, error: errCur } = await supabase
        .from("student_goals")
        .select("*")
        .eq("user_id", userId)
        .eq("period_type", periodType)
        .eq("period_key", currentKey)
        .maybeSingle();

      if (errCur) {
        console.error("❌ load current goal:", errCur.message);
        if (!cancelled) setMsg("目標の読み込みに失敗しました: " + errCur.message);
      }

      if (!cancelled) {
        if (cur) {
          const g = cur as Goal;
          setCurrentGoal(g);
          setTitle(g.title ?? "");
          setDetail(g.detail ?? "");
        } else {
          setCurrentGoal(null);
          setTitle("");
          setDetail("");
        }
      }

      // 2. 履歴（同じ period_type の過去 10 件ぐらい）
      const { data: hist, error: errHist } = await supabase
        .from("student_goals")
        .select("*")
        .eq("user_id", userId)
        .eq("period_type", periodType)
        .neq("period_key", currentKey)
        .order("period_key", { ascending: false })
        .limit(10);

      if (errHist) {
        console.error("❌ load history goals:", errHist.message);
      }

      if (!cancelled) {
        setHistory((hist ?? []) as Goal[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, periodType, currentKey]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;

    setSaving(true);
    setMsg(null);

    const nowIso = new Date().toISOString();

    // 「同じ user_id + period_type + period_key は1件だけ」の upsert
    const { data, error } = await supabase
      .from("student_goals")
      .upsert(
        {
          id: currentGoal?.id, // 既存があればそれを更新
          user_id: userId,
          period_type: periodType,
          period_key: currentKey,
          title: title || null,
          detail: detail || null,
          created_at: currentGoal?.created_at ?? nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id,period_type,period_key" }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error("❌ save goal:", error.message);
      setMsg("保存に失敗しました: " + error.message);
    } else {
      const g = data as Goal;
      setCurrentGoal(g);
      setMsg("保存しました。");
    }

    setSaving(false);
  }

  function renderCurrentForm() {
    const label = labelOfPeriod(periodType, currentKey);

    if (!editable && !currentGoal) {
      // 生徒側など、閲覧専用で未設定のとき
      return (
        <p className="text-sm text-gray-500">
          {label} の目標はまだ登録されていません。
        </p>
      );
    }

    return (
      <form onSubmit={onSave} className="space-y-3">
        <p className="text-sm text-gray-600">
          現在の期間: <span className="font-semibold">{label}</span>
        </p>
        {editable && !currentGoal && (
          <p className="text-xs text-orange-600">
            まだこの期間の目標が未設定です。目標を入力して「保存」すると作成されます。
          </p>
        )}
        {!editable && currentGoal && (
          <p className="text-xs text-gray-500">
            教師・生徒の両方が編集できる目標です（現在は閲覧のみ）。
          </p>
        )}

        <div>
          <label className="block text-sm mb-1">一言目標（例：英単語を毎日100語）</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!editable}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">詳細・振り返りメモ</label>
          <textarea
            className="mt-1 w-full border rounded px-3 py-2 min-h-[80px]"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            disabled={!editable}
          />
        </div>

        {editable && (
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        )}
        {msg && <p className="text-xs text-gray-600 mt-1">{msg}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {/* 期間切り替えボタン */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setPeriodType("week")}
          className={`px-3 py-1 rounded ${
            periodType === "week" ? "bg-black text-white" : "border"
          }`}
        >
          週目標
        </button>
        <button
          type="button"
          onClick={() => setPeriodType("month")}
          className={`px-3 py-1 rounded ${
            periodType === "month" ? "bg-black text-white" : "border"
          }`}
        >
          月目標
        </button>
      </div>

      {/* 現在の期間の目標 */}
      <section>
        <h3 className="font-semibold mb-2">現在の目標</h3>
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : (
          renderCurrentForm()
        )}
      </section>

      {/* 過去の目標一覧 */}
      <section>
        <h3 className="font-semibold mb-2">過去の目標（直近10件）</h3>
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">過去の目標はまだありません。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((g) => (
              <li
                key={g.id}
                className="border rounded-lg bg-white p-3 flex flex-col gap-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {labelOfPeriod(g.period_type, g.period_key)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    更新: {new Date(g.updated_at).toLocaleString()}
                  </span>
                </div>
                {g.title && (
                  <p className="text-gray-900">
                    <span className="font-medium">目標：</span>
                    {g.title}
                  </p>
                )}
                {g.detail && (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    <span className="font-medium">メモ：</span>
                    {g.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
