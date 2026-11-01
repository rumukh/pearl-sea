"""Mono downmix of approved loops and stings, with a phase-cancellation report (CPU only).

For each stereo master: L/R correlation overall and per octave band, and the energy of the mono
sum (L+R)/2 against the mean channel energy per band (0 dB = fully correlated, -3 dB =
uncorrelated, much lower = anti-phase content that mono would lose). The mono file is
re-normalised to the same BS.1770 tier, measured on the single channel as Dragon Valley did, with a
-1 dBTP ceiling, and written as a 24-bit FLAC master and an Ogg Vorbis file without metadata.
The Ogg is decoded again to verify its length (loops stay whole-frame at 22.05/44.1/48 kHz).

Usage: python mono.py <stereo master> <out dir> --lufs -23 [--loop]
"""

import argparse
import hashlib
import json
import os
import subprocess

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfiltfilt

BANDS = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def band(x, sr, fc):
    lo, hi = fc / np.sqrt(2), min(fc * np.sqrt(2), sr / 2 * 0.98)
    sos = butter(4, [lo, hi], btype="bandpass", fs=sr, output="sos")
    return sosfiltfilt(sos, x)


def report(y, sr):
    L, R = y[:, 0], y[:, 1]
    out = {"correlation": round(float(np.corrcoef(L, R)[0, 1]), 3), "bands": []}
    for fc in BANDS:
        if fc * np.sqrt(2) >= sr / 2:
            continue
        l, r = band(L, sr, fc), band(R, sr, fc)
        el, er = np.mean(l ** 2), np.mean(r ** 2)
        em = np.mean(((l + r) / 2) ** 2)
        corr = float(np.corrcoef(l, r)[0, 1]) if el > 1e-12 and er > 1e-12 else 1.0
        ratio_db = 10 * np.log10(max(em, 1e-15) / max((el + er) / 2, 1e-15))
        level_db = 10 * np.log10(max((el + er) / 2, 1e-15))
        out["bands"].append({"hz": fc, "correlation": round(corr, 3), "monoVsStereoDb": round(float(ratio_db), 2),
                             "bandLevelDbfs": round(float(level_db), 1)})
    # bands that carry real energy (within 30 dB of the loudest band) and lose more than 4.5 dB
    loudest = max(b["bandLevelDbfs"] for b in out["bands"])
    out["flagged"] = [b["hz"] for b in out["bands"] if b["bandLevelDbfs"] > loudest - 30 and b["monoVsStereoDb"] < -4.5]
    return out


def true_peak_db(y):
    return 20 * np.log10(max(np.abs(resample_poly(y, 4, 1)).max(), 1e-9))


