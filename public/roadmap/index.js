// Initial Feature Dataset
let features = [
    {
        id: "1",
        name: "Privacidade Zero-Knowledge (E2EE)",
        desc: "Criptografia ponta a ponta para dados de ciclo, com opção de Modo Anônimo completo (sem e-mail ou dados de identidade vinculados). Protege contra intimações ou vazamentos.",
        importance: 10,
        urgency: 10,
        column: "curto_prazo"
    },
    {
        id: "2",
        name: "Registro Simples de Sintomas",
        desc: "Calendário menstrual básico para marcar datas e sintomas principais (cólica, humor, fluxo, dor de cabeça) em uma interface limpa, sem poluição visual ou pop-ups.",
        importance: 10,
        urgency: 10,
        column: "curto_prazo"
    },
    {
        id: "3",
        name: "Sincronização com Wearables",
        desc: "Integração via Apple Health e Garmin SDK para puxar temperatura corporal basal (BBT) e frequência cardíaca, melhorando a precisão das previsões de ovulação.",
        importance: 8,
        urgency: 7,
        column: "medio_prazo"
    },
    {
        id: "4",
        name: "Previsões Locais por IA",
        desc: "Algoritmo de previsão rodando localmente (on-device) para estimar os próximos ciclos e janelas de fertilidade, garantindo a privacidade das previsões.",
        importance: 8,
        urgency: 8,
        column: "medio_prazo"
    },
    {
        id: "5",
        name: "Exportador de Relatório Médico",
        desc: "Geração de PDF elegante contendo gráficos de ciclo, temperatura e sintomas recorrentes para facilitar o compartilhamento com ginecologistas durante consultas.",
        importance: 9,
        urgency: 6,
        column: "curto_prazo"
    },
    {
        id: "6",
        name: "Alertas Discretos de Medicação",
        desc: "Notificações personalizáveis e discretas para anticoncepcionais, vitaminas e ingestão de água, sem menções explícitas a menstruação na tela de bloqueio.",
        importance: 7,
        urgency: 6,
        column: "curto_prazo"
    },
    {
        id: "7",
        name: "Comunidade Criptografada (Chat Secreto)",
        desc: "Espaço de suporte mútuo e fórum moderado de discussão sobre saúde feminina, com total anonimato e sem rastreadores comerciais de publicidade.",
        importance: 6,
        urgency: 5,
        column: "longo_prazo"
    },
    {
        id: "8",
        name: "Sincronia Lunar e Fases",
        desc: "Funcionalidade lúdica que compara as fases do ciclo menstrual com as fases da lua, atraindo o público jovem interessado em bem-estar holístico.",
        importance: 4,
        urgency: 3,
        column: "backlog"
    }
];

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.dashboard-section');
const matrixSlidersContainer = document.getElementById('matrix-sliders-container');
const quad1 = document.getElementById('quad-1-items');
const quad2 = document.getElementById('quad-2-items');
const quad3 = document.getElementById('quad-3-items');
const quad4 = document.getElementById('quad-4-items');
const kanbanColumns = {
    backlog: document.getElementById('col-backlog'),
    curto_prazo: document.getElementById('col-curto'),
    medio_prazo: document.getElementById('col-medio'),
    longo_prazo: document.getElementById('col-longo')
};
const addFeatureForm = document.getElementById('add-feature-form');
const exportJsonBtn = document.getElementById('export-json');
const genReportBtn = document.getElementById('gen-report');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalContent = document.getElementById('modal-markdown-content');
const toast = document.getElementById('toast');

// Active state for dragging
let draggedCardId = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    renderMatrixControls();
    renderMatrixQuadrants();
    renderKanbanRoadmap();
    setupDragAndDrop();
    setupForm();
    setupActions();
});

// Toast Helper
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// 1. Tab Navigation Setup
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            tab.classList.add('active');
            const targetSection = document.getElementById(tab.dataset.target);
            targetSection.classList.add('active');
        });
    });
}

// 2. Matrix Renderers
function renderMatrixControls() {
    matrixSlidersContainer.innerHTML = '';
    features.forEach(feat => {
        const card = document.createElement('div');
        card.className = 'feature-control-card';
        card.innerHTML = `
            <div class="feature-control-title">
                <span>${feat.name}</span>
            </div>
            <div class="feature-control-sliders">
                <div class="slider-group">
                    <label>Importância</label>
                    <input type="range" min="1" max="10" value="${feat.importance}" data-id="${feat.id}" data-type="importance">
                    <span class="slider-value" id="val-imp-${feat.id}">${feat.importance}</span>
                </div>
                <div class="slider-group">
                    <label>Urgência</label>
                    <input type="range" min="1" max="10" value="${feat.urgency}" data-id="${feat.id}" data-type="urgency">
                    <span class="slider-value" id="val-urg-${feat.id}">${feat.urgency}</span>
                </div>
            </div>
        `;
        matrixSlidersContainer.appendChild(card);
    });

    // Add events to sliders
    const sliders = matrixSlidersContainer.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            const val = parseInt(e.target.value);
            
            // Update labels
            document.getElementById(`val-${type === 'importance' ? 'imp' : 'urg'}-${id}`).textContent = val;
            
            // Update data
            const feature = features.find(f => f.id === id);
            if (feature) {
                feature[type] = val;
                
                // Update specific matrix views and kanban badges without resetting whole layouts
                renderMatrixQuadrants();
                updateKanbanBadges(id, feature.importance, feature.urgency);
            }
        });
    });
}

