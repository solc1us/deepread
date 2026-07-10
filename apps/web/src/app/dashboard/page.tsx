import { redirect } from "next/navigation";
import type { Route } from "next";

export default async function DashboardPage() {
  redirect("/admin" as Route);
}
