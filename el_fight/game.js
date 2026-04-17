// ====== GLOBALS & SETTINGS ======
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; canvas.height = 800;

const p1Color = '#ff2a6d';
const p2Color = '#05d9e8';

let GAME_MODE = '1vAI'; // '1vAI', '1v1', 'online'
let NUM_LEVELS = 3;
let IS_ONLINE = false;
let IS_HOST = true; 
let isPaused = false;
let engineRunner = null;

const mainMenu = document.getElementById('main-menu');
const lobbyMenu = document.getElementById('lobby-menu');
const gameUi = document.getElementById('game-ui');
const pauseMenu = document.getElementById('pause-menu');
const winnerScreen = document.getElementById('winner-screen');
const mobileControls = document.getElementById('mobile-controls');
const sidePanel = document.getElementById('side-panel');

// Buffs and Level State Tracking
let p1Buffs = { jump: 0, rapid: 0 };
let p2Buffs = { jump: 0, rapid: 0 };
let gamePlatforms = [];
let gamePowerups = [];

// ====== MENU LOGIC ======
document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        GAME_MODE = e.target.dataset.mode;
        document.getElementById('start-game-btn').innerText = GAME_MODE === 'online' ? 'ENTER LOBBY' : 'P L A Y';
    });
});

document.querySelectorAll('.lvl-btn').forEach(b => {
    b.addEventListener('click', (e) => {
        document.querySelectorAll('.lvl-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        NUM_LEVELS = parseInt(e.target.dataset.levels);
    });
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    if(GAME_MODE === 'online') {
        IS_ONLINE = true;
        initOnlineLobby();
    } else {
        IS_ONLINE = false;
        IS_HOST = true;
        startGame();
    }
});

// Pause Logic
document.getElementById('pause-btn').addEventListener('click', () => {
    isPaused = true;
    pauseMenu.classList.remove('hidden');
    if(IS_HOST && engineRunner) Matter.Runner.stop(engineRunner);
});
document.getElementById('resume-btn').addEventListener('click', () => {
    isPaused = false;
    pauseMenu.classList.add('hidden');
    if(IS_HOST && engineRunner) Matter.Runner.start(engineRunner, engine);
});
document.getElementById('quit-btn').addEventListener('click', () => location.reload());
document.getElementById('back-to-main-btn').addEventListener('click', () => location.reload());
document.getElementById('restart-btn').addEventListener('click', () => location.reload());


// ====== PEERJS NETWORK LOGIC ======
let peer = null;
let conn = null;
let guestSyncFrame = null;
let displayRoomCode = "";

function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
    let res = ""; 
    for(let i=0; i<5; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
}

function initOnlineLobby() {
    mainMenu.classList.add('hidden');
    lobbyMenu.classList.remove('hidden');
    
    displayRoomCode = generateCode();
    peer = new Peer("elfight-" + displayRoomCode);
    
    peer.on('open', (id) => {
        document.getElementById('host-code-display').innerText = displayRoomCode;
    });
    
    peer.on('connection', (c) => {
        if(conn) return; 
        conn = c; IS_HOST = true;
        document.getElementById('connection-status').innerText = 'Player 2 Joined! Waiting for handshake...';
        c.on('data', handleNetworkData);
    });
    
    peer.on('error', (err) => {
        document.getElementById('connection-status').innerText = 'Network error. Try again.';
    });
}

document.getElementById('join-btn').addEventListener('click', () => {
    let targetCode = document.getElementById('join-code-input').value.trim().toUpperCase();
    if(!targetCode) return;
    
    if(!peer) peer = new Peer(); 
    
    document.getElementById('connection-status').innerText = 'Connecting...';
    conn = peer.connect("elfight-" + targetCode);
    
    conn.on('open', () => {
        document.getElementById('connection-status').innerText = 'Connected! Handshaking...';
        IS_HOST = false;
        conn.on('data', handleNetworkData);
        // Robust Sync: Guest pings ready to safely receive layout data
        conn.send({m: 'guest_ready'});
    });
    
    conn.on('error', () => {
        document.getElementById('connection-status').innerText = 'Invalid Host Code.';
    });
});

function handleNetworkData(data) {
    if(IS_HOST && data.m === 'guest_ready') {
        document.getElementById('connection-status').innerText = 'Starting Sync...';
        startGame(); // Generates platforms!
        conn.send({ 
            m: 'init', 
            levels: NUM_LEVELS,
            plats: gamePlatforms.map(p => ({x: p.position.x, y: p.position.y, w: p.bounds.max.x - p.bounds.min.x})),
            pu: gamePowerups.map(p => ({id: p.id, x: p.position.x, y: p.position.y, c: p.color, type: p.label}))
        });
    }
    else if(data.m === 'init' && !IS_HOST) {
        NUM_LEVELS = data.levels;
        gamePlatforms = data.plats; // Statically pre-loaded
        gamePowerups = data.pu;
        startGame(); // Start visual client
    }
    else if(data.m === 'sync' && !IS_HOST) {
        guestSyncFrame = data; 
        // Update powerups locally from host sync array
        gamePowerups = data.pu; 
    }
    else if(data.m === 'input' && IS_HOST) {
        keys[data.k] = data.v;
        if(data.k === 'FireP2' && data.v === true) {
            let now = Date.now();
            let cd = now < p2Buffs.rapid ? 100 : fireCooldown;
            if(now - p2Fire > cd && !gameOver && !isPaused) { 
                shootClone(player2Body, p2Facing, 'clone_2', p2Color); 
                p2Fire = now; 
            }
        }
    }
}


// ====== MATTER.JS SETUP ======
const Engine = Matter.Engine,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Events = Matter.Events;

let engine, world;
let playerBody, player2Body;
let physicsCells = [];
let targetSensor = null;

let measureLevels = []; 
let currentLevelIdx = 0;
let p1Hits = 0, p2Hits = 0;
const hitsRequired = 3;
let gameOver = false;
let targetActive = false;
let globalWinnerColor = null;

let cameraY = 0;
let cameraZoom = 1.0;
let screenShake = 0;
let sparks = [];

let p1Fire = 0, p2Fire = 0;
let p1Facing = 1, p2Facing = -1;
const fireCooldown = 350; 
const keys = {};

function spawnParticles(x, y, color, count, speedMax) {
    for(let i=0; i<count; i++) {
        sparks.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * speedMax * 2,
            vy: (Math.random() - 0.5) * speedMax * 2,
            life: 1.0, color: color
        });
    }
}

