import { useRef, useState, useEffect, useCallback } from 'react';
import { ChordFeedback } from '@/lib/types';
import { getWebSocketRecordUrl, checkHealth } from '@/lib/api';

type UseRecordingParams = {
  sequence: any;
  uniqueChords: any;
  currentAudioTime: number;
};

export function useRecording({
  sequence,
  uniqueChords,
  currentAudioTime,
}: UseRecordingParams) {
  // ============ RECORDING STATE ============
  const [recording, setRecording] = useState(false);
  const [count, setCountFinished] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [sofar, setChordsSoFar] = useState(0);
  const [progress, setProgress] = useState(0);
  const [detectedChord, setDetectedChord] = useState<string | null>(null);
  const [chordFeedback, setChordFeedback] = useState<ChordFeedback | null>(null);
  const [timerNum, setCurrentAudioTimerNum] = useState(0);
  const [timesToChords, setTimesToChords] = useState<[number, string][]>([]);
  const [chordTime, setChordTime] = useState(0);
  const [stopped, setStopped] = useState(true)


  // ============ RECORDING REFS ============
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<any>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsAudioEnabledRef = useRef(false);
  const audioChunksSentRef = useRef(0);
  const recordingRef = useRef(false);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  // ============ STOP RECORDING ============
  const stopRecording = useCallback(() => {
    // Clear connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    wsAudioEnabledRef.current = false;
    audioChunksSentRef.current = 0;

    // 1) Stop microphone and audio pipeline
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (_) {}
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    console.log("Closing mic in stopRecording()");

    // 2) Close WebSocket
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      console.log("Closing WebSocket, state:", ws.readyState);

      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;

      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "stop" }));
        } catch (_) {}
      }
      try {
        ws.close(1000, "Recording stopped");
      } catch (_) {}
      console.log("WebSocket cleaned up");
    }

    // Reset all state
    setRecording(false);
    setAccuracy(0);
    setCorrect(0);
    setChordsSoFar(0);
    setProgress(0);
    setDetectedChord(null);
    setChordFeedback(null);
    setCountFinished(false);
    setStopped(true)
  }, []);

  // ============ START COUNTDOWN BEFORE RECORDING ============
  const startCountdown = useCallback((callback: () => void) => {
    console.log("starting countdown");
    // used to render countdown on UI same time as setCountFinished begins its delay
    setCurrentAudioTimerNum(3);
    const intervalId = setInterval(() => {
      setCurrentAudioTimerNum((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setTimeout(callback, 100);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    // runs immediately
    // will trigger timeout -> playAfterCountdown in page.tsx
    setCountFinished(true);
  }, []);

  // ============ ACTUAL RECORD ============
  const actualRecord = useCallback(async () => {
    

    if (!sequence || !uniqueChords) {
      alert("Please analyze a song first!");
      return;
    }

    setRecording(true);
    setStopped(false)

    try {
      const wsEndpoint = getWebSocketRecordUrl();
      console.log("Connecting to WebSocket:", wsEndpoint);
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;

      connectionTimeoutRef.current = setTimeout(() => {
        connectionTimeoutRef.current = null;
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          alert(
            `WebSocket connection timeout.\n\n` +
              `Could not connect to: ${wsEndpoint}\n\n` +
              `Please verify:\n` +
              `1. Backend is running and accessible\n` +
              `2. WebSocket endpoint is correct\n` +
              `3. No firewall is blocking the connection`,
          );
          setRecording(false);
        }
      }, 10000);

      ws.onopen = async () => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        console.log("WebSocket connected");

        ws.send(
          JSON.stringify({
            type: "init",
            chord_sequence: sequence,
            unique_chords: uniqueChords,
            category: "MirexMajMin",
            sample_rate: 44100,
          }),
        );

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });

          if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          mediaStreamRef.current = stream;

          const AudioContextCtor =
            window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextCtor();
          audioContextRef.current = audioContext;

          const actualSampleRate = audioContext.sampleRate;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "sample_rate",
                sample_rate: actualSampleRate,
              }),
            );
          }

          const source = audioContext.createMediaStreamSource(stream);
          const bufferSize = 16384;
          const processor = (audioContext as any).createScriptProcessor(
            bufferSize,
            1,
            1,
          );
          processorRef.current = processor;
          wsAudioEnabledRef.current = false;

          processor.onaudioprocess = (e: AudioProcessingEvent) => {
            if (
              !wsAudioEnabledRef.current ||
              ws.readyState !== WebSocket.OPEN
            ) {
              return;
            }
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Data = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            ws.send(int16Data.buffer);
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
          console.log("Mic and audio graph ready; waiting for server ready...");
        } catch (error) {
          console.error("Error accessing microphone:", error);
          alert("Could not access microphone. Please grant permission.");
          stopRecording();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "ready") {
            console.log("Server ready to process audio");
            wsAudioEnabledRef.current = true;
          } else if (data.type === "chord_detected") {
            setDetectedChord(data.chord);
            setChordFeedback({
              status: data.status,
              message: data.message,
              timestamp: data.timestamp,
            });
            console.log("Chord detected:", data);
          } else if (data.type === "error") {
            console.error("Server error:", data.message);
            alert(`Server Error: ${data.message}`);
            console.log("entering stop recording in actualRecord after server error");
            stopRecording();
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
      };

      ws.onclose = async (event) => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        console.log("WebSocket closed", event.code, event.reason);
        if (recordingRef.current && event.code !== 1000) {
          let errorMsg = `Connection closed`;
          if (event.code === 1006) {
            try {
              await checkHealth();
            } catch (_) {
              // health check failed; still show connection error below
            }
            errorMsg = `Cannot connect to WebSocket server!`;
          } else if (event.reason) {
            errorMsg = `Connection closed: ${event.reason}`;
          }
          alert(errorMsg);
        }
        console.log("entering stop recording in actualRecord in try");
        stopRecording();
      };
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to start recording. Please try again.");
      console.log("entering stop recording in actualRecord after failing to start recording");
      stopRecording();
    }
  }, [sequence, uniqueChords, stopRecording]);

  // ============ HANDLE RECORD BUTTON ============
  const handleRecord = useCallback(async () => {
    console.log("handleRecord");
    if (wsRef.current || recording) {
      stopRecording();
      await new Promise((resolve) => setTimeout(resolve, 200));
      return;
    }

    if (!sequence || !uniqueChords) {
      alert("Please analyze a song first!");
      return;
    }

    setAccuracy(0);
    setCorrect(0);
    setChordsSoFar(0);
    setProgress(0);
    setDetectedChord(null);
    setChordFeedback(null);
    setCountFinished(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      console.log("Microphone permission granted");
      // startCountdown has a callback to actualRecord
      startCountdown(actualRecord);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please grant permission.");
      stopRecording();
    }
  }, [recording, sequence, uniqueChords, startCountdown, actualRecord, stopRecording]);

  // ============ EFFECTS ============

  // 1. Set timesToChords when sequence is extracted (will be used to compute progress)
  useEffect(() => {
    if (sequence) {
      const times: [number, string][] = Object.entries(sequence)
        .map(
          ([time, chord]) =>
            [parseFloat(time), chord as string] as [number, string],
        )
        .sort(([a], [b]) => (a as number) - (b as number));
      setTimesToChords(times);
    } else {
      setTimesToChords([]);
    }
  }, [sequence]);

  // 2. Find closest (static) chord time in sequence 
  // based on current audio time using timesToChords
  // (e.g. if you are 10 seconds into audio, find closest timestamp at which a chord is played in extracted sequence)
  // will be used to compute total chords played so far
  useEffect(() => {
    if (!sequence) {
      setChordTime(0);
      return;
    }
    let chordTime = 0;
    const currentTime = currentAudioTime

    for (let i = timesToChords.length - 1; i >= 0; i--) {
      const [cand] = timesToChords[i];
      if (cand <= currentTime) {
        chordTime = cand;
        break;
      }
    }
    setChordTime(chordTime);
  }, [currentAudioTime, sequence, timesToChords]);

  // 3. Update correct chords when feedback is good (used to compute accuracy)
  useEffect(() => {
    if (chordFeedback?.status === "good") {
      setCorrect((prev) => prev + 1);
    }
  }, [chordFeedback]);

  // 4. Track total chords that should have been played so far (used to compute accuracy/progress)
  useEffect(() => {
    // since timesToChords tracks a pair of a chord to the time it's played
    // finding index at which some chordTime occurs + 1 (due to 0-based)
    // represents total number of chords that should have been played so far
    // tracks length of how far along we are in the sequence based on the time we've been recording
    const index = timesToChords.findIndex(([t]) => t === chordTime);
    setChordsSoFar(index + 1);
  }, [chordTime, timesToChords]);

  // 5. Compute accuracy and progress
  // accuracy is the biggest teller of whether player is doing well
  // progress simply measures how far along we are into song 
  // (irrespective of whether player is even playing; that's where accuracy matters)
  useEffect(() => {
    if (sofar > 0) {
      setAccuracy((correct / sofar) * 100);
    }
    if (sequence) {
      const totalChords = Object.keys(sequence).length;
      setProgress((sofar / totalChords) * 100);
    }
  }, [correct, sofar, sequence]);

  return {
    // State
    recording,
    count,
    accuracy,
    progress,
    detectedChord,
    chordFeedback,
    timerNum,
    timesToChords,
    chordTime,
    stopped,
    
    // Functions
    handleRecord,
    stopRecording
    
  };
}