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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stoppedManually = useRef(false);
  const onResultRef = useRef(onResult);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const start = useCallback(() => {
    if (recognitionRef.current) {
      stoppedManually.current = false;
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch (error) {
         if (error instanceof DOMException && error.name === 'InvalidStateError') {
            // Already running, which is the desired state. Ignore.
         } else {
            console.error("Error starting speech recognition:", error);
         }
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      stoppedManually.current = true;
       if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      recognitionRef.current.stop();
    }
  }, []);


  useEffect(() => {
    if (!SpeechRecognition) {
      console.error('Speech Recognition API not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      stoppedManually.current = false;
      retryCountRef.current = 0; // Reset on successful start
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!stoppedManually.current && !retryTimeoutRef.current) {
        // Not a manual stop, and not in a retry loop for a specific error.
        // This is likely a 'no-speech' timeout. Restart quickly.
        setTimeout(() => {
          if (!stoppedManually.current) start();
        }, 100);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        // This is a common timeout event, not a critical error.
        // The onend handler will restart the recognition, so we can just return.
        return;
      }
      
      console.error('Speech recognition error:', event.error);
      setIsListening(false);

      // Handle network-related errors with exponential backoff
      if (['network', 'service-not-allowed'].includes(event.error)) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }

        const retryDelay = Math.min(30000, Math.pow(2, retryCountRef.current) * 1000); // 1s, 2s, 4s... up to 30s
        console.log(`Retrying speech recognition due to '${event.error}' in ${retryDelay / 1000} seconds...`);

        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          if (!stoppedManually.current) {
              retryCountRef.current++;
              start();
          }
        }, retryDelay);
      }
    };

    recognition.onresult = (event) => {
      const fullTranscript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');

      setTranscript(fullTranscript);

      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        onResultRef.current(fullTranscript.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      stoppedManually.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      recognition.stop();
    };
  }, [start]);

  return { isListening, transcript, start, stop, supported: !!SpeechRecognition };
};