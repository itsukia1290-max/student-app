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
            style={{
              flex: 1,
              padding: "12px 0",
              textAlign: "center",
              fontSize: "16px",
              fontWeight: 600,
              backgroundColor: "transparent",
              border: "none",
              color: tab === "record" ? "#111827" : "#9ca3af",
              cursor: "pointer",
            }}
            onClick={() => setTab("record")}
          >
            記録
          </button>
          <button
            style={{
              flex: 1,
              padding: "12px 0",
              textAlign: "center",
              fontSize: "16px",
              fontWeight: 600,
              backgroundColor: "transparent",
              border: "none",
              color: tab === "timeline" ? "#111827" : "#9ca3af",
              cursor: "pointer",
            }}
            onClick={() => setTab("timeline")}
          >
            タイムライン
          </button>
        </div>

        {/* 下線（青） */}
        <div style={{ position: "relative", height: "2px", backgroundColor: "#f3f4f6", borderRadius: "9999px", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              height: "2px",
              width: "50%",
              backgroundColor: "#3b82f6",
              transform: tab === "record" ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.2s ease",
            }}
          />
        </div>
      </div>

      {/* ===== Content ===== */}
      {tab === "timeline" ? (
        <div style={{ padding: "0 16px", marginTop: "24px" }}>
          {/* 今は箱だけOK */}
          <div style={{ borderRadius: "1rem", backgroundColor: "#f3f4f6", padding: "20px" }}>
            <div style={{ color: "#9ca3af", fontSize: "14px" }}>（タイムラインは後で実装）</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 16px", marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ===== 学習推移（薄灰カード／枠線なし） ===== */}
          <section style={{
            borderRadius: "1rem",
            backgroundColor: "#f3f4f6",
            padding: "16px",
          }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f2937", marginBottom: "12px" }}>学習推移</div>

            {/* 画像のような "3分割" */}
            <div style={{ borderRadius: "1rem", backgroundColor: "rgba(255, 255, 255, 0.6)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div style={{ padding: "12px 0", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>今日</div>
                <div style={{ marginTop: "4px", fontSize: "18px", fontWeight: 800, color: "#111827" }}>
                  {minToLabel(summary.todayMin)}
                </div>
              </div>
              <div style={{ padding: "12px 0", textAlign: "center", borderLeft: "1px solid rgba(255, 255, 255, 0.7)", borderRight: "1px solid rgba(255, 255, 255, 0.7)" }}>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>今月</div>
                <div style={{ marginTop: "4px", fontSize: "18px", fontWeight: 800, color: "#111827" }}>
                  {minToLabel(summary.monthMin)}
                </div>
              </div>
              <div style={{ padding: "12px 0", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>総学習時間</div>
                <div style={{ marginTop: "4px", fontSize: "18px", fontWeight: 800, color: "#111827" }}>
                  {minToLabel(summary.totalMin)}
                </div>
              </div>
            </div>
          </section>

          {/* ===== 週目標 / 月間目標（薄灰カード2つ、間に余白） ===== */}
          <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <GoalCard title="週刊目標" targetLabel="目標：10時間" progress={0} />
            <GoalCard title="月間目標" targetLabel="目標：40時間" progress={0} />
          </section>

          {/* ===== カレンダー（薄灰カード） ===== */}
          <section style={{
            borderRadius: "1rem",
            backgroundColor: "#f3f4f6",
            padding: "16px",
          }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f2937", marginBottom: "12px" }}>カレンダー</div>

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
    <div style={{
      borderRadius: "1rem",
      backgroundColor: "#f3f4f6",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f2937" }}>{title}</div>
          <div style={{ marginTop: "12px", fontSize: "14px", color: "#374151" }}>{targetLabel}</div>
        </div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{p}%</div>
      </div>

      <div style={{
        height: "8px",
        borderRadius: "9999px",
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "8px",
          backgroundColor: "#3b82f6",
          width: `${p}%`,
          transition: "width 0.3s ease",
        }} />
      </div>
    </div>
  );
}
