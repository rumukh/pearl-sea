"""Turn an ACE-Step render into a seamless, bar-aligned game loop (CPU only).

1. Fit a strict beat grid (period and phase) to the onset envelope near the requested BPM.
2. Pick the downbeat phase from low-frequency onsets.
3. Search bar-aligned loops of the requested lengths inside the steady middle of the
   track: the bar before the loop end must sound like the bar before the loop start, and
   the bar after the end like the bar after the start (chroma + MFCC + loudness).
4. Build the loop with an equal-power crossfade of the tail into the audio that precedes
   the start, so the end flows into the first sample.
5. Normalise to a BS.1770 integrated loudness target with a -1 dBTP ceiling (4x oversampled
   peak check), write a 24-bit FLAC master, an Ogg Vorbis file without metadata, and a
   3x tiled audition file. The Ogg is decoded again to verify length and seam continuity.

Usage: python loop.py in.flac out_dir --bpm 96 --bars 16 24 --lufs -23 [--sting]
"""

import argparse
import hashlib
import json
import os
import subprocess

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import resample_poly


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fit_grid(onset, fps, bpm, y_mono=None, sr=None, hop=256):
    """Beat period and phase (in onset frames).

    librosa's beat tracker gives beat frames; a robust linear fit (outliers beyond 35 ms
    dropped, refit) over the steady middle yields the period. The phase is then refined on
    the onset envelope with the period fixed.
    """
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, start_bpm=bpm, tightness=200)
    bt = beats.astype(float)
    n = len(onset)
    keep = (bt > 8 * fps) & (bt < n - 6 * fps)
    t = bt[keep]
    idx = np.arange(len(t), dtype=float)
    inliers = np.ones(len(t), dtype=bool)
    for _ in range(6):
        p = np.polyfit(idx[inliers], t[inliers], 1)
        resid = np.abs(t - np.polyval(p, idx))
        new = resid < 0.035 * fps
        if new.sum() < 8 or (new == inliers).all():
            break
        inliers = new
    period = p[0]
    # refine period within +-0.3 percent and phase on the onset envelope
    best = None
    for per in np.linspace(period * 0.997, period * 1.003, 61):
        for phase in np.linspace(0, per, 96, endpoint=False):
            grid = np.arange(phase, n - 1, per)
            score = np.interp(grid, np.arange(n), onset).mean()
            if best is None or score > best[0]:
                best = (score, per, phase)
    _, per, phase = best
    fitted_bpm = 60.0 * fps / per
    return fitted_bpm, phase, {"trackerBpm": round(60.0 * fps / period, 3), "inlierShare": round(float(inliers.mean()), 3),
                                "residualMsP95": round(float(np.percentile(resid[inliers], 95) / fps * 1000), 1)}


def seam_lag_ms(mono, sr, s, e, bar, hop=128):
    """Lag of the material after the loop end relative to the loop start (0 = loop length is right)."""
    a = mono[s:s + int(2 * bar)]
    b = mono[e:e + int(2 * bar)]
    if len(b) < len(a):
        return None
    ea = librosa.onset.onset_strength(y=a, sr=sr, hop_length=hop)
    eb = librosa.onset.onset_strength(y=b, sr=sr, hop_length=hop)
    ea, eb = ea - ea.mean(), eb - eb.mean()
    max_lag = int(0.2 * sr / hop)
    lags = range(-max_lag, max_lag + 1)
    scores = [np.dot(ea[max(0, -l):len(ea) - max(0, l)], eb[max(0, l):len(eb) - max(0, -l)]) for l in lags]
    return round(float(list(lags)[int(np.argmax(scores))] * hop / sr * 1000), 1)


def true_peak_db(y, sr):
    up = resample_poly(y, 4, 1, axis=0)
    return 20 * np.log10(max(np.abs(up).max(), 1e-9))


