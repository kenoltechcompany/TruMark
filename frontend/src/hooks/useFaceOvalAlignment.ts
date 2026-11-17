import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  FaceDetector as MpFaceDetector,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

interface UseFaceOvalAlignmentOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** True when camera is live and ready to detect */
  active: boolean;
  /** True when hands-free auto-capture should trigger after holdSeconds */
  autoCaptureEnabled: boolean;
  /** Require an active blink (eyes open -> blink -> open) to block static photos/screens */
  requireLiveness?: boolean;
  /** Seconds the face must remain green-aligned (and liveness-verified if required) before capturing */
  holdSeconds?: number;
  /** Callback fired once when face stays aligned & verified for holdSeconds */
  onAutoCapture: () => void;
}

interface UseFaceOvalAlignmentResult {
  isFaceAligned: boolean;
  livenessVerified: boolean;
  livenessSupported: boolean;
  alignmentHint: string;
  countdownSeconds: number | null;
}

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const DETECTOR_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let cachedLandmarkerPromise: Promise<FaceLandmarker | null> | null = null;
let cachedDetectorPromise: Promise<MpFaceDetector | null> | null = null;

async function getSharedFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (!cachedLandmarkerPromise) {
    cachedLandmarkerPromise = (async () => {
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          const vision = await FilesetResolver.forVisionTasks(WASM_URL);
          return await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            minFaceDetectionConfidence: 0.6,
            minFacePresenceConfidence: 0.6,
          });
        } catch {
          // Try next delegate
        }
      }
      return null;
    })();
  }
  return cachedLandmarkerPromise;
}

async function getSharedMediaPipeDetector(): Promise<MpFaceDetector | null> {
  if (!cachedDetectorPromise) {
    cachedDetectorPromise = (async () => {
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          const vision = await FilesetResolver.forVisionTasks(WASM_URL);
          return await MpFaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: DETECTOR_MODEL, delegate },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.6,
          });
        } catch {
          // Try next delegate
        }
      }
      return null;
    })();
  }
  return cachedDetectorPromise;
}

/**
 * Tracks real-time face-in-oval alignment + active blink liveness using MediaPipe FaceLandmarker.
 * - Oval stays RED until a face is properly centered & sized inside the oval.
 * - Oval turns GREEN when aligned.
 * - When `requireLiveness` is true, requires a real blink (eyes open -> closed -> open) to block printed/screen photos.
 * - After `holdSeconds` (default 4s) of green alignment + liveness, triggers `onAutoCapture`.
 */
