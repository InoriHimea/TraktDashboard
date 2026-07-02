import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../SettingsPage";
import type { UserSettings } from "@trakt-dashboard/types";

const updateSettingsMock = vi.fn();
const toastMock = vi.fn();

const settings: UserSettings = {
    userId: 1,
    displayLanguage: "zh-CN",
    syncIntervalMinutes: 60,
    httpProxy: "",
    jellyfinUrl: null,
    jellyfinApiKey: null,
    jellyfinAutoDeleteLibraryIds: null,
    jellyfinAutoDeleteEnabled: false,
    notificationEventTypes: ["series_premiere", "season_premiere", "finale", "regular"],
};

vi.mock("../../hooks", () => ({
    useSettings: () => ({
        data: settings,
        isLoading: false,
    }),
    useUpdateSettings: () => ({
        mutateAsync: updateSettingsMock,
        isPending: false,
    }),
    useSyncStatus: () => ({ data: undefined }),
    useTriggerSync: () => ({ mutate: vi.fn(), isPending: false }),
    useTriggerFullSync: () => ({ mutate: vi.fn(), isPending: false }),
    useSystemMetrics: () => ({ data: undefined }),
    useJellyfinDeleteQueue: () => ({ data: [], isLoading: false }),
    useJellyfinDeleteHistory: () => ({ data: [], isLoading: false }),
    useJellyfinDeleteExclusions: () => ({ data: [], isLoading: false }),
    useDeferJellyfinDelete: () => ({ mutate: vi.fn(), isPending: false }),
    useNeverJellyfinDelete: () => ({ mutate: vi.fn(), isPending: false }),
    useRemoveJellyfinExclusion: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../lib/toast", () => ({
    useToast: () => ({
        toast: toastMock,
    }),
}));

vi.mock("../../lib/theme", () => ({
    loadTheme: () => "dark",
    applyTheme: vi.fn(),
    persistTheme: vi.fn(),
}));

describe("SettingsPage", () => {
    beforeEach(() => {
        updateSettingsMock.mockReset();
        updateSettingsMock.mockResolvedValue({ data: settings });
        toastMock.mockReset();
    });

    it("saves display language, sync interval, and proxy settings", async () => {
        render(<SettingsPage />);

        const languageInput = await screen.findByPlaceholderText("例如：zh-CN、en-US、ja-JP");
        const intervalInput = screen.getByRole("spinbutton");
        const proxyInput = screen.getByPlaceholderText("http://proxy.example.com:7890");

        fireEvent.change(languageInput, { target: { value: "en-US" } });
        fireEvent.change(intervalInput, { target: { value: "120" } });
        fireEvent.change(proxyInput, {
            target: { value: "http://127.0.0.1:7890" },
        });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));

        await waitFor(() =>
            expect(updateSettingsMock).toHaveBeenCalledWith({
                displayLanguage: "en-US",
                syncIntervalMinutes: 120,
                httpProxy: "http://127.0.0.1:7890",
                jellyfinUrl: null,
                jellyfinApiKey: null,
                jellyfinAutoDeleteLibraryIds: [],
                jellyfinAutoDeleteEnabled: false,
                notificationEventTypes: ["series_premiere", "season_premiere", "finale", "regular"],
            }),
        );
        expect(toastMock).toHaveBeenCalledWith(
            expect.stringMatching(/设置保存成功|Settings saved successfully/),
            "success",
        );
    });

    it("renders full-history export links for CSV and JSON", async () => {
        render(<SettingsPage />);

        const csv = await screen.findByRole("link", { name: /CSV/ });
        const json = screen.getByRole("link", { name: /JSON/ });

        expect(csv).toHaveAttribute("href", expect.stringContaining("/api/history/export?"));
        expect(csv).toHaveAttribute("href", expect.stringContaining("format=csv"));
        expect(csv).toHaveAttribute("download", "watch-history.csv");
        expect(json).toHaveAttribute("href", expect.stringContaining("format=json"));
        expect(json).toHaveAttribute("download", "watch-history.json");
    });

    it("blocks invalid proxy values before saving", async () => {
        render(<SettingsPage />);

        const proxyInput = await screen.findByPlaceholderText("http://proxy.example.com:7890");
        fireEvent.change(proxyInput, { target: { value: "socks5://proxy" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));

        expect(updateSettingsMock).not.toHaveBeenCalled();
        expect(toastMock).toHaveBeenCalledWith(
            "代理地址必须以 http:// 或 https:// 开头。",
            "error",
        );
    });
});
