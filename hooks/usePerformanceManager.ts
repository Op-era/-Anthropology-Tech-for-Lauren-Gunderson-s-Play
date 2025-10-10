import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ScriptLine,
  LineType,
  CueType,
  DialogueLine,
  CueLine,
  ViewMode,
  VideoFile,
  AudioFile,
  PrerecordedVideoState,
  Scene,
} from '../types';
import { useTextToSpeech } from './useTextToSpeech';
import { useAudioPlayer } from './useAudioPlayer';
import { COMPUTER_CHARACTER } from '../services/scriptParser';

interface PerformanceManagerOptions {
  script: ScriptLine[];
  videos: VideoFile[];
  audioFiles: AudioFile[];
  currentLineIndex: number;
  onAdvance: () => void;
  scenes: Scene[];
}

export const usePerformanceManager = ({
  script,
  videos,
  audioFiles,
  currentLineIndex,
  onAdvance,
  scenes,
}: PerformanceManagerOptions) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TEXT);
  const [videoState, setVideoState] = useState<{
    state: PrerecordedVideoState;
    dialogueIndex: number;
    specificVideoUrl: string | null;
  }>({ state: PrerecordedVideoState.IDLE, dialogueIndex: -1, specificVideoUrl: null });
  
  const [displayedAngieLine, setDisplayedAngieLine] = useState<DialogueLine | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isLiveFeedActive, setIsLiveFeedActive] = useState(false);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [shouldAdvance, setShouldAdvance] = useState(false);

  const { speak, cancel: cancelSpeech, isSpeaking } = useTextToSpeech();
  const { play: playAudio, cancel: cancelAudio, isPlaying: isAudioPlaying } = useAudioPlayer();

  const dialogueVideos = useMemo(() => videos.filter(v => !v.file.name.toLowerCase().startsWith('idle')), [videos]);
  const idleVideoUrl = useMemo(() => videos.find(v => v.file.name.toLowerCase().startsWith('idle'))?.url || null, [videos]);

  const onAdvanceRef = useRef(onAdvance);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  const onTypingComplete = useCallback(() => {
    setIsTyping(false);
  }, []);

  const onDialogueVideoEnd = useCallback(() => {
    setVideoState({ state: PrerecordedVideoState.IDLE, dialogueIndex: -1, specificVideoUrl: null });
  }, []);

  const angieDialogueIndex = useMemo(() => {
    if (!script || !scenes) return -1;
    
    const currentScene = scenes.slice().reverse().find(s => s.index <= currentLineIndex);
    const sceneStartIndex = currentScene ? currentScene.index : 0;

    let count = -1;
    for (let i = sceneStartIndex; i <= currentLineIndex; i++) {
        const line = script[i];
        if (line && line.type === LineType.DIALOGUE && line.character === COMPUTER_CHARACTER) {
            const trimmedText = line.text.trim();
            const isShortParenthetical = trimmedText.startsWith('(') && trimmedText.endsWith(')') && trimmedText.length < 25;
            if (trimmedText && !isShortParenthetical) {
                count++;
            }
        }
    }
    return count;
  }, [currentLineIndex, script, scenes]);

  const isSpecificVideoPlaying = videoState.state === PrerecordedVideoState.SPECIFIC;
  const isAngiesDialoguePlaying = viewMode === ViewMode.PRERECORDED && videoState.state === PrerecordedVideoState.DIALOGUE;
  const isComputerSpeaking = isTyping || isAudioPlaying || isAngiesDialoguePlaying || isSpecificVideoPlaying;

  useEffect(() => {
    const line = script[currentLineIndex];
    if (!line) return;

    // High-priority auto-skip for live feed
    if (isAutoAdvancing) {
        if (line.type === LineType.CUE && line.cue === CueType.END_LIVE_FEED) {
            setIsLiveFeedActive(false);
            setDisplayedAngieLine(null);
            setViewMode(ViewMode.TEXT);
            setIsAutoAdvancing(false);
        } else {
             setShouldAdvance(true);
        }
        return;
    }

    setIsTyping(false);

    switch (line.type) {
      case LineType.DIALOGUE:
        if (line.character === COMPUTER_CHARACTER) {
          const trimmedText = line.text.trim();
          const isShortParenthetical = trimmedText.startsWith('(') && trimmedText.endsWith(')') && trimmedText.length < 25;

          if (!trimmedText || isShortParenthetical) {
            setDisplayedAngieLine(null);
            setShouldAdvance(true);
            break;
          }

          if (viewMode === ViewMode.PRERECORDED) {
            setDisplayedAngieLine(null);
            const videoToPlay = dialogueVideos[angieDialogueIndex];
            if (videoToPlay) {
              setVideoState({ state: PrerecordedVideoState.DIALOGUE, dialogueIndex: angieDialogueIndex, specificVideoUrl: null });
            } else {
              setVideoState({ state: PrerecordedVideoState.MISSING, dialogueIndex: angieDialogueIndex, specificVideoUrl: null });
            }
          } else { // TEXT or LIVE_VIDEO
            setIsTyping(true);
            setDisplayedAngieLine(line);
            const audioToPlay = audioFiles[angieDialogueIndex];
            if (audioToPlay) {
              playAudio(audioToPlay.url, () => setIsTyping(false));
            }
          }
        } else {
          cancelAudio();
          setDisplayedAngieLine(null);
          // This is a user line, so we wait for the user to advance.
        }
        break;
      
      case LineType.CUE:
        setDisplayedAngieLine(null);
        switch (line.cue) {
          case CueType.CUT_TO_LIVE_CAMERA:
            setViewMode(ViewMode.LIVE_VIDEO);
            setIsLiveFeedActive(true);
            setIsAutoAdvancing(true);
            setShouldAdvance(true);
            break;
          case CueType.CUT_TO_TEXT:
            setViewMode(ViewMode.TEXT);
            setShouldAdvance(true);
            break;
          case CueType.CUT_TO_PRERECORDED:
            setViewMode(ViewMode.PRERECORDED);
            setShouldAdvance(true);
            break;
          case CueType.PLAY_SPECIFIC_VIDEO:
            const videoToPlay = videos.find(v => v.file.name.toLowerCase() === line.videoFilename?.toLowerCase());
            if (videoToPlay) {
              setViewMode(ViewMode.PRERECORDED);
              setVideoState({ state: PrerecordedVideoState.SPECIFIC, dialogueIndex: -1, specificVideoUrl: videoToPlay.url });
            } else {
              setViewMode(ViewMode.PRERECORDED);
              setVideoState({ state: PrerecordedVideoState.MISSING, dialogueIndex: -1, specificVideoUrl: null });
            }
            break;
          default:
            setShouldAdvance(true);
            break;
        }
        break;
      
      case LineType.SCENE_MARKER:
        setDisplayedAngieLine(null);
        setShouldAdvance(true);
        break;
    }

    return () => {
      cancelAudio();
    };
  }, [currentLineIndex, script, videos, audioFiles, dialogueVideos, viewMode, playAudio, cancelAudio, scenes, isAutoAdvancing]);

  useEffect(() => {
    if (shouldAdvance) {
      onAdvanceRef.current();
      setShouldAdvance(false);
    }
  }, [shouldAdvance]);
  
  return {
    viewMode,
    videoState,
    isComputerSpeaking,
    isLiveFeedActive,
    isAutoAdvancing,
    angieLine: displayedAngieLine,
    onTypingComplete,
    onDialogueVideoEnd,
    idleVideoUrl,
    dialogueVideos,
    angieDialogueIndex
  };
};