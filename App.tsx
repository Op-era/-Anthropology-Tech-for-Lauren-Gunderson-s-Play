import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
// Fix: Import LineType to resolve reference errors in advanceLine and regressLine.
import { AppStatus, ScriptLine, Scene, VideoFile, AudioFile, ViewMode, PrerecordedVideoState, LineType } from './types';
import * as storage from './services/storageService';
import { parseScript } from './services/scriptParser';
import ScriptLoader from './components/ScriptLoader';
import PerformanceView from './components/PerformanceView';
import { SceneMenu } from './components/SceneMenu';
import { CodeTransitionScreen } from './components/CodeTransitionScreen';
import { ProcessingScreen } from './components/ProcessingScreen';

// DO NOT CHANGE - LOCKED BY USER REQUEST
// MODIFIED: Button moved to be persistent, per user request.
const TitleScreen: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-black flex-col font-title tracking-widest">
    <h1 className="text-9xl text-white mb-4">ANTHROPOLOGY</h1>
    <p className="text-7xl text-teal-400">By Lauren Gunderson</p>
  </div>
);
// DO NOT CHANGE - LOCKED BY USER REQUEST

const App: React.FC = () => {
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.LOADING);
  const [script, setScript] = useState<ScriptLine[]>([]);
  const [scriptName, setScriptName] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [vdoNinjaUrl, setVdoNinjaUrl] = useState<string | null>(null);
  const [typingSpeed, setTypingSpeed] = useState(1.0);
  const [liveVideoSource, setLiveVideoSource] = useState<'local' | 'vdoninja'>('local');
  const [localCameraId, setLocalCameraId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const masterRef = useRef<any>({});

  const handleScriptLoad = useCallback((text: string, name: string) => {
    const parsedScript = parseScript(text);
    setScript(parsedScript);
    setScriptName(name);
    
    const sceneMarkers = parsedScript
        .map((line, index) => ({ line, index }))
        .filter(item => item.line.type === 'SCENE_MARKER');
    
    setScenes(sceneMarkers.map(item => ({ name: (item.line as any).sceneName, index: item.index })));
  }, []);

  const loadData = useCallback(async () => {
    try {
        const [scriptData, videoData, audioData, urlData, speedData, liveVideoConfig] = await Promise.all([
            storage.getScript(),
            storage.getVideos(),
            storage.getAudio(),
            storage.getVdoNinjaUrl(),
            storage.getTypingSpeed(),
            storage.getLiveVideoConfig(),
        ]);

        if (scriptData) {
            handleScriptLoad(scriptData.text, scriptData.name);
        }
        if (videoData) {
            const videoFiles = videoData.map(file => ({ file, url: URL.createObjectURL(file) }));
            setVideos(videoFiles);
        }
        if (audioData) {
            const audioUrls = audioData.map(file => ({ file, url: URL.createObjectURL(file) }));
            setAudioFiles(audioUrls);
        }
        setVdoNinjaUrl(urlData ?? null);
        setTypingSpeed(speedData ?? 1.0);
        if (liveVideoConfig) {
            setLiveVideoSource(liveVideoConfig.source);
            setLocalCameraId(liveVideoConfig.localCameraId);
        }

    } catch (error) {
        console.error("Error loading data from storage:", error);
    } finally {
        setAppStatus(AppStatus.TITLE_SCREEN);
    }
  }, [handleScriptLoad]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const advanceLine = useCallback(() => {
    setCurrentLineIndex(prev => {
      let i = prev + 1;
      while (i < script.length) {
        const line = script[i];
        if (line.type === LineType.DIALOGUE || line.type === LineType.CUE) {
          return i;
        }
        i++;
      }
      return prev; // Stay on last line if no more cues/dialogue
    });
  }, [script]);

  const regressLine = useCallback(() => {
    setCurrentLineIndex(prev => {
      let i = prev - 1;
      while (i >= 0) {
        const line = script[i];
        if (line.type === LineType.DIALOGUE || line.type === LineType.CUE) {
          return i;
        }
        i--;
      }
      return prev;
    });
  }, [script]);
  
  const handleSelectScene = (index: number) => {
    setCurrentLineIndex(index);
    setIsMenuOpen(false);
    if(appStatus !== AppStatus.PERFORMING){
        if (script.length === 0) {
            alert('Please upload a script file first from the menu.');
            return;
        }
        setAppStatus(AppStatus.TRANSITION_SCREEN);
        setTimeout(() => {
          setAppStatus(AppStatus.PERFORMING);
        }, 4000);
    }
  };

  const handleNewScript = async (file: File) => {
    const text = await file.text();
    await storage.saveScript(file.name, text);
    handleScriptLoad(text, file.name);
  };
  
  const handleNewVideos = async (files: FileList) => {
    const fileArray = Array.from(files);
    await storage.saveVideos(fileArray);
    setVideos(fileArray.map(f => ({file: f, url: URL.createObjectURL(f)})));
  };
  
  const handleNewAudio = async (files: FileList) => {
    const fileArray = Array.from(files);
    await storage.saveAudio(fileArray);
    setAudioFiles(fileArray.map(f => ({file: f, url: URL.createObjectURL(f)})));
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
    const newConfig = { source, localCameraId };
    await storage.saveLiveVideoConfig(newConfig);
    setLiveVideoSource(source);
  };
  
  const handleSaveLocalCameraId = async (id: string | null) => {
     const newConfig = { source: liveVideoSource, localCameraId: id };
     await storage.saveLiveVideoConfig(newConfig);
     setLocalCameraId(id);
  };
  
  const handleClearData = async () => {
    await storage.clearAllData();
    window.location.reload();
  };

  useLayoutEffect(() => {
    masterRef.current = {
      isMenuOpen,
      setIsMenuOpen,
    };
  });
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { isMenuOpen, setIsMenuOpen } = masterRef.current;
      
      if (e.key === 'Escape') {
        setIsMenuOpen(!isMenuOpen);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderContent = () => {
    switch (appStatus) {
      case AppStatus.LOADING:
        return <ScriptLoader />;
      case AppStatus.TITLE_SCREEN:
        return <TitleScreen />;
      case AppStatus.TRANSITION_SCREEN:
        return <CodeTransitionScreen />;
      case AppStatus.PERFORMING:
        return (
          <PerformanceView
            script={script}
            videos={videos}
            audioFiles={audioFiles}
            initialLineIndex={currentLineIndex}
            liveVideoSource={liveVideoSource}
            localCameraId={localCameraId}
            vdoNinjaUrl={vdoNinjaUrl}
            typingSpeed={typingSpeed}
            onAdvance={advanceLine}
            onRegress={regressLine}
            onJumpToScene={setCurrentLineIndex}
            // Fix: Pass the 'scenes' prop as it is required by PerformanceView.
            scenes={scenes}
          />
        );
      case AppStatus.ERROR:
          return <div>Error State</div>; // Placeholder
      default:
        return <TitleScreen />;
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsMenuOpen(true)} 
        className="group fixed top-6 left-6 z-40 p-2 space-y-2 rounded-md hover:bg-gray-800 transition-colors" 
        aria-label="Open Menu"
      >
        <span className="block w-8 h-1 bg-gray-700 group-hover:bg-gray-400 transition-colors"></span>
        <span className="block w-8 h-1 bg-gray-700 group-hover:bg-gray-400 transition-colors"></span>
        <span className="block w-8 h-1 bg-gray-700 group-hover:bg-gray-400 transition-colors"></span>
      </button>

      {renderContent()}

      <SceneMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        scenes={scenes}
        onSelectScene={handleSelectScene}
        scriptName={scriptName}
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