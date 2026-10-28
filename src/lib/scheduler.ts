/**
 * Xếp thời khóa biểu – 2 giai đoạn.
 *
 * ── GIAI ĐOẠN 1: PHÂN BỔ GIẢNG VIÊN (allocateLecturers) ──────────────────────────
 * Đầu vào: kế hoạch giảng dạy của lớp (lớp × học phần × số buổi/tuần), danh sách giảng viên
 * kèm các môn họ đã đăng ký, các phân công cố định (Quản lý khoa nhập tay) và số phòng.
 * Mục tiêu theo thứ tự ưu tiên:
 *   (1) Giao môn cho người ĐÃ ĐĂNG KÝ dạy môn đó.
 *   (2) CHIA ĐỀU số buổi: mỗi người tối đa 5 buổi/tuần; khi không đủ lớp/phòng để ai cũng đủ 5 buổi
 *       thì chia sao cho chênh lệch giữa các giảng viên nhỏ nhất (tránh người 5 buổi, người 1 buổi).
 * Cách làm: tham lam theo từng buổi, NÂNG TẢI THEO TỪNG MỨC k = 1..5: chưa ai đạt k buổi thì
 * không ai được nhận buổi thứ k+1 (chênh lệch tối đa 1 buổi). Trong mỗi mức, giao môn ĐÃ ĐĂNG KÝ
 * trước; chỉ khi người đó không còn môn đăng ký nào xếp được mới giao môn khác để giữ cân bằng.
 * Một người ưu tiên dạy tiếp lớp–môn mình đã nhận (giữ trọn môn cho một người), và ưu tiên môn
 * "khan hiếm" (ít người đăng ký) để môn đó không bị người khác lấy mất.
 *
 * ── GIAI ĐOẠN 2: XẾP LỊCH TUẦN (solveTimetable) – bài toán thỏa mãn ràng buộc (CSP) ──
 * Biến:  mỗi buổi dạy cần xếp.   Miền: 10 ô (Thứ 2–6 × Sáng/Chiều).
 * Ràng buộc cứng:
 *   1. Giảng viên không dạy 2 buổi cùng một ô; tối đa 5 buổi/tuần.
 *   2. Lớp không học 2 buổi cùng một ô.
 *   3. Cùng một phân công (GV–lớp–học phần) không xếp 2 buổi trong cùng một ngày.
 *   4. Mô-đun (MĐ, 6 giờ) ở phòng thực hành; Môn học (MH, 5 giờ) ở phòng lý thuyết; không vượt số phòng.
 *   5. Các buổi đã khóa (chỉnh tay) được giữ nguyên.
 * Ràng buộc mềm (ưu tiên khi chọn ô):
 *   - Mỗi giảng viên dạy TOÀN BUỔI SÁNG hoặc TOÀN BUỔI CHIỀU (mỗi người được gán trước một buổi
 *     ưu tiên, cân bằng số phòng sáng/chiều).
 *   - Không dạy 2 buổi/ngày; lớp không học dồn trong một ngày.
 * Thuật toán: quay lui + MRV (biến ít lựa chọn nhất trước) + forward checking + khởi động lại ngẫu nhiên;
 * chạy nhiều lần và giữ lời giải ít vi phạm ràng buộc mềm nhất.
 */

export const DAY_COUNT = 5;
export const SLOT_COUNT = 2;
export const CELLS = DAY_COUNT * SLOT_COUNT;
export const MAX_PER_LECTURER = 5;

export type Kind = "MD" | "MH";
export type RoomType = "LAB" | "THEORY";

export const roomTypeFor = (k: Kind): RoomType => (k === "MD" ? "LAB" : "THEORY");
const cellOf = (day: number, slot: number) => day * SLOT_COUNT + slot;
const dayOf = (cell: number) => Math.floor(cell / SLOT_COUNT);
const slotOf = (cell: number) => cell % SLOT_COUNT;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Khóa duy nhất của một phân công: GV|lớp|học phần */
export const assignmentKey = (lecturerId: string, classGroupId: string, subjectId: string) => `${lecturerId}|${classGroupId}|${subjectId}`;

// ═══════════════════════════ GIAI ĐOẠN 1: PHÂN BỔ ═══════════════════════════

