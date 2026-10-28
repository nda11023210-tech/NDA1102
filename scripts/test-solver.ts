// Kiểm thử thuật toán xếp TKB: npm run test:solver
import { findConflicts, mulberry32, planTimetable, preferredSlots, type Demand, type Kind, type LecturerInfo, type SchedRoom } from "../src/lib/scheduler";

let failed = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "✔" : "✘"} ${name}${detail ? ` – ${detail}` : ""}`);
  if (!cond) failed++;
};

const rooms = (lab: number, theory: number): SchedRoom[] => [
  ...Array.from({ length: lab }, (_, i) => ({ id: `LAB${i}`, type: "LAB" as const })),
  ...Array.from({ length: theory }, (_, i) => ({ id: `LT${i}`, type: "THEORY" as const })),
];
// 12 học phần: S0–S5 là Môn học (MH), S6–S11 là Mô-đun (MĐ)
const kindOf = (s: number): Kind => (s < 6 ? "MH" : "MD");
// 12 giảng viên, mỗi người đăng ký 2 môn (mỗi môn có đúng 2 người đăng ký)
const lecturers: LecturerInfo[] = Array.from({ length: 12 }, (_, i) => ({ id: `GV${i}`, registered: [`S${i}`, `S${(i + 6) % 12}`] }));

/** Tạo kế hoạch: `total` buổi rải trên 8 lớp, mỗi dòng 1–3 buổi */
function makeDemands(total: number): Demand[] {
  const out: Demand[] = [];
  let left = total;
  let k = 0;
  while (left > 0) {
    const n = Math.min(left, (k % 3) + 1);
    const s = k % 12;
    out.push({ classGroupId: `L${k % 8}`, subjectId: `S${s}`, kind: kindOf(s), sessions: n });
    left -= n;
    k++;
  }
  return out;
}

function analyse(res: ReturnType<typeof planTimetable>) {
  const asg = new Map(res.allocation.allocations.map((a) => [a.key, { id: a.key, lecturerId: a.lecturerId, classGroupId: a.classGroupId, kind: a.kind, sessionsPerWeek: a.sessions }]));
  const conflicts = findConflicts(res.entries.map((e, i) => ({ ...e, id: String(i) })), asg, rooms(5, 5));
  const perLec = new Map<string, number>();
  for (const e of res.entries) {
    const l = asg.get(e.assignmentId)!.lecturerId;
    perLec.set(l, (perLec.get(l) ?? 0) + 1);
  }
  const loads = lecturers.map((l) => perLec.get(l.id) ?? 0);
  return { conflicts: conflicts.size, min: Math.min(...loads), max: Math.max(...loads), loads };
}

// 1. Đủ nhu cầu (60 buổi = 12 GV × 5): ai cũng đúng 5 buổi
for (const seed of [1, 2, 3, 4, 5]) {
  const r = planTimetable({ demands: makeDemands(60), lecturers, rooms: rooms(5, 5), seed });
  const a = analyse(r);
  check(
    `Đủ lớp (seed ${seed}): 60 buổi, 0 xung đột, mỗi GV đúng 5 buổi`,
    r.ok && r.entries.length === 60 && a.conflicts === 0 && a.min === 5 && a.max === 5,
    `${r.stats.ms}ms · ngoài đăng ký ${r.allocation.outsideRegistrationSessions} buổi · GV không trọn buổi ${r.stats.mixedLecturers}`,
  );
}

// 2. Thiếu lớp (40 buổi cho 12 GV): chia đều, chênh lệch tối đa 1 buổi
for (const seed of [1, 2, 3]) {
  const r = planTimetable({ demands: makeDemands(40), lecturers, rooms: rooms(5, 5), seed });
  const a = analyse(r);
  check(`Thiếu lớp (seed ${seed}): chia đều 40 buổi`, r.ok && a.conflicts === 0 && a.max - a.min <= 1, `số buổi mỗi GV: ${a.loads.join(",")}`);
}

// 3. Ưu tiên môn đăng ký: khi người đăng ký đủ sức nhận, không giao môn cho người chưa đăng ký.
//    Mỗi GV đăng ký 3 môn (mỗi môn 3 người), mỗi môn cần đúng 4 buổi → 48 buổi, mỗi người 4 buổi.
{
  const wide: LecturerInfo[] = Array.from({ length: 12 }, (_, i) => ({ id: `GV${i}`, registered: [0, 4, 8].map((o) => `S${(i + o) % 12}`) }));
  const demands: Demand[] = Array.from({ length: 12 }, (_, s) => [0, 1].map((c) => ({ classGroupId: `L${(s + c * 4) % 8}`, subjectId: `S${s}`, kind: kindOf(s), sessions: 2 }))).flat();
  const r = planTimetable({ demands, lecturers: wide, rooms: rooms(5, 5), seed: 7 });
  check("Ưu tiên môn đã đăng ký", r.ok && r.allocation.outsideRegistrationSessions === 0, `ngoài đăng ký: ${r.allocation.outsideRegistrationSessions} buổi`);
}

// 4. Toàn buổi sáng hoặc toàn buổi chiều: khi tồn tại cách chia ca khả thi thì không GV nào bị tách ca
{
  let feasibleRuns = 0;
  let mixedWhenFeasible = 0;
  let mixedOther = 0;
  for (const seed of [1, 2, 3, 4, 5, 11, 12, 13, 14, 15]) {
    const r = planTimetable({ demands: makeDemands(60), lecturers, rooms: rooms(5, 5), seed });
    const asg = r.allocation.allocations.map((a) => ({ id: a.key, lecturerId: a.lecturerId, classGroupId: a.classGroupId, kind: a.kind, sessionsPerWeek: a.sessions }));
    const { overflow } = preferredSlots(asg, rooms(5, 5), mulberry32(seed));
    if (overflow === 0) {
      feasibleRuns++;
      mixedWhenFeasible += r.stats.mixedLecturers;
    } else mixedOther += r.stats.mixedLecturers;
  }
  check(
    "Mỗi GV dạy trọn buổi sáng hoặc trọn buổi chiều (khi khả thi)",
    feasibleRuns > 0 && mixedWhenFeasible === 0,
    `${feasibleRuns}/10 lần khả thi → 0 GV tách ca; các lần không khả thi: tổng ${mixedOther} GV phải tách ca`,
  );
}

// 5. Thiếu phòng: không vượt sức chứa, chia đều phần xếp được, báo phần còn thiếu
{
  const r = planTimetable({ demands: makeDemands(60), lecturers, rooms: rooms(2, 3), seed: 3 });
  const a = analyse(r);
  check(
    "Thiếu phòng: xếp tối đa 50 buổi, chia đều, báo phần thiếu",
    r.ok && r.entries.length === 50 && a.max - a.min <= 1 && r.allocation.unassigned.length > 0 && a.conflicts === 0,
    `đã xếp ${r.entries.length} buổi, GV: ${a.loads.join(",")}`,
  );
}

// 6. Phân công cố định và buổi khóa được giữ nguyên
{
  const r = planTimetable({
    demands: makeDemands(60),
    lecturers,
    rooms: rooms(5, 5),
    fixed: [{ lecturerId: "GV3", classGroupId: "L0", subjectId: "S0", kind: "MH", sessions: 2 }],
    locked: [{ lecturerId: "GV0", classGroupId: "L1", subjectId: "S1", kind: "MH", day: 4, slot: 1, roomId: "LT0" }],
    seed: 9,
  });
  const keptFixed = r.allocation.allocations.some((a) => a.key === "GV3|L0|S0" && a.fixed && a.sessions >= 2);
  const keptLock = r.entries.some((e) => e.assignmentId === "GV0|L1|S1" && e.day === 4 && e.slot === 1 && e.roomId === "LT0" && e.locked);
  check("Giữ phân công cố định và buổi đã khóa", r.ok && keptFixed && keptLock);
}

console.log(failed ? `\n${failed} kiểm thử thất bại` : "\nTất cả kiểm thử đều đạt");
process.exit(failed ? 1 : 0);
