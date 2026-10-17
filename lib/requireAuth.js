import { auth } from "@clerk/nextjs/server";

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
