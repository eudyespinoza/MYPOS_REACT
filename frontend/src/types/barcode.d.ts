declare global {
  interface BarcodeDetectorOptions {
    formats?: string[];
  }

  interface DetectedBarcode {
    rawValue: string;
    format: string;
  }

  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
  }

  interface Navigator {
    mediaDevices: MediaDevices;
  }

  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}

export {};
