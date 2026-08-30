import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const CONFIG = {
  easy: { floors: 4, fixedMines: null, maxMultiplier: 2.5 },
  medium: { floors: 8, fixedMines: null, maxMultiplier: 4.5 },
  hard: { floors: 16, fixedMines: 4, maxMultiplier: 6.75 },
} as const;

type Difficulty = keyof typeof CONFIG;
type TowerGameState = { id: string; difficulty: string; stake: number; currentAmount: number; floor: number; minesPerFloor: number; saveAvailable: boolean; errors: number; status: string };

function validDifficulty(value: unknown): value is Difficulty { return value === "easy" || value === "medium" || value === "hard"; }
function roundAmount(value: number) { return Math.max(0, Math.floor(value)); }
function multiplierFor(game: Pick<TowerGameState, "stake" | "currentAmount">) { return game.stake > 0 ? Math.max(1, game.currentAmount / game.stake) : 1; }
function factorFor(difficulty: Difficulty, mines: number) { const config = CONFIG[difficulty]; return Math.pow(config.maxMultiplier, 1 / config.floors) ** (mines / 7); }
function generateMines(count: number) { const positions = Array.from({ length: 8 }, (_, i) => i); for (let i = positions.length - 1; i > 0; i -= 1) { const j = randomInt(i + 1); [positions[i], positions[j]] = [positions[j], positions[i]]; } return positions.slice(0, count).sort((a, b) => a - b); }
function serialize(game: TowerGameState) { const config = CONFIG[game.difficulty as Difficulty]; return { gameId: game.id, difficulty: game.difficulty, stake: game.stake, currentAmount: game.currentAmount, floor: game.floor, floors: config?.floors ?? 0, mines: game.minesPerFloor, saveAvailable: game.saveAvailable, errors: game.errors, multiplier: multiplierFor(game), status: game.status }; }

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const [balance, active] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } }),
    prisma.towerGame.findFirst({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } }),
  ]);
  return NextResponse.json({ balance: balance?.balance ?? 0, game: active ? serialize(active) : null });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown; difficulty?: unknown; stake?: unknown; gameId?: unknown; cell?: unknown; mines?: unknown; idempotencyKey?: unknown } | null;
  const action = body?.action;
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 100) : "";
  if (!idempotencyKey) return NextResponse.json({ error: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
  if (action !== "start" && action !== "pick" && action !== "cashout") return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  const previous = await prisma.operation.findUnique({ where: { idempotencyKey } });
  if (previous) return NextResponse.json({ ok: previous.status === "SUCCESS", replay: true, status: previous.status, label: previous.label });

  try {
    if (action === "start") {
      if (!validDifficulty(body?.difficulty)) throw new Error("INVALID_DIFFICULTY");
      const difficulty = body.difficulty;
      const stake = typeof body?.stake === "number" && Number.isFinite(body.stake) ? roundAmount(body.stake) : 0;
      if (stake < 10) throw new Error("MIN_STAKE_10");
      const result = await prisma.$transaction(async (tx) => {
        const active = await tx.towerGame.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { id: true } });
        if (active) throw new Error("ACTIVE_GAME_EXISTS");
        const freshUser = await tx.user.findUnique({ where: { id: user.id }, select: { balance: true } });
        if (!freshUser || freshUser.balance < stake) throw new Error("INSUFFICIENT_BALANCE");
        const updated = await tx.user.updateMany({ where: { id: user.id, balance: { gte: stake } }, data: { balance: { decrement: stake } } });
        if (updated.count !== 1) throw new Error("BALANCE_CHANGED");
        const mines = CONFIG[difficulty].fixedMines ?? 1;
        const game = await tx.towerGame.create({ data: { userId: user.id, difficulty, stake, currentAmount: stake, floor: 0, minesPerFloor: mines, minePositions: JSON.stringify(generateMines(mines)), saveAvailable: difficulty === "hard", errors: 0, status: "ACTIVE" } });
        await tx.operation.create({ data: { userId: user.id, type: "TOWER_START", amount: -stake, status: "SUCCESS", label: `Башня: старт ${difficulty}`, idempotencyKey } });
        const balance = (await tx.user.findUnique({ where: { id: user.id }, select: { balance: true } }))?.balance ?? 0;
        return { game: serialize(game), balance };
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const gameId = typeof body?.gameId === "string" ? body.gameId : "";
    if (!gameId) throw new Error("GAME_REQUIRED");

    if (action === "cashout") {
      const result = await prisma.$transaction(async (tx) => {
        const game = await tx.towerGame.findFirst({ where: { id: gameId, userId: user.id }, select: { id: true, userId: true, difficulty: true, stake: true, currentAmount: true, floor: true, minesPerFloor: true, saveAvailable: true, errors: true, status: true } });
        if (!game) throw new Error("GAME_NOT_FOUND");
        if (game.status !== "ACTIVE") throw new Error("GAME_NOT_ACTIVE");
        if (game.floor <= 0) throw new Error("CASHOUT_AFTER_FIRST_FLOOR");
        const updated = await tx.towerGame.updateMany({ where: { id: game.id, userId: user.id, status: "ACTIVE", floor: game.floor, currentAmount: game.currentAmount }, data: { status: "CASHED_OUT", minePositions: "" } });
        if (updated.count !== 1) throw new Error("GAME_STATE_CHANGED");
        await tx.user.update({ where: { id: user.id }, data: { balance: { increment: game.currentAmount } } });
        const balance = (await tx.user.findUnique({ where: { id: user.id }, select: { balance: true } }))?.balance ?? 0;
        await tx.operation.create({ data: { userId: user.id, type: "TOWER_CASHOUT", amount: game.currentAmount, status: "SUCCESS", label: `Башня: забрано ${game.currentAmount} Z`, idempotencyKey } });
        return { game: serialize({ ...game, status: "CASHED_OUT" }), balance, payout: game.currentAmount };
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.towerGame.findFirst({ where: { id: gameId, userId: user.id }, select: { id: true, userId: true, difficulty: true, stake: true, currentAmount: true, floor: true, minesPerFloor: true, minePositions: true, saveAvailable: true, errors: true, status: true } });
      if (!game) throw new Error("GAME_NOT_FOUND");
      if (game.status !== "ACTIVE") throw new Error("GAME_NOT_ACTIVE");
      const difficulty = game.difficulty as Difficulty;
      const config = CONFIG[difficulty];
      const suppliedMines = typeof body?.mines === "number" ? Math.floor(body.mines) : 0;
      const mines = config.fixedMines ?? suppliedMines;
      if (mines < 1 || mines > 7) throw new Error("MINES_MUST_BE_1_TO_7");
      const cell = typeof body?.cell === "number" ? Math.floor(body.cell) : -1;
      if (cell < 0 || cell > 7) throw new Error("INVALID_CELL");
      if (game.floor >= config.floors) throw new Error("GAME_ALREADY_FINISHED");

      let storedMines: number[];
      try { storedMines = JSON.parse(game.minePositions || "[]") as number[]; } catch { throw new Error("GAME_STATE_INVALID"); }
      // На лёгком и среднем игрок выбирает 1–7 мин на КАЖДОМ этаже. При смене выбора сервер заново создаёт карту текущего этажа.
      const minePositions = config.fixedMines === null && game.minesPerFloor !== mines ? generateMines(mines) : storedMines;
      if (minePositions.length !== mines || minePositions.some((p) => p < 0 || p > 7)) throw new Error("GAME_STATE_INVALID");
      const hitMine = minePositions.includes(cell);
      const nowAmount = game.currentAmount;
      const currentFloor = game.floor;
      let nextAmount = nowAmount;
      let nextFloor = currentFloor;
      let nextErrors = game.errors;
      let nextSave = game.saveAvailable;
      let nextStatus = "ACTIVE";
      let message = "Безопасно. Следующий этаж открыт.";

      if (hitMine) {
        nextErrors += 1;
        if (difficulty === "hard" && game.saveAvailable) { nextAmount = roundAmount(nowAmount * 0.25); nextSave = false; message = "Мина. Сейв использован: -75% от текущей суммы. Можно продолжить."; }
        else if (difficulty === "hard") { nextAmount = roundAmount(nowAmount * 0.25); nextStatus = "LOST"; message = "Вторая серьёзная ошибка. Сейвов больше нет."; }
        else { nextAmount = roundAmount(nowAmount * 0.75); message = "Мина. Потеряно 25% текущей суммы. Можно попробовать ещё раз."; }
      } else {
        nextAmount = Math.max(nowAmount, roundAmount(nowAmount * factorFor(difficulty, mines)));
        nextFloor = currentFloor + 1;
        if (nextFloor >= config.floors) { if (difficulty === "hard" && randomInt(200) === 0) nextAmount = Math.max(nextAmount, game.stake * 10); nextStatus = "COMPLETED"; }
      }

      const nextMines = config.fixedMines ?? mines;
      const nextMinePositions = nextStatus === "ACTIVE" ? JSON.stringify(generateMines(nextMines)) : "";
      const guarded = await tx.towerGame.updateMany({ where: { id: game.id, userId: user.id, status: "ACTIVE", floor: currentFloor, currentAmount: nowAmount, errors: game.errors, saveAvailable: game.saveAvailable }, data: { currentAmount: nextAmount, floor: nextFloor, minesPerFloor: nextMines, minePositions: nextMinePositions, errors: nextErrors, saveAvailable: nextSave, status: nextStatus } });
      if (guarded.count !== 1) throw new Error("GAME_STATE_CHANGED");
      await tx.operation.create({ data: { userId: user.id, type: hitMine ? "TOWER_MINE" : "TOWER_STEP", amount: 0, status: hitMine && nextStatus === "LOST" ? "FAILED" : "SUCCESS", label: `Башня: ${hitMine ? "мина" : "этаж"} ${currentFloor + 1}`, idempotencyKey } });
      let balance: number | null = null;
      if (nextStatus === "COMPLETED") {
        await tx.user.update({ where: { id: user.id }, data: { balance: { increment: nextAmount } } });
        balance = (await tx.user.findUnique({ where: { id: user.id }, select: { balance: true } }))?.balance ?? 0;
        await tx.operation.create({ data: { userId: user.id, type: "TOWER_REWARD", amount: nextAmount, status: "SUCCESS", label: `Башня: выплата ${nextAmount} Z`, idempotencyKey: `${idempotencyKey}:reward` } });
      }
      const publicGame = { ...serialize({ ...game, currentAmount: nextAmount, floor: nextFloor, minesPerFloor: nextMines, saveAvailable: nextSave, errors: nextErrors, status: nextStatus }), revealedMine: hitMine ? cell : null, message };
      return { game: publicGame, balance, payout: nextStatus === "COMPLETED" ? nextAmount : 0 };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "TOWER_FAILED";
    const status = ["INSUFFICIENT_BALANCE", "BALANCE_CHANGED", "GAME_STATE_CHANGED", "GAME_NOT_ACTIVE", "ACTIVE_GAME_EXISTS", "CASHOUT_AFTER_FIRST_FLOOR"].includes(code) ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
