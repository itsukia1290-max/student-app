// src/pages/Report.tsx
import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import ReportView from "../components/report/ReportView";
import type { CalendarPermissions } from "../components/CalendarBoard";
import { useIsStaff } from "../hooks/useIsStaff";

export default function Report() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();
  const role = isStaff ? "teacher" : "student";

  // 表示対象：
  // - 生徒: 自分
  // - 先生: 「生徒ページで選択した生徒」などになるはず
  // いまは仮で「生徒 = 自分」「先生 = 自分」になってるので、
  // 先生が生徒詳細で見る場合は ownerUserId を props で受け取るように変更してね。
  const ownerUserId = user?.id ?? "";

  const calendarPermissions: CalendarPermissions = useMemo(() => {
    const isSelf = ownerUserId === user?.id;

    // 要件：
    // - 個人端末に表示されるカレンダー = 塾予定 + 自分の個人予定
    // - 先生は「生徒ページから個人カレンダーを閲覧」できる（閲覧のみ、編集は本人だけ）
    return {
      viewPersonal: isSelf || isStaff, // 生徒本人 or 先生は閲覧OK
      editPersonal: isSelf,           // 個人予定の編集は本人だけ
      viewSchool: true,              // 全員が塾予定を見れる
      editSchool: isStaff,           // 塾予定編集は先生/管理者
    };
  }, [isStaff, ownerUserId, user?.id]);

  return (
    <div style={{ padding: "12px" }}>
      <ReportView
        ownerUserId={ownerUserId}
        // 学習推移は "自分" を出したいので、ReportView側で auth.uid を使う（後述）
        calendarPermissions={calendarPermissions}
        
        mode={role === "student" ? "student" : "teacher"}
        showTimeline={true}
        showGrades={true}
        showCalendar={true}
      />
    </div>
  );
}
