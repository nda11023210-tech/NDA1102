/**
 * Xếp thời khóa biểu – bài toán thỏa mãn ràng buộc (CSP).
 *
 * Biến:      mỗi buổi dạy cần xếp (một phân công có `sessionsPerWeek` buổi → bấy nhiêu biến).
 * Miền:      các ô (ngày, buổi) trong tuần: Thứ 2–6 × Sáng/Chiều = 10 ô.
 * Ràng buộc cứng:
 *   1. Mỗi giảng viên dạy đúng SESSIONS_PER_LECTURER (5) buổi/tuần  → kiểm tra trước khi giải.
 *   2. Giảng viên không dạy 2 buổi cùng một ô (không trùng lịch).
 *   3. Lớp không học 2 buổi cùng một ô.
 *   4. Cùng một phân công (GV–lớp–học phần) không xếp 2 buổi trong cùng một ngày.
 *   5. Mô-đun (MĐ – buổi 6 giờ) học ở phòng thực hành (LAB); Môn học (MH – buổi 5 giờ) học ở phòng lý thuyết.
 *      Mỗi ô không dùng quá số phòng hiện có của từng loại.
 *   6. Các buổi đã "khóa" (Admin chỉnh tay) được giữ nguyên.
 * Ràng buộc mềm (ưu tiên khi chọn giá trị):
 *   - Rải đều buổi dạy của giảng viên trong tuần (hạn chế 2 buổi/ngày).
 *   - Hạn chế lớp học cả ngày nhiều hôm liên tiếp.
 *
 * Thuật toán: quay lui (backtracking) + MRV (chọn biến ít giá trị hợp lệ nhất) + forward checking,
 * thứ tự giá trị theo heuristic ràng buộc mềm, khởi động lại ngẫu nhiên (random restart) khi vượt ngưỡng.
 */

export const DAY_COUNT = 5;
export const SLOT_COUNT = 2;
export const CELLS = DAY_COUNT * SLOT_COUNT;

export type Kind = "MD" | "MH";
export type RoomType = "LAB" | "THEORY";

export type SchedAssignment = {
  id: string;
  lecturerId: string;
  classGroupId: string;
  kind: Kind;
  sessionsPerWeek: number;
  label?: string; // dùng cho thông báo lỗi
};
export type SchedRoom = { id: string; type: RoomType };
export type SchedEntry = { assignmentId: string; day: number; slot: number; roomId: string; locked?: boolean };

export type SolveInput = {
  assignments: SchedAssignment[];
  rooms: SchedRoom[];
  locked?: SchedEntry[];
  requiredPerLecturer?: number; // mặc định 5
  lecturerNames?: Record<string, string>;
  classNames?: Record<string, string>;
  seed?: number;
  maxStepsPerRun?: number;
  restarts?: number;
};

export type SolveResult = {
  ok: boolean;
  entries: SchedEntry[];
  errors: string[];
  warnings: string[];
  stats: { variables: number; steps: number; restarts: number; ms: number; lecturerDoubleDays: number };
};

