import { useState } from "react";
import { CameraPopup } from "./camera-popup";
import { PhotoImg } from "./photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./sorting";

interface PageProps {
  plant: {
    id: string,
    name: string,
    scientificName?: string,
    photos: { id: string, modifyDate: string }[],
    links: { site: string, url: string }[],
    location?: string,
  },
  prev?: string,
  next?: string,
  dev?: boolean,
}

export function PlantPage({
  plant: {
    id: plantId,
    name,
    scientificName,
    links,
    photos,
    location,
  },
  prev,
  next,
  dev=false,
}: PageProps) {
  const [ cameraOpen, setCameraOpen ] = useState(false);

  async function uploadPhoto(photo: { dataUrl: string }, rotation?: number) {
    await fetch(`/api/uploadPhoto`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        plantId,
        photo,
        rotation,
      })
    })
    setCameraOpen(false);
  }

  const sortedPhotos = [...(photos ?? [])].sort(reversed(comparing(p => p.modifyDate, nullsFirst(dateCompare))))

  return (
    <>
      <header>
        <h1>{name}</h1>
        {scientificName && <h2 className="scientific-name">{scientificName}</h2>}
      </header>
      {dev && (
        <>
          <nav>
            { prev ? <a href={`/${prev}`}>Prev</a> : <div>Prev</div>}
            <button type="button" onClick={() => setCameraOpen(true)}>Add Photo</button>
            {next ? <a href={`/${next}`}>Next</a> : <div>Next</div>}
          </nav>
          {cameraOpen && 
            <CameraPopup 
              onCancel={() => setCameraOpen(false)} 
              onCapture={uploadPhoto} />}
        </>
      )}
      <section className="quick-info">
        <div><strong>Location:</strong> {location ?? "Unknown"}</div>
      </section>
      <section className="links">
        <ul>
          {(links ?? []).map(({site, url}) => 
            <li key={site}><a href={url}>{site}</a></li>)}
        </ul>
      </section>
      <section className="photos">
        <ul>
          {sortedPhotos.map(({ id, modifyDate }, i) => (
            <li key={id}>
              <div className="counter">{i+1}/{sortedPhotos.length}</div>
              <div className="date">{modifyDate?.substring(0, 10)}</div>
              <PhotoImg loading="lazy" sizes="100vw" photoId={`${plantId}/${id}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}