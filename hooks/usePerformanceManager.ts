import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScriptLine, LineType, Scene, ViewMode, PrerecordedVideoState, CueType, AppStatus, AudioFile, VideoFile } from '../types';
import { COMPUTER_CHARACTER } from '../services/scriptParser';
import { useAudioPlayer } from './useAudioPlayer';

export const usePerformanceManager = (
    script: ScriptLine[], 
    audioFiles: AudioFile[],
    videos: VideoFile[],
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

    const isAngiesDialoguePlaying = viewMode === ViewMode.PRERECORDED && videoState.state === PrerecordedVideoState.DIALOGUE;
    const isComputerSpeaking = isTyping || isAudioPlaying || isAngiesDialoguePlaying;

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
                    const trimmedText = line.text.trim();
                    const isShortParenthetical = trimmedText.startsWith('(') && trimmedText.endsWith(')') && trimmedText.length < 25;

                    if (!trimmedText || isShortParenthetical) {
                        break; 
                    }

                    angieLineCounterRef.current += 1;
                    
                    if (viewMode === ViewMode.PRERECORDED) {
                        const nextDialogueIndex = videoState.dialogueIndex + 1;
                        const dialogueVideoExists = videos[nextDialogueIndex + 1];
                        if (dialogueVideoExists) {
                            setVideoState({ state: PrerecordedVideoState.DIALOGUE, dialogueIndex: nextDialogueIndex });
                        } else {
                            onComputerLineCompleteRef.current();
                        }
                    } else if (viewMode === ViewMode.TEXT) {
                        const audioToPlay = audioFiles[angieLineCounterRef.current - 1];
                        
                        setIsTyping(true);
                        setDisplayedAngieLine(line.text);

                        if (audioToPlay) {
                            playAudio(audioToPlay.url, () => {
                                if (!isTyping) {
                                    onComputerLineCompleteRef.current();
                                }
                            });
                        }
                    } else if (viewMode === ViewMode.LIVE_VIDEO) {
                        const audioToPlay = audioFiles[angieLineCounterRef.current - 1];
                        if (audioToPlay) {
                            playAudio(audioToPlay.url, () => {
                                onComputerLineCompleteRef.current();
                            });
                        } else {
                            onComputerLineCompleteRef.current();
                        }
                    }
                }
                break;
            case LineType.CUE:
                switch(line.cue) {
                    case CueType.CUT_TO_LIVE_CAMERA: setViewMode(ViewMode.LIVE_VIDEO); break;
                    case CueType.CUT_TO_TEXT: setViewMode(ViewMode.TEXT); break;
                    case CueType.CUT_TO_PRERECORDED:
                        setViewMode(ViewMode.PRERECORDED);
                        setVideoState({ state: PrerecordedVideoState.IDLE, dialogueIndex: -1 });
                        break;
                    case CueType.PLAY_VOICEMAIL:
                        if (line.audioIndex !== undefined) {
                            const audioToPlay = audioFiles[line.audioIndex];
                            if (audioToPlay) {
                                playAudio(audioToPlay.url, () => {
                                    onComputerLineCompleteRef.current();
                                });
                            } else {
                                console.warn(`Voicemail cue for audio index ${line.audioIndex} but audio file not found.`);
                                onComputerLineCompleteRef.current(); // still advance
                            }
                        } else {
                             onComputerLineCompleteRef.current(); // Advance if no index provided
                        }
                        break;
                    // AI Code cues are now no-ops
                    case CueType.SHOW_AI_CODE:
                    case CueType.HIDE_AI_CODE: 
                    case CueType.TRIGGER_ERROR: 
                    case CueType.NO_ERROR: 
                        break;
                }
                break;
            case LineType.SCENE_MARKER:
                break;
        }

        return () => {
            cancelAudio();
        }
    }, [currentLineIndex, script, status, audioFiles, videos, viewMode, playAudio, cancelAudio, videoState.dialogueIndex]);

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
        currentLine,
    };
};
