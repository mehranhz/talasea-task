import { dehydrate, HydrationBoundary, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { TransferScreen } from "@/features/transfer/transfer-screen";
import { ReplayedNote, WalletScreen } from "@/features/wallet/wallet-screen";
import { WalletsScreen } from "@/features/wallets/wallets-screen";
import { createRequestQueryClient, prefetchBalances } from "@/lib/prefetch-wallets";
import { queryKeys } from "@/lib/query-keys";
import { fetchBalance, fetchLedgerPage } from "@/lib/wallet-reads";

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
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
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

function errorResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message, details: {} }, meta: { requestId: "req-1" } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function walletCookie(): string {
  const prefix = "talasea.wallets=";
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!entry) return "";
  const value = entry.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function rememberDevice(wallets: { id: string; userId: string; asset: string }[]) {
  const raw = JSON.stringify(wallets);
  localStorage.setItem("talasea.wallets", raw);
  document.cookie = `talasea.wallets=${encodeURIComponent(raw)}; Path=/`;
}

function revealReference() {
  const summary = document.querySelector("details > summary");
  if (!(summary instanceof HTMLElement)) throw new Error("missing reference disclosure");
  expect(summary.parentElement).not.toHaveAttribute("open");
  fireEvent.click(summary);
}

function revealOpenById() {
  fireEvent.click(screen.getByRole("button", { name: "Open by id" }));
}

const originalClipboard = navigator.clipboard;

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

beforeEach(() => {
  navigation.pathname = "/";
  navigation.id = walletA;
  navigation.push.mockClear();
  navigation.replace.mockClear();
  localStorage.clear();
  document.cookie = "talasea.wallets=; Path=/; Max-Age=0";
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  });
});

