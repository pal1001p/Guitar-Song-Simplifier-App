import {
    UploadResult, AnalyzeResult, ChordUrlResult
} from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// helpers
async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }
  
function fileFormData(file: File): FormData {
    const formData = new FormData();
    formData.append("file", file);
    return formData;
  }

//  API "menu"
export async function uploadFile(file: File): Promise<UploadResult> {
    const res = await fetch(`${API_URL}/upload_file`, {
      method: "POST",
      body: fileFormData(file),
    });
    return handleResponse<UploadResult>(res);
  }

export async function analyzeFile(file: File): Promise<AnalyzeResult> {
    const res = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      body: fileFormData(file),
    });
    return handleResponse<AnalyzeResult>(res);
  }

export async function fetchChordUrl(chord: string): Promise<ChordUrlResult> {
    const res = await fetch(
      `${API_URL}/load_unique_chord_url?chord=${encodeURIComponent(chord)}`,
    );
    return handleResponse<ChordUrlResult>(res);
  }

export async function fetchChordImageBytes(url: string): Promise<Blob> {
    const res = await fetch(
      `${API_URL}/load_chord_image_bytes?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) {
      throw new Error(`Image fetch failed: ${res.status}`);
    }
    return res.blob(); // not JSON — returns raw image bytes
  }

export function getWebSocketRecordUrl(): string {
    let wsUrl = API_URL || "http://localhost:8000";
    if (wsUrl.startsWith("http://")) wsUrl = wsUrl.replace("http://", "ws://");
    else if (wsUrl.startsWith("https://")) wsUrl = wsUrl.replace("https://", "wss://");
    else if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
      wsUrl = `ws://${wsUrl}`;
    }
    return `${wsUrl.replace(/\/$/, "")}/ws/record`;
  }
  
export async function checkHealth(): Promise<boolean> {
    const res = await fetch(`${API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  }