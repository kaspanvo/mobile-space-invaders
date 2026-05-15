"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Coins, Heart, Rocket, Volume2, VolumeX } from "lucide-react"

interface Invader {
  id: number
  x: number
  y: number
  alive: boolean
}

interface Bullet {
  id: number
  x: number
  y: number
}

interface EnemyBullet {
  id: number
  x: number
  y: number
}

/** Deterministic 0..1 from index — same on server and client (no Math.random() in render). */
function starField01(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 43758.5453) * 43758.5453
  return x - Math.floor(x)
}

export default function SpaceInvaderGame() {
  const [playerX, setPlayerX] = useState(145)
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [enemyBullets, setEnemyBullets] = useState<EnemyBullet[]>([])
  const [invaders, setInvaders] = useState<Invader[]>([])
  const [coins, setCoins] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameOver, setGameOver] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [level, setLevel] = useState(1)
  const [invaderDirection, setInvaderDirection] = useState(1)
  const [soundOn, setSoundOn] = useState(true)
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const bulletIdRef = useRef(0)
  const enemyBulletIdRef = useRef(0)

  const GAME_WIDTH = 300
  const GAME_HEIGHT = 500
  const PLAYER_WIDTH = 30
  const INVADER_SIZE = 24
  const BULLET_SIZE = 6

  const initInvaders = useCallback(() => {
    const newInvaders: Invader[] = []
    let id = 0
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        newInvaders.push({
          id: id++,
          x: 20 + col * 32,
          y: 40 + row * 32,
          alive: true,
        })
      }
    }
    return newInvaders
  }, [])

  const startGame = () => {
    setGameStarted(true)
    setGameOver(false)
    setCoins(0)
    setLives(3)
    setLevel(1)
    setPlayerX(145)
    setBullets([])
    setEnemyBullets([])
    setInvaders(initInvaders())
    setInvaderDirection(1)
  }

  const shoot = useCallback(() => {
    if (gameOver || !gameStarted) return
    setBullets((prev) => [
      ...prev,
      { id: bulletIdRef.current++, x: playerX + PLAYER_WIDTH / 2 - BULLET_SIZE / 2, y: GAME_HEIGHT - 60 },
    ])
  }, [playerX, gameOver, gameStarted])

  // Move player with touch
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!gameAreaRef.current || gameOver || !gameStarted) return
      const rect = gameAreaRef.current.getBoundingClientRect()
      const touchX = e.touches[0].clientX - rect.left
      const newX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_WIDTH, touchX - PLAYER_WIDTH / 2))
      setPlayerX(newX)
    },
    [gameOver, gameStarted]
  )

  // Move bullets
  useEffect(() => {
    if (!gameStarted || gameOver) return
    const interval = setInterval(() => {
      setBullets((prev) => prev.map((b) => ({ ...b, y: b.y - 8 })).filter((b) => b.y > -10))
    }, 30)
    return () => clearInterval(interval)
  }, [gameStarted, gameOver])

  // Move enemy bullets
  useEffect(() => {
    if (!gameStarted || gameOver) return
    const interval = setInterval(() => {
      setEnemyBullets((prev) => prev.map((b) => ({ ...b, y: b.y + 5 })).filter((b) => b.y < GAME_HEIGHT))
    }, 30)
    return () => clearInterval(interval)
  }, [gameStarted, gameOver])

  // Enemy shooting
  useEffect(() => {
    if (!gameStarted || gameOver) return
    const interval = setInterval(() => {
      const aliveInvaders = invaders.filter((i) => i.alive)
      if (aliveInvaders.length > 0) {
        const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)]
        setEnemyBullets((prev) => [
          ...prev,
          { id: enemyBulletIdRef.current++, x: shooter.x + INVADER_SIZE / 2, y: shooter.y + INVADER_SIZE },
        ])
      }
    }, 1500 - level * 100)
    return () => clearInterval(interval)
  }, [gameStarted, gameOver, invaders, level])

  // Move invaders
  useEffect(() => {
    if (!gameStarted || gameOver) return
    const interval = setInterval(() => {
      setInvaders((prev) => {
        const aliveInvaders = prev.filter((i) => i.alive)
        if (aliveInvaders.length === 0) return prev

        const minX = Math.min(...aliveInvaders.map((i) => i.x))
        const maxX = Math.max(...aliveInvaders.map((i) => i.x))

        let newDirection = invaderDirection
        let moveDown = false

        if (maxX >= GAME_WIDTH - INVADER_SIZE - 10 && invaderDirection === 1) {
          newDirection = -1
          moveDown = true
        } else if (minX <= 10 && invaderDirection === -1) {
          newDirection = 1
          moveDown = true
        }

        if (newDirection !== invaderDirection) {
          setInvaderDirection(newDirection)
        }

        return prev.map((i) => ({
          ...i,
          x: i.x + newDirection * 5,
          y: moveDown ? i.y + 15 : i.y,
        }))
      })
    }, 500 - level * 30)
    return () => clearInterval(interval)
  }, [gameStarted, gameOver, invaderDirection, level])

  // Collision detection
  useEffect(() => {
    if (!gameStarted || gameOver) return

    // Player bullets hitting invaders
    setBullets((prevBullets) => {
      let updatedBullets = [...prevBullets]
      setInvaders((prevInvaders) => {
        return prevInvaders.map((invader) => {
          if (!invader.alive) return invader
          const hitBullet = updatedBullets.find(
            (b) =>
              b.x < invader.x + INVADER_SIZE &&
              b.x + BULLET_SIZE > invader.x &&
              b.y < invader.y + INVADER_SIZE &&
              b.y + BULLET_SIZE > invader.y
          )
          if (hitBullet) {
            updatedBullets = updatedBullets.filter((b) => b.id !== hitBullet.id)
            setCoins((c) => c + 10)
            return { ...invader, alive: false }
          }
          return invader
        })
      })
      return updatedBullets
    })

    // Enemy bullets hitting player
    setEnemyBullets((prevEnemyBullets) => {
      const hitBullet = prevEnemyBullets.find(
        (b) =>
          b.x < playerX + PLAYER_WIDTH &&
          b.x + BULLET_SIZE > playerX &&
          b.y > GAME_HEIGHT - 50 &&
          b.y < GAME_HEIGHT - 20
      )
      if (hitBullet) {
        setLives((l) => {
          const newLives = l - 1
          if (newLives <= 0) {
            setGameOver(true)
          }
          return newLives
        })
        return prevEnemyBullets.filter((b) => b.id !== hitBullet.id)
      }
      return prevEnemyBullets
    })

    // Check if invaders reached bottom
    const reachedBottom = invaders.some((i) => i.alive && i.y > GAME_HEIGHT - 80)
    if (reachedBottom) {
      setGameOver(true)
    }

    // Check level complete
    const allDead = invaders.length > 0 && invaders.every((i) => !i.alive)
    if (allDead) {
      setLevel((l) => l + 1)
      setInvaders(initInvaders())
      setCoins((c) => c + 100)
    }
  }, [bullets, enemyBullets, invaders, playerX, gameStarted, gameOver, initInvaders])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Mobile Phone Frame */}
      <div className="relative">
        {/* Phone outer case */}
        <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-[3rem] p-3 shadow-2xl shadow-purple-500/20">
          {/* Phone inner bezel */}
          <div className="bg-black rounded-[2.5rem] p-2 relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-20 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-800" />
              <div className="w-16 h-1 rounded-full bg-gray-800" />
            </div>

            {/* Screen */}
            <div className="w-[320px] h-[640px] bg-gradient-to-b from-indigo-950 via-slate-900 to-black rounded-[2rem] overflow-hidden relative">
              {/* Status bar */}
              <div className="h-12 bg-black/50 flex items-end justify-between px-6 pb-1 text-white text-xs">
                <span>9:41</span>
                <div className="flex gap-1 items-center">
                  <div className="w-4 h-2 border border-white rounded-sm relative">
                    <div className="absolute inset-0.5 bg-green-500 rounded-sm" style={{ width: "70%" }} />
                  </div>
                </div>
              </div>

              {/* Coins Section */}
              <div className="px-4 py-2 flex justify-between items-center bg-gradient-to-r from-yellow-500/20 to-orange-500/20 mx-2 mt-1 rounded-xl border border-yellow-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                    <Coins className="w-5 h-5 text-yellow-900" />
                  </div>
                  <div>
                    <p className="text-yellow-400 text-xs font-medium">COINS</p>
                    <p className="text-white font-bold text-lg leading-none">{coins.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[...Array(3)].map((_, i) => (
                      <Heart
                        key={i}
                        className={`w-5 h-5 ${i < lives ? "text-red-500 fill-red-500" : "text-gray-600"}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setSoundOn(!soundOn)}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                  >
                    {soundOn ? (
                      <Volume2 className="w-4 h-4 text-white" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Level indicator */}
              <div className="text-center py-1">
                <span className="text-purple-400 text-xs font-medium tracking-widest">LEVEL {level}</span>
              </div>

              {/* Game Area */}
              <div
                ref={gameAreaRef}
                className="mx-auto bg-gradient-to-b from-transparent to-purple-900/20 relative touch-none"
                style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
                onTouchMove={handleTouchMove}
                onTouchStart={(e) => {
                  handleTouchMove(e)
                  shoot()
                }}
              >
                {/* Stars background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(30)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                      style={{
                        left: `${starField01(i, 1) * 100}%`,
                        top: `${starField01(i, 2) * 100}%`,
                        animationDelay: `${starField01(i, 3) * 2}s`,
                        opacity: starField01(i, 4) * 0.7 + 0.3,
                      }}
                    />
                  ))}
                </div>

                {/* Invaders */}
                {invaders
                  .filter((i) => i.alive)
                  .map((invader) => (
                    <div
                      key={invader.id}
                      className="absolute transition-all duration-100"
                      style={{ left: invader.x, top: invader.y, width: INVADER_SIZE, height: INVADER_SIZE }}
                    >
                      <div className="w-full h-full bg-gradient-to-b from-green-400 to-green-600 rounded-md relative">
                        <div className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full" />
                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-green-800 rounded" />
                      </div>
                    </div>
                  ))}

                {/* Player bullets */}
                {bullets.map((bullet) => (
                  <div
                    key={bullet.id}
                    className="absolute bg-gradient-to-t from-cyan-400 to-white rounded-full shadow-lg shadow-cyan-400/50"
                    style={{
                      left: bullet.x,
                      top: bullet.y,
                      width: BULLET_SIZE,
                      height: 12,
                    }}
                  />
                ))}

                {/* Enemy bullets */}
                {enemyBullets.map((bullet) => (
                  <div
                    key={bullet.id}
                    className="absolute bg-gradient-to-b from-red-400 to-red-600 rounded-full shadow-lg shadow-red-500/50"
                    style={{
                      left: bullet.x,
                      top: bullet.y,
                      width: BULLET_SIZE,
                      height: 10,
                    }}
                  />
                ))}

                {/* Player */}
                <div
                  className="absolute bottom-8 transition-all duration-75"
                  style={{ left: playerX, width: PLAYER_WIDTH }}
                >
                  <div className="relative">
                    <Rocket className="w-8 h-10 text-cyan-400 rotate-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-6 bg-gradient-to-b from-orange-500 to-yellow-300 rounded-full blur-sm animate-pulse" />
                  </div>
                </div>

                {/* Game Over / Start Screen */}
                {(!gameStarted || gameOver) && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                    {gameOver && (
                      <>
                        <h2 className="text-red-500 text-3xl font-bold mb-2">GAME OVER</h2>
                        <p className="text-white mb-2">
                          Final Score: <span className="text-yellow-400">{coins}</span>
                        </p>
                        <p className="text-gray-400 text-sm mb-6">Level reached: {level}</p>
                      </>
                    )}
                    {!gameStarted && !gameOver && (
                      <>
                        <div className="text-4xl mb-4">👾</div>
                        <h1 className="text-white text-2xl font-bold mb-2">SPACE INVADERS</h1>
                        <p className="text-gray-400 text-sm mb-6 text-center px-4">
                          Drag to move • Tap to shoot
                        </p>
                      </>
                    )}
                    <button
                      onClick={startGame}
                      className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-full shadow-lg shadow-purple-500/50 active:scale-95 transition-transform"
                    >
                      {gameOver ? "PLAY AGAIN" : "START GAME"}
                    </button>
                  </div>
                )}
              </div>

              {/* Control hint */}
              {gameStarted && !gameOver && (
                <div className="text-center py-2">
                  <p className="text-gray-500 text-xs">Drag to move • Tap to shoot</p>
                </div>
              )}

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
            </div>
          </div>
        </div>

        {/* Side buttons */}
        <div className="absolute right-0 top-28 w-1 h-16 bg-gray-700 rounded-l-sm" />
        <div className="absolute left-0 top-24 w-1 h-8 bg-gray-700 rounded-r-sm" />
        <div className="absolute left-0 top-36 w-1 h-12 bg-gray-700 rounded-r-sm" />
        <div className="absolute left-0 top-52 w-1 h-12 bg-gray-700 rounded-r-sm" />
      </div>
    </div>
  )
}