function renderMatrixQuadrants() {
    // Clear list
    quad1.innerHTML = '';
    quad2.innerHTML = '';
    quad3.innerHTML = '';
    quad4.innerHTML = '';
    
    let counts = { q1: 0, q2: 0, q3: 0, q4: 0 };
    
    features.forEach(feat => {
        const item = document.createElement('div');
        item.className = 'matrix-item-card';
        item.innerHTML = `
            <div class="matrix-item-details">
                <span class="matrix-item-name">${feat.name}</span>
                <span class="matrix-item-scores">I: ${feat.importance} | U: ${feat.urgency}</span>
            </div>
        `;
        
        // Quad Logic: Threshold is 6
        if (feat.importance >= 6 && feat.urgency >= 6) {
            quad1.appendChild(item);
            counts.q1++;
        } else if (feat.importance >= 6 && feat.urgency < 6) {
            quad2.appendChild(item);
            counts.q2++;
        } else if (feat.importance < 6 && feat.urgency >= 6) {
            quad3.appendChild(item);
            counts.q3++;
        } else {
            quad4.appendChild(item);
            counts.q4++;
        }
    });
    
    // Update count labels
    document.getElementById('count-q1').textContent = counts.q1;
    document.getElementById('count-q2').textContent = counts.q2;
    document.getElementById('count-q3').textContent = counts.q3;
    document.getElementById('count-q4').textContent = counts.q4;
}

// 3. Kanban Renderers
function renderKanbanRoadmap() {
    // Clear columns
    Object.keys(kanbanColumns).forEach(key => {
        kanbanColumns[key].innerHTML = '';
    });
    
    features.forEach(feat => {
        const card = createKanbanCard(feat);
        const col = kanbanColumns[feat.column];
        if (col) {
            col.appendChild(card);
        }
    });
    
    updateColumnCounts();
}

function createKanbanCard(feat) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', feat.id);
    
    // Set priority labels
    const impClass = feat.importance >= 8 ? 'badge-imp-high' : (feat.importance >= 5 ? 'badge-imp-med' : 'badge-imp-low');
    const impText = feat.importance >= 8 ? 'Alta Imp.' : (feat.importance >= 5 ? 'Média Imp.' : 'Baixa Imp.');
    
    const urgClass = feat.urgency >= 8 ? 'badge-urg-high' : (feat.urgency >= 5 ? 'badge-urg-med' : 'badge-urg-low');
    const urgText = feat.urgency >= 8 ? 'Crítico' : (feat.urgency >= 5 ? 'Médio' : 'Planejado');
    
    card.innerHTML = `
        <div class="card-feature-header">
            <div class="card-feature-title">${feat.name}</div>
            <button class="card-delete-btn" title="Excluir funcionalidade" data-id="${feat.id}">×</button>
        </div>
        <div class="card-feature-desc">${feat.desc}</div>
        <div class="card-badges">
            <span class="card-badge ${impClass}" id="badge-imp-${feat.id}">${impText}</span>
            <span class="card-badge ${urgClass}" id="badge-urg-${feat.id}">${urgText}</span>
        </div>
    `;
    
    // Add delete event
    card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFeature(feat.id);
    });
    
    return card;
}

function updateKanbanBadges(id, importance, urgency) {
    const impBadge = document.getElementById(`badge-imp-${id}`);
    const urgBadge = document.getElementById(`badge-urg-${id}`);
    
    if (impBadge && urgBadge) {
        // Importance
        impBadge.className = 'card-badge';
        if (importance >= 8) {
            impBadge.classList.add('badge-imp-high');
            impBadge.textContent = 'Alta Imp.';
        } else if (importance >= 5) {
            impBadge.classList.add('badge-imp-med');
            impBadge.textContent = 'Média Imp.';
        } else {
            impBadge.classList.add('badge-imp-low');
            impBadge.textContent = 'Baixa Imp.';
        }
        
        // Urgency
        urgBadge.className = 'card-badge';
        if (urgency >= 8) {
            urgBadge.classList.add('badge-urg-high');
            urgBadge.textContent = 'Crítico';
        } else if (urgency >= 5) {
            urgBadge.classList.add('badge-urg-med');
            urgBadge.textContent = 'Médio';
        } else {
            urgBadge.classList.add('badge-urg-low');
            urgBadge.textContent = 'Planejado';
        }
    }
}

function updateColumnCounts() {
    Object.keys(kanbanColumns).forEach(key => {
        const count = features.filter(f => f.column === key).length;
        document.getElementById(`count-${key}`).textContent = count;
    });
}