const roomTypeFor = (k: Kind): RoomType => (k === "MD" ? "LAB" : "THEORY");
const cellOf = (day: number, slot: number) => day * SLOT_COUNT + slot;
const dayOf = (cell: number) => Math.floor(cell / SLOT_COUNT);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kiểm tra điều kiện cần trước khi giải – trả về danh sách lỗi (rỗng nếu hợp lệ) */
export function validateInput(input: SolveInput): string[] {
  const errors: string[] = [];
  const required = input.requiredPerLecturer ?? 5;
  const ln = (id: string) => input.lecturerNames?.[id] ?? id;
  const cn = (id: string) => input.classNames?.[id] ?? id;

  const perLecturer = new Map<string, number>();
  const perClass = new Map<string, number>();
  const perType: Record<RoomType, number> = { LAB: 0, THEORY: 0 };
  for (const a of input.assignments) {
    if (a.sessionsPerWeek < 1) continue;
    perLecturer.set(a.lecturerId, (perLecturer.get(a.lecturerId) ?? 0) + a.sessionsPerWeek);
    perClass.set(a.classGroupId, (perClass.get(a.classGroupId) ?? 0) + a.sessionsPerWeek);
    perType[roomTypeFor(a.kind)] += a.sessionsPerWeek;
    if (a.sessionsPerWeek > DAY_COUNT) errors.push(`Phân công ${a.label ?? a.id} có ${a.sessionsPerWeek} buổi/tuần – vượt quá ${DAY_COUNT} ngày (mỗi ngày tối đa 1 buổi).`);
  }
  for (const [id, n] of perLecturer) {
    if (n !== required) errors.push(`Giảng viên ${ln(id)} được phân công ${n} buổi/tuần – quy định là đúng ${required} buổi.`);
  }
  for (const [id, n] of perClass) {
    if (n > CELLS) errors.push(`Lớp ${cn(id)} có ${n} buổi/tuần – vượt quá ${CELLS} buổi khả dụng.`);
  }
  for (const t of ["LAB", "THEORY"] as RoomType[]) {
    const rooms = input.rooms.filter((r) => r.type === t).length;
    if (perType[t] > rooms * CELLS) {
      errors.push(`Cần ${perType[t]} buổi phòng ${t === "LAB" ? "thực hành" : "lý thuyết"} nhưng chỉ có ${rooms} phòng × ${CELLS} buổi = ${rooms * CELLS}.`);
    }
  }
  return errors;
}

