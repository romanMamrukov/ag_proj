// ==========================================
// SUPABASE & GAME STATE
// ==========================================
const supabaseUrl = 'https://buzexmhklqhkpsrgysfq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emV4bWhrbHFoa3Bzcmd5c2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDAzODYsImV4cCI6MjA5MDExNjM4Nn0.gQQg4A53lJOO-mRb_mmkBjGW-QfTDrrE98_d329WF6U';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function syncScoreboard() {
    if ((state.stockOptions || 0) > 0 && state.companyName) {
        try {
            const { data, error: fetchErr } = await supabaseClient.from('leaderboard').select('stock_options').eq('company_name', state.companyName).limit(1);
            if (fetchErr) console.error('Supabase Fetch Error:', fetchErr.message || fetchErr);
            
            if (data && data.length > 0) {
                if (state.stockOptions > data[0].stock_options) {
                    const { error: updErr } = await supabaseClient.from('leaderboard').update({ stock_options: state.stockOptions }).eq('company_name', state.companyName);
                    if (updErr) console.error('Supabase Update Error:', updErr.message || updErr);
                }
            } else {
                const { error: insErr } = await supabaseClient.from('leaderboard').insert([{ company_name: state.companyName, stock_options: state.stockOptions }]);
                if (insErr) console.error('Supabase Insert Error:', insErr.message || insErr);
            }
        } catch(e) {
            console.error('Supabase General Error:', e.message || e);
        }
    }
}

function formatNumber(num) {
    if (num < 1000) return Math.floor(num).toString();
    const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
    const suffixIndex = Math.floor(Math.log10(Math.max(1, num)) / 3);
    const shortValue = num / Math.pow(1000, suffixIndex);
    return shortValue.toFixed(2).replace(/\.00$/, '') + suffixes[suffixIndex];
}

let state = {
    companyName: "",
    playerId: "",
    playtimeSeconds: 0,
    code: 0,
    totalClicks: 0,
    runCode: 0, 
    stockOptions: 0, 
    unlockedAchievements: [], 
    tutorialComplete: false,
    lastSaveTime: Date.now(),
    adMultiplier: 1, 
    adMultiplierEndTime: 0,
    clickUpgrades: {
        mechKeyboard: { purchased: false, name: "Mechanical Keyboard", desc: "+10% Click Power", cost: 500, mult: 1.10, icon: "fas fa-keyboard" },
        ergonomicChair: { purchased: false, name: "Ergonomic Chair", desc: "+25% Click Power", cost: 5000, mult: 1.25, icon: "fas fa-chair" },
        energyDrinkFr: { purchased: false, name: "Energy Drink Fridge", desc: "+50% Click Power", cost: 25000, mult: 1.50, icon: "fas fa-bolt" }
    },
    upgrades: {
        intern: { count: 0, baseCost: 15, costMultiplier: 1.15, baseProduction: 1 },
        junior: { count: 0, baseCost: 100, costMultiplier: 1.15, baseProduction: 5 },
        senior: { count: 0, baseCost: 1100, costMultiplier: 1.15, baseProduction: 50 },
        ai: { count: 0, baseCost: 12000, costMultiplier: 1.15, baseProduction: 400 },
        datacenter: { count: 0, baseCost: 130000, costMultiplier: 1.15, baseProduction: 2500 },
        quantum: { count: 0, baseCost: 1500000000, costMultiplier: 1.15, baseProduction: 18000 },
        vcfirm: { count: 0, baseCost: 45000000000, costMultiplier: 1.15, baseProduction: 120000 }
    }
};

const upgradesInfo = {
    intern: { name: "Intern", desc: "Writes code... slowly.", icon: "fas fa-coffee" },
    junior: { name: "Junior Dev", desc: "Copy-pastes from StackOverflow.", icon: "fas fa-user-tie" },
    senior: { name: "Senior Dev", desc: "Actually understands the architecture.", icon: "fas fa-laptop-code" },
    ai: { name: "AI Assistant", desc: "Writes code faster than humans.", icon: "fas fa-robot" },
    datacenter: { name: "Data Center", desc: "Compiles code instantly.", icon: "fas fa-server" },
    quantum: { name: "Quantum Computer", desc: "Calculates every possible bug instantly.", icon: "fas fa-microchip" },
    vcfirm: { name: "VC Firm", desc: "Acquires smaller startups for automated code injection.", icon: "fas fa-building" }
};