function deleteFeature(id) {
    if (confirm("Tem certeza que deseja excluir esta funcionalidade?")) {
        features = features.filter(f => f.id !== id);
        
        // Rerender all
        renderMatrixControls();
        renderMatrixQuadrants();
        renderKanbanRoadmap();
        
        showToast("Funcionalidade removida com sucesso.");
    }
}

// 4. Drag and Drop Logic
function setupDragAndDrop() {
    const kanbanLists = document.querySelectorAll('.kanban-list');
    
    kanbanLists.forEach(list => {
        list.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.kanban-card');
            if (card) {
                draggedCardId = card.getAttribute('data-id');
                card.classList.add('dragging');
            }
        });
        
        list.addEventListener('dragend', (e) => {
            const card = e.target.closest('.kanban-card');
            if (card) {
                card.classList.remove('dragging');
            }
            document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
            draggedCardId = null;
        });
    });
    
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.classList.add('drag-over');
        });
        
        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });
        
        col.addEventListener('drop', (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');
            
            if (draggedCardId) {
                const targetColumnKey = col.getAttribute('id').replace('col-', '').replace('-', '_');
                
                // Find item and update column
                const feat = features.find(f => f.id === draggedCardId);
                if (feat && feat.column !== targetColumnKey) {
                    feat.column = targetColumnKey;
                    
                    // Move card DOM
                    const cardDom = document.querySelector(`.kanban-card[data-id="${draggedCardId}"]`);
                    const listDom = col.querySelector('.kanban-list');
                    if (cardDom && listDom) {
                        listDom.appendChild(cardDom);
                    }
                    
                    updateColumnCounts();
                    showToast(`"${feat.name}" movido para ${getColumnName(targetColumnKey)}.`);
                }
            }
        });
    });
}

function getColumnName(key) {
    const names = {
        backlog: "Backlog",
        curto_prazo: "Curto Prazo",
        medio_prazo: "Médio Prazo",
        longo_prazo: "Longo Prazo"
    };
    return names[key] || key;
}

// 5. Form Handling
function setupForm() {
    addFeatureForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('new-feat-name');
        const descInput = document.getElementById('new-feat-desc');
        const impSelect = document.getElementById('new-feat-importance');
        const urgSelect = document.getElementById('new-feat-urgency');
        const colSelect = document.getElementById('new-feat-column');
        
        if (!nameInput.value.trim()) return;
        
        const newFeat = {
            id: Date.now().toString(),
            name: nameInput.value.trim(),
            desc: descInput.value.trim() || "Nenhuma descrição fornecida.",
            importance: parseInt(impSelect.value),
            urgency: parseInt(urgSelect.value),
            column: colSelect.value
        };
        
        features.push(newFeat);
        
        // Reset Form
        nameInput.value = '';
        descInput.value = '';
        impSelect.value = '5';
        urgSelect.value = '5';
        colSelect.value = 'backlog';
        
        // Rerender dashboard elements
        renderMatrixControls();
        renderMatrixQuadrants();
        renderKanbanRoadmap();
        
        showToast(`Nova funcionalidade "${newFeat.name}" adicionada.`);
    });
}

// 6. Action Button Operations
function setupActions() {
    // Export to JSON
    exportJsonBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(features, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "roadmap_features_plano.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("Arquivo JSON de roadmap baixado com sucesso.");
    });
    
    // Generate Markdown Report
    genReportBtn.addEventListener('click', () => {
        const report = generateMarkdownReport();
        modalContent.textContent = report;
        modalOverlay.classList.add('active');
    });
    
    // Close Modal
    modalClose.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });
}