export type Demand = { classGroupId: string; subjectId: string; kind: Kind; sessions: number };
export type FixedAllocation = { lecturerId: string; classGroupId: string; subjectId: string; kind: Kind; sessions: number };
export type LecturerInfo = { id: string; registered: string[] /* subjectId */ };

export type Allocation = {
  key: string;
  lecturerId: string;
  classGroupId: string;
  subjectId: string;
  kind: Kind;
  sessions: number;
  fixed: boolean;
  outsideRegistration: boolean;
};

export type AllocateInput = {
  demands: Demand[];
  fixed?: FixedAllocation[];
  lecturers: LecturerInfo[];
  rooms: { type: RoomType }[];
  maxPerLecturer?: number;
  seed?: number;
};

export type AllocateResult = {
  allocations: Allocation[];
  unassigned: { classGroupId: string; subjectId: string; sessions: number; reason: string }[];
  loads: Record<string, number>;
  target: number; // mức chia đều mục tiêu
  outsideRegistrationSessions: number;
};

export function allocateLecturers(input: AllocateInput): AllocateResult {
  const max = input.maxPerLecturer ?? MAX_PER_LECTURER;
  const rand = mulberry32(input.seed ?? 1);
  const registered = new Map(input.lecturers.map((l) => [l.id, new Set(l.registered)]));
  const load = new Map(input.lecturers.map((l) => [l.id, 0]));

  // Sức chứa: phòng theo loại (số phòng × 10 ô), lớp (10 ô/tuần)
  const typeCap: Record<RoomType, number> = {
    LAB: input.rooms.filter((r) => r.type === "LAB").length * CELLS,
    THEORY: input.rooms.filter((r) => r.type === "THEORY").length * CELLS,
  };
  const classCap = new Map<string, number>();
  const capOfClass = (c: string) => classCap.get(c) ?? CELLS;

  const alloc = new Map<string, Allocation>();
  const add = (lecturerId: string, d: { classGroupId: string; subjectId: string; kind: Kind }, n: number, fixed: boolean) => {
    const key = assignmentKey(lecturerId, d.classGroupId, d.subjectId);
    const cur = alloc.get(key);
    if (cur) cur.sessions += n;
    else
      alloc.set(key, {
        key,
        lecturerId,
        classGroupId: d.classGroupId,
        subjectId: d.subjectId,
        kind: d.kind,
        sessions: n,
        fixed,
        outsideRegistration: !fixed && !registered.get(lecturerId)?.has(d.subjectId),
      });
    load.set(lecturerId, (load.get(lecturerId) ?? 0) + n);
    typeCap[roomTypeFor(d.kind)] -= n;
    classCap.set(d.classGroupId, capOfClass(d.classGroupId) - n);
  };

  // Nhu cầu còn lại theo lớp–môn (gộp trùng)
  const remaining = new Map<string, Demand & { left: number; id: string }>();
  for (const d of input.demands) {
    const id = `${d.classGroupId}|${d.subjectId}`;
    const r = remaining.get(id);
    if (r) r.left += d.sessions;
    else remaining.set(id, { ...d, id, left: d.sessions });
  }

  // Phân công cố định: giữ nguyên, trừ vào nhu cầu cùng lớp–môn
  for (const f of input.fixed ?? []) {
    if (!load.has(f.lecturerId)) load.set(f.lecturerId, 0);
    add(f.lecturerId, f, f.sessions, true);
    const r = remaining.get(`${f.classGroupId}|${f.subjectId}`);
    if (r) r.left = Math.max(0, r.left - f.sessions);
  }

  const lecturerIds = [...load.keys()];
  const owner = new Map<string, Set<string>>(); // demandId -> các GV đã nhận
  const sessionsOf = (lec: string, d: { classGroupId: string; subjectId: string }) =>
    alloc.get(assignmentKey(lec, d.classGroupId, d.subjectId))?.sessions ?? 0;
  const assignable = (lec: string, d: Demand & { left: number }) =>
    d.left > 0 && typeCap[roomTypeFor(d.kind)] > 0 && capOfClass(d.classGroupId) > 0 && sessionsOf(lec, d) < DAY_COUNT;
  // Số GV còn chỗ đã đăng ký môn – môn càng khan hiếm càng được ưu tiên giao sớm
  const scarcity = (subjectId: string, cap: number) =>
    lecturerIds.filter((l) => (load.get(l) ?? 0) < cap && registered.get(l)?.has(subjectId)).length;

  const pickDemand = (lec: string, onlyRegistered: boolean, cap: number) => {
    const reg = registered.get(lec) ?? new Set<string>();
    const all = [...remaining.values()].filter((d) => assignable(lec, d) && (!onlyRegistered || reg.has(d.subjectId)));
    if (!all.length) return null;
    // 1) Tiếp tục lớp–môn mình đang dạy
    const mine = all.find((d) => owner.get(d.id)?.has(lec));
    if (mine) return mine;
    // 2) Lớp–môn chưa ai nhận (giữ trọn cho một người), môn đăng ký trước, khan hiếm trước, nhiều buổi trước
    const score = (d: Demand & { left: number; id: string }) =>
      (owner.get(d.id)?.size ? 1000 : 0) + (reg.has(d.subjectId) ? 0 : 500) + scarcity(d.subjectId, cap) * 10 - d.left + rand();
    return all.sort((a, b) => score(a) - score(b))[0];
  };

  const runPhase = (onlyRegistered: boolean, cap: number) => {
    for (;;) {
      const order = lecturerIds.filter((l) => (load.get(l) ?? 0) < cap).sort((a, b) => (load.get(a)! - load.get(b)!) || rand() - 0.5);
      let progressed = false;
      for (const lec of order) {
        const d = pickDemand(lec, onlyRegistered, cap);
        if (!d) continue;
        add(lec, d, 1, false);
        d.left -= 1;
        if (!owner.has(d.id)) owner.set(d.id, new Set());
        owner.get(d.id)!.add(lec);
        progressed = true;
        break; // sắp xếp lại theo tải sau mỗi buổi để luôn ưu tiên người ít buổi nhất
      }
      if (!progressed) return;
    }
  };

  for (let level = 1; level <= max; level++) {
    runPhase(true, level);
    runPhase(false, level);
  }
  const loads = [...load.values()];
  const target = Math.min(max, Math.ceil(loads.reduce((a, b) => a + b, 0) / Math.max(1, loads.length)));

  const unassigned = [...remaining.values()]
    .filter((d) => d.left > 0)
    .map((d) => ({
      classGroupId: d.classGroupId,
      subjectId: d.subjectId,
      sessions: d.left,
      reason:
        typeCap[roomTypeFor(d.kind)] <= 0
          ? `thiếu phòng ${d.kind === "MD" ? "thực hành" : "lý thuyết"}`
          : capOfClass(d.classGroupId) <= 0
            ? "lớp đã kín 10 buổi/tuần"
            : "không còn giảng viên trống (mỗi người tối đa 5 buổi)",
    }));

  const allocations = [...alloc.values()];
  return {
    allocations,
    unassigned,
    loads: Object.fromEntries(load),
    target,
    outsideRegistrationSessions: allocations.filter((a) => a.outsideRegistration).reduce((s, a) => s + a.sessions, 0),
  };
}

