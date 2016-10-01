#include "SaiConnector.h"

const static int NAV_ZOOM_TEXT    = 0x2016f;
const static int NAV_ROTATE_TEXT  = 0x20173;
const static int NAV_ZOOM         = 0x2018f;
const static int NAV_ROTATE       = 0x20194;
const static int COLOR_H          = 0x201dc;
const static int COLOR_H_TEXT     = 0x201dd;
const static int COLOR_S          = 0x201df;
const static int COLOR_S_TEXT     = 0x201e0;
const static int COLOR_V          = 0x201e3;
const static int COLOR_V_TEXT     = 0x201e4;
const static int COLOR_VIEW_CTRL  = 0x201c2;
const static int CANVAS_CONTAINER = 0x20184;

static auto getWindowTextAsNumber(HWND hWnd) {
  char szBuf[32];
  GetWindowText(hWnd, szBuf, sizeof(szBuf));
  return atof(szBuf);
}

static void simulateClickInWindow(HWND hWnd, double fx, double fy,
    double paddingLeft = 0, double paddingRight = -1) {
  RECT rt;
  GetWindowRect(hWnd, &rt);

  paddingRight = paddingRight < 0 ? paddingLeft : paddingRight;
  auto x = paddingLeft + (rt.right - rt.left - paddingLeft - paddingRight) * fx;
  auto y = paddingLeft + (rt.bottom - rt.top - paddingLeft - paddingRight) * fy;

  PostMessage(hWnd, WM_LBUTTONDOWN, MK_LBUTTON, MAKELPARAM(x, y));
  PostMessage(hWnd, WM_LBUTTONUP, 0, MAKELPARAM(x, y));
}

static void simulateDragInWindow(HWND hWnd, int dx, int dy, WPARAM wParam) {
  RECT rt;
  GetWindowRect(hWnd, &rt);
  auto x = (rt.right - rt.left) / 2;
  auto y = (rt.bottom - rt.top) / 2;

  if (wParam & MK_CONTROL) {
    PostMessage(hWnd, WM_KEYDOWN, VK_CONTROL, 0);
  }
  if (wParam & MK_SHIFT) {
    PostMessage(hWnd, WM_KEYDOWN, VK_SHIFT, 0);
  }

  PostMessage(hWnd, WM_LBUTTONDOWN, wParam | MK_LBUTTON, MAKELPARAM(x, y));
  PostMessage(hWnd, WM_MOUSEMOVE, wParam | MK_LBUTTON, MAKELPARAM(x + dx, y + dy));
  PostMessage(hWnd, WM_LBUTTONUP, 0, MAKELPARAM(x + dx, y + dy));

  if (wParam & MK_SHIFT) {
    PostMessage(hWnd, WM_KEYUP, VK_SHIFT, 0);
  }
  if (wParam & MK_CONTROL) {
    PostMessage(hWnd, WM_KEYUP, VK_CONTROL, 0);
  }
}

static BOOL CALLBACK EnumChildWndProc(HWND hWnd, LPARAM lParam) {
  auto& wnds = *(map<int, HWND> *) lParam;
  auto ctrlId = GetDlgCtrlID(hWnd);
  if (ctrlId > 0) {
    wnds[ctrlId] = hWnd;
  }
  if (ctrlId == CANVAS_CONTAINER) {
    wnds[ctrlId] = GetWindow(hWnd, GW_CHILD);
  }
  return TRUE;
}

static BOOL CALLBACK EnumThreadWndProc(HWND hWnd, LPARAM lParam) {
  EnumChildWindows(hWnd, EnumChildWndProc, lParam);
  return TRUE;
}

void SaiConnector::connect() {
  EnumThreadWindows(GetCurrentThreadId(), EnumThreadWndProc, (LPARAM) &wnds);
}

HWND SaiConnector::getCanvasParent() {
  return GetWindow(wnds[CANVAS_CONTAINER], GW_CHILD);
}

void SaiConnector::moveCanvas(int dx, int dy) {
  HWND hWnd = GetWindow(wnds[CANVAS_CONTAINER], GW_CHILD);
  PostMessage(hWnd, WM_KEYDOWN, VK_SPACE, 0);
  simulateDragInWindow(hWnd, dx, dy, 0);
  PostMessage(hWnd, WM_KEYUP, VK_SPACE, 0);
}

double SaiConnector::getCanvasZoom() {
  return getWindowTextAsNumber(wnds[NAV_ZOOM_TEXT]);
}

void SaiConnector::setCanvasZoom(double scale) {
  auto fx = 0.5 * log(scale / 100) / log(2) / (scale < 100 ? 7 : 5) + 0.5;
  simulateClickInWindow(wnds[NAV_ZOOM], fx, 0.5, 4);
}

double SaiConnector::getCanvasRotation() {
  return getWindowTextAsNumber(wnds[NAV_ROTATE_TEXT]);
}

void SaiConnector::setCanvasRotation(double angle) {
  auto fx = (angle > 180 ? angle - 360 : angle) / 360 + 0.5;
  simulateClickInWindow(wnds[NAV_ROTATE], fx, 0.5, 4);
}

HSV SaiConnector::getColorHSV() {
  auto h = getWindowTextAsNumber(wnds[COLOR_H_TEXT]);
  auto s = getWindowTextAsNumber(wnds[COLOR_S_TEXT]) * 255 / 100;
  auto v = getWindowTextAsNumber(wnds[COLOR_V_TEXT]) * 255 / 100;
  return MakeHSV(h, s, v);
}

void SaiConnector::setColorHSV(HSV lParam) {
  simulateClickInWindow(wnds[COLOR_H], GetHValue(lParam) / 360.0, 0.5, 4);
  simulateClickInWindow(wnds[COLOR_S], GetSValue(lParam) / 255.0, 0.5, 4);
  simulateClickInWindow(wnds[COLOR_V], GetVValue(lParam) / 255.0, 0.5, 4);
}
