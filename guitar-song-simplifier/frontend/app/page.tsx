"use client";
import React, { useRef, useState, useEffect } from "react";
import{
  ChordUrlResult, Step
} from "@/lib/types"
import{
  uploadFile, analyzeFile, fetchChordUrl, fetchChordImageBytes
} from "@/lib/api"
import { Header } from "@/components/Header";
import { ActionButtons } from "@/components/ActionButtons";
import { RecordingPanel } from "@/components/RecordingPanel";
import { CustomSoundBar } from "@/components/CustomSoundBar";
import { ChordsToKnowDiagram } from "@/components/ChordsToKnowDiagram";
import { ChordSequenceDiagram } from "@/components/ChordSequenceDiagram";
import { useRecording } from "@/hooks/useRecording";

export default function Home() {
  // ============ UI STATE ============
  const [step, setStep] = useState<Step>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [upload, setUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyze, setAnalyze] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // ============ CHORD STATE ============
  const [uniqueChords, setUniqueChords] = useState<any>(null);
  const [uniqueChordURLs, setuniqueChordURLs] = useState<ChordUrlResult[] | null>(null);
  const [sequence, setSequence] = useState<any>(null);
  const [cachedImages, setCachedImages] = useState<{ [key: string]: string }>({});
  const [cacheing, setCacheing] = useState(false);

  // ============ AUDIO STATE ============
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaybackMuted, setIsPlaybackMuted] = useState(true);
  const [playbackVolume, setPlaybackVolume] = useState(1);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentAudioTime, setAudioTime] = useState(0);
  
  // ============ CHORD DISPLAY REFS ============
  const chordSequenceRef = useRef<HTMLDivElement>(null);
  const chordRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // ============ USE RECORDING HOOK ============
  const {
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
    handleRecord,
    stopRecording,

  } = useRecording({ sequence, uniqueChords, currentAudioTime });

  // ============ CREATE BLOB URL (to link the actual audio) ============
  useEffect(() => {
    if (selected) {
      const url = URL.createObjectURL(selected);
      setAudioURL(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [selected]);

  // ============ AUDIO TIME UPDATES ============
  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    const handleTimeUpdate = () => {
      setAudioTime(audio.currentTime);
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

  // ============ TIMELINE PROGRESS ============
  const timelineProgress =
    audioDuration > 0 ? Math.min((currentAudioTime / audioDuration) * 100, 100) : 0;

  // ============ VOLUME/MUTE ============
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = playbackVolume;
    audioRef.current.muted = isPlaybackMuted;
  }, [playbackVolume, isPlaybackMuted, step, audioURL]);

  // ============ SCROLL TO CURRENT CHORD THAT SHOULD BE PLAYED AT TIME IN TRACK ============
  useEffect(() => {
    if (chordTime == null || !chordSequenceRef.current) return;

    const chordElement = chordRefs.current[chordTime];
    if (!chordElement || !chordSequenceRef.current) return;

    const container = chordSequenceRef.current;
    const containerLeft = container.scrollLeft;
    const containerRight = containerLeft + container.offsetWidth;
    const elementLeft = chordElement.offsetLeft;
    const elementRight = elementLeft + chordElement.offsetWidth;

    const isOutOfFrame =
      elementRight < containerLeft || elementLeft > containerRight;

    if (isOutOfFrame) {
      container.scrollTo({
        left: elementLeft - 20,
        behavior: "smooth",
      });
    }
  }, [chordTime]);

  // ============ BODY PADDING FOR DIAGRAM LAYOUTS ============
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
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [step, uniqueChordURLs]);

  // ============ HANDLE UPLOAD ============
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

    try {
      await uploadFile(selected);
      setUploading(false);
    } catch (error) {
      console.error(error);
      setUploading(true);
    }
  };

  // ============ UPLOAD HANDLER ============
  const uploadHandler = (event: any) => {
    console.log("uploadHandler");
    setSelected(event.target.files[0]);
    setUpload(false);
    setAnalyze(false);
  };

  // ============ HANDLE ANALYZE ============
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
      const result = await analyzeFile(selected);
      console.log("Sequence:", result.chord_sequence);
      setSequence(result.chord_sequence);
      console.log("Unique Chords: ", result.unique_chords);
      setUniqueChords(result.unique_chords);
      setAnalyzing(false);
    } catch (error) {
      console.error(error);
      setAnalyzing(true);
    }
  };

  // ============ WRAPPER BEFORE CALLING FUNCTION RETURNED FORM RECORD HOOK ============
  const handleRecordWrapper = async () => {
    if (!recording) {
      setStep("record");
      setAudioTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    }
    await handleRecord();
  };

  // ============ FETCH UNIQUE CHORDS FROM API ============
  useEffect(() => {
    if (uniqueChords && uniqueChords.length > 0) {
      fetchUniqueChords();
    }
  }, [uniqueChords]);

  const fetchUniqueChords = async () => {
    if (!uniqueChords) return;
    try {
      const url_list = [];
      for (const chord of uniqueChords) {
        const result = await fetchChordUrl(chord);
        url_list.push(result);
      }
      setuniqueChordURLs(url_list);
    } catch (error) {
      console.error(error);
    }
  };

  // ============ CACHE CHORD DIAGRAM IMAGES ============
  useEffect(() => {
    if (!uniqueChordURLs) return;
    console.log("Unique Chord Info: ", uniqueChordURLs);

    setCacheing(true);
    const loadIntoCache = async () => {
      const cache = { ...cachedImages };

      for (const chord of uniqueChordURLs) {
        const url = chord.img_url;
        const cachedImg = localStorage.getItem(url);
        if (cachedImg) {
          console.log(`${chord.chord} is in local storage`);
          cache[url] = cachedImg;
        } else {
          try {
            console.log(`${chord.chord} is NOT in local storage, fetching and cacheing...`);
            const blob = await fetchChordImageBytes(url);
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

  // ============ START PLAYING TRACK AFTER COUNTDOWN ============
  const playAfterCountdown = async () => {
    if (count === true) {
      if (audioRef.current) {
        setIsPlaybackMuted(true);
        audioRef.current.play();
      }
    }
  };

    // ============ START PLAYING AFTER 3 SECONDS ============

  useEffect(() => {
    if (!count) return;
    const timeoutId = setTimeout(playAfterCountdown, 3000);
    return () => clearTimeout(timeoutId);
  }, [count]);

    // ============ STOP AUDIO IF RECORDING HAS STOPPED ============
  useEffect(()=>{
    if (stopped == true){
      if (audioRef.current?.paused === false) {
        audioRef.current.pause();
      }
    }
  }, [stopped])

  // ============ STOP RECORDING AT END OF TRACK ============
  useEffect(() => {
    if (audioDuration == currentAudioTime) {
      stopRecording();
    }
  }, [audioDuration, currentAudioTime, stopRecording]);

  // ============ RENDER UI ============
  return (
    <div>
      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          <Header />

          <ActionButtons
            selected={selected}
            uploading={uploading}
            upload={upload}
            analyzing={analyzing}
            analyze={analyze}
            recording={recording}
            cacheing={cacheing}
            onFileSelect={uploadHandler}
            onUpload={handleUpload}
            onAnalyze={handleAnalyze}
            onRecord={handleRecordWrapper}
          />
        </main>

        <div className="w-full max-w-2xl p-6 rounded-xl shadow-md text-center transition-all duration-300">
          {step == "upload" && <p>File Uploaded!</p>}

          {step == "record" && (
            <RecordingPanel
              timerNum={timerNum}
              recording={recording}
              progress={progress}
              accuracy={accuracy}
              detectedChord={detectedChord}
              chordFeedback={chordFeedback}
            />
          )}

          {(step == "analyze" || step == "record") && uniqueChordURLs && (
            <div className="fixed bottom-0 left-0 right-0 bg-white-900/95 backdrop-blur-sm border-t border-white-700 p-4 z-50">
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
              
              {audioURL && (step === "record") && (
                <CustomSoundBar
                  audioRef={audioRef}
                  audioURL={audioURL}
                  isPlaybackMuted={isPlaybackMuted}
                  playbackVolume={playbackVolume}
                  onSetPlaybackMuted={() => setIsPlaybackMuted(prev => !prev)}  
                  onSetPlaybackVolume={setPlaybackVolume}  
                  timelineProgress={timelineProgress}
                  currentAudioTime={currentAudioTime}
                  audioDuration={audioDuration}
                />
              )}

              <div className="flex flex-col items-start gap-6">
                <ChordsToKnowDiagram
                  cacheing={cacheing}
                  uniqueChordURLs={uniqueChordURLs}
                  cachedImages={cachedImages}
                />
                <ChordSequenceDiagram
                  chordSequenceRef={chordSequenceRef}
                  timesToChords={timesToChords}
                  uniqueChordURLs={uniqueChordURLs}
                  chordTime={chordTime}
                  chordRefs={chordRefs}
                  cachedImages={cachedImages}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}