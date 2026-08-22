import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getOptimizedSkinImage } from '@/lib/optimized-skin-image';

export async function GET() {
  try {
    const cases = await prisma.case.findMany({
      include: {
        drops: true
      }
    });

    const optimizedCases = cases.map((caseItem) => ({
      ...caseItem,
      drops: caseItem.drops.map((drop) => ({
        ...drop,
        image: getOptimizedSkinImage(drop.image),
      })),
    }));

    return NextResponse.json(optimizedCases);
  } catch (error) {
    console.error('Error in cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
      { status: 500 }
    );
  }
}

// ЕСЛИ У ТЕБЯ ЕСТЬ POST-ЗАПРОСЫ ДЛЯ СОЗДАНИЯ КЕЙСОВ
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { drops, ...caseData } = body;

    // Используем транзакцию для атомарного обновления
    const result = await prisma.$transaction(async (tx) => {
      // Создаём или обновляем кейс
      const newCase = await tx.case.upsert({
        where: { id: caseData.id || 'temp-id' },
        update: caseData,
        create: {
          ...caseData,
          id: caseData.id || undefined
        }
      });

      // Если есть дропы — вставляем их с пропуском дубликатов
      if (drops && drops.length > 0) {
        await tx.drop.createMany({
          data: drops.map((drop: { name: string; rarity: string; image: string; price: number; probability: number }) => ({
            ...drop,
            caseId: newCase.id
          })),
          skipDuplicates: true
        });
      }

      return newCase;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating case:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}
