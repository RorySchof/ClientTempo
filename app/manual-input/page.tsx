import { auth } from "@clerk/nextjs/server";
import ManualInput from "@/components/manual-input/ManualInput";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";

export default async function ManualInputPage() {
  const { userId } = await auth();
  const inboundAddress = userId
    ? (await loadCreditContext(userId)).inboundAddress
    : "";

  return <ManualInput inboundAddress={inboundAddress} />;
}
