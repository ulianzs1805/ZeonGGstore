import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const hasGoogleConfig = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  providers: hasGoogleConfig
    ? [
        GoogleProvider({
          clientId: process.env.AUTH_GOOGLE_ID!,
          clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    async session({ session }) {
      const email = session.user?.email?.trim().toLowerCase();
      if (email && session.user) {
        const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
        if (user) (session.user as typeof session.user & { role: string }).role = user.role;
      }
      return session;
    },
  },
};