/*
 * src/components/ui/Card.tsx
 * Responsibility: 共通カードコンポーネント（背景・枠・パディングを統一）
 */

import React from "react";

export default function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={["card", className].filter(Boolean).join(" ")}>{children}</div>;
}
