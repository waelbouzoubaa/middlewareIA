from fastapi import APIRouter
from pathlib import Path
from insights_analyzer import InsightsAnalyzer

router = APIRouter(prefix="/insights", tags=["Insights"])
TRACES_PATH = Path(__file__).resolve().parent / "ecologits-traces.jsonl"

@router.get("/overview")
def get_insights_overview():
    analyzer = InsightsAnalyzer(TRACES_PATH)
    return analyzer.get_overview_metrics()

@router.get("/timeline")
def get_carbon_timeline(granularity: str = "day"):
    analyzer = InsightsAnalyzer(TRACES_PATH)
    return analyzer.get_carbon_timeline(granularity)

@router.get("/models")
def get_model_comparison():
    analyzer = InsightsAnalyzer(TRACES_PATH)
    return analyzer.get_model_comparison()

@router.get("/heatmap")
def get_hourly_heatmap():
    analyzer = InsightsAnalyzer(TRACES_PATH)
    return analyzer.get_hourly_heatmap()

@router.get("/equivalents")
def get_carbon_equivalents():
    analyzer = InsightsAnalyzer(TRACES_PATH)
    return analyzer.get_equivalents()

@router.get("/recommendations")
def get_recommendations():
    analyzer = InsightsAnalyzer(TRACES_PATH)
    return analyzer.get_recommendations()
