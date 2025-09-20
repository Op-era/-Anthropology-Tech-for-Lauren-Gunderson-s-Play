import { useState, useEffect, useRef, useCallback } from 'react';

// Fix: Add type definitions for the Web Speech API to resolve TypeScript errors.
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: () => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionOptions {
  onResult: (transcript: string) => void;
}

const SpeechRecognition: SpeechRecognitionConstructor | undefined =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const useSpeechRecognition = ({ onResult }: SpeechRecognitionOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (isListening || !recognitionRef.current) {
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (error) {
       // This can happen if it's already starting, which is fine.
       if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn("Speech recognition already starting.");
       } else {
          console.error("Error starting speech recognition:", error);
       }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!isListening || !recognitionRef.current) {
      return;
    }
    recognitionRef.current.stop();
  }, [isListening]);


  useEffect(() => {
    // Check initial permission status if the API is available
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' } as any).then((status) => {
        setPermissionStatus(status.state);
        status.onchange = () => {
          setPermissionStatus(status.state);
        };
      });
    }

    if (!SpeechRecognition) {
      console.error('Speech Recognition API not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = false; // Important for turn-based interaction
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      // If recognition starts, it implies permission has been granted at some point.
      setPermissionStatus('granted');
    };

    recognition.onend = () => {
      setIsListening(false);
      // The parent component is now solely responsible for restarting.
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // These are not critical errors. `onend` will fire next.
        return;
      }
      
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.error('Speech recognition permission denied.');
        setPermissionStatus('denied');
      } else {
        console.error('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const fullTranscript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');

      setTranscript(fullTranscript);

      // Check if the final result for this utterance has been received.
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        onResultRef.current(fullTranscript.trim());
        // Since continuous is false, recognition will stop automatically.
        // The onend event will fire, and the parent component's useEffect
        // will decide if it needs to start listening for the next cue.
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
      }
    };
  }, []);

  return { 
    isListening, 
    transcript, 
    start: startListening, 
    stop: stopListening, 
    clearTranscript, 
    supported: !!SpeechRecognition, 
    permissionStatus 
  };
};