function generateMarkdownReport() {
    let md = `# Relatório de Planejamento de Roadmap do Produto\n`;
    md += `Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
    
    md += `## 1. Quadrantes da Matriz de Priorização (Importância vs Urgência)\n\n`;
    
    const q1 = features.filter(f => f.importance >= 6 && f.urgency >= 6);
    const q2 = features.filter(f => f.importance >= 6 && f.urgency < 6);
    const q3 = features.filter(f => f.importance < 6 && f.urgency >= 6);
    const q4 = features.filter(f => f.importance < 6 && f.urgency < 6);
    
    md += `### 🟥 Quadrante I: Agir Agora (Urgente & Importante) - total: ${q1.length}\n`;
    q1.forEach(f => md += `- **${f.name}** (I: ${f.importance}, U: ${f.urgency}): ${f.desc}\n`);
    md += `\n`;
    
    md += `### 🟦 Quadrante II: Planejar (Importante, Não Urgente) - total: ${q2.length}\n`;
    q2.forEach(f => md += `- **${f.name}** (I: ${f.importance}, U: ${f.urgency}): ${f.desc}\n`);
    md += `\n`;
    
    md += `### 🟩 Quadrante III: Delegar/Ganhos Rápidos (Urgente, Não Importante) - total: ${q3.length}\n`;
    q3.forEach(f => md += `- **${f.name}** (I: ${f.importance}, U: ${f.urgency}): ${f.desc}\n`);
    md += `\n`;
    
    md += `### ⬛ Quadrante IV: Eliminar/Adiar (Não Urgente & Não Importante) - total: ${q4.length}\n`;
    q4.forEach(f => md += `- **${f.name}** (I: ${f.importance}, U: ${f.urgency}): ${f.desc}\n`);
    md += `\n`;
    
    md += `\n## 2. Linha do Tempo e Kanban de Lançamento (Roadmap)\n\n`;
    
    const cols = {
        curto_prazo: "Curto Prazo (Próximos 3 meses)",
        medio_prazo: "Médio Prazo (3-6 meses)",
        longo_prazo: "Longo Prazo (6+ meses)",
        backlog: "Backlog de Ideias"
    };
    
    Object.keys(cols).forEach(colKey => {
        md += `### 🎯 ${cols[colKey]}\n`;
        const items = features.filter(f => f.column === colKey);
        if (items.length === 0) {
            md += `*Sem funcionalidades planejadas para esta fase.*\n`;
        } else {
            items.forEach(f => {
                md += `- **${f.name}**: ${f.desc} *(Importância: ${f.importance}, Urgência: ${f.urgency})*\n`;
            });
        }
        md += `\n`;
    });
    
    md += `\n---\n*Gerado pela aplicação de Análise Competitiva e Ferramenta de Decisão Estratégica.*`;
    return md;
}

// ==========================================
// --- LÓGICA DO SIMULADOR DO APLICATIVO ---
// ==========================================

// Global state for period tracker
let currentCryptoMode = 'anonymous'; // 'anonymous' | 'encrypted'
let activeKey = null; // CryptoKey object in memory
let activeSalt = null; // Uint8Array salt
let cycleLogs = {}; // Daily logs: { "YYYY-MM-DD": { flow, cramps, mood, bbt, notes } }
let selectedDate = new Date().toISOString().split('T')[0];
let calDate = new Date(); // Active month being viewed in calendar

// DOM elements for simulator
const secBanner = document.getElementById('security-status-banner');
const secIcon = document.getElementById('security-icon');
const secTitle = document.getElementById('security-status-title');
const secDesc = document.getElementById('security-status-desc');
const toggleSecBtn = document.getElementById('toggle-security-card-btn');
const cryptoCard = document.getElementById('crypto-setup-card');
const masterPwdInput = document.getElementById('master-password-input');
const seedContainer = document.getElementById('seed-phrase-container');
const seedBox = document.getElementById('seed-phrase-box');
const cancelCryptoBtn = document.getElementById('cancel-crypto-btn');
const confirmCryptoBtn = document.getElementById('confirm-crypto-btn');

const calPrev = document.getElementById('cal-prev');
const calMonthYear = document.getElementById('cal-month-year');
const calNext = document.getElementById('cal-next');
const calDaysGrid = document.getElementById('calendar-days');

const phaseName = document.getElementById('hormonal-phase-name');
const phaseDesc = document.getElementById('hormonal-phase-desc');
const cycleDayLabel = document.getElementById('hormonal-cycle-day');
const predPeriodLabel = document.getElementById('prediction-next-period-date');
const dateLabel = document.getElementById('selected-date-label');
const symptomForm = document.getElementById('daily-symptom-form');

const flowSelect = document.getElementById('sym-flow');
const crampsSelect = document.getElementById('sym-cramps');
const moodSelect = document.getElementById('sym-mood');
const bbtInput = document.getElementById('sym-bbt');
const notesInput = document.getElementById('sym-notes');

const exportPdfBtn = document.getElementById('export-medical-pdf');
const hardDeleteBtn = document.getElementById('hard-delete-data');

const consentMetrics = document.getElementById('consent-metrics');
const consentPersonalization = document.getElementById('consent-personalization');
const saveConsentBtn = document.getElementById('save-consent-btn');

// Preloaded mock data for first-time use
const initialCycleLogs = {
    "2026-05-10": { flow: "heavy", cramps: "heavy", mood: "sensitive", bbt: 36.4, notes: "Início do fluxo ginecológico." },
    "2026-05-11": { flow: "medium", cramps: "medium", mood: "balanced", bbt: 36.3, notes: "" },
    "2026-05-12": { flow: "light", cramps: "light", mood: "happy", bbt: 36.5, notes: "" },
    "2026-06-08": { flow: "heavy", cramps: "medium", mood: "irritable", bbt: 36.3, notes: "Ciclo regularizado." },
    "2026-06-09": { flow: "medium", cramps: "light", mood: "balanced", bbt: 36.4, notes: "Dor de cabeça à tarde" },
    "2026-06-10": { flow: "light", cramps: "none", mood: "happy", bbt: 36.5, notes: "" }
};

// Seed words list
const seedWords = ["ciclo", "seguro", "saude", "mulher", "mente", "corpo", "privado", "segredo", "vida", "fase", "luz", "gema"];

