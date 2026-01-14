// src/pages/SchoolCalendar.tsx
import { useMemo } from "react";
import CalendarBoard from "../components/CalendarBoard";
import type { CalendarPermissions } from "../components/CalendarBoard";

import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";

export default function SchoolCalendarPage() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const ownerUserId = user?.id ?? "";

  // 塾カレンダーページの権限
  const permissions: CalendarPermissions = useMemo(() => {
    // 生徒
    if (!isStaff) {
      return {
        viewPersonal: true,
        editPersonal: true,  // 生徒は自分のpersonalを編集できる想定
        viewSchool: true,
        editSchool: false,  // 生徒は塾予定を編集不可
      };
    }

    // 先生/管理者
    return {
      viewPersonal: true,   // 先生が生徒詳細で見る場合は「その生徒のpersonalを見る」想定
      editPersonal: false,  // 生徒のpersonalは編集させない
      viewSchool: true,
      editSchool: true,     // 塾予定は編集可
    };
  }, [isStaff]);

  if (!ownerUserId) {
    return <div style={{ padding: 16 }}>ログイン情報がありません。</div>;
  }

  return (
    <div style={{ padding: "16px", paddingBottom: "80px" }}>
      <div style={{ fontSize: "22px", fontWeight: 900, marginBottom: "12px" }}>
        塾カレンダー
      </div>

      <CalendarBoard ownerUserId={ownerUserId} permissions={permissions} />
    </div>
  );
}
