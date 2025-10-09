import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PerformanceView } from './components/PerformanceView';
import { SceneMenu } from './components/SceneMenu';
import { usePerformanceManager } from './hooks/usePerformanceManager';
import { parseScript, COMPUTER_CHARACTER } from './services/scriptParser';
import * as storage from './services/storageService';
import { AppStatus, ScriptLine, VideoFile, AudioFile, ViewMode, LineType, PrerecordedVideoState } from './types';
import { CodeTransitionScreen } from './components/CodeTransitionScreen';
import { ProcessingScreen } from './components/ProcessingScreen';

const sortVideosByName = (files: File[]): File[] => {
    const idleVideoIndex = files.findIndex(f => f.name.toLowerCase().startsWith('idle'));
    if (idleVideoIndex > -1) {
        const idleVideo = files[idleVideoIndex];
        const otherVideos = files.filter((_, i) => i !== idleVideoIndex);
        otherVideos.sort((a, b) => {
            const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0');
            const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0');
            return numA - numB;
        });
        return [idleVideo, ...otherVideos];
    }
    return [...files].sort((a, b) => a.name.localeCompare(b.name));
};

const sortAudioByName = (files: File[]): File[] => {
    return [...files].sort((a, b) => {
        const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0');
        return numA - numB;
    });
};

