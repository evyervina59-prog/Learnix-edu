import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- GAME CONFIGURATION ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_Y = 30; // height of the ground
const GRAVITY = -0.7; // Pulls the player down
const INITIAL_JUMP_VELOCITY = 15; // Initial burst of speed when jump starts
const JUMP_FORCE = 0.6; // Additional upward force applied while holding jump
const MAX_JUMP_DURATION = 15; // Max frames to apply jump force
const PLAYER_X_POS = 50; // Initial screen position for player

const PLAYER_WIDTH = 64;
const PLAYER_HEIGHT = 48;
const OBSTACLE_WIDTH = 50;
const COIN_SIZE = 32;
const ENEMY_SIZE = 40;
const ENEMY_MOVE_RANGE = 80; // Pixels an enemy will move left/right from its spawn point
const ENEMY_MOUTH_ANIM_RATE = 20; // Toggle mouth every 20 frames

// --- LEVEL CONFIGURATION ---
const LEVEL_CONFIGS = [
    // Level 1: Mudah
    { name: "Muddy Puddle", scoreToNextLevel: 50, gameSpeed: 5, obstacleSpawnRate: 150, coinSpawnRate: 70, enemySpawnRate: 300, enemySpeed: 1.5 },
    // Level 2: Sedang
    { name: "Grassy Plains", scoreToNextLevel: 100, gameSpeed: 6, obstacleSpawnRate: 90, coinSpawnRate: 80, enemySpawnRate: 200, enemySpeed: 2.0 },
    // Level 3: Cukup Sulit
    { name: "The Bumpy Road", scoreToNextLevel: 150, gameSpeed: 7, obstacleSpawnRate: 80, coinSpawnRate: 90, enemySpawnRate: 150, enemySpeed: 2.5 },
    // Level 4: Sulit
    { name: "Germ Warfare", scoreToNextLevel: 200, gameSpeed: 8, obstacleSpawnRate: 70, coinSpawnRate: 100, enemySpawnRate: 120, enemySpeed: 3.0 },
    // Level 5: Sangat Sulit
    { name: "Capy-pocalypse!", scoreToNextLevel: 250, gameSpeed: 10, obstacleSpawnRate: 60, coinSpawnRate: 110, enemySpawnRate: 100, enemySpeed: 3.5 }
];

// --- TYPE DEFINITIONS ---
type GameState = 'start' | 'playing' | 'gameOver' | 'win';

interface PlayerState {
    x: number;
    y: number;
    vy: number;
}

interface GameObject {
    id: number;
    x: number;
}

interface Obstacle extends GameObject {
    height: number;
}

interface Coin extends GameObject {
    y: number;
}

interface Enemy extends GameObject {
    y: number;
    initialX: number;
    vx: number;
    mouthOpen: boolean;
}


// --- HELPER COMPONENTS (defined outside main component) ---

