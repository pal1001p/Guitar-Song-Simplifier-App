export type Step = "upload" | "analyze" | "record" | null;

// from useRecording.ts
// implemented as array of time:chord tuples
export type TimesToChords = [
  time: number,
  chord: string
]

// from page.tsx
// implemented as multiple instances in one object (like a dict) for quick lookup
export type CachedImages = {
  [url: string]: string
}

// from /ws/record 
export type ChordFeedback = {
  status: string;
  message: string;
  timestamp: number;
};


// API types (../libs/api.ts matches ../api/route.ts)
// from /upload_file
export type UploadResult = {
    filename: string;
    content_type: string;
    size_bytes: number;
  };
 // from /analyze
export type AnalyzeResult = {
    unique_chords: string[];
    chord_sequence: Record<string, string>;
  };
// from /load_unique_chord_url
export type ChordUrlResult = {
    chord: string;
    img_url: string;
  };