#include <stdio.h>
#include <windows.h>

#include <map>

using namespace std;

struct SYNC_EVENT {
  HANDLE evt;
  MSG msg;
};

class SaiHooker {
private:
  HWND saiMain = NULL;

  HHOOK msgHook = NULL;
  HHOOK wndHook = NULL;

  HOOKPROC GetMsgProc;
  HOOKPROC CallWndRetProc;

  map<int, SYNC_EVENT*> syncEvents;

public:
  SaiHooker(HOOKPROC GetMsgProc, HOOKPROC CallWndRetProc);
  ~SaiHooker();

  bool isOK();
  void hook();
  void unhook();

  HWND getSaiMain();
  void postMessage(UINT uMsg, WPARAM wParam, LPARAM lParam);
  MSG sendMessage(UINT uMsg, WPARAM wParam, LPARAM lParam);
  void respMessage(UINT uMsg, WPARAM wParam, LPARAM lParam);
};
