import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ViewMode, PrerecordedVideoState, VideoFile, ScriptLine, LineType } from '../types';

interface PerformanceViewProps {
  mode: ViewMode;
  angieLine: string | null;
  userTranscript: string;
  videos: VideoFile[];
  videoState: {
      state: PrerecordedVideoState;
      dialogueIndex: number;
  };
  vdoNinjaUrl: string | null;
  onDialogueVideoEnd: () => void;
  onTypingComplete: () => void;
  currentLine: ScriptLine | undefined;
}

const TextView: React.FC<{ angieLine: string | null, onComplete: () => void }> = ({ angieLine, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const timeoutIdRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        window.clearTimeout(timeoutIdRef.current);
        setDisplayedText('');

        if (angieLine === null) {
            return;
        }

        let charIndex = 0;
        const type = () => {
            if (charIndex >= angieLine.length) {
                setDisplayedText(angieLine); // Ensure final text is perfect
                onComplete();
                return;
            }

            const char = angieLine[charIndex];
            setDisplayedText(prev => prev + char);
            charIndex += 1;

            let delay = 35; // standard typing speed
            if (char === ',') delay = 200;
            else if (['.', '?', '!'].includes(char)) delay = 350;
            
            timeoutIdRef.current = window.setTimeout(type, delay);
        };
        
        timeoutIdRef.current = window.setTimeout(type, 50);

        return () => {
            window.clearTimeout(timeoutIdRef.current);
        };
    }, [angieLine, onComplete]);

    if (!angieLine) {
        return null; // Don't render anything if there's no line
    }

    const isParenthetical = angieLine.trim().startsWith('(') && angieLine.trim().endsWith(')');

    return (
        <div className="flex items-center justify-center h-full w-full p-12">
            <div className="w-full max-w-6xl text-8xl text-teal-300 text-center whitespace-pre-wrap">
                 <p className={`${isParenthetical ? 'italic' : ''}`}>{displayedText}</p>
            </div>
        </div>
    );
};


const LiveVideoView: React.FC<{ vdoNinjaUrl: string | null }> = ({ vdoNinjaUrl }) => {
    const augmentedUrl = useMemo(() => {
        if (!vdoNinjaUrl) return null;
        try {
            const url = new URL(vdoNinjaUrl);
            url.searchParams.set('autoplay', 'true');
            url.searchParams.set('nointerface', '1');
            url.searchParams.set('bgc', '000000');
            return url.toString();
        } catch (e) {
            return vdoNinjaUrl;
        }
    }, [vdoNinjaUrl]);
    
    if (!vdoNinjaUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full p-12 text-center">
                 <h2 className="font-title text-5xl text-yellow-500 mb-4">VDO.Ninja Not Configured</h2>
                 <p className="text-2xl max-w-3xl text-gray-300">Please open the menu (☰) and add a VDO.Ninja URL to display the live camera feed.</p>
            </div>
        );
    }
    
    return (
        <iframe
            key={augmentedUrl}
            src={augmentedUrl!}
            allow="camera; microphone; autoplay; fullscreen; display-capture"
            className="w-full h-full border-0"
            title="VDO.Ninja Live Feed"
        ></iframe>
    );
};

interface PrerecordedVideoViewProps {
  videos: VideoFile[];
  state: PrerecordedVideoState;
  dialogueIndex: number;
  onDialogueVideoEnd: () => void;
  currentLine: ScriptLine | undefined;
}

const PrerecordedVideoView: React.FC<PrerecordedVideoViewProps> = ({ videos, state, dialogueIndex, onDialogueVideoEnd, currentLine }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentSrc, setCurrentSrc] = useState<string>('');
    const idleVideo = videos[0]?.url;
    const dialogueVideo = videos[dialogueIndex + 1]?.url;
    
    const isCueLineActive = currentLine?.type === LineType.CUE;
    
    useEffect(() => {
        if (isCueLineActive) {
            setCurrentSrc(''); // Ensure nothing plays during a cue
            return;
        }

        if(state === PrerecordedVideoState.IDLE && idleVideo) {
            setCurrentSrc(idleVideo);
        } else if (state === PrerecordedVideoState.DIALOGUE && dialogueVideo) {
            setCurrentSrc(dialogueVideo);
        } else {
            setCurrentSrc('');
        }
    }, [state, idleVideo, dialogueVideo, isCueLineActive]);

    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        const handleVideoEnd = () => {
            if (state === PrerecordedVideoState.DIALOGUE) {
                onDialogueVideoEnd();
            }
        };

        videoElement.addEventListener('ended', handleVideoEnd);
        return () => {
            videoElement.removeEventListener('ended', handleVideoEnd);
        };
    }, [state, onDialogueVideoEnd]);

    if (isCueLineActive) {
        return null; // The background is black, so this will show a black screen.
    }

    return <video ref={videoRef} key={currentSrc} src={currentSrc} autoPlay playsInline loop={state === PrerecordedVideoState.IDLE} className="w-full h-full object-cover" />;
};

export const PerformanceView: React.FC<PerformanceViewProps> = (props) => {
  const { mode, angieLine, userTranscript, videos, videoState, vdoNinjaUrl, onDialogueVideoEnd, onTypingComplete, currentLine } = props;

  const isVideoMode = mode === ViewMode.LIVE_VIDEO || mode === ViewMode.PRERECORDED;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* 
        This outer div is the interactive frame. A click on this element (the padding)
        will regain focus. A click in the center goes to the content (iframe/video).
        The video/iframe itself is also clickable.
      */}
      <div 
        className={`absolute inset-0 transition-colors duration-200 p-1 ${isVideoMode ? 'border-4 border-solid border-teal-500 hover:border-teal-400' : 'border-0 border-transparent'}`}
        onClick={() => window.focus()}
        aria-label="Regain keyboard control"
      >
        <div className="w-full h-full bg-black">
          {mode === ViewMode.TEXT && <TextView key={angieLine} angieLine={angieLine} onComplete={onTypingComplete} />}
          
          {mode === ViewMode.LIVE_VIDEO && <LiveVideoView vdoNinjaUrl={vdoNinjaUrl} />}

          {mode === ViewMode.PRERECORDED && (
              <PrerecordedVideoView 
                  videos={videos} 
                  state={videoState.state}
                  dialogueIndex={videoState.dialogueIndex}
                  onDialogueVideoEnd={onDialogueVideoEnd}
                  currentLine={currentLine}
              />
          )}
        </div>
      </div>
      
      {userTranscript && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 pointer-events-none">
          <p className="text-center text-3xl text-pink-500">{userTranscript}</p>
        </div>
      )}
    </div>
  );
};
