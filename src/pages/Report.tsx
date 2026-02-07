// src/pages/Report.tsx
import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import ReportView from "../components/report/ReportView";
import type { CalendarPermissions } from "../components/CalendarBoard";
import { useIsStaff } from "../hooks/useIsStaff";

type Props = {
  ownerUserId?: string; // ★追加：指定があればそのユーザーのレポートを表示
  mode?: "student" | "teacher"; // ★任意：明示したい時用（基本は isStaff で決める）
};

export default function Report({ ownerUserId: ownerUserIdProp, mode }: Props) {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const ownerUserId = ownerUserIdProp ?? user?.id ?? "";
  const effectiveMode = mode ?? (isStaff ? "teacher" : "student");

  const calendarPermissions: CalendarPermissions = useMemo(() => {
    const isSelf = ownerUserId === user?.id;
    return {
      viewPersonal: isSelf || isStaff,
      editPersonal: isSelf,
      viewSchool: true,
      editSchool: isStaff,
    };
  }, [isStaff, ownerUserId, user?.id]);

  return (
    <div style={{ padding: "12px" }}>
      <ReportView
        ownerUserId={ownerUserId}
        calendarPermissions={calendarPermissions}
        mode={effectiveMode}
        showTimeline={true}
        showGrades={true}
        showCalendar={true}
      />
    </div>
  );
}
