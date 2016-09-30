#include "TouchManipulation.h"
#include <manipulations_i.c>

TouchManipulation::TouchManipulation(int msgVal): msgVal(msgVal), ptCount(0), refCount(0) {
  CoInitialize(0);

  CoCreateInstance(CLSID_ManipulationProcessor, NULL,
    CLSCTX_INPROC_SERVER, IID_IUnknown, (VOID**)(&manipulateProc));
  if (manipulateProc == NULL) {
    return;
  }

  IConnectionPointContainer* pConnectionContainer;
  manipulateProc->QueryInterface(IID_IConnectionPointContainer, (VOID**) &pConnectionContainer);
  if (pConnectionContainer == NULL) {
    return;
  }

  IConnectionPoint* pConnPoint;
  pConnectionContainer->FindConnectionPoint(__uuidof(_IManipulationEvents), &pConnPoint);
  if (pConnPoint == NULL) {
    return;
  }

  DWORD dwCookie;
  pConnPoint->Advise(this, &dwCookie);
}

HRESULT TouchManipulation::ProcessDownWithTime(MANIPULATOR_ID id, FLOAT x, FLOAT y, DWORD time) {
  manipulateProc->ProcessDownWithTime(id, x, y, time);
  ptCount ++;
  PostMessage(NULL, msgVal, ptCount, MAKELPARAM(x, y));
  return S_OK;
}

HRESULT TouchManipulation::ProcessMoveWithTime(MANIPULATOR_ID id, FLOAT x, FLOAT y, DWORD time) {
  manipulateProc->ProcessMoveWithTime(id, x, y, time);
  return S_OK;
}

HRESULT TouchManipulation::ProcessUpWithTime(MANIPULATOR_ID id, FLOAT x, FLOAT y, DWORD time) {
  manipulateProc->ProcessUpWithTime(id, x, y, time);
  ptCount = ptCount > 0 ? ptCount - 1 : 0;
  PostMessage(NULL, msgVal + 2, ptCount, MAKELPARAM(x, y));
  if (ptCount == 0) {
    manipulateProc->CompleteManipulation();
  }
  return S_OK;
}

HRESULT STDMETHODCALLTYPE TouchManipulation::ManipulationStarted(FLOAT x, FLOAT y) {
  return S_OK;
}

HRESULT STDMETHODCALLTYPE TouchManipulation::ManipulationDelta(FLOAT x, FLOAT y,
  FLOAT translationDeltaX, FLOAT translationDeltaY,
  FLOAT scaleDelta, FLOAT expansionDelta, FLOAT rotationDelta,
  FLOAT cumulativeTranslationX, FLOAT cumulativeTranslationY,
  FLOAT cumulativeScale, FLOAT cumulativeExpansion, FLOAT cumulativeRotation) {
  PostMessage(NULL, msgVal + 1,
    MAKELONG(cumulativeScale * 100, cumulativeRotation * 100),
    MAKELPARAM(cumulativeTranslationX, cumulativeTranslationY));
  return S_OK;
}

HRESULT STDMETHODCALLTYPE TouchManipulation::ManipulationCompleted(FLOAT x, FLOAT y,
  FLOAT cumulativeTranslationX, FLOAT cumulativeTranslationY,
  FLOAT cumulativeScale, FLOAT cumulativeExpansion, FLOAT cumulativeRotation) {
  return S_OK;
}


ULONG TouchManipulation::AddRef(void) {
  return ++ refCount;
}

ULONG TouchManipulation::Release(void)
{ 
  refCount --;
  if(refCount == 0) {
    delete this;
    return 0;
  }
  return refCount;
}

HRESULT TouchManipulation::QueryInterface(REFIID riid, LPVOID *ppvObj) 
{
  if (IID__IManipulationEvents == riid) {
    *ppvObj = (_IManipulationEvents *)(this); AddRef(); return S_OK;
  } else if (IID_IUnknown == riid) {
    *ppvObj = (IUnknown *)(this); AddRef(); return S_OK;
  } else {
    return E_NOINTERFACE;
  }
}         
