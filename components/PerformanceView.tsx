import React, { useEffect, useRef, useLayoutEffect } from 'react';
import {
  ScriptLine,
  ViewMode,
  VideoFile,
  AudioFile,
  PrerecordedVideoState,
  DialogueLine,
  Scene,
} from '../types';
import { usePerformanceManager } from '../hooks/usePerformanceManager';
import { AiCodeSimulator } from './AiCodeSimulator';
import { COMPUTER_CHARACTER } from '../services/scriptParser';

interface PerformanceViewProps {
  script: ScriptLine[];
  videos: VideoFile[];
  audioFiles: AudioFile[];
  initialLineIndex: number;
  liveVideoSource: 'local' | 'vdoninja';
  localCameraId: string | null;
  vdoNinjaUrl: string | null;
  typingSpeed: number;
  onAdvance: () => void;
  onRegress: () => void;
  onJumpToScene: (index: number) => void;
  scenes: Scene[];
}

const TextView: React.FC<{ angieLine: DialogueLine; onComplete: () => void; typingSpeed: number; }> = ({ angieLine, onComplete, typingSpeed }) => {
  const [displayText, setDisplayText] = React.useState('');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setDisplayText('');
    if (!angieLine || angieLine.character !== COMPUTER_CHARACTER) {
      onCompleteRef.current();
      return;
    }
    
    let i = 0;
    const interval = 50 / typingSpeed;
    const typingInterval = setInterval(() => {
      if (i < angieLine.text.length) {
        setDisplayText(prev => prev + angieLine.text.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
        onCompleteRef.current();
      }
    }, interval);

    return () => clearInterval(typingInterval);
  }, [angieLine, typingSpeed]);

  if (!angieLine) return null;

  return (
    <div className="max-w-4xl w-full">
      <p className="font-title text-5xl text-teal-400 mb-6">{angieLine.character}</p>
      <p className="text-4xl text-white whitespace-pre-wrap font-mono">
        {displayText}
        <span className="inline-block w-2 h-10 bg-white ml-2 animate-pulse"></span>
      </p>
    </div>
  );
};

const PrerecordedVideoView: React.FC<{
  videoState: { state: PrerecordedVideoState, dialogueIndex: number, specificVideoUrl: string | null },
  dialogueVideos: VideoFile[],
  idleVideoUrl: string | null,
  onAdvance: () => void,
  onDialogueVideoEnd: () => void,
}> = ({ videoState, dialogueVideos, idleVideoUrl, onAdvance, onDialogueVideoEnd }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const onDialogueVideoEndRef = useRef(onDialogueVideoEnd);
    
    useEffect(() => {
      onDialogueVideoEndRef.current = onDialogueVideoEnd;
    }, [onDialogueVideoEnd]);

    const handleVideoEnd = () => {
        if (videoState.state === PrerecordedVideoState.DIALOGUE) {
            onDialogueVideoEndRef.current();
        }
        // SPECIFIC videos will be advanced by user click/space
        // IDLE video will loop
    };
    
    const dialogueVideo = videoState.state === PrerecordedVideoState.DIALOGUE ? dialogueVideos[videoState.dialogueIndex] : null;

    let currentSrc: string | null = null;
    let isLooping = false;
    let isMissing = false;

    switch(videoState.state) {
        case PrerecordedVideoState.IDLE:
            currentSrc = idleVideoUrl;
            isLooping = true;
            break;
        case PrerecordedVideoState.DIALOGUE:
            if (dialogueVideo) {
                currentSrc = dialogueVideo.url;
            } else {
                isMissing = true;
            }
            break;
        case PrerecordedVideoState.SPECIFIC:
            currentSrc = videoState.specificVideoUrl;
            break;
        case PrerecordedVideoState.MISSING:
            isMissing = true;
            break;
    }

    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        if (currentSrc && videoElement.src !== currentSrc) {
            videoElement.src = currentSrc;
            videoElement.load();
            videoElement.play().catch(e => {
                if (e.name !== 'AbortError') {
                    console.error('Video play error:', e);
                }
            });
        }
        videoElement.loop = isLooping;
    }, [currentSrc, isLooping]);

    if (isMissing) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-black text-red-500 font-mono text-2xl" onClick={onAdvance}>
            <p>MISSING DIALOGUE VIDEO</p>
            <p className="text-yellow-400 mt-2">File not found for dialogue index: {videoState.dialogueIndex}</p>
        </div>
      )
    }

    return (
        <video
            ref={videoRef}
            playsInline
            muted
            onEnded={handleVideoEnd}
            onClick={onAdvance}
            className="w-full h-full object-cover cursor-pointer"
        />
    );
};

