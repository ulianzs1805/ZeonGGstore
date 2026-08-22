import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || process.env.NEXTAUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.NEXTAUTH_GOOGLE_SECRET;
const hasGoogleConfig = Boolean(googleClientId && googleClientSecret);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  providers: hasGoogleConfig
    ? [
        GoogleProvider({
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          authorization: {
            params: {
              prompt: "select_account",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
};
