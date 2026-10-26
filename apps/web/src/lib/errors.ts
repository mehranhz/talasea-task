"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { ApiError } from "./api";
import { AmountError } from "./money";

type Translate = (key: string, values?: Record<string, string>) => string;

export function describeError(error: unknown, translate: Translate): string {
  if (error instanceof AmountError) return translate(`amount.${error.code}`);
  if (error instanceof ApiError) {
    if (error.code === "NETWORK") return translate("network");
    const message = error.message === "REQUEST_FAILED" ? translate("requestFailed") : error.message;
    return error.requestId ? `${message} ${translate("requestId", { id: error.requestId })}` : message;
  }
  return translate("unknown");
}

export function useDescribeError(): (error: unknown) => string {
  const t = useTranslations("errors");
  return useCallback(
    (error: unknown) =>
      describeError(error, (key, values) => t(key as never, values as never)),
    [t],
  );
}
