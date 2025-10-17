import sys
from time import sleep
import warnings
import torch
import time
import pyaudio
import librosa
import numpy as np
import bisect
from collections import Counter
from complex_realtime_chords.models import LSTMClassifier
from complex_realtime_chords.preprocess.chords import ind_to_chord_names
from complex_realtime_chords.utils.parser import get_realtime_parser
from complex_realtime_chords.utils.utils import get_params_by_category

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')
global chords
chords = []
# demo uses best pretrained models for each category
def get_weights_path_by_category(category):
    if category == 'MirexRoot':
        return 'complex_realtime_chords/data/predicted/MirexRoot/mod/LSTM_bi_True_MirexRoot_librosa_acc_83.47220891996297_lr_1.0_wd_1e-07_nl_3_hd_128_ne_100_sss_10_sg_0.9_opt_SGD'
    elif category == 'MirexMajMin':
        return 'complex_realtime_chords/data/predicted/MirexMajMin/mod/LSTM_bi_True_MirexMajMin_librosa_acc_82.67730773742034_lr_1.0_wd_1e-07_nl_3_hd_128_ne_100_sss_10_sg_0.9_opt_SGD'
    elif category == 'MirexMajMinBass':
        return 'complex_realtime_chords/data/predicted/MirexMajMinBass/mod/LSTM_bi_True_MirexMajMinBass_librosa_acc_81.30449231731635_lr_1.0_wd_1e-07_nl_3_hd_128_ne_100_sss_10_sg_0.9_opt_SGD'
    elif category == 'MirexSevenths':
        return 'complex_realtime_chords/data/predicted/MirexSevenths/mod/LSTM_bi_True_MirexSevenths_librosa_acc_75.69202799390077_lr_1.0_wd_1e-07_nl_3_hd_128_ne_100_sss_10_sg_0.9_opt_SGD'
    elif category == 'MirexSeventhsBass':
        return 'complex_realtime_chords/data/predicted/MirexSeventhsBass/mod/LSTM_bi_True_MirexSeventhsBass_librosa_acc_74.5640614614693_lr_1.0_wd_1e-07_nl_3_hd_128_ne_100_sss_10_sg_0.9_opt_SGD'


def process_audio_chunk(audio_data, sr=44100, target_sr=11025):
    """Process audio chunk for chord recognition"""
    # Convert to float32 and normalize
    audio_float = audio_data.astype(np.float32) / 32768.0
    
    # Resample to target sample rate
    audio_resampled = librosa.resample(audio_float, orig_sr=sr, target_sr=target_sr)
    
    # Estimate tuning
    tuning = librosa.estimate_tuning(y=audio_resampled, sr=target_sr)
    
    # Compute CQT features
    # Updated librosa API: use librosa.cqt instead of librosa.core.cqt
    X = np.abs(librosa.cqt(
        y=audio_resampled, 
        sr=target_sr, 
        n_bins=84, 
        bins_per_octave=12, 
        tuning=tuning,
        window='hamming', 
        norm=2
    )).T
    
    return X

def find_closest_match(timestamp):
    list_times = list(chord_sequence.keys())
    # binary search
    # returns index of where it would fit in (sorted) list
    index = bisect.bisect_left(list_times, timestamp)
    if index == 0:
        return list_times[0], chord_sequence[list_times[0]]
    if index == len(list_times):
        return list_times[-1], chord_sequence[list_times[-1]]
    before = list_times[index - 1]

    after = list_times[index]
    # if difference on left side is less, beat was closer to the value at later index
    if after - before < before - timestamp:
        return after, chord_sequence[after]
    else:
        return before, chord_sequence[before]

