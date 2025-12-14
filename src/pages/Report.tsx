/*
 * src/pages/Report.tsx
 * Responsibility: レポート画面（記録/タイムライン）
 * - 上部: タイトル（人型アイコン + レポート）
 * - タブ: 記録 / タイムライン（選択中は濃い文字 + 青下線）
 * - 記録: 今日/今月/総学習時間（薄灰カード） + 週目標/月目標（薄灰カード） + カレンダー
 */

import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";
import CalendarBoard from "../components/CalendarBoard";

// ここは既存の集計に差し替えてOK（今は見た目優先でプレースホルダ）
type Summary = { todayMin: number; monthMin: number; totalMin: number };

function minToLabel(min: number) {
  if (min <= 0) return "0分";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

export default function Report() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const [tab, setTab] = useState<"record" | "timeline">("record");

  // TODO: ここを study_logs から実データ集計に置き換えればOK
  const summary: Summary = useMemo(
    () => ({ todayMin: 0, monthMin: 180, totalMin: 180 }),
    []
  );

  const ownerUserId = user?.id ?? "";

  const viewerRole = isStaff ? "teacher" : "student";

  return (
    <div className="pb-20">
      {/* ===== Header ===== */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          {/* 人型アイコン */}
          <div className="w-9 h-9 rounded-full bg-gray-100 grid place-items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-gray-700"
              aria-hidden="true"
            >
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z" />
            </svg>
          </div>

          {/* レポート文字を 1.2倍くらい・濃く */}
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-wide">
            レポート
          </h1>
        </div>

        {/* ===== Tabs (記録 / タイムライン) ===== */}
        <div className="mt-4 flex">
          <button
            className={[
              "flex-1 py-3 text-center font-semibold",
              tab === "record" ? "text-gray-900" : "text-gray-400",
            ].join(" ")}
            onClick={() => setTab("record")}
          >
            記録
          </button>
          <button
            className={[
              "flex-1 py-3 text-center font-semibold",
              tab === "timeline" ? "text-gray-900" : "text-gray-400",
            ].join(" ")}
            onClick={() => setTab("timeline")}
          >
            タイムライン
          </button>
        </div>

        {/* 下線（青） */}
        <div className="relative h-[2px] bg-gray-100 rounded-full overflow-hidden">
          <div
            className={[
              "absolute top-0 h-[2px] w-1/2 bg-blue-500 transition-transform duration-200",
              tab === "record" ? "translate-x-0" : "translate-x-full",
            ].join(" ")}
          />
        </div>
      </div>

      {/* ===== Content ===== */}
      {tab === "timeline" ? (
        <div className="px-4 mt-6">
          {/* 今は箱だけOK */}
          <div className="rounded-2xl bg-gray-100 p-5">
            <div className="text-gray-500 text-sm">（タイムラインは後で実装）</div>
          </div>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-4">
          {/* ===== 学習推移（薄灰カード／枠線なし） ===== */}
          <section className="rounded-2xl bg-gray-100 p-4">
            <div className="text-sm font-bold text-gray-800 mb-3">学習推移</div>

            {/* 画像のような “3分割” */}
            <div className="rounded-2xl bg-white/60">
              <div className="grid grid-cols-3">
                <div className="py-3 text-center">
                  <div className="text-xs text-gray-500">今日</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">
                    {minToLabel(summary.todayMin)}
                  </div>
                </div>
                <div className="py-3 text-center border-x border-white/70">
                  <div className="text-xs text-gray-500">今月</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">
                    {minToLabel(summary.monthMin)}
                  </div>
                </div>
                <div className="py-3 text-center">
                  <div className="text-xs text-gray-500">総学習時間</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">
                    {minToLabel(summary.totalMin)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 週目標 / 月間目標（薄灰カード2つ、間に余白） ===== */}
          <section className="space-y-3">
            <GoalCard title="週刊目標" targetLabel="目標：10時間" progress={0} />
            <GoalCard title="月間目標" targetLabel="目標：40時間" progress={0} />
          </section>

          {/* ===== カレンダー（薄灰カード） ===== */}
          <section className="rounded-2xl bg-gray-100 p-4">
            <div className="text-sm font-bold text-gray-800 mb-3">カレンダー</div>

            <CalendarBoard
              viewerRole={viewerRole}
              ownerUserId={ownerUserId}
              canEditPersonal={!isStaff}  // 生徒本人は個人予定OK
              canEditSchool={isStaff}     // teacher/adminだけ塾予定OK
            />
          </section>
        </div>
      )}
    </div>
  );
}

function GoalCard({
  title,
  targetLabel,
  progress,
}: {
  title: string;
  targetLabel: string;
  progress: number; // 0-100
}) {
  const p = Math.max(0, Math.min(100, progress));
  return (
    <div className="rounded-2xl bg-gray-100 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-800">{title}</div>
          <div className="mt-2 text-sm text-gray-700">{targetLabel}</div>
        </div>
        <div className="text-sm font-semibold text-gray-700">{p}%</div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
        <div className="h-2 bg-blue-500" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
