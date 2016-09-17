#include "utils.h"
#include "ManipulationEventSink.h"

HMODULE GetModuleFromAddress(char* addr) {
  HMODULE hInst;
  GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, addr, &hInst);
  return hInst;
}

void InitTouchWindow(HWND hwnd) {
  BOOL val = FALSE;
  SetProp(hwnd, MICROSOFT_TABLETPENSERVICE_PROPERTY,
    (HANDLE)(TABLET_DISABLE_FLICKS | TABLET_DISABLE_PRESSANDHOLD | TABLET_DISABLE_FLICKFALLBACKKEYS));

  HINSTANCE hInst = LoadLibrary("user32.dll");
  pSetWindowFeedbackSetting pfn = (pSetWindowFeedbackSetting)GetProcAddress(hInst, "SetWindowFeedbackSetting");
  if (pfn != NULL) {
    pfn(hwnd, FEEDBACK_TOUCH_CONTACTVISUALIZATION, 0, sizeof(BOOL), &val);
    pfn(hwnd, FEEDBACK_TOUCH_PRESSANDHOLD, 0, sizeof(BOOL), &val);
    pfn(hwnd, FEEDBACK_TOUCH_RIGHTTAP, 0, sizeof(BOOL), &val);
  }
  FreeLibrary(hInst);

  // Do not register touch window if you want WM_GESTURE
  RegisterTouchWindow(hwnd, TWF_FINETOUCH | TWF_WANTPALM);
  //RegisterPointerDeviceNotifications(GetSaiWindow(), TRUE);
}

void ResetTouchWindow(HWND hwnd) {
  RemoveProp(hwnd, MICROSOFT_TABLETPENSERVICE_PROPERTY);
  UnregisterTouchWindow(hwnd);
}

static IManipulationProcessor* pIManipProc = NULL;
static CManipulationEventSink* pManipulationEventSink = NULL;
static int nTouchFingers = 0;

void MaintainTouchGesture(HTOUCHINPUT hTi, UINT cTi) {
  if (pIManipProc == NULL || pManipulationEventSink == NULL) {
    CoInitialize(0);

    if (pIManipProc == NULL) {
      CoCreateInstance(CLSID_ManipulationProcessor, NULL, CLSCTX_INPROC_SERVER,
        IID_IUnknown, (VOID**)(&pIManipProc));
    }

    if (pIManipProc != NULL) {
      pManipulationEventSink = new CManipulationEventSink(pIManipProc);
    }
  }

  if (pIManipProc != NULL && pManipulationEventSink != NULL) {
    TOUCHINPUT *pTi = new TOUCHINPUT[cTi];
    if (GetTouchInputInfo(hTi, cTi, pTi, sizeof(TOUCHINPUT))) {
      DWORD tick = GetTickCount();
      for (UINT i = 0; i < cTi; i ++) {
        if (pTi[i].dwFlags & TOUCHEVENTF_DOWN) {
          nTouchFingers = cTi;
          pIManipProc->ProcessDownWithTime(pTi[i].dwID, static_cast<FLOAT>(pTi[i].x), static_cast<FLOAT>(pTi[i].y), tick);
        }
        if (pTi[i].dwFlags & TOUCHEVENTF_UP) {
          nTouchFingers --;
          pIManipProc->ProcessUpWithTime(pTi[i].dwID, static_cast<FLOAT>(pTi[i].x), static_cast<FLOAT>(pTi[i].y), tick);
          if (!nTouchFingers) {
            pIManipProc->CompleteManipulation();
          }
        }
        if (pTi[i].dwFlags & TOUCHEVENTF_MOVE) {
          pIManipProc->ProcessMoveWithTime(pTi[i].dwID, static_cast<FLOAT>(pTi[i].x), static_cast<FLOAT>(pTi[i].y), tick);
        }
      }
      CloseTouchInputHandle(hTi);
    }
  }
}
