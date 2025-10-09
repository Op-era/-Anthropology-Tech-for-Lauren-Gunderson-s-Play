export enum LineType {
  DIALOGUE = 'DIALOGUE',
  CUE = 'CUE',
  SCENE_MARKER = 'SCENE_MARKER',
}

export interface DialogueLine {
  type: LineType.DIALOGUE;
  character: string;
  text: string;
}

export enum CueType {
  CUT_TO_LIVE_CAMERA = 'CUT_TO_LIVE_CAMERA',
  END_LIVE_FEED = 'END_LIVE_FEED',
  CUT_TO_TEXT = 'CUT_TO_TEXT',
  CUT_TO_PRERECORDED = 'CUT_TO_PRERECORDED',
  PLAY_SPECIFIC_VIDEO = 'PLAY_SPECIFIC_VIDEO',
  SHOW_AI_CODE = 'SHOW_AI_CODE',
  HIDE_AI_CODE = 'HIDE_AI_CODE',
  TRIGGER_ERROR = 'TRIGGER_ERROR',
  NO_ERROR = 'NO_ERROR',
  PLAY_VOICEMAIL = 'PLAY_VOICEMAIL',
  RED_SCREEN = 'RED_SCREEN',
  FLASHING_SCREEN = 'FLASHING_SCREEN',
  NORMAL_SCREEN = 'NORMAL_SCREEN',
  BLACKOUT = 'BLACKOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface CueLine {
  type: LineType.CUE;
  cue: CueType;
  originalText: string;
  audioIndex?: number;
  videoFilename?: string;
}

export interface SceneMarkerLine {
  type: LineType.SCENE_MARKER;
  sceneName: string;
}

export type ScriptLine = DialogueLine | CueLine | SceneMarkerLine;

export interface Scene {
    name: string;
    index: number;
}

export enum AppStatus {
  LOADING = 'LOADING',
  TITLE_SCREEN = 'TITLE_SCREEN',
  PROCESSING_SCREEN = 'PROCESSING_SCREEN',
  TRANSITION_SCREEN = 'TRANSITION_SCREEN',
  PERFORMING = 'PERFORMING',
  ERROR = 'ERROR',
}

export enum ViewMode {
  TEXT = 'TEXT',
  LIVE_VIDEO = 'LIVE_VIDEO',
  PRERECORDED = 'PRERECORDED',
}

export interface VideoFile {
  file: File;
  url: string;
}

export interface AudioFile {
  file: File;
  url: string;
}

export enum PrerecordedVideoState {
    IDLE,
    DIALOGUE,
    SPECIFIC,
}
