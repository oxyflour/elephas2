#include "EventEmitter.h"

static void handler(uv_async_t* handle) {
  ((EventEmitter *) handle->data)->handle();
}

EventEmitter::EventEmitter(MSG_HANDLER msgHandler)
  : msgHandler(msgHandler) {
  uv_async_init(uv_default_loop(), &async, handler);
}

void EventEmitter::on(Local<String> event, Local<Function>& func) {
  auto &cbs = map[*Utf8String(event)];
  auto &find = std::find_if(cbs.begin(), cbs.end(),
    [&](const CP &m) -> bool { return m == func; });
  if (find == cbs.end()) {
    cbs.push_back(CP(Isolate::GetCurrent(), func));
  }
}

void EventEmitter::off(Local<String> event, Local<Function>& func) {
  auto &cbs = map[*Utf8String(event)];
  auto &find = std::find_if(cbs.begin(), cbs.end(),
    [&](const CP &m) -> bool { return m == func; });
  if (find != cbs.end()) {
    cbs.erase(find);
  }
}

void EventEmitter::emit(char *event, Local<Value> args[], int argc) {
  auto &cbs = map[event];
  auto *isolate = Isolate::GetCurrent();
  auto null = v8::Null(isolate);
  for (auto const &cb : cbs) {
    Local<Function>::New(isolate, cb)->Call(null, argc, args);
  }
}

void EventEmitter::handle() {
  lock_guard<mutex> lk(locker);
  while (!events.empty()) {
    auto msg = events.front();
    msgHandler(msg.message, msg.wParam, msg.lParam);
    events.pop();
  }
}

void EventEmitter::trigger(UINT message, WPARAM wParam, LPARAM lParam) {
  lock_guard<mutex> lk(locker);
  MSG msg = { NULL, message, wParam, lParam };
  events.push(msg);
  async.data = (void *) this;
  uv_async_send(&async);
}
