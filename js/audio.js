class AudioManager {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.bgMusic = null;
        this.masterGainNode = this.context.createGain();
        this.masterGainNode.connect(this.context.destination);
        this.volume = 1.0;
        this.isMuted = false;
        this.init();
    }

    async init() {
        // Cosmic sound for small price changes
        await this.createSound('hit', [440, 880, 1760], 0.15);
        // Lower pitch for misses
        await this.createSound('miss', [220, 110], 0.2);
        // Price increase sound
        await this.createSound('priceUp', [440, 880, 1760, 2200], 0.3);
        // Price decrease sound
        await this.createSound('priceDown', [440, 220, 110], 0.3);
        // High-pitched cosmic sound for big price changes
        await this.createSound('powerup', [880, 1760, 2200], 0.25);
        // Dramatic ending sound
        await this.createSound('gameover', [440, 220, 110, 55], 0.4);
        
        // Create analyzers for price change visualization
        this.priceAnalyzer = this.context.createAnalyser();
        this.priceAnalyzer.connect(this.masterGainNode);
        this.priceAnalyzer.fftSize = 256;
        this.analyzerData = new Uint8Array(this.priceAnalyzer.frequencyBinCount);
        
        this.createBackgroundMusic();
    }

    createBackgroundMusic() {
        const notes = [
            { freq: 293.66, duration: 0.5 }, // D4
            { freq: 349.23, duration: 0.5 }, // F4
            { freq: 440.00, duration: 0.5 }, // A4
            { freq: 523.25, duration: 0.5 }, // C5
        ];
        
        const melody = this.context.createGain();
        melody.gain.setValueAtTime(0.15, this.context.currentTime);
        melody.connect(this.masterGainNode);
        
        let currentTime = this.context.currentTime;
        let oscillators = [];
        
        const playSequence = () => {
            notes.forEach((note, index) => {
                const osc = this.context.createOscillator();
                const noteGain = this.context.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(note.freq, currentTime + index * note.duration);
                
                noteGain.gain.setValueAtTime(0, currentTime + index * note.duration);
                noteGain.gain.linearRampToValueAtTime(0.2, currentTime + index * note.duration + 0.1);
                noteGain.gain.linearRampToValueAtTime(0, currentTime + index * note.duration + note.duration);
                
                osc.connect(noteGain);
                noteGain.connect(melody);
                
                osc.start(currentTime + index * note.duration);
                osc.stop(currentTime + index * note.duration + note.duration);
                
                oscillators.push(osc);
            });
            
            currentTime += notes.length * notes[0].duration;
        };
        
        this.bgMusic = {
            isPlaying: false,
            intervalId: null,
            start: () => {
                if (!this.bgMusic.isPlaying) {
                    this.bgMusic.isPlaying = true;
                    playSequence();
                    this.bgMusic.intervalId = setInterval(() => {
                        playSequence();
                    }, notes.length * notes[0].duration * 1000);
                }
            },
            stop: () => {
                if (this.bgMusic.isPlaying) {
                    clearInterval(this.bgMusic.intervalId);
                    oscillators.forEach(osc => {
                        try {
                            osc.stop();
                        } catch (e) {
                            // Ignore already stopped oscillators
                        }
                    });
                    oscillators = [];
                    this.bgMusic.isPlaying = false;
                }
            }
        };
    }

    async createSound(name, frequencies, duration) {
        const oscillators = frequencies.map(freq => {
            const oscillator = this.context.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, this.context.currentTime);
            return oscillator;
        });

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

        oscillators.forEach(osc => osc.connect(gainNode));
        gainNode.connect(this.masterGainNode);

        this.sounds[name] = {
            play: () => {
                if (this.isMuted) return;
                
                oscillators.forEach(osc => {
                    const newOsc = this.context.createOscillator();
                    newOsc.type = 'sine';
                    newOsc.frequency.setValueAtTime(osc.frequency.value, this.context.currentTime);
                    
                    const newGain = this.context.createGain();
                    newGain.gain.setValueAtTime(0.3 * this.volume, this.context.currentTime);
                    newGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
                    
                    newOsc.connect(newGain);
                    newGain.connect(this.masterGainNode);
                    
                    newOsc.start();
                    newOsc.stop(this.context.currentTime + duration);
                });
            }
        };
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        this.masterGainNode.gain.setValueAtTime(this.volume, this.context.currentTime);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.context.currentTime);
    }

    playSound(name) {
        if (this.sounds[name]) {
            this.sounds[name].play();
        }
    }

    startBackgroundMusic() {
        if (this.bgMusic) {
            this.bgMusic.start();
        }
    }

    stopBackgroundMusic() {
        if (this.bgMusic) {
            this.bgMusic.stop();
        }
    }
}
