import { redirect } from "next/navigation";

// "My Holdings" merged into the main PSX Portfolio page.
export default function PsxPortfolioRedirect() {
  redirect("/psx");
}
