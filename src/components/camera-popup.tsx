import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowClockwiseIcon, ArrowCounterclockwiseIcon, ArrowLeftIcon, EyeClosedIcon, EyeIcon, SaveIcon, Spinner } from "./icons";
import { PhotoImg } from "./photo-img";

interface CameraPopupProps {
  overlayPhotoId?: string,
  onCancel: () => void,
  onCapture: (photo: PhotoAsDataUrl, rotation?: number) => void,
}

interface PhotoAsDataUrl {
  dataUrl: string,
}

export function CameraPopup({
  overlayPhotoId,
  onCancel,
  onCapture
}: CameraPopupProps) {

  const [ showOverlay, setShowOverlay ] = useState(true);

  const video = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream|null>(null);

  useEffect(() => {
    const currentVideo = video.current;
    let ignore = false;
    (async () => {
      if (currentVideo != null) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 2160 } 
          },
          audio: false
        });

        if (ignore) {
          stream.getTracks().forEach(track => track.stop());
        } else {
          cameraStream.current = stream;
          currentVideo.srcObject = stream;
          currentVideo.play()?.catch(e => {})
        }
      }  
    })();
  
    return () => {
      ignore = true;
      cameraStream.current?.getVideoTracks()?.[0]?.stop();
      currentVideo?.pause();
    };
  }, []);

  const [ orientationType, setOrientationType ] = useState(screen.orientation.type); 
  useEffect(() => {
    function onOrientationChange(this: ScreenOrientation) {
      setOrientationType(this.type);
    }
    screen.orientation.addEventListener("change", onOrientationChange);
    return () => screen.orientation.removeEventListener("change", onOrientationChange);
  }, []);

  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!document.fullscreenElement) {
      overlay?.current?.requestFullscreen().catch(() => {});
    }
  });

  const [overlayImgRef, setOverlayImageRef] = useState<{naturalWidth?: number, naturalHeight?: number}|null>(null);
  const overlayIsLandscape = overlayImgRef
    && overlayImgRef.naturalWidth && overlayImgRef.naturalHeight
    && overlayImgRef.naturalWidth > overlayImgRef.naturalHeight;

  async function capture() {
    const track = cameraStream.current!.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);
    const blob = await imageCapture.takePhoto({
      imageWidth: 4096,
      imageHeight: 2160, 
    });
    const dataUrl = await new Promise<string>(resolve => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
    onCapture({dataUrl});
  }

  const iconRotateClassName = {
    "landscape-primary": "-rotate-90",
    "landscape-secondary": "rotate-90",
    "portrait-secondary": "rotate-180",
    "portrait-primary": "",
  }[orientationType];
  return (
    <div className={`camera-view ${`orientation-${orientationType.split("-")[0]}`}`} ref={overlay}>
      <video 
        ref={video} 
        muted />
      
      {showOverlay && overlayPhotoId &&
        <PhotoImg ref={setOverlayImageRef}
          photoId={overlayPhotoId} 
          sizes="100vw"
          className="overlay"
        />}

      <div className={`buttons`}>
        <button type="button"
          onClick={onCancel}
        >
          <ArrowLeftIcon className={iconRotateClassName} />
        </button>
        <button type="button" className="shutter"onClick={capture}></button>
        <button type="button"
          onClick={() => setShowOverlay(s => !s)}
          className={`overlay-toggle ${overlayPhotoId == null ? "invisible" : ""}`}
        >
          {showOverlay ? <EyeClosedIcon className={iconRotateClassName} /> : <EyeIcon className={iconRotateClassName} />}
        </button>
      </div>
    </div>
  );
}

interface ReviewViewProps {
  photo: PhotoAsDataUrl,
  onCancel: () => void,
  onAccept: (photo: PhotoAsDataUrl, rotation: number) => void,
}

export function ReviewView({
  photo,
  onCancel,
  onAccept
}: ReviewViewProps) {
  const image = useMemo(() => { const i = new Image(); i.src = photo.dataUrl; return i; }, [photo.dataUrl])
  const [ rotation, setRotation ] = useState<number>(0);

  useEffect(() => {
    // Assume if width > height this was taken in landscape
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    const updateRotation = () => setRotation(image.naturalWidth < image.naturalHeight ? 0 : -9);
    if (image.complete) {
      updateRotation();
    } else {
      image.addEventListener("load", updateRotation);
      return () => image.removeEventListener("load", updateRotation);
    }
  }, [image])

  const [ saving, setSaving ] = useState(false);
  async function doAccept() {
    setSaving(true);
    await onAccept(photo, rotation);
    setSaving(false);
  }

  return (
    <div className={`review-view`}>
      <img src={photo.dataUrl} sizes="100vw"
            style={{
              transform: `rotate(${rotation}deg)`,
              height: rotation % 180 === 0 ? "100dvh" : "100dvw",
              width: rotation % 180 === 0 ? "100dvw" : "100dvh",
            }}
          />
      <div className="buttons">
        <button type="button" onClick={onCancel}>
          <ArrowLeftIcon />
        </button>
        <button type="button" onClick={() => setRotation(r => (r - 90) % 360)}>
          <ArrowCounterclockwiseIcon />
        </button>
        <button type="button"  onClick={() => setRotation(r => (r + 90) % 360)}>
          <ArrowClockwiseIcon />
        </button>
        <button type="button" onClick={doAccept}>
          {saving ? <Spinner /> : <SaveIcon />}
        </button>
      </div>
    </div>
  )
}