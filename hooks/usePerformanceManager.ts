import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScriptLine, LineType, Scene, ViewMode, PrerecordedVideoState, CueType, AppStatus, AudioFile } from '../types';
import { COMPUTER_CHARACTER } from '../services/scriptParser';
import { useAudioPlayer } from './useAudioPlayer';

export const usePerformanceManager = (
    script: ScriptLine[], 
    audioFiles: AudioFile[], 
    currentLineIndex: number,
    status: AppStatus,
    onComputerLineComplete: () => void,
) => {
    const [isTyping, setIsTyping] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TEXT);
    const [videoState, setVideoState] = useState({
        state: PrerecordedVideoState.IDLE,
        dialogueIndex: -1
    });
    const [displayedAngieLine, setDisplayedAngieLine] = useState<string | null>(null);
    const angieLineCounterRef = useRef(0);
    
    const { play: playAudio, cancel: cancelAudio, isPlaying: isAudioPlaying } = useAudioPlayer();

    const onComputerLineCompleteRef = useRef(onComputerLineComplete);
    useEffect(() => {
        onComputerLineCompleteRef.current = onComputerLineComplete;
    }, [onComputerLineComplete]);

    const isComputerSpeaking = isTyping || isAudioPlaying;

    const scenes = useMemo(() => script.reduce((acc, line, index) => {
        if (line.type === LineType.SCENE_MARKER) {
            acc.push({ name: line.sceneName, index });
        }
        return acc;
    }, [] as Scene[]), [script]);

    const currentLine = script[currentLineIndex];
    const isUsersTurn = currentLine?.type === LineType.DIALOGUE && currentLine.character !== COMPUTER_CHARACTER;
    const userCueLine = isUsersTurn ? currentLine.text : null;

    const jumpToScene = useCallback((index: number) => {
        cancelAudio();
        setDisplayedAngieLine(null);
        setVideoState({ state: PrerecordedVideoState.IDLE, dialogueIndex: -1 });
        setViewMode(ViewMode.TEXT); 

        // Recalculate angie line count up to this scene
        let angieLinesBefore = 0;
        for(let i = 0; i < index; i++) {
            const line = script[i];
            if(line?.type === LineType.DIALOGUE && line.character === COMPUTER_CHARACTER) {
                angieLinesBefore++;
            }
        }
        angieLineCounterRef.current = angieLinesBefore;
    }, [cancelAudio, script]);

    const onTypingComplete = useCallback(() => {
        setIsTyping(false);
        // If audio is also done (or not playing), signal completion.
        if (!isAudioPlaying) {
            onComputerLineCompleteRef.current();
        }
    }, [isAudioPlaying]);
    
    const onDialogueVideoEnd = useCallback(() => {
        setVideoState(prev => ({ ...prev, state: PrerecordedVideoState.IDLE }));
        onComputerLineCompleteRef.current();
    }, []);

    useEffect(() => {
        // This effect now triggers the line action when the index changes.
        const line = script[currentLineIndex];
        if (!line || status !== AppStatus.PERFORMING) return;

        switch (line.type) {
            case LineType.DIALOGUE:
                if (line.character === COMPUTER_CHARACTER) {
                    angieLineCounterRef.current += 1;
                    const audioToPlay = audioFiles[angieLineCounterRef.current - 1];
                    
                    setIsTyping(true);
                    setDisplayedAngieLine(line.text);

                    if (audioToPlay) {
                        playAudio(audioToPlay.url, () => {
                            // onEnd callback for audio
                            if (!isTyping) { // If typing is already done
                                onComputerLineCompleteRef.current();
                            }
                        });
                    } else {
                        // If there's no audio, typing alone determines completion.
                        // onTypingComplete will handle calling the callback.
                    }
                } else {
                    // User's turn
                    if (viewMode === ViewMode.PRERECORDED) {
                        setVideoState(prev => ({ state: PrerecordedVideoState.DIALOGUE, dialogueIndex: prev.dialogueIndex + 1 }));
                    }
                }
                break;
            case LineType.CUE:
                switch(line.cue) {
                    case CueType.CUT_TO_LIVE_CAMERA: setViewMode(ViewMode.LIVE_VIDEO); break;
                    case CueType.CUT_TO_TEXT: setViewMode(ViewMode.TEXT); break;
                    case CueType.CUT_TO_PRERECORDED: setViewMode(ViewMode.PRERECORDED); break;
                }
                // Cues and scene markers are instantaneous, so we advance immediately.
                onComputerLineCompleteRef.current();
                break;
            case LineType.SCENE_MARKER:
                onComputerLineCompleteRef.current();
                break;
        }

        return () => {
            cancelAudio();
        }
    }, [currentLineIndex, script, status, audioFiles, viewMode, playAudio, cancelAudio, isTyping]);

    return {
        scenes,
        viewMode,
        videoState,
        displayedAngieLine,
        userCueLine,
        isComputerSpeaking,
        jumpToScene,
        onTypingComplete,
        onDialogueVideoEnd,
    };
};
