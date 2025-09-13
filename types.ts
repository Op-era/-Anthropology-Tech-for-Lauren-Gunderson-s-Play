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
  CUT_TO_TEXT = 'CUT_TO_TEXT',
  CUT_TO_PRERECORDED = 'CUT_TO_PRERECORDED',
  UNKNOWN = 'UNKNOWN',
}

export interface CueLine {
  type: LineType.CUE;
  cue: CueType;
  originalText: string;
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
  TITLE_SCREEN = 'TITLE_SCREEN',
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
    DIALOGUE
}
