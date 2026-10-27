"use client";

import { RefreshCw } from "lucide-react";
import type { ChangeEvent } from "react";
import { Button, Field, Glyph, Input } from "@talasea/ui";

export function ReferenceDisclosure({
  label,
  hint,
  value,
  rotateLabel,
  onChange,
  onRotate,
}: {
  label: string;
  hint?: string;
  value: string;
  rotateLabel: string;
  onChange: (value: string) => void;
  onRotate: () => void;
}) {
  function changeReference(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <details className="disclosure">
      <summary>{label}</summary>
      <div className="stack-form">
        <Field label={label} hint={hint}>
          <Input
            name="referenceId"
            minLength={1}
            maxLength={128}
            value={value}
            onChange={changeReference}
          />
        </Field>
        <Button type="button" variant="text" size="sm" onClick={onRotate}>
          <Glyph icon={RefreshCw} />
          {rotateLabel}
        </Button>
      </div>
    </details>
  );
}
