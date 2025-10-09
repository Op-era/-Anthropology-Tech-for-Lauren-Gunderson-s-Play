import { ScriptLine, LineType, DialogueLine, CueLine, CueType, SceneMarkerLine } from '../types';

const COMPUTER_CHARACTER = 'ANGIE';

const parseCue = (text: string): { cue: CueType; audioIndex?: number; videoFilename?: string } => {
  const cleanText = text.toLowerCase().trim();

  // Add explicit, high-priority checks for critical cues
  if (cleanText === '(livefeed)') {
    return { cue: CueType.CUT_TO_LIVE_CAMERA };
  }
  if (cleanText === '(/livefeed)') {
    return { cue: CueType.END_LIVE_FEED };
  }
  if (cleanText === '(blackout)') {
    return { cue: CueType.BLACKOUT };
  }
  
  if (cleanText === '(red screen)') {
    return { cue: CueType.RED_SCREEN };
  }
  if (cleanText === '(flashing screen)') {
    return { cue: CueType.FLASHING_SCREEN };
  }
  if (cleanText === '(normal screen)') {
    return { cue: CueType.NORMAL_SCREEN };
  }
  
  const videoMatch = cleanText.match(/^\(video:\s*(.+)\)$/);
  if (videoMatch && videoMatch[1]) {
    return { cue: CueType.PLAY_SPECIFIC_VIDEO, videoFilename: videoMatch[1].trim() };
  }

  if (cleanText.includes('cut to camera') || cleanText.includes('cut to live') || cleanText.includes('cut to live feed')) {
    return { cue: CueType.CUT_TO_LIVE_CAMERA };
  }
  if (cleanText.includes('cut to text')) {
    return { cue: CueType.CUT_TO_TEXT };
  }
  if (cleanText.includes('cut to prerecorded') || cleanText.includes('cut to video')) {
    return { cue: CueType.CUT_TO_PRERECORDED };
  }
  if (cleanText.includes('show ai code')) {
    return { cue: CueType.SHOW_AI_CODE };
  }
  if (cleanText.includes('hide ai code')) {
    return { cue: CueType.HIDE_AI_CODE };
  }
  if (cleanText.includes('no error')) {
    return { cue: CueType.NO_ERROR };
  }
  if (cleanText.includes('error')) {
    return { cue: CueType.TRIGGER_ERROR };
  }
  if (cleanText.startsWith('(voicemail:')) {
    const match = cleanText.match(/\(voicemail:\s*(\d+)\)/);
    if (match && match[1]) {
        // The script will use 1-based indexing for human readability.
        const audioIndex = parseInt(match[1], 10) - 1;
        if (audioIndex >= 0) {
            return { cue: CueType.PLAY_VOICEMAIL, audioIndex };
        }
    }
  }
  return { cue: CueType.UNKNOWN };
};

export const parseScript = (scriptText: string): ScriptLine[] => {
  const lines = scriptText.split(/\r?\n/);
  const parsedScript: ScriptLine[] = [];
  let lastCharacter: string | null = null;
  let isInsideParenthetical = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '') continue;

    // 1. Scene Markers
    const sceneMatch = trimmedLine.match(/^(SCENE\s+.+|^\d+\.?$)/i);
    if (sceneMatch) {
      parsedScript.push({ type: LineType.SCENE_MARKER, sceneName: trimmedLine });
      lastCharacter = null;
      isInsideParenthetical = false;
      continue;
    }

    // 2. Cues
    const parsedCue = parseCue(trimmedLine);
    if (parsedCue.cue !== CueType.UNKNOWN) {
      const cueLine: CueLine = { type: LineType.CUE, cue: parsedCue.cue, originalText: trimmedLine };
      if (parsedCue.audioIndex !== undefined) cueLine.audioIndex = parsedCue.audioIndex;
      if (parsedCue.videoFilename !== undefined) cueLine.videoFilename = parsedCue.videoFilename;
      parsedScript.push(cueLine);
      lastCharacter = null;
      isInsideParenthetical = false;
      continue;
    }
    
    // 3. New Dialogue lines
    const dialogueMatch = trimmedLine.match(/^\s*([a-zA-Z\s\(\)\.]+):\s*(.+)$/);
    if (dialogueMatch) {
      const [, character, text] = dialogueMatch;
      let charUpper = character.trim().toUpperCase();
      
      if (charUpper === 'ANGLE') charUpper = 'ANGIE';

      parsedScript.push({ type: LineType.DIALOGUE, character: charUpper, text: text.trim() });
      lastCharacter = charUpper;
      
      // Handle multi-line parentheticals starting on the same line as a character name
      if (text.trim().startsWith('(') && !text.trim().endsWith(')')) {
          isInsideParenthetical = true;
      } else {
          isInsideParenthetical = false;
      }
      continue;
    }

    // 4. Continuation of dialogue (multi-line speeches and parentheticals)
    if (lastCharacter) {
      // If we are inside a parenthetical, keep adding lines to it
      if (isInsideParenthetical) {
          const lastLine = parsedScript[parsedScript.length - 1];
          if (lastLine.type === LineType.DIALOGUE) {
              lastLine.text += ' ' + trimmedLine;
              if (trimmedLine.endsWith(')')) {
                  isInsideParenthetical = false;
              }
          }
          continue;
      }
      
      // Start a new parenthetical block
      if (trimmedLine.startsWith('(') && !trimmedLine.endsWith(')')) {
        isInsideParenthetical = true;
      }

      parsedScript.push({ type: LineType.DIALOGUE, character: lastCharacter, text: trimmedLine });
      continue;
    }

    // 5. Fallback for lines that don't match anything else
    parsedScript.push({ type: LineType.DIALOGUE, character: 'USER', text: trimmedLine });
  }

  return parsedScript;
};

export { COMPUTER_CHARACTER };