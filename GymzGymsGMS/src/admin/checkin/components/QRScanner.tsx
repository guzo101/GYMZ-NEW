/**
 * QR Scanner Component
 * Uses the device camera to scan QR codes
 * Auto-starts scanning when component mounts
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, CameraOff, X, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
// @ts-ignore - html5-qrcode may not have perfect TypeScript definitions
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScan: (qrCode: string) => void;
  onClose?: () => void;
  onUnlockAudio?: () => void;
  lastResult?: {
    status: "approved" | "rejected" | "verifying";
    message: string;
    overdueDays?: number;
  } | null;
  autoResetDelay?: number; // ms to wait before allowing next scan
}

export function QRScanner({ onScan, onClose, onUnlockAudio, lastResult, autoResetDelay = 3000 }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const scannerIdRef = useRef(`qr-scanner-${Math.random().toString(36).substr(2, 9)}`);
  const retryCountRef = useRef(0);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const maxRetries = 3;

  // Auto-start scanning on mount and cleanup on unmount
  useEffect(() => {
    startScanning();

    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        const scanner = scannerRef.current;
        // Stop the scanner
        if (scanner.isScanning) {
          try {
            await scanner.stop();
          } catch (err) {
            console.warn("Error stopping scanner:", err);
          }
        }
        // Clear the scanner
        try {
          await scanner.clear();
        } catch (err) {
          console.warn("Error clearing scanner:", err);
        }
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsInitializing(false);
  };

  const getAvailableCameras = async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (err) {
      console.error("Error enumerating cameras:", err);
      return [];
    }
  };

  const startScanning = async () => {
    try {
      setError(null);
      setIsInitializing(true);
      retryCountRef.current = 0;

      // Check if browser supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Diagnostic information
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);

        let helpMessage = "Camera access is not supported in this browser.";
        if (isIOS) {
          helpMessage = "On iOS, please use Safari, Chrome, or Firefox. If you're in an app's internal browser, try opening this page in Safari.";
        } else if (isAndroid) {
          helpMessage = "On Android, please use Chrome or Firefox. Ensure you have granted camera permissions to the browser.";
        }

        setError(`${helpMessage} (Error: MediaDevices not found)`);
        setIsInitializing(false);
        return;
      }

      // Check if we're on HTTPS or localhost (required for camera access)
      const isSecureContext = window.isSecureContext === true || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

      if (!isSecureContext) {
        setError(`Camera blocked: You are using an insecure connection (${location.hostname}). To test on mobile, you MUST use an HTTPS tunnel (like localtunnel or ngrok). The browser will NOT allow camera access on http://${location.hostname}:8080.`);
        setIsInitializing(false);
        return;
      }

      // Ensure container exists
      if (!containerRef.current) {
        setError("Scanner container not found. Please refresh the page.");
        setIsInitializing(false);
        return;
      }

      // Explicitly request permission to trigger browser prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        // Stop the temporary stream immediately
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr: any) {
        console.error("Permission request error:", permErr);
        if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError" || permErr.message?.includes("permission")) {
          setError("Camera permission denied. Please click the lock icon in your browser address bar and 'Reset permission' or 'Allow' camera.");
          setIsInitializing(false);
          setIsScanning(false);
          return;
        }
      }

      // Ensure container exists
      if (!containerRef.current) {
        setError("Scanner container not found. Please refresh the page.");
        setIsInitializing(false);
        return;
      }

      // Stop any existing scanner first
      if (scannerRef.current) {
        await stopScanning();
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Set scanning state to make container visible
      setIsScanning(true);

      // Wait for DOM to update and ensure element is visible
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the scanner element exists
      const scannerElement = document.getElementById(scannerIdRef.current);
      if (!scannerElement) {
        setError("Scanner element not found. Please try again.");
        setIsScanning(false);
        setIsInitializing(false);
        return;
      }

      // Get container dimensions for responsive qrbox
      const container = containerRef.current;
      const containerWidth = container.offsetWidth || 640;
      const containerHeight = container.offsetHeight || 480;
      const qrboxSize = Math.min(containerWidth * 0.8, containerHeight * 0.8, 300);

      // Create scanner instance
      const scannerId = scannerIdRef.current;
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;

      // Try to get available cameras
      let cameraId: string | null = null;
      try {
        const cameras = await getAvailableCameras();
        // Prefer back camera (environment) if available
        const backCamera = cameras.find(cam =>
          cam.label.toLowerCase().includes('back') ||
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        );
        if (backCamera) {
          cameraId = backCamera.deviceId;
        } else if (cameras.length > 0) {
          cameraId = cameras[0].deviceId;
        }
      } catch (err) {
        console.warn("Could not enumerate cameras, using default:", err);
      }

      // Camera configuration - optimized for mobile
      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };

      // Start scanning with improved configuration
      await scanner.start(
        cameraConfig,
        {
          fps: 15, // Higher FPS for smoother scanning
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Responsive QR box: 70% of the smallest dimension, but at least 200px
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(200, Math.floor(minDim * 0.7));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: false,
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
            frameRate: { ideal: 30 }
          }
        },
        (decodedText, decodedResult) => {
          // Prevent rapid duplicate scans
          const now = Date.now();
          const code = decodedText.trim();

          if (isPaused) return;

          // If it's the same code scanned within the delay period, ignore it
          if (code === lastScannedCodeRef.current && now - lastScanTimeRef.current < autoResetDelay) {
            return;
          }

          // QR code detected successfully
          console.log("✅ QR Code detected:", code);
          lastScannedCodeRef.current = code;
          lastScanTimeRef.current = now;

          onScan(code);

          // Pulse the UI to show detection
          setIsPaused(true);

          // Auto-resume after delay
          setTimeout(() => {
            setIsPaused(false);
          }, autoResetDelay);
        },
        (errorMessage) => {
          // This callback is called frequently when scanning
          // Only log unexpected errors, ignore "not found" errors
          if (errorMessage &&
            !errorMessage.includes("No QR code found") &&
            !errorMessage.includes("NotFoundException") &&
            !errorMessage.includes("QR code parse error") &&
            !errorMessage.includes("No MultiFormat Readers")) {
            // Log unexpected errors for debugging
            console.debug("Scanner error:", errorMessage);
          }
        }
      );

      setIsInitializing(false);
      retryCountRef.current = 0; // Reset retry count on success
    } catch (err: any) {
      console.error("❌ Error accessing camera:", err);
      let errorMsg = "Failed to access camera. ";

      if (err.name === "NotAllowedError" || err.message?.includes("permission")) {
        errorMsg = "Camera permission denied. Please allow camera access in your browser settings and try again.";
      } else if (err.name === "NotFoundError" || err.message?.includes("not found")) {
        errorMsg = "No camera found. Please connect a camera and try again.";
      } else if (err.name === "NotReadableError" || err.message?.includes("not readable")) {
        errorMsg = "Camera is already in use by another application. Please close other apps using the camera.";
      } else if (err.name === "OverconstrainedError" || err.message?.includes("constraint")) {
        errorMsg = "Camera doesn't support the required settings. Trying with default settings...";
        // Retry with simpler config
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setTimeout(() => {
            startScanning();
          }, 1000);
          return;
        }
      } else if (err.message) {
        errorMsg += err.message;
      } else {
        errorMsg += "Please check your camera permissions and try again.";
      }

      setError(errorMsg);
      setIsScanning(false);
      setIsInitializing(false);

      // Cleanup on error
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch { }
        scannerRef.current = null;
      }
    }
  };

  const handleManualInput = () => {
    const qrCode = prompt("Please enter the QR code manually:");
    if (qrCode && qrCode.trim()) {
      onScan(qrCode.trim());
      stopScanning();
    }
  };

  const handleClose = () => {
    stopScanning();
    if (onClose) {
      onClose();
    }
  };

  const handleRetry = () => {
    setError(null);
    retryCountRef.current = 0;
    startScanning();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              QR Code Scanner
            </CardTitle>
            <CardDescription>Scan a QR code using your device camera. Click the scanner area once to enable sound.</CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="text-destructive font-medium">Camera Error</p>
                <p className="text-destructive/80 mt-1">{error}</p>

                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-destructive/90">Troubleshooting:</p>
                  <ul className="text-xs list-disc pl-4 space-y-1 text-destructive/70">
                    <li>Grant camera permissions in your browser settings.</li>
                    <li>Ensure you are using HTTPS, not HTTP.</li>
                    <li>Try opening in Safari (iPhone) or Chrome (Android).</li>
                    <li>Close other apps that might be using the camera.</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleRetry}
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Retry Camera
                </Button>
              </div>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center min-h-[250px] cursor-pointer"
          onClick={() => onUnlockAudio?.()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onUnlockAudio?.(); }}
          aria-label="Scanner area - click to enable sound"
        >
          {/* Scanner container - always rendered for proper initialization */}
          <div
            id={scannerIdRef.current}
            className="w-full h-full"
            style={{
              display: isScanning ? 'block' : 'none',
              minHeight: '300px'
            }}
          />

          {/* Placeholder when not scanning */}
          {!isScanning && !isInitializing && (
            <div className="absolute inset-0 text-center p-4 text-muted-foreground flex flex-col items-center justify-center z-20">
              <CameraOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Camera not active</p>
            </div>
          )}

          {/* Loading state */}
          {isInitializing && (
            <div className="absolute inset-0 text-center p-4 text-muted-foreground flex flex-col items-center justify-center z-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-xs">Initializing camera...</p>
            </div>
          )}

          {/* Scanning overlay */}
          {isScanning && !isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              {/* Scan Box */}
              <div className={`border-2 rounded-lg w-48 h-48 relative transition-colors duration-300 ${isPaused ? 'border-primary/50' : 'border-primary'
                }`}>
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-primary rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-primary rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-primary rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-primary rounded-br-lg" />

                {/* Status indicator inside scanning box */}
                {lastResult && isPaused && (
                  <div className={`absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg backdrop-blur-[2px] animate-in fade-in zoom-in duration-300`}>
                    {lastResult.status === "approved" ? (
                      <CheckCircle2 className="h-12 w-12 text-primary mb-2" />
                    ) : lastResult.status === "rejected" ? (
                      <X className="h-12 w-12 text-red-500 mb-2" />
                    ) : (
                      <RefreshCw className="h-12 w-12 text-primary animate-spin mb-2" />
                    )}
                  </div>
                )}
              </div>

              {/* Status Message Overlay */}
              {lastResult && isPaused && (
                <div className={`mt-4 px-4 py-2 rounded-full font-bold text-sm shadow-lg animate-in slide-in-from-bottom-4 duration-300 ${lastResult.status === "approved"
                  ? "bg-primary text-white"
                  : lastResult.status === "rejected"
                    ? "bg-red-500 text-white"
                    : "bg-primary text-white"
                  }`}>
                  <div className="flex items-center gap-2">
                    {lastResult.status === "approved" && <CheckCircle2 className="h-4 w-4" />}
                    {lastResult.status === "rejected" && <AlertCircle className="h-4 w-4" />}
                    <span>{lastResult.message}</span>
                    {lastResult.overdueDays !== undefined && lastResult.overdueDays > 0 && (
                      <span className="bg-white/20 px-2 py-0.5 rounded ml-1">
                        {lastResult.overdueDays} days due
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Guide text */}
              {!isPaused && (
                <p className="mt-4 text-white/70 text-xs font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                  Align QR code within frame
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {isScanning && (
            <Button
              onClick={stopScanning}
              variant="outline"
              size="sm"
              disabled={isInitializing}
              className="flex-1"
            >
              <CameraOff className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
          {!isScanning && !error && (
            <Button
              onClick={startScanning}
              size="sm"
              disabled={isInitializing}
              className="flex-1"
            >
              {isInitializing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          )}
          <Button
            onClick={handleManualInput}
            variant="outline"
            size="sm"
            disabled={isInitializing}
            className="flex-1"
          >
            Manual
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

