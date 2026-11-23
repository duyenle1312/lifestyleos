import { connection } from "next/server";
import { Dashboard } from "@/components/Dashboard";
import { getStats } from "@/lib/getStats";

export default async function Page() {
  await connection(); // render per request: stats must never be prerendered or cached
  const result = await getStats();
  return <Dashboard result={result} />;
}
