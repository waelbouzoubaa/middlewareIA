# ──────────────────────────────
# FRONTEND - Middleware IA
# Serveur statique avec NGINX (inclus dans l'image)
# ──────────────────────────────
FROM nginx:alpine

# Répertoire racine des fichiers web
WORKDIR /usr/share/nginx/html

# Copier tous les fichiers du front dans le conteneur
COPY . .

# Expose le port 80 interne
EXPOSE 80

# Lancer Nginx (aucune install VPS requise)
CMD ["nginx", "-g", "daemon off;"]