// --- INITIALIZATION ---
function initSimulator() {
    loadSavedSettings();
    renderCalendar();
    updatePhasePrediction();
    setupSimulatorEvents();
}

document.addEventListener('DOMContentLoaded', () => {
    initSimulator();
});

// Load settings and logs
function loadSavedSettings() {
    // Load consents
    const metricsVal = localStorage.getItem('femtech_consent_metrics');
    const personalVal = localStorage.getItem('femtech_consent_personalization');
    if (metricsVal !== null) consentMetrics.checked = metricsVal === 'true';
    if (personalVal !== null) consentPersonalization.checked = personalVal === 'true';

    // Check if encrypted database exists
    const encDb = localStorage.getItem('femtech_cycle_logs_enc');
    if (encDb) {
        currentCryptoMode = 'encrypted';
        updateSecurityUI(true);
        // Prompt for password
        setTimeout(() => {
            promptPasswordForDecryption();
        }, 500);
    } else {
        // Load anonymous data
        currentCryptoMode = 'anonymous';
        updateSecurityUI(false);
        const anonDb = localStorage.getItem('femtech_cycle_logs_anon');
        if (anonDb) {
            cycleLogs = JSON.parse(anonDb);
        } else {
            // Load mock data
            cycleLogs = { ...initialCycleLogs };
            localStorage.setItem('femtech_cycle_logs_anon', JSON.stringify(cycleLogs));
        }
    }
}

// Security UI Update
function updateSecurityUI(isEncrypted) {
    if (isEncrypted) {
        secBanner.style.borderColor = 'rgba(167, 139, 250, 0.4)';
        secIcon.textContent = '🔐';
        secIcon.style.color = '#c084fc';
        secTitle.textContent = 'Modo Zero-Knowledge Ativo (Criptografado)';
        secTitle.style.color = '#c084fc';
        secDesc.textContent = 'Dados cifrados client-side via AES-GCM 256 bits antes do armazenamento local.';
        toggleSecBtn.textContent = '🔓 Desativar Modo Seguro';
        toggleSecBtn.style.background = 'linear-gradient(135deg, #4c1d95, #2e1065)';
        toggleSecBtn.style.borderColor = '#c084fc';
    } else {
        secBanner.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        secIcon.textContent = '🔓';
        secIcon.style.color = '#ef4444';
        secTitle.textContent = 'Modo Anônimo Local (Não Criptografado)';
        secTitle.style.color = '#ffffff';
        secDesc.textContent = 'Os dados são salvos localmente sem criptografia. Qualquer pessoa com acesso físico ao aparelho poderá lê-los.';
        toggleSecBtn.textContent = '🔐 Ativar Modo Zero-Knowledge';
        toggleSecBtn.style.background = 'linear-gradient(135deg, #ef4444, #7f1d1d)';
        toggleSecBtn.style.borderColor = '#f87171';
    }
}

// Prompt for Password
function promptPasswordForDecryption() {
    const password = prompt("Seus dados estão protegidos por criptografia Zero-Knowledge. Digite sua senha mestre para descriptografar:");
    if (password) {
        decryptDataWithPassword(password);
    } else {
        showToast("Senha não informada. Os dados criptografados permanecerão inacessíveis.");
        cycleLogs = {};
        renderCalendar();
        updatePhasePrediction();
    }
}

