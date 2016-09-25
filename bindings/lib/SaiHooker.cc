#include "SaiHooker.h"

const char* SAI_ROOT_WINDOW = "sflRootWindow";

SaiHooker::SaiHooker(HOOKPROC GetMsgProc, HOOKPROC CallWndRetProc):
  GetMsgProc(GetMsgProc), CallWndRetProc(CallWndRetProc) {
  syncEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
}

SaiHooker::~SaiHooker() {
  CloseHandle(syncEvent);
  unhook();
}

void SaiHooker::hook() {
  unhook();

  saiMain = FindWindowEx(NULL, NULL, SAI_ROOT_WINDOW, NULL);
  while (saiMain && !IsWindowVisible(saiMain)) {
    saiMain = FindWindowEx(NULL, saiMain, SAI_ROOT_WINDOW, NULL);
  }

  if (!saiMain) {
    printf("find sai main window failed (Error: %d)\n", GetLastError());
  }
  else {
    auto threadId = GetWindowThreadProcessId(saiMain, NULL);

    HMODULE hInst;
    GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, (char *) GetMsgProc, &hInst);

    msgHook = SetWindowsHookEx(WH_GETMESSAGE, GetMsgProc, hInst, threadId);
    if (!msgHook) {
      printf("register message hook failed %d\n", GetLastError());
    }

    wndHook = SetWindowsHookEx(WH_CALLWNDPROCRET, CallWndRetProc, hInst, threadId);
    if (!wndHook) {
      printf("register wnd hook failed %d\n", GetLastError());
    }

    printf("got sai main window (Handle: %x, Thread %x)\nhook ok (%x, %x, Error: %d)\n",
      saiMain, threadId, msgHook, wndHook, GetLastError());
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

bool SaiHooker::isOK() {
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
