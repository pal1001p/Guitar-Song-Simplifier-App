from madmom.audio.chroma import DeepChromaProcessor
from madmom.features.chords import DeepChromaChordRecognitionProcessor
import argparse
import librosa

def get_beats(file):
    # using librosa instead of madmom b/c too slow and tooooo detailed
    audio, sampling_rate = librosa.load(file)
    tempo, beat_frames = librosa.beat.beat_track(y=audio, sr=sampling_rate)
    print(f'Estimated tempo: {tempo} beats per minute')
    beat_times_librosa = librosa.frames_to_time(beat_frames, sr=sampling_rate)
    for beat in beat_times_librosa:
        print(f'LIBROSA beat time: {beat:.2f}s')

    beat_times_dict = {index: beat for index, beat in enumerate(beat_times_librosa)}

    return beat_times_dict

def get_chords(file):
    min_length = 1
    dcp = DeepChromaProcessor()
    decode = DeepChromaChordRecognitionProcessor()
    chroma = dcp(file)
    chords = decode(chroma)

    smoothed_chords = {}
    for start, end, chord in chords:
            if end - start >= min_length and chord != 'N' and chord is not None:
                smoothed_chords[start] = chord


    for index, (start, chord) in enumerate(smoothed_chords.items()):
        print(f"MADMOM:      Chord {index + 1} of {len(smoothed_chords)}: {chord}   Start: {start:.2f}s")
    

    unique_madmom = []
    for (start,chord) in smoothed_chords.items():
        if chord not in unique_madmom:
            unique_madmom.append(chord)
        else:
            continue

    for index,chord in enumerate(unique_madmom):
        print(f'UNIQUE CHORD IN MADMOM:       Chord {index + 1} of {len(unique_madmom)}: {chord}')

    return unique_madmom, smoothed_chords


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs = "?", default="/Users/Polina/Downloads/converts/og.wav")
    parser.add_argument('--category', type=str, nargs = "?", default='MirexMajMin')
    args = parser.parse_args()
    file = str(args.file)
    # use simpler version (majors, minor and sharps) for now until I decide whether to train model on new chords
    # or figure out how to stream and recognize audio with chordino
    unique_chords, chord_sequence = get_chords(file)
    beat_times = get_beats(file)
    return unique_chords, chord_sequence, beat_times


if __name__ == '__main__':
    main()