const achievementsData = [
    { id: 'click_1', name: "Hello World", desc: "Write your first line of code.", threshold: 1, type: 'code' },
    { id: 'code_1k', name: "Getting Started", desc: "Accumulate 1K lines.", threshold: 1000, type: 'code' },
    { id: 'code_1m', name: "Millionaire", desc: "Accumulate 1M lines.", threshold: 1000000, type: 'code' },
    { id: 'code_1b', name: "Billionaire", desc: "Accumulate 1B lines.", threshold: 1000000000, type: 'code' },
    { id: 'intern_10', name: "Coffee Run", desc: "Hire 10 Interns.", threshold: 10, type: 'building', target: 'intern' },
    { id: 'intern_50', name: "Sweatshop", desc: "Hire 50 Interns.", threshold: 50, type: 'building', target: 'intern' },
    { id: 'junior_25', name: "StackOverflow DDoS", desc: "Hire 25 Junior Devs.", threshold: 25, type: 'building', target: 'junior' },
    { id: 'senior_10', name: "Brain Trust", desc: "Hire 10 Senior Devs.", threshold: 10, type: 'building', target: 'senior' },
    { id: 'datacenter', name: "Cloud Native", desc: "Deploy your first Data Center.", threshold: 1, type: 'building', target: 'datacenter' },
    { id: 'quantum', name: "Superposition", desc: "Deploy your first Quantum Computer.", threshold: 1, type: 'building', target: 'quantum' },
    { id: 'vcfirm', name: "Unicorn Status", desc: "Found a VC Firm.", threshold: 1, type: 'building', target: 'vcfirm' },
    { id: 'ipo_1', name: "Early Exit", desc: "Launch an IPO and prestige.", threshold: 1, type: 'prestige' },
    { id: 'ipo_100', name: "Serial Entrepreneur", desc: "Acquire 100 Stock Options.", threshold: 100, type: 'prestige' }
];

// ==========================================
// DOM ELEMENTS
// ==========================================
const codeDisplay = document.getElementById('code-count');
const cpsDisplay = document.getElementById('cps-count');
const mainButton = document.getElementById('main-button');
const rewardedBtn = document.getElementById('rewarded-ad-btn');
const adActiveTag = document.getElementById('ad-active-tag');
const companyNameDisplay = document.getElementById('company-name-display');

const btnTrophies = document.getElementById('btn-trophies');
const btnSettings = document.getElementById('btn-settings');
const btnLeaderboard = document.getElementById('btn-leaderboard');
const btnStore = document.getElementById('btn-store');

const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

let bugTimer = Math.random() * 40000 + 30000; 

// ==========================================
// INITIALIZATION
// ==========================================
async function promptForCompanyName() {
    let nameChosen = false;
    while (!nameChosen) {
        let n = prompt("Welcome CEO! What is the name of your new Tech Startup?");
        let chosenName = n && n.trim() !== "" ? n.trim() : "Untitled Corp";
        
        const { data, error } = await supabaseClient.from('players').select('company_name').eq('company_name', chosenName).limit(1);
        
        if (data && data.length > 0) {
            let code = prompt(`The name "${chosenName}" is already registered!\nIf this is your company, enter your Cloud Sync Code to recover your data.\nIf not, leave blank to choose a different name.`);
            if (code && code.trim() !== "") {
                let success = await window.downloadCloudSave(code.trim().toUpperCase(), true);
                if (success) {
                    nameChosen = true;
                } else {
                    alert("Invalid Sync Code. Please try a different company name.");
                }
            }
        } else {
            let newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
            state.companyName = chosenName;
            state.playerId = newId;
            state.playtimeSeconds = 0;
            await supabaseClient.from('players').insert([{
                id: state.playerId,
                company_name: state.companyName,
                playtime_seconds: 0
            }]);
            saveGame();
            nameChosen = true;
        }
    }
}

async function updatePlayerActivity() {
    if (state.playerId) {
        try {
            await supabaseClient.from('players').update({ last_active: new Date().toISOString() }).eq('id', state.playerId);
        } catch(e) {}
    }
}

async function updatePlaytime() {
    if (state.playerId) {
        state.playtimeSeconds = (state.playtimeSeconds || 0) + 60;
        try {
            await supabaseClient.from('players').update({ 
                playtime_seconds: state.playtimeSeconds,
                last_active: new Date().toISOString()
            }).eq('id', state.playerId);
        } catch(e) {}
    }
}

