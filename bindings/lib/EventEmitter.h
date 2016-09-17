#include <map>
#include <queue>
#include <vector>
#include <string>
#include <mutex>

#include <node.h>
#include <v8.h>
#include <nan.h>

#include <windows.h>

using v8::Value;
using v8::Isolate;
using v8::Local;
using v8::Function;
using v8::String;

using std::map;
using std::queue;
using std::vector;
using std::string;
using std::mutex;
using std::lock_guard;

using Nan::Utf8String;

using CP = Nan::CopyablePersistentTraits<Function>::CopyablePersistent;
typedef VOID (* MSG_HANDLER)(UINT uMsg, WPARAM wParam, LPARAM lParam);

class EventEmitter {
private:
  map<string, vector<CP>> map;
  uv_async_t async;
  queue<MSG> events;
  mutex locker;
  MSG_HANDLER msgHandler;

public:
  EventEmitter(MSG_HANDLER AsyncHandler);
  void on(Local<String> event, Local<Function>& func);
  void off(Local<String> event, Local<Function>& func);
  void emit(char* event, Local<Value> args[], int argc);
  void handle();
  void trigger(UINT message, WPARAM wParam, LPARAM lParam);
};
