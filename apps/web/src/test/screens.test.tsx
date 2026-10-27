import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { TransferScreen } from "@/features/transfer/transfer-screen";
import { ReplayedNote, WalletScreen } from "@/features/wallet/wallet-screen";
import { WalletsScreen } from "@/features/wallets/wallets-screen";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: navigation.id }),
}));

const walletA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const walletB = "bbbbbbbbbbbbbbbbbbbbbbbb";

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function labeled(name: string) {
  return screen.getByLabelText(new RegExp(`^${name}`));
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function jsonResponse(data: unknown, replayed = false) {
  const headers = new Headers({ "content-type": "application/json" });
  if (replayed) headers.set("Idempotency-Replayed", "true");
  return new Response(JSON.stringify({ data, meta: {} }), { status: 200, headers });
}

beforeEach(() => {
  navigation.pathname = "/";
  navigation.id = walletA;
  navigation.push.mockClear();
  navigation.replace.mockClear();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("keeps a typed user id until create succeeds", async () => {
    let releaseCreate: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if ((init?.method ?? "GET") === "POST" && url.includes("/api/v1/wallets")) {
          return new Promise<Response>((resolve) => {
            releaseCreate = resolve;
          });
        }
        if (url.includes("/balance")) {
          return Promise.resolve(jsonResponse({ walletId: walletA, asset: "USD", balance: "0", version: 1 }));
        }
        return Promise.resolve(jsonResponse({ status: "ok" }));
      }),
    );
    render(wrap(<WalletsScreen />));
    fireEvent.change(labeled("User id"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create wallet" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Create wallet/ })).toHaveAttribute("aria-busy", "true"));
    expect(labeled("User id")).toHaveValue("user-1");
    releaseCreate(
      jsonResponse({
        id: walletA,
        userId: "user-1",
        asset: "USD",
        balance: "0",
        version: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    await waitFor(() => expect(labeled("User id")).toHaveValue(""));
    expect(navigation.push).toHaveBeenCalledWith(`/wallets/${walletA}`);
  });

  it("clears the list form when the home route is shown again", () => {
    const view = render(wrap(<WalletsScreen />));
    fireEvent.change(labeled("User id"), { target: { value: "keep-me" } });
    fireEvent.change(labeled("Wallet id"), { target: { value: "abc" } });
    navigation.pathname = "/transfer";
    view.rerender(wrap(<WalletsScreen />));
    expect(labeled("User id")).toHaveValue("keep-me");
    expect(labeled("Wallet id")).toHaveValue("abc");
    navigation.pathname = "/";
    view.rerender(wrap(<WalletsScreen />));
    expect(labeled("User id")).toHaveValue("");
    expect(labeled("Wallet id")).toHaveValue("");
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

  it("clears the movement error when the amount or mode changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.includes("/transactions")) return Promise.resolve(jsonResponse([]));
        if (url.includes("/balance")) {
          return Promise.resolve(jsonResponse({ walletId: walletA, asset: "USD", balance: "1000", version: 1 }));
        }
        return Promise.resolve(jsonResponse({ status: "ok" }));
      }),
    );
    render(wrap(<WalletScreen />));
    await screen.findByRole("heading", { name: (name) => name.includes("10.00") });
    fireEvent.change(labeled("Reference id"), { target: { value: "ref-1" } });
    fireEvent.change(labeled("Amount"), { target: { value: "nope" } });
    fireEvent.submit(labeled("Amount").closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an amount like 10.50.");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(labeled("Amount"), { target: { value: "nope" } });
    fireEvent.submit(labeled("Amount").closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an amount like 10.50.");
    fireEvent.change(labeled("Amount"), { target: { value: "1.00" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the amount after a successful deposit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if ((init?.method ?? "GET") === "POST" && url.includes("/deposit")) {
          return Promise.resolve(
            jsonResponse(
              {
                walletId: walletA,
                asset: "USD",
                amount: "1050",
                balance: "2050",
                referenceId: "ref-stable",
                transactionId: "tx",
                type: "DEPOSIT",
              },
              true,
            ),
          );
        }
        if (url.includes("/transactions")) return Promise.resolve(jsonResponse([]));
        if (url.includes("/balance")) {
          return Promise.resolve(jsonResponse({ walletId: walletA, asset: "USD", balance: "1000", version: 1 }));
        }
        return Promise.resolve(jsonResponse({ status: "ok" }));
      }),
    );
    render(wrap(<WalletScreen />));
    await screen.findByRole("heading", { name: (name) => name.includes("10.00") });
    fireEvent.change(labeled("Amount"), { target: { value: "10.50" } });
    fireEvent.change(labeled("Reference id"), { target: { value: "ref-stable" } });
    fireEvent.submit(labeled("Amount").closest("form")!);
    await waitFor(() => expect(labeled("Amount")).toHaveValue(""));
    expect(labeled("Reference id")).not.toHaveValue("ref-stable");
    expect(screen.getByRole("status")).toHaveTextContent("This reference was already used.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the movement form when the wallet id changes", () => {
    const view = render(wrap(<WalletScreen />));
    fireEvent.change(labeled("Amount"), { target: { value: "10.50" } });
    expect(labeled("Amount")).toHaveValue("10.50");
    navigation.id = walletB;
    view.rerender(wrap(<WalletScreen />));
    expect(labeled("Amount")).toHaveValue("");
  });

  it("clears the amount after a successful transfer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if ((init?.method ?? "GET") === "POST" && url.includes("/transfer")) {
          return Promise.resolve(
            jsonResponse({
              transferId: "transfer-1",
              referenceId: "ref-stable",
              asset: "USD",
              amount: "100",
              fromWalletId: walletA,
              toWalletId: walletB,
              fromBalance: "900",
              toBalance: "100",
              fromTransactionId: "from-tx",
              toTransactionId: "to-tx",
            }),
          );
        }
        return Promise.resolve(jsonResponse({ status: "ok" }));
      }),
    );
    render(wrap(<TransferScreen />));
    fireEvent.change(labeled("From wallet"), { target: { value: walletA } });
    fireEvent.change(labeled("To wallet"), { target: { value: walletB } });
    fireEvent.change(labeled("Amount"), { target: { value: "1.00" } });
    fireEvent.change(labeled("Reference id"), { target: { value: "ref-stable" } });
    fireEvent.submit(labeled("Amount").closest("form")!);
    await waitFor(() => expect(labeled("Amount")).toHaveValue(""));
    expect(labeled("From wallet")).toHaveValue("");
    expect(labeled("To wallet")).toHaveValue("");
    expect(labeled("Reference id")).not.toHaveValue("ref-stable");
    expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/already used/)).not.toBeInTheDocument();
  });
});
