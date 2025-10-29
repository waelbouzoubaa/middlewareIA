import json
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Any


class InsightsAnalyzer:
    """Analyse les traces EcoLogits pour générer des insights environnementaux."""
    
    def __init__(self, traces_path: Path):
        self.traces_path = traces_path
        self.traces = self._load_traces()
    
    def _load_traces(self) -> List[Dict[str, Any]]:
        """Charge et parse les traces JSONL en filtrant les logs."""
        traces = []
        if not self.traces_path.exists():
            return traces
        
        with open(self.traces_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or not line.startswith('{'):
                    continue  
                try:
                    data = json.loads(line)
                    if 'timestamp' in data and 'model' in data:
                        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
                        traces.append(data)
                except json.JSONDecodeError:
                    continue
        
        return sorted(traces, key=lambda x: x['timestamp'])
    
    def get_overview_metrics(self) -> Dict[str, Any]:
        """Métriques globales d'usage."""
        if not self.traces:
            return self._empty_metrics()
        
        total_requests = len(self.traces)
        total_input_tokens = sum(t.get('input_tokens', 0) for t in self.traces)
        total_output_tokens = sum(t.get('output_tokens', 0) for t in self.traces)
        total_energy = sum(t.get('energy_kwh', 0) for t in self.traces)
        total_carbon = sum(t.get('carbon_gco2eq', 0) for t in self.traces)
        
        avg_carbon_per_request = total_carbon / total_requests if total_requests > 0 else 0
        
        return {
            "total_requests": total_requests,
            "total_tokens": total_input_tokens + total_output_tokens,
            "total_energy_kwh": round(total_energy, 4),
            "total_carbon_gco2eq": round(total_carbon, 2),
            "avg_carbon_per_request": round(avg_carbon_per_request, 3),
            "date_range": {
                "start": self.traces[0]['timestamp'].isoformat(),
                "end": self.traces[-1]['timestamp'].isoformat()
            }
        }
    
    def get_carbon_timeline(self, granularity: str = "day") -> List[Dict[str, Any]]:
        """Timeline des émissions carbone."""
        timeline = defaultdict(lambda: {"carbon": 0, "requests": 0, "energy": 0})
        
        for trace in self.traces:
            if granularity == "day":
                key = trace['timestamp'].strftime("%Y-%m-%d")
            elif granularity == "hour":
                key = trace['timestamp'].strftime("%Y-%m-%d %H:00")
            else:
                key = trace['timestamp'].strftime("%Y-%m-%d")
            
            timeline[key]["carbon"] += trace.get('carbon_gco2eq', 0)
            timeline[key]["energy"] += trace.get('energy_kwh', 0)
            timeline[key]["requests"] += 1
        
        return [
            {
                "date": date,
                "carbon_gco2eq": round(data["carbon"], 2),
                "energy_kwh": round(data["energy"], 4),
                "requests": data["requests"]
            }
            for date, data in sorted(timeline.items())
        ]
    
    def get_model_comparison(self) -> List[Dict[str, Any]]:
        """Comparaison des modèles par efficacité."""
        model_stats = defaultdict(lambda: {
            "requests": 0,
            "carbon": 0,
            "energy": 0,
            "tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0
        })
        
        for trace in self.traces:
            model = trace.get('model', 'unknown')
            stats = model_stats[model]
            stats["requests"] += 1
            stats["carbon"] += trace.get('carbon_gco2eq', 0)
            stats["energy"] += trace.get('energy_kwh', 0)
            stats["input_tokens"] += trace.get('input_tokens', 0)
            stats["output_tokens"] += trace.get('output_tokens', 0)
            stats["tokens"] += trace.get('input_tokens', 0) + trace.get('output_tokens', 0)
        
        results = []
        for model, stats in model_stats.items():
            carbon_per_1k_tokens = (stats["carbon"] / stats["tokens"] * 1000) if stats["tokens"] > 0 else 0
            avg_carbon_per_request = stats["carbon"] / stats["requests"] if stats["requests"] > 0 else 0
            
            results.append({
                "model": model,
                "requests": stats["requests"],
                "total_carbon_gco2eq": round(stats["carbon"], 2),
                "total_energy_kwh": round(stats["energy"], 4),
                "total_tokens": stats["tokens"],
                "carbon_per_1k_tokens": round(carbon_per_1k_tokens, 3),
                "avg_carbon_per_request": round(avg_carbon_per_request, 3),
                "efficiency_score": self._calculate_efficiency_score(carbon_per_1k_tokens)
            })
        
        return sorted(results, key=lambda x: x["total_carbon_gco2eq"], reverse=True)
    
    def _calculate_efficiency_score(self, carbon_per_1k: float) -> int:
        """Score 0-100 basé sur l'efficacité carbone."""
        
        if carbon_per_1k <= 0.3:
            return 100
        elif carbon_per_1k <= 0.5:
            return 85
        elif carbon_per_1k <= 0.8:
            return 70
        elif carbon_per_1k <= 1.2:
            return 55
        else:
            return max(30, int(100 - (carbon_per_1k * 30)))
    
    def get_hourly_heatmap(self) -> List[Dict[str, Any]]:
        """Carte de chaleur des émissions par heure de la journée."""
        heatmap = defaultdict(lambda: {"carbon": 0, "requests": 0})
        
        for trace in self.traces:
            hour = trace['timestamp'].hour
            heatmap[hour]["carbon"] += trace.get('carbon_gco2eq', 0)
            heatmap[hour]["requests"] += 1
        
        return [
            {
                "hour": hour,
                "carbon_gco2eq": round(data["carbon"], 2),
                "requests": data["requests"],
                "intensity": round(data["carbon"] / data["requests"], 3) if data["requests"] > 0 else 0
            }
            for hour, data in sorted(heatmap.items())
        ]
    
    def get_equivalents(self) -> Dict[str, Any]:
        """Équivalents tangibles du CO₂ émis."""
        total_carbon = sum(t.get('carbon_gco2eq', 0) for t in self.traces)
        
        return {
            "netflix_hours": round(total_carbon / 36, 2),  # 36g/h Netflix
            "emails_sent": round(total_carbon / 4, 0),  # 4g par email
            "km_car": round(total_carbon / 120, 2),  # 120g/km voiture
            "smartphone_charges": round(total_carbon / 8.5, 1),  # 8.5g par charge
            "trees_needed": round(total_carbon / 22000, 3),  # 22kg absorbés/an/arbre
        }
    
    def get_recommendations(self) -> List[Dict[str, Any]]:
        """Recommandations basées sur les patterns d'usage."""
        recommendations = []
        
        if not self.traces:
            return recommendations
        
        # Analyse des modèles utilisés
        model_usage = defaultdict(int)
        for trace in self.traces:
            model_usage[trace.get('model', 'unknown')] += 1
        
        total_requests = len(self.traces)
        heavy_models = ['openai:gpt-4-turbo', 'openai:gpt-4o']
        heavy_usage = sum(model_usage.get(m, 0) for m in heavy_models)
        heavy_ratio = heavy_usage / total_requests if total_requests > 0 else 0
        
        # Recommandation 1: Optimiser le choix de modèle
        if heavy_ratio > 0.5:
            recommendations.append({
                "type": "model_optimization",
                "priority": "high",
                "title": "Optimise le choix de tes modèles",
                "description": f"{int(heavy_ratio*100)}% de tes requêtes utilisent des modèles lourds. Essaie GPT-4o-Mini ou Mistral 7B pour les tâches simples.",
                "potential_reduction": f"{int((heavy_ratio - 0.3) * 100)}%"
            })
        
        # Recommandation 2: Pics d'usage
        hourly = self.get_hourly_heatmap()
        if hourly:
            peak_hour = max(hourly, key=lambda x: x['carbon_gco2eq'])
            if peak_hour['requests'] > 5:
                recommendations.append({
                    "type": "timing",
                    "priority": "medium",
                    "title": "Évite les pics de consommation",
                    "description": f"Tu as un pic d'émissions à {peak_hour['hour']}h ({peak_hour['carbon_gco2eq']}g CO₂). Répartir tes requêtes réduit l'impact.",
                    "potential_reduction": "10-15%"
                })
        
        # Recommandation 3: Tendance hebdomadaire
        if len(self.traces) > 20:
            recent = self.traces[-10:]
            older = self.traces[-20:-10]
            recent_avg = sum(t.get('carbon_gco2eq', 0) for t in recent) / len(recent)
            older_avg = sum(t.get('carbon_gco2eq', 0) for t in older) / len(older)
            
            if recent_avg > older_avg * 1.2:
                increase = int((recent_avg / older_avg - 1) * 100)
                recommendations.append({
                    "type": "trend",
                    "priority": "high",
                    "title": "Ton empreinte augmente",
                    "description": f"Tes émissions ont augmenté de {increase}% récemment. Vérifie la complexité de tes prompts.",
                    "potential_reduction": f"{increase}%"
                })
        
        return recommendations
    
    def _empty_metrics(self) -> Dict[str, Any]:
        """Métriques vides si pas de données."""
        return {
            "total_requests": 0,
            "total_tokens": 0,
            "total_energy_kwh": 0,
            "total_carbon_gco2eq": 0,
            "avg_carbon_per_request": 0,
            "date_range": None
        }