// --- CRIPTOGRAFIA HELPERS (WEB CRYPTO) ---
async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// Encrypt Logs
async function encryptDataWithPassword(password) {
    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(password, salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        
        const ciphertextBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(JSON.stringify(cycleLogs))
        );

        // Convert to Hex
        const hexCipher = Array.from(new Uint8Array(ciphertextBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        const hexIv = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        const hexSalt = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

        const encDb = { ciphertext: hexCipher, iv: hexIv, salt: hexSalt };
        localStorage.setItem('femtech_cycle_logs_enc', JSON.stringify(encDb));
        localStorage.removeItem('femtech_cycle_logs_anon'); // Delete clean data
        
        activeKey = key;
        activeSalt = salt;
        currentCryptoMode = 'encrypted';
        
        updateSecurityUI(true);
        showToast("Banco de dados local criptografado com sucesso!");
    } catch (err) {
        console.error("Encryption error:", err);
        showToast("Erro ao criptografar dados.");
    }
}

// Decrypt Logs
async function decryptDataWithPassword(password) {
    try {
        const encDbStr = localStorage.getItem('femtech_cycle_logs_enc');
        if (!encDbStr) return;
        
        const { ciphertext, iv, salt } = JSON.parse(encDbStr);
        const saltArray = new Uint8Array(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const ivArray = new Uint8Array(iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const cipherArray = new Uint8Array(ciphertext.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        const key = await deriveKey(password, saltArray);

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivArray },
            key,
            cipherArray
        );

        const decryptedText = new TextDecoder().decode(decryptedBuffer);
        cycleLogs = JSON.parse(decryptedText);
        
        activeKey = key;
        activeSalt = saltArray;
        currentCryptoMode = 'encrypted';
        
        renderCalendar();
        updatePhasePrediction();
        showToast("Descriptografia concluída! Dados carregados.");
    } catch (err) {
        console.error("Decryption error:", err);
        alert("Senha incorreta! Não foi possível ler seus dados.");
        promptPasswordForDecryption();
    }
}

// --- CALENDAR RENDERER ---
function renderCalendar() {
    calDaysGrid.innerHTML = '';
    
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    
    // Set header
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    calMonthYear.textContent = `${monthNames[month]} ${year}`;
    
    // First day of month
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    // Total days in month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Add empty space for previous month days
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calDaysGrid.appendChild(emptyCell);
    }
    
    // Add calendar days
    const todayStr = new Date().toISOString().split('T')[0];
    
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.textContent = day;
        
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        cell.setAttribute('data-date', dateStr);
        
        // Today styling
        if (dateStr === todayStr) {
            cell.classList.add('today');
        }
        
        // Selected styling
        if (dateStr === selectedDate) {
            cell.classList.add('selected');
        }
        
        // Check logs for dots
        const log = cycleLogs[dateStr];
        if (log) {
            const indicators = document.createElement('div');
            indicators.className = 'day-indicators';
            
            // Flow dot (Red)
            if (log.flow && log.flow !== 'none') {
                const dot = document.createElement('span');
                dot.className = 'indicator-dot ind-flow';
                indicators.appendChild(dot);
            }
            
            // Symptom dot (Purple)
            if ((log.cramps && log.cramps !== 'none') || (log.mood && log.mood !== 'balanced') || log.notes || (log.bbt && parseFloat(log.bbt) !== 36.5)) {
                const dot = document.createElement('span');
                dot.className = 'indicator-dot ind-symptom';
                indicators.appendChild(dot);
            }
            
            cell.appendChild(indicators);
        }
        
        // Event click
        cell.addEventListener('click', () => {
            selectedDate = dateStr;
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
            cell.classList.add('selected');
            loadSymptomFormForDate(dateStr);
        });
        
        calDaysGrid.appendChild(cell);
    }
}

// Load daily values into form
function loadSymptomFormForDate(dateStr) {
    // Format label
    const [y, m, d] = dateStr.split('-');
    dateLabel.textContent = `${d}/${m}/${y}`;
    
    const log = cycleLogs[dateStr];
    if (log) {
        flowSelect.value = log.flow || 'none';
        crampsSelect.value = log.cramps || 'none';
        moodSelect.value = log.mood || 'balanced';
        bbtInput.value = log.bbt || 36.5;
        notesInput.value = log.notes || '';
    } else {
        flowSelect.value = 'none';
        crampsSelect.value = 'none';
        moodSelect.value = 'balanced';
        bbtInput.value = 36.5;
        notesInput.value = '';
    }
    
    updatePhasePrediction();
}

