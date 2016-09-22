#define WINVER 0x0A00
#define _WIN32_WINNT 0x0A00

#include <node.h>
#include <v8.h>
#include <nan.h>

#include <windows.h>
#include <winuser.h>
#include <commctrl.h>

#include "lib/EventEmitter.h"
#include "lib/SaiConnector.h"
#include "lib/SaiHooker.h"

using v8::FunctionCallbackInfo;
using v8::Value;
using v8::Local;
using v8::Function;
using v8::Object;
using v8::Number;
using v8::String;
using v8::Boolean;

using node::AtExit;

const static char* WINDOW_TITLE_UUID = "HOOK-WINDOW-RECEIVER-355303E8-C607-4F88-9E32-FD225F2B7C8B";

static int commandIndex = 0;
const static UINT WM_USER_DEBUG           = WM_USER + WM_COMMAND + commandIndex ++;
const static UINT WM_SAI_TRY_CONNECT      = WM_USER + WM_COMMAND + commandIndex ++;
const static UINT WM_SAI_CANVAS_ZOOM      = WM_USER + WM_COMMAND + commandIndex ++;
const static UINT WM_SAI_CANVAS_ROTATION  = WM_USER + WM_COMMAND + commandIndex ++;
const static UINT WM_SAI_COLOR_HSV        = WM_USER + WM_COMMAND + commandIndex ++;

SaiConnector* thisConnector;
HWND thisMsgWnd;

// runs in SAI thread
LRESULT CALLBACK GetMsgProc(int nCode, WPARAM wParam, LPARAM lParam) {
  if (nCode == HC_ACTION) {
    auto* msg = (MSG *)lParam;
    if (!thisConnector) {
      thisConnector = new SaiConnector();
    }
    if (!IsWindow(thisMsgWnd)) {
      thisMsgWnd = FindWindow(NULL, WINDOW_TITLE_UUID);
    }
    if (msg->message == WM_KEYDOWN || msg->message == WM_KEYUP ||
      msg->message == WM_LBUTTONDOWN || msg->message == WM_LBUTTONUP) {
      PostMessage(thisMsgWnd, WM_USER + msg->message, msg->wParam, msg->lParam);
    }
    else if (msg->message == WM_SAI_TRY_CONNECT) {
      thisConnector->connect();
    }
    else if (msg->message == WM_SAI_CANVAS_ZOOM) {
      msg->wParam ?
        thisConnector->setCanvasZoom(msg->lParam * 1.0 / 0x10000):
        PostMessage(thisMsgWnd, WM_SAI_CANVAS_ZOOM, 0,
          (LPARAM) (thisConnector->getCanvasZoom() * 0x10000));
    }
    else if (msg->message == WM_SAI_CANVAS_ROTATION) {
      msg->wParam ?
        thisConnector->setCanvasRotation(msg->lParam * 1.0 / 0x10000):
        PostMessage(thisMsgWnd, WM_SAI_CANVAS_ROTATION, 0,
          (LPARAM) (thisConnector->getCanvasRotation() * 0x10000));
    }
    else if (msg->message == WM_SAI_COLOR_HSV) {
      msg->wParam ?
        thisConnector->setColorHSV(msg->lParam):
        PostMessage(thisMsgWnd, WM_SAI_COLOR_HSV, 0, thisConnector->getColorHSV());
    }
  }
  return CallNextHookEx(NULL, nCode, wParam, lParam);
}

// runs in SAI thread
LRESULT CALLBACK CallWndRetProc(int nCode, WPARAM wParam, LPARAM lParam) {
  if (nCode == HC_ACTION) {
    auto* cs = (CWPRETSTRUCT *)lParam;
    // ...
  }
  return CallNextHookEx(NULL, nCode, wParam, lParam);
}

EventEmitter* thisEmitter;
SaiHooker* thisHook;

// runs in new uv thread
LRESULT CALLBACK WindowProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
  if (uMsg == WM_USER_DEBUG) {
    printf("got debug WPARAM: %Ix(%d), LPARAM: %Ix(%d)\n", wParam, wParam, lParam, lParam);
  }
  else if (uMsg == WM_USER + WM_KEYDOWN || uMsg == WM_USER + WM_KEYUP ||
      uMsg == WM_USER + WM_LBUTTONDOWN || uMsg == WM_USER + WM_LBUTTONUP ||
      uMsg == WM_USER + WM_POINTERDOWN || uMsg == WM_USER + WM_POINTERUP) {
    thisEmitter->trigger(uMsg - WM_USER, wParam, lParam);
  }
  else if (uMsg == WM_SAI_CANVAS_ZOOM ||
      uMsg == WM_SAI_CANVAS_ROTATION ||
      uMsg == WM_SAI_COLOR_HSV) {
    thisHook->respMessage(uMsg, wParam, lParam);
  }
  return DefWindowProc(hWnd, uMsg, wParam, lParam);
}

// runs in main V8 thread
VOID MsgHandler(UINT uMsg, WPARAM wParam, LPARAM lParam) {
  auto *isolate = Isolate::GetCurrent();
  if (uMsg == WM_KEYDOWN || uMsg == WM_KEYUP) {
    Local<Value> args[] = { Number::New(isolate, (double) wParam) };
    thisEmitter->emit(uMsg == WM_KEYDOWN ? "key-down" : "key-up", args, 1);
  }
  else if (uMsg == WM_LBUTTONDOWN || uMsg == WM_LBUTTONUP) {
    thisEmitter->emit(uMsg == WM_LBUTTONDOWN ? "mouse-down" : "mouse-up", NULL, 0);
  }
  else if (uMsg == WM_POINTERDOWN || uMsg == WM_POINTERUP) {
    printf("got point %Ix: %Ix, LPARAM: %Ix\n", uMsg, wParam, lParam);
    Local<Value> args[] = {
      Boolean::New(isolate, lParam & PEN_FLAG_INVERTED),
      Boolean::New(isolate, lParam & PEN_FLAG_ERASER),
      Boolean::New(isolate, lParam & PEN_FLAG_BARREL),
    };
    thisEmitter->emit(uMsg == WM_POINTERDOWN ? "pen-down" : "pen-up", args, 3);
  }
}

