import React, { PropsWithChildren, Ref, forwardRef, useImperativeHandle, useRef } from "react";

type OmittedImgProps = "src"|"srcset"|"sizes";
interface PhotoImgPropsBase extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, OmittedImgProps> {
  photoId: string,
  ref?: Ref<{naturalWidth?: number, naturalHeight?: number}>,
  dev?: boolean,
}

type OriginalPhotoImgProps = PhotoImgPropsBase & { original: true, }
type ProgressivePhotoImgProps = PhotoImgPropsBase & { progressive: true, }
type SizedPhotoImgProps = PhotoImgPropsBase & { sizes: string, /* required */ }
type PhotoImgProps = OriginalPhotoImgProps | ProgressivePhotoImgProps | SizedPhotoImgProps

export const PhotoImg = function PhotoImg({ 
  photoId,
  ref,
  dev=false,
  ...restProps
}: PropsWithChildren<PhotoImgProps>) {
  const img = useRef<HTMLImageElement>(null);

  if (ref != null) {
    useImperativeHandle(ref, () => {
      return {
        get naturalWidth() {
          return img.current?.naturalWidth;
        },
        get naturalHeight() {
          return img.current?.naturalHeight;
        },
      };
    }, []);
  }

  if ("original" in restProps) {
    const { original: _, ...imgProps } = restProps;
    return (
      <img src={`${dev ? "" : "https://beta.botanami.anasta.si"}/data/photos/${photoId}/original.jpg`} {...imgProps} ref={img} />
    );
  } if ("progressive" in restProps) {
    const { progressive: _, ...imgProps } = restProps;
    return (
      <img src={`${dev ? "" : "https://beta.botanami.anasta.si"}/data/photos/${photoId}/progressive.jpg`} {...imgProps} ref={img} />
    );
  } else {
    return (
      <img src={`/data/photos/${photoId}/original.jpg`} ref={img}
        srcSet={["100", "250", "500", "1000"]
          .map(size => `${dev ? "" : "https://beta.botanami.anasta.si"}/data/photos/${photoId}/size-${size}.jpg ${size}w`).join(", ")}
        {...restProps} />
    );
  }
};