def normalise(y, sr, lufs, ceiling=-1.0, tile=True):
    meter = pyln.Meter(sr)
    probe = np.concatenate([y, y]) if tile else y
    loud = meter.integrated_loudness(probe)
    gain = lufs - loud
    out = y * (10 ** (gain / 20))
    tp = true_peak_db(np.concatenate([out, out[: sr // 10]]) if tile else out, sr)
    limited = False
    if tp > ceiling:
        # gentle static gain reduction keeps the loop seam intact; report it
        out = out * (10 ** ((ceiling - tp) / 20))
        limited = True
    return out, {"inputLufs": round(loud, 2), "gainDb": round(gain, 2), "truePeakDbtp": round(true_peak_db(out, sr), 2),
                 "outputLufs": round(meter.integrated_loudness(np.concatenate([out, out]) if tile else out), 2),
                 "peakReduced": limited}


def features(y_mono, sr, hop):
    chroma = librosa.feature.chroma_stft(y=y_mono, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=y_mono, sr=sr, n_mfcc=13, hop_length=hop)
    rms = librosa.feature.rms(y=y_mono, hop_length=hop)
    mfcc = (mfcc - mfcc.mean(axis=1, keepdims=True)) / (mfcc.std(axis=1, keepdims=True) + 1e-6)
    return np.vstack([chroma * 2.0, mfcc * 0.5, np.log10(rms + 1e-6) * 2.0])


def window_dist(F, fps, a_samples, b_samples, length_samples, sr):
    fa = int(round(a_samples / sr * fps))
    fb = int(round(b_samples / sr * fps))
    n = int(round(length_samples / sr * fps))
    if fa < 0 or fb < 0 or fa + n > F.shape[1] or fb + n > F.shape[1]:
        return np.inf
    A, B = F[:, fa:fa + n], F[:, fb:fb + n]
    return float(np.mean(np.linalg.norm(A - B, axis=0)))


def encode_ogg(src_wav, dst_ogg, quality):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src_wav, "-map_metadata", "-1",
                    "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libvorbis", "-q:a", str(quality), dst_ogg],
                   check=True)


def decode(path, sr):
    tmp = path + ".decoded.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-ar", str(sr), "-c:a", "pcm_f32le", tmp], check=True)
    y, _ = sf.read(tmp, always_2d=True)
    os.remove(tmp)
    return y


def seam_ratio(y):
    """Jump across the wrap point relative to the typical sample-to-sample step."""
    steps = np.abs(np.diff(y, axis=0)).mean(axis=1)
    wrap = np.abs(y[0] - y[-1]).mean()
    return float(wrap / (np.percentile(steps, 99) + 1e-9))


