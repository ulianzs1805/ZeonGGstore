import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const notifications = await prisma.$transaction(async (transaction) => {
    // Serialize notification reconciliation per user so concurrent polling requests
    // cannot both create the same PAYMENT_SUCCESS notification.
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`zeon-notifications:${user.id}`}))`;

    const successfulPayments = await transaction.transaction.findMany({
      where: { userId: user.id, status: "SUCCESS", type: { in: ["DEPOSIT", "PURCHASE"] } },
      orderBy: { createdAt: "asc" },
    });
    const paymentNotificationTypes = successfulPayments.map((transaction) => `PAYMENT_SUCCESS:${transaction.id}`);
    const existingPaymentNotifications = paymentNotificationTypes.length
      ? await transaction.notification.findMany({
          where: { userId: user.id, OR: [{ type: { in: paymentNotificationTypes } }, { type: { startsWith: "PAYMENT_CLEARED:" } }] },
          select: { type: true },
        })
      : [];
    const existingPaymentTypes = new Set(existingPaymentNotifications.map((notification) => notification.type.replace("PAYMENT_CLEARED:", "PAYMENT_SUCCESS:")));
    const missingPaymentNotifications = successfulPayments.filter((payment) => !existingPaymentTypes.has(`PAYMENT_SUCCESS:${payment.id}`));

    if (missingPaymentNotifications.length) {
      await transaction.notification.createMany({
        data: missingPaymentNotifications.map((payment) => ({
          userId: user.id,
          type: `PAYMENT_SUCCESS:${payment.id}`,
          title: "Оплата успешна",
          body: `Вам зачислено ${new Intl.NumberFormat("ru-RU").format(payment.zCoinAmount)} Z.`,
        })),
      });
    }

    return transaction.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  });

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