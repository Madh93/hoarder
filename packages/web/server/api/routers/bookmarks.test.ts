import { CustomTestContext, defaultBeforeEach } from "@/lib/testUtils";
import { expect, describe, test, beforeEach, assert } from "vitest";

beforeEach<CustomTestContext>(defaultBeforeEach);

describe("Bookmark Routes", () => {
  test<CustomTestContext>("create bookmark", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    const bookmark = await api.createBookmark({
      url: "https://google.com",
      type: "link",
    });

    const res = await api.getBookmark({ bookmarkId: bookmark.id });
    assert(res.content.type == "link");
    expect(res.content.url).toEqual("https://google.com");
    expect(res.favourited).toEqual(false);
    expect(res.archived).toEqual(false);
    expect(res.content.type).toEqual("link");
  });

  test<CustomTestContext>("delete bookmark", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;

    // Create the bookmark
    const bookmark = await api.createBookmark({
      url: "https://google.com",
      type: "link",
    });

    // It should exist
    await api.getBookmark({ bookmarkId: bookmark.id });

    // Delete it
    await api.deleteBookmark({ bookmarkId: bookmark.id });

    // It shouldn't be there anymore
    await expect(() =>
      api.getBookmark({ bookmarkId: bookmark.id }),
    ).rejects.toThrow(/Bookmark not found/);
  });

  test<CustomTestContext>("update bookmark", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;

    // Create the bookmark
    const bookmark = await api.createBookmark({
      url: "https://google.com",
      type: "link",
    });

    await api.updateBookmark({
      bookmarkId: bookmark.id,
      archived: true,
      favourited: true,
    });

    const res = await api.getBookmark({ bookmarkId: bookmark.id });
    expect(res.archived).toBeTruthy();
    expect(res.favourited).toBeTruthy();
  });

  test<CustomTestContext>("list bookmarks", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    const emptyBookmarks = await api.getBookmarks({});
    expect(emptyBookmarks.bookmarks.length).toEqual(0);

    const bookmark1 = await api.createBookmark({
      url: "https://google.com",
      type: "link",
    });

    const bookmark2 = await api.createBookmark({
      url: "https://google2.com",
      type: "link",
    });

    {
      const bookmarks = await api.getBookmarks({});
      expect(bookmarks.bookmarks.length).toEqual(2);
    }

    // Archive and favourite bookmark1
    await api.updateBookmark({
      bookmarkId: bookmark1.id,
      archived: true,
      favourited: true,
    });

    {
      const bookmarks = await api.getBookmarks({ archived: false });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark2.id);
    }

    {
      const bookmarks = await api.getBookmarks({ favourited: true });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark1.id);
    }

    {
      const bookmarks = await api.getBookmarks({ archived: true });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark1.id);
    }

    {
      const bookmarks = await api.getBookmarks({ ids: [bookmark1.id] });
      expect(bookmarks.bookmarks.length).toEqual(1);
      expect(bookmarks.bookmarks[0].id).toEqual(bookmark1.id);
    }
  });

  test<CustomTestContext>("update tags", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    let bookmark = await api.createBookmark({
      url: "https://google.com",
      type: "link",
    });

    await api.updateTags({
      bookmarkId: bookmark.id,
      attach: [{ tag: "tag1" }, { tag: "tag2" }],
      detach: [],
    });

    bookmark = await api.getBookmark({ bookmarkId: bookmark.id });
    expect(bookmark.tags.map((t) => t.name).sort()).toEqual(["tag1", "tag2"]);

    const tag1Id = bookmark.tags.filter((t) => t.name == "tag1")[0].id;

    await api.updateTags({
      bookmarkId: bookmark.id,
      attach: [{ tag: "tag3" }],
      detach: [{ tagId: tag1Id }],
    });

    bookmark = await api.getBookmark({ bookmarkId: bookmark.id });
    expect(bookmark.tags.map((t) => t.name).sort()).toEqual(["tag2", "tag3"]);
  });

  test<CustomTestContext>("update bookmark text", async ({ apiCallers }) => {
    const api = apiCallers[0].bookmarks;
    let bookmark = await api.createBookmark({
      text: "HELLO WORLD",
      type: "text",
    });

    await api.updateBookmarkText({
      bookmarkId: bookmark.id,
      text: "WORLD HELLO",
    });

    bookmark = await api.getBookmark({ bookmarkId: bookmark.id });
    assert(bookmark.content.type == "text");
    expect(bookmark.content.text).toEqual("WORLD HELLO");
  });

  test<CustomTestContext>("privacy", async ({ apiCallers }) => {
    const user1Bookmark = await apiCallers[0].bookmarks.createBookmark({
      type: "link",
      url: "https://google.com",
    });
    const user2Bookmark = await apiCallers[1].bookmarks.createBookmark({
      type: "link",
      url: "https://google.com",
    });

    // All interactions with the wrong user should fail
    await expect(() =>
      apiCallers[0].bookmarks.deleteBookmark({ bookmarkId: user2Bookmark.id }),
    ).rejects.toThrow(/User is not allowed to access resource/);
    await expect(() =>
      apiCallers[0].bookmarks.getBookmark({ bookmarkId: user2Bookmark.id }),
    ).rejects.toThrow(/User is not allowed to access resource/);
    await expect(() =>
      apiCallers[0].bookmarks.updateBookmark({ bookmarkId: user2Bookmark.id }),
    ).rejects.toThrow(/User is not allowed to access resource/);
    await expect(() =>
      apiCallers[0].bookmarks.updateTags({
        bookmarkId: user2Bookmark.id,
        attach: [],
        detach: [],
      }),
    ).rejects.toThrow(/User is not allowed to access resource/);

    // Get bookmarks should only show the correct one
    expect(
      (await apiCallers[0].bookmarks.getBookmarks({})).bookmarks.map(
        (b) => b.id,
      ),
    ).toEqual([user1Bookmark.id]);
    expect(
      (await apiCallers[1].bookmarks.getBookmarks({})).bookmarks.map(
        (b) => b.id,
      ),
    ).toEqual([user2Bookmark.id]);
  });
});
