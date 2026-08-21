import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const MAX_SUBJECT_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

    const tickets = await prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(
      { tickets },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (error) {
    console.error("GET /api/support failed", error);
    return NextResponse.json(
      {
        error: "Не удалось загрузить обращения в поддержку",
        message: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";

    if (!subject || !description) {
      return NextResponse.json({ error: "Укажите тему и описание обращения" }, { status: 400 });
    }

    if (subject.length > MAX_SUBJECT_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: "Обращение слишком длинное." },
        { status: 400 },
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: { userId: user.id, subject, description },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("POST /api/support failed", error);
    return NextResponse.json(
      {
        error: "Не удалось создать обращение в поддержку",
        message: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}
