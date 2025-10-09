import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScriptLine, LineType, Scene, ViewMode, PrerecordedVideoState, CueType, AppStatus, AudioFile, VideoFile } from '../types';
import { COMPUTER_CHARACTER } from '../services/scriptParser';
import { useAudioPlayer } from './useAudioPlayer';

export const usePerformanceManager = (
    script: ScriptLine[], 
    audioFiles: AudioFile[],
    videos: VideoFile[],
    currentLineIndex: number,
    status: AppStatus
) => {
    const [isTyping, setIsTyping] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TEXT);
    const [borderEffect, setBorderEffect] = useState<'NORMAL' | 'RED' | 'FLASHING'>('NORMAL');
    const [isLiveFeedActive, setIsLiveFeedActive] = useState(false);
    const [videoState, setVideoState] = useState({
        state: PrerecordedVideoState.IDLE,
        dialogueIndex: -1,
        specificVideoUrl: null as string | null,
    });
    const [displayedAngieLine, setDisplayedAngieLine] = useState<string | null>(null);
    const [shouldAdvance, setShouldAdvance] = useState(false);

    const { play: playAudio, cancel: cancelAudio, isPlaying: isAudioPlaying } = useAudioPlayer();

    const currentLine = script[currentLineIndex];

    const isSpecificVideoPlaying = viewMode === ViewMode.PRERECORDED && videoState.state === PrerecordedVideoState.SPECIFIC;
    const isAngiesDialoguePlaying = viewMode === ViewMode.PRERECORDED && videoState.state === PrerecordedVideoState.DIALOGUE;
    const isComputerSpeaking = isTyping || isAudioPlaying || isAngiesDialoguePlaying || isSpecificVideoPlaying;

    const scenes = useMemo(() => script.reduce((acc, line, index) => {
        if (line.type === LineType.SCENE_MARKER) {
            acc.push({ name: line.sceneName, index });
        }
        return acc;
    }, [] as Scene[]), [script]);

    const angieDialogueIndex = useMemo(() => {
        if (currentLine?.type !== LineType.DIALOGUE || currentLine.character !== COMPUTER_CHARACTER) {
            return -1;
        }
        let count = -1;
        for (let i = 0; i <= currentLineIndex; i++) {
            const line = script[i];
            if (line.type === LineType.DIALOGUE && line.character === COMPUTER_CHARACTER) {
                const trimmedText = line.text.trim();
                const isShortParenthetical = trimmedText.startsWith('(') && trimmedText.endsWith(')') && trimmedText.length < 25;
                if (!trimmedText || isShortParenthetical) {
                    continue;
                }
                count++;
            }
        }
        return count;
    }, [currentLine, currentLineIndex, script]);

    const jumpToScene = useCallback((index: number) => {
        cancelAudio();
        setDisplayedAngieLine(null);
        setVideoState({ state: PrerecordedVideoState.IDLE, dialogueIndex: -1, specificVideoUrl: null });
        setBorderEffect('NORMAL');
        setViewMode(ViewMode.TEXT);
        setIsLiveFeedActive(false);
    }, [cancelAudio]);

    const onTypingComplete = useCallback(() => {
        setIsTyping(false);
    }, []);
    
    const onDialogueVideoEnd = useCallback(() => {
        setVideoState(prev => ({ ...prev, state: PrerecordedVideoState.IDLE }));
    }, []);

    const onSpecificVideoEnd = useCallback(() => {
        setVideoState({
            state: PrerecordedVideoState.IDLE,
            dialogueIndex: -1,
            specificVideoUrl: null,
        });
        setShouldAdvance(true);
    }, []);

    const resetAdvance = useCallback(() => {
        setShouldAdvance(false);
    }, []);

    useEffect(() => {
        const line = script[currentLineIndex];
        if (!line || status !== AppStatus.PERFORMING) return;

        // --- Core State Machine Logic ---
        
        // Reset typing status for every new line.
        setIsTyping(false);

        switch (line.type) {
            case LineType.DIALOGUE:
                if (line.character === COMPUTER_CHARACTER) {
                    const trimmedText = line.text.trim();
                    const isShortParenthetical = trimmedText.startsWith('(') && trimmedText.endsWith(')') && trimmedText.length < 25;

                    if (!trimmedText || isShortParenthetical) {
                        setDisplayedAngieLine(null);
                        break; 
                    }
                    
                    if (viewMode === ViewMode.PRERECORDED) {
                        setDisplayedAngieLine(null);
                        const dialogueVideoExists = videos[angieDialogueIndex + 1];
                        if (dialogueVideoExists) {
                            setVideoState({ state: PrerecordedVideoState.DIALOGUE, dialogueIndex: angieDialogueIndex, specificVideoUrl: null });
                        }
                    } else if (viewMode === ViewMode.TEXT) {
                        const audioToPlay = audioFiles[angieDialogueIndex];
                        
                        setIsTyping(true);
                        setDisplayedAngieLine(line.text);

                        if (audioToPlay) {
                            playAudio(audioToPlay.url);
                        }
                    } else if (viewMode === ViewMode.LIVE_VIDEO) {
                        // When live, ANGIE's lines can be audio-only.
                        setDisplayedAngieLine(null);
                        const audioToPlay = audioFiles[angieDialogueIndex];
                        if (audioToPlay) {
                            playAudio(audioToPlay.url);
                        }
                    }
                } else {
                    // This logic is now redundant due to smart navigation in App.tsx, but is safe to keep.
                    cancelAudio();
                    setDisplayedAngieLine(null);
                }
                break;
            case LineType.CUE:
                // Handle all cues here
                switch(line.cue) {
                    case CueType.CUT_TO_LIVE_CAMERA:
                        setViewMode(ViewMode.LIVE_VIDEO);
                        setIsLiveFeedActive(true);
                        setDisplayedAngieLine(null);
                        cancelAudio();
                        break;
                    case CueType.END_LIVE_FEED:
                        setIsLiveFeedActive(false);
                        setViewMode(ViewMode.TEXT);
                        break;
                    case CueType.CUT_TO_TEXT:
                        setViewMode(ViewMode.TEXT);
                        setIsLiveFeedActive(false);
                        break;
                    case CueType.CUT_TO_PRERECORDED:
                        setViewMode(ViewMode.PRERECORDED);
                        setVideoState({ state: PrerecordedVideoState.IDLE, dialogueIndex: -1, specificVideoUrl: null });
                        setIsLiveFeedActive(false);
                        break;
                    case CueType.PLAY_SPECIFIC_VIDEO:
                        if (line.videoFilename) {
                            const videoToPlay = videos.find(v => v.file.name.trim().toLowerCase() === line.videoFilename?.trim().toLowerCase());
                            if (videoToPlay) {
                                setViewMode(ViewMode.PRERECORDED);
                                setVideoState({ state: PrerecordedVideoState.SPECIFIC, dialogueIndex: -1, specificVideoUrl: videoToPlay.url });
                                setDisplayedAngieLine(null);
                                cancelAudio();
                            } else {
                                console.warn(`Video file not found for cue: ${line.originalText}`);
                            }
                        }
                        break;
                    case CueType.PLAY_VOICEMAIL:
                        if (line.audioIndex !== undefined) {
                            const audioToPlay = audioFiles[line.audioIndex];
                            if (audioToPlay) {
                                playAudio(audioToPlay.url);
                            } else {
                                console.warn(`Voicemail cue for audio index ${line.audioIndex} but audio file not found.`);
                            }
                        }
                        break;
                    case CueType.BLACKOUT:
                        setDisplayedAngieLine(null);
                        break;
                    case CueType.RED_SCREEN: setBorderEffect('RED'); break;
                    case CueType.FLASHING_SCREEN: setBorderEffect('FLASHING'); break;
                    case CueType.NORMAL_SCREEN: setBorderEffect('NORMAL'); break;
                    // Other cues like SHOW_AI_CODE are handled elsewhere or are no-ops here.
                    case CueType.SHOW_AI_CODE:
                    case CueType.HIDE_AI_CODE: 
                    case CueType.TRIGGER_ERROR: 
                    case CueType.NO_ERROR: 
                        break;
                }
                break;
            case LineType.SCENE_MARKER:
                setDisplayedAngieLine(null);
                break;
        }

        return () => {
            cancelAudio();
        }
    }, [currentLineIndex, script, status, audioFiles, videos, viewMode, playAudio, cancelAudio, angieDialogueIndex]);

    return {
        scenes,
        viewMode,
        videoState,
        displayedAngieLine,
        isComputerSpeaking,
        borderEffect,
        isLiveFeedActive,
        jumpToScene,
        onTypingComplete,
        onDialogueVideoEnd,
        onSpecificVideoEnd,
        shouldAdvance,
        resetAdvance,
        currentLine,
    };
};