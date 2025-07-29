'use client';

import { useEffect, useState } from 'react';

export function DebugOverlayFinder() {
  const [overlays, setOverlays] = useState<Array<{
    element: HTMLElement;
    classes: string;
    zIndex: string;
    description: string;
  }>>([]);

  useEffect(() => {
    const findOverlays = () => {
      // Look for common overlay patterns
      const selectors = [
        '[class*="backdrop-blur"]',
        '[class*="fixed"][class*="inset-0"]',
        '[data-state="open"]',
        '.fixed.inset-0',
        '[style*="backdrop-filter"]',
        '[style*="z-index"]'
      ];

      const foundOverlays: Array<any> = [];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
        elements.forEach(el => {
          const computedStyle = window.getComputedStyle(el);
          const zIndex = computedStyle.zIndex;
          const position = computedStyle.position;
          const backdropFilter = computedStyle.backdropFilter;
          
          // Only include elements that could be overlays
          if (position === 'fixed' || position === 'absolute') {
            if (zIndex !== 'auto' || backdropFilter !== 'none' || el.className.includes('backdrop-blur')) {
              foundOverlays.push({
                element: el,
                classes: el.className,
                zIndex: zIndex,
                description: `${el.tagName} - ${selector}`
              });
            }
          }
        });
      });

      setOverlays(foundOverlays);
    };

    findOverlays();
    
    // Re-scan every 2 seconds
    const interval = setInterval(findOverlays, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const removeOverlay = (element: HTMLElement) => {
    element.style.display = 'none';
    setOverlays(prev => prev.filter(o => o.element !== element));
  };

  const resetOverlay = (element: HTMLElement) => {
    element.style.display = '';
  };

  // Show always for debugging (temporarily)
  // if (process.env.NODE_ENV === 'production') {
  //   return null;
  // }

  return (
    <div className="fixed top-4 left-4 z-[9999] bg-white border border-red-500 p-4 rounded-lg shadow-lg max-w-md max-h-96 overflow-y-auto">
      <h3 className="font-bold text-red-600 mb-2">🔍 Debug: Found Overlays ({overlays.length})</h3>
      
      {overlays.length === 0 ? (
        <p className="text-sm text-gray-600">No overlay elements detected</p>
      ) : (
        <div className="space-y-2">
          {overlays.map((overlay, index) => (
            <div key={index} className="border border-gray-200 p-2 rounded text-xs">
              <div className="font-semibold">{overlay.description}</div>
              <div className="text-gray-600 truncate">z-index: {overlay.zIndex}</div>
              <div className="text-gray-600 truncate">classes: {overlay.classes.substring(0, 50)}...</div>
              <div className="flex gap-1 mt-1">
                <button 
                  onClick={() => removeOverlay(overlay.element)}
                  className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                >
                  Hide
                </button>
                <button 
                  onClick={() => resetOverlay(overlay.element)}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
                >
                  Show
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <button 
        onClick={() => {
          // Remove all backdrop-blur elements
          document.querySelectorAll('[class*="backdrop-blur"]').forEach(el => {
            (el as HTMLElement).style.display = 'none';
          });
        }}
        className="w-full mt-2 bg-red-600 text-white px-2 py-1 rounded text-sm font-bold"
      >
        🚨 REMOVE ALL BLUR OVERLAYS
      </button>
    </div>
  );
} 