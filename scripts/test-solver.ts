// Kiểm thử thuật toán xếp TKB: npm run test:solver
import { findConflicts, solveTimetable, validateInput, type SchedAssignment, type SchedRoom } from "../src/lib/scheduler";

let failed = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "✔" : "✘"} ${name}${detail ? ` – ${detail}` : ""}`);
  if (!cond) failed++;
};

// Dữ liệu: 12 GV × 5 buổi = 60 buổi, 8 lớp, 5 phòng LAB + 5 phòng lý thuyết
const rooms: SchedRoom[] = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `LAB${i}`, type: "LAB" as const })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `LT${i}`, type: "THEORY" as const })),
];
const assignments: SchedAssignment[] = [];
const splits = [[3, 2], [2, 2, 1], [3, 2], [2, 3], [1, 2, 2], [3, 2], [2, 2, 1], [2, 3], [3, 2], [2, 1, 2], [3, 2], [2, 3]];
let cls = 0;
splits.forEach((parts, gv) => {
  parts.forEach((n, k) => {
    assignments.push({ id: `A${gv}-${k}`, lecturerId: `GV${gv}`, classGroupId: `L${cls++ % 8}`, kind: (gv + k) % 2 ? "MD" : "MH", sessionsPerWeek: n });
  });
});

check("Dữ liệu đầu vào hợp lệ", validateInput({ assignments, rooms }).length === 0, validateInput({ assignments, rooms }).join("; "));

for (let seed = 1; seed <= 20; seed++) {
  const r = solveTimetable({ assignments, rooms, seed });
  if (!r.ok) {
    check(`Seed ${seed}: tìm được lời giải`, false, r.errors.join("; "));
    continue;
  }
  const withIds = r.entries.map((e, i) => ({ ...e, id: String(i) }));
  const conflicts = findConflicts(withIds, new Map(assignments.map((a) => [a.id, a])), rooms);
  const perLec = new Map<string, number>();
  for (const e of r.entries) {
    const a = assignments.find((x) => x.id === e.assignmentId)!;
    perLec.set(a.lecturerId, (perLec.get(a.lecturerId) ?? 0) + 1);
  }
  const exact5 = [...perLec.values()].every((n) => n === 5) && perLec.size === 12;
  check(
    `Seed ${seed}: ${r.entries.length} buổi, 0 xung đột, mỗi GV đúng 5 buổi`,
    r.entries.length === 60 && conflicts.size === 0 && exact5,
    `${r.stats.ms}ms, ${r.stats.steps} bước, ${r.stats.lecturerDoubleDays} ngày GV dạy 2 buổi`,
  );
}

// GV sai số buổi phải bị từ chối
const bad = assignments.map((a) => (a.id === "A0-0" ? { ...a, sessionsPerWeek: 2 } : a));
check("Phát hiện GV không đủ 5 buổi", validateInput({ assignments: bad, rooms }).some((e) => e.includes("GV0")));

// Buổi khóa được giữ nguyên
const lockedRes = solveTimetable({ assignments, rooms, seed: 3, locked: [{ assignmentId: "A0-0", day: 4, slot: 1, roomId: "LT0" }] });
check(
  "Giữ nguyên buổi đã khóa",
  lockedRes.ok && lockedRes.entries.some((e) => e.assignmentId === "A0-0" && e.day === 4 && e.slot === 1 && e.roomId === "LT0" && e.locked),
);

// Thiếu phòng thực hành phải báo lỗi
const fewLabs = rooms.filter((r) => r.type === "THEORY" || r.id === "LAB0");
check("Báo lỗi khi thiếu phòng thực hành", !solveTimetable({ assignments, rooms: fewLabs }).ok);

console.log(failed ? `\n${failed} kiểm thử thất bại` : "\nTất cả kiểm thử đều đạt");
process.exit(failed ? 1 : 0);
