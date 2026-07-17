import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserList, UserListItem } from "@trakt-dashboard/types";
import ListsPage from "../ListsPage";
import {
    useLists,
    useListItems,
    useCreateList,
    useDeleteList,
    useSyncLists,
    useRemoveListItem,
} from "../../hooks";

vi.mock("../../hooks", () => ({
    useLists: vi.fn(),
    useListItems: vi.fn(),
    useCreateList: vi.fn(),
    useDeleteList: vi.fn(),
    useSyncLists: vi.fn(),
    useRemoveListItem: vi.fn(),
}));

const mockUseLists = vi.mocked(useLists);
const mockUseListItems = vi.mocked(useListItems);
const mockUseCreateList = vi.mocked(useCreateList);
const mockUseDeleteList = vi.mocked(useDeleteList);
const mockUseSyncLists = vi.mocked(useSyncLists);
const mockUseRemoveListItem = vi.mocked(useRemoveListItem);

function makeList(overrides: Partial<UserList> = {}): UserList {
    return {
        id: 1,
        traktId: 100,
        traktSlug: "my-list",
        name: "My List",
        description: null,
        privacy: "private",
        sortBy: "rank",
        sortHow: "asc",
        itemCount: 3,
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeItem(overrides: Partial<UserListItem> = {}): UserListItem {
    return {
        id: 1,
        listId: 1,
        mediaType: "show",
        showId: 10,
        movieId: null,
        rank: 1,
        notes: null,
        listedAt: "2026-01-01T00:00:00.000Z",
        title: "Some Show",
        year: 2020,
        posterPath: "/poster.jpg",
        ...overrides,
    };
}

function renderPage() {
    return render(
        <MemoryRouter>
            <ListsPage />
        </MemoryRouter>,
    );
}

function selectList(container: HTMLElement, name = "My List") {
    fireEvent.click(within(container.querySelector("aside")!).getByText(name));
}

describe("ListsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseListItems.mockReturnValue({ data: [], isLoading: false } as never);
        mockUseCreateList.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseDeleteList.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseSyncLists.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseRemoveListItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    });

    describe("sidebar", () => {
        it("shows a loading spinner while lists are loading", () => {
            mockUseLists.mockReturnValue({ data: undefined, isLoading: true } as never);
            const { container } = renderPage();
            expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
            expect(screen.queryByText("暂无列表，点击 + 创建")).toBeNull();
        });

        it("shows the empty state when there are no lists", () => {
            mockUseLists.mockReturnValue({ data: [], isLoading: false } as never);
            renderPage();
            expect(screen.getByText("暂无列表，点击 + 创建")).toBeInTheDocument();
        });

        it("renders lists with name, item count, and privacy badge", () => {
            mockUseLists.mockReturnValue({
                data: [
                    makeList({ id: 1, name: "Private List", privacy: "private", itemCount: 3 }),
                    makeList({ id: 2, name: "Friends List", privacy: "friends", itemCount: 5 }),
                    makeList({ id: 3, name: "Public List", privacy: "public", itemCount: 0 }),
                ],
                isLoading: false,
            } as never);
            renderPage();
            expect(screen.getByText("Private List")).toBeInTheDocument();
            expect(screen.getByText("Friends List")).toBeInTheDocument();
            expect(screen.getByText("Public List")).toBeInTheDocument();
            expect(screen.getByText("3")).toBeInTheDocument();
            expect(screen.getByText("5")).toBeInTheDocument();
            expect(screen.getByText("私密")).toBeInTheDocument();
            expect(screen.getByText("好友")).toBeInTheDocument();
            expect(screen.getByText("公开")).toBeInTheDocument();
        });

        it("falls back to the lock icon for an unrecognized privacy value", () => {
            mockUseLists.mockReturnValue({
                data: [makeList({ privacy: "unknown" as unknown as UserList["privacy"] })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            expect(container.querySelector(".lucide-lock")).not.toBeNull();
        });

        it("selects a list on click and deselects it on a second click", () => {
            mockUseLists.mockReturnValue({ data: [makeList()], isLoading: false } as never);
            const { container } = renderPage();
            expect(screen.getByText("从左侧选择一个列表")).toBeInTheDocument();

            selectList(container);
            expect(screen.getByRole("heading", { name: "My List" })).toBeInTheDocument();

            selectList(container);
            expect(screen.getByText("从左侧选择一个列表")).toBeInTheDocument();
        });

        it("shows the list description when present", () => {
            mockUseLists.mockReturnValue({
                data: [makeList({ description: "A description of the list" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(screen.getByText("A description of the list")).toBeInTheDocument();
        });
    });

    describe("sidebar actions", () => {
        beforeEach(() => {
            mockUseLists.mockReturnValue({ data: [], isLoading: false } as never);
        });

        it("triggers a sync from Trakt", () => {
            const mutate = vi.fn();
            mockUseSyncLists.mockReturnValue({ mutate, isPending: false } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("从 Trakt 同步"));
            expect(mutate).toHaveBeenCalled();
        });

        it("shows a spinning sync icon while a sync is pending", () => {
            mockUseSyncLists.mockReturnValue({ mutate: vi.fn(), isPending: true } as never);
            renderPage();
            const icon = screen.getByTitle("从 Trakt 同步").querySelector(".lucide-refresh-cw")!;
            expect((icon as HTMLElement).style.animation).toBe("spin 1s linear infinite");
        });

        it("opens the create-list modal", () => {
            renderPage();
            expect(screen.queryByText("新建列表")).toBeNull();
            fireEvent.click(screen.getByTitle("新建列表"));
            expect(screen.getByText("新建列表")).toBeInTheDocument();
        });
    });

    describe("create list modal", () => {
        beforeEach(() => {
            mockUseLists.mockReturnValue({ data: [], isLoading: false } as never);
        });

        function openModal() {
            const utils = renderPage();
            fireEvent.click(screen.getByTitle("新建列表"));
            return utils;
        }

        it("disables submit until a name is entered", () => {
            openModal();
            const submitBtn = screen.getByText("创建").closest("button")!;
            expect(submitBtn).toBeDisabled();
            fireEvent.change(screen.getByPlaceholderText("输入列表名称…"), {
                target: { value: "New List" },
            });
            expect(submitBtn).not.toBeDisabled();
        });

        it("does not submit when the trimmed name is empty", () => {
            const mutate = vi.fn();
            mockUseCreateList.mockReturnValue({ mutate, isPending: false } as never);
            const { container } = openModal();
            fireEvent.change(screen.getByPlaceholderText("输入列表名称…"), {
                target: { value: "   " },
            });
            fireEvent.submit(container.querySelector("form")!);
            expect(mutate).not.toHaveBeenCalled();
        });

        it("creates a list with trimmed name/description and the chosen privacy", () => {
            const mutate = vi.fn((_body: unknown, opts?: { onSuccess?: () => void }) =>
                opts?.onSuccess?.(),
            );
            mockUseCreateList.mockReturnValue({ mutate, isPending: false } as never);
            openModal();
            fireEvent.change(screen.getByPlaceholderText("输入列表名称…"), {
                target: { value: "  New List  " },
            });
            fireEvent.change(screen.getByPlaceholderText("输入描述…"), {
                target: { value: "A description" },
            });
            fireEvent.click(screen.getByText("好友"));
            fireEvent.click(screen.getByText("创建"));
            expect(mutate).toHaveBeenCalledWith(
                { name: "New List", description: "A description", privacy: "friends" },
                expect.objectContaining({ onSuccess: expect.any(Function) }),
            );
        });

        it("omits the description when it is blank after trimming", () => {
            const mutate = vi.fn();
            mockUseCreateList.mockReturnValue({ mutate, isPending: false } as never);
            openModal();
            fireEvent.change(screen.getByPlaceholderText("输入列表名称…"), {
                target: { value: "No Desc" },
            });
            fireEvent.change(screen.getByPlaceholderText("输入描述…"), {
                target: { value: "   " },
            });
            fireEvent.click(screen.getByText("创建"));
            expect(mutate).toHaveBeenCalledWith(
                { name: "No Desc", description: undefined, privacy: "private" },
                expect.anything(),
            );
        });

        it("shows a loading spinner on the submit button while creating", () => {
            mockUseCreateList.mockReturnValue({ mutate: vi.fn(), isPending: true } as never);
            const { container } = openModal();
            expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
        });

        it("applies focus and blur border-color styles to the name input", () => {
            openModal();
            const input = screen.getByPlaceholderText("输入列表名称…") as HTMLInputElement;
            fireEvent.focus(input);
            expect(input.style.borderColor).toBe("var(--color-accent)");
            fireEvent.blur(input);
            expect(input.style.borderColor).toBe("var(--color-border-subtle)");
        });

        it("closes via the header close button without submitting", () => {
            const mutate = vi.fn();
            mockUseCreateList.mockReturnValue({ mutate, isPending: false } as never);
            const { container } = openModal();
            const closeBtn = container.querySelector(".lucide-x")!.closest("button")!;
            fireEvent.click(closeBtn);
            expect(mutate).not.toHaveBeenCalled();
        });

        it("closes via a backdrop click without submitting", () => {
            const mutate = vi.fn();
            mockUseCreateList.mockReturnValue({ mutate, isPending: false } as never);
            openModal();
            fireEvent.click(screen.getByRole("presentation"));
            expect(mutate).not.toHaveBeenCalled();
        });

        it("does not close when clicking inside the modal card", () => {
            openModal();
            fireEvent.click(screen.getByText("新建列表"));
            expect(screen.getByText("新建列表")).toBeInTheDocument();
        });
    });

    describe("items grid", () => {
        beforeEach(() => {
            mockUseLists.mockReturnValue({ data: [makeList()], isLoading: false } as never);
        });

        it("shows a loading spinner while items are loading", () => {
            mockUseListItems.mockReturnValue({ data: undefined, isLoading: true } as never);
            const { container } = renderPage();
            selectList(container);
            expect(container.querySelector("main .lucide-loader-circle")).not.toBeNull();
        });

        it("shows the empty-items message", () => {
            mockUseListItems.mockReturnValue({ data: [], isLoading: false } as never);
            const { container } = renderPage();
            selectList(container);
            expect(screen.getByText("此列表暂无内容")).toBeInTheDocument();
        });

        it("links a show item to its detail page", () => {
            mockUseListItems.mockReturnValue({
                data: [makeItem({ mediaType: "show", showId: 42, movieId: null, title: "A Show" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(container.querySelectorAll('a[href="/shows/42"]').length).toBeGreaterThan(0);
            expect(screen.getByText("A Show")).toBeInTheDocument();
        });

        it("links a movie item to its detail page", () => {
            mockUseListItems.mockReturnValue({
                data: [
                    makeItem({ mediaType: "movie", showId: null, movieId: 7, title: "A Movie" }),
                ],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(container.querySelectorAll('a[href="/movies/7"]').length).toBeGreaterThan(0);
        });

        it("renders items without a resolvable detail path as plain text", () => {
            mockUseListItems.mockReturnValue({
                data: [
                    makeItem({
                        mediaType: "show",
                        showId: null,
                        movieId: null,
                        title: "Orphan Item",
                        year: null,
                    }),
                ],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(screen.getByText("Orphan Item")).toBeInTheDocument();
            expect(container.querySelector("a")).toBeNull();
        });

        it("shows a text-only placeholder when there is neither a detail path nor a poster", () => {
            mockUseListItems.mockReturnValue({
                data: [
                    makeItem({
                        mediaType: "show",
                        showId: null,
                        movieId: null,
                        posterPath: null,
                        title: "Text Only Item",
                    }),
                ],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(container.querySelector("img")).toBeNull();
            expect(container.querySelector("a")).toBeNull();
            expect(screen.getAllByText("Text Only Item").length).toBeGreaterThan(0);
        });

        it("shows the poster image when posterPath is set", () => {
            mockUseListItems.mockReturnValue({
                data: [makeItem({ posterPath: "/poster.jpg", title: "Poster Item" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(container.querySelector('img[src*="poster.jpg"]')).not.toBeNull();
        });

        it("shows a title placeholder when posterPath is missing", () => {
            mockUseListItems.mockReturnValue({
                data: [makeItem({ posterPath: null, title: "No Poster Item" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(container.querySelector("img")).toBeNull();
            expect(screen.getAllByText("No Poster Item").length).toBeGreaterThan(0);
        });

        it("shows the item year when present", () => {
            mockUseListItems.mockReturnValue({
                data: [makeItem({ title: "With Year", year: 1999 })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            expect(screen.getByText("1999")).toBeInTheDocument();
        });

        it("applies hover styles to the remove button and the card on mouse enter/leave", () => {
            mockUseListItems.mockReturnValue({
                data: [makeItem({ id: 5, title: "Hoverable" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);

            const removeBtn = screen.getByTitle("从列表移除") as HTMLElement;
            fireEvent.mouseEnter(removeBtn);
            expect(removeBtn.style.color).toBe("rgb(239, 68, 68)");
            fireEvent.mouseLeave(removeBtn);
            expect(removeBtn.style.color).toBe("var(--color-text-muted)");

            const card = container.querySelector('main [role="presentation"]') as HTMLElement;
            fireEvent.mouseEnter(card);
            expect(card.style.transform).toBe("translateY(-2px)");
            fireEvent.mouseLeave(card);
            expect(card.style.transform).toBe("");
        });

        it("removes an item from the list", () => {
            const mutate = vi.fn();
            mockUseRemoveListItem.mockReturnValue({ mutate, isPending: false } as never);
            mockUseListItems.mockReturnValue({
                data: [makeItem({ id: 5, title: "Removable" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            selectList(container);
            fireEvent.click(screen.getByTitle("从列表移除"));
            expect(mutate).toHaveBeenCalledWith({ listId: 1, itemId: 5 });
        });
    });

    describe("delete list flow", () => {
        beforeEach(() => {
            mockUseLists.mockReturnValue({ data: [makeList()], isLoading: false } as never);
        });

        it("shows a delete confirmation that can be cancelled", () => {
            const { container } = renderPage();
            selectList(container);
            fireEvent.click(screen.getByText("删除列表"));
            expect(screen.getByText("确认删除")).toBeInTheDocument();
            fireEvent.click(screen.getByText("取消"));
            expect(screen.getByText("删除列表")).toBeInTheDocument();
            expect(screen.queryByText("确认删除")).toBeNull();
        });

        it("deletes the list and returns to the empty-selection state", () => {
            const mutate = vi.fn((_id: number, opts?: { onSuccess?: () => void }) =>
                opts?.onSuccess?.(),
            );
            mockUseDeleteList.mockReturnValue({ mutate, isPending: false } as never);
            const { container } = renderPage();
            selectList(container);
            fireEvent.click(screen.getByText("删除列表"));
            fireEvent.click(screen.getByText("确认删除"));
            expect(mutate).toHaveBeenCalledWith(
                1,
                expect.objectContaining({ onSuccess: expect.any(Function) }),
            );
            expect(screen.getByText("从左侧选择一个列表")).toBeInTheDocument();
        });
    });
});
