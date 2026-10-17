import { auth } from "@clerk/nextjs/server";
import { requirePageCredits } from "@/lib/requireAuthWithTokens";

export default async function ListingGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();
  await requirePageCredits();
  return children;
}