function solveOnce(input: SolveInput): SolveResult {
  const t0 = Date.now();
  const errors = validateInput(input);
  const warnings: string[] = [];
  const baseStats = { variables: 0, steps: 0, restarts: 0, ms: 0, lecturerDoubleDays: 0 };
  if (errors.length) return { ok: false, entries: [], errors, warnings, stats: { ...baseStats, ms: Date.now() - t0 } };

  const asgById = new Map(input.assignments.map((a) => [a.id, a]));
  const roomCount: Record<RoomType, number> = {
    LAB: input.rooms.filter((r) => r.type === "LAB").length,
    THEORY: input.rooms.filter((r) => r.type === "THEORY").length,
  };
  const locked = (input.locked ?? []).filter((e) => asgById.has(e.assignmentId));

  // Số buổi còn phải xếp cho từng phân công (trừ buổi đã khóa)
  const lockedCount = new Map<string, number>();
  for (const e of locked) lockedCount.set(e.assignmentId, (lockedCount.get(e.assignmentId) ?? 0) + 1);
  const variables: SchedAssignment[] = [];
  for (const a of input.assignments) {
    const remaining = a.sessionsPerWeek - (lockedCount.get(a.id) ?? 0);
    if (remaining < 0) warnings.push(`Phân công ${a.label ?? a.id} có nhiều buổi khóa hơn số buổi/tuần.`);
    for (let i = 0; i < remaining; i++) variables.push(a);
  }

  const maxSteps = input.maxStepsPerRun ?? 60_000;
  const restarts = input.restarts ?? 40;
  let totalSteps = 0;

  for (let run = 0; run <= restarts; run++) {
    const rand = mulberry32((input.seed ?? Date.now()) + run * 7919);

    // ── Trạng thái ──
    const lecCells = new Map<string, Set<number>>();
    const lecDayLoad = new Map<string, number[]>();
    const classCells = new Map<string, Set<number>>();
    const classDayLoad = new Map<string, number[]>();
    const asgDays = new Map<string, Set<number>>();
    const roomUse: Record<RoomType, number[]> = { LAB: Array(CELLS).fill(0), THEORY: Array(CELLS).fill(0) };

    const get = <T>(m: Map<string, T>, k: string, init: () => T) => {
      let v = m.get(k);
      if (!v) m.set(k, (v = init()));
      return v;
    };
    const place = (a: SchedAssignment, cell: number, sign: 1 | -1) => {
      const d = dayOf(cell);
      const lc = get(lecCells, a.lecturerId, () => new Set<number>());
      const cc = get(classCells, a.classGroupId, () => new Set<number>());
      const ad = get(asgDays, a.id, () => new Set<number>());
      if (sign === 1) {
        lc.add(cell);
        cc.add(cell);
        ad.add(d);
      } else {
        lc.delete(cell);
        cc.delete(cell);
        ad.delete(d);
      }
      get(lecDayLoad, a.lecturerId, () => Array(DAY_COUNT).fill(0))[d] += sign;
      get(classDayLoad, a.classGroupId, () => Array(DAY_COUNT).fill(0))[d] += sign;
      roomUse[roomTypeFor(a.kind)][cell] += sign;
    };
    const feasible = (a: SchedAssignment, cell: number) =>
      !lecCells.get(a.lecturerId)?.has(cell) &&
      !classCells.get(a.classGroupId)?.has(cell) &&
      !asgDays.get(a.id)?.has(dayOf(cell)) &&
      roomUse[roomTypeFor(a.kind)][cell] < roomCount[roomTypeFor(a.kind)];

    // Đặt các buổi đã khóa
    let lockConflict = false;
    for (const e of locked) {
      const a = asgById.get(e.assignmentId)!;
      const c = cellOf(e.day, e.slot);
      if (!feasible(a, c)) lockConflict = true;
      place(a, c, 1);
    }
    if (lockConflict) {
      return {
        ok: false,
        entries: [],
        errors: ["Các buổi đã khóa đang xung đột với nhau (trùng giảng viên, lớp hoặc vượt số phòng). Hãy mở khóa bớt rồi xếp lại."],
        warnings,
        stats: { ...baseStats, ms: Date.now() - t0 },
      };
    }

    // Xáo trộn thứ tự biến ban đầu để mỗi lần chạy khác nhau
    const vars = [...variables].sort(() => rand() - 0.5);
    const assigned: (number | -1)[] = Array(vars.length).fill(-1);
    let steps = 0;

    const valueScore = (a: SchedAssignment, cell: number) => {
      const d = dayOf(cell);
      const lecLoad = lecDayLoad.get(a.lecturerId)?.[d] ?? 0;
      const clsLoad = classDayLoad.get(a.classGroupId)?.[d] ?? 0;
      // Ưu tiên ngày GV còn trống, rồi ngày lớp ít buổi; thêm nhiễu nhỏ để đa dạng
      return lecLoad * 10 + clsLoad * 3 + rand();
    };

    const search = (depth: number): boolean => {
      if (depth === vars.length) return true;
      if (++steps > maxSteps) return false;

      // MRV: chọn biến chưa gán có ít ô hợp lệ nhất
      let best = -1;
      let bestVals: number[] = [];
      for (let i = 0; i < vars.length; i++) {
        if (assigned[i] !== -1) continue;
        const vals: number[] = [];
        for (let c = 0; c < CELLS; c++) if (feasible(vars[i], c)) vals.push(c);
        if (vals.length === 0) return false; // forward checking: ngõ cụt
        if (best === -1 || vals.length < bestVals.length) {
          best = i;
          bestVals = vals;
          if (vals.length === 1) break;
        }
      }
      const a = vars[best];
      const ordered = bestVals.map((c) => [c, valueScore(a, c)] as const).sort((x, y) => x[1] - y[1]);
      for (const [c] of ordered) {
        place(a, c, 1);
        assigned[best] = c;
        if (search(depth + 1)) return true;
        place(a, c, -1);
        assigned[best] = -1;
        if (steps > maxSteps) return false;
      }
      return false;
    };

    const solved = search(0);
    totalSteps += steps;
    if (!solved) continue;

    // ── Gán phòng cụ thể cho từng ô ──
    const freeRooms = new Map<number, Record<RoomType, string[]>>();
    for (let c = 0; c < CELLS; c++) {
      freeRooms.set(c, {
        LAB: input.rooms.filter((r) => r.type === "LAB").map((r) => r.id),
        THEORY: input.rooms.filter((r) => r.type === "THEORY").map((r) => r.id),
      });
    }
    const entries: SchedEntry[] = [];
    for (const e of locked) {
      const pool = freeRooms.get(cellOf(e.day, e.slot))!;
      for (const t of ["LAB", "THEORY"] as RoomType[]) pool[t] = pool[t].filter((id) => id !== e.roomId);
      entries.push({ ...e, locked: true });
    }
    vars.forEach((a, i) => {
      const c = assigned[i] as number;
      const pool = freeRooms.get(c)![roomTypeFor(a.kind)];
      const roomId = pool.shift();
      if (!roomId) throw new Error("Thiếu phòng khi gán – lỗi logic");
      entries.push({ assignmentId: a.id, day: dayOf(c), slot: c % SLOT_COUNT, roomId, locked: false });
    });

    let doubleDays = 0;
    for (const loads of lecDayLoad.values()) doubleDays += loads.filter((n) => n > 1).length;
    if (doubleDays > 0) warnings.push(`${doubleDays} trường hợp giảng viên dạy cả sáng và chiều trong cùng một ngày.`);

    return {
      ok: true,
      entries,
      errors: [],
      warnings,
      stats: { variables: vars.length, steps: totalSteps, restarts: run, ms: Date.now() - t0, lecturerDoubleDays: doubleDays },
    };
  }

  return {
    ok: false,
    entries: [],
    errors: ["Không tìm được lời giải thỏa mãn mọi ràng buộc. Hãy kiểm tra lại phân công (số lớp, số phòng) hoặc bỏ khóa một số buổi."],
    warnings,
    stats: { ...baseStats, steps: totalSteps, restarts, ms: Date.now() - t0 },
  };
}