// --- CYCLE ENGINE / ALGORITMO ---
function updatePhasePrediction() {
    // Find all periods (flow starting points)
    const periods = [];
    const sortedDates = Object.keys(cycleLogs)
        .filter(d => cycleLogs[d].flow && cycleLogs[d].flow !== 'none')
        .sort((a, b) => new Date(a) - new Date(b));

    if (sortedDates.length === 0) {
        phaseName.textContent = "Fase Folicular (Padrão)";
        phaseDesc.textContent = "Sem registros de fluxo menstrual. Registre sua última menstruação para calibrar o algoritmo.";
        cycleDayLabel.textContent = "Dia --";
        predPeriodLabel.textContent = "Prev. Menstruação: --/--/--";
        return;
    }

    // Group dates that are consecutive or within 4 days into single periods
    let currentPeriod = [new Date(sortedDates[0])];
    for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = new Date(sortedDates[i]);
        const lastDate = currentPeriod[currentPeriod.length - 1];
        const diffDays = Math.ceil(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 4) {
            currentPeriod.push(currentDate);
        } else {
            periods.push(currentPeriod);
            currentPeriod = [currentDate];
        }
    }
    periods.push(currentPeriod);

    // Get period start dates
    const periodStarts = periods.map(p => p[0]);

    // Calculate cycle lengths
    const cycleLengths = [];
    for (let i = 1; i < periodStarts.length; i++) {
        const diffTime = Math.abs(periodStarts[i] - periodStarts[i - 1]);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        cycleLengths.push(diffDays);
    }

    // Average Cycle length (default 28)
    const averageCycleLength = cycleLengths.length > 0 
        ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
        : 28;

    // Calculate last period date
    const lastPeriodStart = periodStarts[periodStarts.length - 1];
    
    // Predict next period
    const nextPeriodStart = new Date(lastPeriodStart);
    nextPeriodStart.setDate(lastPeriodStart.getDate() + averageCycleLength);
    
    const [ny, nm, nd] = nextPeriodStart.toISOString().split('T')[0].split('-');
    predPeriodLabel.textContent = `Prev. Menstruação: ${nd}/${nm}/${ny}`;

    // Current cycle day relative to selected date
    const targetDateObj = new Date(selectedDate);
    const diffTimeFromStart = targetDateObj - lastPeriodStart;
    const currentDay = Math.ceil(diffTimeFromStart / (1000 * 60 * 60 * 24)) + 1;

    if (currentDay < 1) {
        phaseName.textContent = "Fase Indeterminada";
        phaseDesc.textContent = "A data selecionada é anterior ao seu último ciclo menstrual registrado.";
        cycleDayLabel.textContent = "Dia --";
        return;
    }

    cycleDayLabel.textContent = `Dia ${currentDay}`;

    // Determine Hormonal Phase
    // Standard estimation phases:
    // Menstrual: Days 1-5
    // Folicular: Days 6-13
    // Ovulatory: Day 14
    // Luteal: Days 15 to cycle end
    if (currentDay <= 5) {
        phaseName.textContent = "Fase Menstrual";
        phaseDesc.textContent = "Os hormônios progesterona e estrogênio estão baixos. Foque em descansar e comer alimentos ricos em ferro.";
    } else if (currentDay <= 13) {
        phaseName.textContent = "Fase Folicular";
        phaseDesc.textContent = "O estrogênio está subindo, elevando sua energia e disposição. Bom momento para treinos intensos e socializar.";
    } else if (currentDay <= 15) {
        phaseName.textContent = "Fase Ovulatória";
        phaseDesc.textContent = "Janela de alta fertilidade. O LH atinge o pico. Você pode sentir maior disposição física e libido elevada.";
    } else if (currentDay <= averageCycleLength) {
        phaseName.textContent = "Fase Lútea";
        phaseDesc.textContent = "A progesterona está alta para preparar o útero. Você pode sentir retenção de líquido ou sintomas de TPM. Pratique exercícios leves.";
    } else {
        const delayedDays = currentDay - averageCycleLength;
        phaseName.textContent = "Atrasada / Novo Ciclo";
        phaseDesc.textContent = `Ciclo atrasado por ${delayedDays} dia(s). Se houver fluxo hoje, salve os sintomas para iniciar um novo ciclo no calendário.`;
    }
}