def match_spectrum(y, mono, sr, max_boost_db=8.0):
    """Zero-phase EQ, applied circularly over the whole loop (exact for a periodic signal), that
    restores the mono sum's long-term 1/3-octave balance to the stereo channels' mean."""
    n = len(mono)
    f = np.fft.rfftfreq(n, 1 / sr)
    pm = np.abs(np.fft.rfft(mono)) ** 2
    ps = (np.abs(np.fft.rfft(y[:, 0])) ** 2 + np.abs(np.fft.rfft(y[:, 1])) ** 2) / 2
    centres = 31.25 * 2 ** (np.arange(0, 30) / 3)
    centres = centres[centres < sr / 2 * 0.95]
    gains = []
    for fc in centres:
        sel = (f >= fc / 2 ** (1 / 6)) & (f < fc * 2 ** (1 / 6))
        g = 10 * np.log10(max(ps[sel].sum(), 1e-20) / max(pm[sel].sum(), 1e-20)) if sel.any() else 0.0
        gains.append(g)
    gains = np.array(gains)
    gains = gains - np.median(gains)            # only the balance matters; loudness is set afterwards
    gains = np.clip(gains, -max_boost_db, max_boost_db)
    gains = np.convolve(np.pad(gains, 1, mode="edge"), np.ones(3) / 3, mode="valid")
    curve = np.interp(np.log2(np.maximum(f, 1.0)), np.log2(centres), gains, left=gains[0], right=gains[-1])
    out = np.fft.irfft(np.fft.rfft(mono) * 10 ** (curve / 20), n)
    return out, [{"hz": round(float(c), 1), "db": round(float(g), 2)} for c, g in zip(centres, gains)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("master")
    ap.add_argument("out")
    ap.add_argument("--lufs", type=float, required=True)
    ap.add_argument("--loop", action="store_true")
    ap.add_argument("--quality", type=int, default=5)
    a = ap.parse_args()
    y, sr = sf.read(a.master, always_2d=True)
    rep = report(y, sr)
    mono = y.mean(axis=1)
    eq = None
    if a.loop and rep["flagged"]:
        mono, eq = match_spectrum(y, mono, sr)
        after = report(np.stack([mono, mono], axis=1) * 1.0, sr)
        stereo_bands = {b["hz"]: b["bandLevelDbfs"] for b in rep["bands"]}
        mono_bands = {b["hz"]: b["bandLevelDbfs"] for b in after["bands"]}
        offset = np.median([mono_bands[h] - stereo_bands[h] for h in stereo_bands])
        rep["afterEq"] = {str(h): round(mono_bands[h] - stereo_bands[h] - offset, 2) for h in stereo_bands}
    meter = pyln.Meter(sr)
    probe = np.concatenate([mono, mono]) if a.loop else mono
    gain = a.lufs - meter.integrated_loudness(probe)
    mono = mono * 10 ** (gain / 20)
    tp = true_peak_db(np.concatenate([mono, mono[: sr // 10]]) if a.loop else mono)
    if tp > -1.0:
        mono = mono * 10 ** ((-1.0 - tp) / 20)
    os.makedirs(a.out, exist_ok=True)
    stem = os.path.basename(a.master).replace(".flac", "")
    flac = os.path.join(a.out, f"{stem}.mono.flac")
    sf.write(flac, mono, sr, subtype="PCM_24")
    wav = flac + ".tmp.wav"
    sf.write(wav, mono, sr, subtype="FLOAT")
    ogg = os.path.join(a.out, f"{stem}.mono.ogg")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-map_metadata", "-1",
                    "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libvorbis", "-q:a", str(a.quality), ogg], check=True)
    os.remove(wav)
    dec = ogg + ".dec.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", ogg, "-c:a", "pcm_f32le", dec], check=True)
    d, _ = sf.read(dec, always_2d=True)
    os.remove(dec)
    result = {
        "stereoMaster": a.master, "stereoMasterSha256": sha256(a.master), "sampleRate": sr,
        "downmix": "(L+R)/2" + (", then a circular zero-phase spectral-balance EQ" if eq else ""), "phase": rep,
        "balanceEq": eq,
        "loudness": {"targetLufs": a.lufs, "measuredAs": "single channel, ITU-R BS.1770 (pyloudnorm)",
                     "outputLufs": round(meter.integrated_loudness(np.concatenate([mono, mono]) if a.loop else mono), 2),
                     "truePeakDbtp": round(true_peak_db(mono), 2)},
        "samples": len(mono), "seconds": round(len(mono) / sr, 4),
        "framesAt": {str(r): len(mono) * r / sr for r in (22050, 44100, 48000)},
        "monoFlac": flac, "monoFlacSha256": sha256(flac),
        "ogg": ogg, "oggSha256": sha256(ogg), "oggBytes": os.path.getsize(ogg),
        "oggChannels": d.shape[1], "oggDecodedSamples": len(d),
        "decodedBytesAt48kMono": len(mono) * 4,
    }
    with open(os.path.join(a.out, f"{stem}.mono.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(json.dumps({k: result[k] for k in ("seconds", "loudness", "oggBytes", "oggDecodedSamples", "decodedBytesAt48kMono")}))
    print(json.dumps(rep))


if __name__ == "__main__":
    main()
