import React, { useRef, useState, useEffect } from 'react';
import { Scene } from '../types';

interface SceneMenuProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  onSelectScene: (index: number) => void;
  scriptName: string | null;
  videoCount: number;
  audioCount: number;
  vdoNinjaUrl: string | null;
  onNewScript: (file: File) => void;
  onNewVideos: (files: FileList) => void;
  onNewAudio: (files: FileList) => void;
  onSaveVdoNinjaUrl: (url: string) => void;
  onClearData: () => void;
}

const MenuButton: React.FC<{onClick: () => void, children: React.ReactNode, className?: string}> = ({ onClick, children, className }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 rounded-md hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${className}`}
    >
        {children}
    </button>
);

const VDO_NINJA_BASE_URL = 'https://vdo.ninja/?view=';

export const SceneMenu: React.FC<SceneMenuProps> = ({ isOpen, onClose, scenes, onSelectScene, scriptName, videoCount, audioCount, vdoNinjaUrl, onNewScript, onNewVideos, onNewAudio, onSaveVdoNinjaUrl, onClearData }) => {
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlSaved, setShowUrlSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setUrlInput(vdoNinjaUrl || VDO_NINJA_BASE_URL);
        setShowUrlSaved(false); // Reset confirmation on open
    }
  }, [isOpen, vdoNinjaUrl]);

  if (!isOpen) {
    return null;
  }
  
  const handleScriptClick = () => scriptInputRef.current?.click();
  const handleVideoClick = () => videoInputRef.current?.click();
  const handleAudioClick = () => audioInputRef.current?.click();

  const handleScriptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onNewScript(e.target.files[0]);
    }
     e.target.value = ''; // Reset input
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onNewVideos(e.target.files);
    }
     e.target.value = ''; // Reset input
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onNewAudio(e.target.files);
    }
     e.target.value = ''; // Reset input
  };

  const handleUrlSave = () => {
    // If the input only contains the base URL, treat it as empty and clear the setting.
    const urlToSave = urlInput === VDO_NINJA_BASE_URL ? '' : urlInput;
    onSaveVdoNinjaUrl(urlToSave);
    setShowUrlSaved(true);
    setTimeout(() => setShowUrlSaved(false), 2000); // Hide after 2 seconds
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all saved script, video, and audio data? This action cannot be undone.')) {
      onClearData();
    }
  };

  const scriptLoaded = scriptName !== null;
  const videosLoaded = videoCount > 0;
  const audioLoaded = audioCount > 0;

  return (
    <div className="fixed inset-0 z-30 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black bg-opacity-60" onClick={onClose}></div>
      
      <div className={`relative flex flex-col w-96 max-w-[80vw] bg-gray-900 text-white shadow-xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-teal-400">Menu</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
                <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase mb-2">Live Camera</h3>
                 <div className="px-4 py-3 space-y-2">
                    <label htmlFor="vdo-ninja-url" className="text-gray-300">VDO.Ninja URL</label>
                    <input
                        id="vdo-ninja-url"
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder={VDO_NINJA_BASE_URL}
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                     <div className="flex items-center mt-2 space-x-2">
                        <button onClick={handleUrlSave} className="flex-grow text-center px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-500 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-300">
                            Save URL
                        </button>
                        {showUrlSaved && <span className="text-green-400 transition-opacity duration-300">Saved!</span>}
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
                <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase mb-2">File Management</h3>
                <div className="px-4 py-2 text-sm text-gray-400 bg-black/20 rounded-md mb-2">
                    <p>Script: <span className="font-bold text-gray-200">{scriptName || 'Not loaded'}</span></p>
                    <p>Videos: <span className="font-bold text-gray-200">{videoCount} file(s) loaded</span></p>
                    <p>Dialogue Audio: <span className="font-bold text-gray-200">{audioCount} file(s) loaded</span></p>
                </div>
                <input type="file" ref={scriptInputRef} onChange={handleScriptChange} accept=".txt,.pdf,.docx" className="hidden" />
                <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" multiple className="hidden" />
                <input type="file" ref={audioInputRef} onChange={handleAudioChange} accept="audio/*" multiple className="hidden" />
                <ul className="space-y-2">
                    <li><MenuButton onClick={handleScriptClick}>{scriptLoaded ? 'Change Script' : 'Upload Script'}</MenuButton></li>
                    <li><MenuButton onClick={handleVideoClick}>{videosLoaded ? 'Change Videos' : 'Upload Videos'}</MenuButton></li>
                    <li><MenuButton onClick={handleAudioClick}>{audioLoaded ? 'Change Dialogue Audio' : 'Upload Dialogue Audio'}</MenuButton></li>
                    {(scriptLoaded || videosLoaded || audioLoaded || vdoNinjaUrl) && (
                        <li><MenuButton onClick={handleClear} className="text-red-400 hover:bg-red-900/50">Clear All Data</MenuButton></li>
                    )}
                </ul>
            </div>

            {scriptLoaded && (
                <div className="border-t border-gray-700 pt-4">
                    <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase mb-2">Scenes</h3>
                    <nav>
                        <ul>
                            {scenes.length > 0 ? (
                                scenes.map((scene) => (
                                    <li key={scene.index}>
                                        <MenuButton onClick={() => onSelectScene(scene.index)}>
                                            {scene.name}
                                        </MenuButton>
                                    </li>
                                ))
                            ) : (
                                <li className="px-4 py-3 text-gray-500">No scenes found in script.</li>
                            )}
                        </ul>
                    </nav>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};