def make_loop(args):
    y, sr = sf.read(args.input, always_2d=True)
    mono = y.mean(axis=1)
    hop = 256
    fps = sr / hop
    onset = librosa.onset.onset_strength(y=mono, sr=sr, hop_length=hop)
    bpm, phase, tempo_info = fit_grid(onset, fps, args.bpm, mono, sr, hop)
    beat = sr * 60.0 / bpm
    beats = np.arange(phase * hop, len(mono) - 1, beat)
    low = librosa.onset.onset_strength(y=mono, sr=sr, hop_length=hop, fmax=200, n_mels=32)
    scores = []
    for k in range(args.beats_per_bar):
        idx = beats[k::args.beats_per_bar] / hop
        scores.append(np.interp(idx, np.arange(len(low)), low).mean())
    down = int(np.argmax(scores))
    bars = beats[down::args.beats_per_bar]
    bar = beat * args.beats_per_bar

    F = features(mono, sr, hop)
    rms_bar = np.array([np.sqrt(np.mean(mono[int(b):int(b + bar)] ** 2)) if b + bar < len(mono) else 0 for b in bars])
    steady = np.median(rms_bar[len(rms_bar) // 4: 3 * len(rms_bar) // 4])
    first = max(args.skip_intro_bars, 1)
    last = len(bars) - args.skip_outro_bars
    candidates = []
    for n in args.bars:
        for i in range(first, last - n):
            s, e = bars[i], bars[i + n]
            if e + bar >= len(mono):
                continue
            if rms_bar[i:i + n].min() < 0.5 * steady:
                continue
            d = window_dist(F, fps, s - bar, e - bar, bar, sr) + window_dist(F, fps, s, e, bar, sr)
            candidates.append((d, n, i))
    if not candidates:
        raise SystemExit("No steady loop region found; render a longer or steadier take.")
    candidates.sort()
    d, n, i = candidates[0]
    s, e = int(round(bars[i])), int(round(bars[i + n]))
    # whole frames at 22.05, 44.1 and 48 kHz: at 48 kHz the length must be a multiple of 320 samples
    grain = 320 if sr == 48000 else 1
    e_raw = e
    e = s + int(round((e - s) / grain)) * grain
    C = int(round(beat * args.xfade_beats))
    loop = y[s:e].copy()
    t = np.linspace(0, np.pi / 2, C)[:, None]
    loop[-C:] = y[e - C:e] * np.cos(t) + y[s - C:s] * np.sin(t)
    loop, loud = normalise(loop, sr, args.lufs)

    os.makedirs(args.out, exist_ok=True)
    stem = os.path.splitext(os.path.basename(args.input))[0]
    master = os.path.join(args.out, f"{stem}.loop.flac")
    sf.write(master, loop, sr, subtype="PCM_24")
    wav = os.path.join(args.out, f"{stem}.loop.wav")
    sf.write(wav, loop, sr, subtype="FLOAT")
    ogg = os.path.join(args.out, f"{stem}.loop.ogg")
    encode_ogg(wav, ogg, args.quality)
    os.remove(wav)
    audition = os.path.join(args.out, f"{stem}.loop-x3.ogg")
    tmpw = audition + ".wav"
    sf.write(tmpw, np.concatenate([loop, loop, loop]), sr, subtype="FLOAT")
    encode_ogg(tmpw, audition, args.quality)
    os.remove(tmpw)
    dec = decode(ogg, sr)
    report = {
        "input": args.input, "inputSha256": sha256(args.input), "sampleRate": sr,
        "requestedBpm": args.bpm, "fittedBpm": round(bpm, 3), "tempoFit": tempo_info, "beatsPerBar": args.beats_per_bar,
        "loopBars": n, "startBar": i, "startSample": s, "endSample": e,
        "loopSeconds": round((e - s) / sr, 4), "loopSamples": e - s, "lengthAdjustSamples": e - e_raw,
        "framesAt": {str(r): (e - s) * r / sr for r in (22050, 44100, 48000)}, "matchDistance": round(d, 4),
        "seamLagMs": seam_lag_ms(mono, sr, s, e, bar),
        "crossfadeBeats": args.xfade_beats, "loudness": loud,
        "master": master, "masterSha256": sha256(master),
        "ogg": ogg, "oggSha256": sha256(ogg), "oggBytes": os.path.getsize(ogg),
        "oggDecodedSamples": int(len(dec)), "oggSeamRatio": round(seam_ratio(dec), 3), "masterSeamRatio": round(seam_ratio(loop), 3),
        "audition": audition, "alternatives": [{"distance": round(c[0], 4), "bars": c[1], "startBar": c[2]} for c in candidates[1:6]],
    }
    with open(os.path.join(args.out, f"{stem}.loop.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    return report


def make_sting(args):
    y, sr = sf.read(args.input, always_2d=True)
    env = np.sqrt(np.convolve((y ** 2).mean(axis=1), np.ones(480) / 480, mode="same"))
    db = 20 * np.log10(env + 1e-9)
    loud = np.nonzero(db > db.max() - 40)[0]
    start = max(int(loud[0]) - int(0.01 * sr), 0)
    tail = np.nonzero(db > db.max() - 45)[0][-1]
    end = min(int(tail) + int(0.3 * sr), len(y))
    out = y[start:end].copy()
    fade = min(int(0.25 * sr), len(out) // 4)
    out[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade))[:, None]
    out[: int(0.005 * sr)] *= np.linspace(0, 1, int(0.005 * sr))[:, None]
    out, loudness = normalise(out, sr, args.lufs, tile=False)
    os.makedirs(args.out, exist_ok=True)
    stem = os.path.splitext(os.path.basename(args.input))[0]
    master = os.path.join(args.out, f"{stem}.sting.flac")
    sf.write(master, out, sr, subtype="PCM_24")
    wav = master + ".wav"
    sf.write(wav, out, sr, subtype="FLOAT")
    ogg = os.path.join(args.out, f"{stem}.sting.ogg")
    encode_ogg(wav, ogg, args.quality)
    os.remove(wav)
    report = {"input": args.input, "inputSha256": sha256(args.input), "startSample": start, "endSample": end,
              "seconds": round((end - start) / sr, 3), "loudness": loudness, "master": master, "masterSha256": sha256(master),
              "ogg": ogg, "oggSha256": sha256(ogg), "oggBytes": os.path.getsize(ogg)}
    with open(os.path.join(args.out, f"{stem}.sting.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("out")
    ap.add_argument("--bpm", type=float, default=120)
    ap.add_argument("--beats-per-bar", type=int, default=4)
    ap.add_argument("--bars", type=int, nargs="+", default=[16])
    ap.add_argument("--skip-intro-bars", type=int, default=4)
    ap.add_argument("--skip-outro-bars", type=int, default=4)
    ap.add_argument("--xfade-beats", type=float, default=0.5)
    ap.add_argument("--lufs", type=float, default=-23.0)
    ap.add_argument("--quality", type=int, default=5)
    ap.add_argument("--sting", action="store_true")
    a = ap.parse_args()
    r = make_sting(a) if a.sting else make_loop(a)
    print(json.dumps({k: v for k, v in r.items() if k not in ("alternatives",)}, indent=1))
