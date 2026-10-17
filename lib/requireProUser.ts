import { requireAuthWithTokens } from "./requireAuthWithTokens";

export async function requireProUser() {
  const result = await requireAuthWithTokens();
  if (result instanceof Response) return result;
  if (!result.pro) {
    return Response.json(
      { error: "Pro subscription required" },
      { status: 403 }
    );
  }
  return result;
}
