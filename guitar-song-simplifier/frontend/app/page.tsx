'use client'
import React, { useState } from "react";

export default function Home() {
  const [step, setStep] = useState<"upload"|"analyze"|"record"|null>(null)
  const [upload, setUpload] = useState(false)
  const [analyze, setAnalyze] = useState(false)
  const [record, setRecord] = useState(false)

  const handleUpload = () => {
    setStep("upload")
    setUpload(true)
  }
  const handleAnalyze = () => {
    setStep("analyze")
    setAnalyze(true)
  }
  const handleRecord = () => {
    setStep("record")
    setRecord(true)
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
      <h1 className="font-mono text-5xl font-bold mb-10 text-gray-300">
        Guitar Song Simplifier
      </h1>
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Upload a new song to analyze{" "}
          </li>
          <li className="mb-2 tracking-[-.01em]">
            Analyze the song to extract chords and rhythm {" "}
          </li>
          <li className="mb-2 tracking-[-.01em]">
            Press record to play and gain feedback in real time{" "}
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <button
            onClick={handleUpload}
            className="rounded-full bg-gray-200 hover:bg-gray-300 text-black font-medium px-5 py-3"
          >
            Upload New Song
          </button>

          <button
            onClick={handleAnalyze}
            disabled = {!upload}
            className={`rounded-full px-5 py-3 font-medium ${
              upload
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-400 cursor-not-allowed text-gray-200"
            }`}
          >
            Analyze Song
          </button>

          <button
            onClick={handleRecord}
            disabled = {!analyze}
            className={`rounded-full px-5 py-3 font-medium ${
              analyze
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-400 cursor-not-allowed text-gray-200"
            }`}          >
            Record Yourself
          </button>
        </div>
      </main>
     



      {/* Dynamic Content Area
      <div className="w-full max-w-2xl p-6 bg-white rounded-xl shadow-md text-center transition-all duration-300">
        
      </div> */}
    

    </div>

    
  );
}
