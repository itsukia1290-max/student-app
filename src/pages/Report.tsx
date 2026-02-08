// src/pages/Report.tsx
import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import ReportView from "../components/report/ReportView";
import type { CalendarPermissions } from "../components/CalendarBoard";
import { useIsStaff } from "../hooks/useIsStaff";

type Props = {
  ownerUserId?: string; // ★追加：指定があればそのユーザーのレポートを表示
  mode?: "student" | "teacher"; // ★任意：明示したい時用（基本は isStaff で決める）
  viewerRole?: "student" | "staff"; // ✅ 追加
};

export default function Report({ ownerUserId: ownerUserIdProp, mode, viewerRole }: Props) {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const ownerUserId = ownerUserIdProp ?? user?.id ?? "";
  const isSelf = ownerUserId === user?.id;

  const effectiveMode = mode ?? (isStaff && !isSelf ? "teacher" : "student");
  const effectiveViewerRole = viewerRole ?? (isStaff ? "staff" : "student");

  const calendarPermissions: CalendarPermissions = useMemo(() => {
    return {
      viewPersonal: isSelf || isStaff,
      editPersonal: isSelf,
      viewSchool: true,
      editSchool: isStaff,
    };
  }, [isStaff, isSelf]);

  return (
    <div style={{ padding: "12px" }}>
      <ReportView
        ownerUserId={ownerUserId}
        calendarPermissions={calendarPermissions}
        mode={effectiveMode}
        viewerRole={effectiveViewerRole}
        showTimeline={true}
        showGrades={true}
        showCalendar={true}
      />
    </div>
  );
}
