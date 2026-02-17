import type { ReactNode } from "react";
import TeacherGradesPanel from "./TeacherGradesPanel";
import { useNav } from "../../hooks/useNav";

function SoftCard({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section
      style={{
        borderRadius: "22px",
        padding: "16px",
        background: "linear-gradient(180deg, rgba(239,246,255,0.92), rgba(255,255,255,0.92))",
        border: "1px solid rgba(59,130,246,0.14)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <div style={{ fontWeight: 900, color: "#0f172a", fontSize: "16px" }}>{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function TeacherReportView({ ownerUserId }: { ownerUserId: string }) {
  const nav = useNav();

  const subtleRightStyle: React.CSSProperties = {
    color: "#64748b",
    fontWeight: 900,
    fontSize: "12px",
    backgroundColor: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(148,163,184,0.20)",
    borderRadius: "999px",
    padding: "8px 10px",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 8,
        borderRadius: 24,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
          border: "1px solid rgba(148,163,184,0.16)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>先生用レポート</div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#64748b" }}>
          生徒の成績（問題集）と章（範囲メモ）をまとめて編集できます。
        </div>
      </div>

      <SoftCard 
        title="成績編集（問題集 / 章 / 一括操作）" 
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <span style={subtleRightStyle}>Teacher</span>
            <button
              onClick={() => {
                // まずは確実にDM画面へ遷移
                nav.setView("dm");

                // openDmWith がある環境なら生徒DMを開く（存在しなければ無視）
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (nav as any).openDmWith?.(ownerUserId);
              }}
              style={{
                ...subtleRightStyle,
                background: "linear-gradient(180deg, #53B9FF 0%, #2EA8FF 100%)",
                color: "#fff",
                border: "1px solid #7CC7FF",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              DMで伝える
            </button>
          </div>
        }
      >
        <TeacherGradesPanel ownerUserId={ownerUserId} />
      </SoftCard>
    </div>
  );
}
