/**
 * CameraPPG — misura il battito cardiaco tramite la fotocamera posteriore
 * con flash LED (metodo PPG: PhotoPlethysmoGraphy).
 *
 * Come funziona:
 *   1. L'utente appoggia il dito sul flash + fotocamera posteriore
 *   2. Il flash illumina il dito con luce costante
 *   3. Ogni frame analizza la luminosità media del canale rosso
 *   4. Le variazioni periodiche della luminosità corrispondono al battito
 *   5. L'algoritmo di picco-rilevamento stima i BPM
 *
 * Usa expo-camera (già installato nell'app).
 */

export type PPGCallback = (bpm: number, confidence: number) => void;
export type PPGStatusCallback = (status: "idle" | "measuring" | "done" | "error", msg?: string) => void;

interface PPGSample {
  value: number;
  timestamp: number;
}

const SAMPLE_WINDOW = 5000;
const MIN_SAMPLES = 60;
const BPM_MIN = 40;
const BPM_MAX = 200;

export class CameraPPGMeasurement {
  private samples: PPGSample[] = [];
  private isActive = false;
  private onBpm: PPGCallback;
  private onStatus: PPGStatusCallback;
  private startTime = 0;
  private lastPeakTime = 0;
  private peakIntervals: number[] = [];
  private lastValue = 0;
  private rising = false;

  constructor(onBpm: PPGCallback, onStatus: PPGStatusCallback) {
    this.onBpm = onBpm;
    this.onStatus = onStatus;
  }

  start(): void {
    this.isActive = true;
    this.samples = [];
    this.peakIntervals = [];
    this.lastPeakTime = 0;
    this.rising = false;
    this.startTime = Date.now();
    this.onStatus("measuring");
  }

  stop(): void {
    this.isActive = false;
    this.onStatus("idle");
  }

  /**
   * Chiama questo metodo per ogni frame della fotocamera.
   * Passa il valore medio del canale rosso del frame (0–255).
   */
  processFrame(redChannelAvg: number): void {
    if (!this.isActive) return;

    const now = Date.now();
    this.samples.push({ value: redChannelAvg, timestamp: now });

    // Rimuovi campioni troppo vecchi
    this.samples = this.samples.filter((s) => now - s.timestamp < SAMPLE_WINDOW);

    // Peak detection semplice: rileva transizione da salita a discesa
    const smooth = this.smoothedValue();
    if (smooth > this.lastValue) {
      this.rising = true;
    } else if (this.rising && smooth < this.lastValue) {
      // Picco rilevato
      this.rising = false;
      if (this.lastPeakTime > 0) {
        const interval = now - this.lastPeakTime;
        if (interval > 300 && interval < 1500) {
          this.peakIntervals.push(interval);
          if (this.peakIntervals.length > 10) {
            this.peakIntervals.shift();
          }
          if (this.peakIntervals.length >= 4) {
            const avgInterval =
              this.peakIntervals.reduce((a, b) => a + b, 0) / this.peakIntervals.length;
            const bpm = Math.round(60000 / avgInterval);
            if (bpm >= BPM_MIN && bpm <= BPM_MAX) {
              const confidence = Math.min(this.peakIntervals.length / 8, 1);
              this.onBpm(bpm, confidence);
            }
          }
        }
      }
      this.lastPeakTime = now;
    }
    this.lastValue = smooth;

    // Dopo 30 secondi, segnala completamento
    if (now - this.startTime > 30000 && this.samples.length >= MIN_SAMPLES) {
      this.isActive = false;
      this.onStatus("done");
    }
  }

  private smoothedValue(): number {
    if (this.samples.length === 0) return 0;
    const recent = this.samples.slice(-5);
    return recent.reduce((a, b) => a + b.value, 0) / recent.length;
  }
}

/**
 * Calcola la media del canale rosso da un array di pixel RGBA
 * (come quelli restituiti da expo-camera ImageData).
 */
export function extractRedChannel(pixelData: Uint8Array | number[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixelData.length; i += 4) {
    sum += pixelData[i]; // canale R
    count++;
  }
  return count > 0 ? sum / count : 0;
}
