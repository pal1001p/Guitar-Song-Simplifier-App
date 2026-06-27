export type Step = "upload" | "analyze" | "record" | null;

// from /ws/record 
export type ChordFeedback = {
  status: string;
  message: string;
  timestamp: number;
};

// from /load_unique_chord_url
export type ChordToURL = {
  chord: string,
  img_url: string
}

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