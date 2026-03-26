// ==========================================
// GAME STATE
// ==========================================
let state = {
    companyName: "", // NEW: Branding
    code: 0,
    totalClicks: 0,
    runCode: 0, 
    stockOptions: 0, 
    unlockedAchievements: [], 
    lastSaveTime: Date.now(),
    adMultiplier: 1, 
    adMultiplierEndTime: 0,
    clickUpgrades: { // NEW: Permanent Click Scalers
        mechKeyboard: { purchased: false, name: "Mechanical Keyboard", desc: "+10% Click Power", cost: 500, mult: 1.10, icon: "fas fa-keyboard" },
        ergonomicChair: { purchased: false, name: "Ergonomic Chair", desc: "+25% Click Power", cost: 5000, mult: 1.25, icon: "fas fa-chair" },
        energyDrinkFr: { purchased: false, name: "Energy Drink Fridge", desc: "+50% Click Power", cost: 25000, mult: 1.50, icon: "fas fa-bolt" }
    },
    upgrades: {
        intern: { count: 0, baseCost: 15, costMultiplier: 1.15, baseProduction: 1 },
        junior: { count: 0, baseCost: 100, costMultiplier: 1.15, baseProduction: 5 },
        senior: { count: 0, baseCost: 1100, costMultiplier: 1.15, baseProduction: 50 },
        ai: { count: 0, baseCost: 12000, costMultiplier: 1.15, baseProduction: 400 },
        datacenter: { count: 0, baseCost: 130000, costMultiplier: 1.15, baseProduction: 2500 }
    }
};

const upgradesInfo = {
    intern: { name: "Intern", desc: "Writes code... slowly.", icon: "fas fa-coffee" },
    junior: { name: "Junior Dev", desc: "Copy-pastes from StackOverflow.", icon: "fas fa-user-tie" },
    senior: { name: "Senior Dev", desc: "Actually understands the architecture.", icon: "fas fa-laptop-code" },
    ai: { name: "AI Assistant", desc: "Writes code faster than humans.", icon: "fas fa-robot" },
    datacenter: { name: "Data Center", desc: "Compiles code instantly.", icon: "fas fa-server" }
};

const achievementsData = [
    { id: 'click_1', name: "Hello World", desc: "Write your first line of code.", threshold: 1, type: 'code' },
    { id: 'code_1k', name: "Getting Started", desc: "Accumulate 1,000 lines.", threshold: 1000, type: 'code' },
    { id: 'code_1m', name: "Millionaire", desc: "Accumulate 1,000,000 lines.", threshold: 1000000, type: 'code' },
    { id: 'code_100m', name: "Superstar", desc: "Accumulate 100,000,000 lines.", threshold: 100000000, type: 'code' },
    { id: 'code_1b', name: "Billionaire", desc: "Accumulate 1,000,000,000 lines.", threshold: 1000000000, type: 'code' },
    
    { id: 'intern_10', name: "Coffee Run", desc: "Hire 10 Interns.", threshold: 10, type: 'building', target: 'intern' },
    { id: 'intern_50', name: "Sweatshop", desc: "Hire 50 Interns.", threshold: 50, type: 'building', target: 'intern' },
    { id: 'junior_25', name: "StackOverflow DDoS", desc: "Hire 25 Junior Devs.", threshold: 25, type: 'building', target: 'junior' },
    { id: 'senior_10', name: "Brain Trust", desc: "Hire 10 Senior Devs.", threshold: 10, type: 'building', target: 'senior' },
    { id: 'datacenter', name: "Cloud Native", desc: "Deploy your first Data Center.", threshold: 1, type: 'building', target: 'datacenter' },
    
    { id: 'ipo_1', name: "Early Exit", desc: "Launch an IPO and prestige.", threshold: 1, type: 'prestige' },
    { id: 'ipo_100', name: "Serial Entrepreneur", desc: "Acquire 100 Stock Options.", threshold: 100, type: 'prestige' },
    { id: 'ipo_1000', name: "Market Dominator", desc: "Acquire 1,000 Stock Options.", threshold: 1000, type: 'prestige' }
];

