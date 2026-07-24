# Sloppy Keyboard Desktop Goose mod

Build this .NET Framework 4.5.2 project against the `GooseModdingAPI.dll` from
your own Desktop Goose v0.31 download:

1. Copy that API DLL to `goose-mod/lib/GooseModdingAPI.dll`.
2. Build `SloppyKeyboard.csproj` in Release mode.

The output is `assets/goose-mod/SloppyKeyboard.dll`. The API DLL and Desktop
Goose itself must never be copied into that output or packaged with this app.
