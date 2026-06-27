"use client"

import { ChordFeedback } from "@/lib/types"

type RecordingPanelProps = {
    timerNum:number,
    recording: boolean,
    progress: number,
    accuracy: number,
    detectedChord: string | null,
    chordFeedback: ChordFeedback | null
}

export function RecordingPanel({
    timerNum,
    recording,
    progress,
    accuracy,
    detectedChord,
    chordFeedback
}: RecordingPanelProps) {
    return (
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
    )
}