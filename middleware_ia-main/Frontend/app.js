
// CONFIGURATION GLOBALE

const qs = new URLSearchParams(location.search);
const $ = (sel, root = document) => root.querySelector(sel);
const API_BASE = (localStorage.getItem('API_BASE') || 'http://72.60.189.114:8010').replace(/\/$/, '');

// Configuration de Marked.js pour un rendu sécurisé et propre
if (typeof marked !== 'undefined') {
  marked.setOptions({
    breaks: true,        // Convertit les retours à la ligne en <br>
    gfm: true,          // GitHub Flavored Markdown
    headerIds: false,   // Pas d'IDs auto dans les titres
    mangle: false       // Garde les emails lisibles
  });
}


// GESTION DU MODAL DE CONFIGURATION API

function openSettings() {
  $('#settingsModal')?.classList.remove('hidden');
  $('#apiBaseInput').value = API_BASE;
}

function closeSettings() {
  $('#settingsModal')?.classList.add('hidden');
}

function saveSettings() {
  const val = $('#apiBaseInput').value.trim();
  if (val) {
    localStorage.setItem('API_BASE', val);
    closeSettings();
    location.reload();
  }
}

$('#btnSettings')?.addEventListener('click', openSettings);
$('#btnCloseSettings')?.addEventListener('click', closeSettings);
$('#btnSaveSettings')?.addEventListener('click', saveSettings);


// REQUÊTE API

async function apiPost(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`POST ${path} -> ${resp.status} ${txt}`);
  }
  
  return resp.json();
}


// ÉTAT GLOBAL DE L'APPLICATION

const state = {
  provider: qs.get('provider') || 'openai',
  model: null,
  messages: [],
  sending: false
};


// MODÈLES DISPONIBLES

const MODELS = {
  openai: [
    { id: 'openai:gpt-4o-mini', label: 'GPT-4o-Mini' },
    { id: 'openai:gpt-4o', label: 'GPT-4o' },
    { id: 'openai:gpt-4-turbo', label: 'GPT-4-Turbo' },
    { id: 'openai:gpt-3.5-turbo', label: 'GPT-3.5-Turbo' },
    { id: 'openai:gpt-5', label: 'GPT-5 (bientôt disponible)', disabled: true },
  ],
  mistral: [
    { id: 'mistral:open-mixtral-8x7b', label: 'Mixtral 8×7B' },
    { id: 'mistral:open-mistral-7b', label: 'Mistral 7B' },
  ],
};


// INITIALISATION DU SÉLECTEUR DE MODÈLE

function initModelSelect() {
  const select = $('#modelSelect');
  if (!select) return;

  const providerModels = MODELS[state.provider] || [];
  select.innerHTML = '';

  providerModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.disabled) opt.disabled = true;
    select.appendChild(opt);
  });

  state.model = providerModels[0]?.id || null;
  $('#currentModelLabel').textContent = providerModels[0]?.label || 'Modèle';

  select.addEventListener('change', e => {
    state.model = e.target.value;
    const selectedText = e.target.options[e.target.selectedIndex].text;
    $('#currentModelLabel').textContent = selectedText;
  });
}


// AFFICHAGE DES STATISTIQUES D'USAGE

function renderUsage(resp) {
  const u = resp?.usage || {};
  const parts = [];

  if (u.input_tokens || u.output_tokens) {
    parts.push(`tokens ${u.input_tokens || 0}/${u.output_tokens || 0}`);
  }
  if (resp?.cost_eur) {
    parts.push(`${resp.cost_eur.toFixed(6)} €`);
  }
  if (resp?.est_co2e_g) {
    parts.push(`${resp.est_co2e_g.toFixed(2)} gCO₂e`);
  }

  $('#usageStats').textContent = parts.join(' • ');
}


// RENDU DES MESSAGES AVEC SUPPORT MARKDOWN

function renderMessages() {
  const log = $('#chatLog');
  if (!log) return;

  log.innerHTML = '';

  for (const msg of state.messages) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${msg.role}`;

    // Avatar selon le rôle
    const icon = msg.role === 'assistant' ? '🤖' : (msg.role === 'system' ? '⚙️' : '🙂');
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.textContent = icon;

    // Bulle de message
    const bubbleDiv = document.createElement('div');

    if (msg.role === 'assistant' && typeof marked !== 'undefined') {
      // Parse Markdown → HTML pour les réponses IA
      bubbleDiv.className = 'bubble markdown-body';
      bubbleDiv.innerHTML = marked.parse(msg.content);
    } else {
      // Texte brut pour l'utilisateur/système
      bubbleDiv.className = 'bubble';
      bubbleDiv.textContent = msg.content;
    }

    msgDiv.appendChild(avatarDiv);
    msgDiv.appendChild(bubbleDiv);
    log.appendChild(msgDiv);
  }

  log.scrollTop = log.scrollHeight;
}


// ENVOI D'UN MESSAGE AU MODÈLE

async function sendMessage() {
  if (state.sending || !state.model) return;

  const input = $('#chatInput');
  const text = (input.value || '').trim();
  if (!text) return;

  // Ajoute le message utilisateur
  state.messages.push({ role: 'user', content: text });
  input.value = '';
  renderMessages();

  // Désactive le bouton pendant l'envoi
  state.sending = true;
  const btnSend = $('#btnSend');
  btnSend.disabled = true;
  btnSend.textContent = 'Envoi...';

  try {
    const body = {
      user_id: 'webclient',
      model: state.model,
      messages: state.messages,
      stream: false
    };

    const resp = await apiPost('/chat', body);

    // Ajoute la réponse de l'assistant
    state.messages.push({
      role: 'assistant',
      content: resp?.content || '(Aucune réponse)'
    });

    renderMessages();
    renderUsage(resp);

  } catch (e) {
    // Affiche l'erreur dans le chat
    state.messages.push({
      role: 'assistant',
      content: `⚠️ Erreur: ${e.message}`
    });
    renderMessages();
  } finally {
    // Réactive le bouton
    state.sending = false;
    btnSend.disabled = false;
    btnSend.textContent = 'Envoyer';
  }
}


// INITIALISATION DU CHAT

function initChat() {
  if (!$('.chat-layout')) return;

  // Bouton "Nouveau chat"
  $('#btnClear')?.addEventListener('click', () => {
    state.messages = [];
    renderMessages();
    $('#usageStats').textContent = '';
  });

  // Envoi du formulaire
  $('#chatForm')?.addEventListener('submit', e => {
    e.preventDefault();
    sendMessage();
  });

  // Envoi avec Entrée (Shift+Entrée = retour ligne)
  $('#chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  initModelSelect();
}


// DÉMARRAGE DE L'APPLICATION

initChat();