function startGame() {
    mainMenu.classList.add('hidden');
    lobbyMenu.classList.add('hidden');
    gameUi.classList.remove('hidden');
    
    if(window.innerWidth <= 800) {
        sidePanel.classList.add('game-active'); // Nuke Side Panel for pure mobile gameplay canvas HUD
        mobileControls.classList.remove('hidden');
        if(GAME_MODE === 'online' || GAME_MODE === '1vAI') {
            document.getElementById('p2-mobile-controls').style.display = 'none'; 
        }
    }

    measureLevels = []; 
    for(let i=0; i < NUM_LEVELS; i++) measureLevels.push(550 - (i * 200));
    
    let tubeTopY = measureLevels[NUM_LEVELS - 1] - 300;

    if(IS_HOST) {
        engine = Engine.create();
        world = engine.world;
        
        const wallOptions = { isStatic: true, render: { fillStyle: 'transparent' }, friction: 0.0 };
        const leftWall = Bodies.rectangle(240, tubeTopY / 2 + 350, 20, Math.abs(tubeTopY - 700) + 500, wallOptions);
        const rightWall = Bodies.rectangle(560, tubeTopY / 2 + 350, 20, Math.abs(tubeTopY - 700) + 500, wallOptions);
        const bottomFloor = Bodies.rectangle(400, 720, 320, 40, { isStatic: true, friction: 0.8 });
        Composite.add(world, [leftWall, rightWall, bottomFloor]);

        // PROCEDURAL GENERATION Loop
        for(let i=0; i < NUM_LEVELS - 1; i++) {
            let platY = measureLevels[i] - 100;
            let pw = 90 + Math.random() * 80; // Width of platform
            let px = 250 + pw/2 + Math.random() * (300 - pw);
            let plat = Bodies.rectangle(px, platY, pw, 15, { isStatic: true, friction: 0.9 });
            Composite.add(world, plat);
            gamePlatforms.push(plat);

            if(Math.random() < 0.6) {
                let p_type = Math.random() < 0.5 ? 'powerup_jump' : 'powerup_rapid';
                let color = p_type === 'powerup_jump' ? '#39ff14' : '#ffff00';
                let pux = 250 + Math.random() * 260 + 20;
                let pu = Bodies.circle(pux, platY - 40, 15, { 
                    isStatic: true, isSensor: true, 
                    label: p_type, color: color, id: Math.random().toString() 
                });
                Composite.add(world, pu);
                gamePowerups.push(pu);
            }
        }

        playerBody = Bodies.circle(300, 650, 20, { restitution: 0.0, friction: 0.5, density: 0.05, label: 'player1' });
        Body.setInertia(playerBody, Infinity); 

        player2Body = Bodies.circle(500, 650, 20, { restitution: 0.0, friction: 0.5, density: 0.05, label: 'player2' });
        Body.setInertia(player2Body, Infinity);

        Composite.add(world, [playerBody, player2Body]);
        
        createTarget();

        Events.on(engine, 'collisionStart', (e) => checkGround(e.pairs));
        Events.on(engine, 'collisionActive', (e) => checkGround(e.pairs));
        Events.on(engine, 'beforeUpdate', updatePhysicsLogic);

        engineRunner = Runner.create();
        Runner.start(engineRunner, engine);
    }
    
    document.getElementById('level-display').innerText = `1 / ${NUM_LEVELS}`;
    if(window.innerWidth <= 800) resizeCanvas();
    gameLoop(); // Start Render Loop safely
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createTarget() {
    if(targetSensor) Composite.remove(world, targetSensor);
    let y = measureLevels[currentLevelIdx] - 20; 
    targetSensor = Bodies.rectangle(400, y, 300, 20, { isStatic: true, isSensor: true, label: 'target' });
    Composite.add(world, targetSensor);
    screenShake = 15; 
}


// ====== INPUT ROUTING ======
window.addEventListener('keydown', (e) => {
    if(IS_HOST) {
        keys[e.code] = true; 
        if(e.code === 'Space' && !gameOver && !isPaused) {
            let cd = Date.now() < p1Buffs.rapid ? 100 : fireCooldown;
            if(Date.now() - p1Fire > cd) { shootClone(playerBody, p1Facing, 'clone_1', p1Color); p1Fire = Date.now(); }
        }
        if(GAME_MODE === '1v1' && e.code === 'Enter' && !gameOver && !isPaused) {
            let cd = Date.now() < p2Buffs.rapid ? 100 : fireCooldown;
            if(Date.now() - p2Fire > cd) { shootClone(player2Body, p2Facing, 'clone_2', p2Color); p2Fire = Date.now(); }
        }
    } else if(conn) {
        let mapped = e.code;
        if(e.code === 'KeyA') mapped = 'ArrowLeft';
        if(e.code === 'KeyD') mapped = 'ArrowRight';
        if(e.code === 'KeyW') mapped = 'ArrowUp';
        if(e.code === 'Space') { mapped = 'FireP2'; conn.send({m: 'input', k: mapped, v: true}); }
        conn.send({m: 'input', k: mapped, v: true});
    }
});

window.addEventListener('keyup', (e) => {
    if(IS_HOST) keys[e.code] = false;
    else if(conn) {
        let mapped = e.code;
        if(e.code === 'KeyA') mapped = 'ArrowLeft';
        if(e.code === 'KeyD') mapped = 'ArrowRight';
        if(e.code === 'KeyW') mapped = 'ArrowUp';
        conn.send({m: 'input', k: mapped, v: false});
    }
});

// Mobile Controls Interface
function setupMobileBtn(id, keyCode, mappedKeyIfGuest) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        if(IS_HOST) keys[keyCode] = true; else if(conn) conn.send({m:'input', k:mappedKeyIfGuest || keyCode, v:true}); 
    });
    btn.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        if(IS_HOST) keys[keyCode] = false; else if(conn) conn.send({m:'input', k:mappedKeyIfGuest || keyCode, v:false}); 
    });
}
setupMobileBtn('btn-left', 'KeyA', 'ArrowLeft'); setupMobileBtn('btn-right', 'KeyD', 'ArrowRight'); setupMobileBtn('btn-jump', 'KeyW', 'ArrowUp');
setupMobileBtn('btn-left-2', 'ArrowLeft'); setupMobileBtn('btn-right-2', 'ArrowRight'); setupMobileBtn('btn-jump-2', 'ArrowUp');

