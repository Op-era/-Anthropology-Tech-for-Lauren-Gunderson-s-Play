import React, { useState, useEffect, useRef } from 'react';
import { ViewMode, PrerecordedVideoState, VideoFile } from '../types';

interface PerformanceViewProps {
  mode: ViewMode;
  angieLine: string | null;
  userTranscript: string;
  videos: VideoFile[];
  videoState: {
      state: PrerecordedVideoState;
      dialogueIndex: number;
  };
  onDialogueVideoEnd: () => void;
  onTypingComplete: () => void;
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

            let delay = 75; // standard typing speed
            if (char === ',') delay = 350;
            else if (['.', '?', '!'].includes(char)) delay = 500;
            
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


const LiveVideoView: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        const setupCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera: ", err);
            }
        };
        setupCamera();

        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
};

const PrerecordedVideoView: React.FC<{ videos: VideoFile[], state: PrerecordedVideoState, dialogueIndex: number, onDialogueVideoEnd: () => void }> = ({ videos, state, dialogueIndex, onDialogueVideoEnd }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentSrc, setCurrentSrc] = useState<string>('');
    const idleVideo = videos[0]?.url;
    // Dialogue videos start from index 1 in the videos array
    const dialogueVideo = videos[dialogueIndex + 1]?.url;
    
    useEffect(() => {
        if(state === PrerecordedVideoState.IDLE && idleVideo) {
            setCurrentSrc(idleVideo);
        } else if (state === PrerecordedVideoState.DIALOGUE && dialogueVideo) {
            setCurrentSrc(dialogueVideo);
        }
    }, [state, idleVideo, dialogueVideo]);

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

    if(videos.length === 0) return <div className="flex items-center justify-center h-full">Loading videos...</div>;
    
    return <video ref={videoRef} key={currentSrc} src={currentSrc} autoPlay playsInline loop={state === PrerecordedVideoState.IDLE} className="w-full h-full object-cover" />;
};

export const PerformanceView: React.FC<PerformanceViewProps> = (props) => {
  const { mode, angieLine, userTranscript, videos, videoState, onDialogueVideoEnd, onTypingComplete } = props;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      <div className="absolute inset-0">
        {mode === ViewMode.TEXT && <TextView key={angieLine} angieLine={angieLine} onComplete={onTypingComplete} />}
        {mode === ViewMode.LIVE_VIDEO && <LiveVideoView />}
        {mode === ViewMode.PRERECORDED && (
            <PrerecordedVideoView 
                videos={videos} 
                state={videoState.state}
                dialogueIndex={videoState.dialogueIndex}
                onDialogueVideoEnd={onDialogueVideoEnd}
            />
        )}
      </div>
      
      {userTranscript && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50">
          <p className="text-center text-3xl text-pink-500">{userTranscript}</p>
        </div>
      )}
    </div>
  );
};