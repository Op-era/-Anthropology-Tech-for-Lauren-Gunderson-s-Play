import React from 'react';

const ScriptLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <p className="font-title text-3xl text-green-400 animate-pulse">Loading Script...</p>
    </div>
  );
};

export default ScriptLoader;
