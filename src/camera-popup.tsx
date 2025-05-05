import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowClockwiseIcon, ArrowCounterclockwiseIcon, ArrowLeftIcon, EyeClosedIcon, EyeIcon, SaveIcon, Spinner } from "./icons";
import { PhotoImg } from "./photo-img";
function classNames(...args: (string|boolean)[]) {
  return "";
}

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
  onCapture,
}: CameraPopupProps) {
  const [ photo, setPhoto ] = useState<PhotoAsDataUrl|null>(null);

  if (photo) {
    return (
      <ReviewView 
        photo={photo}
        onCancel={() => setPhoto(null)}
        onAccept={onCapture}
      />
    );
  } else {
    return (
      <CameraView 
        overlayPhotoId={overlayPhotoId} 
        onCancel={onCancel}
        onCapture={setPhoto} 
      />
    )
  }
}

interface CameraViewProps {
  overlayPhotoId?: string,
  onCancel: () => void,
  onCapture: (photo: PhotoAsDataUrl) => void,
}

function CameraView({
  overlayPhotoId,
  onCancel,
  onCapture
}: CameraViewProps) {

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

  // const overlay = useRef<HTMLDivElement>(null);
  // useEffect(() => {
  //   if (!document.fullscreenElement) {
  //     overlay?.current?.requestFullscreen().catch(() => {});
  //   }
  // });

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
  // className={classNames(
  //   "w-screen h-dvh grid items-center justify-center fixed top-0 bg-black z-10", 
  //   orientationType.startsWith("portrait") && "",
  //   orientationType.startsWith("landscape") && "flex-col"
  // )}
  // classNames(
  //   orientationType.startsWith("portrait") && "mb-10",
  //   orientationType.startsWith("landscape") && "h-dvh mr-10",
  // )
  return (
    <div className={`camera-view ${`orientation-${orientationType.split("-")[0]}`}`}>
      <video 
        ref={video} 
        muted 
        style={{gridRow: 1, gridColumn: 1}}  />
      
      {showOverlay && overlayPhotoId &&
        <PhotoImg ref={setOverlayImageRef}
          photoId={overlayPhotoId} 
          sizes="100vw"
          style={{
            gridRow: 1, 
            gridColumn: 1, 
            transform: overlayIsLandscape ? 
              `scale(${window.innerWidth/overlayImgRef.naturalHeight!}) rotate(90deg)` : undefined,
            // height: overlayIsLandscape ? "100dvh" : "100dvw",
            // width: overlayIsLandscape ? "100dvw" : "100dvh",
          }}
          className={classNames(
            "opacity-30 object-fill",
            // overlayIsLandscape && "rotate-90",
            // overlayIsLandscape && "h-[100dvw]",
            orientationType.startsWith("portrait") && "mb-10",
            orientationType.startsWith("landscape") && "h-dvh mr-10",
          )}/>}
      
      {/* classNames(
          "absolute flex items-center justify-evenly",
          orientationType.startsWith("portrait") && "bottom-0 pb-10 w-screen",
          orientationType.startsWith("landscape") && "flex-col-reverse right-0 pr-10 h-dvh"
        ) */}
      <div className={`buttons`}>
        <button type="button"
          onClick={onCancel}
        >
          <ArrowLeftIcon className={iconRotateClassName} />
        </button>
        <button type="button" className="shutter"onClick={capture}></button>
        <button type="button"
          onClick={() => setShowOverlay(s => !s)}
          className={classNames(overlayPhotoId == null && "invisible")}
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

function ReviewView({
  photo,
  onCancel,
  onAccept
}: ReviewViewProps) {
  const image = useMemo(() => { const i = new Image(); i.src = photo.dataUrl; return i; }, [photo.dataUrl])
  const [ rotation, setRotation ] = useState<number>(0);

  useEffect(() => {
    // Assume if width > height this was taken in landscape
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
              gridRow: 1, gridColumn: 1, 
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