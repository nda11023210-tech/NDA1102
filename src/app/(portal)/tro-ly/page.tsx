import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { db } from "@/lib/db";
import { ChatBox } from "./chat-box";

export const metadata = { title: "Trợ lý AI" };

export default async function AssistantPage() {
  const user = await requireUser();
  const [count, categories] = await Promise.all([
    db.kbArticle.count(),
    db.kbArticle.groupBy({ by: ["category"], _count: true, orderBy: { category: "asc" } }),
  ]);
  return (
    <ChatBox
      userName={user.name}
      ai={aiEnabled()}
      kbCount={count}
      categories={categories.map((c) => c.category)}
      suggestions={[
        "Thủ tục xin nghỉ phép năm như thế nào?",
        "Quy định về số giờ giảng chuẩn của giảng viên?",
        "Cách đăng ký mượn máy chiếu?",
        "Giảng viên mới cần chuẩn bị hồ sơ giảng dạy gì?",
      ]}
    />
  );
}
