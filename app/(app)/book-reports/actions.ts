"use server";

import { revalidatePath } from "next/cache";
import { markReceived } from "@/lib/db/queries/bookReports";

export async function markReceivedAction(id: string) {
  await markReceived(id);
  revalidatePath("/book-reports");
  revalidatePath("/");
}