// ==========================================
// DOM ELEMENTS
// ==========================================
const codeDisplay = document.getElementById('code-count');
const cpsDisplay = document.getElementById('cps-count');
const mainButton = document.getElementById('main-button');
const upgradesContainer = document.getElementById('upgrades-container');
const ipoContainer = document.getElementById('ipo-container');
const clickArea = document.getElementById('click-area');
const rewardedBtn = document.getElementById('rewarded-ad-btn');
const adActiveTag = document.getElementById('ad-active-tag');
const companyNameDisplay = document.getElementById('company-name-display');

// Header & Modals
const btnTrophies = document.getElementById('btn-trophies');
const btnSettings = document.getElementById('btn-settings');
const btnLeaderboard = document.getElementById('btn-leaderboard');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

let bugTimer = Math.random() * 60000 + 40000; 

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    loadGame();
    
    // First time setup
    if (!state.companyName || state.companyName === "") {
        let n = prompt("Welcome CEO! What is the name of your new Tech Startup?");
        state.companyName = n && n.trim() !== "" ? n.trim() : "Untitled Corp";
        saveGame();
    }
    companyNameDisplay.innerHTML = `<i class="fas fa-terminal"></i> ${state.companyName}`;

    calculateOfflineProgress();
    renderUpgrades();
    updateDisplay();
    
    setInterval(gameLoop, 1000 / 30);
    setInterval(saveGame, 10000);
}

// ==========================================
// CORE MECHANICS
// ==========================================
function getClickPower() {
    // Dynamic Scaler
    let baseClick = 1 + (getCPS() * 0.05); 
    // Permanent Upgrades
    for (const key in state.clickUpgrades) {
        if (state.clickUpgrades[key].purchased) {
            baseClick *= state.clickUpgrades[key].mult;
        }
    }
    // Prestige Multiplier
    let prestigeMultiplier = 1 + ((state.stockOptions || 0) * 0.10);
    return baseClick * state.adMultiplier * prestigeMultiplier;
}

mainButton.addEventListener('pointerdown', (e) => {
    e.preventDefault(); 
    
    let clickPower = getClickPower();
    state.code += clickPower;
    state.runCode = (state.runCode || 0) + clickPower;
    state.totalClicks++;
    
    const rect = mainButton.getBoundingClientRect();
    const x = (e.clientX !== undefined) ? e.clientX : (rect.left + rect.width / 2);
    const y = (e.clientY !== undefined) ? e.clientY : (rect.top + rect.height / 2);

    createFloatingText(x, y, `+${Math.floor(clickPower)}`);
    updateDisplay();
});

function createFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = text;
    const jitterX = (Math.random() - 0.5) * 60;
    const jitterY = (Math.random() - 0.5) * 60;
    el.style.left = `${x + jitterX}px`;
    el.style.top = `${y + jitterY}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function getCost(upgradeId) {
    const upgrade = state.upgrades[upgradeId];
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.count));
}

function getCPS() {
    let cps = 0;
    for (const [id, upgrade] of Object.entries(state.upgrades)) {
        cps += upgrade.count * upgrade.baseProduction;
    }
    let prestigeMultiplier = 1 + ((state.stockOptions || 0) * 0.10);
    return cps * state.adMultiplier * prestigeMultiplier;
}

function buyUpgrade(upgradeId) {
    const cost = getCost(upgradeId);
    if (state.code >= cost) {
        state.code -= cost;
        state.upgrades[upgradeId].count++;
        renderUpgrades();
        updateDisplay();
    }
}

window.buyClickUpgrade = function(upgradeId) {
    const upgrade = state.clickUpgrades[upgradeId];
    if (!upgrade.purchased && state.code >= upgrade.cost) {
        state.code -= upgrade.cost;
        upgrade.purchased = true;
        renderUpgrades();
        updateDisplay();
    }
}

// ==========================================
// RANDOM EVENT (Golden Bug)
// ==========================================
function spawnBug() {
    const bug = document.createElement('div');
    bug.className = 'golden-bug';
    bug.innerHTML = '<i class="fas fa-bug"></i>';
    bug.style.top = Math.random() * 70 + 15 + '%';
    bug.style.left = '-100px';
    document.body.appendChild(bug);

    let pos = -100;
    let speed = Math.random() * 2 + 1.5; 

    const interval = setInterval(() => {
        pos += speed;
        if(bug) bug.style.left = pos + 'px';
        if (pos > window.innerWidth + 100) {
            if(bug && bug.parentNode) bug.remove();
            clearInterval(interval);
        }
    }, 20);

    bug.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        const reward = Math.max(getCPS() * 120, 100); 
        state.code += reward;
        state.runCode += reward;
        
        showToast("Bug Squashed!", `You salvaged ${Math.floor(reward).toLocaleString()} lines of code!`, "fas fa-medal");
        createFloatingText(e.clientX, e.clientY, `+${Math.floor(reward).toLocaleString()}`);
        
        bug.style.transform = "scale(2)";
        bug.style.opacity = "0";
        setTimeout(() => bug.remove(), 200);
        clearInterval(interval);
        updateDisplay();
    });
}

// ==========================================
// PRESTIGE & ACHIEVEMENTS
// ==========================================
window.doPrestige = function(earnedOptions) {
    if (confirm(`Are you sure you want to Launch your IPO?\n\nYou will sell your startup, losing all current Code and Developers, but gain ${earnedOptions} Stock Options which permanently increase all production by ${earnedOptions * 10}%.`)) {
        state.stockOptions = (state.stockOptions || 0) + earnedOptions;
        state.code = 0;
        state.runCode = 0; 
        for (let key in state.upgrades) {
             state.upgrades[key].count = 0; 
        }
        for (let key in state.clickUpgrades) {
             state.clickUpgrades[key].purchased = false; // Reset click upgrades
        }
        showToast("IPO Successful!", `You acquired ${earnedOptions} Stock Options!`, "fas fa-star");
        saveGame();
        renderUpgrades();
        updateDisplay();
    }
}

function showToast(title, desc, icon="fas fa-trophy") {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <div class="toast-icon"><i class="${icon}"></i></div>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${desc}</p>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function checkAchievements() {
    state.unlockedAchievements = state.unlockedAchievements || [];
    let newlyUnlocked = false;
    for (const ach of achievementsData) {
        if (!state.unlockedAchievements.includes(ach.id)) {
            let unlocked = false;
            if (ach.type === 'code' && (state.runCode || 0) >= ach.threshold) unlocked = true;
            if (ach.type === 'building' && state.upgrades[ach.target].count >= ach.threshold) unlocked = true;
            if (ach.type === 'prestige' && (state.stockOptions || 0) >= ach.threshold) unlocked = true;
            
            if (unlocked) {
                state.unlockedAchievements.push(ach.id);
                showToast("Achievement Unlocked!", ach.name);
                newlyUnlocked = true;
            }
        }
    }
    if (newlyUnlocked && modalOverlay.style.display === 'flex' && modalTitle.innerText === 'Trophies') {
        renderTrophies();
    }
}

// ==========================================
// RENDER & UPDATE
// ==========================================
function renderUpgrades() {
    upgradesContainer.innerHTML = '';
    
    // 1. One Time Click Upgrades
    for (const [id, upgrade] of Object.entries(state.clickUpgrades || {})) {
        if (!upgrade.purchased) {
            const canAfford = state.code >= upgrade.cost;
            const div = document.createElement('div');
            div.className = `upgrade-item ${canAfford ? '' : 'disabled'}`;
            div.style.borderColor = "var(--success-color)";
            div.onclick = () => canAfford && buyClickUpgrade(id);
            div.innerHTML = `
                <div class="upgrade-info" style="width:100%;">
                    <h3 style="color:var(--success-color);"><i class="${upgrade.icon}" style="width:24px; text-align:center; margin-right:8px;"></i>${upgrade.name}</h3>
                    <p>${upgrade.desc} (Permanent)</p>
                    <div style="text-align:right;"><span class="cost-amount" style="background:rgba(63, 185, 80, 0.1); color:var(--success-color);"><i class="fas fa-code"></i> ${upgrade.cost.toLocaleString()}</span></div>
                </div>
            `;
            upgradesContainer.appendChild(div);
        }
    }

    // 2. Generators
    for (const [id, info] of Object.entries(upgradesInfo)) {
        const upgrade = state.upgrades[id];
        const cost = getCost(id);
        const canAfford = state.code >= cost;
        
        const div = document.createElement('div');
        div.className = `upgrade-item ${canAfford ? '' : 'disabled'}`;
        div.onclick = () => canAfford && buyUpgrade(id);
        
        let prestigeMultiplier = 1 + ((state.stockOptions || 0) * 0.10);
        let currentProd = upgrade.baseProduction * state.adMultiplier * prestigeMultiplier;

        div.innerHTML = `
            <div class="upgrade-info">
                <h3><i class="${info.icon}" style="width:24px; text-align:center; margin-right:8px;"></i>${info.name}</h3>
                <p>+${currentProd.toLocaleString()} lines/sec</p>
                <span class="cost-amount"><i class="fas fa-code"></i> ${cost.toLocaleString()}</span>
            </div>
            <div class="owned-amount">${upgrade.count}</div>
        `;
        upgradesContainer.appendChild(div);
    }
}

function updateDisplay() {
    codeDisplay.innerText = Math.floor(state.code).toLocaleString();
    
    let textBonus = state.stockOptions > 0 ? `<br><span style="font-size:0.75rem; color:gold;"><i class="fas fa-rocket"></i> +${(state.stockOptions*10)}% IPO Bonus Active</span>` : '';
    cpsDisplay.innerHTML = `${getCPS().toLocaleString()} lines / second` + textBonus;
    
    // We re-render full upgrades only if absolutely necessary, else we just toggle .disabled classes
    // Note: Since Click Upgrades pop in and out, if someone affords one, we can just strip .disabled.
    // Buying one re-renders everything. So we are fine just iterating children.
    const upgradeItems = upgradesContainer.children;
    for (let div of upgradeItems) {
        // parse the cost from the elements
        const costEl = div.querySelector('.cost-amount');
        if (costEl) {
            const num = parseInt(costEl.innerText.replace(/,/g, ''), 10);
            if (!isNaN(num)) {
                if (state.code >= num) {
                    div.classList.remove('disabled');
                } else {
                    div.classList.add('disabled');
                }
            }
        }
    }

    if (!state.runCode) state.runCode = state.code;
    const optionsEarned = Math.floor(Math.sqrt(state.runCode / 25000)); 
    
    if (window.currentPrestigeOptions !== optionsEarned) {
        window.currentPrestigeOptions = optionsEarned;
        if (optionsEarned >= 1) {
            ipoContainer.innerHTML = `
                <div class="upgrade-item prestige-btn" onclick="doPrestige(${optionsEarned})">
                    <div class="upgrade-info" style="width: 100%; text-align: center;">
                        <h3 style="color: gold; margin-bottom: 5px;"><i class="fas fa-rocket"></i> Launch IPO (Prestige)</h3>
                        <p>Sell the company for <strong style="color:#fff; font-size:1.1rem; text-shadow: 0 0 5px gold;">${optionsEarned} Stock Options</strong>!</p>
                    </div>
                </div>
            `;
        } else {
            ipoContainer.innerHTML = '';
        }
    }

    if (state.adMultiplierEndTime > Date.now()) {
        state.adMultiplier = 2;
        rewardedBtn.style.display = 'none';
        adActiveTag.style.display = 'block';
        const remainingStr = Math.ceil((state.adMultiplierEndTime - Date.now()) / 1000 / 60);
        adActiveTag.innerHTML = `<i class="fas fa-fire"></i> 2x Production Active! (${remainingStr}m left)`;
    } else {
        if(state.adMultiplier !== 1) {
            state.adMultiplier = 1;
            renderUpgrades(); 
        }
        rewardedBtn.style.display = 'flex';
        adActiveTag.style.display = 'none';
    }

    checkAchievements();
}

let lastTime = Date.now();
function gameLoop() {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    
    const cps = getCPS();
    if (cps > 0) {
        let added = cps * dt;
        state.code += added;
        state.runCode = (state.runCode || 0) + added;
        updateDisplay();
    }
    
    bugTimer -= dt * 1000;
    if (bugTimer <= 0) {
        spawnBug();
        bugTimer = Math.random() * 60000 + 40000; 
    }
}

// ==========================================
// SAVE & LOAD (localStorage)
// ==========================================
function saveGame() {
    state.lastSaveTime = Date.now();
    localStorage.setItem('startupClickerSave', JSON.stringify(state));
}

function loadGame() {
    const save = localStorage.getItem('startupClickerSave');
    if (save) {
        try {
            const parsed = JSON.parse(save);
            state = { ...state, ...parsed, upgrades: { ...state.upgrades }, clickUpgrades: { ...(state.clickUpgrades||{}) } };
            // Deep merge Generators
            for (const key in state.upgrades) {
                if (parsed.upgrades && parsed.upgrades[key]) {
                    state.upgrades[key] = { ...state.upgrades[key], ...parsed.upgrades[key] };
                }
            }
            // Deep merge Click Upgrades
            for (const key in state.clickUpgrades) {
                if (parsed.clickUpgrades && parsed.clickUpgrades[key] !== undefined) {
                    state.clickUpgrades[key] = { ...state.clickUpgrades[key], ...parsed.clickUpgrades[key] };
                }
            }
            if(!state.runCode) state.runCode = state.code;
        } catch (e) {
            console.error("Save file read error", e);
        }
    }
}

function calculateOfflineProgress() {
    const now = Date.now();
    const dt = (now - state.lastSaveTime) / 1000;
    const cappedDt = Math.min(dt, 86400); 
    
    const cps = getCPS();
    if (cps > 0 && cappedDt > 10) { 
        const offlineGains = cps * cappedDt;
        state.code += offlineGains;
        state.runCode = (state.runCode || 0) + offlineGains;
        setTimeout(() => {
            alert(`Welcome back to ${state.companyName}!\n\nWhile you were away, your team wrote ${Math.floor(offlineGains).toLocaleString()} lines of code!`);
        }, 500);
    }
    state.lastSaveTime = now;
}

// ==========================================
// MODALS AND MENUS
// ==========================================
function openModal(title, internalHTML) {
    modalTitle.innerText = title;
    modalBody.innerHTML = internalHTML;
    modalOverlay.style.display = 'flex';
}
modalClose.addEventListener('click', () => modalOverlay.style.display = 'none');

// 1. Settings (File blobs)
btnSettings.addEventListener('click', () => {
    let html = `
        <div style="display:flex; flex-direction:column; gap: 15px;">
            <p style="color:var(--text-muted);">Manage your game configuration and save files natively.</p>
            <div style="display:flex; gap: 10px;">
                <button onclick="exportSaveUI()" class="header-btn" style="flex:1; background:#238636; border:none; color:white; padding:10px;"><i class="fas fa-download"></i> Save to File</button>
                <button onclick="importSaveUI()" class="header-btn" style="flex:1; background:#1f6feb; border:none; color:white; padding:10px;"><i class="fas fa-upload"></i> Load File</button>
            </div>
            <p id="save-msg" style="color:var(--success-color); font-size:0.9rem; text-align:center; height:15px; margin:0;"></p>
            <hr style="border-color:var(--border-color); margin: 5px 0;">
            <button onclick="hardReset()" class="rewarded-ad-btn" style="background:#da3633; border:none; padding:10px;"><i class="fas fa-skull"></i> Hard Reset (Wipe All)</button>
        </div>
    `;
    openModal("Settings", html);
});

window.exportSaveUI = function() {
    saveGame();
    const saveStr = localStorage.getItem('startupClickerSave');
    const blob = new Blob([saveStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.getElementById('download-anchor');
    a.href = url;
    a.download = `${state.companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_save.json`;
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('save-msg').innerText = "Game file generated and downloaded!";
    document.getElementById('save-msg').style.color = "var(--success-color)";
}

window.importSaveUI = function() {
    document.getElementById('file-import').click();
}

window.handleFileImport = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            JSON.parse(data); 
            localStorage.setItem('startupClickerSave', data);
            document.getElementById('save-msg').innerText = "Import successful! Reloading...";
            document.getElementById('save-msg').style.color = "var(--success-color)";
            setTimeout(() => location.reload(), 500);
        } catch (err) {
            document.getElementById('save-msg').innerText = "Invalid or Corrupted JSON file!";
            document.getElementById('save-msg').style.color = "#da3633";
        }
    };
    reader.readAsText(file);
}

window.hardReset = function() {
    if (confirm("WARNING: This will absolutely wipe EVERYTHING! Are you positive?")) {
        localStorage.removeItem('startupClickerSave');
        location.reload();
    }
}

// 2. Leaderboard Mock (Local Only)
btnLeaderboard.addEventListener('click', () => {
    let html = `
        <div style="text-align:center;">
            <p style="color:var(--text-muted); margin-bottom:20px; line-height:1.4;">Top Stock Options Acquired<br><span style="font-size:0.8rem;">(Currently shows Local Runs offline metrics.<br>Firebase Global Online Scoreboard integration required to populate Global data).</span></p>
            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:8px; padding:20px; text-align:left;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #30363d; padding-bottom:10px; margin-bottom:15px; font-weight:bold; color:#fff;">
                    <span style="flex:1;">Rank</span>
                    <span style="flex:2;">Company</span>
                    <span style="flex:1; text-align:right;">Options</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:5px 0;">
                    <span style="color:gold; flex:1;"><i class="fas fa-crown"></i> 1st</span>
                    <span style="flex:2;">${state.companyName || 'You'}</span>
                    <span style="color:gold; flex:1; text-align:right;">${(state.stockOptions || 0).toLocaleString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:5px 0; color:#8b949e;">
                    <span style="flex:1;">2nd</span>
                    <span style="flex:2;">Macrohard Inc</span>
                    <span style="flex:1; text-align:right;">4,500</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:5px 0; color:#8b949e;">
                    <span style="flex:1;">3rd</span>
                    <span style="flex:2;">Pied Piper</span>
                    <span style="flex:1; text-align:right;">1,200</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:5px 0; color:#8b949e;">
                    <span style="flex:1;">4th</span>
                    <span style="flex:2;">Initech</span>
                    <span style="flex:1; text-align:right;">400</span>
                </div>
            </div>
        </div>
    `;
    openModal("Leaderboard", html);
});

// 3. Trophies Menu
btnTrophies.addEventListener('click', () => renderTrophies());

function renderTrophies() {
    let unlk = state.unlockedAchievements.length;
    let tot = achievementsData.length;
    let html = `<p style="text-align:center; color:gold; margin-bottom:15px;">Completed: ${unlk} / ${tot}</p><div class="trophy-grid" style="max-height:50vh; overflow-y:auto; padding-right:10px;">`;
    for (const ach of achievementsData) {
        const unlocked = state.unlockedAchievements.includes(ach.id);
        html += `
            <div class="trophy-item ${unlocked ? 'unlocked' : 'locked'}">
                <div class="trophy-icon"><i class="${unlocked ? 'fas fa-trophy' : 'fas fa-lock'}"></i></div>
                <div class="trophy-info">
                    <strong>${unlocked ? ach.name : '???'}</strong>
                    <p>${unlocked ? ach.desc : 'Keep operating to unlock!'}</p>
                </div>
            </div>
        `;
    }
    html += `</div>`;
    openModal("Trophies", html);
}

// ==========================================
// MONETIZATION HOOKS
// ==========================================
rewardedBtn.addEventListener('click', () => {
    const adsSDK = confirm("MOCK AD SDK: Watch this 30s ad to DOUBLE your production for 10 minutes?");
    if (adsSDK) {
        state.adMultiplierEndTime = Date.now() + (10 * 60 * 1000);
        state.adMultiplier = 2;
        updateDisplay();
        renderUpgrades(); 
        saveGame();
    }
});

// Init is called here
init();
