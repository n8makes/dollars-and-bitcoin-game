class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        // Enable GPU acceleration hints
        this.canvas.style.transform = 'translateZ(0)';
        this.canvas.style.backfaceVisibility = 'hidden';
        this.score = 0;
        this.timeLeft = 30;
        this.gameRunning = false;
        this.targets = [];
        this.particles = [];
        this.starLayers = [
            [], // distant stars (slow)
            [], // medium distance stars
            []  // close stars (fast)
        ];
        this.audio = new AudioManager();
        this.stats = {
            dollars: 0,
            bitcoin: {
                count: 0,
                points: 0
            }
        };
        
        // Initialize star layers
        this.initStars();
        
        // Bitcoin price tracking
        this.bitcoinValue = 1;
        this.bitcoinHistory = Array(20).fill(1);
        this.bitcoinChart = null;
        this.lastBitcoinUpdate = Date.now();
        this.bitcoinUpdateInterval = 2000; // Update every 2 seconds

        this.resize();
        this.setupEventListeners();
    }
    
    shakeScreen() {
        const intensity = 5;
        const duration = 150;
        const gameContainer = document.querySelector('.game-container');
        const startTime = performance.now();
        
        function shake(currentTime) {
            const elapsed = currentTime - startTime;
            if (elapsed < duration) {
                const damping = 1 - (elapsed / duration);
                const dx = (Math.random() * 2 - 1) * intensity * damping;
                const dy = (Math.random() * 2 - 1) * intensity * damping;
                gameContainer.style.transform = `translate(${dx}px, ${dy}px)`;
                requestAnimationFrame(shake);
            } else {
                gameContainer.style.transform = 'translate(0, 0)';
            }
        }
        
        requestAnimationFrame(shake);
    }
    
    vibrate() {
        if ('vibrate' in navigator) {
            navigator.vibrate(50); // 50ms vibration
        }
    }
    initStars() {
        const layerConfigs = [
            { density: 25000, speedRange: [0.1, 0.3], sizeRange: [1, 2], brightness: [0.3, 0.5] },    // distant stars
            { density: 20000, speedRange: [0.3, 0.6], sizeRange: [1.5, 2.5], brightness: [0.5, 0.7] }, // medium stars
            { density: 15000, speedRange: [0.6, 1.0], sizeRange: [2, 3], brightness: [0.7, 1.0] }      // close stars
        ];

        layerConfigs.forEach((config, layerIndex) => {
            const numStars = Math.floor((this.canvas.width * this.canvas.height) / config.density);
            for (let i = 0; i < numStars; i++) {
                this.starLayers[layerIndex].push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    size: Math.random() * (config.sizeRange[1] - config.sizeRange[0]) + config.sizeRange[0],
                    speed: Math.random() * (config.speedRange[1] - config.speedRange[0]) + config.speedRange[0],
                    brightness: Math.random() * (config.brightness[1] - config.brightness[0]) + config.brightness[0],
                    twinkleSpeed: Math.random() * 0.02 + 0.01
                });
            }
        });
    }

    updateStars() {
        this.starLayers.forEach(layer => {
            layer.forEach(star => {
                star.y += star.speed;
                if (star.y > this.canvas.height) {
                    star.y = 0;
                    star.x = Math.random() * this.canvas.width;
                }
            });
        });
    }

    drawStars() {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.starLayers.forEach((layer, index) => {
            layer.forEach(star => {
                const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.x);
                const opacity = star.brightness * (0.7 + twinkle * 0.3);
                this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            });
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.handleClick(e.clientX, e.clientY));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleClick(touch.clientX, touch.clientY);
        });

        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('restartButton').addEventListener('click', () => this.startGame());
        document.getElementById('stopButton').addEventListener('click', () => this.endGame());

        document.getElementById('homeButton').addEventListener('click', () => {
            this.endGame();
            
            document.getElementById('endScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
        });

        document.getElementById('homeButtonEnd').addEventListener('click', () => {
            document.getElementById('endScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
        });
        
        // Audio control event listeners
        const muteButton = document.getElementById('muteButton');
        
        muteButton.addEventListener('click', () => {

            if(this.audio.isMuted) {
                this.audio.isMuted = false;
                this.audio.startBackgroundMusic();
                muteButton.classList.remove('muted');
                
            } else {
                this.audio.isMuted = true;
                this.audio.stopBackgroundMusic();
                muteButton.classList.add('muted');
            }
        });
    }

    initBitcoinChart() {
        // Destroy existing chart if it exists
        if (this.bitcoinChart) {
            this.bitcoinChart.destroy();
        }
        
        const ctx = document.getElementById('bitcoinChart').getContext('2d');
        this.bitcoinChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    data: this.bitcoinHistory,
                    borderColor: '#f7931a',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false,
                        min: 0,
                        max: 100
                    }
                },
                animation: {
                    duration: 0
                }
            }
        });
    }

    updateBitcoinValue() {
        const now = Date.now();
        if (now - this.lastBitcoinUpdate >= this.bitcoinUpdateInterval) {
            const oldValue = this.bitcoinValue;
            // Calculate progress through the game (0 to 1)
            const progress = 1 - (this.timeLeft / 30);
            
            // Base trend moves toward 100 as game progresses
            const baseTrend = progress * 100;
            
            // Chance for sudden price movements
            const suddenMove = Math.random() < 0.15; // 15% chance of sudden move
            
            let change;
            if (suddenMove) {
                // Dramatic price movement (up to 30 points)
                change = (Math.random() - 0.5) * 60;
            } else {
                // Normal volatility (up to 15 points)
                change = (Math.random() - 0.5) * 30;
            }
            
            // Add trend-following component
            const trendStrength = Math.min(0.7, progress * 1.2); // Increases as game progresses
            
            // Combine trend and volatility
            let newValue;
            if (this.timeLeft <= 5) {
                // Force smooth convergence to 100 in last 5 seconds
                const endProgress = (5 - this.timeLeft) / 5;
                newValue = 100 - ((1 - endProgress) * (100 - baseTrend));
            } else {
                // Combine base trend and volatile changes
                const trendComponent = baseTrend * trendStrength;
                const volatilityComponent = change * (1 - trendStrength);
                newValue = Math.max(1, Math.min(100, trendComponent + volatilityComponent + change));
            }
            
            this.bitcoinValue = newValue;     
            
            // Update history and chart
            this.bitcoinHistory.shift();
            this.bitcoinHistory.push(this.bitcoinValue);
            
            // Update chart with smoother animation
            if (this.bitcoinChart) {
                this.bitcoinChart.data.datasets[0].data = this.bitcoinHistory;
                this.bitcoinChart.update('none');
            }
            
            // Update display
            document.getElementById('bitcoinValue').textContent = Math.round(this.bitcoinValue);
            
            this.lastBitcoinUpdate = now;
        }
    }

    startGame() {
        // Reset game state
        this.score = 0;
        this.timeLeft = 30;
        this.targets = [];
        this.particles = [];
        this.gameRunning = false;
        this.bitcoinValue = 1;
        this.bitcoinHistory = Array(20).fill(1);
        
        // Reset statistics
        this.stats = {
            dollars: 0,
            bitcoin: {
                count: 0,
                points: 0
            }
        };
        
        // Reset UI
        this.initBitcoinChart();
        document.getElementById('score').textContent = '0';
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('endScreen').classList.add('hidden');
        
        // Create countdown overlay
        const countdownOverlay = document.createElement('div');
        countdownOverlay.className = 'overlay';
        countdownOverlay.id = 'countdownOverlay';
        countdownOverlay.innerHTML = '<div class="countdown">3</div>';
        document.querySelector('.game-container').appendChild(countdownOverlay);
        
        let count = 3;
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownOverlay.innerHTML = `<div class="countdown">${count}</div>`;
            } else if (count === 0) {
                countdownOverlay.innerHTML = '<div class="countdown">GO!</div>';
            } else {
                clearInterval(countdownInterval);
                countdownOverlay.remove();
                this.gameRunning = true;
                document.getElementById('stopButton').classList.remove('hidden');
                this.updateScore();
                this.updateTimer();
                this.gameLoop();
                this.spawnLoop();
                this.timerLoop();
                this.audio.startBackgroundMusic();
            }
        }, 1000);
    }

    endGame() {
        this.gameRunning = false;
        this.audio.stopBackgroundMusic();
        document.getElementById('endScreen').classList.remove('hidden');
        document.getElementById('stopButton').classList.add('hidden');
        
        // Update UI with statistics
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalDollars').textContent = this.stats.dollars;
        document.getElementById('dollarPoints').textContent = this.stats.dollars;
        document.getElementById('finalBitcoins').textContent = this.stats.bitcoin.count;
        document.getElementById('bitcoinPoints').textContent = this.stats.bitcoin.points;
        this.audio.playSound('gameover');
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
    }

    updateTimer() {
        document.getElementById('timer').textContent = this.timeLeft;
    }

    getBitcoinValue() {
        const previousValue = document.getElementById('bitcoinValue').textContent;
        let currentValue = 1;
        
        for (const stage of this.bitcoinValues) {
            if (this.timeLeft > stage.timeThreshold) {
                currentValue = stage.value;
                break;
            }
        }
        
        // Update display and add flash animation if value changed
        const valueDisplay = document.getElementById('bitcoinValue');
        valueDisplay.textContent = currentValue;
        
        if (previousValue && parseInt(previousValue) !== currentValue) {
            valueDisplay.classList.remove('flash-animation');
            // Force DOM reflow to restart animation
            void valueDisplay.offsetWidth;
            valueDisplay.classList.add('flash-animation');
        }
        
        return currentValue;
    }

    spawnTarget() {
        const isBitcoin = Math.random() > 0.75; // 25% chance for Bitcoin
        const target = {
            x: Math.random() * (this.canvas.width - 40) + 20,
            y: -30,
            type: isBitcoin ? 'bitcoin' : 'dollar',
            size: 30,
            speed: Math.random() * 2 + 2,
            rotation: Math.random() * Math.PI * 2
        };
        this.targets.push(target);
    }

    createParticles(x, y, color, type) {
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
            const speed = Math.random() * 4 + 3;
            const size = Math.random() * 6 + 2;
            const particle = {
                x,
                y,
                size,
                speed,
                angle,
                color,
                type,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                gravity: 0.1,
                velocityY: -speed * Math.random(),
                velocityX: (Math.random() - 0.5) * speed,
                life: 1
            };
            this.particles.push(particle);
        }
    }

    handleClick(x, y) {
        if (!this.gameRunning) return;

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const target = this.targets[i];
            const dx = x - target.x;
            const dy = y - target.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < target.size) {
                this.targets.splice(i, 1);
                if (target.type === 'bitcoin') {
                    const value = Math.round(this.bitcoinValue);
                    this.score += value;
                    this.stats.bitcoin.count++;
                    this.stats.bitcoin.points += value;
                } else {
                    this.score += 1;
                    this.stats.dollars++;
                }
                this.updateScore();
                this.createParticles(target.x, target.y, target.type === 'bitcoin' ? '#f7931a' : '#85bb65', target.type);
                this.audio.playSound('hit');
                this.shakeScreen();
                this.vibrate();
                break;
            }
        }
    }

    drawTarget(target) {
        this.ctx.save();
        this.ctx.translate(target.x, target.y);
        this.ctx.rotate(target.rotation);
        
        if (target.type === 'bitcoin') {
            this.ctx.fillStyle = '#f7931a';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, target.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${target.size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('₿', 0, 0);
        } else {
            this.ctx.fillStyle = '#85bb65';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, target.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${target.size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('$', 0, 0);
        }
        
        this.ctx.restore();
    }

    drawParticles() {
        const now = Date.now();
        const ctx = this.ctx;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Batch physics updates
            particle.velocityY += particle.gravity;
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            particle.rotationSpeed && (particle.rotation += particle.rotationSpeed);
            particle.life -= 0.02;
            particle.size *= 0.97;

            if (particle.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            if (particle.rotation) {
                this.ctx.rotate(particle.rotation);
            }
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.life;

            if (particle.type === 'price') {
                // Pulse effect based on time
                const pulse = Math.sin(Date.now() * particle.pulseSpeed) * 0.3 + 0.7;
                const currentSize = particle.size * pulse;
                
                // Draw cosmic particle with pulsing effect
                this.ctx.beginPath();
                this.ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Add dynamic glow effect
                this.ctx.shadowColor = particle.color;
                this.ctx.shadowBlur = 10 + pulse * 5;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
                
                // Draw outer ring
                this.ctx.strokeStyle = particle.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, currentSize * 1.5, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (particle.type === 'bitcoin') {
                // Draw bitcoin symbol
                this.ctx.font = `${particle.size * 2}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('₿', 0, 0);
            } else {
                // Draw dollar symbol
                this.ctx.font = `${particle.size * 2}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('$', 0, 0);
            }

            this.ctx.restore();
            this.ctx.globalAlpha = 1;
        }
    }

    update() {
        // Update stars
        this.updateStars();
        
        // Update Bitcoin value
        if (this.gameRunning) {
            this.updateBitcoinValue();
        }
        
        // Update targets
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const target = this.targets[i];
            target.y += target.speed;
            target.rotation += 0.02;

            if (target.y > this.canvas.height + target.size) {
                this.targets.splice(i, 1);
            }
        }
    }

    draw() {
        this.drawStars();
        // Draw all targets
        this.targets.forEach(target => this.drawTarget(target));
        this.drawParticles();
    }

    gameLoop() {
        if (!this.gameRunning) return;
        
        // Use requestAnimationFrame's timestamp for smoother animations
        const loop = (timestamp) => {
            if (!this.gameRunning) return;
            
            // Only update if enough time has passed (targeting 60fps)
            if (!this.lastFrame || timestamp - this.lastFrame >= 16.67) {
                this.update();
                this.draw();
                this.lastFrame = timestamp;
            }
            
            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);
    }

    spawnLoop() {
        if (!this.gameRunning) return;

        this.spawnTarget();
        setTimeout(() => this.spawnLoop(), 1000);
    }

    timerLoop() {
        if (!this.gameRunning) return;

        this.timeLeft--;
        this.updateTimer();

        if (this.timeLeft <= 0) {
            this.endGame();
        } else {
            setTimeout(() => this.timerLoop(), 1000);
        }
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});