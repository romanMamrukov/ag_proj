// ====== GLOBALS & SETTINGS ======
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; canvas.height = 800;

// Colors
const p1Color = '#ff2a6d';
const p2Color = '#05d9e8';

let GAME_MODE = '1vAI'; // '1vAI', '1v1', 'online'
let NUM_LEVELS = 3;
let IS_ONLINE = false;
let IS_HOST = true; 
let isPaused = false;
let engineRunner = null;

// Menu DOM Elements
const mainMenu = document.getElementById('main-menu');
const lobbyMenu = document.getElementById('lobby-menu');
const gameUi = document.getElementById('game-ui');
const pauseMenu = document.getElementById('pause-menu');
const winnerScreen = document.getElementById('winner-screen');
const mobileControls = document.getElementById('mobile-controls');

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
    peer = new Peer("elfight-" + displayRoomCode); // Use prefix to avoid public server collision
    
    peer.on('open', (id) => {
        document.getElementById('host-code-display').innerText = displayRoomCode;
    });
    
    peer.on('connection', (c) => {
        if(conn) return; // Already connected
        conn = c; IS_HOST = true;
        document.getElementById('connection-status').innerText = 'Player 2 Joined! Starting...';
        c.on('data', handleNetworkData);
        // Send initial setup
        c.send({ m: 'init', levels: NUM_LEVELS });
        setTimeout(startGame, 1000);
    });
    
    peer.on('error', (err) => {
        document.getElementById('connection-status').innerText = 'Network error. Try again.';
        console.error(err);
    });
}

document.getElementById('join-btn').addEventListener('click', () => {
    let targetCode = document.getElementById('join-code-input').value.trim().toUpperCase();
    if(!targetCode) return;
    
    if(!peer) peer = new Peer(); // Initialize guest peer
    
    document.getElementById('connection-status').innerText = 'Connecting...';
    conn = peer.connect("elfight-" + targetCode);
    
    conn.on('open', () => {
        document.getElementById('connection-status').innerText = 'Connected! Waiting for host...';
        IS_HOST = false;
        conn.on('data', handleNetworkData);
    });
    
    conn.on('error', () => {
        document.getElementById('connection-status').innerText = 'Invalid Host Code.';
    });
});

function handleNetworkData(data) {
    if(data.m === 'init' && !IS_HOST) {
        NUM_LEVELS = data.levels;
        startGame(); // Start visual client
    }
    else if(data.m === 'sync' && !IS_HOST) {
        guestSyncFrame = data; 
    }
    else if(data.m === 'input' && IS_HOST) {
        // Guest sending inputs explicitly mapped to Player 2
        keys[data.k] = data.v;
        if(data.k === 'FireP2' && data.v === true) {
            let now = Date.now();
            if(now - p2Fire > fireCooldown && !gameOver && !isPaused) { 
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
    
    // Toggle mobile controls layout
    if(window.innerWidth <= 800) {
        mobileControls.classList.remove('hidden');
        if(GAME_MODE === 'online' || GAME_MODE === '1vAI') {
            document.getElementById('p2-mobile-controls').style.display = 'none'; // Only 1 set of buttons needed
        }
    }

    // Set Level Distances
    measureLevels = []; 
    for(let i=0; i < NUM_LEVELS; i++) measureLevels.push(550 - (i * 200));
    
    // Calculate precise container tube top boundary so Win fountain looks epic
    let tubeTopY = measureLevels[NUM_LEVELS - 1] - 300;

    if(IS_HOST) {
        engine = Engine.create();
        world = engine.world;
        
        const wallOptions = { isStatic: true, render: { fillStyle: 'transparent' }, friction: 0.0 };
        // Walls tightly wrap around the visual tube dimensions rather than being infinite
        const leftWall = Bodies.rectangle(240, tubeTopY / 2 + 350, 20, Math.abs(tubeTopY - 700) + 500, wallOptions);
        const rightWall = Bodies.rectangle(560, tubeTopY / 2 + 350, 20, Math.abs(tubeTopY - 700) + 500, wallOptions);
        const bottomFloor = Bodies.rectangle(400, 720, 320, 40, { isStatic: true, friction: 0.8 });
        Composite.add(world, [leftWall, rightWall, bottomFloor]);

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
    gameLoop(); // Start Render Loop safely
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
        if(e.code === 'Space' && Date.now() - p1Fire > fireCooldown && !gameOver && !isPaused) { 
            shootClone(playerBody, p1Facing, 'clone_1', p1Color); p1Fire = Date.now(); 
        }
        if(GAME_MODE === '1v1' && e.code === 'Enter' && Date.now() - p2Fire > fireCooldown && !gameOver && !isPaused) {
            shootClone(player2Body, p2Facing, 'clone_2', p2Color); p2Fire = Date.now();
        }
    } else if(conn) {
        let mapped = e.code;
        // Map Guest Local keys to Host Player 2 Keys
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
        if(IS_HOST) keys[keyCode] = true; 
        else if(conn) conn.send({m:'input', k:mappedKeyIfGuest || keyCode, v:true}); 
    });
    btn.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        if(IS_HOST) keys[keyCode] = false; 
        else if(conn) conn.send({m:'input', k:mappedKeyIfGuest || keyCode, v:false}); 
    });
}
// Guest uses local mobile P1 buttons, mapped nicely to P2 logic on Host side
setupMobileBtn('btn-left', 'KeyA', 'ArrowLeft'); 
setupMobileBtn('btn-right', 'KeyD', 'ArrowRight'); 
setupMobileBtn('btn-jump', 'KeyW', 'ArrowUp');

