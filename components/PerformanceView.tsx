import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ViewMode, PrerecordedVideoState, VideoFile, ScriptLine, LineType } from '../types';

interface PerformanceViewProps {
  mode: ViewMode;
  angieLine: string | null;
  videos: VideoFile[];
  videoState: {
      state: PrerecordedVideoState;
      dialogueIndex: number;
      specificVideoUrl: string | null;
  };
  vdoNinjaUrl: string | null;
  onDialogueVideoEnd: () => void;
  onSpecificVideoEnd: () => void;
  onTypingComplete: () => void;
  borderEffect: 'NORMAL' | 'RED' | 'FLASHING';
  currentLine: ScriptLine | undefined;
  typingSpeed: number;
  liveVideoSource: 'local' | 'vdoninja';
  activeStream: MediaStream | null; // Changed from localCameraId to activeStream
}

const TextView: React.FC<{ angieLine: string | null, onComplete: () => void, typingSpeed: number }> = ({ angieLine, onComplete, typingSpeed }) => {
    const [displayedText, setDisplayedText] = useState('');
    const timeoutIdRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        window.clearTimeout(timeoutIdRef.current);
        setDisplayedText('');

        if (angieLine === null) {
            onComplete(); // Ensure completion is called even if there's no line to type
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

            const safeSpeed = Math.max(0.1, typingSpeed); // Prevent division by zero or negative values
            let delay = 35 / safeSpeed; // standard typing speed
            if (char === ',') delay = 200 / safeSpeed;
            else if (['.', '?', '!'].includes(char)) delay = 350 / safeSpeed;
            
            timeoutIdRef.current = window.setTimeout(type, delay);
        };
        
        timeoutIdRef.current = window.setTimeout(type, 50);

        return () => {
            window.clearTimeout(timeoutIdRef.current);
        };
    }, [angieLine, onComplete, typingSpeed]);

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

const LiveVideoView: React.FC<{
  vdoNinjaUrl: string | null;
  activeStream: MediaStream | null; // Changed from localCameraId
  source: 'local' | 'vdoninja';
}> = ({ vdoNinjaUrl, activeStream, source }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
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

    // Effect to attach the centrally managed stream to the video element
    useEffect(() => {
        const videoElement = videoRef.current;
        if (source === 'local' && videoElement) {
            if (activeStream) {
                if (videoElement.srcObject !== activeStream) {
                    videoElement.srcObject = activeStream;
                    videoElement.play().catch(e => console.error("Error playing main video stream:", e));
                }
            } else {
                videoElement.srcObject = null;
            }
        }
    }, [source, activeStream]);

    if (source === 'vdoninja') {
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
    }

    if (source === 'local') {
        if (!activeStream) {
             return (
                <div className="flex flex-col items-center justify-center h-full w-full p-12 text-center">
                    <h2 className="font-title text-5xl text-yellow-500 mb-4">Local Camera Not Available</h2>
                    <p className="text-2xl max-w-3xl text-gray-300">The selected camera could not be accessed. Please check permissions or select another camera in the menu (☰).</p>
                </div>
            );
        }
        return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
    }

    // Fallback if no source is selected or valid
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-12 text-center">
             <h2 className="font-title text-5xl text-yellow-500 mb-4">No Video Source</h2>
             <p className="text-2xl max-w-3xl text-gray-300">Please open the menu (☰) to configure a live video source.</p>
        </div>
    );
};

interface PrerecordedVideoViewProps {
  videos: VideoFile[];
  videoState: PerformanceViewProps['videoState'];
  onDialogueVideoEnd: () => void;
  onSpecificVideoEnd: () => void;
}

const PrerecordedVideoView: React.FC<PrerecordedVideoViewProps> = ({ videos, videoState, onDialogueVideoEnd, onSpecificVideoEnd }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentSrc, setCurrentSrc] = useState<string>('');
    const [isLooping, setIsLooping] = useState(false);
    
    const idleVideoUrl = useMemo(() => videos.find(v => v.file.name.toLowerCase().startsWith('idle'))?.url, [videos]);
    const dialogueVideoUrl = videos.find(v => v.file.name.startsWith(String(videoState.dialogueIndex + 1)))?.url;
    
    useEffect(() => {
        let newSrc = '';
        switch (videoState.state) {
            case PrerecordedVideoState.SPECIFIC:
                newSrc = videoState.specificVideoUrl || '';
                break;
            case PrerecordedVideoState.DIALOGUE:
                // Fallback to idle if a specific dialogue video is missing
                newSrc = dialogueVideoUrl || idleVideoUrl || '';
                break;
            case PrerecordedVideoState.IDLE:
            default:
                newSrc = idleVideoUrl || '';
                break;
        }
        setCurrentSrc(newSrc);
        // A video should loop only if its source is the idle video.
        setIsLooping(!!newSrc && newSrc === idleVideoUrl);
    }, [videoState, idleVideoUrl, dialogueVideoUrl]);

    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        const handleVideoEnd = () => {
            if (videoState.state === PrerecordedVideoState.DIALOGUE) {
                onDialogueVideoEnd();
            } else if (videoState.state === PrerecordedVideoState.SPECIFIC) {
                onSpecificVideoEnd();
            }
        };

        videoElement.addEventListener('ended', handleVideoEnd);
        return () => {
            videoElement.removeEventListener('ended', handleVideoEnd);
        };
    }, [videoState.state, onDialogueVideoEnd, onSpecificVideoEnd]);

    if (!currentSrc) {
        return (
             <div className="flex flex-col items-center justify-center h-full w-full p-12 text-center">
                 <h2 className="font-title text-5xl text-yellow-500 mb-4">Video Not Found</h2>
                 <p className="text-2xl max-w-3xl text-gray-300">A required video could not be loaded. Please check the video files in the menu (☰).</p>
            </div>
        )
    }

    return <video ref={videoRef} key={currentSrc} src={currentSrc} autoPlay playsInline loop={isLooping} className="w-full h-full object-cover" />;
};

export const PerformanceView: React.FC<PerformanceViewProps> = (props) => {
  const { mode, angieLine, videos, videoState, vdoNinjaUrl, onDialogueVideoEnd, onSpecificVideoEnd, onTypingComplete, borderEffect, currentLine, typingSpeed, liveVideoSource, activeStream } = props;

  const borderClass = useMemo(() => {
    switch (borderEffect) {
        case 'RED':
            return 'border-4 border-solid border-red-500';
        case 'FLASHING':
            return 'border-4 border-solid animate-border-flash';
        case 'NORMAL':
        default:
            return 'border-4 border-solid border-teal-500 hover:border-teal-400';
    }
  }, [borderEffect]);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      <div 
        className={`absolute inset-0 transition-colors duration-200 p-4 ${borderClass}`}
        onClick={() => window.focus()}
        aria-label="Regain keyboard control"
      >
        <div className="w-full h-full bg-black">
          {mode === ViewMode.TEXT && (
              <TextView key={angieLine} angieLine={angieLine} onComplete={onTypingComplete} typingSpeed={typingSpeed} />
          )}
          
          {mode === ViewMode.LIVE_VIDEO && <LiveVideoView vdoNinjaUrl={vdoNinjaUrl} source={liveVideoSource} activeStream={activeStream} />}

          {mode === ViewMode.PRERECORDED && (
              <PrerecordedVideoView 
                  videos={videos} 
                  videoState={videoState}
                  onDialogueVideoEnd={onDialogueVideoEnd}
                  onSpecificVideoEnd={onSpecificVideoEnd}
              />
          )}
        </div>
      </div>
    </div>
  );
};