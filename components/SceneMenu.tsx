import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  typingSpeed: number;
  liveVideoSource: 'local' | 'vdoninja';
  localCameraId: string | null;
  onNewScript: (file: File) => void;
  onNewVideos: (files: FileList) => void;
  onNewAudio: (files: FileList) => void;
  onSaveVdoNinjaUrl: (url: string) => void;
  onSaveTypingSpeed: (speed: number) => void;
  onSaveLiveVideoSource: (source: 'local' | 'vdoninja') => void;
  onSaveLocalCameraId: (id: string | null) => void;
  onClearData: () => void;
}

const CameraPreview: React.FC<{
    source: 'local' | 'vdoninja';
    localCameraId: string | null;
    vdoNinjaUrl: string | null;
}> = ({ source, localCameraId, vdoNinjaUrl }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // VDO.Ninja Preview Logic
    const augmentedUrl = useMemo(() => {
        if (source !== 'vdoninja' || !vdoNinjaUrl) return null;
        try {
            const url = new URL(vdoNinjaUrl);
            url.searchParams.set('autoplay', 'true');
            url.searchParams.set('nointerface', '1');
            url.searchParams.set('bgc', '000000');
            url.searchParams.set('mute', 'true'); // Mute preview
            return url.toString();
        } catch (e) {
            return vdoNinjaUrl;
        }
    }, [vdoNinjaUrl, source]);
    
    // Local Camera Preview Logic
    useEffect(() => {
        if (source !== 'local' || !localCameraId) {
             setStream(currentStream => {
                if (currentStream) {
                    currentStream.getTracks().forEach(track => track.stop());
                }
                return null;
            });
            return;
        }
        
        let active = true;
        const startStream = async () => {
             try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: localCameraId } },
                });
                if (active) {
                    setStream(newStream);
                    if(videoRef.current) {
                        videoRef.current.srcObject = newStream;
                        videoRef.current.play().catch(e => console.error("Error playing preview video:", e));
                    }
                }
             } catch (err) {
                 console.error("Error starting camera preview stream:", err);
             }
        };
        startStream();

        return () => {
            active = false;
            setStream(currentStream => {
                if (currentStream) {
                    currentStream.getTracks().forEach(track => track.stop());
                }
                return null;
            });
        }

    }, [source, localCameraId]);

    if (source === 'vdoninja') {
        if (!augmentedUrl) return null;
        return (
             <iframe
                key={augmentedUrl}
                src={augmentedUrl}
                allow="camera; microphone; autoplay; fullscreen; display-capture"
                className="w-full h-full border-0"
                title="VDO.Ninja Preview"
            ></iframe>
        )
    }

    if (source === 'local') {
        if (!localCameraId) return null;
        return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
    }

    return null;
};