// ═══════════════════════════ GIAI ĐOẠN 2: XẾP LỊCH ═══════════════════════════

export type SchedAssignment = {
  id: string;
  lecturerId: string;
  classGroupId: string;
  kind: Kind;
  sessionsPerWeek: number;
  label?: string;
};
export type SchedRoom = { id: string; type: RoomType };
export type SchedEntry = { assignmentId: string; day: number; slot: number; roomId: string; locked?: boolean };

export type SolveInput = {
  assignments: SchedAssignment[];
  rooms: SchedRoom[];
  locked?: SchedEntry[];
  maxPerLecturer?: number;
  lecturerNames?: Record<string, string>;
  classNames?: Record<string, string>;
  seed?: number;
  maxStepsPerRun?: number;
  restarts?: number;
  attempts?: number;
  /** Bắt buộc mỗi GV chỉ dạy đúng buổi ưu tiên (dùng nội bộ: thử chặt trước, nới lỏng sau) */
  strictHalfDay?: boolean;
};

export type SolveStats = {
  variables: number;
  steps: number;
  restarts: number;
  ms: number;
  lecturerDoubleDays: number; // số lần GV dạy cả sáng và chiều cùng một ngày
  mixedLecturers: number; // số GV không dạy trọn một buổi (vừa sáng vừa chiều trong tuần)
};