// --- EVENT SETUP ---
function setupSimulatorEvents() {
    // Navigation of calendar
    calPrev.addEventListener('click', () => {
        calDate.setMonth(calDate.getMonth() - 1);
        renderCalendar();
    });

    calNext.addEventListener('click', () => {
        calDate.setMonth(calDate.getMonth() + 1);
        renderCalendar();
    });

    // Toggle security card visibility
    toggleSecBtn.addEventListener('click', () => {
        if (currentCryptoMode === 'encrypted') {
            if (confirm("Deseja desativar o modo criptografado? Seus dados serão descriptografados e salvos em texto aberto no seu navegador.")) {
                currentCryptoMode = 'anonymous';
                activeKey = null;
                activeSalt = null;
                localStorage.removeItem('femtech_cycle_logs_enc');
                localStorage.setItem('femtech_cycle_logs_anon', JSON.stringify(cycleLogs));
                updateSecurityUI(false);
                showToast("Modo Zero-Knowledge desativado. Dados salvos de forma anônima padrão.");
            }
        } else {
            // Generate seed phrase for show
            const seed = Array.from({ length: 12 }, () => seedWords[Math.floor(Math.random() * seedWords.length)]).join(' ');
            seedBox.textContent = seed;
            
            cryptoCard.style.display = 'block';
            toggleSecBtn.style.display = 'none';
        }
    });

    cancelCryptoBtn.addEventListener('click', () => {
        cryptoCard.style.display = 'none';
        toggleSecBtn.style.display = 'block';
        masterPwdInput.value = '';
    });

    confirmCryptoBtn.addEventListener('click', () => {
        const pwd = masterPwdInput.value;
        if (pwd.length < 6) {
            alert("A senha precisa ter no mínimo 6 caracteres.");
            return;
        }
        
        // Activate encryption
        encryptDataWithPassword(pwd);
        
        cryptoCard.style.display = 'none';
        toggleSecBtn.style.display = 'block';
        masterPwdInput.value = '';
    });

    // Save Daily Symptoms
    symptomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const log = {
            flow: flowSelect.value,
            cramps: crampsSelect.value,
            mood: moodSelect.value,
            bbt: parseFloat(bbtInput.value) || 36.5,
            notes: notesInput.value.trim()
        };

        cycleLogs[selectedDate] = log;

        // Persist data
        if (currentCryptoMode === 'encrypted' && activeKey) {
            // Re-encrypt whole database
            try {
                const enc = new TextEncoder();
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const ciphertextBuffer = await crypto.subtle.encrypt(
                    { name: "AES-GCM", iv: iv },
                    activeKey,
                    enc.encode(JSON.stringify(cycleLogs))
                );

                const hexCipher = Array.from(new Uint8Array(ciphertextBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                const hexIv = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
                const hexSalt = Array.from(activeSalt).map(b => b.toString(16).padStart(2, '0')).join('');

                const encDb = { ciphertext: hexCipher, iv: hexIv, salt: hexSalt };
                localStorage.setItem('femtech_cycle_logs_enc', JSON.stringify(encDb));
            } catch (err) {
                console.error("Saving encrypted error:", err);
            }
        } else {
            localStorage.setItem('femtech_cycle_logs_anon', JSON.stringify(cycleLogs));
        }

        renderCalendar();
        updatePhasePrediction();
        showToast(`Dados de sintomas para o dia ${selectedDate.split('-')[2]} salvos localmente!`);
    });

    // Hard Delete
    hardDeleteBtn.addEventListener('click', () => {
        if (confirm("⚠️ ATENÇÃO: Isso apagará PERMANENTEMENTE todos os seus registros de ciclo e chaves de criptografia salvas neste navegador. Esta ação NÃO pode ser desfeita. Deseja continuar?")) {
            localStorage.removeItem('femtech_cycle_logs_anon');
            localStorage.removeItem('femtech_cycle_logs_enc');
            cycleLogs = {};
            currentCryptoMode = 'anonymous';
            activeKey = null;
            activeSalt = null;
            
            updateSecurityUI(false);
            renderCalendar();
            updatePhasePrediction();
            showToast("Todos os dados locais foram deletados com sucesso.");
        }
    });

    // LGPD Consent Save
    saveConsentBtn.addEventListener('click', () => {
        localStorage.setItem('femtech_consent_metrics', consentMetrics.checked);
        localStorage.setItem('femtech_consent_personalization', consentPersonalization.checked);
        
        showToast("Suas preferências de privacidade foram gravadas em cookie essencial.");
    });

    // Medical PDF Export (Simulated via Print Window layout for full offline/zero-knowledge compliance)
    exportPdfBtn.addEventListener('click', () => {
        if (Object.keys(cycleLogs).length === 0) {
            alert("Adicione registros no calendário para poder exportar um relatório médico.");
            return;
        }

        const printWindow = window.open('', '_blank');
        
        let reportHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório Ginecológico - Exportação Local de Saúde</title>
                <style>
                    body { font-family: sans-serif; color: #1f2937; padding: 40px; }
                    h1 { color: #581c87; border-bottom: 2px solid #581c87; padding-bottom: 10px; }
                    .meta { margin-bottom: 30px; font-size: 0.9em; color: #4b5563; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #d1d5db; padding: 12px; text-align: left; }
                    th { background-color: #f3f4f6; color: #111827; }
                    tr:nth-child(even) { background-color: #f9fafb; }
                    .footer { margin-top: 50px; font-size: 0.8em; text-align: center; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                </style>
            </head>
            <body>
                <h1>Relatório de Saúde Ginecológica</h1>
                <div class="meta">
                    <p><strong>Gerado em:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    <p><strong>Status de Criptografia:</strong> ${currentCryptoMode === 'encrypted' ? 'Criptografado Ponta a Ponta (Zero-Knowledge)' : 'Modo Anônimo Sem Contas'}</p>
                    <p><em>Este relatório foi gerado localmente em seu navegador e nenhum dado de ciclo transitou por servidores de nuvem.</em></p>
                </div>
                <h3>Histórico de Sintomas e Ciclos</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Fluxo Menstrual</th>
                            <th>Cólica</th>
                            <th>Humor</th>
                            <th>Temp. Basal (BBT)</th>
                            <th>Notas Adicionais</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const sortedKeys = Object.keys(cycleLogs).sort((a,b) => new Date(a) - new Date(b));
        sortedKeys.forEach(dateStr => {
            const [y, m, d] = dateStr.split('-');
            const log = cycleLogs[dateStr];
            
            const flowMap = { none: 'Nenhum', light: 'Leve', medium: 'Médio', heavy: 'Forte' };
            const crampMap = { none: 'Nenhuma', light: 'Leve', medium: 'Moderada', heavy: 'Intensa' };
            const moodMap = { balanced: 'Equilibrado', happy: 'Feliz', irritable: 'Irritada', sensitive: 'Sensível', sad: 'Triste' };
            
            reportHtml += `
                <tr>
                    <td><strong>${d}/${m}/${y}</strong></td>
                    <td>${flowMap[log.flow] || log.flow}</td>
                    <td>${crampMap[log.cramps] || log.cramps}</td>
                    <td>${moodMap[log.mood] || log.mood}</td>
                    <td>${log.bbt ? log.bbt + ' °C' : '--'}</td>
                    <td>${log.notes || '--'}</td>
                </tr>
            `;
        });

        reportHtml += `
                    </tbody>
                </table>
                <div class="footer">
                    <p>Relatório de Saúde Pessoal - Protegido por leis de privacidade de dados sensíveis (LGPD Art 5 e GDPR Art 9).</p>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(reportHtml);
        printWindow.document.close();
    });
}

