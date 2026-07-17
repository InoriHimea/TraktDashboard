import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupFile, DeviceAuthInfo } from "@trakt-dashboard/types";
import { BackupTab } from "../BackupTab";
import { api } from "../../../lib/api";
import { useToast } from "../../../lib/toast";

vi.mock("../../../lib/api", () => ({
    api: {
        backup: {
            gdriveStartAuth: vi.fn(),
            gdrivePoll: vi.fn(),
            gdriveRevoke: vi.fn(),
            onedriveStartAuth: vi.fn(),
            onedrivePoll: vi.fn(),
            onedriveRevoke: vi.fn(),
            webdavSave: vi.fn(),
            webdavClear: vi.fn(),
            s3Save: vi.fn(),
            s3Clear: vi.fn(),
            saveSettings: vi.fn(),
            trigger: vi.fn(),
            runs: vi.fn(),
            files: vi.fn(),
            restore: vi.fn(),
        },
    },
}));

vi.mock("../../../lib/toast", () => ({
    useToast: vi.fn(),
}));

const mockApi = vi.mocked(api, { deep: true });
const mockUseToast = vi.mocked(useToast);

type Props = ComponentProps<typeof BackupTab>;

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        gdriveConfigured: true,
        onedriveConfigured: true,
        gdriveConnected: false,
        setGdriveConnected: vi.fn(),
        gdriveLoading: false,
        setGdriveLoading: vi.fn(),
        gdriveDeviceAuth: null,
        setGdriveDeviceAuth: vi.fn(),
        gdrivePollTimer: null,
        setGdrivePollTimer: vi.fn(),

        onedriveConnected: false,
        setOnedriveConnected: vi.fn(),
        onedriveLoading: false,
        setOnedriveLoading: vi.fn(),
        onedriveDeviceAuth: null,
        setOnedriveDeviceAuth: vi.fn(),
        onedrivePollTimer: null,
        setOnedrivePollTimer: vi.fn(),

        webdavUrl: "",
        setWebdavUrl: vi.fn(),
        webdavUsername: "",
        setWebdavUsername: vi.fn(),
        webdavPassword: "",
        setWebdavPassword: vi.fn(),
        webdavConnected: false,
        setWebdavConnected: vi.fn(),
        webdavSaving: false,
        setWebdavSaving: vi.fn(),

        s3Endpoint: "",
        setS3Endpoint: vi.fn(),
        s3Region: "",
        setS3Region: vi.fn(),
        s3Bucket: "",
        setS3Bucket: vi.fn(),
        s3AccessKeyId: "",
        setS3AccessKeyId: vi.fn(),
        s3SecretAccessKey: "",
        setS3SecretAccessKey: vi.fn(),
        s3Connected: false,
        setS3Connected: vi.fn(),
        s3Saving: false,
        setS3Saving: vi.fn(),

        backupScheduleHours: 0,
        setBackupScheduleHours: vi.fn(),
        backupTriggerLoading: false,
        setBackupTriggerLoading: vi.fn(),
        backupRuns: [],
        setBackupRuns: vi.fn(),
        backupRunsLoading: false,
        ...overrides,
    };
}

function makeDeviceAuth(overrides: Partial<DeviceAuthInfo> = {}): DeviceAuthInfo {
    return {
        device_code: "device-abc",
        user_code: "ABCD-1234",
        verification_url: "https://example.com/verify",
        expires_in: 300,
        interval: 5,
        ...overrides,
    };
}

function makeFile(overrides: Partial<BackupFile> = {}): BackupFile {
    return {
        name: "backup-2026-01-01.dump",
        fileId: "file-1",
        sizeBytes: 5 * 1024 * 1024,
        createdAt: "2026-01-01T00:00:00.000Z",
        provider: "gdrive",
        ...overrides,
    };
}

function renderTab(overrides: Partial<Props> = {}) {
    return render(<BackupTab {...makeProps(overrides)} />);
}

// Each provider card's heading span sits inside a header row div, which
// itself sits inside the card div — two levels up from the heading text.
function cardFor(headingText: string) {
    return screen.getByText(headingText).closest("div")!.parentElement!;
}

