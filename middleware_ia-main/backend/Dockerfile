# Image plus complète pour éviter les erreurs de build de wheels
FROM python:3.11

# (facultatif mais utile) quelques outils réseau / git
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && rm -rf /var/lib/apt/lists/*

# PIP: moins de verbosité, pas de cache, timeout augmenté
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 1) requirements d'abord pour bénéficier du cache Docker
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip setuptools wheel \
 && pip install --prefer-binary -r requirements.txt

# 2) puis le code
COPY . /app

EXPOSE 8010
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
