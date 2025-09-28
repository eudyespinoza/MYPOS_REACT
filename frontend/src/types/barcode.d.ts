interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

declare interface Navigator {
  mediaDevices: MediaDevices;
}

declare global {
  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}

export {};
