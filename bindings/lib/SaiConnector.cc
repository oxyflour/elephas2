#include "SaiConnector.h"

const static int NAV_ZOOM         = 0x201;
const static int NAV_ZOOM_TEXT    = 0x50d;
const static int NAV_ROTATE       = 0x202;
const static int NAV_ROTATE_TEXT  = 0x50e;
const static int COLOR_H          = 0x421;
const static int COLOR_S          = 0x422;
const static int COLOR_V          = 0x423;
const static int CANVAS_CONTAINER = 0x800;

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

static const int SLIDER_LENGTH = 128;
static const int SLIDER_OFFSET_X = 15;
static const int SLIDER_OFFSET_Y = 11;
static auto getColorSliderPosition(HWND hWnd) {
  auto hdc = GetDC(hWnd);
  auto p0 = GetPixel(hdc, SLIDER_OFFSET_X - 1, SLIDER_OFFSET_Y);
  int i = 0;
  for (; i < SLIDER_LENGTH; i ++) {
    auto p1 = GetPixel(hdc, SLIDER_OFFSET_X + i, SLIDER_OFFSET_Y);
    if (p0 != p1) {
      break;
    }
    else {
      p0 = p1;
    }
  }
  return i * 1.0 / SLIDER_LENGTH;
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
  auto x = log(scale / 100) / log(2);
  auto y = scale > 100 ? 3.8*x*x + 26*x : 2.6*x*x + 45*x;
  simulateClickInWindow(wnds[NAV_ZOOM], (y + 165) / 330, 0.5, 4);
}

double SaiConnector::getCanvasRotation() {
  return getWindowTextAsNumber(wnds[NAV_ROTATE_TEXT]);
}

void SaiConnector::setCanvasRotation(double angle) {
  auto fx = (angle > 180 ? angle - 360 : angle) / 360 + 0.5;
  simulateClickInWindow(wnds[NAV_ROTATE], fx, 0.5, 4);
}

HSV SaiConnector::getColorHSV() {
  auto h = getColorSliderPosition(wnds[COLOR_H]) * 360;
  auto s = getColorSliderPosition(wnds[COLOR_S]) * 255;
  auto v = getColorSliderPosition(wnds[COLOR_V]) * 255;
  return MakeHSV(h, s, v);
}

void SaiConnector::setColorHSV(HSV lParam) {
  simulateClickInWindow(wnds[COLOR_H], GetHValue(lParam) / 360.0, 0.5, 15, 35);
  simulateClickInWindow(wnds[COLOR_S], GetSValue(lParam) / 255.0, 0.5, 15, 35);
  simulateClickInWindow(wnds[COLOR_V], GetVValue(lParam) / 255.0, 0.5, 15, 35);
}