setupMobileBtn('btn-left-2', 'ArrowLeft'); 
setupMobileBtn('btn-right-2', 'ArrowRight'); 
setupMobileBtn('btn-jump-2', 'ArrowUp');

document.getElementById('btn-fire').addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    if(IS_HOST) {
        if(Date.now() - p1Fire > fireCooldown && !gameOver && !isPaused) { shootClone(playerBody, p1Facing, 'clone_1', p1Color); p1Fire = Date.now(); }
    } else if(conn) { conn.send({m:'input', k:'FireP2', v:true}); }
});
document.getElementById('btn-fire-2').addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    if(IS_HOST && GAME_MODE === '1v1') {
        if(Date.now() - p2Fire > fireCooldown && !gameOver && !isPaused) { shootClone(player2Body, p2Facing, 'clone_2', p2Color); p2Fire = Date.now(); }
    }
});

// ====== PHYSICS LOGIC (HOST ONLY) ======
let p1GroundedTime = 0, p2GroundedTime = 0;
let p1GroundType = 'neutral', p2GroundType = 'neutral';

function checkGround(pairs) {
    for (let p of pairs) {
        if (p.bodyA === playerBody || p.bodyB === playerBody) {
            let other = p.bodyA === playerBody ? p.bodyB : p.bodyA;
            if(!other.isSensor && (other.position.y > playerBody.position.y + 15)) {
                p1GroundedTime = Date.now(); p1GroundType = other.label; 
            }
        }
        if (p.bodyA === player2Body || p.bodyB === player2Body) {
            let other = p.bodyA === player2Body ? p.bodyB : p.bodyA;
            if(!other.isSensor && (other.position.y > player2Body.position.y + 15)) {
                p2GroundedTime = Date.now(); p2GroundType = other.label;
            }
        }
        
        if(targetActive && p.bodyA.label === 'target' && p.bodyB.label.startsWith('clone')) hitTarget(p.bodyB);
        else if(targetActive && p.bodyB.label === 'target' && p.bodyA.label.startsWith('clone')) hitTarget(p.bodyA);
    }
}

function hitTarget(cloneBody) {
    let isP1 = cloneBody.label === 'clone_1';
    let colorHit = isP1 ? p1Color : p2Color;
    
    if (isP1) p1Hits++; else p2Hits++;
    
    Composite.remove(world, cloneBody);
    let idx = physicsCells.indexOf(cloneBody);
    if(idx > -1) physicsCells.splice(idx, 1);
    
    spawnParticles(cloneBody.position.x, cloneBody.position.y, colorHit, 30, 10);
    screenShake = Math.max(screenShake, 15); 
    
    syncScoreboard();

    if(p1Hits >= hitsRequired || p2Hits >= hitsRequired) {
        let winnerLabel = p1Hits >= hitsRequired ? 'clone_1' : 'clone_2';
        let winnerColor = p1Hits >= hitsRequired ? p1Color : p2Color;
        p1Hits = 0; p2Hits = 0;
        currentLevelIdx++;
        syncScoreboard();
        
        if(currentLevelIdx >= measureLevels.length) {
            endGame(winnerColor);
        } else {
            targetActive = false; 
            document.getElementById('target-alert').classList.add('hidden');
            createTarget();
            triggerAvalanche(winnerLabel, winnerColor);
        }
    }
}

