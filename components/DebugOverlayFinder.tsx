'use client';

import { useEffect, useState } from 'react';

export function DebugOverlayFinder() {
  const [overlays, setOverlays] = useState<Array<{
    element: HTMLElement;
    classes: string;
    zIndex: string;
    description: string;
    isProblematic: boolean;
  }>>([]);

  useEffect(() => {
    const findOverlays = () => {
      // Look for problematic overlay patterns (stuck modals, not legitimate UI)
      const problematicSelectors = [
        '[data-state="open"][class*="fixed"][class*="inset-0"]', // Stuck dialog overlays
        '[class*="fixed"][class*="inset-0"][class*="z-50"]',     // High z-index full screen
        '[class*="fixed"][class*="inset-0"][class*="z-40"]',     // High z-index full screen
      ];

      // Also find legitimate UI elements for comparison
      const legitimateSelectors = [
        '[class*="backdrop-blur"]:not([class*="fixed"])',       // Cards and UI elements
        '[class*="bg-white"][class*="backdrop-blur"]',          // UI cards
      ];

      const foundOverlays: Array<any> = [];

      // Find problematic overlays
      problematicSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
        elements.forEach(el => {
          const computedStyle = window.getComputedStyle(el);
          foundOverlays.push({
            element: el,
            classes: el.className,
            zIndex: computedStyle.zIndex || 'auto',
            description: `🚨 PROBLEMATIC: ${selector}`,
            isProblematic: true
          });
        });
      });

      // Find legitimate UI for comparison (limited to first 3)
      legitimateSelectors.forEach(selector => {
        const elements = Array.from(document.querySelectorAll(selector) as NodeListOf<HTMLElement>).slice(0, 3);
        elements.forEach(el => {
          const computedStyle = window.getComputedStyle(el);
          foundOverlays.push({
            element: el,
            classes: el.className,
            zIndex: computedStyle.zIndex || 'auto',
            description: `✅ Legitimate UI: ${selector}`,
            isProblematic: false
          });
        });
      });

      setOverlays(foundOverlays);
    };

    findOverlays();
    const interval = setInterval(findOverlays, 2000);
    return () => clearInterval(interval);
  }, []);

  const hideElement = (element: HTMLElement) => {
    element.style.display = 'none';
    setOverlays(prev => prev.filter(o => o.element !== element));
  };

  const removeElement = (element: HTMLElement) => {
    element.remove();
    setOverlays(prev => prev.filter(o => o.element !== element));
  };

  const removeAllProblematicOverlays = () => {
    const problematicOverlays = overlays.filter(o => o.isProblematic);
    problematicOverlays.forEach(overlay => {
      overlay.element.remove();
    });
    setOverlays(prev => prev.filter(o => !o.isProblematic));
    console.log(`✅ Removed ${problematicOverlays.length} problematic overlays`);
  };

  // Show always for debugging (temporarily)
  // if (process.env.NODE_ENV === 'production') {
  //   return null;
  // }

  if (overlays.length === 0) {
    return (
      <div className="fixed top-4 left-4 z-[9999] bg-green-500 text-white p-2 rounded text-xs">
        ✅ No problematic overlays found!
      </div>
    );
  }

  const problematicCount = overlays.filter(o => o.isProblematic).length;

  return (
    <div className="fixed top-4 left-4 z-[9999] bg-red-500 text-white p-3 rounded-lg text-xs max-w-md max-h-96 overflow-auto">
      <h3 className="font-bold mb-2">🐛 Overlay Debug Tool</h3>
      <p className="mb-2">Found {overlays.length} elements ({problematicCount} problematic)</p>
      
      {problematicCount > 0 && (
        <button 
          onClick={removeAllProblematicOverlays}
          className="mb-3 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-bold"
        >
          🗑️ REMOVE PROBLEMATIC OVERLAYS ONLY
        </button>
      )}

      <div className="space-y-2 max-h-60 overflow-auto">
        {overlays.map((overlay, i) => (
          <div key={i} className={`p-2 rounded border-l-4 ${overlay.isProblematic ? 'border-red-300 bg-red-100' : 'border-green-300 bg-green-100'}`}>
            <div className="text-xs text-gray-800">
              <strong>{overlay.description}</strong>
            </div>
            <div className="text-xs text-gray-600 mt-1 break-all">
              Classes: {overlay.classes.substring(0, 100)}...
            </div>
            <div className="text-xs text-gray-600">Z-Index: {overlay.zIndex}</div>
            <div className="mt-1 space-x-1">
              <button 
                onClick={() => hideElement(overlay.element)}
                className="px-1 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
              >
                Hide
              </button>
              {overlay.isProblematic && (
                <button 
                  onClick={() => removeElement(overlay.element)}
                  className="px-1 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 