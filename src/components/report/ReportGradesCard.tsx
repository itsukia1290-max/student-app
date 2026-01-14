import StudentGrades from "../StudentGrades";

type Props = {
  userId: string;
  editable?: boolean;
};

export default function ReportGradesCard({ userId, editable = false }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
        成績（小テスト/問題集）
      </div>
      <StudentGrades userId={userId} editable={editable} />
    </div>
  );
}
