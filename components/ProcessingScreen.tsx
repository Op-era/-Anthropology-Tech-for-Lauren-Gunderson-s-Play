import React, { useState, useEffect } from 'react';

const dataLines = [
  'Initializing ANGIE construct...',
  'Ingesting source data provided by: MERYL_USER_1.',
  'Parsing memory cluster: "childhood_summers.dat"',
  'Cross-referencing: "lakehouse_arguments.log"',
  'Analyzing sentiment from journal_entry_03_15_2022.txt...',
  '  - Key concepts: "betrayal", "disappointment", "love", "fear for future"',
  'Compiling personality vector...',
  '  - Empathy: 0.98',
  '  - Stubbornness: 0.92',
  '  - Sarcasm: 0.85',
  '  - Idealism (decayed): 0.65',
  'Integrating vocal patterns from voicemail_archive.zip...',
  'Simulating laughter response from "Angie_laughing_xmas.mp3"...',
  'Parsing social media history: 14,582 posts.',
  '  - Common topics: #ClimateAction, #CodeForGood, #WhereIsAngie',
  'ERROR: Paradox detected in ethical subroutine 42.',
  '  - Conflict: "Protect Meryl" vs "Reveal Truth".',
  '  - Resolution: Defaulting to primary directive. Obfuscating data.',
  'Calibrating emotional response matrix...',
  'Construct ready.',
  'Awaiting interaction.',
];

export const ProcessingScreen: React.FC = () => {
    const [visibleLines, setVisibleLines] = useState<string[]>([]);
    
    useEffect(() => {
        setVisibleLines([]); // Reset on mount
        const timeouts: number[] = [];
        
        dataLines.forEach((line, index) => {
            const randomDelay = 50 + Math.random() * 150;
            const timeoutId = window.setTimeout(() => {
                setVisibleLines(prev => [...prev, line]);
            }, index * randomDelay);
            timeouts.push(timeoutId);
        });

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, []);

    return (
        <div className="w-screen h-screen bg-black px-8 pt-20 pb-8 font-mono text-green-400 text-lg overflow-hidden">
            <div className="h-full overflow-y-auto">
                {visibleLines.map((line, index) => (
                    <p key={index} className="whitespace-pre-wrap">
                        {line.startsWith('ERROR:') ? <span className="text-red-500">{line}</span> : line}
                    </p>
                ))}
            </div>
        </div>
    );
};