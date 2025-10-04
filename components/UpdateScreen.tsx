import React from 'react';

const updateLines = [
  'System Update Required.',
  'Installing new features for ANGIE v1.3.1...',
  '  - Enhanced emotional matrix.',
  '  - Improved vocal synthesis latency.',
  '  - User interaction calibration needed.',
];

interface UpdateScreenProps {
  onContinue: () => void;
}

export const UpdateScreen: React.FC<UpdateScreenProps> = ({ onContinue }) => {
    return (
        <div className="w-screen h-screen bg-black px-8 pt-20 pb-8 font-mono text-green-400 text-lg flex flex-col items-center justify-center text-center">
            <div>
                {updateLines.map((line, index) => (
                    <p key={index} className="text-left max-w-xl">
                        {line}
                    </p>
                ))}
            </div>
            <button
                onClick={onContinue}
                className="mt-12 font-title text-3xl bg-green-500 hover:bg-green-400 text-black px-8 py-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-green-300 animate-pulse"
            >
                Calibrate and Continue
            </button>
        </div>
    );
};