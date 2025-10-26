'use client'
import React, { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function Home() {
  const [step, setStep] = useState<"upload"|"analyze"|"record"|null>(null)
  const [upload, setUpload] = useState(false)
  const [selected, setSelected] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [analyze, setAnalyze] = useState(false)
  const [record, setRecord] = useState(false)
  const [response, setRes] = useState('')
  

  const handleUpload = async () => {
    setStep("upload")
    setUpload(true)
    setAnalyze(false)
    setRecord(false)

    if (!selected) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', selected)

    try{
      const res = await fetch(`${API_URL}/upload_file`, {
        method: "POST",
        body : formData
      })
      const result = await res.json()
      setRes(JSON.stringify(result, null, 2))
    } catch(error){
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  const uploadHandler = (event) => {
    setSelected(event.target.files[0])
    setUpload(false)
    // setAnalyze(false)
    // setRecord(false)
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
            Browse a new song
          </li>
          <li className="mb-2 tracking-[-.01em]">
            Upload your song
          </li>
          <li className="mb-2 tracking-[-.01em]">
            Analyze the song to extract chords and rhythm 
          </li>
          <li className="mb-2 tracking-[-.01em]">
            Press record to play and gain feedback in real time
          </li>
        </ol>

      <div className="flex gap-4 items-center flex-col sm:flex-row">
        
          <input
            className = "rounded-full px-5 py-3 font-medium bg-gray-200 hover:bg-gray-300 text-black"
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
            {uploading ? 'Uploading...' : 'Upload Song'}
          </button>

          <button
            onClick={handleAnalyze}
            disabled = {!upload}
            className={`rounded-full px-5 py-3 font-medium ${
              upload
                ? "bg-gray-200 hover:bg-gray-300 text-black"
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
                ? "bg-gray-200 hover:bg-gray-300 text-black"
                : "bg-gray-400 cursor-not-allowed text-gray-200"
            }`}          >
            Record Yourself
          </button>
        </div>
      </main>
     
      <div className="w-full max-w-2xl p-6 rounded-xl shadow-md text-center transition-all duration-300">
        
        {step == 'upload' && (
            <p >Uploaded! {response}</p>
        )}
        {step == 'analyze' && (
          <p >Analyzed!</p>
        )}
        {step == 'record' && (
          <p >Recorded!</p>
        )}
      </div>
    

    </div>

    
  );
}