/** Kiểm tra xung đột của toàn bộ thời khóa biểu (dùng sau khi Admin chỉnh tay) */
export function findConflicts(entries: (SchedEntry & { id: string })[], asgById: Map<string, SchedAssignment>, rooms: SchedRoom[]) {
  const conflicts = new Map<string, string[]>();
  const add = (id: string, msg: string) => conflicts.set(id, [...(conflicts.get(id) ?? []), msg]);
  const roomType = new Map(rooms.map((r) => [r.id, r.type]));
  const byCell = new Map<number, (SchedEntry & { id: string })[]>();
  for (const e of entries) byCell.set(cellOf(e.day, e.slot), [...(byCell.get(cellOf(e.day, e.slot)) ?? []), e]);

  for (const list of byCell.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = asgById.get(list[i].assignmentId)!;
        const b = asgById.get(list[j].assignmentId)!;
        if (a.lecturerId === b.lecturerId) {
          add(list[i].id, "Trùng lịch giảng viên");
          add(list[j].id, "Trùng lịch giảng viên");
        }
        if (a.classGroupId === b.classGroupId) {
          add(list[i].id, "Trùng lịch lớp");
          add(list[j].id, "Trùng lịch lớp");
        }
        if (list[i].roomId === list[j].roomId) {
          add(list[i].id, "Trùng phòng");
          add(list[j].id, "Trùng phòng");
        }
      }
    }
  }
  for (const e of entries) {
    const a = asgById.get(e.assignmentId);
    if (a && roomType.get(e.roomId) !== roomTypeFor(a.kind)) add(e.id, a.kind === "MD" ? "Mô-đun cần phòng thực hành" : "Môn học cần phòng lý thuyết");
  }
  const sameDay = new Map<string, (SchedEntry & { id: string })[]>();
  for (const e of entries) {
    const k = `${e.assignmentId}:${e.day}`;
    sameDay.set(k, [...(sameDay.get(k) ?? []), e]);
  }
  for (const list of sameDay.values()) if (list.length > 1) list.forEach((e) => add(e.id, "Cùng học phần 2 buổi trong một ngày"));
  return conflicts;
}

/**
 * Giải nhiều lần với các seed khác nhau và giữ lời giải tốt nhất theo ràng buộc mềm
 * (ít ngày giảng viên phải dạy cả sáng lẫn chiều nhất).
 */
export function solveTimetable(input: SolveInput & { attempts?: number }): SolveResult {
  const t0 = Date.now();
  const attempts = input.attempts ?? 12;
  const baseSeed = input.seed ?? Date.now();
  let best: SolveResult | null = null;
  for (let i = 0; i < attempts; i++) {
    const r = solveOnce({ ...input, seed: baseSeed + i * 104729 });
    if (!r.ok) {
      if (!best) best = r;
      // Lỗi đầu vào/khóa xung đột: không cần thử lại
      if (r.stats.variables === 0 && i === 0) break;
      continue;
    }
    if (!best || !best.ok || r.stats.lecturerDoubleDays < best.stats.lecturerDoubleDays) best = r;
    if (best.stats.lecturerDoubleDays === 0) break;
  }
  best!.stats.ms = Date.now() - t0;
  return best!;
}