function syncScoreboard() {
    document.getElementById('p1-hits-display').innerText = `${p1Hits} / ${hitsRequired}`;
    document.getElementById('p2-hits-display').innerText = `${p2Hits} / ${hitsRequired}`;
    document.getElementById('level-display').innerText = `${Math.min(currentLevelIdx + 1, NUM_LEVELS)} / ${NUM_LEVELS}`;
}

function cullOldCells() {
    // Keep max clones under 200 to prevent lag and clipping pressure
    if(physicsCells.length > 200) {
        let oldest = physicsCells.shift();
        Composite.remove(world, oldest);
    }
}

function shootClone(pBody, facing, label, color) {
    let spawnX = pBody.position.x + facing * 25; let spawnY = pBody.position.y - 10; 
    let clone = Bodies.polygon(spawnX, spawnY, 8, 12, {
        restitution: 0.05, friction: 0.9, frictionStatic: 5.0, density: 0.08,
        label: label, color: color, chamfer: { radius: 2 } 
    });
    Body.setVelocity(clone, { x: facing * 18, y: -4 });
    physicsCells.push(clone); Composite.add(world, clone);
    cullOldCells();
    
    spawnParticles(spawnX, spawnY, color, 10, 4);
    screenShake = Math.max(screenShake, 4); 
}

function triggerAvalanche(winnerLabel, winnerColor) {
    screenShake = 35; 
    let lineY = measureLevels[currentLevelIdx - 1]; 
    let count = 0;
    let avalancheInterval = setInterval(() => {
        if(isPaused) return; 
        for(let i=0; i<3; i++) {
            let dropX = 260 + Math.random() * 280; let dropY = lineY - 200 - Math.random() * 200; 
            let clone = Bodies.polygon(dropX, dropY, 8, 12, {
                restitution: 0.05, friction: 0.9, density: 0.08,
                label: winnerLabel, color: winnerColor, chamfer: { radius: 2 }
            });
            physicsCells.push(clone); Composite.add(world, clone);
            cullOldCells();
            spawnParticles(dropX, dropY + 20, 'white', 2, 4);
        }
        count++; screenShake = 10;
        if (count >= 15) clearInterval(avalancheInterval);
    }, 60);
}

function applyBuoyancy(player) {
    let buriedCount = 0;
    for(let c of physicsCells) {
        if(c.position.y < player.position.y && Math.abs(c.position.x - player.position.x) < 30) buriedCount++;
    }
    if(buriedCount > 1) {
        let lift = Math.min(0.08, 0.015 * buriedCount);
        Body.applyForce(player, player.position, {x: 0, y: -lift});
        if (player.velocity.y < -12) Body.setVelocity(player, { x: player.velocity.x, y: -12 });
    }
}

let aiPhaseTimer = 0;
function runAI() {
    if(player2Body.position.x < 350) { keys['ArrowRight'] = true; keys['ArrowLeft'] = false; }
    else if(player2Body.position.x > 450) { keys['ArrowLeft'] = true; keys['ArrowRight'] = false; }
    else { keys['ArrowLeft'] = false; keys['ArrowRight'] = false; }
    
    if(Math.random() < 0.05) keys['ArrowUp'] = true; else keys['ArrowUp'] = false;
    
    if(Date.now() - p2Fire > fireCooldown * 1.5) {
        shootClone(player2Body, p2Facing, 'clone_2', p2Color);
        p2Fire = Date.now();
    }
}