export type SolveResult = { ok: boolean; entries: SchedEntry[]; errors: string[]; warnings: string[]; stats: SolveStats };

/** Kiểm tra điều kiện cần trước khi giải – trả về danh sách lỗi (rỗng nếu hợp lệ) */
export function validateInput(input: SolveInput): string[] {
  const errors: string[] = [];
  const max = input.maxPerLecturer ?? MAX_PER_LECTURER;
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
  for (const [id, n] of perLecturer) if (n > max) errors.push(`Giảng viên ${ln(id)} có ${n} buổi/tuần – vượt quá tối đa ${max} buổi.`);
  for (const [id, n] of perClass) if (n > CELLS) errors.push(`Lớp ${cn(id)} có ${n} buổi/tuần – vượt quá ${CELLS} buổi khả dụng.`);
  for (const t of ["LAB", "THEORY"] as RoomType[]) {
    const rooms = input.rooms.filter((r) => r.type === t).length;
    if (perType[t] > rooms * CELLS) {
      errors.push(`Cần ${perType[t]} buổi phòng ${t === "LAB" ? "thực hành" : "lý thuyết"} nhưng chỉ có ${rooms} phòng × ${CELLS} buổi = ${rooms * CELLS}.`);
    }
  }
  return errors;
}

/**
 * Gán trước buổi ưu tiên (Sáng = 0 / Chiều = 1) cho từng giảng viên để "toàn buổi sáng hoặc toàn
 * buổi chiều" khả thi. Mỗi ca có 5 ô trong tuần nên cần:
 *   - mỗi lớp: tổng số buổi của các GV cùng ca ≤ 5,
 *   - mỗi loại phòng: tổng số buổi cùng ca ≤ số phòng × 5.
 * "Độ vượt" = tổng phần vượt các giới hạn trên. Khoa ≤ 16 GV: duyệt HẾT 2^n cách chia và lấy ngẫu nhiên
 * một cách có độ vượt nhỏ nhất. Khoa đông hơn: tìm kiếm cục bộ (đảo ca từng GV) có khởi động lại.
 * Trả về cách chia và độ vượt (0 = có thể dạy trọn buổi cho mọi GV).
 */
export function preferredSlots(assignments: SchedAssignment[], rooms: SchedRoom[], rand: () => number, fixedPref = new Map<string, number>()) {
  const lecs = [...new Set(assignments.map((a) => a.lecturerId))];
  const keyIdx = new Map<string, number>();
  const caps: number[] = [];
  const idx = (k: string, cap: number) => {
    if (!keyIdx.has(k)) {
      keyIdx.set(k, caps.length);
      caps.push(cap);
    }
    return keyIdx.get(k)!;
  };
  const roomCap: Record<RoomType, number> = {
    LAB: rooms.filter((r) => r.type === "LAB").length * DAY_COUNT,
    THEORY: rooms.filter((r) => r.type === "THEORY").length * DAY_COUNT,
  };
  // Mỗi GV: danh sách [chỉ số giới hạn, số buổi] (lớp và loại phòng)
  const contrib = lecs.map((l) => {
    const m = new Map<number, number>();
    for (const a of assignments) {
      if (a.lecturerId !== l) continue;
      for (const i of [idx(`C${a.classGroupId}`, DAY_COUNT), idx(`R${roomTypeFor(a.kind)}`, roomCap[roomTypeFor(a.kind)])]) m.set(i, (m.get(i) ?? 0) + a.sessionsPerWeek);
    }
    return [...m.entries()];
  });
  const n = lecs.length;
  const slotOfLec = (mask: number, i: number) => {
    const f = fixedPref.get(lecs[i]);
    return f ?? ((mask >> i) & 1);
  };
  const overflowOf = (slots: number[]) => {
    const used = [new Array(caps.length).fill(0), new Array(caps.length).fill(0)];
    for (let i = 0; i < n; i++) for (const [k, v] of contrib[i]) used[slots[i]][k] += v;
    let o = 0;
    for (let s = 0; s < 2; s++) for (let k = 0; k < caps.length; k++) o += Math.max(0, used[s][k] - caps[k]);
    return o;
  };

  let bestSlots: number[] = lecs.map((l) => fixedPref.get(l) ?? (rand() < 0.5 ? 0 : 1));
  let best = overflowOf(bestSlots);
  if (n <= 16) {
    let ties = 0;
    const slots = new Array(n).fill(0);
    for (let mask = 0; mask < 1 << n; mask++) {
      for (let i = 0; i < n; i++) slots[i] = slotOfLec(mask, i);
      const o = overflowOf(slots);
      if (o < best) {
        best = o;
        bestSlots = [...slots];
        ties = 1;
      } else if (o === best && rand() < 1 / ++ties) bestSlots = [...slots]; // chọn ngẫu nhiên đều trong các cách tối ưu
    }
  } else {
    for (let restart = 0; restart < 20 && best > 0; restart++) {
      const slots = lecs.map((l) => fixedPref.get(l) ?? (rand() < 0.5 ? 0 : 1));
      let cur = overflowOf(slots);
      for (let improved = true; improved && cur > 0; ) {
        improved = false;
        for (let i = 0; i < n; i++) {
          if (fixedPref.has(lecs[i])) continue;
          slots[i] = 1 - slots[i];
          const o = overflowOf(slots);
          if (o < cur) {
            cur = o;
            improved = true;
          } else slots[i] = 1 - slots[i];
        }
      }
      if (cur < best) {
        best = cur;
        bestSlots = [...slots];
      }
    }
  }
  return { pref: new Map(lecs.map((l, i) => [l, bestSlots[i]])), overflow: best };
}

