# AILEAN Offline

AILEAN (Voice → Identify → Map → Improve → Plan) running fully offline from this USB stick.
No cloud AI, no login, no internet. Client interviews and processes never leave the Mac.

---

## Quick start

1. Plug in the stick.
2. Double-click **`start-ailean.command`**.
   - First time: macOS may block it. Right-click → **Open** → **Open**.
3. Wait until the browser opens `http://127.0.0.1:4173`. The first start loads the model (~30 s, longer the first time).
4. Work as usual. **Keep the Terminal window open.** Closing it stops AILEAN.

---

## What is on the stick

```
AILEAN/
├── start-ailean.command     Double-click to start
├── get-models.command       Downloads the models (run once, needs internet)
├── README.md                This file
├── ailean_server.py         Local server: serves the app, runs Whisper and the voice
├── app/                     The offline build of AILEAN
├── runtimes/
│   ├── llamafile            Runs the language model (llamafile 0.10.6)
│   └── whisperfile          Runs speech-to-text (whisperfile 0.10.6)
├── models/
│   ├── llm/                 Main model:     Qwen3-4B-Instruct-2507 (Q4_K_M, 2.4 GB)
│   ├── llm-fallback/        Fallback model: Qwen3-4B-Thinking-2507 (Q4_K_M, 2.4 GB)
│   └── whisper/             Whisper large-v3-turbo (q5_0, 0.55 GB)
├── logs/                    Log files for troubleshooting
└── _setup-files/            Old start scripts and the code patch (not needed to run)
```

### How it works

| Part | Runs as | Port |
|---|---|---|
| AILEAN app + local server | `ailean_server.py` (Python, built into macOS) | 127.0.0.1:4173 |
| Language model | `llamafile` + model from `models/llm/` | 127.0.0.1:18080 (next free port if taken) |
| Speech-to-text | `whisperfile`, called per spoken phrase | — |
| Voice (interviewer speaks) | Built-in macOS voices (`say`) | — |

Everything listens on `127.0.0.1` only: nothing on the network can reach it, and it reaches nothing.
The local server also sets a browser security policy that **blocks every request to anything other than itself**, so even an overlooked cloud call in the app cannot leave the machine.

---

## One-time setup on a new Mac

Nothing to install. You only need:

1. **Danish voice** (for the AILEAN interviewer):
   System Settings → Accessibility → Spoken Content → System voice → **Manage Voices** → Danish → **Sara** → download.
   Without it, questions are still shown on screen, but spoken in the default voice.
2. **Microphone permission** for the browser the first time you press Record or AILEAN.
3. **24 GB RAM recommended** (16 GB works with the 4B model; close other heavy apps).

If the models are missing (e.g. a fresh stick), run **`get-models.command`** once with internet. It resumes if interrupted.

---

## Daily use

| Task | How |
|---|---|
| AI-led interview | **Ailean** button → AILEAN asks one question at a time aloud; answer and pause ~2 s to hand back the turn. Ends itself with a summary, or click again to stop. |
| Dictate yourself | **Record** → speak → Record again to stop. |
| Use an existing transcript | **Paste** → Parse Voice. |
| Analyse | **Parse Voice →** then review, map, improve and plan as online. |

**Interview language:** set EN/DA before starting. Danish works best with the Danish voice installed.

---

## Prove it is offline (do this before showing a client)

1. Start AILEAN.
2. **Turn Wi-Fi off** (and unplug any network cable).
3. Run a full flow: interview → Parse Voice → diagram → plan.
4. Optional, stronger proof: install the free firewall **LuLu** (objective-see.org) and show it reports **no outbound connections** during the run.

If the flow completes with Wi-Fi off, nothing is leaving the machine.

---

## Client data — rules

- **Nothing is ever synced online.** Cloud sync, login and all external calls are disabled in this build.
- **Where data lives:** work-in-progress flows are stored in the browser's storage **on this Mac**, not on the stick.
- **After each client engagement:**
  1. Export what you need (BPMN, plan) into an encrypted location (e.g. a VeraCrypt vault on this stick).
  2. Clear the browser data for `127.0.0.1` (browser settings → site data).
