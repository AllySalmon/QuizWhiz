"use server";

import { redirect } from "next/navigation";
import { deleteBatch } from "@/lib/db/queries/batches";
import { deleteTestRecord } from "@/lib/db/queries/testRecords";

export async function deleteBatchAction(batchId: string) {
  await deleteBatch(batchId);
  redirect("/batches");
}

export async function deleteTestRecordAction(batchId: string, recordId: string) {
  await deleteTestRecord(recordId);
  redirect(`/batches/${batchId}`);
}
