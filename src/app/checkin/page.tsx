import type { Metadata } from "next";
import { Checkin } from "./checkin";

export const metadata: Metadata = { title: "Check-in · Barbearia Jean Rodrigues" };

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const { origem } = await searchParams;
  return <Checkin origem={origem === "qr" ? "qr" : "totem"} />;
}
