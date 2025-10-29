import json
from datetime import datetime
from pathlib import Path

# Facteurs moyens d'émission (gCO2eq / 1000 tokens)
MODEL_COEFFICIENTS = {
    "openai:gpt-4o-mini": 0.8,
    "openai:gpt-4-turbo": 1.2,
    "mistral:small": 0.3,
    "mistral:medium": 0.6,
    "mistral:large": 1.0,

}

LOG_PATH = Path(__file__).resolve().parent.parent / "ecologits-traces.jsonl"


def estimate_carbon(model: str, input_tokens: int, output_tokens: int):
    """
    Estime l'énergie (kWh) et les émissions (gCO₂eq) à partir du nombre de tokens.
    Inspiré des données Stanford, HuggingFace, OpenAI et EcoLogits.
    """
    total_tokens = input_tokens + output_tokens
    coef = MODEL_COEFFICIENTS.get(model, 0.5)
    carbon_g = (total_tokens / 1000) * coef
    energy_kwh = carbon_g / 475  # 475 gCO₂eq = 1 kWh (AIE 2023)

    data = {
        "timestamp": datetime.utcnow().isoformat(),
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "energy_kwh": energy_kwh,
        "carbon_gco2eq": carbon_g,
    }

    # Sauvegarde dans le même fichier qu'EcoLogits
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(data) + "\n")

    return data
