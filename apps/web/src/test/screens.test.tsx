import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { ReplayedNote } from "@/features/wallet/wallet-screen";
import { WalletsScreen } from "@/features/wallets/wallets-screen";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe("screens", () => {
  it("requires a user id before creating a wallet", () => {
    render(wrap(<WalletsScreen />));
    fireEvent.click(screen.getByRole("button", { name: "Create wallet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This field is required.");
  });

  it("rejects a wallet id that is not 24 hex characters", () => {
    render(wrap(<WalletsScreen />));
    fireEvent.change(screen.getByLabelText("Wallet id"), { target: { value: "not-a-wallet" } });
    fireEvent.click(screen.getByRole("button", { name: "Open wallet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A wallet id is 24 hex characters.");
  });

  it("shows the replay message when a reference was already used", () => {
    render(wrap(<ReplayedNote replayed message="This reference was already used. The original result is shown again." />));
    expect(screen.getByRole("status")).toHaveTextContent("This reference was already used.");
  });

  it("shows both locale labels", () => {
    render(wrap(<LocaleSwitch />));
    expect(screen.getByRole("button", { name: "فارسی" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
  });
});
