import { useState, useRef, useCallback, useEffect } from 'react';

export const useAudioPlayer = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const play = useCallback((url: string, onEnd?: () => void) => {
        if (!url) return;

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }

        const newAudio = new Audio(url);
        audioRef.current = newAudio;
        
        newAudio.onplay = () => setIsPlaying(true);
        newAudio.onended = () => {
            setIsPlaying(false);
            if (onEnd) onEnd();
        };
        newAudio.onpause = () => setIsPlaying(false);
        newAudio.onabort = () => setIsPlaying(false);
        
        newAudio.onerror = (e) => {
            console.error("Audio playback error", e);
            setIsPlaying(false);
        };
        
        newAudio.play().catch(e => {
             // This can happen if the user interacts before the audio is ready
             if (e.name !== 'AbortError') {
                console.error("Error playing audio:", e);
             }
             setIsPlaying(false);
        });

    }, []);

    const cancel = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = ''; // Release resource
            audioRef.current = null;
            setIsPlaying(false);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        }
    }, []);

    return { play, cancel, isPlaying };
};
