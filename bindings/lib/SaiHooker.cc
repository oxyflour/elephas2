#include "SaiHooker.h"

const char* SAI_ROOT_WINDOW = "sflRootWindow";

SaiHooker::SaiHooker(HOOKPROC GetMsgProc, HOOKPROC CallWndRetProc):
  GetMsgProc(GetMsgProc), CallWndRetProc(CallWndRetProc) {
  syncEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
  hook();
}

SaiHooker::~SaiHooker() {
  CloseHandle(syncEvent);
  unhook();
}

void SaiHooker::hook() {
  saiMain = FindWindowEx(NULL, NULL, SAI_ROOT_WINDOW, NULL);

  if (!saiMain) {
    printf("find sai main window failed (Error: %d)\n", GetLastError());
  }
  else {
    printf("got sai main window (Handle: %x)\n", saiMain);

    HMODULE hInst;
    GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, (char *) GetMsgProc, &hInst);
    auto threadId = GetWindowThreadProcessId(saiMain, NULL);

    msgHook = SetWindowsHookEx(WH_GETMESSAGE, GetMsgProc, hInst, threadId);
    if (!msgHook) {
      printf("register message hook failed %d\n", GetLastError());
    }

    wndHook = SetWindowsHookEx(WH_CALLWNDPROCRET, CallWndRetProc, hInst, threadId);
    if (!wndHook) {
      printf("register wnd hook failed %d\n", GetLastError());
    }
  }
}

void SaiHooker::unhook() {
  if (msgHook) {
    UnhookWindowsHookEx(msgHook);
    msgHook = NULL;
  }

  if (wndHook) {
    UnhookWindowsHookEx(wndHook);
    wndHook = NULL;
  }
}

bool SaiHooker::check() {
  if (IsWindow(saiMain) && msgHook && wndHook) {
    return true;
  }
  
  unhook();
  hook();
  return IsWindow(saiMain) && msgHook && wndHook;
}

HWND SaiHooker::getSaiMain() {
  return saiMain;
}

void SaiHooker::postMessage(UINT uMsg, WPARAM wParam, LPARAM lParam) {
  PostMessage(saiMain, uMsg, wParam, lParam);
}

MSG SaiHooker::sendMessage(UINT uMsg, WPARAM wParam, LPARAM lParam) {
  PostMessage(saiMain, uMsg, wParam, lParam);
  WaitForSingleObject(syncEvent, 2000);
  return syncMsg;
}

void SaiHooker::respMessage(UINT uMsg, WPARAM wParam, LPARAM lParam) {
  syncMsg.message = uMsg;
  syncMsg.wParam = wParam;
  syncMsg.lParam = lParam;
  SetEvent(syncEvent);
}