async function init() {
    loadGame();
    
    // Legacy User Backend Migration Fix
    if (state.companyName && state.companyName !== "" && !state.playerId) {
        state.playerId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
        state.playtimeSeconds = 0;
        
        try {
            await supabaseClient.from('players').insert([{
                id: state.playerId,
                company_name: state.companyName,
                playtime_seconds: 0
            }]);
        } catch (e) {
            console.warn("Could not migrate legacy player to database right now.", e);
        }
        saveGame();
    }

    if (!state.companyName || state.companyName === "") {
        await promptForCompanyName();
    } else {
        updatePlayerActivity();
    }
    companyNameDisplay.innerHTML = `<i class="fas fa-terminal"></i> ${state.companyName}`;

    calculateOfflineProgress();
    updateDisplay();
    setInterval(gameLoop, 1000 / 30);
    setInterval(saveGame, 10000);
    setInterval(updatePlaytime, 60000);
}

// ==========================================
// CORE MECHANICS & AUDIO
// ==========================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let noiseBuffer = null;
function createNoiseBuffer() {
    if (!audioCtx) return null;
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}
let isAmbientLoopRunning = false;
function manageAmbientAudio() {
    if(!audioCtx || audioCtx.state !== 'running') return;
    
    let totalEmployees = 0;
    for (const key in state.upgrades) {
        if(key !== 'datacenter' && key !== 'quantum' && key !== 'vcfirm') {
            totalEmployees += state.upgrades[key].count;
        }
    }
    
    if (totalEmployees === 0) {
        setTimeout(manageAmbientAudio, 1000);
        return;
    }
    
    let interval = Math.max(30, 1500 - (totalEmployees * 15));
    const isMech = state.clickUpgrades && state.clickUpgrades.mechKeyboard && state.clickUpgrades.mechKeyboard.purchased;
    
    playSound(isMech ? 'ambient_mech' : 'ambient_click');
    
    let jitter = interval + (Math.random() * interval * 0.4 - interval * 0.2);
    setTimeout(manageAmbientAudio, jitter);
}

function playSound(type) {
    if(!audioCtx) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(!isAmbientLoopRunning && audioCtx.state === 'running' && !type.includes('ambient')) {
        isAmbientLoopRunning = true;
        manageAmbientAudio();
    }

    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);

    if (type.includes('click') || type.includes('mech')) {
        if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter();
        
        const volMult = type.includes('ambient') ? 0.15 : 1.0;
        
        if (type.includes('mech')) {
            filter.type = 'lowpass'; filter.frequency.value = 1000;
            gainNode.gain.setValueAtTime(0.6 * volMult, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
            noiseSource.connect(filter); filter.connect(gainNode);
            noiseSource.start(); noiseSource.stop(audioCtx.currentTime + 0.1);
            
            const osc = audioCtx.createOscillator(); osc.type = 'sine';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);
            const oscGain = audioCtx.createGain();
            oscGain.gain.setValueAtTime(0.4 * volMult, audioCtx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc.connect(oscGain); oscGain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.05);
        } else {
            filter.type = 'highpass'; filter.frequency.value = 1500;
            gainNode.gain.setValueAtTime(0.3 * volMult, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.06);
            noiseSource.connect(filter); filter.connect(gainNode);
            noiseSource.start(); noiseSource.stop(audioCtx.currentTime + 0.06);
            
            const osc = audioCtx.createOscillator(); osc.type = 'square';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.03);
            const oscGain = audioCtx.createGain();
            oscGain.gain.setValueAtTime(0.05 * volMult, audioCtx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
            osc.connect(oscGain); oscGain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.04);
        }
        return;
    }
    
    const osc = audioCtx.createOscillator();
    osc.connect(gainNode);
    if (type === 'buy') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'achievement') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime + 0.3);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.start(); osc.stop(audioCtx.currentTime + 0.8);
    } else if (type === 'error' || type === 'event_missed') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
        
        let delTime = audioCtx.currentTime;
        for(let i=0; i<5; i++) {
            if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
            const nSrc = audioCtx.createBufferSource();
            nSrc.buffer = noiseBuffer;
            const f = audioCtx.createBiquadFilter();
            f.type = 'highpass'; f.frequency.value = 2000;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0.3, delTime);
            g.gain.exponentialRampToValueAtTime(0.01, delTime + 0.05);
            nSrc.connect(f); f.connect(g); g.connect(audioCtx.destination);
            nSrc.start(delTime); nSrc.stop(delTime + 0.05);
            delTime += 0.08;
        }
    } else if (type === 'event_spawn') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'event_caught') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(1760, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    }
}
function getClickPower() {
    let baseClick = 1 + (getCPS() * 0.05); 
    for (const key in state.clickUpgrades) {
        if (state.clickUpgrades[key].purchased) {
            baseClick *= state.clickUpgrades[key].mult;
        }
    }
    let prestigeMultiplier = 1 + ((state.stockOptions || 0) * 0.10);
    return baseClick * state.adMultiplier * prestigeMultiplier;
}