document.getElementById('btn-fire').addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    if(IS_HOST) {
        let cd = Date.now() < p1Buffs.rapid ? 100 : fireCooldown;
        if(Date.now() - p1Fire > cd && !gameOver && !isPaused) { shootClone(playerBody, p1Facing, 'clone_1', p1Color); p1Fire = Date.now(); }
    } else if(conn) { conn.send({m:'input', k:'FireP2', v:true}); }
});
document.getElementById('btn-fire-2').addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    if(IS_HOST && GAME_MODE === '1v1') {
        let cd = Date.now() < p2Buffs.rapid ? 100 : fireCooldown;
        if(Date.now() - p2Fire > cd && !gameOver && !isPaused) { shootClone(player2Body, p2Facing, 'clone_2', p2Color); p2Fire = Date.now(); }
    }
});


// ====== PHYSICS LOGIC (HOST ONLY) ======
let p1GroundedTime = 0, p2GroundedTime = 0;
let p1GroundType = 'neutral', p2GroundType = 'neutral';

function checkGround(pairs) {
    for (let p of pairs) {
        if (p.bodyA === playerBody || p.bodyB === playerBody) {
            let other = p.bodyA === playerBody ? p.bodyB : p.bodyA;
            if(!other.isSensor && (other.position.y > playerBody.position.y + 15)) { p1GroundedTime = Date.now(); p1GroundType = other.label; }
        }
        if (p.bodyA === player2Body || p.bodyB === player2Body) {
            let other = p.bodyA === player2Body ? p.bodyB : p.bodyA;
            if(!other.isSensor && (other.position.y > player2Body.position.y + 15)) { p2GroundedTime = Date.now(); p2GroundType = other.label; }
        }
        
        let isPu = (l) => l.startsWith('powerup_');
        let isPl = (l) => l.startsWith('player');
        if(isPu(p.bodyA.label) && isPl(p.bodyB.label)) applyPowerup(p.bodyA, p.bodyB);
        else if(isPu(p.bodyB.label) && isPl(p.bodyA.label)) applyPowerup(p.bodyB, p.bodyA);
        else if(targetActive && p.bodyA.label === 'target' && p.bodyB.label.startsWith('clone')) hitTarget(p.bodyB);
        else if(targetActive && p.bodyB.label === 'target' && p.bodyA.label.startsWith('clone')) hitTarget(p.bodyA);
    }
}