- **Never** put client transcripts in the unencrypted parts of the stick.
- If the stick is lost, the models and app are public software — the risk is only what you saved unencrypted.

---

## Models

`start-ailean.command` picks the model automatically:

1. First non-"thinking" model in `models/llm/` → **Qwen3-4B-Instruct** (fast, answers directly)
2. Otherwise any model in `models/llm/`
3. Otherwise the model in `models/llm-fallback/` → **Qwen3-4B-Thinking** (works, but slow: reasons before every answer)

**Use the fallback model:** move the Instruct model out of `models/llm/` (e.g. into `_setup-files/`).

**Try a bigger model** (better analysis, needs more RAM): download a Q4_K_M `.gguf`, e.g. Qwen3-8B-Instruct (~5 GB), put it in `models/llm/`, and move the 4B out. 24 GB RAM handles 8B comfortably.

Force a specific model for one run (Terminal):
```bash
AILEAN_MODEL=/Volumes/AILEAN/models/llm-fallback/qwen3-4b-thinking-2507.Q4_K_M.gguf /Volumes/AILEAN/start-ailean.command
```

---

## Tested (30 Oct 2026)

| Test | Result |
|---|---|
| Model files | Complete and valid (GGUF / ggml headers checked) |
| Language model starts from stick | ✓ ~30 s load |
| Identify step, real AILEAN prompt, Danish invoice interview | ✓ Valid JSON in Danish: process, roles, 6 steps, exceptions, pain points |
| Whisper via AILEAN server | ✓ Returns Danish text |
| App served locally, external requests blocked | ✓ |

**Known quality limits of the 4B model:** may miss a role, choose an odd Danish word, or add an invented exception. Review the **Review** step more carefully than online. Speed on the Mac (GPU) is several times faster than the test machine.

**Not yet tested on the Mac itself:** macOS voice output and a full interview with Wi-Fi off — run the "Prove it is offline" check once.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "cannot be opened because it is from an unidentified developer" | Right-click the `.command` file → Open → Open. |
| Terminal says permission denied | In Terminal: `chmod +x /Volumes/AILEAN/*.command /Volumes/AILEAN/runtimes/*` |
| Browser shows "Local model is not running" | Model still loading, or crashed — check `logs/llm.log`. |
| Answers are cut off / empty | Using the thinking fallback model: switch to Instruct. Or long interview: start with `AILEAN_CTX=65536`. |
| "Whisper failed" / no transcript | Check `logs/app.log`. Confirm `models/whisper/ggml-large-v3-turbo-q5_0.bin` exists. First run can be slow. |
| No voice / wrong voice | Install the Danish voice "Sara" (see setup). |
| Very slow | Close other apps; check RAM. On 16 GB Macs keep the 4B model. |
| "AILEAN already seems to be running" | Another AILEAN is running — close its Terminal window, or restart the Mac. |
| "Local language model is not running" | The model stopped or never started — check `logs/llm.log`, close all Terminal windows and start again. |

Logs: `logs/llm.log` (model), `logs/app.log` (app, Whisper, voice).

---

## Updating AILEAN

The offline version is built from the same code as ailean.dk (repo `kristiansteen/voice-2-launch`, branch `offline-mode`). Changes to the app go into the repo once and are rebuilt for both versions — never edit files on the stick.

```bash
cd ~/voice-2-launch
npm run build:offline          # → dist-offline/
rm -rf /Volumes/AILEAN/app && cp -R dist-offline /Volumes/AILEAN/app
cp offline/ailean_server.py offline/*.command offline/README.md /Volumes/AILEAN/
```

**Keep the interviewer prompts aligned:** online, the interview script lives in the ElevenLabs dashboard; offline, in `src/lib/localInterviewPrompt.js`. Change one → copy to the other.
