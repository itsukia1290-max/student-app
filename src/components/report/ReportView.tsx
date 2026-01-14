/*
 * src/components/ReportView.tsx
 * Responsibility:
 * - 「記録(サマリー/目標/成績プレビュー/カレンダー)」と「タイムライン(任意)」をまとめた再利用ビュー
 * - Report.tsx（下ナビ）でも、StudentDetail（先生の生徒詳細）でも使える
 *
 * Props:
 * - ownerUserId: このレポート/カレンダーの対象ユーザー（生徒ならその生徒、本人なら自分）
 * - viewerRole: 表示している人の立場（student / teacher / admin）
 * - showTimeline: trueなら「記録/タイムライン」タブを表示、falseなら記録のみ
 */

import { useMemo, useState } from "react";
import { useIsStaff } from "../../hooks/useIsStaff";
import CalendarBoard from "../CalendarBoard";
import StudentGrades from "../StudentGrades";

type ViewerRole = "student" | "teacher" | "admin";

type Props = {
  ownerUserId: string;
  viewerRole: ViewerRole;
  showTimeline?: boolean;
  title?: string; // optional: "レポート" など
  subtitle?: string; // optional
};

type Summary = { todayMin: number; monthMin: number; totalMin: number };

function minToLabel(min: number) {
  if (min <= 0) return "0分";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

export default function ReportView({
  ownerUserId,
  viewerRole,
  showTimeline = true,
  title = "レポート",
  subtitle,
}: Props) {
  // NOTE:
  // - viewerRoleは「この画面を見ている人」のロール
  // - ownerUserIdは「この画面で参照する生徒/本人」のID
  const { isStaff } = useIsStaff();

  // ===== タブ（showTimeline=falseなら記録のみ） =====
  const [tab, setTab] = useState<"record" | "timeline">("record");

  // TODO: ここを study_logs など実データ集計に差し替え
  const summary: Summary = useMemo(
    () => ({ todayMin: 0, monthMin: 180, totalMin: 180 }),
    []
  );

  // ===== 目標（既存の目標バー近くに表示する方針） =====
  // ※今はプレースホルダ。後で goals テーブル等から集計に置き換え
  const weeklyGoalLabel = "目標：10時間";
  const monthlyGoalLabel = "目標：40時間";
  const weeklyProgress = 0; // 0-100
  const monthlyProgress = 0; // 0-100

  // ===== 成績（小テスト確認機能 = student_grades を利用） =====
  // Reportでは「要約」と言っていたが、まずは既存コンポーネントを
  // “折りたたみ/プレビュー”で使えるようにするのが安全。
  const [showGrades, setShowGrades] = useState(false);

  // ===== Calendar permissions（責務整理後の形） =====
  // あなたのビジョンに沿う:
  // - 生徒端末: personal(本人編集OK) + school(閲覧のみ)
  // - 先生: 生徒のpersonalは閲覧のみ / schoolは編集OK（先生側が塾予定を管理する想定）
  const calendarPermissions = useMemo(() => {
    const isStudentViewer = viewerRole === "student";
    const isTeacherViewer = viewerRole === "teacher" || viewerRole === "admin";

    // 生徒本人のレポート画面:
    //  - personal: 見る/編集OK
    //  - school: 見るOK / 編集は先生側想定（ここではOFF）
    if (isStudentViewer) {
      return {
        viewPersonal: true,
        editPersonal: true,
        viewSchool: true,
        editSchool: false,
      };
    }

    // 先生が生徒を閲覧するレポート:
    //  - personal: 見るOK / 編集NG
    //  - school: 見るOK / 編集OK（塾予定は先生が管理）
    if (isTeacherViewer) {
      return {
        viewPersonal: true,
        editPersonal: false,
        viewSchool: true,
        editSchool: true,
      };
    }

    // fallback
    return {
      viewPersonal: true,
      editPersonal: false,
      viewSchool: true,
      editSchool: false,
    };
  }, [viewerRole]);

  // ===== UI（共通スタイル：薄い水色背景に白カード） =====
  return (
    <div style={{ paddingBottom: "80px" }}>
      {/* ===== Header（任意表示） ===== */}
      <div style={{ padding: "16px 16px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9999px",
              backgroundColor: "rgba(59,130,246,0.10)",
              display: "grid",
              placeItems: "center",
              color: "#2563eb",
              fontWeight: 800,
            }}
            aria-hidden="true"
          >
            📄
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "0.2px",
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* ===== Tabs (記録 / タイムライン) ===== */}
        {showTimeline && (
          <>
            <div style={{ marginTop: "14px", display: "flex" }}>
              <button
                style={tabBtnStyle(tab === "record")}
                onClick={() => setTab("record")}
              >
                記録
              </button>
              <button
                style={tabBtnStyle(tab === "timeline")}
                onClick={() => setTab("timeline")}
              >
                タイムライン
              </button>
            </div>

            <div
              style={{
                position: "relative",
                height: "2px",
                backgroundColor: "#e5e7eb",
                borderRadius: "9999px",
                overflow: "hidden",
              }}
            >
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
          </>
        )}
      </div>

      {/* ===== Content ===== */}
      {showTimeline && tab === "timeline" ? (
        <div style={{ padding: "16px" }}>
          <Card>
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>
              （タイムラインは後で実装）
            </div>
          </Card>
        </div>
      ) : (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ===== 学習推移 ===== */}
          <Card tone="soft">
            <SectionTitle title="学習推移" />
            <div
              style={{
                borderRadius: "16px",
                backgroundColor: "rgba(255,255,255,0.65)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                overflow: "hidden",
              }}
            >
              <MiniStat label="今日" value={minToLabel(summary.todayMin)} />
              <MiniStat label="今月" value={minToLabel(summary.monthMin)} divider />
              <MiniStat label="総学習時間" value={minToLabel(summary.totalMin)} />
            </div>
          </Card>

          {/* ===== 週目標 / 月目標 ===== */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <GoalCard
              title="週刊目標"
              targetLabel={weeklyGoalLabel}
              progress={weeklyProgress}
              extraRight="（目標はあとで拡張）"
            />
            <GoalCard
              title="月間目標"
              targetLabel={monthlyGoalLabel}
              progress={monthlyProgress}
              extraRight="（目標はあとで拡張）"
            />
          </div>

          {/* ===== 成績（プレビュー：既存機能を利用） ===== */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <SectionTitle title="成績（小テスト/問題集）" />
              <button
                onClick={() => setShowGrades((v) => !v)}
                style={{
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#fff",
                  padding: "8px 12px",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                {showGrades ? "閉じる" : "確認する"}
              </button>
            </div>

            {showGrades ? (
              <div style={{ marginTop: "12px" }}>
                <StudentGrades userId={ownerUserId} editable={isStaff} />
              </div>
            ) : (
              <div style={{ marginTop: "10px", fontSize: "13px", color: "#64748b" }}>
                「確認する」で問題集の進捗を確認できます。
              </div>
            )}
          </Card>

          {/* ===== カレンダー ===== */}
          <Card tone="soft">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <SectionTitle title="カレンダー" />
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                {viewerRole === "student"
                  ? "個人=編集可 / 塾=閲覧"
                  : "個人=閲覧 / 塾=編集（先生）"}
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <CalendarBoard ownerUserId={ownerUserId} permissions={calendarPermissions} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ===================== UI parts ===================== */

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 0",
    textAlign: "center",
    fontSize: "16px",
    fontWeight: 800,
    backgroundColor: "transparent",
    border: "none",
    color: active ? "#0f172a" : "#94a3b8",
    cursor: "pointer",
  };
}

function Card({
  children,
  tone = "white",
}: {
  children: React.ReactNode;
  tone?: "white" | "soft";
}) {
  const bg = tone === "soft" ? "rgba(243,246,255,0.70)" : "#ffffff";
  return (
    <section
      style={{
        borderRadius: "18px",
        backgroundColor: bg,
        padding: "16px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: "14px", fontWeight: 900, color: "#0f172a" }}>
      {title}
    </div>
  );
}

function MiniStat({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 0",
        textAlign: "center",
        borderLeft: divider ? "1px solid rgba(255,255,255,0.75)" : undefined,
        borderRight: divider ? "1px solid rgba(255,255,255,0.75)" : undefined,
      }}
    >
      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: "4px",
          fontSize: "18px",
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function GoalCard({
  title,
  targetLabel,
  progress,
  extraRight,
}: {
  title: string;
  targetLabel: string;
  progress: number; // 0-100
  extraRight?: string;
}) {
  const p = Math.max(0, Math.min(100, progress));
  return (
    <section
      style={{
        borderRadius: "18px",
        backgroundColor: "rgba(243,246,255,0.70)",
        padding: "18px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 900, color: "#0f172a" }}>
            {title}
          </div>
          <div style={{ marginTop: "10px", fontSize: "14px", color: "#334155", fontWeight: 700 }}>
            {targetLabel}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "14px", fontWeight: 900, color: "#0f172a" }}>
            {p}%
          </div>
          {extraRight && (
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, marginTop: "4px" }}>
              {extraRight}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "14px",
          height: "8px",
          borderRadius: "9999px",
          backgroundColor: "rgba(255,255,255,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "8px",
            backgroundColor: "#3b82f6",
            width: `${p}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </section>
  );
}