def callback(in_data, frame_count, time_info, flag):
    """Audio callback function for real-time processing"""
    audio_data = np.frombuffer(in_data, dtype=np.int16)
    try:
        # Process audio chunk
        X = process_audio_chunk(audio_data)
        with torch.no_grad():
            global prev_chord
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            X_tensor = torch.tensor(X, dtype=torch.float64).to(device)
            X_tensor = X_tensor.unsqueeze(0)
            # Get prediction
            pred = model(X_tensor)
            y = pred.topk(1, dim=2)[1].squeeze().view(-1)
            # Get most common chord
            counter = Counter(ind_to_chord_names(y.cpu().numpy(), category))
            current_chord = counter.most_common(1)[0][0]
            end = time.time()
            timestamp = end - start
            if prev_chord != current_chord and current_chord != "N":
                print(f"Detected chord: {current_chord} at time: {timestamp:2f}")
                prev_chord = current_chord
                chords.append((current_chord, timestamp))
                closest_timestamp, chord_at_timestamp = find_closest_match(timestamp)
                if np.abs(closest_timestamp - timestamp) <= 1:
                    # case if good time, bad chord
                    if chord_at_timestamp != current_chord:
                        print(f"BAD! You played chord {current_chord} at {timestamp} instead of {chord_at_timestamp}")
                    # case if good time, good chord
                    else:
                        print(f"GOOD!")
                else:
                    # case if bad time, good chord (too early)
                    if (closest_timestamp - timestamp) > 1 and (chord_at_timestamp == current_chord):
                        print(f"BAD! You played at {timestamp}, too early!")
                    # case if bad time, good chord (too late)
                    elif(timestamp - closest_timestamp) > 1 and (chord_at_timestamp == current_chord):
                        print(f"BAD! You played at {timestamp}, too late!")
                    # case if bad time, bad chord (too late)
                    elif (timestamp - closest_timestamp) > 1 and (chord_at_timestamp != current_chord):
                        print(f"BAD! You played the wrong chord {current_chord} instead of {chord_at_timestamp} at {timestamp}, too late!")
                    # case if bad time, bad chord (too early)
                    else: # (closest_timestamp - timestamp) > 0.5 and (chord_at_timestamp != current_chord):
                        print(f"BAD! You played the wrong chord {current_chord} instead of {chord_at_timestamp} at {timestamp}, too early!")
            
                
    except Exception as e:
        print(f"Error processing audio: {e}")
    
    return in_data, pyaudio.paContinue


def predict_stream():
    """Start real-time audio stream for chord prediction"""
    audio = pyaudio.PyAudio()
    
    try:
        stream = audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=44100,
            input=True,
            frames_per_buffer=32768,
            stream_callback=callback
        )

        print("Starting real-time chord recognition...")
        print("Press Ctrl+C to stop")
        stream.start_stream()
        global start
        start = time.time()
        print(f"Starting real-time chord recognition at {start}...")
        print("Press Ctrl+C to stop")
        while stream.is_active():
            sleep(0.25)
            
    except KeyboardInterrupt:
        print("\nStopping chord recognition...")
        print(chords)
    except Exception as e:
        print(f"Error in audio stream: {e}")
    finally:
        if 'stream' in locals():
            stream.close()
        audio.terminate()


def main(extracted_unique_chords, extracted_chord_sequence):
    global prev_chord, model, category, unique_chords, chord_sequence
    unique_chords = extracted_unique_chords
    chord_sequence = extracted_chord_sequence
    parser = get_realtime_parser()
    args = parser.parse_args(sys.argv[1:])
    category = args.category
    
    print(f"Loading model for category: {category}")
    
    weights_path = get_weights_path_by_category(args.category)
    params, y_size, y_ind = get_params_by_category(args.category)
    prev_chord = ''
    
    # Initialize model with same architecture as training
    model = LSTMClassifier(
        input_size=84, 
        hidden_dim=128, 
        output_size=y_size,
        num_layers=3,
        use_gpu=torch.cuda.is_available(), 
        bidirectional=True, 
        dropout=[0.4, 0.0, 0.0]
    )
    
    # Load model weights
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)
    
    try:
        if device.type == 'cuda':
            model.load_state_dict(torch.load(weights_path))
        else:
            model.load_state_dict(torch.load(weights_path, map_location='cpu'))
        model.eval()
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {e}")
        print("Make sure the model weights file exists at the specified path.")
        sys.exit(1)
    
    predict_stream()


if __name__ == '__main__':
    main()
