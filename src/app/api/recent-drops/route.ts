import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Здесь твой код получения данных
    // Например:
    const drops = await prisma.drop.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json(drops);
  } catch (error) {
    console.error('Error in recent-drops:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent drops' },
      { status: 500 }
    );
  }
}

// ЕСЛИ У ТЕБЯ ЕСТЬ POST-ЗАПРОСЫ ДЛЯ СОЗДАНИЯ ДРОПОВ, ТО ЭТА ЧАСТЬ ИХ ИСПРАВЛЯЕТ
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { caseId, name, ...rest } = body;

    // Используем upsert для предотвращения дубликатов
    const result = await prisma.drop.upsert({
      where: {
        caseId_name: {  // Составной уникальный ключ
          caseId: caseId,
          name: name
        }
      },
      update: {
        ...rest,
        updatedAt: new Date()
      },
      create: {
        caseId,
        name,
        ...rest,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating drop:', error);
    return NextResponse.json(
      { error: 'Failed to create drop' },
      { status: 500 }
    );
  }
}
