from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor
from madmom.models import BEATS_LSTM
from madmom.processors import IOProcessor, process_online
from complex_realtime_chords.realtime import main as chords_complex_main
from loaded_song_combo import main as song_main
import multiprocessing
import time
import numpy as np
from bisect import bisect_left

def find_closest_beat(beat, extracted_beats):
    new_list = list(extracted_beats.values())
    # binary search
    # returns index of where it would fit in (sorted) list
    index = bisect_left(new_list, beat)
    if index == 0:
        return new_list[0]
    if index == len(new_list):
        return new_list[-1]
    before = new_list[index - 1]
    after = new_list[index]
    # if difference on left side is less, beat was closer to the value at later index
    if after - beat < before - beat:
        return after
    else:
        return before


def get_beats(extracted_beats):
    kwargs = dict(
        fps = 100,
        correct = True,
        infile = None,
        outfile = None,
        max_bpm = 130,
        min_bpm = 50,
        nn_files =  [BEATS_LSTM[0]],
        num_frames = 1,
        online = True,
        list_stream_input_device = False,
        device = 1
    )
    
    beat_times = []
    def beat_callback(beats, output=None):
        if beats.size > 0:
            print(f"Beat at: {beats}s")
            beat_times.append(beats)
            beat = np.float64(beats)
            first_beat = list(extracted_beats.values())[0]
            last_beat = list(extracted_beats.values())[-1]
            # first and last beats
            if beat <= first_beat:
                print(f"BAD! TOO EARLY! First beat is at {extracted_beats[0]:2f}")
            if beat >= last_beat:
                print(f"BAD! TOO LATE! Last beat is at {extracted_beats[-1]:2f}")
            # exact match
            if(beat >= first_beat and beat <= last_beat):
                if beat in extracted_beats:
                    print("VERY GOOD!", beat)
                else:
                    closest_beat = find_closest_beat(beat, extracted_beats)
                    print(f"Closest beat to {beat} is {closest_beat:2f}")
                    # close enough
                    if np.abs(closest_beat - beat) <= 0.25:
                        print(f"GOOD! w/ beat: {beat} and extracted closest beat: {closest_beat:2f}")
                    # not close enough
                    else:
                        # your beat was too early
                        if(closest_beat - beat > 0.25):
                            print(f"BAD! Beat {beat} was too early for {closest_beat:2f}")
                        # your beat was too late
                        if(beat - closest_beat > 0.25):
                            print(f"BAD! Beat {beat} was too late for {closest_beat:2f}")

    in_processor = RNNBeatProcessor(**kwargs)
    beat_processor = DBNBeatTrackingProcessor(**kwargs)
    out_processor = [beat_processor, beat_callback]
    processor = IOProcessor(in_processor, out_processor)
    beat_start = time.time()
    print(f"Starting real-time beat recognition at {beat_start}...")

    process_online(processor, **kwargs)

def get_chords_complex(extracted_unique_chords, extracted_chord_sequence):
    chords_complex_main(extracted_unique_chords, extracted_chord_sequence)

def main():
    # realtime_combo will use default MirexMajMin
    # both scripts take in command for file to process pre-real-time and model to process post-real-time
    # for UI, call song_main with argument to loaded song?
    # make sure to deconstuct song separately from call to real-time processing to have it loaded in already
    extracted_unique_chords, extracted_chord_sequence, extracted_beats = song_main()
    beat_process = multiprocessing.Process(target = get_beats, args = (extracted_beats,))

    beat_process.start()

    time.sleep(1.55)
    # easy_realtime_chords is buggy. could train models from complex_realtime_chords in future for more chords
    # perhaps use multiprocessing for running multiple models in parallel for full chord coverage?
    get_chords_complex(extracted_unique_chords, extracted_chord_sequence) 
    # realtime_combo.py '/Users/...'
    
    beat_process.join()


if __name__ == "__main__":
    main()

