#include <comdef.h>
#include <manipulations.h>
#include <ocidl.h>

class TouchManipulation : _IManipulationEvents {
private:
  int msgVal;

  IManipulationProcessor* manipulateProc;
  int refCount;

  int ptCount;

public:
  TouchManipulation(int msgVal);

  HRESULT ProcessDownWithTime(MANIPULATOR_ID id, FLOAT x, FLOAT y, DWORD time);
  HRESULT ProcessMoveWithTime(MANIPULATOR_ID id, FLOAT x, FLOAT y, DWORD time);
  HRESULT ProcessUpWithTime(MANIPULATOR_ID id, FLOAT x, FLOAT y, DWORD time);

  // _IManipulationEvents
  virtual HRESULT STDMETHODCALLTYPE ManipulationStarted(FLOAT x, FLOAT y);
  virtual HRESULT STDMETHODCALLTYPE ManipulationDelta(FLOAT x, FLOAT y,
    FLOAT translationDeltaX, FLOAT translationDeltaY,
    FLOAT scaleDelta, FLOAT expansionDelta, FLOAT rotationDelta,
    FLOAT cumulativeTranslationX, FLOAT cumulativeTranslationY,
    FLOAT cumulativeScale, FLOAT cumulativeExpansion, FLOAT cumulativeRotation);
  virtual HRESULT STDMETHODCALLTYPE ManipulationCompleted(FLOAT x, FLOAT y,
    FLOAT cumulativeTranslationX, FLOAT cumulativeTranslationY,
    FLOAT cumulativeScale, FLOAT cumulativeExpansion, FLOAT cumulativeRotation);

  // IUnknown
  STDMETHOD_(ULONG, AddRef)(void);
  STDMETHOD_(ULONG, Release)(void);
  STDMETHOD(QueryInterface)(REFIID riid, LPVOID *ppvObj);
};