const MenuButton: React.FC<{onClick: () => void, children: React.ReactNode, className?: string}> = ({ onClick, children, className }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 rounded-md hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${className}`}
    >
        {children}
    </button>
);

const VDO_NINJA_BASE_URL = 'https://vdo.ninja/?view=';

export const SceneMenu: React.FC<SceneMenuProps> = (props) => {
  const { 
    isOpen, onClose, scenes, onSelectScene, scriptName, videoCount, audioCount, vdoNinjaUrl, typingSpeed, 
    liveVideoSource, localCameraId, onNewScript, onNewVideos, onNewAudio, onSaveVdoNinjaUrl, onSaveTypingSpeed, 
    onSaveLiveVideoSource, onSaveLocalCameraId, onClearData 
  } = props;
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlSaved, setShowUrlSaved] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);

  // Effect to enumerate devices when the menu is opened
  useEffect(() => {
    if (isOpen) {
        setUrlInput(vdoNinjaUrl || VDO_NINJA_BASE_URL);
        setShowUrlSaved(false);
        setCameraPermissionError(null);
        
        const getDevices = async () => {
            if (!navigator.mediaDevices?.enumerateDevices) {
                setCameraPermissionError('Camera access is not supported by this browser.');
                return;
            }
            try {
                // A quick check stream is needed to prompt for permission and get device labels.
                // This stream is temporary and immediately stopped.
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());

                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
                
                setDevices(videoDevices);

                // Auto-select the first camera if the source is 'local' but no ID is set.
                if (liveVideoSource === 'local' && !localCameraId && videoDevices.length > 0) {
                     onSaveLocalCameraId(videoDevices[0].deviceId);
                }

            } catch (err) {
                console.error("Error enumerating video devices in menu:", err);
                 if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                    setCameraPermissionError('Camera permission was denied. Please grant access in your browser settings.');
                } else {
                    setCameraPermissionError('Could not access cameras.');
                }
                setDevices([]);
            }
        };
    
        getDevices();
    }
  }, [isOpen, liveVideoSource, localCameraId, onSaveLocalCameraId, vdoNinjaUrl]);

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
     e.target.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onNewVideos(e.target.files);
    }
     e.target.value = '';
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onNewAudio(e.target.files);
    }
     e.target.value = '';
  };

  const handleUrlSave = () => {
    const urlToSave = urlInput === VDO_NINJA_BASE_URL ? '' : urlInput;
    onSaveVdoNinjaUrl(urlToSave);
    setShowUrlSaved(true);
    setTimeout(() => setShowUrlSaved(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all saved script, video, and audio data? This action cannot be undone.')) {
      onClearData();
    }
  };

  const scriptLoaded = scriptName !== null;
  const videosLoaded = videoCount > 0;
  const audioLoaded = audioCount > 0;

  const showPreview = (liveVideoSource === 'local' && localCameraId) || (liveVideoSource === 'vdoninja' && vdoNinjaUrl);

  return (
    <div className="fixed inset-0 z-30 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black bg-opacity-60" onClick={onClose}></div>
      
      <div className={`relative flex flex-col w-96 max-w-[80vw] bg-gray-900 text-white shadow-xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-teal-400">Menu</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
                <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase mb-2">Settings</h3>
                <div className="px-4 py-3 space-y-3">
                    <label htmlFor="typing-speed" className="text-gray-300 flex justify-between items-center">
                        <span>Typing Speed</span>
                        <span className="font-mono text-teal-400">{typingSpeed.toFixed(1)}x</span>
                    </label>
                    <input
                        id="typing-speed"
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                        value={typingSpeed}
                        onChange={(e) => onSaveTypingSpeed(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
                <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase mb-2">Live Camera</h3>
                <div className="px-4 py-3 space-y-4">
                    <fieldset>
                        <legend className="sr-only">Live Video Source</legend>
                        <div className="flex space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="videoSource" value="local" checked={liveVideoSource === 'local'} onChange={() => onSaveLiveVideoSource('local')} className="form-radio h-4 w-4 text-teal-600 bg-gray-800 border-gray-600 focus:ring-teal-500" />
                                <span>Local Camera</span>
                            </label>
                             <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" name="videoSource" value="vdoninja" checked={liveVideoSource === 'vdoninja'} onChange={() => onSaveLiveVideoSource('vdoninja')} className="form-radio h-4 w-4 text-teal-600 bg-gray-800 border-gray-600 focus:ring-teal-500" />
                                <span>VDO.Ninja</span>
                            </label>
                        </div>
                    </fieldset>

                    {liveVideoSource === 'local' && (
                        <div>
                            <label htmlFor="local-camera-select" className="text-gray-300 mb-2 block">Select Camera</label>
                            {cameraPermissionError && <p className="text-sm text-red-400 mb-2">{cameraPermissionError}</p>}
                            <select
                                id="local-camera-select"
                                value={localCameraId || ''}
                                onChange={(e) => onSaveLocalCameraId(e.target.value)}
                                disabled={devices.length === 0}
                                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50"
                            >
                                {devices.length === 0 ? (
                                    <option value="">{cameraPermissionError ? 'Permission Denied' : 'No cameras found'}</option>
                                ) : (
                                    devices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${devices.indexOf(device) + 1}`}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    )}

                    {liveVideoSource === 'vdoninja' && (
                        <div>
                            <label htmlFor="vdo-ninja-url" className="text-gray-300">VDO.Ninja URL</label>
                            <input
                                id="vdo-ninja-url"
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder={VDO_NINJA_BASE_URL}
                                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                            />
                             <div className="flex items-center mt-2 space-x-2">
                                <button onClick={handleUrlSave} className="flex-grow text-center px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-500 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-300">
                                    Save URL
                                </button>
                                {showUrlSaved && <span className="text-green-400 transition-opacity duration-300">Saved!</span>}
                            </div>
                        </div>
                    )}
                    
                    {showPreview && (
                        <div className="mt-4">
                            <label className="text-gray-400 text-sm mb-2 block">Live Preview</label>
                             <div className="aspect-video w-full bg-black rounded-md overflow-hidden border border-gray-700">
                                <CameraPreview
                                    source={liveVideoSource}
                                    localCameraId={localCameraId}
                                    vdoNinjaUrl={vdoNinjaUrl}
                                />
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
                <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase mb-2">File Management</h3>
                <div className="px-4 py-2 text-sm text-gray-400 bg-black/20 rounded-md mb-2">
                    <p>Script: <span className="font-bold text-gray-200">{scriptName || 'Not loaded'}</span></p>
                    <p>Videos: <span className="font-bold text-gray-200">{videoCount} file(s) loaded</span></p>
                    <p>Dialogue Audio: <span className="font-bold text-gray-200">{audioCount} file(s) loaded</span></p>
                </div>
                <input type="file" ref={scriptInputRef} onChange={handleScriptChange} accept=".txt" className="hidden" />
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