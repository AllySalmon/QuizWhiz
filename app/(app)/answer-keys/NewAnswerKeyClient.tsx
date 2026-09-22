"use client";

import { useState } from "react";
import { AnswerKeyForm } from "./AnswerKeyForm";
import { createAnswerKeyAction } from "./actions";
import { ScanAnswerKeyUpload, type ScannedAnswerKey } from "./ScanAnswerKeyUpload";

// A successful scan just sets `initial` and bumps `formKey` to remount
// AnswerKeyForm with new defaultValues — its inputs are uncontrolled
// (defaultValue/defaultChecked), same as switching between "add" and "edit"
// elsewhere in this file's sibling pages, so a remount is the correct way
// to apply new prefilled values rather than fighting for control of them.
export function NewAnswerKeyClient() {
  const [initial, setInitial] = useState<ScannedAnswerKey | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <ScanAnswerKeyUpload
        onRead={(scanned) => {
          setInitial(scanned);
          setFormKey((k) => k + 1);
        }}
      />
      <AnswerKeyForm key={formKey} mode="create" action={createAnswerKeyAction} initial={initial} />
    </div>
  );
}