function applyPowerup(puBody, playerBodyRaw) {
    if(puBody.consumed) return; puBody.consumed = true;
    let buffs = playerBodyRaw.label === 'player1' ? p1Buffs : p2Buffs;
    if(puBody.label === 'powerup_jump') buffs.jump = Date.now() + 10000;
    if(puBody.label === 'powerup_rapid') buffs.rapid = Date.now() + 10000;
    
    Composite.remove(world, puBody);
    let idx = gamePowerups.indexOf(puBody); if(idx>-1) gamePowerups.splice(idx,1);
    spawnParticles(puBody.position.x, puBody.position.y, puBody.color, 40, 10);
    screenShake = 20;
}

function hitTarget(cloneBody) {
    let isP1 = cloneBody.label === 'clone_1';
    let colorHit = isP1 ? p1Color : p2Color;
    if (isP1) p1Hits++; else p2Hits++;
    
    Composite.remove(world, cloneBody);
    let idx = physicsCells.indexOf(cloneBody); if(idx > -1) physicsCells.splice(idx, 1);
    
    spawnParticles(cloneBody.position.x, cloneBody.position.y, colorHit, 30, 10);
    screenShake = Math.max(screenShake, 15); 
    
    document.getElementById('p1-hits-display').innerText = `${p1Hits} / ${hitsRequired}`;
    document.getElementById('p2-hits-display').innerText = `${p2Hits} / ${hitsRequired}`;

    if(p1Hits >= hitsRequired || p2Hits >= hitsRequired) {
        let winnerLabel = p1Hits >= hitsRequired ? 'clone_1' : 'clone_2';
        let winnerColor = p1Hits >= hitsRequired ? p1Color : p2Color;
        p1Hits = 0; p2Hits = 0;
        currentLevelIdx++;
        document.getElementById('level-display').innerText = `${Math.min(currentLevelIdx + 1, NUM_LEVELS)} / ${NUM_LEVELS}`;
        
        if(currentLevelIdx >= measureLevels.length) endGame(winnerColor);
        else {
            targetActive = false; 
            document.getElementById('target-alert').classList.add('hidden');
            createTarget();
            triggerAvalanche(winnerLabel, winnerColor);
        }
    }
}

