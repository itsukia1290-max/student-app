// src/pages/Grades.tsx

import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";
import StudentGrades from "../components/StudentGrades";

export default function GradesPage() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  if (!user) {
    return (
      <div className="p-6">
        ログインしてください。
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">成績</h1>
      {/* 教師は編集可／生徒は閲覧のみ */}
      <StudentGrades userId={user.id} editable={isStaff} />
    </div>
  );
}
