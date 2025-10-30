import os
import json
import tempfile
import base64
from pathlib import Path
from io import BytesIO
from typing import List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from PIL import Image

from models import ChatRequest, ChatResponse, ModelInfo
from adapters.mistral_adapter import MistralAdapter
from adapters.openai_adapter import OpenAIAdapter

from ecologits import EcoLogits
import logging

# Initialisation des logs EcoLogits
EcoLogits.init(providers=["openai"])
logger = logging.getLogger("ecologits")
logger.setLevel(logging.INFO)
handler = logging.FileHandler("ecologits-traces.jsonl", mode="a", encoding="utf-8")
handler.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(handler)

# Charger les variables d'environnement (.env)
dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

# Initialisation FastAPI
app = FastAPI(title="Middleware IA - Multi-provider (OpenAI, Mistral, Gemini)")

# Autoriser toutes les origines (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Liste des modèles disponibles
MODELS: List[ModelInfo] = [
    # OpenAI
    ModelInfo(provider="openai", model="openai:gpt-4o-mini", label="GPT-4o-Mini", enabled=True),
    ModelInfo(provider="openai", model="openai:gpt-4o", label="GPT-4o (Vision)", enabled=True),
    ModelInfo(provider="openai", model="openai:gpt-4-turbo", label="GPT-4-Turbo", enabled=True),
    ModelInfo(provider="openai", model="openai:gpt-3.5-turbo", label="GPT-3.5-Turbo", enabled=True),
    ModelInfo(provider="openai", model="openai:gpt-5", label="GPT-5 (bientôt disponible)", enabled=False),

    # Mistral
    ModelInfo(provider="mistral", model="mistral:open-mistral-7b", label="Mistral 7B (Open)", enabled=True),
    ModelInfo(provider="mistral", model="mistral:open-mixtral-8x7b", label="Mixtral 8×7B (Open)", enabled=True),
]

# Sélection automatique d’adaptateur
def pick_adapter(model_name: str):
    if model_name.startswith("openai:"):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Clé API OpenAI absente du .env")
        return OpenAIAdapter(api_key)

    if model_name.startswith("mistral:"):
        api_key = os.getenv("MISTRAL_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Clé API Mistral absente du .env")
        return MistralAdapter(api_key)

    raise HTTPException(status_code=404, detail=f"Modèle '{model_name}' non reconnu.")


# --- Health Check & Liste des modèles ---
@app.get("/health")
def health_check():
    return {"status": "ok", "models_supported": len(MODELS)}

@app.get("/models", response_model=List[ModelInfo])
def get_models():
    return [m for m in MODELS if m.enabled]


# --- Endpoint texte ---
@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    model_info = next((m for m in MODELS if m.model == request.model), None)
    if model_info and not model_info.enabled:
        raise HTTPException(status_code=400, detail=f"Le modèle '{model_info.label}' n’est pas encore disponible.")

    adapter = pick_adapter(request.model)
    result = adapter.send_chat(request.model, request.messages)
    return result


# --- Endpoint fichier (PDF / Image) ---
@app.post("/chat/upload")
async def chat_with_file(
    model: str = Form(...),
    messages: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Envoi texte + fichier au modèle IA.
    - PDF : extraction texte (via PyMuPDF)
    - Images : encodage base64 (GPT-4o / Gemini Vision)
    """
    # Vérifie la validité du champ messages
    try:
        messages = json.loads(messages)
    except Exception:
        raise HTTPException(status_code=400, detail="Format JSON invalide pour 'messages'.")

    adapter = pick_adapter(model)
    file_path = None
    extracted_text = None
    image_b64 = None

    # Sauvegarde temporaire
    suffix = Path(file.filename).suffix.lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        file_path = tmp.name

    # --- Lecture PDF ---
    if suffix == ".pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            extracted_text = ""
            for page in doc:
                extracted_text += page.get_text()
            doc.close()
        except Exception as e:
            extracted_text = f"[Erreur PDF: {str(e)}]"

    # --- Lecture Image ---
    elif suffix in [".png", ".jpg", ".jpeg"]:
        try:
            img = Image.open(file_path)
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            image_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        except Exception as e:
            image_b64 = None
            extracted_text = f"[Erreur image: {str(e)}]"

    # --- Type non pris en charge ---
    else:
        extracted_text = f"[Fichier {file.filename} reçu mais type non pris en charge]"

    # Injection dans les messages
    if extracted_text:
        messages.append({
            "role": "user",
            "content": f"L'utilisateur a envoyé un fichier '{file.filename}'. Voici son contenu :\n\n{extracted_text[:6000]}..."
        })
    elif image_b64:
        # Structure multimodale pour GPT-4o
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": "Analyse cette image et décris ce qu’elle montre en détail."},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
            ]
        })
    else:
        messages.append({
            "role": "user",
            "content": f"L'utilisateur a envoyé un fichier '{file.filename}', mais aucun contenu n'a pu être traité."
        })

    # --- Envoi au modèle ---
    result = adapter.send_chat(model, messages)

    # Nettoyage du fichier temporaire
    if file_path:
        try:
            os.remove(file_path)
        except Exception:
            pass

    return result