export function useFaceOvalAlignment({
  videoRef,
  active,
  autoCaptureEnabled,
  requireLiveness = false,
  holdSeconds = 4,
  onAutoCapture,
}: UseFaceOvalAlignmentOptions): UseFaceOvalAlignmentResult {
  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [livenessSupported, setLivenessSupported] = useState(false);
  const [alignmentHint, setAlignmentHint] = useState('Position your face inside the oval');
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const onAutoCaptureRef = useRef(onAutoCapture);
  onAutoCaptureRef.current = onAutoCapture;

  const alignedSinceRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);
  // Blink state machine: 'need_open' -> 'saw_open' -> 'saw_closed' -> 'verified'
  const blinkStageRef = useRef<'need_open' | 'saw_open' | 'saw_closed' | 'verified'>('need_open');

  useEffect(() => {
    if (!active) {
      alignedSinceRef.current = null;
      triggeredRef.current = false;
      blinkStageRef.current = 'need_open';
      setIsFaceAligned(false);
      setLivenessVerified(false);
      setCountdownSeconds(null);
      setAlignmentHint('Position your face inside the oval');
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let landmarker: FaceLandmarker | null = null;
    let mpDetector: MpFaceDetector | null = null;
    let nativeDetector: any = null;

    const evaluateNormalizedBox = (
      normCx: number,
      normCy: number,
      normW: number,
      normH: number,
    ): { aligned: boolean; hint: string } => {
      if (normW < 0.16 || normH < 0.19) {
        return { aligned: false, hint: 'Move closer to the camera' };
      }
      if (normW > 0.74 || normH > 0.82) {
        return { aligned: false, hint: 'Move slightly back' };
      }
      if (normCx < 0.28 || normCx > 0.72 || normCy < 0.22 || normCy > 0.76) {
        return { aligned: false, hint: 'Center your face inside the oval' };
      }
      return { aligned: true, hint: 'Face aligned! Hold still...' };
    };

    const initAndPoll = async () => {
      landmarker = await getSharedFaceLandmarker();
      if (!landmarker) {
        mpDetector = await getSharedMediaPipeDetector();
      }
      if (!landmarker && !mpDetector && (window as any).FaceDetector) {
        try {
          nativeDetector = new (window as any).FaceDetector({
            fastMode: true,
            maxDetectedFaces: 1,
          });
        } catch {
          nativeDetector = null;
        }
      }

      if (cancelled) return;

      const hasLandmarker = Boolean(landmarker);
      setLivenessSupported(hasLandmarker);

      if (!landmarker && !mpDetector && !nativeDetector) {
        setAlignmentHint('Center face and tap shutter');
        setIsFaceAligned(false);
        return;
      }

      const tick = async () => {
        if (cancelled) return;

        const video = videoRef.current;
        let aligned = false;
        let hint = 'Position your face inside the oval';

        if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          try {
            if (landmarker) {
              const res = landmarker.detectForVideo(video, performance.now());
              const landmarks = res?.faceLandmarks?.[0];
              if (landmarks && landmarks.length > 0) {
                let minX = 1;
                let maxX = 0;
                let minY = 1;
                let maxY = 0;
                for (const pt of landmarks) {
                  if (pt.x < minX) minX = pt.x;
                  if (pt.x > maxX) maxX = pt.x;
                  if (pt.y < minY) minY = pt.y;
                  if (pt.y > maxY) maxY = pt.y;
                }
                const check = evaluateNormalizedBox(
                  (minX + maxX) / 2,
                  (minY + maxY) / 2,
                  maxX - minX,
                  maxY - minY,
                );
                aligned = check.aligned;
                hint = check.hint;

                // Evaluate active blink liveness from blendshapes
                if (aligned && requireLiveness && blinkStageRef.current !== 'verified') {
                  const categories = res?.faceBlendshapes?.[0]?.categories || [];
                  const leftBlink =
                    categories.find((c) => c.categoryName === 'eyeBlinkLeft')?.score ?? 0;
                  const rightBlink =
                    categories.find((c) => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
                  const blinkScore = Math.max(leftBlink, rightBlink);

                  if (blinkStageRef.current === 'need_open' && blinkScore < 0.25) {
                    blinkStageRef.current = 'saw_open';
                  } else if (blinkStageRef.current === 'saw_open' && blinkScore >= 0.38) {
                    blinkStageRef.current = 'saw_closed';
                  } else if (blinkStageRef.current === 'saw_closed' && blinkScore < 0.25) {
                    blinkStageRef.current = 'verified';
                    setLivenessVerified(true);
                  }
                }
              }
            } else if (mpDetector) {
              const res = mpDetector.detectForVideo(video, performance.now());
              const box = res?.detections?.[0]?.boundingBox;
              if (box) {
                const check = evaluateNormalizedBox(
                  (box.originX + box.width / 2) / vw,
                  (box.originY + box.height / 2) / vh,
                  box.width / vw,
                  box.height / vh,
                );
                aligned = check.aligned;
                hint = check.hint;
              }
            } else if (nativeDetector) {
              const faces = await nativeDetector.detect(video);
              const box = faces?.[0]?.boundingBox;
              if (box) {
                const check = evaluateNormalizedBox(
                  (box.x + box.width / 2) / vw,
                  (box.y + box.height / 2) / vh,
                  box.width / vw,
                  box.height / vh,
                );
                aligned = check.aligned;
                hint = check.hint;
              }
            }
          } catch {
            // Keep polling quietly on transient frame read errors
          }
        }

        if (cancelled) return;

        // If face leaves the oval before liveness is verified, reset blink state
        if (!aligned && blinkStageRef.current !== 'verified') {
          blinkStageRef.current = 'need_open';
        }

        const isLiveReady =
          !requireLiveness || !hasLandmarker || blinkStageRef.current === 'verified';

        if (aligned && !isLiveReady) {
          hint = 'Liveness check: Blink your eyes once';
        } else if (aligned && isLiveReady && requireLiveness && hasLandmarker) {
          hint = 'Liveness verified! Hold still...';
        }

        setIsFaceAligned(aligned);
        setAlignmentHint(hint);

        if (aligned && isLiveReady && autoCaptureEnabled && !triggeredRef.current) {
          if (alignedSinceRef.current === null) {
            alignedSinceRef.current = Date.now();
          }
          const elapsedMs = Date.now() - alignedSinceRef.current;
          const remaining = Math.max(0, Math.ceil((holdSeconds * 1000 - elapsedMs) / 1000));
          setCountdownSeconds(remaining > 0 ? remaining : 1);

          if (elapsedMs >= holdSeconds * 1000) {
            triggeredRef.current = true;
            setCountdownSeconds(null);
            onAutoCaptureRef.current();
            return;
          }
        } else {
          alignedSinceRef.current = null;
          setCountdownSeconds(null);
        }

        pollTimer = setTimeout(tick, 140);
      };

      tick();
    };

    initAndPoll();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [active, autoCaptureEnabled, holdSeconds, requireLiveness, videoRef]);

  return { isFaceAligned, livenessVerified, livenessSupported, alignmentHint, countdownSeconds };
}
