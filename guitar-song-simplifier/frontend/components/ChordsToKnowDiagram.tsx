"use client"

import { ChordUrlResult } from "@/lib/types"

type ChordsToKnowDiagramProps = {
    cacheing: boolean,
    // array of {chord, img_url}
    uniqueChordURLs: ChordUrlResult[],
    // url string : base64 string representing image
    cachedImages: {[url: string]: string}
}

export function ChordsToKnowDiagram({
    cacheing,
    uniqueChordURLs,
    cachedImages
}: ChordsToKnowDiagramProps){
    return (
        <div className="w-full ">
          <h3 className="text-center mb-4 font-mono text-lg text-gray-200">
            Chords You Have to Know
          </h3>
          <div className=" flex flex-wrap justify-center gap-4 max-h-64 overflow-y-auto px-4 pb-4">
            {cacheing ? "Getting chords..."
              : uniqueChordURLs.map((chordItem, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center bg-blue-800/70 rounded-lg p-3 hover:bg-gray-800 transition-colors"
                  >
                    <img
                    // fallback
                      src={cachedImages[chordItem.img_url] || chordItem.img_url}
                      alt={chordItem.chord}
                      className="max-w-[120px] max-h-[120px] object-contain mb-2"
                    />
                    <p className="font-mono text-sm text-gray-300 font-medium">
                      {chordItem.chord}
                    </p>
                  </div>
                ))}
          </div>
        </div>
    )
}