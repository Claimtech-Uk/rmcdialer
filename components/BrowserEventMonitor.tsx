'use client';

import { useEffect, useState } from 'react';

interface BrowserEvent {
  type: string;
  timestamp: Date;
  details?: string;
}

export function BrowserEventMonitor({ enabled = false }: { enabled?: boolean }) {
  const [events, setEvents] = useState<BrowserEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const addEvent = (type: string, details?: string) => {
      setEvents(prev => [
        { type, timestamp: new Date(), details },
        ...prev.slice(0, 19) // Keep last 20 events
      ]);
    };

    // Monitor all browser events that could affect agent availability
    const handlers = {
      beforeunload: () => addEvent('beforeunload', 'Browser/tab closing'),
      unload: () => addEvent('unload', 'Page unloading'),
      visibilitychange: () => addEvent('visibilitychange', `Hidden: ${document.hidden}`),
      online: () => addEvent('online', 'Network connection restored'),
      offline: () => addEvent('offline', 'Network connection lost'),
      focus: () => addEvent('focus', 'Window gained focus'),
      blur: () => addEvent('blur', 'Window lost focus'),
      pagehide: () => addEvent('pagehide', 'Page hidden (might be discarded)'),
      pageshow: () => addEvent('pageshow', 'Page shown'),
      freeze: () => addEvent('freeze', 'Page frozen'),
      resume: () => addEvent('resume', 'Page resumed from freeze')
    };

    // Add listeners
    Object.entries(handlers).forEach(([event, handler]) => {
      if (event === 'visibilitychange') {
        document.addEventListener(event, handler);
      } else {
        window.addEventListener(event as keyof WindowEventMap, handler);
      }
    });

    addEvent('monitor-started', 'Browser event monitoring enabled');

    return () => {
      // Remove listeners
      Object.entries(handlers).forEach(([event, handler]) => {
        if (event === 'visibilitychange') {
          document.removeEventListener(event, handler);
        } else {
          window.removeEventListener(event as keyof WindowEventMap, handler);
        }
      });
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-lg text-xs z-50"
      >
        Browser Events ({events.length})
      </button>

      {/* Event log panel */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 w-80 max-h-96 bg-white border shadow-lg rounded-lg z-50 overflow-hidden">
          <div className="bg-gray-800 text-white p-2 text-sm font-medium">
            Browser Event Monitor
            <button
              onClick={() => setEvents([])}
              className="float-right text-xs bg-gray-600 px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {events.length === 0 ? (
              <div className="text-gray-500 text-sm">No events captured</div>
            ) : (
              events.map((event, index) => (
                <div
                  key={index}
                  className={`text-xs p-1 mb-1 rounded ${
                    event.type === 'offline' || event.type === 'beforeunload' 
                      ? 'bg-red-50 text-red-800'
                      : event.type === 'online' || event.type === 'focus'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="font-medium">{event.type}</div>
                  <div className="text-gray-600">
                    {event.timestamp.toLocaleTimeString()}
                  </div>
                  {event.details && (
                    <div className="text-gray-700">{event.details}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}