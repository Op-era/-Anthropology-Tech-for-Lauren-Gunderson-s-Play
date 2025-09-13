import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PerformanceView } from './components/PerformanceView';
import { SceneMenu } from './components/SceneMenu';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { usePerformanceManager } from './hooks/usePerformanceManager';
import { parseScript } from './services/scriptParser';
import * as storage from './services/storageService';
import { AppStatus, ScriptLine, VideoFile, AudioFile } from './types';
import { CodeTransitionScreen } from './components/CodeTransitionScreen';

const fuzzyMatch = (scriptLine: string, spokenText: string): boolean => {
    const normalizeText = (text: string) => text
        .toLowerCase()
        .replace(/[^\w\s']|_/g, "") // Keep apostrophes
        .replace(/\s+/g, " ")
        .trim();

    const normalizedScript = normalizeText(scriptLine);
    const normalizedSpoken = normalizeText(spokenText);
    if (!normalizedScript) return false;

    const scriptWords = new Set(normalizedScript.split(' '));
    const spokenWords = normalizedSpoken.split(' ');
    
    if (scriptWords.size === 0 || spokenWords.length === 0) return false;

    let matchCount = 0;
    for (const word of spokenWords) {
        if (scriptWords.has(word)) {
            matchCount++;
        }
    }
    const matchPercentage = matchCount / scriptWords.size;
    return matchPercentage >= 0.6;
};

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
    const [status, setStatus] = useState<AppStatus>(AppStatus.TITLE_SCREEN);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [script, setScript] = useState<ScriptLine[]>([]);
    const [videos, setVideos] = useState<VideoFile[]>([]);
    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const [scriptFile, setScriptFile] = useState<File | null>(null);

    const {
        scenes,
        viewMode,
        videoState,
        displayedAngieLine,
        userCueLine,
        isComputerSpeaking,
        advanceLine,
        jumpToScene,
        onTypingComplete,
        onDialogueVideoEnd,
    } = usePerformanceManager(script, audioFiles, status);

    const performanceStateRef = useRef({ userCueLine, advanceLine });
    useEffect(() => {
        performanceStateRef.current = { userCueLine, advanceLine };
    }, [userCueLine, advanceLine]);

    const handleSpeechResult = useCallback((spokenText: string) => {
        const { userCueLine: currentCue, advanceLine: currentAdvance } = performanceStateRef.current;
        if (currentCue && fuzzyMatch(currentCue, spokenText)) {
            currentAdvance();
        }
    }, []);

    const { transcript, start: startListening, stop: stopListening } = useSpeechRecognition({ onResult: handleSpeechResult });
    
    useEffect(() => {
        const loadStoredData = async () => {
            try {
                const scriptData = await storage.getScript();
                const videoData = await storage.getVideos();
                const audioData = await storage.getAudio();

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
            } catch (error) {
                console.error("Failed to load data from storage:", error);
            }
        };

        loadStoredData();
    }, []);

    useEffect(() => {
        if (status === AppStatus.PERFORMING) {
            if (!isComputerSpeaking && userCueLine) {
                startListening();
            } else {
                stopListening();
            }
        } else {
            stopListening();
        }
    }, [status, isComputerSpeaking, userCueLine, startListening, stopListening]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return;
            e.preventDefault();

            if (script.length === 0) {
                if (!isMenuOpen) setIsMenuOpen(true);
                return;
            }

            if (status === AppStatus.TITLE_SCREEN) {
                setStatus(AppStatus.TRANSITION_SCREEN);
            } else if (status === AppStatus.TRANSITION_SCREEN) {
                setStatus(AppStatus.PERFORMING);
            } else if (status === AppStatus.PERFORMING) {
                advanceLine();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, advanceLine, script.length, isMenuOpen]);

    const handleNewScript = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const newScriptText = e.target?.result as string;
            storage.saveScript(file.name, newScriptText);
            const parsed = parseScript(newScriptText);
            setScript(parsed);
            setScriptFile(file);
            setStatus(AppStatus.TITLE_SCREEN);
            jumpToScene(0);
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
        setStatus(AppStatus.TITLE_SCREEN);
        jumpToScene(0);
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
        setStatus(AppStatus.TITLE_SCREEN);
        jumpToScene(0);
    };

    const handleClearData = async () => {
        await storage.clearAllData();
        window.location.reload();
    };

    const renderContent = () => {
        switch (status) {
            case AppStatus.TITLE_SCREEN:
                return <div className="flex items-center justify-center h-screen"><h1 className="font-title text-9xl animate-pulse">ANTHROPOLOGY</h1></div>;
            case AppStatus.TRANSITION_SCREEN:
                return <CodeTransitionScreen />;
            case AppStatus.PERFORMING:
                return <PerformanceView 
                    mode={viewMode}
                    angieLine={displayedAngieLine}
                    userTranscript={transcript}
                    videos={videos}
                    videoState={videoState}
                    onDialogueVideoEnd={onDialogueVideoEnd}
                    onTypingComplete={onTypingComplete}
                />;
            default:
                return <div className="flex items-center justify-center h-screen"><p className="text-red-500">An unexpected error occurred.</p></div>;
        }
    };

    return (
        <div className="w-screen h-screen bg-black">
            <button onClick={() => setIsMenuOpen(true)} className="absolute top-4 left-4 z-40 text-white text-3xl p-2 rounded-full bg-black/30 hover:bg-black/60 transition-colors" aria-label="Open menu">
                ☰
            </button>
            <SceneMenu 
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                scenes={scenes}
                onSelectScene={(index) => {
                    jumpToScene(index);
                    setIsMenuOpen(false);
                    setStatus(AppStatus.PERFORMING);
                }}
                scriptName={scriptFile?.name || null}
                videoCount={videos.length}
                audioCount={audioFiles.length}
                onNewScript={handleNewScript}
                onNewVideos={handleNewVideos}
                onNewAudio={handleNewAudio}
                onClearData={handleClearData}
            />
            {renderContent()}
        </div>
    );
};

export default App;
