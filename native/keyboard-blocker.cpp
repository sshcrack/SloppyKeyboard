#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstdio>

static HHOOK g_hook = NULL;

static LRESULT CALLBACK HookProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode < 0) {
        return CallNextHookEx(g_hook, nCode, wParam, lParam);
    }

    return 1;
}

int main() {
    g_hook = SetWindowsHookExW(WH_KEYBOARD_LL, HookProc, GetModuleHandleW(NULL), 0);
    if (!g_hook) {
        return 1;
    }

    fprintf(stdout, "READY\n");
    fflush(stdout);

    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (g_hook) {
        UnhookWindowsHookEx(g_hook);
        g_hook = NULL;
    }
    return 0;
}
