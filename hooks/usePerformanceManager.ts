import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScriptLine, LineType, Scene, ViewMode, PrerecordedVideoState, CueType, AppStatus, AudioFile } from '../types';
import { COMPUTER_CHARACTER } from '../services/scriptParser';
import { useAudioPlayer } from './useAudioPlayer';

export const usePerformanceManager = (script: ScriptLine[], audioFiles: AudioFile[], status: AppStatus) => {
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TEXT);
    const [videoState, setVideoState] = useState({
        state: PrerecordedVideoState.IDLE,
        dialogueIndex: -1
    });
    const [displayedAngieLine, setDisplayedAngieLine] = useState<string | null>(null);
    const wasComputerSpeakingRef = useRef(false);
    const angieLineCounterRef = useRef(0);
    
    const { play: playAudio, cancel: cancelAudio, isPlaying: isAudioPlaying } = useAudioPlayer();

    // The computer is considered "speaking" if either the text is typing or the audio is playing.
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

    const advanceLine = useCallback(() => {
        cancelAudio();
        setCurrentLineIndex(prev => {
            if (prev + 1 >= script.length) {
                return prev; // Don't advance past the end
            }
            return prev + 1;
        });
    }, [script.length, cancelAudio]);
    
    const jumpToScene = useCallback((index: number) => {
        cancelAudio();
        setCurrentLineIndex(index);
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
    }, []);
    
    const onDialogueVideoEnd = useCallback(() => {
        setVideoState(prev => ({ ...prev, state: PrerecordedVideoState.IDLE }));
        advanceLine();
    }, [advanceLine]);

    useEffect(() => {
        if (wasComputerSpeakingRef.current && !isComputerSpeaking) {
            advanceLine();
        }
        wasComputerSpeakingRef.current = isComputerSpeaking;
    }, [isComputerSpeaking, advanceLine]);

    useEffect(() => {
        const line = script[currentLineIndex];
        if (!line || status !== AppStatus.PERFORMING) return;

        switch (line.type) {
            case LineType.DIALOGUE:
                if (line.character === COMPUTER_CHARACTER) {
                    angieLineCounterRef.current += 1;
                    const audioToPlay = audioFiles[angieLineCounterRef.current - 1];
                    if (audioToPlay) {
                        playAudio(audioToPlay.url);
                    }
                    setIsTyping(true);
                    setDisplayedAngieLine(line.text);
                } else {
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
                advanceLine();
                break;
            case LineType.SCENE_MARKER:
                advanceLine();
                break;
        }

        return () => {
            if (isComputerSpeaking) {
                cancelAudio();
            }
        }
    }, [currentLineIndex, script, advanceLine, viewMode, playAudio, cancelAudio, status, audioFiles, isComputerSpeaking]);

    return {
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
    };
};
