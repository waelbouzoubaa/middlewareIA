from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseAdapter(ABC):
    """
    Classe de base pour tous les adaptateurs de modèles IA.
    Chaque adaptateur (OpenAI, Perplexity, Anthropic, etc.)
    doit hériter de cette classe et implémenter send_chat().
    """

    @abstractmethod
    def send_chat(self, model: str, messages: List[Dict[str, str]], stream: bool = False) -> Dict[str, Any]:
        """
        Envoie une requête au modèle IA et retourne une réponse formatée.

        Retour attendu :
        {
            "content": "texte généré par le modèle",
            "usage": {"input_tokens": 123, "output_tokens": 456},
            "cost_eur": 0.0012,
            "est_kwh": 0.00003,
            "est_co2e_g": 0.01
        }
        """
        raise NotImplementedError("Chaque adaptateur doit implémenter send_chat()")