const App: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.LOADING);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [script, setScript] = useState<ScriptLine[]>([]);
    const [videos, setVideos] = useState<VideoFile[]>([]);
    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const [scriptFile, setScriptFile] = useState<File | null>(null);
    const [vdoNinjaUrl, setVdoNinjaUrl] = useState<string | null>(null);
    const [typingSpeed, setTypingSpeed] = useState(1.0);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    
    // Centralized stream management state
    const [liveVideoSource, setLiveVideoSource] = useState<'local' | 'vdoninja'>('vdoninja');
    const [localCameraId, setLocalCameraId] = useState<string | null>(null);
    const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

    const {
        scenes,
        viewMode,
        videoState,
        displayedAngieLine,
        isComputerSpeaking,
        borderEffect,
        isLiveFeedActive,
        jumpToScene,
        onTypingComplete,
        onDialogueVideoEnd,
        onSpecificVideoEnd,
        shouldAdvance,
        resetAdvance,
        currentLine,
    } = usePerformanceManager(script, audioFiles, videos, currentLineIndex, status);

    // State ref for event listener to prevent stale closures
    const stateRef = useRef({
        status,
        isMenuOpen,
        script,
        isComputerSpeaking,
        viewMode,
        videoState,
        setIsMenuOpen, // Include setter to handle Escape key
    });

    useEffect(() => {
        stateRef.current = {
            status,
            isMenuOpen,
            script,
            isComputerSpeaking,
            viewMode,
            videoState,
            setIsMenuOpen,
        };
    }, [status, isMenuOpen, script, isComputerSpeaking, viewMode, videoState]);
    
    // Effect to manage the camera stream lifecycle centrally
    useEffect(() => {
        if (!isLiveFeedActive || liveVideoSource !== 'local' || !localCameraId) {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
                setActiveStream(null);
            }
            return;
        }

        let isCancelled = false;
        
        const startStream = async () => {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: localCameraId } } });
                
                if (!isCancelled) {
                    if (activeStream) {
                        activeStream.getTracks().forEach(track => track.stop());
                    }
                    setActiveStream(newStream);
                } else {
                    newStream.getTracks().forEach(track => track.stop());
                }
            } catch (err) {
                console.error("Failed to get camera stream in App:", err);
                if (!isCancelled) {
                    setActiveStream(null);
                }
            }
        };

        startStream();

        return () => {
            isCancelled = true;
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLiveFeedActive, liveVideoSource, localCameraId]);

    const advanceLine = useCallback(() => {
        setCurrentLineIndex(prev => {
            const currentScript = stateRef.current.script;
            for (let i = prev + 1; i < currentScript.length; i++) {
                const line = currentScript[i];
                if (line.type === LineType.CUE || (line.type === LineType.DIALOGUE && line.character === COMPUTER_CHARACTER)) {
                    return i;
                }
            }
            return prev;
        });
    }, []);
    
    const regressLine = useCallback(() => {
        setCurrentLineIndex(prev => {
            const currentScript = stateRef.current.script;
            for (let i = prev - 1; i >= 0; i--) {
                const line = currentScript[i];
                if (line.type === LineType.CUE || (line.type === LineType.DIALOGUE && line.character === COMPUTER_CHARACTER)) {
                    return i;
                }
            }
            return prev;
        });
    }, []);
    
    const callbackRef = useRef({ onSpecificVideoEnd, advanceLine, regressLine });
    useEffect(() => {
        callbackRef.current = { onSpecificVideoEnd, advanceLine, regressLine };
    }, [onSpecificVideoEnd, advanceLine, regressLine]);

    useEffect(() => {
        if (shouldAdvance) {
            advanceLine();
            resetAdvance();
        }
    }, [shouldAdvance, advanceLine, resetAdvance]);
    
    useEffect(() => {
        const loadStoredData = async () => {
            try {
                const scriptData = await storage.getScript();
                const videoData = await storage.getVideos();
                const audioData = await storage.getAudio();
                const urlData = await storage.getVdoNinjaUrl();
                const speedData = await storage.getTypingSpeed();
                const liveConfig = await storage.getLiveVideoConfig();

                if (scriptData) {
                    const storedScriptFile = new File([scriptData.text], scriptData.name);
                    setScript(parseScript(scriptData.text));
                    setScriptFile(storedScriptFile);
                }
                if (videoData) {
                    const videoFiles = videoData.map(file => ({ file, url: URL.createObjectURL(file) }));
                    setVideos(videoFiles);
                }
                if (audioData) {
                    const audioFileObjects = audioData.map(file => ({ file, url: URL.createObjectURL(file) }));
                    setAudioFiles(audioFileObjects);
                }
                if (urlData) {
                    setVdoNinjaUrl(urlData);
                }
                if (speedData !== null) {
                    setTypingSpeed(speedData);
                }
                if (liveConfig) {
                    setLiveVideoSource(liveConfig.source);
                    setLocalCameraId(liveConfig.localCameraId);
                }
            } catch (error) {
                console.error("Failed to load data from storage:", error);
            } finally {
                setStatus(AppStatus.TITLE_SCREEN);
            }
        };

        loadStoredData();
    }, []);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const { status, script, isMenuOpen, setIsMenuOpen } = stateRef.current;
            const { onSpecificVideoEnd, advanceLine, regressLine } = callbackRef.current;

            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
                if (e.key !== 'Escape') return;
            }

            if (isMenuOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsMenuOpen(false);
                }
                return;
            }
            
            if (e.code === 'Space' && (status !== AppStatus.PERFORMING)) {
                 if (script.length === 0) {
                    setIsMenuOpen(true);
                    return;
                }
                
                e.preventDefault();
                 if (!audioContextRef.current && status === AppStatus.TITLE_SCREEN) {
                    try {
                        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
                        if (context.state === 'suspended') {
                            context.resume();
                        }
                        audioContextRef.current = context;
                    } catch (err) {
                        console.error("Could not initialize AudioContext for autoplay:", err);
                    }
                }
                
                switch (status) {
                    case AppStatus.TITLE_SCREEN: setStatus(AppStatus.TRANSITION_SCREEN); break;
                    case AppStatus.TRANSITION_SCREEN: setStatus(AppStatus.PROCESSING_SCREEN); break;
                    case AppStatus.PROCESSING_SCREEN: setStatus(AppStatus.PERFORMING); break;
                }
                return;
            }

            if (status === AppStatus.PERFORMING) {
                const { viewMode, videoState, isComputerSpeaking } = stateRef.current;
                const isSpecificVideoPlaying = viewMode === ViewMode.PRERECORDED && videoState.state === PrerecordedVideoState.SPECIFIC;
                
                let actionTaken = false;

                if (e.code === 'ArrowRight' || e.code === 'Space') {
                    if (isSpecificVideoPlaying) {
                        onSpecificVideoEnd();
                        actionTaken = true;
                    } else if (!isComputerSpeaking) {
                        advanceLine();
                        actionTaken = true;
                    }
                } 
                else if (e.code === 'ArrowLeft') {
                    if (!isComputerSpeaking) {
                        regressLine();
                        actionTaken = true;
                    }
                }
                
                // This is the critical change: only stop the event if we actually did something.
                if (actionTaken) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    const handleJumpToScene = (index: number) => {
      jumpToScene(index);
      setCurrentLineIndex(index);
      setIsMenuOpen(false);
      setStatus(AppStatus.PERFORMING);
    };

    const handleNewScript = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const newScriptText = e.target?.result as string;
            storage.saveScript(file.name, newScriptText);
            const parsed = parseScript(newScriptText);
            setScript(parsed);
            setScriptFile(file);
            setCurrentLineIndex(0);
            setStatus(AppStatus.TITLE_SCREEN);
        };
        reader.readAsText(file);
    };

    const handleNewVideos = async (files: FileList) => {
        const fileArray = Array.from(files);
        const sortedFiles = sortVideosByName(fileArray);
        await storage.saveVideos(sortedFiles);
        const videoObjects = sortedFiles.map(file => ({
            file,
            url: URL.createObjectURL(file)
        }));
        setVideos(videoObjects);
        setCurrentLineIndex(0);
        setStatus(AppStatus.TITLE_SCREEN);
    };

    const handleNewAudio = async (files: FileList) => {
        const fileArray = Array.from(files);
        const sortedFiles = sortAudioByName(fileArray);
        await storage.saveAudio(sortedFiles);
        const audioObjects = sortedFiles.map(file => ({
            file,
            url: URL.createObjectURL(file)
        }));
        setAudioFiles(audioObjects);
        setCurrentLineIndex(0);
        setStatus(AppStatus.TITLE_SCREEN);
    };

    const handleSaveVdoNinjaUrl = async (url: string) => {
        await storage.saveVdoNinjaUrl(url);
        setVdoNinjaUrl(url);
    };

    const handleSaveTypingSpeed = async (speed: number) => {
        await storage.saveTypingSpeed(speed);
        setTypingSpeed(speed);
    };

    const handleSaveLiveVideoSource = async (source: 'local' | 'vdoninja') => {
        await storage.saveLiveVideoConfig({ source, localCameraId });
        setLiveVideoSource(source);
    };

    const handleSaveLocalCameraId = async (id: string | null) => {
        await storage.saveLiveVideoConfig({ source: liveVideoSource, localCameraId: id });
        setLocalCameraId(id);
    };
    
    const handleClearData = async () => {
        await storage.clearAllData();
        // Reset state
        setScript([]);
        setScriptFile(null);
        setVideos([]);
        setAudioFiles([]);
        setVdoNinjaUrl(null);
        setTypingSpeed(1.0);
        setCurrentLineIndex(0);
        setLiveVideoSource('vdoninja');
        setLocalCameraId(null);
        setIsMenuOpen(false);
        window.location.reload(); // Easiest way to ensure a clean state
    };
    
    const renderContent = () => {
        switch (status) {
            case AppStatus.LOADING:
                return <div className="flex items-center justify-center h-screen"><p className="font-title text-3xl">Loading...</p></div>;
            
            case AppStatus.TITLE_SCREEN:
                return (
                    // =================================================================
                    // == LOCKED COMPONENT
                    // == DO NOT MODIFY THIS TITLE SCREEN OR THE STARTUP FLOW.
                    // == THE FLOW IS: TITLE -> (SPACE) -> TRANSITION -> (SPACE) -> PROCESSING -> (SPACE) -> PERFORMING
                    // == NO OTHER SCREENS SHOULD BE ADDED.
                    // =================================================================
                    <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                        <button onClick={() => setIsMenuOpen(true)} className="absolute top-4 left-4 text-4xl p-2 z-20 hover:text-teal-400 transition-colors" aria-label="Open Menu">☰</button>
                        <h1 className="font-title text-9xl text-white">ANTHROPOLOGY</h1>
                        <p className="mt-4 text-7xl text-teal-400">
                            By Lauren Gunderson
                        </p>
                    </div>
                );

            case AppStatus.TRANSITION_SCREEN:
                return <CodeTransitionScreen />;

            case AppStatus.PROCESSING_SCREEN:
                return <ProcessingScreen />;
            
            case AppStatus.PERFORMING:
                return (
                    <>
                        <button onClick={() => setIsMenuOpen(true)} className="absolute top-4 left-4 text-4xl p-2 z-20 hover:text-teal-400 transition-colors" aria-label="Open Menu">☰</button>
                        <PerformanceView
                            mode={viewMode}
                            angieLine={displayedAngieLine}
                            videos={videos}
                            videoState={videoState}
                            vdoNinjaUrl={vdoNinjaUrl}
                            onDialogueVideoEnd={onDialogueVideoEnd}
                            onSpecificVideoEnd={onSpecificVideoEnd}
                            onTypingComplete={onTypingComplete}
                            borderEffect={borderEffect}
                            currentLine={currentLine}
                            typingSpeed={typingSpeed}
                            liveVideoSource={liveVideoSource}
                            activeStream={activeStream}
                        />
                    </>
                );
            
            default:
                return <div>Unknown App Status</div>;
        }
    };

    return (
        <>
            {renderContent()}
            <SceneMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                scenes={scenes}
                onSelectScene={handleJumpToScene}
                scriptName={scriptFile?.name ?? null}
                videoCount={videos.length}
                audioCount={audioFiles.length}
                vdoNinjaUrl={vdoNinjaUrl}
                typingSpeed={typingSpeed}
                liveVideoSource={liveVideoSource}
                localCameraId={localCameraId}
                onNewScript={handleNewScript}
                onNewVideos={handleNewVideos}
                onNewAudio={handleNewAudio}
                onSaveVdoNinjaUrl={handleSaveVdoNinjaUrl}
                onSaveTypingSpeed={handleSaveTypingSpeed}
                onSaveLiveVideoSource={handleSaveLiveVideoSource}
                onSaveLocalCameraId={handleSaveLocalCameraId}
                onClearData={handleClearData}
            />
        </>
    );
};

export default App;