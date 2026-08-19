"use client";

import { signIn, useSession } from "next-auth/react";

export default function LoginButton() {
  const { data: session } = useSession();

  if (session) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="rounded-xl bg-purple-600 px-8 py-3 text-lg font-semibold transition hover:bg-purple-500"
    >
      Войти через Google
    </button>
  );
}