describe("screens", () => {
  it("requires a user id before creating a wallet", () => {
    render(wrap(<WalletsScreen />));
    expect(screen.queryByText(/API is/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create wallet" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This field is required.");
  });

  it("rejects a wallet id that is not 24 hex characters", () => {
    render(wrap(<WalletsScreen />));
    revealOpenById();
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
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/wallets/${walletA}`));
    expect(screen.queryByLabelText("User id")).not.toBeInTheDocument();
    expect(screen.getByText("user-1")).toBeInTheDocument();
  });

  it("clears the list form when the home route is shown again", () => {
    const view = render(wrap(<WalletsScreen />));
    revealOpenById();
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

  it("copies a wallet id without opening the wallet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        const id = url.includes(walletB) ? walletB : walletA;
        return Promise.resolve(jsonResponse({ walletId: id, asset: "USD", balance: "1000", version: 1 }));
      }),
    );
    const saved = [
      { id: walletA, userId: "ada", asset: "USD" },
      { id: walletB, userId: "grace", asset: "EUR" },
    ];
    localStorage.setItem("talasea.wallets", JSON.stringify(saved));
    render(wrap(<WalletsScreen initialWallets={saved} />));
    expect(screen.queryByText(walletA)).not.toBeInTheDocument();
    expect(screen.queryByText(walletB)).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /ada/ });
    expect(link).toHaveAttribute("href", `/wallets/${walletA}`);
    const followed = vi.fn();
    link.addEventListener("click", (event) => {
      event.preventDefault();
      followed();
    });
    const copyGrace = screen.getAllByRole("button", { name: "Copy wallet address" })[1];
    if (!copyGrace) throw new Error("missing copy control");
    fireEvent.click(copyGrace);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(walletB));
    expect(followed).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    const copied = await screen.findByText("Copied");
    expect(copied).toHaveAttribute("role", "status");
    expect(copied).toHaveAttribute("aria-live", "polite");
    fireEvent.click(link);
    expect(followed).toHaveBeenCalledTimes(1);
  });

  it("shows a translated error when copying a wallet id fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    mockClipboard(writeText);
    localStorage.setItem("talasea.wallets", JSON.stringify([{ id: walletA, userId: "ada", asset: "USD" }]));
    render(wrap(<WalletsScreen initialWallets={[{ id: walletA, userId: "ada", asset: "USD" }]} />));
    fireEvent.click(screen.getByRole("button", { name: "Copy wallet address" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy.");
    expect(screen.queryByText(walletA)).not.toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(walletA);
  });

  it("shows a translated error when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    localStorage.setItem("talasea.wallets", JSON.stringify([{ id: walletA, userId: "ada", asset: "USD" }]));
    render(wrap(<WalletsScreen initialWallets={[{ id: walletA, userId: "ada", asset: "USD" }]} />));
    fireEvent.click(screen.getByRole("button", { name: "Copy wallet address" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy.");
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
    expect(screen.queryByText(/minor units/)).not.toBeInTheDocument();
    revealReference();
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
    revealReference();
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
    expect(screen.getByRole("textbox", { name: "From wallet" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "From wallet" })).not.toBeInTheDocument();
    revealReference();
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
    expect(screen.queryByText("transfer-1")).not.toBeInTheDocument();
  });

  it("keeps one sender control until an id is typed", () => {
    localStorage.setItem("talasea.wallets", JSON.stringify([{ id: walletA, userId: "ada", asset: "USD" }]));
    render(wrap(<TransferScreen />));
    expect(screen.getByRole("combobox", { name: "From wallet" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "From wallet" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "From wallet" }), { target: { value: "type-id" } });
    expect(screen.getByRole("textbox", { name: "Type an id" })).toBeInTheDocument();
  });

  it("paints a prefetched wallet in the server html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.includes("/transactions")) {
          return Promise.resolve(
            jsonResponse([
              {
                id: "tx-1",
                walletId: walletA,
                type: "DEPOSIT",
                direction: "CREDIT",
                asset: "USD",
                amount: "500",
                balanceAfter: "1000",
                referenceId: "ref-should-hide",
                createdAt: "2026-01-02T00:00:00.000Z",
              },
            ]),
          );
        }
        return Promise.resolve(jsonResponse({ walletId: walletA, asset: "USD", balance: "1000", version: 1 }));
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await client.prefetchQuery({
      queryKey: queryKeys.balance(walletA),
      queryFn: () => fetchBalance(walletA),
    });
    await client.prefetchInfiniteQuery({
      queryKey: queryKeys.ledger(walletA, ""),
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }) => fetchLedgerPage(walletA, "", pageParam),
    });
    const saved = [{ id: walletA, userId: "ada", asset: "USD" }];
    const walletHtml = renderToString(
      wrap(
        <HydrationBoundary state={dehydrate(client)}>
          <WalletScreen initialWallets={saved} />
        </HydrationBoundary>,
      ),
    );
    expect(walletHtml).toMatch(/10\.00/);
    expect(walletHtml).toContain("ada");
    expect(walletHtml).toContain("Deposit");
    expect(walletHtml).not.toContain("ref-should-hide");
    expect(walletHtml).not.toMatch(/<details[^>]*\sopen/);

    const homeHtml = renderToString(
      wrap(
        <HydrationBoundary state={dehydrate(client)}>
          <WalletsScreen initialWallets={saved} />
        </HydrationBoundary>,
      ),
    );
    expect(homeHtml).toContain("ada");
    expect(homeHtml).toMatch(/10\.00/);
    expect(homeHtml).not.toContain("API is");
    expect(homeHtml).not.toContain("Unavailable");
  });

  it("drops a saved wallet when its balance is missing and keeps the rest", async () => {
    const saved = [
      { id: walletA, userId: "ada", asset: "USD" },
      { id: walletB, userId: "grace", asset: "EUR" },
    ];
    rememberDevice(saved);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.includes(walletA)) return Promise.resolve(errorResponse(404, "WALLET_NOT_FOUND", "Wallet not found"));
        return Promise.resolve(jsonResponse({ walletId: walletB, asset: "EUR", balance: "2500", version: 1 }));
      }),
    );
    render(wrap(<WalletsScreen initialWallets={saved} />));
    await waitFor(() => expect(screen.queryByRole("link", { name: /ada/ })).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: /grace/ })).toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy wallet address" })).toBeInTheDocument();
    const kept = [{ id: walletB, userId: "grace", asset: "EUR" }];
    expect(localStorage.getItem("talasea.wallets")).toBe(JSON.stringify(kept));
    expect(walletCookie()).toBe(JSON.stringify(kept));
    expect(walletCookie()).not.toContain(walletA);
  });

  it("shows the empty state when every saved wallet is missing", async () => {
    const saved = [{ id: walletA, userId: "ada", asset: "USD" }];
    rememberDevice(saved);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(errorResponse(404, "WALLET_NOT_FOUND", "Wallet not found"))));
    render(wrap(<WalletsScreen initialWallets={saved} />));
    expect(await screen.findByText(/No wallets on this device/)).toBeInTheDocument();
    expect(screen.queryByText("ada")).not.toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    expect(localStorage.getItem("talasea.wallets")).toBe("[]");
    expect(walletCookie()).toBe("[]");
  });

  it("keeps saved wallets when the balance API is unreachable", async () => {
    const saved = [{ id: walletA, userId: "ada", asset: "USD" }];
    rememberDevice(saved);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    render(wrap(<WalletsScreen initialWallets={saved} />));
    expect(await screen.findByText("The wallet API is unreachable.")).toBeInTheDocument();
    expect(screen.getByText("ada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy wallet address" })).toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    expect(localStorage.getItem("talasea.wallets")).toBe(JSON.stringify(saved));
    expect(walletCookie()).toContain(walletA);
  });

  it("keeps saved wallets when the balance request fails with a server error", async () => {
    const saved = [{ id: walletA, userId: "ada", asset: "USD" }];
    rememberDevice(saved);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(errorResponse(500, "INTERNAL_ERROR", "Internal error"))));
    render(wrap(<WalletsScreen initialWallets={saved} />));
    expect(await screen.findByText(/Internal error/)).toBeInTheDocument();
    expect(screen.getByText("ada")).toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    expect(localStorage.getItem("talasea.wallets")).toBe(JSON.stringify(saved));
    expect(walletCookie()).toContain(walletA);
  });

  it("does not remember a wallet id that the API cannot find", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(errorResponse(404, "WALLET_NOT_FOUND", "Wallet not found"))));
    render(wrap(<WalletsScreen />));
    revealOpenById();
    fireEvent.change(screen.getByLabelText("Wallet id"), { target: { value: walletA } });
    fireEvent.click(screen.getByRole("button", { name: "Open wallet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wallet not found");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(localStorage.getItem("talasea.wallets")).toBeNull();
    expect(walletCookie()).not.toContain(walletA);
  });

  it("forgets a remembered wallet when its detail balance is missing", async () => {
    const saved = [{ id: walletA, userId: "ada", asset: "USD" }];
    rememberDevice(saved);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(errorResponse(404, "WALLET_NOT_FOUND", "Wallet not found"))));
    navigation.pathname = `/wallets/${walletA}`;
    render(wrap(<WalletScreen initialWallets={saved} />));
    await waitFor(() => expect(localStorage.getItem("talasea.wallets")).toBe("[]"));
    expect(walletCookie()).toBe("[]");
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });

  it("keeps a remembered wallet when the detail request cannot reach the API", async () => {
    const saved = [{ id: walletA, userId: "ada", asset: "USD" }];
    rememberDevice(saved);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    navigation.pathname = `/wallets/${walletA}`;
    render(wrap(<WalletScreen initialWallets={saved} />));
    expect(await screen.findAllByText("The wallet API is unreachable.")).not.toHaveLength(0);
    expect(localStorage.getItem("talasea.wallets")).toBe(JSON.stringify(saved));
    expect(walletCookie()).toContain(walletA);
  });

  it("leaves a missing wallet out of the prefetched home html and device snapshot", async () => {
    const saved = [
      { id: walletA, userId: "ada", asset: "USD" },
      { id: walletB, userId: "grace", asset: "EUR" },
    ];
    rememberDevice(saved);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.includes(walletA)) return Promise.resolve(errorResponse(404, "WALLET_NOT_FOUND", "Wallet not found"));
        return Promise.resolve(jsonResponse({ walletId: walletB, asset: "EUR", balance: "2500", version: 1 }));
      }),
    );
    const client = createRequestQueryClient();
    const prefetched = await prefetchBalances(client, saved);
    expect(prefetched.missingIds).toEqual([walletA]);
    expect(prefetched.wallets).toEqual([saved[1]]);
    const html = renderToString(
      wrap(
        <HydrationBoundary state={dehydrate(client)}>
          <WalletsScreen initialWallets={prefetched.wallets} missingWalletIds={prefetched.missingIds} />
        </HydrationBoundary>,
      ),
    );
    expect(html).toContain("grace");
    expect(html).not.toContain("ada");
    expect(html).not.toContain("Unavailable");
    expect(html).toMatch(/25\.00/);
    expect(localStorage.getItem("talasea.wallets")).toBe(JSON.stringify([saved[1]]));
    expect(walletCookie()).toBe(JSON.stringify([saved[1]]));
    expect(walletCookie()).not.toContain(walletA);
  });
});
