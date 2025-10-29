
// CONFIGURATION

const API_BASE = (localStorage.getItem('API_BASE') || 'http://72.60.189.114:8010').replace(/\/$/, '');
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let timelineChart = null;
let currentGranularity = 'day';


// FETCH DATA

async function fetchInsights() {
  try {
    const [overview, timeline, models, heatmap, equivalents, recommendations] = await Promise.all([
      fetch(`${API_BASE}/insights/overview`).then(r => r.json()),
      fetch(`${API_BASE}/insights/timeline?granularity=${currentGranularity}`).then(r => r.json()),
      fetch(`${API_BASE}/insights/models`).then(r => r.json()),
      fetch(`${API_BASE}/insights/heatmap`).then(r => r.json()),
      fetch(`${API_BASE}/insights/equivalents`).then(r => r.json()),
      fetch(`${API_BASE}/insights/recommendations`).then(r => r.json())
    ]);

    renderHeroMetrics(overview);
    renderTimeline(timeline);
    renderModels(models);
    renderHeatmap(heatmap);
    renderEquivalents(equivalents);
    renderRecommendations(recommendations);
  } catch (error) {
    console.error('Erreur lors du chargement des insights:', error);
    showError('Impossible de charger les données. Vérifie que l\'API est accessible.');
  }
}


// HERO METRICS

function renderHeroMetrics(data) {
  $('#totalCarbon').textContent = data.total_carbon_gco2eq.toFixed(2);
  $('#totalEnergy').textContent = data.total_energy_kwh.toFixed(4);
  $('#totalRequests').textContent = data.total_requests;
  $('#avgCarbon').textContent = data.avg_carbon_per_request.toFixed(3);

  // Tendances (placeholder - nécessite historique)
  $('#carbonTrend').textContent = '—';
  $('#energyTrend').textContent = '—';
  $('#requestsTrend').textContent = '—';
  $('#efficiencyTrend').textContent = '—';
}


// TIMELINE CHART

function renderTimeline(data) {
  const ctx = $('#timelineChart');
  
  if (timelineChart) {
    timelineChart.destroy();
  }

  const labels = data.map(d => d.date);
  const carbonData = data.map(d => d.carbon_gco2eq);
  const requestsData = data.map(d => d.requests);

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'CO₂ (gCO₂eq)',
          data: carbonData,
          borderColor: '#6ea8fe',
          backgroundColor: 'rgba(110, 168, 254, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Requêtes',
          data: requestsData,
          borderColor: '#00bfa5',
          backgroundColor: 'rgba(0, 191, 165, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#e6edf3' }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#12161b',
          titleColor: '#e6edf3',
          bodyColor: '#9aa4ad',
          borderColor: '#1f2630',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: '#9aa4ad' },
          grid: { color: '#1f2630' }
        },
        y: {
          type: 'linear',
          position: 'left',
          ticks: { color: '#6ea8fe' },
          grid: { color: '#1f2630' },
          title: {
            display: true,
            text: 'CO₂ (g)',
            color: '#6ea8fe'
          }
        },
        y1: {
          type: 'linear',
          position: 'right',
          ticks: { color: '#00bfa5' },
          grid: { display: false },
          title: {
            display: true,
            text: 'Requêtes',
            color: '#00bfa5'
          }
        }
      }
    }
  });
}


// MODELS COMPARISON

function renderModels(models) {
  const container = $('#modelsGrid');
  container.innerHTML = '';

  models.forEach(model => {
    const card = document.createElement('div');
    card.className = 'model-card';
    
    const scoreClass = model.efficiency_score >= 80 ? 'excellent' : 
                       model.efficiency_score >= 60 ? 'good' : 'poor';
    
    card.innerHTML = `
      <div class="model-header">
        <h3>${model.model.split(':')[1] || model.model}</h3>
        <span class="efficiency-badge ${scoreClass}">${model.efficiency_score}/100</span>
      </div>
      <div class="model-stats">
        <div class="stat">
          <span class="stat-label">Requêtes</span>
          <span class="stat-value">${model.requests}</span>
        </div>
        <div class="stat">
          <span class="stat-label">CO₂ total</span>
          <span class="stat-value">${model.total_carbon_gco2eq.toFixed(2)}g</span>
        </div>
        <div class="stat">
          <span class="stat-label">CO₂/1k tokens</span>
          <span class="stat-value">${model.carbon_per_1k_tokens.toFixed(3)}g</span>
        </div>
        <div class="stat">
          <span class="stat-label">Tokens</span>
          <span class="stat-value">${formatNumber(model.total_tokens)}</span>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}


// HEATMAP

function renderHeatmap(data) {
  const container = $('#heatmapContainer');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="muted">Pas encore de données horaires</p>';
    return;
  }

  const maxIntensity = Math.max(...data.map(d => d.intensity));

  data.forEach(hourData => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    
    const intensity = hourData.intensity / maxIntensity;
    const hue = 120 - (intensity * 120); // Vert → Rouge
    cell.style.backgroundColor = `hsla(${hue}, 70%, 50%, ${0.3 + intensity * 0.7})`;
    
    cell.innerHTML = `
      <div class="hour-label">${hourData.hour}h</div>
      <div class="intensity-value">${hourData.carbon_gco2eq.toFixed(1)}g</div>
    `;
    
    cell.title = `${hourData.hour}h: ${hourData.carbon_gco2eq.toFixed(2)}g CO₂ (${hourData.requests} requêtes)`;
    
    container.appendChild(cell);
  });
}


// EQUIVALENTS

function renderEquivalents(data) {
  const container = $('#equivalentsList');
  
  const equivalents = [
    { icon: '📺', label: 'heures de Netflix', value: data.netflix_hours, unit: 'h' },
    { icon: '📧', label: 'emails envoyés', value: data.emails_sent, unit: '' },
    { icon: '🚗', label: 'km en voiture', value: data.km_car, unit: 'km' },
    { icon: '📱', label: 'charges de smartphone', value: data.smartphone_charges, unit: '' },
    { icon: '🌳', label: 'arbres nécessaires/an', value: data.trees_needed, unit: '' }
  ];

  container.innerHTML = equivalents.map(eq => `
    <div class="equivalent-item">
      <div class