describe("BackupTab", () => {
    const toast = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        mockUseToast.mockReturnValue({ toast } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("cloud provider disabled hint", () => {
        it("shows no hint and renders both cards when both are configured", () => {
            renderTab({ gdriveConfigured: true, onedriveConfigured: true });
            expect(screen.queryByText(/备份已禁用/)).toBeNull();
            expect(screen.getByText("Google Drive")).toBeInTheDocument();
            expect(screen.getByText("OneDrive")).toBeInTheDocument();
        });

        it("hides the Google Drive card and names it in the disabled hint", () => {
            renderTab({ gdriveConfigured: false, onedriveConfigured: true });
            expect(screen.queryByText("Google Drive")).toBeNull();
            expect(
                screen.getByText(
                    "Google Drive 备份已禁用：需要自备 OAuth 应用凭据并配置相应环境变量后才能启用。",
                ),
            ).toBeInTheDocument();
            expect(screen.getByText("OneDrive")).toBeInTheDocument();
        });

        it("hides the OneDrive card and names it in the disabled hint", () => {
            renderTab({ gdriveConfigured: true, onedriveConfigured: false });
            expect(screen.queryByText("OneDrive")).toBeNull();
            expect(
                screen.getByText(
                    "OneDrive 备份已禁用：需要自备 OAuth 应用凭据并配置相应环境变量后才能启用。",
                ),
            ).toBeInTheDocument();
        });

        it("joins both provider names when both are disabled", () => {
            renderTab({ gdriveConfigured: false, onedriveConfigured: false });
            expect(
                screen.getByText(
                    "Google Drive / OneDrive 备份已禁用：需要自备 OAuth 应用凭据并配置相应环境变量后才能启用。",
                ),
            ).toBeInTheDocument();
            expect(screen.getByText("参看文档了解如何申请与配置。")).toBeInTheDocument();
        });
    });

    describe("google drive", () => {
        it("shows the connected badge and disconnects even when the remote revoke call fails", async () => {
            const setGdriveConnected = vi.fn();
            mockApi.backup.gdriveRevoke.mockRejectedValue(new Error("network down"));
            renderTab({
                onedriveConfigured: false,
                gdriveConnected: true,
                setGdriveConnected,
            });
            const card = cardFor("Google Drive");
            expect(within(card).getByText("已连接")).toBeInTheDocument();

            fireEvent.click(within(card).getByText("断开"));
            await vi.waitFor(() => expect(setGdriveConnected).toHaveBeenCalledWith(false));
            expect(toast).toHaveBeenCalledWith("Google Drive 已断开", "success");
        });

        it("starts device-code auth on connect and stores the returned device auth", async () => {
            const setGdriveDeviceAuth = vi.fn();
            const setGdriveLoading = vi.fn();
            const setGdrivePollTimer = vi.fn();
            mockApi.backup.gdriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth(),
            } as never);
            mockApi.backup.gdrivePoll.mockResolvedValue({ ok: true, pending: true } as never);
            renderTab({
                onedriveConfigured: false,
                gdriveConnected: false,
                gdriveLoading: false,
                setGdriveDeviceAuth,
                setGdriveLoading,
                setGdrivePollTimer,
            });
            const card = cardFor("Google Drive");
            fireEvent.click(within(card).getByText("连接"));

            await vi.waitFor(() =>
                expect(setGdriveDeviceAuth).toHaveBeenCalledWith(makeDeviceAuth()),
            );
            expect(setGdrivePollTimer).toHaveBeenCalled();
            expect(setGdriveLoading).not.toHaveBeenCalledWith(false);
        });

        it("shows a spinner and disables the connect button while loading", () => {
            renderTab({ onedriveConfigured: false, gdriveConnected: false, gdriveLoading: true });
            const card = cardFor("Google Drive");
            const connectBtn = within(card).getByText("连接").closest("button")!;
            expect(connectBtn).toBeDisabled();
            expect(card.querySelector(".lucide-loader-circle")).not.toBeNull();
        });

        it("shows a failure toast when starting device auth fails", async () => {
            const setGdriveLoading = vi.fn();
            mockApi.backup.gdriveStartAuth.mockRejectedValue(new Error("boom"));
            renderTab({ onedriveConfigured: false, setGdriveLoading });
            const card = cardFor("Google Drive");
            fireEvent.click(within(card).getByText("连接"));

            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("Google Drive 授权失败", "error"),
            );
            expect(setGdriveLoading).toHaveBeenCalledWith(false);
        });

        it("renders the device-flow hint with the user code and verification link", () => {
            renderTab({
                onedriveConfigured: false,
                gdriveDeviceAuth: makeDeviceAuth({
                    user_code: "WXYZ-9999",
                    verification_url: "https://example.com/go",
                }),
            });
            expect(screen.getByText("请访问以下链接，输入验证码完成授权：")).toBeInTheDocument();
            expect(screen.getByText("WXYZ-9999")).toBeInTheDocument();
            const link = screen.getByText("https://example.com/go");
            expect(link).toHaveAttribute("href", "https://example.com/go");
        });

        it("clears the poll timer and resets state when the device-flow hint is cancelled", () => {
            const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
            const setGdrivePollTimer = vi.fn();
            const setGdriveDeviceAuth = vi.fn();
            const setGdriveLoading = vi.fn();
            const fakeTimer = setInterval(() => {}, 100000);
            renderTab({
                onedriveConfigured: false,
                gdriveDeviceAuth: makeDeviceAuth(),
                gdrivePollTimer: fakeTimer,
                setGdrivePollTimer,
                setGdriveDeviceAuth,
                setGdriveLoading,
            });
            fireEvent.click(screen.getByText("取消"));
            expect(clearIntervalSpy).toHaveBeenCalledWith(fakeTimer);
            expect(setGdrivePollTimer).toHaveBeenCalledWith(null);
            expect(setGdriveDeviceAuth).toHaveBeenCalledWith(null);
            expect(setGdriveLoading).toHaveBeenCalledWith(false);
            clearInterval(fakeTimer);
        });

        it("does not call clearInterval when cancelling without an active poll timer", () => {
            const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
            renderTab({
                onedriveConfigured: false,
                gdriveDeviceAuth: makeDeviceAuth(),
                gdrivePollTimer: null,
            });
            fireEvent.click(screen.getByText("取消"));
            expect(clearIntervalSpy).not.toHaveBeenCalled();
        });

        it("marks the account connected once polling reports success", async () => {
            const setGdriveConnected = vi.fn();
            const setGdrivePollTimer = vi.fn();
            mockApi.backup.gdriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth({ interval: 5, expires_in: 300 }),
            } as never);
            mockApi.backup.gdrivePoll.mockResolvedValue({ ok: true, connected: true } as never);
            renderTab({
                onedriveConfigured: false,
                setGdriveConnected,
                setGdrivePollTimer,
            });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() => expect(mockApi.backup.gdriveStartAuth).toHaveBeenCalled());

            await vi.advanceTimersByTimeAsync(6000);

            expect(mockApi.backup.gdrivePoll).toHaveBeenCalledWith("device-abc");
            expect(setGdriveConnected).toHaveBeenCalledWith(true);
            expect(toast).toHaveBeenCalledWith("Google Drive 已连接", "success");
        });

        it("keeps polling silently while the device code is still pending", async () => {
            const setGdriveConnected = vi.fn();
            mockApi.backup.gdriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth({ interval: 5, expires_in: 300 }),
            } as never);
            mockApi.backup.gdrivePoll.mockResolvedValue({ ok: true, pending: true } as never);
            renderTab({ onedriveConfigured: false, setGdriveConnected });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() => expect(mockApi.backup.gdriveStartAuth).toHaveBeenCalled());

            await vi.advanceTimersByTimeAsync(6000);

            expect(mockApi.backup.gdrivePoll).toHaveBeenCalledTimes(1);
            expect(setGdriveConnected).not.toHaveBeenCalled();
            expect(toast).not.toHaveBeenCalled();
        });

        it("stops polling and reports failure once the device code expires", async () => {
            mockApi.backup.gdriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth({ interval: 5, expires_in: 5 }),
            } as never);
            renderTab({ onedriveConfigured: false });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() => expect(mockApi.backup.gdriveStartAuth).toHaveBeenCalled());

            await vi.advanceTimersByTimeAsync(6000);

            expect(mockApi.backup.gdrivePoll).not.toHaveBeenCalled();
            expect(toast).toHaveBeenCalledWith("Google Drive 授权失败", "error");
        });

        it("stops polling and reports failure when a poll request itself rejects", async () => {
            mockApi.backup.gdriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth({ interval: 5, expires_in: 300 }),
            } as never);
            mockApi.backup.gdrivePoll.mockRejectedValue(new Error("denied"));
            renderTab({ onedriveConfigured: false });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() => expect(mockApi.backup.gdriveStartAuth).toHaveBeenCalled());

            await vi.advanceTimersByTimeAsync(6000);

            expect(toast).toHaveBeenCalledWith("Google Drive 授权失败", "error");
        });
    });

    describe("onedrive", () => {
        it("shows the connected badge and disconnects even when the remote revoke call fails", async () => {
            const setOnedriveConnected = vi.fn();
            mockApi.backup.onedriveRevoke.mockRejectedValue(new Error("network down"));
            renderTab({
                gdriveConfigured: false,
                onedriveConnected: true,
                setOnedriveConnected,
            });
            const card = cardFor("OneDrive");
            expect(within(card).getByText("已连接")).toBeInTheDocument();
            fireEvent.click(within(card).getByText("断开"));
            await vi.waitFor(() => expect(setOnedriveConnected).toHaveBeenCalledWith(false));
            expect(toast).toHaveBeenCalledWith("OneDrive 已断开", "success");
        });

        it("starts device-code auth on connect and stores the returned device auth", async () => {
            const setOnedriveDeviceAuth = vi.fn();
            mockApi.backup.onedriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth(),
            } as never);
            renderTab({ gdriveConfigured: false, setOnedriveDeviceAuth });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() =>
                expect(setOnedriveDeviceAuth).toHaveBeenCalledWith(makeDeviceAuth()),
            );
        });

        it("shows a failure toast when starting device auth fails", async () => {
            mockApi.backup.onedriveStartAuth.mockRejectedValue(new Error("boom"));
            renderTab({ gdriveConfigured: false });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("OneDrive 授权失败", "error"),
            );
        });

        it("renders the device-flow hint and cancels it", () => {
            const setOnedrivePollTimer = vi.fn();
            renderTab({
                gdriveConfigured: false,
                onedriveDeviceAuth: makeDeviceAuth({ user_code: "ONED-0001" }),
                onedrivePollTimer: null,
                setOnedrivePollTimer,
            });
            expect(screen.getByText("ONED-0001")).toBeInTheDocument();
            fireEvent.click(screen.getByText("取消"));
            expect(setOnedrivePollTimer).toHaveBeenCalledWith(null);
        });

        it("clears an active poll timer when the device-flow hint is cancelled", () => {
            const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
            const fakeTimer = setInterval(() => {}, 100000);
            renderTab({
                gdriveConfigured: false,
                onedriveDeviceAuth: makeDeviceAuth(),
                onedrivePollTimer: fakeTimer,
            });
            fireEvent.click(screen.getByText("取消"));
            expect(clearIntervalSpy).toHaveBeenCalledWith(fakeTimer);
            clearInterval(fakeTimer);
        });

        it("marks the account connected once polling reports success", async () => {
            const setOnedriveConnected = vi.fn();
            mockApi.backup.onedriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth({ interval: 5, expires_in: 300 }),
            } as never);
            mockApi.backup.onedrivePoll.mockResolvedValue({ ok: true, connected: true } as never);
            renderTab({ gdriveConfigured: false, setOnedriveConnected });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() => expect(mockApi.backup.onedriveStartAuth).toHaveBeenCalled());

            await vi.advanceTimersByTimeAsync(6000);

            expect(mockApi.backup.onedrivePoll).toHaveBeenCalledWith("device-abc");
            expect(setOnedriveConnected).toHaveBeenCalledWith(true);
            expect(toast).toHaveBeenCalledWith("OneDrive 已连接", "success");
        });

        it("stops polling and reports failure when a poll request rejects", async () => {
            mockApi.backup.onedriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth({ interval: 5, expires_in: 300 }),
            } as never);
            mockApi.backup.onedrivePoll.mockRejectedValue(new Error("denied"));
            renderTab({ gdriveConfigured: false });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() => expect(mockApi.backup.onedriveStartAuth).toHaveBeenCalled());

            await vi.advanceTimersByTimeAsync(6000);

            expect(toast).toHaveBeenCalledWith("OneDrive 授权失败", "error");
        });

        it("stops polling and reports failure once the device code expires", async () => {
            mockApi.backup.onedriveStartAuth.mockResolvedValue({
                ok: true,
                data: makeDeviceAuth({ interval: 5, expires_in: 5 }),
            } as never);
            renderTab({ gdriveConfigured: false });
            fireEvent.click(screen.getByText("连接"));
            await vi.waitFor(() => expect(mockApi.backup.onedriveStartAuth).toHaveBeenCalled());

            await vi.advanceTimersByTimeAsync(6000);

            expect(mockApi.backup.onedrivePoll).not.toHaveBeenCalled();
            expect(toast).toHaveBeenCalledWith("OneDrive 授权失败", "error");
        });
    });

    describe("webdav", () => {
        it("disconnects and clears the local fields even when the remote clear call fails", async () => {
            const setWebdavConnected = vi.fn();
            const setWebdavUrl = vi.fn();
            const setWebdavUsername = vi.fn();
            const setWebdavPassword = vi.fn();
            mockApi.backup.webdavClear.mockRejectedValue(new Error("network down"));
            renderTab({
                webdavConnected: true,
                webdavUrl: "https://nextcloud.example.com",
                webdavUsername: "alice",
                webdavPassword: "secret",
                setWebdavConnected,
                setWebdavUrl,
                setWebdavUsername,
                setWebdavPassword,
            });
            fireEvent.click(screen.getByText("断开"));
            await vi.waitFor(() => expect(setWebdavConnected).toHaveBeenCalledWith(false));
            expect(setWebdavUrl).toHaveBeenCalledWith("");
            expect(setWebdavUsername).toHaveBeenCalledWith("");
            expect(setWebdavPassword).toHaveBeenCalledWith("");
            expect(toast).toHaveBeenCalledWith("WebDAV 已断开", "success");
        });

        it("wires input changes back to the setter props", () => {
            const setWebdavUrl = vi.fn();
            renderTab({ setWebdavUrl });
            const card = cardFor("WebDAV");
            fireEvent.change(
                within(card).getByPlaceholderText(
                    "https://nextcloud.example.com/remote.php/dav/files/user/",
                ),
                { target: { value: "https://x.example.com" } },
            );
            expect(setWebdavUrl).toHaveBeenCalledWith("https://x.example.com");
        });

        it("uses a password input for the password field", () => {
            renderTab({});
            const card = cardFor("WebDAV");
            const passwordInput = within(card).getByPlaceholderText("••••••••") as HTMLInputElement;
            expect(passwordInput.type).toBe("password");
        });

        it("disables the save button until all three fields are filled", () => {
            const { rerender } = render(<BackupTab {...makeProps({ webdavUrl: "" })} />);
            expect(
                within(cardFor("WebDAV")).getByText("保存并测试").closest("button"),
            ).toBeDisabled();

            rerender(
                <BackupTab
                    {...makeProps({
                        webdavUrl: "https://nextcloud.example.com",
                        webdavUsername: "alice",
                        webdavPassword: "secret",
                    })}
                />,
            );
            expect(
                within(cardFor("WebDAV")).getByText("保存并测试").closest("button"),
            ).not.toBeDisabled();
        });

        it("saves the config, clears the password, and shows a success toast", async () => {
            const setWebdavConnected = vi.fn();
            const setWebdavPassword = vi.fn();
            mockApi.backup.webdavSave.mockResolvedValue({ ok: true } as never);
            renderTab({
                webdavUrl: "https://nextcloud.example.com",
                webdavUsername: "alice",
                webdavPassword: "secret",
                setWebdavConnected,
                setWebdavPassword,
            });
            fireEvent.click(within(cardFor("WebDAV")).getByText("保存并测试"));
            expect(mockApi.backup.webdavSave).toHaveBeenCalledWith({
                url: "https://nextcloud.example.com",
                username: "alice",
                password: "secret",
            });
            await vi.waitFor(() => expect(setWebdavConnected).toHaveBeenCalledWith(true));
            expect(setWebdavPassword).toHaveBeenCalledWith("");
            expect(toast).toHaveBeenCalledWith("WebDAV 配置已保存", "success");
        });

        it("shows the thrown error message on save failure", async () => {
            mockApi.backup.webdavSave.mockRejectedValue(new Error("bad credentials"));
            renderTab({
                webdavUrl: "https://nextcloud.example.com",
                webdavUsername: "alice",
                webdavPassword: "secret",
            });
            fireEvent.click(within(cardFor("WebDAV")).getByText("保存并测试"));
            await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("bad credentials", "error"));
        });

        it("falls back to the generic failure message when the rejection has no message", async () => {
            mockApi.backup.webdavSave.mockRejectedValue({});
            renderTab({
                webdavUrl: "https://nextcloud.example.com",
                webdavUsername: "alice",
                webdavPassword: "secret",
            });
            fireEvent.click(within(cardFor("WebDAV")).getByText("保存并测试"));
            await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("WebDAV 连接失败", "error"));
        });

        it("shows a spinner on the save button while saving", () => {
            renderTab({ webdavSaving: true });
            const btn = within(cardFor("WebDAV")).getByText("保存并测试").closest("button")!;
            expect(btn.querySelector(".lucide-loader-circle")).not.toBeNull();
        });
    });

    describe("s3", () => {
        it("wires input changes back to the setter props", () => {
            const setS3Region = vi.fn();
            renderTab({ setS3Region });
            fireEvent.change(within(cardFor("S3")).getByPlaceholderText("us-east-1"), {
                target: { value: "eu-west-1" },
            });
            expect(setS3Region).toHaveBeenCalledWith("eu-west-1");
        });

        it("disconnects, clears all local fields, and shows a success toast", async () => {
            const setS3Connected = vi.fn();
            const setS3Endpoint = vi.fn();
            const setS3Region = vi.fn();
            const setS3Bucket = vi.fn();
            const setS3AccessKeyId = vi.fn();
            const setS3SecretAccessKey = vi.fn();
            mockApi.backup.s3Clear.mockResolvedValue({ ok: true } as never);
            renderTab({
                s3Connected: true,
                setS3Connected,
                setS3Endpoint,
                setS3Region,
                setS3Bucket,
                setS3AccessKeyId,
                setS3SecretAccessKey,
            });
            fireEvent.click(screen.getByText("断开"));
            await vi.waitFor(() => expect(setS3Connected).toHaveBeenCalledWith(false));
            expect(setS3Endpoint).toHaveBeenCalledWith("");
            expect(setS3Region).toHaveBeenCalledWith("");
            expect(setS3Bucket).toHaveBeenCalledWith("");
            expect(setS3AccessKeyId).toHaveBeenCalledWith("");
            expect(setS3SecretAccessKey).toHaveBeenCalledWith("");
            expect(toast).toHaveBeenCalledWith("S3 已断开", "success");
        });

        it("disables the save button until all five fields are filled", () => {
            renderTab({
                s3Endpoint: "https://s3.amazonaws.com",
                s3Region: "us-east-1",
                s3Bucket: "my-bucket",
                s3AccessKeyId: "AKIA",
                s3SecretAccessKey: "",
            });
            expect(within(cardFor("S3")).getByText("保存并测试").closest("button")).toBeDisabled();
        });

        it("saves the config, clears the secret key, and shows a success toast", async () => {
            const setS3Connected = vi.fn();
            const setS3SecretAccessKey = vi.fn();
            mockApi.backup.s3Save.mockResolvedValue({ ok: true } as never);
            renderTab({
                s3Endpoint: "https://s3.amazonaws.com",
                s3Region: "us-east-1",
                s3Bucket: "my-bucket",
                s3AccessKeyId: "AKIA",
                s3SecretAccessKey: "shh",
                setS3Connected,
                setS3SecretAccessKey,
            });
            fireEvent.click(within(cardFor("S3")).getByText("保存并测试"));
            expect(mockApi.backup.s3Save).toHaveBeenCalledWith({
                endpoint: "https://s3.amazonaws.com",
                region: "us-east-1",
                bucket: "my-bucket",
                accessKeyId: "AKIA",
                secretAccessKey: "shh",
            });
            await vi.waitFor(() => expect(setS3Connected).toHaveBeenCalledWith(true));
            expect(setS3SecretAccessKey).toHaveBeenCalledWith("");
            expect(toast).toHaveBeenCalledWith("S3 配置已保存", "success");
        });

        it("falls back to the generic failure message on save failure without a message", async () => {
            mockApi.backup.s3Save.mockRejectedValue({});
            renderTab({
                s3Endpoint: "https://s3.amazonaws.com",
                s3Region: "us-east-1",
                s3Bucket: "my-bucket",
                s3AccessKeyId: "AKIA",
                s3SecretAccessKey: "shh",
            });
            fireEvent.click(within(cardFor("S3")).getByText("保存并测试"));
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("S3 连接失败，请检查配置", "error"),
            );
        });

        it("shows a spinner on the save button while saving", () => {
            renderTab({ s3Saving: true });
            const btn = within(cardFor("S3")).getByText("保存并测试").closest("button")!;
            expect(btn.querySelector(".lucide-loader-circle")).not.toBeNull();
        });
    });

    describe("schedule", () => {
        it("reflects the current schedule value", () => {
            renderTab({ backupScheduleHours: 24 });
            expect(screen.getByDisplayValue("24h")).toBeInTheDocument();
        });

        it("saves the new schedule on change", async () => {
            const setBackupScheduleHours = vi.fn();
            mockApi.backup.saveSettings.mockResolvedValue({ ok: true } as never);
            renderTab({ setBackupScheduleHours });
            fireEvent.change(screen.getByDisplayValue("关闭"), { target: { value: "12" } });
            expect(setBackupScheduleHours).toHaveBeenCalledWith(12);
            await vi.waitFor(() =>
                expect(mockApi.backup.saveSettings).toHaveBeenCalledWith({ scheduleHours: 12 }),
            );
        });

        it("does not throw when saving the schedule fails", async () => {
            mockApi.backup.saveSettings.mockRejectedValue(new Error("boom"));
            renderTab({});
            fireEvent.change(screen.getByDisplayValue("关闭"), { target: { value: "6" } });
            await vi.waitFor(() => expect(mockApi.backup.saveSettings).toHaveBeenCalled());
        });
    });

    describe("trigger now", () => {
        it("is hidden when no provider is connected", () => {
            renderTab({
                gdriveConnected: false,
                onedriveConnected: false,
                webdavConnected: false,
                s3Connected: false,
            });
            expect(screen.queryByText("立即备份")).toBeNull();
        });

        it("is shown when at least one provider is connected", () => {
            renderTab({ s3Connected: true });
            expect(screen.getByText("立即备份")).toBeInTheDocument();
        });

        it("shows a success toast with the successful-target count and refreshes run history", async () => {
            const setBackupRuns = vi.fn();
            mockApi.backup.trigger.mockResolvedValue({
                ok: true,
                results: [
                    { provider: "gdrive", ok: true },
                    { provider: "s3", ok: false, error: "boom" },
                ],
            } as never);
            mockApi.backup.runs.mockResolvedValue({ data: [] } as never);
            renderTab({ s3Connected: true, setBackupRuns });
            fireEvent.click(screen.getByText("立即备份"));
            expect(mockApi.backup.trigger).toHaveBeenCalledWith("all");
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("备份成功（1 个目标）", "success"),
            );
            await vi.waitFor(() => expect(mockApi.backup.runs).toHaveBeenCalledWith(10));
            await vi.waitFor(() => expect(setBackupRuns).toHaveBeenCalledWith([]));
        });

        it("does not throw when the run-history refresh itself fails", async () => {
            mockApi.backup.trigger.mockResolvedValue({ ok: true, results: [] } as never);
            mockApi.backup.runs.mockRejectedValue(new Error("boom"));
            renderTab({ s3Connected: true });
            fireEvent.click(screen.getByText("立即备份"));
            await vi.waitFor(() => expect(mockApi.backup.runs).toHaveBeenCalledWith(10));
            expect(toast).toHaveBeenCalledWith("备份成功（0 个目标）", "success");
        });

        it("shows a failure toast when the overall trigger result is not ok", async () => {
            mockApi.backup.trigger.mockResolvedValue({ ok: false, results: [] } as never);
            mockApi.backup.runs.mockResolvedValue({ data: [] } as never);
            renderTab({ s3Connected: true });
            fireEvent.click(screen.getByText("立即备份"));
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("备份失败，请查看历史记录", "error"),
            );
        });

        it("shows the raw error message (no fallback) when the trigger call rejects", async () => {
            mockApi.backup.trigger.mockRejectedValue(new Error("network unreachable"));
            renderTab({ s3Connected: true });
            fireEvent.click(screen.getByText("立即备份"));
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("network unreachable", "error"),
            );
        });

        it("shows a spinner and disables the button while a trigger is in flight", () => {
            renderTab({ s3Connected: true, backupTriggerLoading: true });
            const btn = screen.getByText("立即备份").closest("button")!;
            expect(btn).toBeDisabled();
            expect(btn.querySelector(".lucide-loader-circle")).not.toBeNull();
        });

        it("clears the loading flag once the trigger settles", async () => {
            const setBackupTriggerLoading = vi.fn();
            mockApi.backup.trigger.mockResolvedValue({ ok: true, results: [] } as never);
            mockApi.backup.runs.mockResolvedValue({ data: [] } as never);
            renderTab({ s3Connected: true, setBackupTriggerLoading });
            fireEvent.click(screen.getByText("立即备份"));
            await vi.waitFor(() => expect(setBackupTriggerLoading).toHaveBeenCalledWith(false));
        });
    });

    describe("backup runs history", () => {
        function makeRun(overrides: Partial<Props["backupRuns"][number]> = {}) {
            return {
                id: 1,
                provider: "gdrive",
                status: "success",
                filename: "backup-1.dump",
                sizeBytes: 2 * 1024 * 1024,
                error: null,
                startedAt: "2026-02-01T10:00:00.000Z",
                ...overrides,
            };
        }

        it("is absent when there are no runs", () => {
            renderTab({ backupRuns: [] });
            expect(screen.queryByText("备份历史")).toBeNull();
        });

        it("shows a success run with its filename, size, and formatted date", () => {
            const run = makeRun();
            renderTab({ backupRuns: [run] });
            expect(screen.getByText("备份历史")).toBeInTheDocument();
            expect(screen.getByText("GDRIVE")).toBeInTheDocument();
            expect(screen.getByText("backup-1.dump")).toBeInTheDocument();
            expect(screen.getByText("2.0 MB")).toBeInTheDocument();
            expect(screen.getByText(new Date(run.startedAt).toLocaleString())).toBeInTheDocument();
        });

        it("shows the error message when a failed run has no filename", () => {
            renderTab({
                backupRuns: [
                    makeRun({
                        status: "failed",
                        filename: null,
                        error: "disk full",
                        sizeBytes: null,
                    }),
                ],
            });
            expect(screen.getByText("disk full")).toBeInTheDocument();
        });

        it("falls back to a dash when neither filename nor error is present", () => {
            renderTab({
                backupRuns: [makeRun({ filename: null, error: null, sizeBytes: null })],
            });
            expect(screen.getByText("—")).toBeInTheDocument();
        });

        it("shows a loading spinner independent of the runs list", () => {
            const { container } = renderTab({ backupRuns: [], backupRunsLoading: true });
            expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
        });
    });

    describe("cloud files", () => {
        it("loads files on click and renders them", async () => {
            mockApi.backup.files.mockResolvedValue({ data: [makeFile()] } as never);
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            await vi.waitFor(() => expect(mockApi.backup.files).toHaveBeenCalled());
            expect(await screen.findByText("backup-2026-01-01.dump")).toBeInTheDocument();
            expect(screen.getByText("GDRIVE")).toBeInTheDocument();
        });

        it("shows the empty message once loaded with no files", async () => {
            mockApi.backup.files.mockResolvedValue({ data: [] } as never);
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            expect(await screen.findByText("云端暂无备份文件")).toBeInTheDocument();
        });

        it("does not show the empty message before loading", () => {
            renderTab({});
            expect(screen.queryByText("云端暂无备份文件")).toBeNull();
        });

        it("shows a failure toast when loading fails", async () => {
            mockApi.backup.files.mockRejectedValue(new Error("boom"));
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("加载云端文件列表失败", "error"),
            );
        });

        it("shows a spinner and disables the load button while loading", async () => {
            let resolveFiles!: (v: { data: BackupFile[] }) => void;
            mockApi.backup.files.mockReturnValue(
                new Promise((resolve) => {
                    resolveFiles = resolve;
                }) as never,
            );
            const { container } = renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            expect(screen.getByText("加载列表").closest("button")).toBeDisabled();
            expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
            resolveFiles({ data: [] });
            await vi.waitFor(() =>
                expect(screen.getByText("加载列表").closest("button")).not.toBeDisabled(),
            );
        });
    });

    describe("restore flow", () => {
        it("does not render the confirm dialog when no restore target is selected", () => {
            mockApi.backup.files.mockResolvedValue({ data: [makeFile()] } as never);
            renderTab({});
            expect(screen.queryByText("从备份恢复数据库？")).toBeNull();
        });

        it("opens the confirm dialog naming the selected file", async () => {
            mockApi.backup.files.mockResolvedValue({
                data: [makeFile({ name: "my-backup.dump" })],
            } as never);
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            fireEvent.click(await screen.findByText("恢复"));
            expect(screen.getByText("从备份恢复数据库？")).toBeInTheDocument();
            const dialog = screen
                .getByText("从备份恢复数据库？")
                .closest(".hud-panel-strong") as HTMLElement;
            expect(within(dialog).getByText(/my-backup\.dump/)).toBeInTheDocument();
        });

        it("restores on confirm and shows the full-screen done overlay", async () => {
            mockApi.backup.files.mockResolvedValue({
                data: [makeFile({ provider: "s3", fileId: "file-42" })],
            } as never);
            mockApi.backup.restore.mockResolvedValue({
                ok: true,
                requiresRestart: true,
                safetyBackup: "safety.dump",
            } as never);
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            fireEvent.click(await screen.findByText("恢复"));

            const dialog = screen
                .getByText("从备份恢复数据库？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "恢复" }));

            expect(mockApi.backup.restore).toHaveBeenCalledWith("s3", "file-42");
            expect(await screen.findByText("恢复完成，服务正在重启")).toBeInTheDocument();
            expect(screen.getByText("请等待约 10 秒后刷新页面。")).toBeInTheDocument();
        });

        it("cancels without restoring", async () => {
            mockApi.backup.files.mockResolvedValue({ data: [makeFile()] } as never);
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            fireEvent.click(await screen.findByText("恢复"));

            const dialog = screen
                .getByText("从备份恢复数据库？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

            expect(mockApi.backup.restore).not.toHaveBeenCalled();
        });

        it("shows the thrown error message when restore fails", async () => {
            mockApi.backup.files.mockResolvedValue({ data: [makeFile()] } as never);
            mockApi.backup.restore.mockRejectedValue(new Error("provider unavailable"));
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            fireEvent.click(await screen.findByText("恢复"));
            const dialog = screen
                .getByText("从备份恢复数据库？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "恢复" }));

            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("provider unavailable", "error"),
            );
            expect(screen.queryByText("恢复完成，服务正在重启")).toBeNull();
        });

        it("falls back to the generic restore-failed message when the rejection has no message", async () => {
            mockApi.backup.files.mockResolvedValue({ data: [makeFile()] } as never);
            mockApi.backup.restore.mockRejectedValue({});
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            fireEvent.click(await screen.findByText("恢复"));
            const dialog = screen
                .getByText("从备份恢复数据库？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "恢复" }));

            await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("恢复失败", "error"));
        });

        it("shows a loading state on the confirm button while restoring", async () => {
            let resolveRestore!: (v: {
                ok: boolean;
                requiresRestart: boolean;
                safetyBackup: string;
            }) => void;
            mockApi.backup.files.mockResolvedValue({ data: [makeFile()] } as never);
            mockApi.backup.restore.mockReturnValue(
                new Promise((resolve) => {
                    resolveRestore = resolve;
                }) as never,
            );
            renderTab({});
            fireEvent.click(screen.getByText("加载列表"));
            fireEvent.click(await screen.findByText("恢复"));
            const dialog = screen
                .getByText("从备份恢复数据库？")
                .closest(".hud-panel-strong") as HTMLElement;
            const confirmBtn = within(dialog).getByRole("button", { name: "恢复" });
            fireEvent.click(confirmBtn);

            expect(confirmBtn).toBeDisabled();
            resolveRestore({ ok: true, requiresRestart: true, safetyBackup: "x" });
            // The dialog closes (isOpen -> false) in the same state batch that
            // clears `restoring`, so AnimatePresence freezes its last-rendered
            // (still-loading) child while its exit animation never completes in
            // jsdom — assert the resulting side effect (the done overlay) rather
            // than this now-detached button's disabled state reverting.
            expect(await screen.findByText("恢复完成，服务正在重启")).toBeInTheDocument();
        });
    });
});
