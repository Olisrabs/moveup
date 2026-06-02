// This page has been replaced by /dashboard/wallet
// Keeping this file to redirect any bookmarked links
import { redirect } from "next/navigation";

export default function CoinsRedirect() {
  redirect("/dashboard/wallet");
}
