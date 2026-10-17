import { auth } from "@clerk/nextjs/server";
import { requirePageCredits } from "@/lib/requireAuthWithTokens";
import RealGPTClient from "./RealGPTClient";

export default async function RealGptPage() {
  await auth.protect();
  await requirePageCredits();
  const { userId } = await auth();
  if (!userId) return null;

  return <RealGPTClient />;
}
