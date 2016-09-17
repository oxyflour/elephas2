/*
 * http://msdn.microsoft.com/en-us/library/windows/desktop/dd371408(v=vs.85).aspx
 */

#ifndef __CManipulationEvents_H__
#define __CManipulationEvents_H__

// Manipulation Header Files
#include <comdef.h>
#include <manipulations.h>
#include <ocidl.h>

#define WM_MANIP_BEGIN  (WM_USER + WM_TOUCH + 1)
#define WM_MANIP_MOVE   (WM_USER + WM_TOUCH + 2)
#define WM_MANIP_TRANS  (WM_USER + WM_TOUCH + 3)
#define WM_MANIP_SCALE  (WM_USER + WM_TOUCH + 4)
#define WM_MANIP_END    (WM_USER + WM_TOUCH + 9)

class CManipulationEventSink : _IManipulationEvents
{
public:
    CManipulationEventSink(IManipulationProcessor *manip);

    int GetStartedEventCount();
    int GetDeltaEventCount();
    int GetCompletedEventCount();
    double CManipulationEventSink::GetX();
    double CManipulationEventSink::GetY();        

    ~CManipulationEventSink();

    //////////////////////////////
    // IManipulationEvents methods
    //////////////////////////////
    virtual HRESULT STDMETHODCALLTYPE ManipulationStarted( 
        /* [in] */ FLOAT x,
        /* [in] */ FLOAT y);
    
    virtual HRESULT STDMETHODCALLTYPE ManipulationDelta( 
        /* [in] */ FLOAT x,
        /* [in] */ FLOAT y,
        /* [in] */ FLOAT translationDeltaX,
        /* [in] */ FLOAT translationDeltaY,
        /* [in] */ FLOAT scaleDelta,
        /* [in] */ FLOAT expansionDelta,
        /* [in] */ FLOAT rotationDelta,
        /* [in] */ FLOAT cumulativeTranslationX,
        /* [in] */ FLOAT cumulativeTranslationY,
        /* [in] */ FLOAT cumulativeScale,
        /* [in] */ FLOAT cumulativeExpansion,
        /* [in] */ FLOAT cumulativeRotation);
    
    virtual HRESULT STDMETHODCALLTYPE ManipulationCompleted( 
        /* [in] */ FLOAT x,
        /* [in] */ FLOAT y,
        /* [in] */ FLOAT cumulativeTranslationX,
        /* [in] */ FLOAT cumulativeTranslationY,
        /* [in] */ FLOAT cumulativeScale,
        /* [in] */ FLOAT cumulativeExpansion,
        /* [in] */ FLOAT cumulativeRotation);

    ////////////////////////////////////////////////////////////
    // IUnknown methods
    ////////////////////////////////////////////////////////////
    STDMETHOD_(ULONG, AddRef)(void);
    STDMETHOD_(ULONG, Release)(void);
    STDMETHOD(QueryInterface)(REFIID riid, LPVOID *ppvObj);

private:
    double m_fX;
    double m_fY;

    int m_cRefCount;
    int m_cStartedEventCount;
    int m_cDeltaEventCount;
    int m_cCompletedEventCount;

    IManipulationProcessor* m_pManip;

    IConnectionPointContainer* m_pConPointContainer;
    IConnectionPoint* m_pConnPoint;
};     

#endif