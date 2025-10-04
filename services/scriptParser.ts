import { ScriptLine, LineType, DialogueLine, CueLine, CueType, SceneMarkerLine } from '../types';

const COMPUTER_CHARACTER = 'ANGIE';

const parseCue = (text: string): { cue: CueType; audioIndex?: number } => {
  const cleanText = text.toLowerCase().trim();
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
  const lines = scriptText.split(/\r?\n/); // Handles different line endings
  const parsedScript: ScriptLine[] = [];
  let lastCharacter: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '') continue; // Skip empty lines

    // 1. Check for Scene Markers
    const sceneMatch = trimmedLine.match(/^(scene\s+[\w\d]+|act\s+[ivx]+\s*,\s*scene\s+[\w\d]+|^\d+\.?$)/i);
    if (sceneMatch) {
      parsedScript.push({
        type: LineType.SCENE_MARKER,
        sceneName: trimmedLine,
      });
      lastCharacter = null; // Reset speaker on scene change
      continue;
    }
    
    // 2. Check for new Dialogue lines (Character: Text)
    const dialogueMatch = trimmedLine.match(/^\s*([a-zA-Z\s]+):\s+(.+)$/);
    if (dialogueMatch) {
      const [, character, text] = dialogueMatch;
      let charUpper = character.trim().toUpperCase();

      // Correct common typos for the main character
      if (charUpper === 'ANGLE') {
          charUpper = 'ANGIE';
      }

      parsedScript.push({
        type: LineType.DIALOGUE,
        character: charUpper,
        text: text.trim(),
      });
      lastCharacter = charUpper; // Set the last character
      continue;
    }

    // 3. Check for Cues
    const parsedCue = parseCue(trimmedLine);
    if (parsedCue.cue !== CueType.UNKNOWN) {
        const cueLine: CueLine = {
            type: LineType.CUE,
            cue: parsedCue.cue,
            originalText: trimmedLine,
        };
        if (parsedCue.audioIndex !== undefined) {
            cueLine.audioIndex = parsedCue.audioIndex;
        }
        parsedScript.push(cueLine);
        lastCharacter = null; // Cues reset the speaker
        continue;
    }

    // 4. Handle continuation of dialogue (multi-line speeches and parentheticals)
    if (lastCharacter) {
        parsedScript.push({
            type: LineType.DIALOGUE,
            character: lastCharacter,
            text: trimmedLine,
        });
        continue;
    }

    // 5. Fallback: If no last character is set and it's not a recognized format,
    // assume it's dialogue for the user (Merril in this case).
    parsedScript.push({
      type: LineType.DIALOGUE,
      character: 'USER',
      text: trimmedLine,
    });
  }

  return parsedScript;
};

export { COMPUTER_CHARACTER };
