"use client"
import { formatAudioTime } from "@/lib/formatAudioTime"

type CustomSoundBarProps={
audioRef: React.RefObject<HTMLAudioElement | null>;
audioURL: string;
isPlaybackMuted: boolean;
playbackVolume:number;
onSetPlaybackMuted: ()=> void;
onSetPlaybackVolume: (volume:number)=>void;
timelineProgress: number ;
currentAudioTime: number;
audioDuration: number ;
}

export function CustomSoundBar({
    audioRef,
    audioURL,
    isPlaybackMuted,
    playbackVolume,
    onSetPlaybackMuted,
    onSetPlaybackVolume,
    timelineProgress,
    currentAudioTime,
    audioDuration,
}: CustomSoundBarProps){
    return(

      <div className="mb-6 flex flex-col items-center gap-2">
        <audio
          key="native"
          ref={audioRef}
          src={audioURL}
          muted={isPlaybackMuted}
          className="hidden"
        />
        <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onSetPlaybackMuted}
              className="rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-800 transition-colors"
            >
              {isPlaybackMuted ? "Unmute" : "Mute"}
            </button>
            <div className="flex flex-1 items-center gap-2">
              <span className="text-xs text-gray-400">Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={playbackVolume}
                onChange={(e) =>
                  onSetPlaybackVolume(Number(e.target.value))
                }
                className="w-full accent-blue-400"
                aria-label="Recording playback volume"
              />
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{ width: `${timelineProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatAudioTime(currentAudioTime)}</span>
              <span>{formatAudioTime(audioDuration)}</span>
            </div>
          </div>
        </div>
      </div>
    )
}