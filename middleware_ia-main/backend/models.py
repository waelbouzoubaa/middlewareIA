from typing import List, Optional, Dict, Any
from pydantic import BaseModel

# Modèles de données pour les requêtes / réponses


class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    user_id: Optional[str] = "anonymous"
    model: str
    messages: List[Message]
    stream: Optional[bool] = False

class ChatResponse(BaseModel):
    content: str
    usage: Dict[str, Any]
    cost_eur: float
    est_kwh: float
    est_co2e_g: float

class ModelInfo(BaseModel):
    provider: str
    model: str
    label: str
    enabled: bool = True
