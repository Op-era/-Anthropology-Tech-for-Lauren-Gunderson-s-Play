import React, { useState, useEffect } from 'react';

const codeLines = [
  'Booting Thespian Digital AI...',
  'Auth Sequence [INITIATED]',
  'Loading personality matrix: ANGIE_v1.3...',
  '[OK]',
  '// Acknowledging creators...',
  '// Author: Lauren Gunderson',
  '// Director: Allison Harrison',
  '// Systems Engineer: Shane Foster',
  ' ',
  'Parsing script nodes...',
  'Found 2 scenes, 54 dialogue lines.',
  'Establishing vocal synthesis link...',
  '[SECURE]',
  'Initializing speech recognition module...',
  'Listening for auditory cues on channel: USER_MIC_1',
  'All systems nominal.',
  'Ready for performance.',
  '>_',
];

export const CodeTransitionScreen: React.FC = () => {
    const [visibleLines, setVisibleLines] = useState<string[]>([]);
    
    useEffect(() => {
        setVisibleLines([]); // Reset on mount
        const timeouts: number[] = [];
        
        codeLines.forEach((line, index) => {
            const timeoutId = window.setTimeout(() => {
                setVisibleLines(prev => [...prev, line]);
            }, index * 150); // Stagger the appearance of each line
            timeouts.push(timeoutId);
        });

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, []);

    return (
        <div className="w-screen h-screen bg-black px-8 pt-20 pb-8 font-mono text-green-400 text-lg overflow-hidden">
            {visibleLines.map((line, index) => (
                <p key={index} className={line === '>_' ? 'animate-pulse' : ''}>
                    {line}
                </p>
            ))}
        </div>
    );
};