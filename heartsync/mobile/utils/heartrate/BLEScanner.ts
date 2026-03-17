/**
 * BLEScanner — scansiona smartwatch BLE (Apple Watch, Fitbit, Garmin, ecc.)
 * cercando il servizio Heart Rate (UUID 0x180D) standard GATT.
 *
 * Richiede: react-native-ble-plx  (npm install react-native-ble-plx)
 * Se la libreria non è installata, il manager ritorna null e il sistema
 * usa il fallback CameraPPG.
 */

export type BLEHeartRateCallback = (bpm: number) => void;
export type BLEStatusCallback = (status: "scanning" | "connected" | "disconnected" | "error", msg?: string) => void;

const HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb";

let BleManager: any = null;
try {
  BleManager = require("react-native-ble-plx").BleManager;
} catch {
  // react-native-ble-plx non installato
}

class BLEScannerImpl {
  private manager: any = null;
  private subscription: any = null;
  private deviceId: string | null = null;

  isAvailable(): boolean {
    return BleManager !== null;
  }

  async startScan(
    onBpm: BLEHeartRateCallback,
    onStatus: BLEStatusCallback
  ): Promise<void> {
    if (!BleManager) {
      onStatus("error", "BLE non disponibile su questo dispositivo");
      return;
    }

    if (!this.manager) {
      this.manager = new BleManager();
    }

    onStatus("scanning");

    this.manager.startDeviceScan(
      [HR_SERVICE_UUID],
      { allowDuplicates: false },
      async (error: any, device: any) => {
        if (error) {
          onStatus("error", error.message);
          return;
        }
        if (!device) return;

        this.manager.stopDeviceScan();

        try {
          const connected = await device.connect();
          await connected.discoverAllServicesAndCharacteristics();
          this.deviceId = device.id;
          onStatus("connected", device.name || "Smartwatch");

          this.subscription = connected.monitorCharacteristicForService(
            HR_SERVICE_UUID,
            HR_MEASUREMENT_UUID,
            (err: any, characteristic: any) => {
              if (err || !characteristic?.value) return;
              const raw = Buffer.from(characteristic.value, "base64");
              const flags = raw[0];
              let bpm: number;
              if (flags & 0x01) {
                bpm = raw.readUInt16LE(1);
              } else {
                bpm = raw[1];
              }
              if (bpm > 30 && bpm < 220) {
                onBpm(bpm);
              }
            }
          );
        } catch (e: any) {
          onStatus("error", e.message);
        }
      }
    );
  }

  stopScan(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (this.manager) {
      this.manager.stopDeviceScan();
    }
    if (this.deviceId && this.manager) {
      this.manager.cancelDeviceConnection(this.deviceId).catch(() => {});
      this.deviceId = null;
    }
  }

  destroy(): void {
    this.stopScan();
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
  }
}

export const BLEScanner = new BLEScannerImpl();
