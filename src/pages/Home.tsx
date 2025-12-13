// src/pages/Home.tsx
/*
 * Responsibility: ホームダッシュボード（スマホ優先）
 * - 学習サマリー（今日 / 今月 / 直近7日）
 * - 週刊目標・月間目標の表示枠
 * - カレンダー表示（当月、学習した日にマーク）
 * - 下のカードから各画面（MyPage / Chat / DM / Students）へナビゲーション
 */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { View } from "../App";

type Props = {
  onNavigate: (view: View) => void;
  isStaff: boolean;
};

type TrendDay = {
  date: string;   // "YYYY-MM-DD"
  label: string;  // "2/10" など表示用
  minutes: number;
};

export default function Home({ onNavigate, isStaff }: Props) {
  const { user } = useAuth();

  const [todayMinutes, setTodayMinutes] = useState(0);
  const [monthMinutes, setMonthMinutes] = useState(0);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [dayMinutesMap, setDayMinutesMap] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.email ?? "ユーザー";
  }, [user]);

  // 学習ログ集計（今月分をまとめて読み、そこから今日/今月/7日分/カレンダーに使う）
  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);
      setLoadError(null);

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      // 今月分をすべて取得（student_id 自分）
      const { data, error } = await supabase
        .from("study_logs")
        .select("studied_at, minutes")
        .eq("student_id", user.id)
        .gte("studied_at", monthStartStr)
        .lte("studied_at", todayStr);

      if (error) {
        console.error("❌ load study_logs:", error.message);
        setLoadError("学習記録の読み込みに失敗しました。");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as { studied_at: string; minutes: number }[];

      // 日付ごとの合計マップ
      const dayMap: Record<string, number> = {};
      let todayTotal = 0;
      let monthTotal = 0;

      for (const r of rows) {
        const d = r.studied_at.slice(0, 10);
        const m = r.minutes ?? 0;
        dayMap[d] = (dayMap[d] ?? 0) + m;
        monthTotal += m;
        if (d === todayStr) {
          todayTotal += m;
        }
      }

      // 直近7日分の推移（今日を含む過去7日）
      const trendArr: TrendDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const minutes = dayMap[key] ?? 0;
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        trendArr.push({ date: key, label, minutes });
      }

      setDayMinutesMap(dayMap);
      setTodayMinutes(todayTotal);
      setMonthMinutes(monthTotal);
      setTrend(trendArr);
      setLoading(false);
    })();
  }, [user]);

  // 分 → 「h時間m分」表記
  function formatMinutes(mins: number): string {
    if (!mins) return "0分";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}時間${m}分`;
    if (h > 0) return `${h}時間`;
    return `${m}分`;
  }

  // カレンダー用：当月の日付配列を作る
  const calendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-index
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay(); // 0:日〜6:土
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: {
      day: number | null;   // null は空セル
      dateKey: string | null;
    }[] = [];

    // 1日までの空セル
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: null, dateKey: null });
    }

    // 日にちセル
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const key = dt.toISOString().slice(0, 10);
      cells.push({ day: d, dateKey: key });
    }

    return {
      year,
      month: month + 1,
      cells,
      today: now.getDate(),
    };
  }, []);

  const maxTrendMinutes = useMemo(() => {
    if (trend.length === 0) return 0;
    return Math.max(...trend.map((t) => t.minutes));
  }, [trend]);

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-6 pt-2">
      {/* あいさつ */}
      <section className="mb-3">
        <p className="text-xs text-gray-500 mb-1">ホーム</p>
        <h1 className="text-xl font-bold">
          こんにちは、
          <span className="text-green-600">
            {displayName || "ゲスト"}
          </span>
          さん
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          学習の記録と成績、連絡をここから確認できます。
        </p>
      </section>

      {/* 学習サマリー */}
      <section className="space-y-3 mb-4">
        {/* 上段：今日 / 今月 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-2xl border px-3 py-2">
            <p className="text-xs text-gray-500">今日の学習時間</p>
            <p className="text-lg font-bold mt-1">
              {formatMinutes(todayMinutes)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border px-3 py-2">
            <p className="text-xs text-gray-500">今月の学習時間</p>
            <p className="text-lg font-bold mt-1">
              {formatMinutes(monthMinutes)}
            </p>
          </div>
        </div>

        {/* 下段：直近7日間の推移 */}
        <div className="bg-white rounded-2xl border px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">直近7日間の学習推移</p>
            {loading && (
              <span className="text-[10px] text-gray-400">
                読み込み中…
              </span>
            )}
          </div>
          {loadError ? (
            <p className="text-xs text-red-500">{loadError}</p>
          ) : trend.length === 0 ? (
            <p className="text-xs text-gray-500">
              まだ今月の学習記録がありません。
            </p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {trend.map((t) => {
                const ratio =
                  maxTrendMinutes > 0
                    ? t.minutes / maxTrendMinutes
                    : 0;
                const height = Math.max(ratio * 80, t.minutes > 0 ? 8 : 0); // 最低高さ
                return (
                  <div
                    key={t.date}
                    className="flex flex-col items-center justify-end flex-1"
                  >
                    <div
                      className="w-4 rounded-t bg-green-500"
                      style={{ height: `${height}px` }}
                    />
                    <span className="mt-1 text-[9px] text-gray-500">
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 週刊 / 月間目標 */}
      <section className="space-y-3 mb-4">
        <div className="bg-white rounded-2xl border px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">週刊目標</p>
          <p className="text-sm text-gray-700">
            今週の目標をマイページの「目標」タブで設定できます。
          </p>
          <button
            type="button"
            onClick={() => onNavigate("mypage")}
            className="mt-2 inline-flex items-center text-xs text-green-700 underline"
          >
            目標を確認・編集する →
          </button>
        </div>

        <div className="bg-white rounded-2xl border px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">月間目標</p>
          <p className="text-sm text-gray-700">
            今月の目標もマイページから管理できます。勉強時間の目安も決めてみましょう。
          </p>
        </div>
      </section>

      {/* カレンダー（当月） */}
      <section className="bg-white rounded-2xl border px-3 py-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">
            カレンダー（{calendar.year}年{calendar.month}月）
          </p>
          <span className="text-[10px] text-gray-400">
            ● がある日は学習記録あり
          </span>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] text-gray-500 mb-1">
          <span>日</span>
          <span>月</span>
          <span>火</span>
          <span>水</span>
          <span>木</span>
          <span>金</span>
          <span>土</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {calendar.cells.map((c, idx) => {
            if (c.day === null) {
              return <div key={idx} className="h-8" />;
            }
            const isToday = c.day === calendar.today;
            const hasStudy =
              c.dateKey && dayMinutesMap[c.dateKey] && dayMinutesMap[c.dateKey] > 0;

            return (
              <div
                key={idx}
                className={`h-8 flex flex-col items-center justify-center rounded 
                  ${isToday ? "bg-green-50 border border-green-500" : "border border-transparent"}`}
              >
                <span
                  className={`text-[11px] ${
                    isToday ? "text-green-700 font-semibold" : "text-gray-700"
                  }`}
                >
                  {c.day}
                </span>
                {hasStudy && (
                  <span className="mt-[1px] text-[8px] text-green-600">
                    ●
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 下部：各機能へのショートカットカード */}
      <section className="space-y-3">
        {/* 勉強記録（マイページへ） */}
        <button
          type="button"
          onClick={() => onNavigate("mypage")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border px-4 py-3 active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">勉強時間の記録</p>
              <p className="font-bold text-base mt-1">
                今日の勉強を記録する
              </p>
              <p className="text-xs text-gray-500 mt-1">
                何の教科を何時間やったか、マイページから記録できます。
              </p>
            </div>
            <span className="text-3xl">📝</span>
          </div>
        </button>

        {/* 成績・目標 */}
        <button
          type="button"
          onClick={() => onNavigate("mypage")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border px-4 py-3 active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">成績・目標</p>
              <p className="font-bold text-base mt-1">
                自分の成績と目標を見る
              </p>
              <p className="text-xs text-gray-500 mt-1">
                先生が登録した成績や、自分で立てた目標を確認できます。
              </p>
            </div>
            <span className="text-3xl">📊</span>
          </div>
        </button>

        {/* グループチャット */}
        <button
          type="button"
          onClick={() => onNavigate("chat")}
          className="w-full text左 bg-white rounded-2xl shadow-sm border px-4 py-3 active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">連絡・クラスチャット</p>
              <p className="font-bold text-base mt-1">
                クラスの連絡を確認する
              </p>
              <p className="text-xs text-gray-500 mt-1">
                宿題やお知らせなどをクラスチャットで確認できます。
              </p>
            </div>
            <span className="text-3xl">💬</span>
          </div>
        </button>

        {/* DM */}
        <button
          type="button"
          onClick={() => onNavigate("dm")}
          className="w-full text-left bg-white rounded-2xl shadow-sm border px-4 py-3 active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">個別メッセージ</p>
              <p className="font-bold text-base mt-1">
                先生に個別で相談する
              </p>
              <p className="text-xs text-gray-500 mt-1">
                進路や勉強方法など、周りに見られたくない相談はこちら。
              </p>
            </div>
            <span className="text-3xl">📥</span>
          </div>
        </button>

        {/* 先生専用：生徒管理 */}
        {isStaff && (
          <button
            type="button"
            onClick={() => onNavigate("students")}
            className="w-full text-left bg-white rounded-2xl shadow-sm border px-4 py-3 active:scale-[0.99] transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">教師メニュー</p>
                <p className="font-bold text-base mt-1">
                  生徒一覧・成績管理
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  生徒のプロフィールや成績、勉強記録をまとめて確認できます。
                </p>
              </div>
              <span className="text-3xl">👨‍🏫</span>
            </div>
          </button>
        )}
      </section>
    </main>
  );
}