/**
 * Chế độ chặt "toàn buổi sáng / toàn buổi chiều": ca của mỗi buổi đã cố định theo GV, chỉ cần chọn NGÀY.
 * Dùng thuật toán min-conflicts (tìm kiếm cục bộ): gán ngày ban đầu theo tham lam, sau đó liên tục chọn
 * một buổi đang xung đột và chuyển nó sang ngày ít xung đột nhất (thỉnh thoảng đi ngẫu nhiên để thoát
 * cực trị). Hiệu quả cho dạng bài này: mỗi GV ≤ 5 buổi trong 5 ngày ~ tô màu cạnh đồ thị hai phía.
 * Trả về ô (cell) cho từng biến, hoặc null nếu không hết xung đột sau `maxIter` bước.
 */
function minConflictsHalfDay(
  vars: SchedAssignment[],
  slotOfVar: number[],
  roomCount: Record<RoomType, number>,
  fixedCells: { a: SchedAssignment; cell: number }[],
  rand: () => number,
  maxIter: number,
): number[] | null {
  const cnt = new Map<string, number>();
  const inc = (k: string, d: number) => cnt.set(k, (cnt.get(k) ?? 0) + d);
  const keys = (a: SchedAssignment, cell: number) => [`L${a.lecturerId}|${cell}`, `C${a.classGroupId}|${cell}`, `A${a.id}|${dayOf(cell)}`, `R${roomTypeFor(a.kind)}|${cell}`];
  const put = (a: SchedAssignment, cell: number, d: number) => keys(a, cell).forEach((k) => inc(k, d));
  for (const f of fixedCells) put(f.a, f.cell, 1);

  // Số xung đột nếu biến a (đã gỡ khỏi lưới) đặt vào ô cell
  const cost = (a: SchedAssignment, cell: number) => {
    const [l, c, ad, r] = keys(a, cell);
    return (cnt.get(l) ?? 0) + (cnt.get(c) ?? 0) + (cnt.get(ad) ?? 0) + Math.max(0, (cnt.get(r) ?? 0) + 1 - roomCount[roomTypeFor(a.kind)]);
  };
  const cells: number[] = [];
  vars.forEach((a, i) => {
    let best = -1;
    let bestCost = Infinity;
    for (let d = 0; d < DAY_COUNT; d++) {
      const c = cellOf(d, slotOfVar[i]);
      const v = cost(a, c) + rand() * 0.5;
      if (v < bestCost) {
        bestCost = v;
        best = c;
      }
    }
    cells.push(best);
    put(a, best, 1);
  });

  for (let iter = 0; iter < maxIter; iter++) {
    const conflicted: number[] = [];
    vars.forEach((a, i) => {
      put(a, cells[i], -1);
      if (cost(a, cells[i]) > 0) conflicted.push(i);
      put(a, cells[i], 1);
    });
    if (!conflicted.length) return cells;
    const i = conflicted[Math.floor(rand() * conflicted.length)];
    const a = vars[i];
    put(a, cells[i], -1);
    let best = cells[i];
    if (rand() < 0.1) best = cellOf(Math.floor(rand() * DAY_COUNT), slotOfVar[i]);
    else {
      let bestCost = Infinity;
      for (let d = 0; d < DAY_COUNT; d++) {
        const c = cellOf(d, slotOfVar[i]);
        const v = cost(a, c) + rand() * 0.5;
        if (v < bestCost) {
          bestCost = v;
          best = c;
        }
      }
    }
    cells[i] = best;
    put(a, best, 1);
  }
  return null;
}