function cullOldCells() {
    if(physicsCells.length > 200) { let oldest = physicsCells.shift(); Composite.remove(world, oldest); }
}

function shootClone(pBody, facing, label, color) {
    let spawnX = pBody.position.x + facing * 25; let spawnY = pBody.position.y - 10; 
    let clone = Bodies.polygon(spawnX, spawnY, 8, 12, { restitution: 0.05, friction: 0.9, frictionStatic: 3.0, density: 0.08, label: label, color: color, chamfer: { radius: 2 } });
    Body.setVelocity(clone, { x: facing * 18, y: -4 });
    physicsCells.push(clone); Composite.add(world, clone); cullOldCells();
    spawnParticles(spawnX, spawnY, color, 10, 4); screenShake = Math.max(screenShake, 4); 
}

function triggerAvalanche(winnerLabel, winnerColor) {
    screenShake = 35; let lineY = measureLevels[currentLevelIdx - 1]; let count = 0;
    let avalancheInterval = setInterval(() => {
        if(isPaused) return; 
        for(let i=0; i<3; i++) {
            let dropX = 260 + Math.random() * 280; let dropY = lineY - 200 - Math.random() * 200; 
            let clone = Bodies.polygon(dropX, dropY, 8, 12, { restitution: 0.05, friction: 0.9, density: 0.08, label: winnerLabel, color: winnerColor, chamfer: { radius: 2 }});
            physicsCells.push(clone); Composite.add(world, clone); cullOldCells();
            spawnParticles(dropX, dropY + 20, 'white', 2, 4);
        }
        count++; screenShake = 10;
        if (count >= 15) clearInterval(avalancheInterval);
    }, 60);
}

function applyBuoyancy(player) {
    let buriedCount = 0;
    for(let c of physicsCells) { if(c.position.y < player.position.y && Math.abs(c.position.x - player.position.x) < 30) buriedCount++; }
    if(buriedCount > 1) {
        let lift = Math.min(0.08, 0.015 * buriedCount);
        Body.applyForce(player, player.position, {x: 0, y: -lift});
        if (player.velocity.y < -12) Body.setVelocity(player, { x: player.velocity.x, y: -12 });
    }
}

function runAI() {
    if(player2Body.position.x < 350) { keys['ArrowRight'] = true; keys['ArrowLeft'] = false; }
    else if(player2Body.position.x > 450) { keys['ArrowLeft'] = true; keys['ArrowRight'] = false; }
    else { keys['ArrowLeft'] = false; keys['ArrowRight'] = false; }
    
    if(Math.random() < 0.05) keys['ArrowUp'] = true; else keys['ArrowUp'] = false;
    
    let cd = Date.now() < p2Buffs.rapid ? 150 : fireCooldown * 1.5;
    if(Date.now() - p2Fire > cd) { shootClone(player2Body, p2Facing, 'clone_2', p2Color); p2Fire = Date.now(); }
}

