"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button, Glyph } from "@talasea/ui";
import { themeStorageKey } from "./theme-script";

type Theme = "light" | "dark";

function readTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onStoreChange);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Storage can be blocked; the attribute still switches the theme.
  }
}

export function ThemeSwitch() {
  const t = useTranslations("theme");
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const);

  function toggleTheme() {
    applyTheme(readTheme() === "dark" ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="choice"
      size="md"
      className="icon-tool"
      selected={theme === "dark"}
      aria-pressed={theme === "dark"}
      aria-label={t("label")}
      onClick={toggleTheme}
    >
      <Glyph icon={Sun} className="theme-icon theme-icon-sun" />
      <Glyph icon={Moon} className="theme-icon theme-icon-moon" />
    </Button>
  );
}
