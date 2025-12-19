"use client";
import React, { useRef, useState, useEffect } from "react";
import Script from "next/script";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [step, setStep] = useState<"upload" | "analyze" | "record" | null>(
    null
  );
  const [selected, setSelected] = useState<File | null>(null);
  const [upload, setUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyze, setAnalyze] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [record, setRecord] = useState(false);
  const [recording, setRecording] = useState(false);
  // for logging
  const [response, setRes] = useState<any>(null);
  // singular chords extracted from current song
  const [uniqueChords, setUniqueChords] = useState<any>(null);
  // urls for chords extracted from current song
  const [uniqueChordInfo, setuniqueChordInfo] = useState<any>(null);
  // sequence of times, chords extracted from current song
  const [sequence, setSequence] = useState<any>(null);
  // cached images for session
  const [cachedImages, setCachedImages] = useState({});
  // for intermediate message that images are getting fetched
  const [cacheing, setCacheing] = useState(false);
  // audio states
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState<number>(0);
  const [chordTime, setChordTime] = useState<number>(0);
  const chordSequenceRef = useRef<HTMLDivElement>(null);
  const chordRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  // get the current time in the audio
  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    const handleTimeUpdate = () => {
      setTime(audio.currentTime);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [step, uniqueChordInfo]);

  // find chord time from sequence dict based on current time in audio
  useEffect(() => {
    if (!sequence) {
      setChordTime(0);
      return;
    }

    // sequence is a dict of time:chord, so have to convert it to nums to sort
    const times: [number, string][] = Object.entries(sequence)
      .map(
        ([time, chord]) =>
          [parseFloat(time), chord as string] as [number, string]
      )
      .sort(([a], [b]) => (a as number) - (b as number));
    let chordTime = 0;

    // now sorted for sure, so iterate backwards
    for (let i = times.length - 1; i >= 0; i--) {
      const [cand] = times[i];
      if (cand <= time) {
        chordTime = cand;
        break;
      }
    }
    setChordTime(chordTime);
  }, [time, sequence]);

  // scroll to current chord when it changes
  useEffect(() => {
    if (chordTime == null || !chordSequenceRef.current) return;

    const chordElement = chordRefs.current[chordTime];
    if (chordElement && chordSequenceRef.current) {
      const container = chordSequenceRef.current;
      const elementLeft = chordElement.offsetLeft;
      const elementWidth = chordElement.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;

      const elementCenter = elementLeft + elementWidth / 2;
      const containerCenter = scrollLeft + containerWidth / 2;

      if (Math.abs(elementCenter - containerCenter) > containerWidth / 3) {
        container.scrollTo({
          left: elementCenter - containerWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [chordTime]);

  // clears local storage upon refresh
  // useEffect (() =>{
  //   for (const key in localStorage){
  //     if (key.startsWith("https://www.scales-chords.com")) {
  //       localStorage.removeItem(key);
  //     }
  //   }
  // }, [])

  // adds bottom padding to body when chord diagrams pop up
  useEffect(() => {
    if (step === "analyze" && uniqueChordInfo && cachedImages) {
      document.body.style.paddingBottom = "400px";
    } else {
      document.body.style.paddingBottom = "";
    }
    // cleanup on mount
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [step, uniqueChordInfo]);

  // uploads user's file
  const handleUpload = async () => {
    console.log("handleUpload");

    setStep("upload");
    setUpload(true);
    setAnalyze(false);
    setRecord(false);

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
      setRes(JSON.stringify(data, null, 2));
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
    setRecord(false);
  };

  // analyzes file
  const handleAnalyze = async () => {
    console.log("handleAnalyze");

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
      setRes(JSON.stringify(result, null, 2));
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
          `${API_URL}/load_unique_chord_url?chord=${encodeURIComponent(chord)}`
        );
        if (!res.ok) throw new Error("External API error");
        const result = await res.json();
        url_list.push(result);
      }
      setuniqueChordInfo(url_list);
    } catch (error) {
      console.error(error);
    }
  };

  // if the list of chord URLs has been gotten from fetchUniqueChords, try to load the image bytes into local storage
  useEffect(() => {
    if (!uniqueChordInfo) return;
    console.log("Unique Chord Info: ", uniqueChordInfo);

    setCacheing(true);
    const loadIntoCache = async () => {
      // create copy
      const cache = { ...cachedImages };

      // for each unique chord's url
      for (const chord of uniqueChordInfo) {
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
              `${API_URL}/load_chord_image_bytes?url=${encodeURIComponent(url)}`
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
  }, [uniqueChordInfo]);

  // handle recording
  const handleRecord = () => {
    console.log("handleRecord");

    setStep("record");
    setRecord(true);
  };

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
                  ? "bg-gray-200 hover:bg-gray-300 text-black"
                  : "bg-gray-400 cursor-not-allowed text-gray-200"
              }`}
            >
              Record Yourself
            </button>
          </div>
        </main>

        {/* UI Changes for Each Step */}
        <div className="w-full max-w-2xl p-6 rounded-xl shadow-md text-center transition-all duration-300">
          {step == "upload" && <p>File Uploaded!</p>}

          {step == "record" && <p>Recorded!</p>}

          {step === "analyze" && uniqueChordInfo && (
            <div className="fixed bottom-0 left-0 right-0 bg-white-900/95 backdrop-blur-sm border-t border-white-700 p-4 z-50">
              {audioURL && (
                <div className="mb-6 flex flex-col items-center gap-2">
                  <audio
                    ref={audioRef}
                    src={audioURL}
                    controls
                    className="w-full max-w-md"
                  />
                </div>
              )}

              <div className="flex flex-col lg:flex-row items-start gap-6">
                <div className="lg:w-1/2 ">
                  <h3 className="text-center mb-4 font-mono text-lg text-gray-200">
                    Chords You Have to Know
                  </h3>
                  <div className=" flex flex-wrap justify-center gap-4 max-h-64 overflow-y-auto px-4 pb-4">
                    {cacheing
                      ? "Getting chords..."
                      : uniqueChordInfo.map((chord: any, i: number) => (
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

                <div className="lg:w-1/2 ">
                  <h3 className="text-center mb-4 font-mono text-lg text-gray-200">
                    Your Chord Sequence
                  </h3>
                  <div
                    ref={chordSequenceRef}
                    className="flex gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap px-4 pb-4"
                  >
                    {Object.entries(sequence)
                      // first map adds new numerical representation of chord times
                      .map(
                        ([time, chord]) =>
                          [parseFloat(time), time, chord] as [
                            number,
                            string,
                            string
                          ]
                      )
                      // sorts in ascending order just in case
                      .sort(([a], [b]) => a - b)
                      // maps again for rendering info
                      .map(([numTime, time, chord]) => {
                        // finds url for each chord for diagram display (including fallback)
                        const info = uniqueChordInfo.find(
                          (i) => i.chord === chord
                        );
                        const url = info?.img_url;
                        // boolean to trigger if current chord is the one the audio is playing through
                        // depends on chordTime state, which represents a real time from the sequence dict
                        const isCurrentChord =
                          chordTime !== null &&
                          Math.abs(chordTime - numTime) < 0.1;
                        return (
                          <div
                            key={time}
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
                              {time}
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