function updatePhysicsLogic() {
    if(gameOver || isPaused) return;
    
    if(GAME_MODE === '1vAI') runAI();
    
    applyBuoyancy(playerBody); applyBuoyancy(player2Body);
    
    let p1Force = p1GroundType === 'clone_2' ? 0.005 : 0.012; 
    let p1Max = p1GroundType === 'clone_2' ? 3 : 7;
    if (keys['KeyA']) { if (playerBody.velocity.x > -p1Max) Body.applyForce(playerBody, playerBody.position, { x: -p1Force, y: 0 }); p1Facing = -1; }
    if (keys['KeyD']) { if (playerBody.velocity.x < p1Max) Body.applyForce(playerBody, playerBody.position, { x: p1Force, y: 0 }); p1Facing = 1; }
    if (keys['KeyW'] && (Date.now() - p1GroundedTime) < 150 && playerBody.velocity.y > -2) {
        let jumpForce = p1GroundType === 'clone_2' ? -7 : -12; 
        Body.setVelocity(playerBody, { x: playerBody.velocity.x, y: jumpForce }); p1GroundedTime = 0; 
        spawnParticles(playerBody.position.x, playerBody.position.y + 15, 'white', 8, 3);
    }
    
    let p2Force = p2GroundType === 'clone_1' ? 0.005 : 0.012; 
    let p2Max = p2GroundType === 'clone_1' ? 3 : 7;
    if (keys['ArrowLeft']) { if (player2Body.velocity.x > -p2Max) Body.applyForce(player2Body, player2Body.position, { x: -p2Force, y: 0 }); p2Facing = -1; }
    if (keys['ArrowRight']) { if (player2Body.velocity.x < p2Max) Body.applyForce(player2Body, player2Body.position, { x: p2Force, y: 0 }); p2Facing = 1;}
    if (keys['ArrowUp'] && (Date.now() - p2GroundedTime) < 150 && player2Body.velocity.y > -2) {
        let jumpForce = p2GroundType === 'clone_1' ? -7 : -12;
        Body.setVelocity(player2Body, { x: player2Body.velocity.x, y: jumpForce }); p2GroundedTime = 0; 
        spawnParticles(player2Body.position.x, player2Body.position.y + 15, 'white', 8, 3);
    }
    
    if(!targetActive && currentLevelIdx < measureLevels.length) {
        let lineY = measureLevels[currentLevelIdx];
        if(playerBody.position.y <= lineY || player2Body.position.y <= lineY) {
            targetActive = true;
            document.getElementById('target-alert').classList.remove('hidden');
            screenShake = 15;
        }
    }

    if(IS_ONLINE && IS_HOST && conn) {
        conn.send({
            m: 'sync',
            p1: {x: playerBody.position.x, y: playerBody.position.y, f: p1Facing},
            p2: {x: player2Body.position.x, y: player2Body.position.y, f: p2Facing},
            cl: physicsCells.map(c => ({x: c.position.x, y: c.position.y, c: c.color, a: c.angle})),
            s: { p1: p1Hits, p2: p2Hits, l: currentLevelIdx, ta: targetActive },
            over: gameOver, winColor: globalWinnerColor
        });
    }
}

function endGame(winnerColor) {
    gameOver = true;
    globalWinnerColor = winnerColor;
    winnerScreen.classList.remove('hidden');
    document.getElementById('target-alert').classList.add('hidden');
    document.getElementById('winner-text').style.color = winnerColor;
    screenShake = 50; 
}


