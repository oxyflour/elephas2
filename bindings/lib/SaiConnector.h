#include <windows.h>

#include <map>

typedef LPARAM HSV;
#define GetHValue(hsv) (LOWORD(hsv))
#define GetSValue(hsv) (LOBYTE(HIWORD(hsv)))
#define GetVValue(hsv) (HIBYTE(HIWORD(hsv)))
#define MakeHSV(h, s, v) (MAKELPARAM(h, MAKEWORD(s, v)))

using std::map;

class SaiConnector {
protected:
  map<int, HWND> wnds;

public:
  void connect();

  HWND getCanvasParent();

  double getCanvasZoom();
  void setCanvasZoom(double scale);

  double getCanvasRotation();
  void setCanvasRotation(double angle);

  HSV getColorHSV();
  void setColorHSV(HSV);
};
