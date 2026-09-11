# DK Flash Browser launch arguments

DK Flash Browser supports a small set of Chrome-style executable arguments for Windows shortcuts and command-line launches.

## Start maximized

```text
DKFlashBrowser.exe --start-maximized
```

The main browser window starts maximized. Without this flag, the existing normal window size is used.

## Open a specific address at startup

Pass the address as the first non-option argument:

```text
DKFlashBrowser.exe "https://example.com/"
```

A bare host/address is also accepted and is treated as HTTP:

```text
DKFlashBrowser.exe "legacy-server/path"
```

which opens:

```text
http://legacy-server/path
```

The command-line address affects only the first startup tab. It does not rewrite `config.ini`; Home and later manually created new tabs continue to use `[Browser] StartUrl`.

## Combine both options

```text
DKFlashBrowser.exe --start-maximized "http://legacy-server/"
```

This is suitable for a Windows shortcut Target field, for example:

```text
"D:\PortableApps\DKFlashBrowser\DKFlashBrowser.exe" --start-maximized "http://legacy-server/"
```

## Notes

- Only the first non-option argument is treated as the startup address.
- Unknown `-` / `--` options are ignored by the DK Flash Browser launch wrapper.
- Existing browser behavior and portable profile/session handling are unchanged.