void on(const FunctionCallbackInfo<Value>& args) {
  thisEmitter->on(args[0]->ToString(), Local<Function>::Cast(args[1]));
}

void off(const FunctionCallbackInfo<Value>& args) {
  thisEmitter->off(args[0]->ToString(), Local<Function>::Cast(args[1]));
}

void isOK(const FunctionCallbackInfo<Value>& args) {
  args.GetReturnValue().Set(thisHook->isOK());
}

void start(const FunctionCallbackInfo<Value>& args) {
  thisHook->hook();
  thisHook->postMessage(WM_SAI_TRY_CONNECT, 0, 0);
}

void destroy(const FunctionCallbackInfo<Value>& args) {
  thisHook->unhook();
}

void activateSaiWindow(const FunctionCallbackInfo<Value>& args) {
  SetForegroundWindow(thisHook->getSaiMain());
}

void getSaiCanvasZoom(const FunctionCallbackInfo<Value>& args) {
  auto msg = thisHook->sendMessage(WM_SAI_CANVAS_ZOOM, 0, 0);
  args.GetReturnValue().Set(msg.lParam * 1.0 / 0x10000);
}

void setSaiCanvasZoom(const FunctionCallbackInfo<Value>& args) {
  auto val = args[0]->NumberValue() * 0x10000;
  thisHook->postMessage(WM_SAI_CANVAS_ZOOM, 1, (LPARAM) val);
}

void getSaiCanvasRotation(const FunctionCallbackInfo<Value>& args) {
  auto msg = thisHook->sendMessage(WM_SAI_CANVAS_ROTATION, 0, 0);
  auto val = msg.lParam * 1.0 / 0x10000;
  while (val < 0) val += 360;
  while (val >= 360) val -= 360;
  args.GetReturnValue().Set(val);
}

void setSaiCanvasRotation(const FunctionCallbackInfo<Value>& args) {
  auto val = args[0]->NumberValue();
  while (val < 0) val += 360;
  while (val >= 360) val -= 360;
  thisHook->postMessage(WM_SAI_CANVAS_ROTATION, 1, (LPARAM) (val * 0x10000));
}

void getSaiColorHSV(const FunctionCallbackInfo<Value>& args) {
  auto msg = thisHook->sendMessage(WM_SAI_COLOR_HSV, 0, 0);
  auto h = GetHValue(msg.lParam);
  auto s = GetSValue(msg.lParam);
  auto v = GetVValue(msg.lParam);

  auto isolate = args.GetIsolate();
  auto ret = Object::New(isolate);
  ret->Set(String::NewFromUtf8(isolate, "h"), Number::New(isolate, h));
  ret->Set(String::NewFromUtf8(isolate, "s"), Number::New(isolate, s / 255.0));
  ret->Set(String::NewFromUtf8(isolate, "v"), Number::New(isolate, v / 255.0));

  args.GetReturnValue().Set(ret);
}

void setSaiColorHSV(const FunctionCallbackInfo<Value>& args) {
  auto h = args[0]->NumberValue();
  auto s = args[1]->NumberValue() * 255;
  auto v = args[2]->NumberValue() * 255;
  thisHook->postMessage(WM_SAI_COLOR_HSV, 1, MakeHSV(h, s, v));
}

void start(void *arg) {
  // should register hook and unhook in the same thread,
  // so DO NOT initialize it in the global context
  thisHook = new SaiHooker(GetMsgProc, CallWndRetProc);

  HMODULE hInst;
  GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, (char *) GetMsgProc, &hInst);

  auto hWnd = CreateWindow("STATIC", WINDOW_TITLE_UUID, 0,
    0, 0, 0, 0, HWND_MESSAGE, NULL, hInst, NULL);
  SetWindowLongPtr(hWnd, GWLP_WNDPROC, (LONG_PTR) WindowProc);

  MSG msg;
  while (GetMessage(&msg, NULL, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }
}

void init(Local<Object> exports) {
  // event emitter
  thisEmitter = new EventEmitter(MsgHandler);

  // start a new thread to handle events from hooks
  uv_thread_t thread;
  uv_thread_create(&thread, start, NULL);

  NODE_SET_METHOD(exports, "isOK", isOK);
  NODE_SET_METHOD(exports, "start", start);
  // should offer this `destroy` method as node::AtExit is not really working
  // see https://github.com/nodejs/node/issues/1894
  NODE_SET_METHOD(exports, "destroy", destroy);

  NODE_SET_METHOD(exports, "on", on);
  NODE_SET_METHOD(exports, "off", off);

  NODE_SET_METHOD(exports, "activateSaiWindow", activateSaiWindow);

  NODE_SET_METHOD(exports, "getSaiCanvasZoom", getSaiCanvasZoom);
  NODE_SET_METHOD(exports, "setSaiCanvasZoom", setSaiCanvasZoom);
  NODE_SET_METHOD(exports, "getSaiCanvasRotation", getSaiCanvasRotation);
  NODE_SET_METHOD(exports, "setSaiCanvasRotation", setSaiCanvasRotation);
  NODE_SET_METHOD(exports, "getSaiColorHSV", getSaiColorHSV);
  NODE_SET_METHOD(exports, "setSaiColorHSV", setSaiColorHSV);
}

NODE_MODULE(hook, init);