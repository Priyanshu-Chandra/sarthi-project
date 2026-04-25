import whisper
import sys

# ✅ Fix encoding issue
sys.stdout.reconfigure(encoding='utf-8')

model = whisper.load_model("base")  # or "tiny" for faster

audio_path = sys.argv[1]

print("Transcribing...")

result = model.transcribe(audio_path)

text = result["text"]

print("Done")

print(text)
