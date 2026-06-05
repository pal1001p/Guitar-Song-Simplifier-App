"use client";
import React, { useRef, useState, useEffect } from "react";
import Script from "next/script";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [step, setStep] = useState<"upload" | "analyze" | "record" | null>(
    null,
  );
  // steps
  const [selected, setSelected] = useState<File | null>(null);
  const [upload, setUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyze, setAnalyze] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [timerNum, setCurrentAudioTimerNum] = useState(0);
  const [recording, setRecording] = useState(false);
  // recording-specific states
  const [count, setCountFinished] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [sofar, setChordsSoFar] = useState(0);
  const [progress, setProgress] = useState(0);
  // WebSocket and audio capture
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<any>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const wsAudioEnabledRef = useRef(false);
  const audioChunksSentRef = useRef(0);
  // Real-time chord detection feedback
  const [detectedChord, setDetectedChord] = useState<string | null>(null);
  const [chordFeedback, setChordFeedback] = useState<{
    status: string;
    message: string;
    timestamp: number;
  } | null>(null);
  // singular chords extracted from current song
  const [uniqueChords, setUniqueChords] = useState<any>(null);
  // urls for chords extracted from current song
  const [uniqueChordURLs, setuniqueChordURLs] = useState<any>(null);
  // sequence of times to chords extracted from current song
  const [sequence, setSequence] = useState<any>(null);
  const [timesToChords, setTimesToChords] = useState<[number, string][]>([]);
  // cached images for session
  const [cachedImages, setCachedImages] = useState<{ [key: string]: string }>({},);
  // for intermediate message that images are getting fetched
  const [cacheing, setCacheing] = useState(false);
  // audio states for sound bars
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaybackMuted, setIsPlaybackMuted] = useState(true);
  const [playbackVolume, setPlaybackVolume] = useState(1);
  const [audioDuration, setAudioDuration] = useState(0);
  // time in the audio bar
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  // time for a certain chord (from sequence)
  const [chordTime, setChordTime] = useState(0);
  // chord display states
  const chordSequenceRef = useRef<HTMLDivElement>(null);
  const chordRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // useEffect(() => {
  //   console.log("chord feedback: ", chordFeedback);
  // }, [chordFeedback]);

  // creates blob URL (temporary in-browser url)
  useEffect(() => {
    if (selected) {
      const url = URL.createObjectURL(selected);
      setAudioURL(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [selected]);

  // get the current time in the audio (for custom UI sound bar in recording)
  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    const handleTimeUpdate = () => {
      setCurrentAudioTime(audio.currentTime);
    };
    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration || 0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleLoadedMetadata);
    };
  }, [step, uniqueChordURLs]);

  // formats audio time (for custom UI sound bar in recording)
  const formatAudioTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // calculates progress of song (for custom UI sound bar in recording)
  const timelineProgress =
    audioDuration > 0 ? Math.min((currentAudioTime / audioDuration) * 100, 100) : 0;

  // adjust volume/mute settings based on UI triggers (for custom UI sound bar in recording)
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = playbackVolume;
    audioRef.current.muted = isPlaybackMuted;
  }, [playbackVolume, isPlaybackMuted, step, audioURL]);

  // find closest chord time in sequence dict based on current time in audio 
  useEffect(() => {
    if (!sequence) {
      setChordTime(0);
      return;
    }

    // sequence is a dict of time:chord, so have to convert time to numeric to sort
    const times: [number, string][] = Object.entries(sequence)
      .map(
        ([time, chord]) =>
          [parseFloat(time), chord as string] as [number, string],
      )
      .sort(([a], [b]) => (a as number) - (b as number));
    setTimesToChords(times)
    let chordTime = 0;

    // now sorted for sure, so iterate backwards
    for (let i = times.length - 1; i >= 0; i--) {
      const [cand] = times[i];
      if (cand <= currentAudioTime) {
        chordTime = cand;
        break;
      }
    }
    setChordTime(chordTime);
  }, [currentAudioTime, sequence]);

  // scroll to current chord when it changes (scrolls whenever some audio playback starts)
  useEffect(() => {
    if (chordTime == null || !chordSequenceRef.current) return;

    const chordElement = chordRefs.current[chordTime];
    if (!chordElement || !chordSequenceRef.current) return;

    const container = chordSequenceRef.current;

    // Get positions
    const containerLeft = container.scrollLeft;
    const containerRight = containerLeft + container.offsetWidth;
    const elementLeft = chordElement.offsetLeft;
    const elementRight = elementLeft + chordElement.offsetWidth;

    // Check if element is completely out of frame
    const isOutOfFrame =
      elementRight < containerLeft || elementLeft > containerRight;

    if (isOutOfFrame) {
      // Element is out of frame - scroll to bring it into view
      // Position it at the left edge with a small padding
      container.scrollTo({
        left: elementLeft - 20, // 20px padding from left edge
        behavior: "smooth",
      });
    }
    // If it's in frame (even partially), do nothing
  }, [chordTime]);

  // adds bottom padding to body when chord diagrams pop up
  useEffect(() => {
    if (
      (step === "analyze" || step === "record") &&
      uniqueChordURLs &&
      cachedImages
    ) {
      document.body.style.paddingBottom = "1000px";
    } else {
      document.body.style.paddingBottom = "";
    }
    // cleanup on mount
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [step, uniqueChordURLs]);

  // uploads user's file
  const handleUpload = async () => {
    console.log("handleUpload");

    setStep("upload");
    setUpload(true);
    setAnalyze(false);
    if (recording == true) {
      stopRecording();
    }

    if (!selected) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selected);

    try {
      const res = await fetch(`${API_URL}/upload_file`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setUploading(false);
    } catch (error) {
      console.error(error);
      setUploading(true);
    }
  };

  // lets user pick file
  const uploadHandler = (event: any) => {
    console.log("uploadHandler");

    setSelected(event.target.files[0]);
    setUpload(false);
    setAnalyze(false);
  };

  // analyzes file
  const handleAnalyze = async () => {
    console.log("handleAnalyze");
    if (recording == true) {
      stopRecording();
    }

    setStep("analyze");
    setAnalyze(true);
    if (!selected) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error("Server error");
      // object or dict
      console.log("Sequence:", result.chord_sequence);
      setSequence(result.chord_sequence);
      // array
      console.log("Unique Chords: ", result.unique_chords);
      setUniqueChords(result.unique_chords);

      setAnalyzing(false);
    } catch (error) {
      console.error(error);
      setAnalyzing(true);
    }
  };

  // once unique chords have been extracted, do the intial fetch
  useEffect(() => {
    if (uniqueChords && uniqueChords.length > 0) {
      fetchUniqueChords();
    }
  }, [uniqueChords]);

  // complete the initial fetch for each chord's URL
  const fetchUniqueChords = async () => {
    if (!uniqueChords) return;
    try {
      const url_list = [];
      for (const chord of uniqueChords) {
        // proxy
        const res = await fetch(
          `${API_URL}/load_unique_chord_url?chord=${encodeURIComponent(chord)}`,
        );
        if (!res.ok) throw new Error("External API error");
        const result = await res.json();
        url_list.push(result);
      }
      setuniqueChordURLs(url_list);
    } catch (error) {
      console.error(error);
    }
  };

  // if the list of chord URLs has been gotten from fetchUniqueChords, try to load the image bytes into local storage
  useEffect(() => {
    if (!uniqueChordURLs) return;
    console.log("Unique Chord Info: ", uniqueChordURLs);

    setCacheing(true);
    const loadIntoCache = async () => {
      // create copy
      const cache = { ...cachedImages };

      // for each unique chord's url
      for (const chord of uniqueChordURLs) {
        const url = chord.img_url;
        // try to get it from local storage if it's there
        const cachedImg = localStorage.getItem(url);
        if (cachedImg) {
          console.log(`${chord.chord} is in local storage`);
          cache[url] = cachedImg;
        }
        // if not, fetch it first and then put into cache
        else {
          try {
            console.log(`${chord.chord} is NOT in local storage`);
            const res = await fetch(
              `${API_URL}/load_chord_image_bytes?url=${encodeURIComponent(url)}`,
            );
            const blob = await res.blob();
            const reader = new FileReader();

            reader.onloadend = () => {
              const base64data = reader.result;
              if (base64data && typeof base64data === "string") {
                localStorage.setItem(url, base64data);
                cache[url] = base64data;
                setCachedImages({ ...cache });
              }
            };
            reader.readAsDataURL(blob);
          } catch (error) {
            console.error("Error caching image:", error);
          }
        }
      }
      setCachedImages(cache);
      setCacheing(false);
    };
    loadIntoCache();
  }, [uniqueChordURLs]);

  // Stop recording and cleanup
  const stopRecording = () => {
    if (audioRef.current?.paused === false) {
      audioRef.current.pause();
    }

    // Clear connection timeout so it doesn't fire after we've stopped
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    wsAudioEnabledRef.current = false;
    audioChunksSentRef.current = 0;

    // 1) Stop microphone and audio pipeline first so we don't keep recording
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

    // 2) Then close WebSocket cleanly
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

    setRecording(false);
    setAccuracy(0);
    setCorrect(0);
    setChordsSoFar(0);
    setProgress(0);
    setDetectedChord(null);
    setChordFeedback(null);
    setCountFinished(false);
  };

  // start countdown before recording
  const startCountdown = () => {
    console.log("starting countdown");
    setCurrentAudioTimerNum(3);
    const intervalId = setInterval(() => {
      setCurrentAudioTimerNum((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setTimeout(actualRecord, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setCountFinished(true);
  };

  // handle record button press
  const handleRecord = async () => {
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

    setStep("record");
    setCurrentAudioTime(0);
    setChordTime(0);
    setAccuracy(0)
    setCorrect(0)
    setChordsSoFar(0)
    setProgress(0)
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }

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
      startCountdown();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please grant permission.");
      stopRecording();
    }
  };

  // handle actual recording
  const actualRecord = async () => {
    setRecording(true);

    try {
      // Get WebSocket URL (replace http/https with ws/wss)
      let wsUrl = API_URL || "http://localhost:8000";

      // Handle URL conversion properly
      if (wsUrl.startsWith("http://")) {
        wsUrl = wsUrl.replace("http://", "ws://");
      } else if (wsUrl.startsWith("https://")) {
        wsUrl = wsUrl.replace("https://", "wss://");
      } else if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
        // If no protocol, assume http and convert to ws
        wsUrl = `ws://${wsUrl}`;
      }

      // Remove trailing slash if present
      wsUrl = wsUrl.replace(/\/$/, "");

      const wsEndpoint = `${wsUrl}/ws/record`;
      console.log("Connecting to WebSocket:", wsEndpoint);

      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;

      // Set a connection timeout (stored in ref so stopRecording can clear it)
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

        // Send init with default sample rate; we'll send actual rate after AudioContext is created
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
          // Request mic and build audio graph inside onopen so stream stays live for the whole recording
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
            console.log(
              "entering stop recording in actualRecord after server error",
            );

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
        // Don't show alert on error - onclose will handle it
      };

      ws.onclose = async (event) => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        console.log("WebSocket closed", event.code, event.reason);
        if (recording && event.code !== 1000) {
          // Only alert if it was an unexpected close (not a normal close)
          let errorMsg = `Connection closed`;
          if (event.code === 1006) {
            // Connection refused - server likely not running
            const healthUrl = API_URL || "http://localhost:8000";
            let serverStatus = "Unknown";
            try {
              const healthCheck = await fetch(`${healthUrl}/health`, {
                method: "GET",
                signal: AbortSignal.timeout(3000),
              });
              serverStatus = healthCheck.ok ? "Running" : "Not responding";
            } catch (e) {
              serverStatus = "Not accessible";
            }

            errorMsg =
              `Cannot connect to WebSocket server!`;
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
      console.log(
        "entering stop recording in actualRecord after failing to start recoridng",
      );

      stopRecording();
    }
  };

  // play sound (on mute) after countdown
  const playAfterCountdown = async () => {
    if (count === true) {
      if (audioRef.current) {
        setIsPlaybackMuted(true);
        audioRef.current.play();
      }
    }
  };

  // short timeout after countdown to trigger playing of soundbar (helps user keep track of time)
  useEffect(() => {
    setTimeout(playAfterCountdown, 3000);
  }, [count]);

  // stop recording if reached end of track
  useEffect(() => {
    if (audioDuration == currentAudioTime) {
      stopRecording();
    }
  }, [audioDuration, currentAudioTime]);

  // update correct chords played if status was good
  useEffect(() => {
    if (chordFeedback?.status == "good") {
      setCorrect(correct + 1);
    }
  }, [chordFeedback]);

  // track total chords that should've been played so far
  useEffect(() => {
    const index = timesToChords.findIndex(([t]) => t === chordTime);
    setChordsSoFar(index+1)
  }, [chordTime]);

  // compute accuracy and progress
  useEffect(() => {
    if (sofar > 0){
      setAccuracy((correct / sofar) * 100);
    }
    if (sequence) {
      setProgress((sofar / Object.keys(sequence).length) * 100);
    }
  }, [correct, sofar, chordTime]);

  // useEffect(() => {
  //   console.log("correct", correct);
  // }, [correct]);

  // useEffect(() => {
  //   console.log("accuracy", accuracy);
  // }, [accuracy]);

  // useEffect(() => {
  //   console.log("progress", progress);
  // }, [progress]);

  // useEffect(()=>{
  //   console.log("debug: ", {
  //     step,
  //     recording,
  //     // literal time in the track
  //     audioTime: audioRef.current?.currentTime,
  //     // time at which certain chord should be played
  //     chordTime,
  //     audioPaused: audioRef.current?.paused,
  //     audioSrc: audioRef.current?.src,
  //     // time at which chord was actually played
  //     timestamp: chordFeedback?.timestamp,
  //     message: chordFeedback?.message
  //   });
  // }, [step, recording, chordTime, time, chordFeedback?.timestamp, chordFeedback?.message])

  return (
    <div>
      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          {/* Title and main text */}
          <h1 className="font-mono text-5xl font-bold mb-10 text-gray-300">
            Guitar Song Simplifier
          </h1>
          <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
            <li className="mb-2 tracking-[-.01em]">Browse a new song</li>
            <li className="mb-2 tracking-[-.01em]">Upload your song</li>
            <li className="mb-2 tracking-[-.01em]">
              Analyze the song to extract chords and rhythm
            </li>
            <li className="mb-2 tracking-[-.01em]">
              Press record to play and gain feedback in real time
            </li>
          </ol>

          {/* Main buttons */}
          <div className="flex gap-4 items-center flex-col sm:flex-row">
            <input
              className="rounded-full px-5 py-3 font-medium bg-gray-200 hover:bg-gray-300 text-black"
              type="file"
              accept="audio/*"
              onChange={uploadHandler}
            />

            <button
              onClick={handleUpload}
              disabled={!selected || uploading}
              className={`rounded-full px-5 py-3 font-medium ${
                selected && !uploading
                  ? "bg-gray-200 hover:bg-gray-300 text-black"
                  : "bg-gray-400 cursor-not-allowed text-gray-200"
              }`}
            >
              {uploading ? "Uploading..." : "Upload Song"}
            </button>

            <button
              onClick={handleAnalyze}
              disabled={!upload || uploading}
              className={`rounded-full px-5 py-3 font-medium ${
                upload && !uploading
                  ? "bg-gray-200 hover:bg-gray-300 text-black"
                  : "bg-gray-400 cursor-not-allowed text-gray-200"
              }`}
            >
              {analyzing ? "Analyzing..." : "Analyze Song"}
            </button>

            <button
              onClick={handleRecord}
              disabled={!analyze || analyzing || cacheing}
              className={`rounded-full px-5 py-3 font-medium ${
                analyze && !analyzing && !cacheing
                  ? recording
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-black"
                  : "bg-gray-400 cursor-not-allowed text-gray-200"
              }`}
            >
              {recording ? "Stop Recording" : "Start Recording"}
            </button>
          </div>
        </main>

        {/* UI Changes for Each Step */}

        <div className="w-full max-w-2xl p-6 rounded-xl shadow-md text-center transition-all duration-300">
          {step == "upload" && <p>File Uploaded!</p>}

          {step == "record" && (
            <div className="w-full max-w-2xl p-6 rounded-xl shadow-md">
              {/* Countdown */}
              <div className="text-center mb-6 p-4 bg-gray-800/50 rounded-lg">
                {timerNum > 0 && <p> Recording starting in {timerNum} ... </p>}
              </div>

              {recording ? (
                <div className="space-y-6">
                  {/* SHOWS DETECTED CHORD AND FEEDBACK */}
                  <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    {" "}
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <p className="text-gray-300">Recording...</p>
                    <div className="p-4 rounded-lg bg-gray-800">
                      <p className="text-lg font-semibold text-gray-200 mb-2">
                        <span className="text-blue-400">
                          Progress: {Math.round(progress)}%
                        </span>
                        <p></p>
                        <span className="text-blue-400">
                          Accuracy: {Math.round(accuracy)}%
                        </span>
                      </p>
                    </div> 
                  </div>

                  {detectedChord && (
                    <div className="p-4 rounded-lg bg-gray-800">
                      <p className="text-lg font-semibold text-gray-200 mb-2">
                        Detected Chord:{" "}
                        <span className="text-blue-400">{detectedChord}</span>
                      </p>

                      {chordFeedback && (
                        <div
                          className={`p-3 rounded ${
                            chordFeedback.status === "good"
                              ? "bg-green-600/30 border border-green-500"
                              : chordFeedback.status === "wrong_chord" ||
                                  chordFeedback.status === "wrong"
                                ? "bg-red-600/30 border border-red-500"
                                : chordFeedback.status === "too_early" ||
                                    chordFeedback.status === "too_late"
                                  ? "bg-yellow-600/30 border border-yellow-500"
                                  : "bg-gray-700 border border-gray-600"
                          }`}
                        >
                          <p
                            className={`font-medium ${
                              chordFeedback.status === "good"
                                ? "text-green-300"
                                : // correct += 1
                                  chordFeedback.status === "wrong_chord" ||
                                    chordFeedback.status === "wrong"
                                  ? "text-red-300"
                                  : chordFeedback.status === "too_early" ||
                                      chordFeedback.status === "too_late"
                                    ? "text-yellow-300"
                                    : "text-gray-300"
                            }`}
                          >
                            {chordFeedback.message}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            Time:{" "}
                            {Math.floor(
                              Number(chordFeedback.timestamp.toFixed(2)) / 60,
                            )}
                            min{" "}
                            {Math.floor(
                              Number(chordFeedback.timestamp.toFixed(2)) % 60,
                            )}
                            s
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-300">
                  Click "Start Recording" to start real-time chord detection.
                </p>
              )}
            </div>
          )}

          {(step == "analyze" || step == "record") && uniqueChordURLs && (
            <div className="fixed bottom-0 left-0 right-0 bg-white-900/95 backdrop-blur-sm border-t border-white-700 p-4 z-50">
              {/* native sound bar for analysis */}
               {audioURL && (step === "analyze") && (
                <div className="mb-6 flex flex-col items-center gap-2">
                  <audio
                    key="native"
                    ref={audioRef}
                    src={audioURL}
                    controls
                    className="w-full max-w-md"
                  />
                </div>
              )}
              {/* custom sound bar for recording (no seeking or pause) */}
              {audioURL && (step === "record") && (
                <div className="mb-6 flex flex-col items-center gap-2">
                  <audio
                    key="native"
                    ref={audioRef}
                    src={audioURL}
                    muted={isPlaybackMuted}
                    className="hidden"
                  />
                  <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setIsPlaybackMuted((prev) => !prev)}
                        className="rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-800 transition-colors"
                      >
                        {isPlaybackMuted ? "Unmute" : "Mute"}
                      </button>
                      <div className="flex flex-1 items-center gap-2">
                        <span className="text-xs text-gray-400">Volume</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={playbackVolume}
                          onChange={(e) =>
                            setPlaybackVolume(Number(e.target.value))
                          }
                          className="w-full accent-blue-400"
                          aria-label="Recording playback volume"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-gray-700">
                        <div
                          className="h-full rounded-full bg-blue-400 transition-all"
                          style={{ width: `${timelineProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>{formatAudioTime(currentAudioTime)}</span>
                        <span>{formatAudioTime(audioDuration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              
              {/* Big container for chord diagrams during analysis and record */}
              <div className="flex flex-col items-start gap-6">
                {/* general chords */}
                <div className="w-full ">
                  <h3 className="text-center mb-4 font-mono text-lg text-gray-200">
                    Chords You Have to Know
                  </h3>
                  <div className=" flex flex-wrap justify-center gap-4 max-h-64 overflow-y-auto px-4 pb-4">
                    {cacheing
                      ? "Getting chords..."
                      : uniqueChordURLs.map((chord: any, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col items-center bg-blue-800/70 rounded-lg p-3 hover:bg-gray-800 transition-colors"
                          >
                            <img
                              src={cachedImages[chord.img_url] || chord.img_url}
                              alt={chord.chord}
                              className="max-w-[120px] max-h-[120px] object-contain mb-2"
                            />
                            <p className="font-mono text-sm text-gray-300 font-medium">
                              {chord.chord}
                            </p>
                          </div>
                        ))}
                  </div>
                </div>

                <div className="w-full">
                  {/* chord sequence */}
                  <h3 className="text-center mb-4 font-mono text-lg text-gray-200">
                    Your Chord Sequence
                  </h3>
                  <div
                    ref={chordSequenceRef}
                    className="flex gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap px-4 pb-4"
                  >
                    {/* rendering chord sequence */}

                      {timesToChords.map(([numTime, chord]) => {
                        // finds url for each chord for diagram display (including fallback)
                        const info = uniqueChordURLs.find(
                          (i: any) => i.chord === chord,
                        );
                        const url = info?.img_url;
                        // boolean to trigger if current chord is the one the audio is playing through
                        // depends on chordTime state, which represents a real time from the sequence dict
                        const isCurrentChord =
                          chordTime !== null &&
                          Math.abs(chordTime - numTime) < 0.1;

                        const minutes = Math.floor(numTime / 60);
                        const remainder = Math.ceil(numTime % 60);
                        var newTime =
                          String(minutes) +
                          " min " +
                          String(remainder) +
                          " sec";
                        if (minutes == 0) {
                          newTime = String(remainder) + " sec";
                        }
                        if (remainder == 0) {
                          newTime = String(minutes) + " min ";
                        }

                        return (
                          <div
                            key={numTime}
                            ref={(el) => {
                              chordRefs.current[numTime] = el;
                            }}
                            className={`flex flex-col items-center rounded-lg p-3 transition-all ${
                              isCurrentChord
                                ? "bg-yellow-600/90 scale-110 shadow-lg ring-2 ring-yellow-400"
                                : "bg-green-800/70 hover:bg-gray-800"
                            }`}
                          >
                            <p className="font-mono text-sm text-gray-300 font-medium">
                              {newTime}
                            </p>

                            <img
                              src={cachedImages[url] || url}
                              alt={chord}
                              className="max-w-[120px] max-h-[120px] object-contain mb-2"
                            />
                            <p className="font-mono text-sm text-gray-300 font-medium">
                              {chord}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
