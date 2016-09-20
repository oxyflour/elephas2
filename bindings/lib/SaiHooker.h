#include <node.h>
#include <v8.h>
#include <nan.h>

#include <windows.h>

class SaiHooker {
private:
  HWND saiMain = NULL;

  HHOOK msgHook = NULL;
  HHOOK wndHook = NULL;

  HOOKPROC GetMsgProc;
  HOOKPROC CallWndRetProc;

  HANDLE syncEvent = NULL;
  MSG syncMsg;

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