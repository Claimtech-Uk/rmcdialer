import React from 'react';
import { useParams } from 'react-router-dom';

export function CallPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">📞 Call Interface</h1>
            <p className="text-gray-600">Session ID: {sessionId}</p>
            <p className="text-gray-600">Call interface will be implemented here</p>
          </div>
        </div>
      </div>
    </div>
  );
} 