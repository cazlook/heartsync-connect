/**
 * HeartRateManager — coordina BLE smartwatch (priorità) e Camera PPG (fallback).
 *
 * Logica:
 *   1. Tenta connessione BLE per 10 secondi
 *   2. Se trovato smartwatch → usa dati BLE in tempo reale
 *   3. Se non trovato → passa a Camera PPG
 *   4. I BPM vengono passati al callback e aggiornano HeartRateContext
 */

import { BLEScanner, BLEHeartRateCallback, BLEStatusCallback } from "./BLEScanner";
import { CameraPPGMeasurement } from "./CameraPPG";

export type HRMSource = "ble" | "ppg" | "manual" | "none";

export interface HRMStatus {
  source: HRMSource;
  connected: boolean;
  deviceName?: string;
  currentBpm: number | null;
  confidence: number;
  message?: string;
}

export type HRMCallback = (bpm: number, status: HRMStatus) => void;
export type HRMStatusCallback = (status: HRMStatus) => void;

const BLE_TIMEOUT_MS = 10000;

class HeartRateManagerImpl {
  private currentSource: HRMSource = "none";
  private currentBpm: number | null = null;
  private confidence = 0;
  private deviceName: string | undefined;
  private bpmCallback: HRMCallback | null = null;
  private statusCallback: HRMStatusCallback | null = null;
  private bleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private ppgMeasurement: CameraPPGMeasurement | null = null;
  private active = false;

  getStatus(): HRMStatus {
    return {
      source: this.currentSource,
      connected: this.currentSource !== "none",
      deviceName: this.deviceName,
      currentBpm: this.currentBpm,
      confidence: this.confidence,
    };
  }

  startMonitoring(onBpm: HRMCallback, onStatus: HRMStatusCallback): void {
    this.active = true;
    this.bpmCallback = onBpm;
    this.statusCallback = onStatus;

    if (BLEScanner.isAvailable()) {
      this._tryBLE();
    } else {
      this._switchToPPG();
    }
  }

  private _tryBLE(): void {
    this.currentSource = "ble";
    this._emitStatus({ message: "Cerco smartwatch BLE..." });

    this.bleTimeoutId = setTimeout(() => {
      if (this.currentSource === "ble" && this.currentBpm === null) {
        BLEScanner.stopScan();
        this._switchToPPG();
      }
    }, BLE_TIMEOUT_MS);

    const onBpm: BLEHeartRateCallback = (bpm) => {
      if (this.bleTimeoutId) {
        clearTimeout(this.bleTimeoutId);
        this.bleTimeoutId = null;
      }
      this.currentBpm = bpm;
      this.confidence = 1.0;
      this._emitBpm(bpm);
    };

    const onStatus: BLEStatusCallback = (status, msg) => {
      if (status === "connected") {
        this.deviceName = msg;
        this._emitStatus({ message: `Connesso a ${msg}` });
      } else if (status === "error" || status === "disconnected") {
        this._emitStatus({ message: msg });
        if (this.active) this._switchToPPG();
      }
    };

    BLEScanner.startScan(onBpm, onStatus).catch(() => this._switchToPPG());
  }

  private _switchToPPG(): void {
    this.currentSource = "ppg";
    this.deviceName = undefined;
    this._emitStatus({ message: "Usa la fotocamera per misurare il battito" });
    // PPG viene attivato manualmente tramite startPPGMeasurement()
  }

  startPPGMeasurement(): CameraPPGMeasurement {
    const measurement = new CameraPPGMeasurement(
      (bpm, confidence) => {
        if (!this.active) return;
        this.currentBpm = bpm;
        this.confidence = confidence;
        this.currentSource = "ppg";
        this._emitBpm(bpm);
      },
      (status, msg) => {
        this._emitStatus({ message: msg });
      }
    );
    this.ppgMeasurement = measurement;
    measurement.start();
    return measurement;
  }

  stopPPGMeasurement(): void {
    if (this.ppgMeasurement) {
      this.ppgMeasurement.stop();
      this.ppgMeasurement = null;
    }
  }

  setManualBpm(bpm: number): void {
    this.currentSource = "manual";
    this.currentBpm = bpm;
    this.confidence = 0.7;
    this._emitBpm(bpm);
  }

  stop(): void {
    this.active = false;
    if (this.bleTimeoutId) {
      clearTimeout(this.bleTimeoutId);
      this.bleTimeoutId = null;
    }
    BLEScanner.stopScan();
    this.stopPPGMeasurement();
    this.currentSource = "none";
    this.currentBpm = null;
    this.bpmCallback = null;
    this.statusCallback = null;
  }

  private _emitBpm(bpm: number): void {
    if (this.bpmCallback) {
      this.bpmCallback(bpm, this.getStatus());
    }
  }

  private _emitStatus(partial: Partial<HRMStatus>): void {
    if (this.statusCallback) {
      this.statusCallback({ ...this.getStatus(), ...partial });
    }
  }
}

export const HeartRateManager = new HeartRateManagerImpl();
