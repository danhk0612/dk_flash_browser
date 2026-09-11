# DK Flash Browser configuration

DK Flash Browser intentionally exposes a small external configuration surface.

## File location

Development checkout:

```text
<project-root>\config.ini
```

Portable package:

```text
<portable-folder>\config.ini
```

The portable executable reads this file at startup. Editing it does not require rebuilding the application.

## Browser homepage

```ini
[Browser]
StartUrl=https://html.duckduckgo.com/html
```

### `Browser.StartUrl`

- Used as the page opened when the application starts.
- Used by the Home button and `Alt+Home`.
- Used as the initial URL for a manually created new tab.
- If the file, section, key, or value is missing/empty, DK Flash Browser applies:

```text
https://html.duckduckgo.com/html
```

The fallback is written into `config.ini` at startup so subsequent launches have an explicit value.

Changes take effect the next time DK Flash Browser starts. Existing already-open tabs are not rewritten.

## First-run default bookmarks

```ini
[DefaultBookmarks]
Bookmark1=DuckDuckGo|https://html.duckduckgo.com/html
Bookmark2=Duck.ai|https://duck.ai/
```

Format:

```text
BookmarkN=Title|URL
```

Behavior:

- These entries are used only when `UserData\bookmarks.json` does not exist.
- A new/reset portable profile therefore receives the configured default bookmarks automatically.
- Once `bookmarks.json` exists, config defaults no longer modify the user's bookmarks.
- If the user deletes all bookmarks, the browser stores an existing but empty bookmark file, so defaults are not recreated.
- If `bookmarks.json` itself is deleted, the next launch is treated as a reset profile and config defaults are created again.
- Default bookmarks are created in the root bookmark bar. The user may later move them into folders, rename them, or delete them normally.

## Flash startup preflight

Before the normal browser code is loaded, DK Flash Browser validates the bundled/user-supplied:

```text
Flash\pepflashplayer.dll
```

The startup preflight checks:

- the DLL exists;
- it is a regular file of a plausible Flash Player size;
- it has a valid Windows PE header;
- the PE machine type is x86 (`0x014C`).

If the check fails, an error message is displayed and the application exits without loading a browser page. The failure is also written to `Logs\browser.log` under `FLASH-CHECK`.

This preflight verifies the supplied Flash binary before browsing starts; actual SWF rendering/interaction remains part of real legacy-system validation.

## Parsing behavior

- Section/key names are case-insensitive.
- Blank lines are ignored.
- Lines beginning with `;` or `#` are comments.
- Unknown sections and keys are ignored.
- The value after the first `=` is used as the setting value after trimming surrounding whitespace.

## Intentionally not configurable

The following remain fixed product/runtime behavior:

- Electron/Chromium runtime generation.
- Pepper Flash version/path convention.
- Portable `UserData` location.
- Shared persistent browser partition.
- Session-cookie persistence compatibility layer.
- Browser keyboard shortcuts.
- Browser product name.

Keeping these fixed reduces the chance of creating unsupported combinations in a legacy runtime.
