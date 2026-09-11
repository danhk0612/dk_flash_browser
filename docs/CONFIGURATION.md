# DK Flash Browser configuration

DK Flash Browser intentionally exposes a very small external configuration surface.

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

## Supported settings

```ini
[Browser]
StartUrl=http://legacy-server/
```

### `Browser.StartUrl`

- Used as the page opened when the application starts.
- Used by the Home button and `Alt+Home`.
- Used as the initial URL for a manually created new tab.
- Default: `about:blank` when the file, section, key, or value is missing.

Changes take effect the next time DK Flash Browser starts. Existing already-open tabs are not rewritten.

## Parsing behavior

- Section/key names are case-insensitive.
- Blank lines are ignored.
- Lines beginning with `;` or `#` are comments.
- Unknown sections and keys are ignored.
- The value after the first `=` is used as the setting value after trimming surrounding whitespace.

## Intentionally not configurable

The following are fixed product/runtime behavior rather than external configuration:

- Electron/Chromium runtime generation.
- Pepper Flash version/path convention.
- Portable `UserData` location.
- Shared persistent browser partition.
- Session-cookie persistence compatibility layer.
- Browser keyboard shortcuts.
- Browser product name.

Keeping these fixed reduces the chance of creating unsupported combinations in a legacy runtime.
