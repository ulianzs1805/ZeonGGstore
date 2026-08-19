import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import AdminPanel from "./AdminPanel";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role === "USER") redirect("/account");
  const adminProfile = user.role === "ADMIN"
    ? await prisma.adminProfile.findUnique({ where: { userId: user.id }, select: { adminId: true } })
    : null;
  const devProfile = user.role !== "ADMIN"
    ? await prisma.devProfile.findUnique({ where: { userId: user.id }, select: { devId: true } })
    : null;
  return <AdminPanel role={user.role} email={user.email} staffId={adminProfile?.adminId ?? devProfile?.devId ?? null} />;
}