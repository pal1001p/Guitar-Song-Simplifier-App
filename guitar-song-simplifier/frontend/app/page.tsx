'use client'
import React, { useState, useEffect, useRef } from "react";
import Script from "next/script"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function Home() {
  const [step, setStep] = useState<"upload"|"analyze"|"record"|null>(null)
  const [upload, setUpload] = useState(false)
  const [selected, setSelected] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyze, setAnalyze] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [record, setRecord] = useState(false)
  const [response, setRes] = useState<any>(null)
  const [unique, setUnique] = useState<any>(null)
  const [uniqueInfo, setUniqueInfo] = useState<any>(null)
  const [sequence, setSequence] = useState<any>(null)
  

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
      if (!res.ok) throw new Error("Server error")
      const data = await res.json()
      setRes(JSON.stringify(data, null, 2))
      setUploading(false)
    } catch(error){
      console.error(error)
      setUploading(true)
    }
    // } finally {
    //   setUploading(false)
    // }
  }

  const uploadHandler = (event: any) => {
    setSelected(event.target.files[0])
    setUpload(false)
  }

  const handleAnalyze = async () => {
    setStep("analyze")
    setAnalyze(true)
    if (!selected) return
    setAnalyzing(true)
    try{
      const formData = new FormData()
      formData.append('file', selected)
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData
      })
      const result = await res.json()
      if (!res.ok) throw new Error("Server error")
      setRes(JSON.stringify(result, null, 2))

      console.log(result.chord_sequence)

      // object or dict 
      setSequence(result.chord_sequence)
      console.log(result.unique_chords)
      // array
      setUnique(result.unique_chords)
      setAnalyzing(false)

    }catch(error){
      console.error(error)
      setAnalyzing(true)
    } 
    // } finally {
    //   setAnalyzing(false)
    // }
  }



  useEffect(() => {
    if (unique && unique.length > 0){
      fetchUniqueChords()
    }
  }, [unique])

  const fetchUniqueChords = async () => {
    if (!unique) return
    try {
      const url_list = []
      for (const uc of unique){
        // proxy?
        const res = await fetch(`${API_URL}/load_unique_chord?chord=${uc}`)
        if (!res.ok) throw new Error("External API error")
        const result = await res.json()
        console.log("url: ", result.img_url)
        url_list.push(result)
        }
        setUniqueInfo(url_list)

    } catch(error){
      console.error(error)
    }
  }

  
  const handleRecord = () => {
    setStep("record")
    setRecord(true)
  }

  return (
    <div>

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
            disabled = {!upload || uploading}
            className={`rounded-full px-5 py-3 font-medium ${
              upload && !uploading
                ? "bg-gray-200 hover:bg-gray-300 text-black"
                : "bg-gray-400 cursor-not-allowed text-gray-200"
            }`}
          >
            Analyze Song
          </button>

          <button
            onClick={handleRecord}
            disabled = {!analyze || analyzing}
            className={`rounded-full px-5 py-3 font-medium ${
              analyze && !analyzing
                ? "bg-gray-200 hover:bg-gray-300 text-black"
                : "bg-gray-400 cursor-not-allowed text-gray-200"
            }`}          >
            Record Yourself
          </button>
        </div>
      </main>
     
      <div className="w-full max-w-2xl p-6 rounded-xl shadow-md text-center transition-all duration-300">
        
        {step == 'upload' && (
          <p >{response}</p>
        )}
        
        {step == 'record' && (
          <p >Recorded!</p>
        )}
      </div>

      {/* spacer */}
      {step === 'analyze' && uniqueInfo && (
        <div className="h-130 w-full"></div>
      )}

      {step === 'analyze' && uniqueInfo && (
        <div className="fixed bottom-0 left-0 right-0 bg-white-900/95 backdrop-blur-sm border-t border-white-700 p-4 z-50">
          <h3 className="text-center mb-4 font-mono text-lg text-gray-200">Chords You Have to Know</h3>
          <div className="flex flex-wrap justify-center gap-4 max-h-64 overflow-y-auto px-4 pb-4">
            {uniqueInfo.map((chord: any, i: number) => (
              <div key={i} className="flex flex-col items-center bg-blue-800/70 rounded-lg p-3 hover:bg-gray-800 transition-colors">
                <img 
                  src={chord.img_url} 
                  alt={chord.chord}
                  className="max-w-[120px] max-h-[120px] object-contain mb-2"
                />
                <p className="font-mono text-sm text-gray-300 font-medium">{chord.chord}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    
    
    </div>
    </div>
    
  );
}