function updatePhysicsLogic() {
    if(gameOver || isPaused) return;
    if(GAME_MODE === '1vAI') runAI();
    
    applyBuoyancy(playerBody); applyBuoyancy(player2Body);
    
    let p1Force = p1GroundType === 'clone_2' ? 0.005 : 0.012; let p1Max = p1GroundType === 'clone_2' ? 3 : 7;
    if (keys['KeyA']) { if (playerBody.velocity.x > -p1Max) Body.applyForce(playerBody, playerBody.position, { x: -p1Force, y: 0 }); p1Facing = -1; }
    if (keys['KeyD']) { if (playerBody.velocity.x < p1Max) Body.applyForce(playerBody, playerBody.position, { x: p1Force, y: 0 }); p1Facing = 1; }
    if (keys['KeyW'] && (Date.now() - p1GroundedTime) < 150 && playerBody.velocity.y > -2) {
        let jumpBase = Date.now() < p1Buffs.jump ? -17 : -12;
        let jumpForce = p1GroundType === 'clone_2' ? jumpBase*0.6 : jumpBase; 
        Body.setVelocity(playerBody, { x: playerBody.velocity.x, y: jumpForce }); p1GroundedTime = 0; 
        spawnParticles(playerBody.position.x, playerBody.position.y + 15, 'white', 8, 3);
    }
    
    let p2Force = p2GroundType === 'clone_1' ? 0.005 : 0.012; let p2Max = p2GroundType === 'clone_1' ? 3 : 7;
    if (keys['ArrowLeft']) { if (player2Body.velocity.x > -p2Max) Body.applyForce(player2Body, player2Body.position, { x: -p2Force, y: 0 }); p2Facing = -1; }
    if (keys['ArrowRight']) { if (player2Body.velocity.x < p2Max) Body.applyForce(player2Body, player2Body.position, { x: p2Force, y: 0 }); p2Facing = 1;}
    if (keys['ArrowUp'] && (Date.now() - p2GroundedTime) < 150 && player2Body.velocity.y > -2) {
        let jumpBase = Date.now() < p2Buffs.jump ? -17 : -12;
        let jumpForce = p2GroundType === 'clone_1' ? jumpBase*0.6 : jumpBase;
        Body.setVelocity(player2Body, { x: player2Body.velocity.x, y: jumpForce }); p2GroundedTime = 0; 
        spawnParticles(player2Body.position.x, player2Body.position.y + 15, 'white', 8, 3);
    }
    
    if(!targetActive && currentLevelIdx < measureLevels.length) {
        let lineY = measureLevels[currentLevelIdx];
        if(playerBody.position.y <= lineY || player2Body.position.y <= lineY) {
            targetActive = true; document.getElementById('target-alert').classList.remove('hidden'); screenShake = 15;
        }
    }

    if(IS_ONLINE && IS_HOST && conn) {
        conn.send({
            m: 'sync',
            p1: {x: playerBody.position.x, y: playerBody.position.y, f: p1Facing},
            p2: {x: player2Body.position.x, y: player2Body.position.y, f: p2Facing},
            cl: physicsCells.map(c => ({x: c.position.x, y: c.position.y, c: c.color, a: c.angle})),
            pu: gamePowerups.map(p => ({id: p.id, x: p.position.x, y: p.position.y, c: p.color, type: p.label})),
            bf: { p1: { j:p1Buffs.jump > Date.now(), r:p1Buffs.rapid > Date.now() }, p2: { j:p2Buffs.jump > Date.now(), r:p2Buffs.rapid > Date.now() } },
            s: { p1: p1Hits, p2: p2Hits, l: currentLevelIdx, ta: targetActive },
            over: gameOver, winColor: globalWinnerColor
        });
    }
}

function endGame(winnerColor) {
    gameOver = true; globalWinnerColor = winnerColor;
    winnerScreen.classList.remove('hidden');
    document.getElementById('target-alert').classList.add('hidden');
    document.getElementById('winner-text').style.color = winnerColor;
    screenShake = 50; 
}


