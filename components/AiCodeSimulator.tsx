import React, { useState, useEffect, useRef } from 'react';
import { fakeAiCode } from '../services/fakeAiCode';

interface AiCodeSimulatorProps {
  errorLevel: number;
}

const SPEEDS = [1, 5, 15, 40, 80]; // Characters per animation frame
const COLORS = ['text-green-400', 'text-yellow-400', 'text-orange-500', 'text-red-500', 'text-red-400'];

export const AiCodeSimulator: React.FC<AiCodeSimulatorProps> = ({ errorLevel }) => {
  const [displayedCode, setDisplayedCode] = useState('');
  const codeIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // FIX: Explicitly initialize useRef with `undefined`. The no-argument version can cause a "Expected 1 arguments, but got 0" error with some TypeScript configurations.
  const animationFrameIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const animateTyping = () => {
      const speed = SPEEDS[Math.min(errorLevel, SPEEDS.length - 1)];
      const currentCodeIndex = codeIndexRef.current;
      
      const nextChunk = fakeAiCode.substring(currentCodeIndex, currentCodeIndex + speed);
      
      setDisplayedCode(prev => prev + nextChunk);

      let nextIndex = currentCodeIndex + speed;
      // Loop back to the beginning if we reach the end
      if (nextIndex >= fakeAiCode.length) {
        nextIndex = 0;
        // Reset displayed code for a clean loop, but delay it slightly 
        // to avoid a flash of empty screen on very fast speeds.
        setTimeout(() => setDisplayedCode(''), 100);
      }
      codeIndexRef.current = nextIndex;

      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }

      animationFrameIdRef.current = requestAnimationFrame(animateTyping);
    };

    // Clear previous animation frame and reset state when errorLevel changes
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(animateTyping);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [errorLevel]);
  
  // Reset index when component unmounts or is hidden
  useEffect(() => {
    return () => {
        codeIndexRef.current = 0;
        setDisplayedCode('');
    }
  }, []);

  const colorClass = COLORS[Math.min(errorLevel, COLORS.length - 1)];
  const codeClasses = `font-mono text-sm whitespace-pre-wrap transition-colors duration-300 ${colorClass}`;
  const isError = errorLevel > 0;

  return (
    <div className="w-screen h-screen bg-black flex flex-col">
      <div className="p-2 bg-gray-800 text-gray-300 text-center font-bold border-b border-teal-500">
        AI CONSTRUCT LIVE TRACE: ANGIE_v1.3
      </div>
      <div ref={containerRef} className="relative flex-1 overflow-y-auto p-4">
        <pre><code className={codeClasses}>{displayedCode}</code></pre>
      </div>
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
          <h1 className="text-9xl font-title text-red-500 animate-pulse drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
            ERROR!
          </h1>
        </div>
      )}
    </div>
  );
};
