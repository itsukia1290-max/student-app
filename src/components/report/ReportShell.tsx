import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export default function ReportShell({ title, subtitle, right, children }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 18 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
              {subtitle}
            </div>
          )}
        </div>

        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>

      {children}
    </div>
  );
}
