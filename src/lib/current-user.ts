import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { randomInt } from "node:crypto";

const NPN1_OWNER_EMAIL = "wystley6@gmail.com";

async function createStaffId(model: "adminProfile" | "devProfile" | "testerProfile") {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = String(randomInt(100000, 1000000));
    let existing = null;
    if (model === "adminProfile") existing = await prisma.adminProfile.findUnique({ where: { adminId: value } });
    if (model === "devProfile") existing = await prisma.devProfile.findUnique({ where: { devId: value } });
    if (model === "testerProfile") existing = await prisma.testerProfile.findUnique({ where: { testerId: value } });
    if (!existing) return value;
  }
  throw new Error("STAFF_ID_GENERATION_FAILED");
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const email = sessionUser?.email?.trim().toLowerCase();
  if (!email) return null;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: sessionUser?.name ?? undefined,
      avatar: sessionUser?.image ?? undefined,
    },
    create: {
      email,
      name: sessionUser?.name ?? null,
      avatar: sessionUser?.image ?? null,
    },
  });

  // Assign TESTER role if the user's email is listed in ZEON_TESTER_EMAILS and user is currently a plain USER.
  const testerEmails = (process.env.ZEON_TESTER_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (testerEmails.includes(email) && user.role === "USER") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "TESTER" } });
  }

  const npnEmail = (process.env.ZEON_NPN1_DEV_EMAIL?.trim().toLowerCase() || NPN1_OWNER_EMAIL);
  const shouldBeNpn1 = user.email === NPN1_OWNER_EMAIL && user.email === npnEmail;
  const effectiveUser = shouldBeNpn1
    ? (user.role === "NPN1_DEV" ? user : await prisma.user.update({ where: { id: user.id }, data: { role: "NPN1_DEV" } }))
    : (user.role === "NPN1_DEV" ? await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } }) : user);

  if (effectiveUser.role === "ADMIN") {
    await prisma.adminProfile.upsert({
      where: { userId: effectiveUser.id },
      update: {},
      create: { userId: effectiveUser.id, adminId: await createStaffId("adminProfile") },
    });
  }

  if (effectiveUser.role === "DEV" || effectiveUser.role === "NPN1_DEV") {
    await prisma.devProfile.upsert({
      where: { userId: effectiveUser.id },
      update: {},
      create: { userId: effectiveUser.id, devId: await createStaffId("devProfile") },
    });
  }

  if (effectiveUser.role === "TESTER") {
    await prisma.testerProfile.upsert({
      where: { userId: effectiveUser.id },
      update: {},
      create: { userId: effectiveUser.id, testerId: await createStaffId("testerProfile") },
    });
  }

  return effectiveUser;
}