const Capybara: React.FC<{ x: number, y: number }> = ({ x, y }) => (
    <div
        className="absolute transition-transform duration-100"
        style={{
            width: `${PLAYER_WIDTH}px`,
            height: `${PLAYER_HEIGHT}px`,
            left: `${x}px`,
            bottom: `${y + GROUND_Y}px`,
        }}
    >
        <div className="w-full h-full bg-amber-700 rounded-xl border-2 border-amber-900 relative">
             {/* Eyes */}
            <div className="absolute top-4 left-4 w-2.5 h-2.5 bg-black rounded-full"></div>
            <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-black rounded-full"></div>
            {/* Nose */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-6 h-3 bg-amber-900 rounded-b-md"></div>
             {/* Ears */}
            <div className="absolute -top-1 -left-1 w-5 h-5 bg-amber-600 rounded-t-full rounded-l-full transform -rotate-45 border-l-2 border-t-2 border-amber-900"></div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-600 rounded-t-full rounded-r-full transform rotate-45 border-r-2 border-t-2 border-amber-900"></div>
        </div>
    </div>
);

const BrickObstacle: React.FC<Obstacle> = ({ x, height }) => (
    <div
        className="absolute bg-red-800 border-x-2 border-t-2 border-red-950"
        style={{
            width: `${OBSTACLE_WIDTH}px`,
            height: `${height}px`,
            left: `${x}px`,
            bottom: `${GROUND_Y}px`,
            boxSizing: 'border-box',
        }}
    >
    </div>
);

const CoinDisplay: React.FC<Coin> = ({ x, y }) => (
    <div
        className="absolute w-8 h-8 bg-yellow-400 rounded-full border-2 border-yellow-600 flex items-center justify-center font-bold text-yellow-800 text-xl shadow-lg"
        style={{
            width: `${COIN_SIZE}px`,
            height: `${COIN_SIZE}px`,
            left: `${x}px`,
            bottom: `${y + GROUND_Y}px`,
        }}
    >
        C
    </div>
);

const GermEnemy: React.FC<Omit<Enemy, 'id' | 'initialX' | 'vx'>> = ({ x, y, mouthOpen }) => (
     <div
        className="absolute flex items-center justify-center"
        style={{
            width: `${ENEMY_SIZE}px`,
            height: `${ENEMY_SIZE}px`,
            left: `${x}px`,
            bottom: `${y + GROUND_Y}px`,
        }}
    >
        <div className="w-full h-full bg-green-500 rounded-full border-2 border-green-700 relative animate-bounce">
             {/* Eyes */}
            <div className="absolute top-3 left-3 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-black rounded-full"></div>
            </div>
            <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
                 <div className="w-1 h-1 bg-black rounded-full"></div>
            </div>
            {/* Mouth */}
            {mouthOpen ? (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-t-[12px] border-t-white border-r-[10px] border-r-transparent"></div>
            ) : (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-green-700 rounded-full"></div>
            )}
        </div>
    </div>
);

// --- MAIN APP COMPONENT ---

export default function App() {
    const [gameState, setGameState] = useState<GameState>('start');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [level, setLevel] = useState(1);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [tick, setTick] = useState(0);

    const playerRef = useRef<PlayerState>({ x: PLAYER_X_POS, y: 0, vy: 0 });
    const obstaclesRef = useRef<Obstacle[]>([]);
    const coinsRef = useRef<Coin[]>([]);
    const enemiesRef = useRef<Enemy[]>([]);
    const frameCountRef = useRef(0);
    const cameraXRef = useRef(0);
    const gameLoopRef = useRef<number | null>(null);

    const isJumpingRef = useRef(false);
    const jumpDurationRef = useRef(0);
    const levelRef = useRef(1);
    const scoreRef = useRef(0);
    const levelUpTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const storedHighScore = localStorage.getItem('capybaraHighScore');
        if (storedHighScore) {
            setHighScore(parseInt(storedHighScore, 10));
        }
    }, []);

    const resetGame = useCallback(() => {
        playerRef.current = { x: PLAYER_X_POS, y: 0, vy: 0 };
        cameraXRef.current = 0;
        obstaclesRef.current = [];
        coinsRef.current = [];
        enemiesRef.current = [];
        frameCountRef.current = 0;
        isJumpingRef.current = false;
        jumpDurationRef.current = 0;
        setScore(0);
        scoreRef.current = 0;
        setLevel(1);
        levelRef.current = 1;
        setShowLevelUp(false);
        if (levelUpTimeoutRef.current) {
            clearTimeout(levelUpTimeoutRef.current);
        }
    }, []);

    const startGame = useCallback(() => {
        resetGame();
        setGameState('playing');
    }, [resetGame]);
    
    const gameOver = useCallback(() => {
        setGameState('gameOver');
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('capybaraHighScore', score.toString());
        }
    }, [score, highScore]);
    
    const winGame = useCallback(() => {
        setGameState('win');
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('capybaraHighScore', score.toString());
        }
    }, [score, highScore]);


    const handleJumpStart = useCallback(() => {
        if (gameState === 'playing') {
            if (playerRef.current.y === 0) { // Can only start a jump from the ground
                isJumpingRef.current = true;
                jumpDurationRef.current = 0;
                playerRef.current.vy = INITIAL_JUMP_VELOCITY;
            }
        } else if (gameState === 'start' || gameState === 'gameOver' || gameState === 'win') {
            startGame();
        }
    }, [gameState, startGame]);

    const handleJumpEnd = useCallback(() => {
        isJumpingRef.current = false;
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (!e.repeat) handleJumpStart();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
             if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                handleJumpEnd();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousedown', handleJumpStart);
        window.addEventListener('mouseup', handleJumpEnd);
        window.addEventListener('touchstart', handleJumpStart);
        window.addEventListener('touchend', handleJumpEnd);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousedown', handleJumpStart);
            window.removeEventListener('mouseup', handleJumpEnd);
            window.removeEventListener('touchstart', handleJumpStart);
            window.removeEventListener('touchend', handleJumpEnd);
        };
    }, [handleJumpStart, handleJumpEnd]);
    
    const gameLoop = useCallback(() => {
        if (gameState !== 'playing') return;
        frameCountRef.current++;
        const config = LEVEL_CONFIGS[levelRef.current - 1];

        // --- Player physics ---
        playerRef.current.x += config.gameSpeed;

        if (isJumpingRef.current && jumpDurationRef.current < MAX_JUMP_DURATION) {
            playerRef.current.vy += JUMP_FORCE;
            jumpDurationRef.current++;
        }
        playerRef.current.vy += GRAVITY;
        playerRef.current.y += playerRef.current.vy;

        if (playerRef.current.y < 0) {
            playerRef.current.y = 0;
            playerRef.current.vy = 0;
        }

        const targetCameraX = playerRef.current.x - PLAYER_X_POS;
        cameraXRef.current += (targetCameraX - cameraXRef.current) * 0.1;

        // --- Update enemy states ---
        enemiesRef.current.forEach(enemy => {
            enemy.vx = Math.sign(enemy.vx) * config.enemySpeed;
            enemy.x += enemy.vx;
            if (Math.abs(enemy.x - enemy.initialX) >= ENEMY_MOVE_RANGE) {
                enemy.x = enemy.initialX + Math.sign(enemy.vx) * ENEMY_MOVE_RANGE;
                enemy.vx *= -1;
            }
            if (frameCountRef.current % ENEMY_MOUTH_ANIM_RATE === 0) {
                enemy.mouthOpen = !enemy.mouthOpen;
            }
        });

        // Despawn objects
        obstaclesRef.current = obstaclesRef.current.filter(o => o.x > cameraXRef.current - OBSTACLE_WIDTH);
        coinsRef.current = coinsRef.current.filter(c => c.x > cameraXRef.current - COIN_SIZE);
        enemiesRef.current = enemiesRef.current.filter(e => e.x > cameraXRef.current - (ENEMY_SIZE + ENEMY_MOVE_RANGE * 2));


        // Spawning logic
        if (frameCountRef.current % config.obstacleSpawnRate === 0) {
            const height = Math.random() * 100 + 50;
            obstaclesRef.current.push({ id: Date.now(), x: cameraXRef.current + GAME_WIDTH, height });
        }
         if (frameCountRef.current % config.coinSpawnRate === 0) {
            const y = Math.random() * 150 + 100;
            coinsRef.current.push({ id: Date.now(), x: cameraXRef.current + GAME_WIDTH, y });
        }
        if (frameCountRef.current % config.enemySpawnRate === 0) {
            const initialX = cameraXRef.current + GAME_WIDTH;
            enemiesRef.current.push({
                id: Date.now(),
                x: initialX,
                y: 0,
                initialX: initialX,
                vx: -config.enemySpeed,
                mouthOpen: true,
            });
        }

        // Collision detection
        const playerBox = { x: playerRef.current.x, y: playerRef.current.y + GROUND_Y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
        
        for (const obstacle of obstaclesRef.current) {
            const obstacleBox = { x: obstacle.x, y: GROUND_Y, width: OBSTACLE_WIDTH, height: obstacle.height };
             if (playerBox.x < obstacleBox.x + obstacleBox.width && playerBox.x + playerBox.width > obstacleBox.x && playerBox.y < obstacleBox.y + obstacleBox.height && playerBox.y + playerBox.height > obstacleBox.y) { gameOver(); return; }
        }
        
         for (const enemy of enemiesRef.current) {
            const enemyBox = { x: enemy.x, y: enemy.y + GROUND_Y, width: ENEMY_SIZE, height: ENEMY_SIZE };
             if (playerBox.x < enemyBox.x + enemyBox.width && playerBox.x + playerBox.width > enemyBox.x && playerBox.y < enemyBox.y + enemyBox.height && playerBox.y + playerBox.height > enemyBox.y) { gameOver(); return; }
        }

        const collectedCoinIds = new Set<number>();
        let coinsCollectedThisFrame = 0;
        for (const coin of coinsRef.current) {
             const coinBox = { x: coin.x, y: coin.y + GROUND_Y, width: COIN_SIZE, height: COIN_SIZE };
             if (playerBox.x < coinBox.x + coinBox.width && playerBox.x + playerBox.width > coinBox.x && playerBox.y < coinBox.y + coinBox.height && playerBox.y + playerBox.height > coinBox.y) {
                collectedCoinIds.add(coin.id);
                coinsCollectedThisFrame++;
            }
        }
        if (coinsCollectedThisFrame > 0) {
            const newScore = scoreRef.current + coinsCollectedThisFrame * 10;
            scoreRef.current = newScore;
            setScore(newScore);
        }
        if (collectedCoinIds.size > 0) {
            coinsRef.current = coinsRef.current.filter(c => !collectedCoinIds.has(c.id));
        }

        // --- Level Progression ---
        const currentLevelIndex = levelRef.current - 1;
        const nextLevelThreshold = LEVEL_CONFIGS[currentLevelIndex].scoreToNextLevel;

        if (scoreRef.current >= nextLevelThreshold) {
            // Check if it's the last level
            if (currentLevelIndex === LEVEL_CONFIGS.length - 1) {
                // Reached score target on the final level -> WIN
                winGame();
                return; // Stop the loop
            } else {
                // Not the last level -> Level Up
                levelRef.current++;
                setLevel(l => l + 1);
                setShowLevelUp(true);
                if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
                levelUpTimeoutRef.current = window.setTimeout(() => setShowLevelUp(false), 2000);
            }
        }


        setTick(t => t + 1);
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [gameState, gameOver, winGame]);

    useEffect(() => {
        if (gameState === 'playing') {
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [gameState, gameLoop]);
    
    const cameraX = cameraXRef.current;
    
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 font-sans p-4">
            <h1 className="text-4xl md:text-5xl font-bold text-amber-400 mb-4 tracking-wider" style={{ textShadow: '2px 2px 0 #000' }}>
                Capybara Jump Adventure
            </h1>
            <div
                className="relative bg-gradient-to-b from-sky-400 to-sky-600 rounded-lg shadow-2xl overflow-hidden border-4 border-gray-900"
                style={{ width: `${GAME_WIDTH}px`, height: `${GAME_HEIGHT}px` }}
            >
                {/* Game Screen */}
                {gameState !== 'start' && (
                     <>
                        {/* Render Game Objects */}
                        {obstaclesRef.current.map(o => <BrickObstacle key={o.id} {...o} x={o.x - cameraX} />)}
                        {coinsRef.current.map(c => <CoinDisplay key={c.id} {...c} x={c.x - cameraX} />)}
                        {enemiesRef.current.map(e => <GermEnemy key={e.id} {...e} x={e.x - cameraX} />)}
                        <Capybara x={playerRef.current.x - cameraX} y={playerRef.current.y} />
                        
                        {/* Ground */}
                        <div className="absolute bottom-0 left-0 w-full bg-green-700 pattern-grass" style={{ height: `${GROUND_Y}px`, backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.1) 2px, transparent 2px)', backgroundSize: '20px 20px', backgroundPositionX: `-${cameraX % 20}px` }}></div>
                        <div className="absolute bottom-0 left-0 w-full h-2 bg-amber-900" style={{ top: `${GAME_HEIGHT-GROUND_Y-2}px` }}></div>
                     </>
                )}

                {/* UI Screens */}
                {gameState === 'start' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 text-white">
                        <div className="text-6xl mb-4">🐹</div>
                        <h2 className="text-4xl font-bold mb-4">Ready to Jump?</h2>
                        <button
                            onClick={startGame}
                            className="px-8 py-4 bg-yellow-500 text-gray-900 font-bold text-2xl rounded-lg shadow-lg hover:bg-yellow-400 transform hover:scale-105 transition-transform"
                        >
                            Start Game
                        </button>
                    </div>
                )}
                {gameState === 'gameOver' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 text-white">
                        <h2 className="text-5xl font-bold mb-2">Game Over</h2>
                        <p className="text-2xl mb-4">Your Score: {score}</p>
                        <button
                            onClick={startGame}
                            className="px-8 py-4 bg-yellow-500 text-gray-900 font-bold text-2xl rounded-lg shadow-lg hover:bg-yellow-400 transform hover:scale-105 transition-transform"
                        >
                            Try Again
                        </button>
                    </div>
                )}
                
                 {gameState === 'win' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-400 bg-opacity-90 text-gray-900">
                        <div className="text-6xl mb-4 animate-bounce">🏆</div>
                        <h2 className="text-5xl font-bold mb-2" style={{ textShadow: '2px 2px 0 #fff' }}>You Won!</h2>
                        <p className="text-2xl mb-4">Final Score: {score}</p>
                        <p className="text-xl mb-6 font-semibold">You're a true Capybara Champion!</p>
                        <button
                            onClick={startGame}
                            className="px-8 py-4 bg-green-600 text-white font-bold text-2xl rounded-lg shadow-lg hover:bg-green-500 transform hover:scale-105 transition-transform"
                        >
                            Play Again
                        </button>
                    </div>
                )}
                
                {showLevelUp && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 pointer-events-none z-10">
                        <h2 className="text-6xl font-bold text-yellow-400 animate-pulse" style={{ textShadow: '3px 3px 0 #000' }}>Level Up!</h2>
                        <p className="text-3xl text-white mt-2">Level {level}: {LEVEL_CONFIGS[level-1].name}</p>
                    </div>
                )}


                {/* Score Display */}
                <div className="absolute top-2 left-2 text-white text-xl font-bold p-2 bg-black bg-opacity-40 rounded-lg text-left">
                    <p>Score: {score}</p>
                    <p>Level: {level} </p>
                </div>
                 <div className="absolute top-2 right-2 text-white text-xl font-bold p-2 bg-black bg-opacity-40 rounded-lg">
                    High Score: {highScore}
                </div>
            </div>
            <div className="text-center text-gray-400 mt-4">
                <p>Use <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Spacebar</kbd> or Click/Tap to Jump</p>
            </div>
        </div>
    );
}
