#include <windows.h>
#include <winuser.h>
#include <tchar.h>
#include <tpcshrd.h>

#include "ManipulationEventSink.h"

typedef BOOL (WINAPI *pSetWindowFeedbackSetting)(HWND hwnd, FEEDBACK_TYPE feedback, DWORD dwFlags, UINT32 size, const VOID *configuration);

HMODULE GetModuleFromAddress(char* addr);

void InitTouchWindow(HWND hwnd);
void ResetTouchWindow(HWND hwnd);
void MaintainTouchGesture(HTOUCHINPUT hTi, UINT cTi);
