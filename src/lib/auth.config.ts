import type { NextAuthConfig } from "next-auth";

// Edge-safe base config, shared by middleware (no Prisma/bcrypt allowed there)
// and the full auth.ts (which adds the Prisma adapter + Credentials provider).
export const authConfig = {
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
} satisfies NextAuthConfig;