// ====== RENDER LOOP ======
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let renderP1 = null, renderP2 = null, renderCl = [];
    let tubeTopY = measureLevels.length > 0 ? measureLevels[NUM_LEVELS - 1] - 300 : 0;

    // Scoreboard states derived from sync or engine
    let s_p1 = 0, s_p2 = 0, s_l = 0, s_ta = false;
    let b_p1 = {}, b_p2 = {};

    if(IS_HOST && playerBody) {
        renderP1 = {x: playerBody.position.x, y: playerBody.position.y, f: p1Facing};
        renderP2 = {x: player2Body.position.x, y: player2Body.position.y, f: p2Facing};
        renderCl = physicsCells;
        s_p1 = p1Hits; s_p2 = p2Hits; s_l = currentLevelIdx; s_ta = targetActive;
        b_p1 = {j: Date.now() < p1Buffs.jump, r: Date.now() < p1Buffs.rapid};
        b_p2 = {j: Date.now() < p2Buffs.jump, r: Date.now() < p2Buffs.rapid};
        
        if(!gameOver) {
            let highestPlayerY = Math.min(renderP1.y, renderP2.y);
            let desiredCameraY = highestPlayerY - 450; 
            if (desiredCameraY > 0) desiredCameraY = 0; 
            cameraY += (desiredCameraY - cameraY) * 0.1;
        } else {
            let midPointY = (tubeTopY + 700) / 2; cameraY += (midPointY - cameraY) * 0.05; 
            let targetZoom = Math.max(0.2, 500 / (700 - tubeTopY)); 
            cameraZoom += (targetZoom - cameraZoom) * 0.02;
            if(Math.random() < 0.2) {
                let clone = Bodies.polygon(400+(Math.random()*200-100), tubeTopY - 50, 8, 15, {restitution:0.1, color:globalWinnerColor});
                Body.setVelocity(clone, { x: (Math.random()-0.5)*20, y: -5 });
                physicsCells.push(clone); Composite.add(world, clone); cullOldCells(); 
            }
        }
    } else if(guestSyncFrame) {
        renderP1 = guestSyncFrame.p1; renderP2 = guestSyncFrame.p2; renderCl = guestSyncFrame.cl;
        s_p1 = guestSyncFrame.s.p1; s_p2 = guestSyncFrame.s.p2; s_l = guestSyncFrame.s.l; s_ta = guestSyncFrame.s.ta;
        b_p1 = guestSyncFrame.bf.p1; b_p2 = guestSyncFrame.bf.p2;
        if(guestSyncFrame.over && !gameOver) endGame(guestSyncFrame.winColor);

        if(!gameOver) {
            let highestPlayerY = Math.min(renderP1.y, renderP2.y);
            let desiredCameraY = highestPlayerY - 450; 
            if (desiredCameraY > 0) desiredCameraY = 0; 
            cameraY += (desiredCameraY - cameraY) * 0.1;
        } else {
            let midPointY = (tubeTopY + 700) / 2; cameraY += (midPointY - cameraY) * 0.05; 
            let targetZoom = Math.max(0.2, 500 / (700 - tubeTopY)); 
            cameraZoom += (targetZoom - cameraZoom) * 0.02;
        }
    }
    
    ctx.save();
    let cx = canvas.width / 2; let cy = canvas.height / 2;
    ctx.translate(cx, cy); ctx.scale(cameraZoom, cameraZoom); ctx.translate(-cx, -cy);
    ctx.translate(0, -cameraY);
    
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(250, tubeTopY, 300, 700 - tubeTopY);

    // Draw Platforms
    ctx.fillStyle = '#444';
    for(let plat of gamePlatforms) {
        let px = plat.x || plat.position.x; let py = plat.y || plat.position.y; let pw = plat.w || (plat.bounds.max.x - plat.bounds.min.x);
        ctx.fillRect(px - pw/2, py - 7.5, pw, 15);
    }
    
    // Draw Powerups with glowing pulse
    let pulseCore = Math.abs(Math.sin(Date.now() / 300));
    for(let pu of gamePowerups) {
        let pux = pu.x || pu.position.x; let puy = pu.y || pu.position.y; let color = pu.c || pu.color;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(pux, puy, 15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255, ${pulseCore})`;
        ctx.beginPath(); ctx.arc(pux, puy, 8, 0, Math.PI*2); ctx.fill();
    }

    ctx.lineWidth = 2;
    for(let i=0; i<NUM_LEVELS; i++) {
        let y = measureLevels[i];
        ctx.strokeStyle = i === s_l ? 'white' : 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath(); if (i >= s_l) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
        ctx.moveTo(250, y); ctx.lineTo(550, y); ctx.stroke();
        
        ctx.globalAlpha = 0.1; ctx.font = "bold 48px Inter"; ctx.fillStyle = "white"; ctx.textAlign = "center";
        ctx.fillText(`LVL ${i+1}`, 400, y - 50); ctx.globalAlpha = 1.0; ctx.setLineDash([]); 
    }

    if(s_l < NUM_LEVELS) {
        let ty = measureLevels[s_l] - 20;
        let pTar = Math.abs(Math.sin(Date.now() / 200)) * 0.2 + 0.1;
        ctx.fillStyle = s_ta ? `rgba(255, 215, 0, ${pTar})` : 'rgba(100, 100, 100, 0.1)';
        ctx.fillRect(250, ty - 2, 300, 24);
    }

    if(renderP1) {
        for(let pc of renderCl) {
            let x = pc.x || pc.position.x; let y = pc.y || pc.position.y; let c = pc.c || pc.color;
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.arc(x - 4, y - 4, 3, 0, Math.PI*2); ctx.fill();
        }

        const drawP = (x, y, color, facing, buffs) => {
            ctx.fillStyle = color; ctx.shadowBlur = 20; ctx.shadowColor = color;
            ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(x + (facing * 8), y - 4, 6, 0, Math.PI * 2); ctx.fill();
            // Render Buff visual states
            if(buffs.j) { ctx.strokeStyle = '#39ff14'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI*2); ctx.stroke(); }
            if(buffs.r) { ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(x, y-30, 5, 0, Math.PI*2); ctx.fill(); }
        };

        drawP(renderP2.x, renderP2.y, p2Color, renderP2.f, b_p2);
        drawP(renderP1.x, renderP1.y, p1Color, renderP1.f, b_p1); 
    }
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(250, tubeTopY); ctx.lineTo(250, 700);
    ctx.moveTo(550, tubeTopY); ctx.lineTo(550, 700); ctx.moveTo(250, 700); ctx.lineTo(550, 700); ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    for(let i = sparks.length - 1; i >= 0; i--) {
        let s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.2; s.life -= 0.03;
        if(s.life <= 0) sparks.splice(i, 1);
        else {
            ctx.fillStyle = s.color; ctx.globalAlpha = s.life;
            ctx.beginPath(); ctx.arc(s.x, s.y, 4 * s.life, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1.0;

    ctx.restore(); 
    
    // NATIVE CANVAS HUD TRANSCENDING CAMERA TRANSFORMS
    if(window.innerWidth <= 800 && mainMenu.classList.contains('hidden')) {
        ctx.font = "bold 24px Inter";
        ctx.fillStyle = p1Color; ctx.textAlign = "left"; ctx.fillText(`P1: ${s_p1}/${hitsRequired}`, 20, 60);
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.fillText(`LVL ${Math.min(s_l+1, NUM_LEVELS)} / ${NUM_LEVELS}`, canvas.width/2, 60);
        ctx.fillStyle = p2Color; ctx.textAlign = "right"; ctx.fillText(`P2: ${s_p2}/${hitsRequired}`, canvas.width - 20, 60);
        if(s_ta && !gameOver) {
            let pulse = Math.abs(Math.sin(Date.now() / 200));
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`; ctx.textAlign = "center";
            ctx.fillText(`TARGET UNLOCKED!`, canvas.width/2, 100);
        }
    }
}

function gameLoop() {
    draw();
    if(!isPaused) requestAnimationFrame(gameLoop);
}
