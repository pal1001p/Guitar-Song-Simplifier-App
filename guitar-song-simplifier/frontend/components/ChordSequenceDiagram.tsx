"use client";
import { ChordToURL } from "@/lib/types";
type ChordSequenceDiagramProps = {
    chordSequenceRef: React.RefObject<HTMLDivElement | null>;
    timesToChords: [time: number, chord: string][];
    uniqueChordURLs: ChordToURL[];
    chordTime: number;
    chordRefs: React.RefObject<{ [key: string]: HTMLDivElement | null }>;
    cachedImages: { [url: string]: string };
};

export function ChordSequenceDiagram({
    chordSequenceRef,
    timesToChords,
    uniqueChordURLs,
    chordTime,
    chordRefs,
    cachedImages
}: ChordSequenceDiagramProps) {
  return (
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
          const chordItem = uniqueChordURLs.find((i: any) => i.chord === chord);
          const url = chordItem?.img_url;
          // boolean to trigger if current chord is the one the audio is playing through
          // depends on chordTime state, which represents a real time from the sequence dict
          const isCurrentChord =
            chordTime !== null && Math.abs(chordTime - numTime) < 0.1;

          const minutes = Math.floor(numTime / 60);
          const remainder = Math.ceil(numTime % 60);
          var newTime = String(minutes) + " min " + String(remainder) + " sec";
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
              {/* ensure url exists first before displaying image */}
              {url &&(
              <img
                src={cachedImages[url] || url}
                alt={chord}
                className="max-w-[120px] max-h-[120px] object-contain mb-2"
              />)}
              <p className="font-mono text-sm text-gray-300 font-medium">
                {chord}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