// ====== RENDER LOOP (Host & Guest) ======
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Unpack Guest Sync Data if Guest
    let renderP1 = null, renderP2 = null, renderCl = [];
    let tubeTopY = measureLevels.length > 0 ? measureLevels[NUM_LEVELS - 1] - 300 : 0;

    if(IS_HOST && playerBody) {
        renderP1 = {x: playerBody.position.x, y: playerBody.position.y, f: p1Facing};
        renderP2 = {x: player2Body.position.x, y: player2Body.position.y, f: p2Facing};
        renderCl = physicsCells;
        
        if(!gameOver) {
            let highestPlayerY = Math.min(renderP1.y, renderP2.y);
            let desiredCameraY = highestPlayerY - 450; 
            if (desiredCameraY > 0) desiredCameraY = 0; 
            cameraY += (desiredCameraY - cameraY) * 0.1;
        } else {
            // Cinematic Win Frame
            let midPointY = (tubeTopY + 700) / 2; 
            cameraY += (midPointY - cameraY) * 0.05; 
            let targetZoom = Math.max(0.2, 700 / (700 - tubeTopY)); // Auto zoom to show entire tube!
            cameraZoom += (targetZoom - cameraZoom) * 0.02;
            
            // Waterfall Fountain from clearly defined top!
            if(Math.random() < 0.2) {
                let clone = Bodies.polygon(400+(Math.random()*200-100), tubeTopY - 50, 8, 15, {restitution:0.1, color:globalWinnerColor});
                Body.setVelocity(clone, { x: (Math.random()-0.5)*20, y: -5 });
                physicsCells.push(clone); Composite.add(world, clone);
                cullOldCells(); // prevents lag!
            }
        }
    } else if(guestSyncFrame) {
        renderP1 = guestSyncFrame.p1;
        renderP2 = guestSyncFrame.p2;
        renderCl = guestSyncFrame.cl;
        
        document.getElementById('p1-hits-display').innerText = `${guestSyncFrame.s.p1} / ${hitsRequired}`;
        document.getElementById('p2-hits-display').innerText = `${guestSyncFrame.s.p2} / ${hitsRequired}`;
        document.getElementById('level-display').innerText = `${Math.min(guestSyncFrame.s.l + 1, NUM_LEVELS)} / ${NUM_LEVELS}`;
        
        if(guestSyncFrame.s.ta) document.getElementById('target-alert').classList.remove('hidden');
        else document.getElementById('target-alert').classList.add('hidden');
        
        if(guestSyncFrame.over && !gameOver) endGame(guestSyncFrame.winColor);

        if(!gameOver) {
            let highestPlayerY = Math.min(renderP1.y, renderP2.y);
            let desiredCameraY = highestPlayerY - 450; 
            if (desiredCameraY > 0) desiredCameraY = 0; 
            cameraY += (desiredCameraY - cameraY) * 0.1;
        } else {
            let midPointY = (tubeTopY + 700) / 2; 
            cameraY += (midPointY - cameraY) * 0.05; 
            let targetZoom = Math.max(0.2, 700 / (700 - tubeTopY)); 
            cameraZoom += (targetZoom - cameraZoom) * 0.02;
        }
    }
    
    ctx.save();
    let cx = canvas.width / 2; let cy = canvas.height / 2;
    ctx.translate(cx, cy); ctx.scale(cameraZoom, cameraZoom); ctx.translate(-cx, -cy);
    ctx.translate(0, -cameraY);
    
    // Even if renderP1 isn't available for guest initially, draw background logic
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }
    
    // Draw Tube Bounds matching calculated lengths
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(250, tubeTopY, 300, 700 - tubeTopY);

    ctx.lineWidth = 2;
    for(let i=0; i<NUM_LEVELS; i++) {
        let y = measureLevels[i];
        let cl = IS_HOST ? currentLevelIdx : (guestSyncFrame ? guestSyncFrame.s.l : 0);
        ctx.strokeStyle = i === cl ? 'white' : 'rgba(255, 255, 255, 0.2)';
        
        ctx.beginPath();
        if (i >= cl) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
        
        ctx.moveTo(250, y); ctx.lineTo(550, y); ctx.stroke();
        
        ctx.globalAlpha = 0.1; ctx.font = "bold 48px Inter"; ctx.fillStyle = "white"; ctx.textAlign = "center";
        ctx.fillText(`LVL ${i+1}`, 400, y - 50); ctx.globalAlpha = 1.0; ctx.setLineDash([]); 
    }

    let isTa = IS_HOST ? targetActive : (guestSyncFrame ? guestSyncFrame.s.ta : false);
    let cl = IS_HOST ? currentLevelIdx : (guestSyncFrame ? guestSyncFrame.s.l : 0);
    if(cl < NUM_LEVELS) {
        let ty = measureLevels[cl] - 20;
        let pulse = Math.abs(Math.sin(Date.now() / 200)) * 0.2 + 0.1;
        ctx.fillStyle = isTa ? `rgba(255, 215, 0, ${pulse})` : 'rgba(100, 100, 100, 0.1)';
        ctx.shadowBlur = isTa ? 25 : 0; ctx.shadowColor = 'gold';
        ctx.fillRect(250, ty - 2, 300, 24); ctx.shadowBlur = 0;
    }

    if(renderP1) {
        for(let pc of renderCl) {
            let x = pc.x || pc.position.x; let y = pc.y || pc.position.y; let c = pc.c || pc.color;
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.arc(x - 4, y - 4, 3, 0, Math.PI*2); ctx.fill();
        }

        const drawP = (x, y, color, facing) => {
            ctx.fillStyle = color; ctx.shadowBlur = 20; ctx.shadowColor = color;
            ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(x + (facing * 8), y - 4, 6, 0, Math.PI * 2); ctx.fill();
        };

        drawP(renderP2.x, renderP2.y, p2Color, renderP2.f);
        drawP(renderP1.x, renderP1.y, p1Color, renderP1.f); 
    }
    
    // Tube Border Foreground Lines matching tube dimensions exactly
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 4;
    ctx.beginPath(); 
    ctx.moveTo(250, tubeTopY); ctx.lineTo(250, 700);
    ctx.moveTo(550, tubeTopY); ctx.lineTo(550, 700); 
    ctx.moveTo(250, 700); ctx.lineTo(550, 700); ctx.stroke();

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
}

function gameLoop() {
    draw();
    if(!isPaused) requestAnimationFrame(gameLoop);
}
