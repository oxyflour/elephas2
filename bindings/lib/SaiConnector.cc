#include "SaiConnector.h"

const static int NAV_ZOOM         = 0x201;
const static int NAV_ZOOM_TEXT    = 0x50d;
const static int NAV_ROTATE       = 0x202;
const static int NAV_ROTATE_TEXT  = 0x50e;
const static int COLOR_H          = 0x421;
const static int COLOR_S          = 0x422;
const static int COLOR_V          = 0x423;
const static int COLOR_RGB        = 0x601;
const static int CANVAS_CONTAINER = 0x800;

// https://en.wikipedia.org/wiki/HSL_and_HSV
static HSV RGB2HSV(BYTE r, BYTE g, BYTE b) {
  auto R = r / 255.0;
  auto G = g / 255.0;
  auto B = b / 255.0;
  auto M = max(max(R, G), B);
  auto m = min(min(R, G), B);
  auto C = M - m;
  auto H =
    C == 0 ? 0 :
    M == R ? fmod((G - B) / C, 6) :
    M == G ? (B - R) / C + 2 :
    M == B ? (R - G) / C + 4 :
    0;
  auto h = H * 60.0;
  auto v = M;
  auto s = v ? C / v : 0;
  return MakeHSV(h, s * 255, v * 255);
}

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

static BOOL CALLBACK EnumChildWndProc(HWND hWnd, LPARAM lParam) {
  auto& wnds = *(map<int, HWND> *) lParam;
  auto ctrlId = GetDlgCtrlID(hWnd);
  if (ctrlId > 0) {
    wnds[ctrlId] = hWnd;
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
  return wnds[CANVAS_CONTAINER];
}

double SaiConnector::getCanvasZoom() {
  return getWindowTextAsNumber(wnds[NAV_ZOOM_TEXT]);
}

void SaiConnector::setCanvasZoom(double scale) {
  auto fx = 0.5 * log(scale / 100) / log(2) / 5 + 0.5;
  simulateClickInWindow(wnds[NAV_ZOOM], fx, 0.5, 3);
}

double SaiConnector::getCanvasRotation() {
  return getWindowTextAsNumber(wnds[NAV_ROTATE_TEXT]);
}

void SaiConnector::setCanvasRotation(double angle) {
  auto fx = (angle > 180 ? angle - 360 : angle) / 360 + 0.5;
  simulateClickInWindow(wnds[NAV_ROTATE], fx, 0.5, 3);
}

HSV SaiConnector::getColorHSV() {
  auto hdc = GetDC(wnds[COLOR_RGB]);
  auto rgb = GetPixel(hdc, 20, 20);
  ReleaseDC(wnds[COLOR_RGB], hdc);
  return RGB2HSV(GetRValue(rgb), GetGValue(rgb), GetBValue(rgb));
}

void SaiConnector::setColorHSV(HSV lParam) {
  simulateClickInWindow(wnds[COLOR_H], GetHValue(lParam) / 360.0, 0.5, 14, 34);
  simulateClickInWindow(wnds[COLOR_S], GetSValue(lParam) / 255.0, 0.5, 14, 34);
  simulateClickInWindow(wnds[COLOR_V], GetVValue(lParam) / 255.0, 0.5, 14, 34);
}
