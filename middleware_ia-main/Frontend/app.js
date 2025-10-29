// CONFIGURATION GLOBALE

const qs = new URLSearchParams(location.search);
const $ = (sel, root = document) => root.querySelector(sel);
const API_BASE = (localStorage.getItem('API_BASE') || 'http://72.60.189.114:8010').replace(/\/$/, '');

// Configuration de Marked.js pour un rendu sécurisé et propre
if (typeof marked !== 'undefined') {
  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
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


// REQUÊTE API JSON

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
  sending: false,
  file: null,                 // ✅ fichier sélectionné
  fileName: ''                // ✅ nom affiché
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
      bubbleDiv.className = 'bubble markdown-body';
      bubbleDiv.innerHTML = marked.parse(msg.content);
    } else {
      bubbleDiv.className = 'bubble';
      bubbleDiv.textContent = msg.content;
    }

    msgDiv.appendChild(avatarDiv);
    msgDiv.appendChild(bubbleDiv);
    log.appendChild(msgDiv);
  }

  log.scrollTop = log.scrollHeight;
}


// UTILITAIRES FICHIER (badge + reset)

function updateFileBadge() {
  const badge = $('#fileBadge');
  if (state.file) {
    badge.textContent = `Fichier: ${state.fileName}`;
    badge.style.display = 'inline-block';
  } else {
    badge.textContent = '';
    badge.style.display = 'none';
  }
}
function clearSelectedFile() {
  state.file = null;
  state.fileName = '';
  const input = $('#fileInput');
  if (input) input.value = '';
  updateFileBadge();
}


// ENVOI D'UN MESSAGE (avec ou sans fichier)

async function sendMessage() {
  if (state.sending || !state.model) return;

  const input = $('#chatInput');
  const text = (input.value || '').trim();

  // rien à envoyer ?
  if (!text && !state.file) return;

  // on affiche côté utilisateur ce qu'il envoie
  if (text) {
    state.messages.push({ role: 'user', content: text });
  }
  if (state.file) {
    state.messages.push({ role: 'user', content: `📎 Fichier joint : ${state.fileName}` });
  }
  input.value = '';
  renderMessages();

  // état UI
  state.sending = true;
  const btnSend = $('#btnSend');
  const btnUpload = $('#btnUpload');
  btnSend.disabled = true;
  btnUpload.disabled = true;
  btnSend.textContent = 'Envoi...';

  try {
    let resp;
    if (state.file) {
      // ==== ENVOI MULTIPART /chat/upload ====
      const formData = new FormData();
      formData.append('model', state.model);
      formData.append('messages', JSON.stringify(state.messages));
      formData.append('file', state.file);

      const r = await fetch(`${API_BASE}/chat/upload`, {
        method: 'POST',
        body: formData
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`POST /chat/upload -> ${r.status} ${txt}`);
      }
      resp = await r.json();

      // le fichier est traité : on clean la sélection
      clearSelectedFile();

    } else {
      // ==== ENVOI JSON /chat ====
      const body = {
        user_id: 'webclient',
        model: state.model,
        messages: state.messages,
        stream: false
      };
      resp = await apiPost('/chat', body);
    }

    // Ajout de la réponse modèle
    state.messages.push({
      role: 'assistant',
      content: resp?.content || '(Aucune réponse)'
    });
    renderMessages();
    renderUsage(resp);

  } catch (e) {
    state.messages.push({
      role: 'assistant',
      content: `⚠️ Erreur: ${e.message}`
    });
    renderMessages();
  } finally {
    state.sending = false;
    btnSend.disabled = false;
    btnUpload.disabled = false;
    btnSend.textContent = 'Envoyer';
  }
}


// INITIALISATION DU CHAT

function initChat() {
  if (!$('.chat-layout')) return;

  // Nouveau chat
  $('#btnClear')?.addEventListener('click', () => {
    state.messages = [];
    clearSelectedFile();
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

  // Gestion fichier
  $('#btnUpload')?.addEventListener('click', () => $('#fileInput').click());
  $('#fileInput')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) {
      clearSelectedFile();
      return;
    }
    state.file = file;
    state.fileName = file.name;
    updateFileBadge();
  });

  initModelSelect();
}


// DÉMARRAGE

initChat();
