import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const successfulPayments = await prisma.transaction.findMany({
    where: { userId: user.id, status: "SUCCESS", type: { in: ["DEPOSIT", "PURCHASE"] } },
    orderBy: { createdAt: "asc" },
  });
  const paymentNotificationTypes = successfulPayments.map((transaction) => `PAYMENT_SUCCESS:${transaction.id}`);
  const existingPaymentNotifications = await prisma.notification.findMany({
    where: { userId: user.id, OR: [{ type: { in: paymentNotificationTypes } }, { type: { startsWith: "PAYMENT_CLEARED:" } }] },
    select: { type: true },
  });
  const existingPaymentTypes = new Set(existingPaymentNotifications.map((notification) => notification.type.replace("PAYMENT_CLEARED:", "PAYMENT_SUCCESS:")));
  const missingPaymentNotifications = successfulPayments.filter((transaction) => !existingPaymentTypes.has(`PAYMENT_SUCCESS:${transaction.id}`));

  if (missingPaymentNotifications.length) {
    await prisma.notification.createMany({
      data: missingPaymentNotifications.map((transaction) => ({
        userId: user.id,
        type: `PAYMENT_SUCCESS:${transaction.id}`,
        title: "Оплата успешна",
        body: `Вам зачислено ${new Intl.NumberFormat("ru-RU").format(transaction.zCoinAmount)} Z.`,
      })),
    });
  }

  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return NextResponse.json({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null) as { notificationId?: unknown } | null;
  const notificationId = typeof body?.notificationId === "string" ? body.notificationId : "";
  const where = notificationId ? { id: notificationId, userId: user.id } : { userId: user.id, readAt: null };
  await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const paymentNotifications = await prisma.notification.findMany({ where: { userId: user.id, type: { startsWith: "PAYMENT_SUCCESS:" } }, select: { id: true, type: true } });
  await prisma.$transaction(async (transaction) => {
    await transaction.notification.deleteMany({ where: { userId: user.id, type: { not: { startsWith: "PAYMENT_SUCCESS:" } } } });
    for (const notification of paymentNotifications) {
      await transaction.notification.update({ where: { id: notification.id }, data: { type: notification.type.replace("PAYMENT_SUCCESS:", "PAYMENT_CLEARED:"), readAt: new Date() } });
    }
  });
  return NextResponse.json({ ok: true });
}