mainButton.addEventListener('pointerdown', (e) => {
    e.preventDefault(); 
    if (state.clickUpgrades && state.clickUpgrades.mechKeyboard && state.clickUpgrades.mechKeyboard.purchased) {
        playSound('mech');
    } else {
        playSound('click');
    }
    let clickPower = getClickPower();
    state.code += clickPower;
    state.runCode = (state.runCode || 0) + clickPower;
    state.totalClicks++;
    
    const rect = mainButton.getBoundingClientRect();
    const x = (e.clientX !== undefined) ? e.clientX : (rect.left + rect.width / 2);
    const y = (e.clientY !== undefined) ? e.clientY : (rect.top + rect.height / 2);

    createFloatingText(x, y, `+${formatNumber(clickPower)}`);
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

window.buyUpgrade = function(upgradeId) {
    const cost = getCost(upgradeId);
    if (state.code >= cost) {
        playSound('buy');
        state.code -= cost;
        state.upgrades[upgradeId].count++;
        updateDisplay();
        renderStore();
    }
}

window.buyClickUpgrade = function(upgradeId) {
    const upgrade = state.clickUpgrades[upgradeId];
    if (!upgrade.purchased && state.code >= upgrade.cost) {
        playSound('buy');
        state.code -= upgrade.cost;
        upgrade.purchased = true;
        updateDisplay();
        renderStore();
    }
}

// ==========================================
// RANDOM EVENT
// ==========================================
function spawnEvent() {
    playSound('event_spawn');
    const isBad = Math.random() > 0.6; // 40% chance of a BAD event
    const bug = document.createElement('div');
    bug.className = 'golden-bug';
    
    if(isBad) {
        bug.innerHTML = '<i class="fas fa-server"></i>';
        bug.style.color = "#da3633";
        bug.style.textShadow = "0 0 15px rgba(218, 54, 51, 0.8)";
    } else {
        bug.innerHTML = '<i class="fas fa-bug"></i>';
        bug.style.color = "gold";
    }

    // Keep bugs in upper/middle area to avoid hiding behind ads and controls
    bug.style.top = Math.random() * 40 + 20 + '%';
    bug.style.left = '-100px';
    document.body.appendChild(bug);

    let pos = -100;
    let speed = Math.random() * 2 + 1.5; 
    let missed = true;

    const interval = setInterval(() => {
        pos += speed;
        if(bug) bug.style.left = pos + 'px';
        if (pos > window.innerWidth + 100) {
            if(bug && bug.parentNode) bug.remove();
            clearInterval(interval);
            
            // PENALTY IF MISSED
            if (isBad && missed) {
                playSound('event_missed');
                const penalty = Math.min((state.code / 2), Math.max(10, getCPS() * 60));
                if (penalty > 0) {
                    state.code -= penalty;
                    showToast("Server Crashed!", `You ignored the failing server and lost ${formatNumber(penalty)} code!`, "fas fa-fire");
                    updateDisplay();
                }
            }
        }
    }, 20);

    bug.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        missed = false; // Successfully caught
        playSound('event_caught');
        
        if (isBad) {
            showToast("Crisis Averted!", "You successfully rebooted the failing server.", "fas fa-shield-alt");
        } else {
            const reward = Math.max(getCPS() * 120, 100); 
            state.code += reward;
            state.runCode += reward;
            showToast("Bug Squashed!", `You salvaged ${formatNumber(reward)} lines of code!`, "fas fa-medal");
            createFloatingText(e.clientX, e.clientY, `+${formatNumber(reward)}`);
        }
        
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
    if (confirm(`Are you sure you want to Launch your IPO?\n\nYou will sell your startup, losing all Code and Developers, but gain ${formatNumber(earnedOptions)} Stock Options which permanently increase all production by ${formatNumber(earnedOptions * 10)}%.`)) {
        state.stockOptions = (state.stockOptions || 0) + earnedOptions;
        state.code = 0;
        state.runCode = 0; 
        for (let key in state.upgrades) {
             state.upgrades[key].count = 0; 
        }
        for (let key in state.clickUpgrades) {
             state.clickUpgrades[key].purchased = false; 
        }
        showToast("IPO Successful!", `You acquired ${formatNumber(earnedOptions)} Stock Options!`, "fas fa-star");
        saveGame();
        updateDisplay();
        modalOverlay.style.display = 'none';
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
                playSound('achievement');
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
function renderStore() {
    if (modalOverlay.style.display !== 'flex' || modalTitle.innerText !== 'Operations Store') return;
    let html = '';
    
    if (!state.runCode) state.runCode = state.code;
    const optionsEarned = Math.floor(Math.sqrt(state.runCode / 25000)); 
    if (optionsEarned >= 1) {
        html += `
            <div class="upgrade-item prestige-btn" onclick="doPrestige(${optionsEarned})" style="margin-bottom:15px;">
                <div class="upgrade-info" style="width: 100%; text-align: center;">
                    <h3 style="color: gold; margin-bottom: 5px;"><i class="fas fa-rocket"></i> Launch IPO (Prestige)</h3>
                    <p style="margin:0; font-size:0.9rem;">Sell the company for <strong style="color:#fff;">${formatNumber(optionsEarned)} Stock Options</strong>!</p>
                </div>
            </div>
        `;
    }

    for (const [id, upgrade] of Object.entries(state.clickUpgrades || {})) {
        if (!upgrade.purchased) {
            const canAfford = state.code >= upgrade.cost;
            html += `
                <div class="upgrade-item ${canAfford ? '' : 'disabled'}" data-cost="${upgrade.cost}" style="border-color:var(--success-color); margin-bottom:10px; cursor:pointer;" onclick="buyClickUpgrade('${id}')">
                    <div class="upgrade-info" style="width:100%;">
                        <h3 style="color:var(--success-color); margin-bottom:5px;"><i class="${upgrade.icon}" style="width:24px; text-align:center; margin-right:8px;"></i>${upgrade.name}</h3>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.85rem; color:var(--text-muted);">${upgrade.desc} (Perm)</span>
                            <span class="cost-amount" style="background:rgba(63, 185, 80, 0.1); color:var(--success-color);"><i class="fas fa-code"></i> Cost: ${formatNumber(upgrade.cost)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    for (const [id, info] of Object.entries(upgradesInfo)) {
        const upgrade = state.upgrades[id];
        const cost = getCost(id);
        const canAfford = state.code >= cost;
        let prestigeMultiplier = 1 + ((state.stockOptions || 0) * 0.10);
        let currentProd = upgrade.baseProduction * state.adMultiplier * prestigeMultiplier;

        html += `
        <div class="upgrade-item ${canAfford ? '' : 'disabled'}" data-cost="${cost}" style="margin-bottom:10px; cursor:pointer;" onclick="buyUpgrade('${id}')">
            <div class="upgrade-info" style="flex:1;">
                <h3 style="margin-bottom:5px;"><i class="${info.icon}" style="width:24px; text-align:center; margin-right:8px;"></i>${info.name}</h3>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.85rem; color:var(--text-muted);">+${formatNumber(currentProd)}/s</span>
                    <span class="cost-amount" style="background:rgba(255, 255, 255, 0.1);"><i class="fas fa-code"></i> Cost: ${formatNumber(cost)}</span>
                </div>
            </div>
            <div class="owned-amount" style="margin-left:15px; font-weight:bold; font-size:1.5rem; color:var(--accent-color);">${formatNumber(upgrade.count)}</div>
        </div>`;
    }
    modalBody.innerHTML = html;
}

function updateMiniMap() {
    let html = '';
    for (const [id, info] of Object.entries(upgradesInfo)) {
        if (state.upgrades[id].count > 0) {
            html += `<div class="minimap-item" title="${info.name}"><i class="${info.icon}"></i> ${formatNumber(state.upgrades[id].count)}</div>`;
        }
    }
    const mm = document.getElementById('mini-map');
    if (mm) mm.innerHTML = html;
}

function updateDisplay() {
    codeDisplay.innerText = formatNumber(state.code);
    let textBonus = state.stockOptions > 0 ? `<br><span style="font-size:0.75rem; color:gold;"><i class="fas fa-rocket"></i> +${formatNumber(state.stockOptions*10)}% IPO Bonus Active</span>` : '';
    cpsDisplay.innerHTML = `${formatNumber(getCPS())} lines / second` + textBonus;
    
    if (state.adMultiplierEndTime > Date.now()) {
        state.adMultiplier = 2;
        rewardedBtn.style.display = 'none';
        adActiveTag.style.display = 'block';
        const remainingStr = Math.ceil((state.adMultiplierEndTime - Date.now()) / 1000 / 60);
        adActiveTag.innerHTML = `<i class="fas fa-fire"></i> 2x Production Active! (${remainingStr}m left)`;
    } else {
        if(state.adMultiplier !== 1) {
            state.adMultiplier = 1;
            renderStore(); 
        }
        rewardedBtn.style.display = 'block';
        adActiveTag.style.display = 'none';
    }

    updateMiniMap();
    updateStoreOpacities();
    checkAchievements();
    if(!state.tutorialComplete) renderTutorial();
}

let currentTutorialStep = 0;
function renderTutorial() {
    if (state.tutorialComplete) return;

    let tutEl = document.getElementById('tutorial-pointer');
    if (!tutEl) {
        tutEl = document.createElement('div');
        tutEl.id = 'tutorial-pointer';
        document.body.appendChild(tutEl);
        
        const style = document.createElement('style');
        style.innerHTML = `
            #tutorial-pointer {
                position: fixed;
                background: #58a6ff;
                color: #fff;
                padding: 15px 20px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 1.1rem;
                z-index: 9999;
                pointer-events: none;
                box-shadow: 0 0 20px rgba(88, 166, 255, 0.8);
                animation: bounce 1s infinite alternate;
                display: none;
                text-align: center;
                white-space: nowrap;
                transform: translateX(-50%);
            }
            #tutorial-pointer::after {
                content: '';
                position: absolute;
                bottom: -10px;
                left: 50%;
                transform: translateX(-50%);
                border-width: 10px 10px 0;
                border-style: solid;
                border-color: #58a6ff transparent transparent transparent;
            }
            @keyframes bounce { 
                0% { margin-top: 0px; } 
                100% { margin-top: -15px; } 
            }
        `;
        document.head.appendChild(style);
    }

    if (state.totalClicks < 15) {
        currentTutorialStep = 1;
        const rect = document.getElementById('main-button').getBoundingClientRect();
        tutEl.style.display = 'block';
        tutEl.style.top = (rect.top - 80) + 'px';
        tutEl.style.left = (rect.left + rect.width / 2) + 'px';
        tutEl.innerHTML = `Step 1: Click to write 15 lines of code! (${state.totalClicks}/15)`;
    } else if (state.totalClicks >= 15 && state.upgrades.intern.count === 0) {
        currentTutorialStep = 2;
        const rect = document.getElementById('btn-store').getBoundingClientRect();
        tutEl.style.display = 'block';
        tutEl.style.left = (rect.left + rect.width / 2) + 'px';
        tutEl.style.top = (rect.top - 80) + 'px';
        tutEl.innerHTML = `Step 2: Open Store & hire an Intern!`;
    } else if (state.upgrades.intern.count > 0 && currentTutorialStep <= 2) {
        currentTutorialStep = 3;
        state.tutorialComplete = true;
        tutEl.style.display = 'block';
        tutEl.style.top = '100px';
        tutEl.style.left = '50%';
        tutEl.innerHTML = `<i class="fas fa-check-circle"></i> Tutorial Complete! Watch for flying server bugs!`;
        setTimeout(() => { if(tutEl) tutEl.remove(); saveGame(); }, 6000);
    }
}

function updateStoreOpacities() {
    if (modalOverlay.style.display !== 'flex' || modalTitle.innerText !== 'Operations Store') return;
    const items = modalBody.querySelectorAll('.upgrade-item');
    items.forEach(div => {
        const costStr = div.getAttribute('data-cost');
        if (costStr) {
            const cost = parseFloat(costStr);
            if (state.code >= cost) div.classList.remove('disabled');
            else div.classList.add('disabled');
        }
    });
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
        spawnEvent();
        bugTimer = Math.random() * 40000 + 30000; 
    }
}

// ==========================================
// SAVE & LOAD (localStorage)
// ==========================================
function saveGame() {
    state.lastSaveTime = Date.now();
    localStorage.setItem('startupClickerSave', JSON.stringify(state));
    syncScoreboard();
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
            alert(`Welcome back to ${state.companyName}!\n\nWhile you were away, your team wrote ${formatNumber(Math.floor(offlineGains))} lines of code!`);
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
modalClose.addEventListener('click', (e) => { 
    e.preventDefault();
    e.stopPropagation();
    modalOverlay.style.display = 'none'; 
});
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
    }
});

btnStore.addEventListener('click', () => {
    openModal("Operations Store", `<div style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i></div>`);
    renderStore();
});

btnSettings.addEventListener('click', () => {
    let html = `
        <div style="display:flex; flex-direction:column; gap: 15px;">
            <p style="color:var(--text-muted); font-size:0.95rem;">Manage your game configuration and save files.</p>
            <div style="display:flex; gap: 10px;">
                <button onclick="exportSaveUI()" class="header-btn" style="flex:1; background:#238636; border:none; color:white; padding:12px; font-weight:bold;"><i class="fas fa-download"></i> Save to File</button>
                <button onclick="importSaveUI()" class="header-btn" style="flex:1; background:#1f6feb; border:none; color:white; padding:12px; font-weight:bold;"><i class="fas fa-upload"></i> Load File</button>
            </div>
            
            <hr style="border-color:var(--border-color); margin: 5px 0;">
            <p style="color:#fff; font-weight:bold; margin-bottom:0;"><i class="fas fa-cloud"></i> Cloud Sync</p>
            <div style="display:flex; gap: 10px;">
                <button onclick="uploadCloudSave()" class="header-btn" style="flex:1; background:#8a2be2; border:none; color:white; padding:12px;"><i class="fas fa-cloud-upload-alt"></i> Upload Cloud Save</button>
                <button onclick="downloadCloudSavePrompt()" class="header-btn" style="flex:1; background:#58a6ff; border:none; color:white; padding:12px;"><i class="fas fa-cloud-download-alt"></i> Import Code</button>
            </div>
            <p id="save-msg" style="color:var(--success-color); font-size:0.9rem; text-align:center; min-height:15px; margin:0;"></p>

            <hr style="border-color:var(--border-color); margin: 5px 0;">
            <button onclick="hardReset()" class="rewarded-ad-btn" style="background:#da3633; border:none; padding:12px; font-size:1rem;"><i class="fas fa-skull"></i> Hard Reset (Wipe All)</button>
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
            document.getElementById('save-msg').innerText = "Invalid JSON file!";
            document.getElementById('save-msg').style.color = "#da3633";
        }
    };
    reader.readAsText(file);
}

window.uploadCloudSave = async function() {
    saveGame();
    const pin = Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase(); // 7 chars
    const saveObj = JSON.parse(localStorage.getItem('startupClickerSave'));
    const msgEl = document.getElementById('save-msg');
    
    msgEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;
    msgEl.style.color = "var(--success-color)";
    
    try {
        const { error } = await supabaseClient.from('cloud_saves').upsert(
            { sync_id: pin, save_data: saveObj, company_name: state.companyName }, 
            { onConflict: 'sync_id' }
        );
        if (error) throw error;
        msgEl.innerHTML = `Success! Your Sync Code: <strong style="color:gold; font-size:1.1rem; letter-spacing:1px;">${pin}</strong>`;
    } catch(err) {
        msgEl.innerHTML = `Error: Make sure 'cloud_saves' table exists in Supabase.`;
        msgEl.style.color = "#da3633";
        console.error(err);
    }
}

window.downloadCloudSavePrompt = function() {
    const pin = prompt("Enter your Cloud Sync Code:");
    if (!pin) return;
    downloadCloudSave(pin.trim().toUpperCase());
}

window.downloadCloudSave = async function(pin, initLoading = false) {
    const msgEl = document.getElementById('save-msg');
    if(msgEl) {
        msgEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading...`;
        msgEl.style.color = "var(--success-color)";
    }
    
    try {
        const { data, error } = await supabaseClient.from('cloud_saves').select('save_data').eq('sync_id', pin).single();
        if (error || !data) throw error || new Error("Save not found");
        
        localStorage.setItem('startupClickerSave', JSON.stringify(data.save_data));
        if(msgEl) msgEl.innerText = "Cloud Save loaded! Reloading...";
        if(initLoading) {
            loadGame();
            return true;
        } else {
            setTimeout(() => location.reload(), 1000);
        }
    } catch(err) {
        if(msgEl) {
            msgEl.innerText = "Error: Invalid PIN or save not found.";
            msgEl.style.color = "#da3633";
        }
        return false;
    }
}

window.hardReset = function() {
    if (confirm("WARNING: This will absolutely wipe EVERYTHING! Are you positive?")) {
        localStorage.removeItem('startupClickerSave');
        location.reload();
    }
}

// Global Leaderboard (Supabase)
btnLeaderboard.addEventListener('click', async () => {
    openModal("Global Leaderboard", `
        <div style="text-align:center; padding: 40px 20px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--accent-color);"></i>
            <p style="margin-top: 15px; color:var(--text-muted); font-size:1.1rem;">Connecting to Supabase...</p>
        </div>
    `);

    try {
        const { data, error } = await supabaseClient.from('leaderboard').select('company_name, stock_options').order('stock_options', { ascending: false }).limit(10);
        if (error) throw error;

        let ranksHtml = '';
        if (data && data.length > 0) {
            data.forEach((row, index) => {
                let isMe = (row.company_name === state.companyName);
                let color = index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "#cd7f32" : "#8b949e";
                let icon = index === 0 ? '<i class="fas fa-crown"></i>' : index === 1 || index === 2 ? '<i class="fas fa-medal"></i>' : '';
                ranksHtml += `
                    <div style="display:flex; justify-content:space-between; padding:10px; margin-bottom:5px; color:${isMe ? '#fff' : color}; font-weight:${isMe ? 'bold': 'normal'}; background:${isMe ? 'rgba(88,166,255,0.15)' : 'rgba(0,0,0,0.2)'}; border-radius:6px; font-size:0.95rem;">
                        <span style="flex:1;">${icon} ${index + 1}</span>
                        <span style="flex:2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${row.company_name}</span>
                        <span style="flex:1; text-align:right;">${formatNumber(row.stock_options)}</span>
                    </div>
                `;
            });
        }
        openModal("Global Leaderboard", `
            <div style="text-align:center;">
                <p style="color:var(--text-muted); margin-bottom:15px; font-size: 0.9rem;">LIVE Global Standings</p>
                <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:12px; padding:15px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #30363d; padding:10px; margin-bottom:10px; font-weight:bold; color:#fff;">
                        <span style="flex:1;">Rank</span>
                        <span style="flex:2;">Company</span>
                        <span style="flex:1; text-align:right;">Options</span>
                    </div>
                    ${ranksHtml || '<p style="text-align:center;color:#8b949e;">Empty.</p>'}
                </div>
                <div style="margin-top: 15px;">
                    <button onclick="shareScore()" style="width:100%; background:#1da1f2; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">
                        <i class="fab fa-twitter"></i> Share High Score
                    </button>
                </div>
            </div>
        `);
    } catch (e) {
        openModal("Global Leaderboard", `
            <div style="text-align:center; padding: 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: #da3633;"></i>
                <p style="margin-top: 15px; color:#da3633; font-weight:bold; font-size:1.1rem;">Failed to connect.</p>
            </div>
        `);
    }
});

btnTrophies.addEventListener('click', () => renderTrophies());

function renderTrophies() {
    let unlk = state.unlockedAchievements.filter(id => achievementsData.some(a => a.id === id)).length;
    let tot = achievementsData.length;
    let html = `<p style="text-align:center; font-weight:bold; color:gold; margin-bottom:15px;">Completed: ${unlk} / ${tot}</p><div class="trophy-grid" style="padding-right:5px; padding-bottom:20px;">`;
    for (const ach of achievementsData) {
        const unlocked = state.unlockedAchievements.includes(ach.id);
        html += `
            <div class="trophy-item ${unlocked ? 'unlocked' : 'locked'}" style="margin-bottom:10px;">
                <div class="trophy-icon"><i class="${unlocked ? 'fas fa-trophy' : 'fas fa-lock'}"></i></div>
                <div class="trophy-info">
                    <strong style="display:block; margin-bottom:2px; font-size:0.95rem;">${unlocked ? ach.name : '???'}</strong>
                    <p style="margin:0; font-size:0.8rem;">${unlocked ? ach.desc : 'Keep operating to unlock!'}</p>
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
    try {
        if (window.CrazyGames && window.CrazyGames.SDK) {
            const callbacks = {
                adFinished: () => {
                    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
                    state.adMultiplierEndTime = Date.now() + (10 * 60 * 1000);
                    state.adMultiplier = 2;
                    updateDisplay();
                    saveGame();
                    showToast("Boost Activated!", "Production DOUBLED for 10 minutes!", "fas fa-fire");
                },
                adError: (error) => {
                    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
                    console.warn("CrazyGames SDK Ad Blocked/Failed. Granting fallback boost.", error);
                    state.adMultiplierEndTime = Date.now() + (10 * 60 * 1000);
                    state.adMultiplier = 2;
                    updateDisplay();
                    saveGame();
                    showToast("Test Boost Activated!", "Granted Local 2x Boost (SDK Blocked Offline)", "fas fa-vial");
                },
                adStarted: () => {
                    if(audioCtx && audioCtx.state === 'running') audioCtx.suspend();
                }
            };
            window.CrazyGames.SDK.ad.requestAd('rewarded', callbacks);
        } else {
            fallbackReward();
        }
    } catch(err) {
        console.warn("SDK Request Error. Falling back.", err);
        fallbackReward();
    }
});

function fallbackReward() {
    const adsSDK = confirm("MOCK SDK (CrazyGames missing/blocked): Watch this ad to DOUBLE your production?");
    if (adsSDK) {
        state.adMultiplierEndTime = Date.now() + (10 * 60 * 1000);
        state.adMultiplier = 2;
        updateDisplay();
        saveGame();
        showToast("Boost Activated!", "Production DOUBLED for 10 minutes!", "fas fa-fire");
    }
}

window.shareScore = function() {
    const text = `🚀 I just launched my startup "${state.companyName}" with ${formatNumber(state.stockOptions || 0)} Stock Options! Can you beat my high score? Play here: https://idlestartupclicker.online`;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Copied to Clipboard!", "Paste it on Twitter or Reddit!", "fas fa-check");
    });
}

init();