const LiveVideoView: React.FC<{
  source: 'local' | 'vdoninja';
  localCameraId: string | null;
  vdoNinjaUrl: string | null;
}> = ({ source, localCameraId, vdoNinjaUrl }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        let stream: MediaStream | null = null;
        if (source !== 'local') return;

        let active = true;
        const startStream = async () => {
            if (!localCameraId) return;
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: localCameraId } } });
                console.log('Started local stream:', newStream.id);
                if (active && videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }
                stream = newStream;
            } catch (err) {
                console.error("Error starting live camera stream:", err);
            }
        };
        startStream();

        return () => {
            active = false;
            stream?.getTracks().forEach(track => track.stop());
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            console.log('Cleaned up local stream.');
        };
    }, [source, localCameraId]);

    if (source === 'vdoninja') {
      if (!vdoNinjaUrl) return <div className="w-full h-full bg-black flex items-center justify-center"><p className="text-red-500">VDO.Ninja URL Not Configured</p></div>;
      const augmentedUrl = `${vdoNinjaUrl.split('&')[0]}&autoplay=true&nointerface=true&bgc=000000`;
      return <iframe src={augmentedUrl} className="w-full h-full border-0 pointer-events-none" title="VDO.Ninja Live Feed" allow="camera; microphone; autoplay"></iframe>
    }
    
    if (source === 'local') {
      if (!localCameraId) return <div className="w-full h-full bg-black flex items-center justify-center"><p className="text-red-500">Local Camera Not Selected</p></div>;
      return <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover pointer-events-none" />;
    }
    
    return null;
};


const PerformanceView: React.FC<PerformanceViewProps> = (props) => {
  const { script, videos, audioFiles, initialLineIndex, onAdvance, onRegress, scenes } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  const performanceManager = usePerformanceManager({
    script,
    videos,
    audioFiles,
    currentLineIndex: initialLineIndex,
    onAdvance,
    scenes
  });

  const {
    viewMode,
    videoState,
    isComputerSpeaking,
    isLiveFeedActive,
    isAutoAdvancing,
    angieLine,
    onTypingComplete,
    onDialogueVideoEnd,
    idleVideoUrl,
    dialogueVideos,
  } = performanceManager;

  const masterRef = useRef<any>({});
  useLayoutEffect(() => {
    masterRef.current = {
      isAutoAdvancing,
      isComputerSpeaking,
      videoState,
      onAdvance,
      onRegress
    };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { isAutoAdvancing, isComputerSpeaking, videoState, onAdvance, onRegress } = masterRef.current;
      if (isAutoAdvancing) return;

      if (e.code === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        
        const isSkippableVideo = videoState.state === PrerecordedVideoState.SPECIFIC || videoState.state === PrerecordedVideoState.MISSING;
        if (isSkippableVideo) {
          onDialogueVideoEnd(); 
        } else if (!isComputerSpeaking) {
          onAdvance();
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (!isComputerSpeaking) {
          onRegress();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleContainerClick = () => {
    const { isAutoAdvancing, isComputerSpeaking, videoState, onAdvance } = masterRef.current;
    if (isAutoAdvancing) return;

    const isSkippableVideo = videoState.state === PrerecordedVideoState.SPECIFIC || videoState.state === PrerecordedVideoState.MISSING;
    if (isSkippableVideo) {
        onDialogueVideoEnd();
    } else if (!isComputerSpeaking) {
        onAdvance();
    }
    containerRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="w-screen h-screen bg-black text-white outline-none"
      onClick={handleContainerClick}
      aria-label="Performance Area. Click or press spacebar to advance."
    >
      <div className="w-full h-full border-teal-500 border-solid border-[12px]">
        {viewMode === ViewMode.TEXT && (
          <div className="w-full h-full flex flex-col justify-center items-center p-12">
            {angieLine ? (
              <TextView angieLine={angieLine} onComplete={onTypingComplete} typingSpeed={props.typingSpeed} />
            ) : (
              <div className="animate-pulse text-gray-700 text-6xl font-mono">&gt;_</div>
            )}
          </div>
        )}
        
        {viewMode === ViewMode.LIVE_VIDEO && (
          <div className="relative w-full h-full">
            <LiveVideoView 
              source={props.liveVideoSource}
              localCameraId={props.localCameraId}
              vdoNinjaUrl={props.vdoNinjaUrl}
            />
            {angieLine && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-12 bg-black bg-opacity-30">
                <div className="transform scale-125" style={{textShadow: '0 0 10px black'}}>
                   <TextView angieLine={angieLine} onComplete={onTypingComplete} typingSpeed={props.typingSpeed} />
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === ViewMode.PRERECORDED && (
          <PrerecordedVideoView
            videoState={videoState}
            dialogueVideos={dialogueVideos}
            idleVideoUrl={idleVideoUrl}
            onAdvance={onAdvance}
            onDialogueVideoEnd={onDialogueVideoEnd}
          />
        )}
      </div>
    </div>
  );
};

export default PerformanceView;