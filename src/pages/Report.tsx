/*
 * src/pages/Report.tsx
 * - 下ナビ「レポート」用
 * - ReportView を使う（showTimeline=true）
 */

import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";
import ReportView from "../components/report/ReportView"

export default function Report() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const ownerUserId = user?.id ?? "";
  const viewerRole = isStaff ? "teacher" : "student";

  return (
    <ReportView
      ownerUserId={ownerUserId}
      viewerRole={viewerRole}
      showTimeline={true}
      title="レポート"
    />
  );
}
