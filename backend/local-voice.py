"""Local-only Kokoro worker. Setup downloads public models; serving uses offline cache."""
import contextlib
import json
import os
from pathlib import Path
import re
import sys

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "local-voice"
os.environ["HF_HOME"] = str(CACHE / "models")
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
SETUP = "--setup" in sys.argv
if not SETUP:
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

def main():
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import soundfile as sf
        import torch
        from kokoro import KModel, KPipeline
        import espeakng_loader
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        EspeakWrapper.set_library(espeakng_loader.get_library_path())
        os.environ["ESPEAK_DATA_PATH"] = espeakng_loader.get_data_path()
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        pipelines = {}
        def pipeline(language):
            if language not in pipelines:
                repo = "hexgrad/Kokoro-82M-v1.1-zh"
                # A shared bilingual model; phonemization stays on this computer.
                if "en-US" not in pipelines:
                    pipelines["en-US"] = KPipeline(lang_code="a", repo_id=repo, device="cpu")
                if language == "zh-TW":
                    english = pipelines["en-US"]
                    def pronounce_english(text):
                        return english.g2p(text)[0]
                    pipelines[language] = KPipeline(lang_code="z", repo_id=repo, model=english.model, en_callable=pronounce_english)
            return pipelines[language]

        def synthesize(request):
            language = request["language"]
            if language not in ("en-US", "zh-TW"):
                raise ValueError("Unsupported language")
            text = request["text"]
            if not isinstance(text, str) or not 1 <= len(text) <= 1800:
                raise ValueError("Invalid narration length")
            destination = Path(request["output"]).resolve()
            if destination.parent != (CACHE / "audio").resolve() or not re.fullmatch(r"[a-f0-9]{64}\.tmp\.wav", destination.name):
                raise ValueError("Invalid audio destination")
            voice = "zf_001" if language == "zh-TW" else "af_maple"
            engine = pipeline(language)
            segments = request.get("segments") or [text]
            if not isinstance(segments, list) or not 1 <= len(segments) <= 8 or any(not isinstance(part, str) or not part.strip() for part in segments) or " ".join(segments) != text:
                raise ValueError("Invalid narration segments")
            chunks = []
            cue_times = []
            samples = 0
            for text in segments:
                cue_times.append(round(samples / 24000, 3))
                # Keep complete clauses inside one teaching idea.
                text = text.replace("Σ", " Sigma " if language == "en-US" else "總和")
                text = text.replace("xᵢ", "x subscript i" if language == "en-US" else "第 i 個值")
                for symbol, english, chinese in [("≥", "greater than or equal to", "大於等於"), ("≤", "less than or equal to", "小於等於")]:
                    text = text.replace(symbol, f" {english} " if language == "en-US" else chinese)
                sentences = re.split(r"(?<=[。！？.!?;；])\s*|\n+", text)
                if language == "zh-TW":
                    # Preserve commas and number lists within a phrase instead of
                    # synthesizing disconnected fragments such as 二 / 四 / 六.
                    bounded = []
                    for sentence in sentences:
                        while len(sentence) > 70:
                            boundary = max(sentence.rfind(mark, 0, 70) for mark in "，,、：:")
                            end = boundary + 1 if boundary >= 35 else 70
                            bounded.append(sentence[:end])
                            sentence = sentence[end:]
                        bounded.append(sentence)
                    sentences = bounded
                for sentence in sentences:
                    if not sentence.strip():
                        continue
                    for result in engine(sentence, voice=voice, speed=0.95):
                        if result.audio is not None:
                            chunk = result.audio.numpy()
                            pause = np.zeros(5280 if language == "zh-TW" else 3600, dtype=np.float32)
                            chunks.extend([chunk, pause])
                            samples += len(chunk) + len(pause)
            if not chunks:
                raise ValueError("No speech was produced")
            audio = np.concatenate(chunks)
            duration = len(audio) / 24000
            if not np.isfinite(audio).all() or not 0.1 <= duration <= 240:
                raise ValueError("Generated audio is invalid or too long")
            destination.parent.mkdir(parents=True, exist_ok=True)
            sf.write(destination, audio, 24000, subtype="PCM_16")
            return {"duration": round(duration, 3), "sampleRate": 24000, "voice": voice, "engine": "Kokoro v1.1-zh · CPU", "cueTimes": cue_times if request.get("segments") else None, "cueTiming": "audio-segments"}

        if SETUP:
            CACHE.mkdir(parents=True, exist_ok=True)
            (CACHE / "audio").mkdir(exist_ok=True)
            checks = []
            for language, text in [("zh-TW", "平均值等於總和除以數量。二加四加六等於十二，十二除以三，得到四。"), ("en-US", "The average is the sum divided by the count. Twelve divided by three is four.")]:
                import hashlib
                key = hashlib.sha256((language + text).encode()).hexdigest()
                result = synthesize({"language": language, "text": text, "output": str(CACHE / "audio" / f"{key}.tmp.wav")})
                (CACHE / "audio" / f"{key}.tmp.wav").replace(CACHE / f"sample-{language}.wav")
                checks.append({"language": language, **result})
            (CACHE / "ready.json").write_text(json.dumps({"version": 1, "languages": checks}), encoding="utf-8")
            print(json.dumps({"ready": True, "checks": checks}), file=sys.__stdout__, flush=True)
            return

    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            with contextlib.redirect_stdout(sys.stderr):
                result = synthesize(request)
            print(json.dumps({"id": request["id"], **result}), flush=True)
        except Exception:
            import traceback
            traceback.print_exc(file=sys.stderr)
            print(json.dumps({"id": request.get("id"), "error": "Local voice generation failed. Check installation and saved models."}), flush=True)

if __name__ == "__main__":
    main()
