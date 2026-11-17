import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { FaceDetector as MpFaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

interface UseFaceOvalAlignmentOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** True when camera is live and ready to detect */
  active: boolean;
  /** True when hands-free auto-capture should trigger after holdSeconds */
  autoCaptureEnabled: boolean;
  /** Seconds the face must remain green-aligned inside the oval before capturing (default 4) */
  holdSeconds?: number;
  /** Callback fired once when face stays aligned for holdSeconds */
  onAutoCapture: () => void;
}

interface UseFaceOvalAlignmentResult {
  isFaceAligned: boolean;
  alignmentHint: string;
  countdownSeconds: number | null;
}

let cachedMpDetectorPromise: Promise<MpFaceDetector | null> | null = null;

async function getSharedMediaPipeDetector(): Promise<MpFaceDetector | null> {
  if (!cachedMpDetectorPromise) {
    cachedMpDetectorPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
        );
        return await MpFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.6,
        });
      } catch {
        // Fallback to CPU delegate if GPU delegate isn't supported on the device
        try {
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
          );
          return await MpFaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.6,
          });
        } catch {
          return null;
        }
      }
    })();
  }
  return cachedMpDetectorPromise;
}

/**
 * Tracks real-time face-in-oval alignment using MediaPipe FaceDetector (with native FaceDetector fallback).
 * Keeps the oval red until the user's face is properly centered and sized inside the oval,
 * turns green when aligned, and triggers `onAutoCapture` after `holdSeconds` (4s) of continuous alignment.
 */
export function useFaceOvalAlignment({
  videoRef,
  active,
  autoCaptureEnabled,
  holdSeconds = 4,
  onAutoCapture,
}: UseFaceOvalAlignmentOptions): UseFaceOvalAlignmentResult {
  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [alignmentHint, setAlignmentHint] = useState('Position your face inside the oval');
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const onAutoCaptureRef = useRef(onAutoCapture);
  onAutoCaptureRef.current = onAutoCapture;

  const alignedSinceRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!active) {
      alignedSinceRef.current = null;
      triggeredRef.current = false;
      setIsFaceAligned(false);
      setCountdownSeconds(null);
      setAlignmentHint('Position your face inside the oval');
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let mpDetector: MpFaceDetector | null = null;
    let nativeDetector: any = null;

    const evaluateBox = (
      cx: number,
      cy: number,
      w: number,
      h: number,
      vw: number,
      vh: number,
    ): { aligned: boolean; hint: string } => {
      const normCx = cx / vw;
      const normCy = cy / vh;
      const normW = w / vw;
      const normH = h / vh;

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
      mpDetector = await getSharedMediaPipeDetector();
      if (!mpDetector && (window as any).FaceDetector) {
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

      if (!mpDetector && !nativeDetector) {
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
            if (mpDetector) {
              const res = mpDetector.detectForVideo(video, performance.now());
              const box = res?.detections?.[0]?.boundingBox;
              if (box) {
                const check = evaluateBox(
                  box.originX + box.width / 2,
                  box.originY + box.height / 2,
                  box.width,
                  box.height,
                  vw,
                  vh,
                );
                aligned = check.aligned;
                hint = check.hint;
              }
            } else if (nativeDetector) {
              const faces = await nativeDetector.detect(video);
              const box = faces?.[0]?.boundingBox;
              if (box) {
                const check = evaluateBox(
                  box.x + box.width / 2,
                  box.y + box.height / 2,
                  box.width,
                  box.height,
                  vw,
                  vh,
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

        setIsFaceAligned(aligned);
        setAlignmentHint(hint);

        if (aligned && autoCaptureEnabled && !triggeredRef.current) {
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

        pollTimer = setTimeout(tick, 180);
      };

      tick();
    };

    initAndPoll();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [active, autoCaptureEnabled, holdSeconds, videoRef]);

  return { isFaceAligned, alignmentHint, countdownSeconds };
}
