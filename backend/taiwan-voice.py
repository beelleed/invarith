"""Online synthesis of public bundled lesson text. No learner code is accepted."""
import asyncio
import json
from pathlib import Path
import re
import sys
import socket
import bisect

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent.parent

async def main():
    import edge_tts
    import aiohttp
    import soundfile as sf
    import numpy as np
    request=json.load(sys.stdin)
    if request.get("language")!="zh-TW" or request.get("voice") not in ["zh-TW-HsiaoChenNeural","zh-TW-HsiaoYuNeural"]:
        raise ValueError("Unsupported Taiwan voice")
    text=request.get("text")
    if not isinstance(text,str) or not 1<=len(text)<=1800:
        raise ValueError("Invalid narration")
    output=Path(request["output"]).resolve()
    if output.parent!=(ROOT/"data/taiwan-voice/audio").resolve() or not re.fullmatch(r"[a-f0-9]{64}\.tmp\.wav",output.name):
        raise ValueError("Invalid destination")
    temporary=output.with_suffix(".mp3")
    segments=request.get("segments") or [text]
    if not isinstance(segments,list) or not 1<=len(segments)<=8 or any(not isinstance(part,str) or not part.strip() for part in segments) or " ".join(segments)!=text:
        raise ValueError("Invalid teaching narration segments")
    normalize=lambda value: "".join(char.lower() for char in value if char.isalnum())
    full=normalize(text)
    starts=[]
    cursor=0
    for part in segments:
        starts.append(cursor)
        cursor+=len(normalize(part))
    cue_times=[None]*len(segments)
    cue_times[0]=0.0
    try:
        # Whole sentences retain the service's natural pauses and list intonation.
        async with aiohttp.TCPConnector(family=socket.AF_INET) as connector:
            speech=edge_tts.Communicate(text,request["voice"],rate="-5%",connector=connector,boundary="WordBoundary")
            async def collect():
                cursor=0
                with temporary.open("wb") as output_stream:
                    async for event in speech.stream():
                        if event["type"]=="audio":
                            output_stream.write(event["data"])
                        elif event["type"]=="WordBoundary":
                            word=normalize(event["text"])
                            if not word:
                                continue
                            position=full.find(word,cursor)
                            if position<0:
                                continue
                            cue=bisect.bisect_right(starts,position)-1
                            if cue_times[cue] is None:
                                cue_times[cue]=round(event["offset"]/10000000,3)
                            cursor=position+len(word)
            await asyncio.wait_for(collect(),timeout=45)
        audio,rate=sf.read(temporary)
        duration=len(audio)/rate
        if not np.isfinite(audio).all() or np.max(np.abs(audio))<0.001 or not 0.1<=duration<=240:
            raise ValueError("Invalid generated audio")
        sf.write(output,audio,rate,subtype="PCM_16")
        timing=cue_times if all(value is not None for value in cue_times) else None
        print(json.dumps({"duration":round(duration,3),"voice":request["voice"],"engine":"Taiwan Mandarin · Microsoft online voice","sampleRate":rate,"cueTimes":timing,"cueTiming":"speech-boundaries"}))
    finally:
        temporary.unlink(missing_ok=True)

if __name__=="__main__":
    asyncio.run(main())
