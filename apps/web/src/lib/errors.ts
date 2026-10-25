"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "./api";
import { AmountError } from "./money";

export function useDescribeError(): (error: unknown) => string {
  const t = useTranslations("errors");
  return (error: unknown) => {
    if (error instanceof AmountError) return t(`amount.${error.code}`);
    if (error instanceof ApiError) {
      if (error.code === "NETWORK") return t("network");
      const message = error.message === "REQUEST_FAILED" ? t("requestFailed") : error.message;
      return error.requestId ? `${message} ${t("requestId", { id: error.requestId })}` : message;
    }
    return t("unknown");
  };
}