function solveOnce(input: SolveInput): SolveResult {
  const t0 = Date.now();
  const errors = validateInput(input);
  const warnings: string[] = [];
  const baseStats: SolveStats = { variables: 0, steps: 0, restarts: 0, ms: 0, lecturerDoubleDays: 0, mixedLecturers: 0 };
  if (errors.length) return { ok: false, entries: [], errors, warnings, stats: { ...baseStats, ms: Date.now() - t0 } };

  const asgById = new Map(input.assignments.map((a) => [a.id, a]));
  const roomCount: Record<RoomType, number> = {
    LAB: input.rooms.filter((r) => r.type === "LAB").length,
    THEORY: input.rooms.filter((r) => r.type === "THEORY").length,
  };
  const locked = (input.locked ?? []).filter((e) => asgById.has(e.assignmentId));

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
    // Buổi đã khóa quyết định buổi ưu tiên của giảng viên đó
    const lockedPref = new Map(locked.map((e) => [asgById.get(e.assignmentId)!.lecturerId, e.slot]));
    const { pref, overflow } = preferredSlots(input.assignments, input.rooms, rand, lockedPref);

    const lecCells = new Map<string, Set<number>>();
    const lecDayLoad = new Map<string, number[]>();
    const classCells = new Map<string, Set<number>>();
    const classDayLoad = new Map<string, number[]>();
    const asgDays = new Map<string, Set<number>>();
    const roomUse: Record<RoomType, number[]> = { LAB: Array(CELLS).fill(0), THEORY: Array(CELLS).fill(0) };

    const get = <T,>(m: Map<string, T>, k: string, init: () => T) => {
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
    // Chế độ chặt chỉ có nghĩa khi cách chia ca không vượt sức chứa; nếu vượt thì dừng ngay để chuyển sang chế độ ưu tiên
    const strict = input.strictHalfDay ?? false;
    if (strict && overflow > 0) break;
    const feasible = (a: SchedAssignment, cell: number) =>
      (!strict || slotOf(cell) === pref.get(a.lecturerId)) &&
      !lecCells.get(a.lecturerId)?.has(cell) &&
      !classCells.get(a.classGroupId)?.has(cell) &&
      !asgDays.get(a.id)?.has(dayOf(cell)) &&
      roomUse[roomTypeFor(a.kind)][cell] < roomCount[roomTypeFor(a.kind)];

    let lockConflict = false;
    for (const e of locked) {
      const a = asgById.get(e.assignmentId)!;
      const c = cellOf(e.day, e.slot);
      if (lecCells.get(a.lecturerId)?.has(c) || classCells.get(a.classGroupId)?.has(c) || asgDays.get(a.id)?.has(e.day) || roomUse[roomTypeFor(a.kind)][c] >= roomCount[roomTypeFor(a.kind)]) lockConflict = true;
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

    const vars = [...variables].sort(() => rand() - 0.5);
    const assigned: number[] = Array(vars.length).fill(-1);
    let steps = 0;

    const valueScore = (a: SchedAssignment, cell: number) => {
      const d = dayOf(cell);
      const offPref = slotOf(cell) !== pref.get(a.lecturerId) ? 100 : 0; // ưu tiên toàn sáng / toàn chiều
      const lecLoad = lecDayLoad.get(a.lecturerId)?.[d] ?? 0;
      const clsLoad = classDayLoad.get(a.classGroupId)?.[d] ?? 0;
      return offPref + lecLoad * 10 + clsLoad * 3 + rand();
    };

    const search = (depth: number): boolean => {
      if (depth === vars.length) return true;
      if (++steps > maxSteps) return false;
      let best = -1;
      let bestVals: number[] = [];
      for (let i = 0; i < vars.length; i++) {
        if (assigned[i] !== -1) continue;
        const vals: number[] = [];
        for (let c = 0; c < CELLS; c++) if (feasible(vars[i], c)) vals.push(c);
        if (vals.length === 0) return false;
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

    let solved: boolean;
    if (strict) {
      const fixedCells = locked.map((e) => ({ a: asgById.get(e.assignmentId)!, cell: cellOf(e.day, e.slot) }));
      const cells = minConflictsHalfDay(vars, vars.map((a) => pref.get(a.lecturerId) ?? 0), roomCount, fixedCells, rand, 4000);
      solved = !!cells;
      if (cells) cells.forEach((c, i) => {
        assigned[i] = c;
        place(vars[i], c, 1);
      });
      steps = 4000;
    } else solved = search(0);
    totalSteps += steps;
    if (!solved) continue;

    // Gán phòng cụ thể
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
      const c = assigned[i];
      const roomId = freeRooms.get(c)![roomTypeFor(a.kind)].shift();
      if (!roomId) throw new Error("Thiếu phòng khi gán – lỗi logic");
      entries.push({ assignmentId: a.id, day: dayOf(c), slot: slotOf(c), roomId, locked: false });
    });

    let doubleDays = 0;
    for (const loads of lecDayLoad.values()) doubleDays += loads.filter((n) => n > 1).length;
    let mixed = 0;
    for (const cells of lecCells.values()) if (new Set([...cells].map(slotOf)).size > 1) mixed++;
    if (mixed > 0) warnings.push(`${mixed} giảng viên phải dạy cả buổi sáng lẫn buổi chiều vì một số lớp có quá nhiều buổi (mỗi ca chỉ có 5 ô/tuần).`);

    return {
      ok: true,
      entries,
      errors: [],
      warnings,
      stats: { variables: vars.length, steps: totalSteps, restarts: run, ms: Date.now() - t0, lecturerDoubleDays: doubleDays, mixedLecturers: mixed },
    };
  }

  return {
    ok: false,
    entries: [],
    errors: ["Không tìm được lời giải thỏa mãn mọi ràng buộc. Hãy kiểm tra lại kế hoạch giảng dạy (số lớp, số phòng) hoặc bỏ khóa một số buổi."],
    warnings,
    stats: { ...baseStats, steps: totalSteps, restarts, ms: Date.now() - t0 },
  };
}

const softCost = (s: SolveStats) => s.mixedLecturers * 100 + s.lecturerDoubleDays;

/** Giải nhiều lần với các seed khác nhau, giữ lời giải ít vi phạm ràng buộc mềm nhất */
export function solveTimetable(input: SolveInput): SolveResult {
  const t0 = Date.now();
  const attempts = input.attempts ?? 12;
  const baseSeed = input.seed ?? Date.now();
  let best: SolveResult | null = null;
  const inputErrors = validateInput(input);
  if (inputErrors.length) return { ok: false, entries: [], errors: inputErrors, warnings: [], stats: { variables: 0, steps: 0, restarts: 0, ms: Date.now() - t0, lecturerDoubleDays: 0, mixedLecturers: 0 } };
  for (let i = 0; i < attempts; i++) {
    // Nửa đầu số lần thử: bắt buộc toàn sáng/toàn chiều (ít bước hơn); nửa sau: chỉ ưu tiên
    const strict = i < Math.ceil(attempts / 2);
    const r = solveOnce({ ...input, seed: baseSeed + i * 104729, strictHalfDay: strict, maxStepsPerRun: input.maxStepsPerRun, restarts: strict ? 8 : input.restarts });
    if (!r.ok) {
      // Ưu tiên giữ lỗi của lần thử nới lỏng (thông tin chính xác hơn lần thử chặt)
      if (!best || (!best.ok && !strict)) best = r;
      if (r.errors[0]?.startsWith("Các buổi đã khóa")) break; // khóa xung đột: thử lại cũng vô ích
      continue;
    }
    if (!best || !best.ok || softCost(r.stats) < softCost(best.stats)) best = r;
    if (softCost(best.stats) === 0) break;
  }
  best!.stats.ms = Date.now() - t0;
  return best!;
}

// ═══════════════════════════ CẢ HAI GIAI ĐOẠN ═══════════════════════════

export type LockedSession = { lecturerId: string; classGroupId: string; subjectId: string; kind: Kind; day: number; slot: number; roomId: string };

export type PlanInput = {
  demands: Demand[];
  fixed?: FixedAllocation[];
  lecturers: LecturerInfo[];
  rooms: SchedRoom[];
  locked?: LockedSession[];
  lecturerNames?: Record<string, string>;
  classNames?: Record<string, string>;
  subjectNames?: Record<string, string>;
  seed?: number;
  attempts?: number;
};

export type PlanResult = SolveResult & { allocation: AllocateResult };

/**
 * Chạy trọn quy trình: phân bổ giảng viên → xếp lịch tuần.
 * Buổi đã khóa được coi như phân công cố định (đúng GV–lớp–môn) và giữ nguyên ô thời gian.
 * Kết quả `entries[].assignmentId` là khóa `assignmentKey(...)` của phần tử tương ứng trong `allocation.allocations`.
 */
export function planTimetable(input: PlanInput): PlanResult {
  const lockedFixed = new Map<string, FixedAllocation>();
  for (const l of input.locked ?? []) {
    const k = assignmentKey(l.lecturerId, l.classGroupId, l.subjectId);
    const cur = lockedFixed.get(k);
    if (cur) cur.sessions += 1;
    else lockedFixed.set(k, { lecturerId: l.lecturerId, classGroupId: l.classGroupId, subjectId: l.subjectId, kind: l.kind, sessions: 1 });
  }
  // Phân công cố định nhập tay và buổi khóa có thể trùng GV–lớp–môn: lấy số buổi lớn hơn
  const fixed = new Map<string, FixedAllocation>();
  for (const f of input.fixed ?? []) fixed.set(assignmentKey(f.lecturerId, f.classGroupId, f.subjectId), { ...f });
  for (const [k, f] of lockedFixed) {
    const cur = fixed.get(k);
    if (!cur || cur.sessions < f.sessions) fixed.set(k, f);
  }

  const allocation = allocateLecturers({
    demands: input.demands,
    fixed: [...fixed.values()],
    lecturers: input.lecturers,
    rooms: input.rooms,
    seed: input.seed,
  });
  const ln = (id: string) => input.lecturerNames?.[id] ?? id;
  const cn = (id: string) => input.classNames?.[id] ?? id;
  const sn = (id: string) => input.subjectNames?.[id] ?? id;

  const solved = solveTimetable({
    assignments: allocation.allocations.map((a) => ({
      id: a.key,
      lecturerId: a.lecturerId,
      classGroupId: a.classGroupId,
      kind: a.kind,
      sessionsPerWeek: a.sessions,
      label: `${ln(a.lecturerId)} – ${cn(a.classGroupId)} – ${sn(a.subjectId)}`,
    })),
    rooms: input.rooms,
    locked: (input.locked ?? []).map((l) => ({ assignmentId: assignmentKey(l.lecturerId, l.classGroupId, l.subjectId), day: l.day, slot: l.slot, roomId: l.roomId })),
    lecturerNames: input.lecturerNames,
    classNames: input.classNames,
    seed: input.seed,
    attempts: input.attempts,
  });

  const warnings = [...solved.warnings];
  for (const u of allocation.unassigned) warnings.push(`Chưa xếp được ${u.sessions} buổi ${sn(u.subjectId)} lớp ${cn(u.classGroupId)}: ${u.reason}.`);
  if (allocation.outsideRegistrationSessions > 0) {
    warnings.push(`${allocation.outsideRegistrationSessions} buổi phải giao cho giảng viên chưa đăng ký môn đó (không đủ người đăng ký hoặc để chia đều).`);
  }
  return { ...solved, warnings, allocation };
}

/** Kiểm tra xung đột của toàn bộ thời khóa biểu (dùng sau khi chỉnh tay) */
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
