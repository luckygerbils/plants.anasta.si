import { useState } from "react";
import { CameraPopup } from "./camera-popup";
import { PhotoImg } from "./photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./sorting";
import { LocationPopup } from "./location-popup";
import { Plant } from "./plant";

interface PageProps {
  plant: Plant,
  allPlants: Plant[],
  prev?: string,
  next?: string,
  dev?: boolean,
}

export function PlantPage({
  plant,
  allPlants,
  prev,
  next,
  dev=false,
}: PageProps) {
  const {
    id: plantId,
    links,
    photos,
  } = plant;
  const [ cameraOpen, setCameraOpen ] = useState(false);
  const [ locationOpen, setLocationOpen ] = useState(false);

  const [ editing, setEditing ] = useState(false);
  const [ saving, setSaving ] = useState(false);
  const [ deleting, setDeleting ] = useState(false);
  const [ deletingPhoto, setDeletingPhoto ] = useState(false);
  const [ confirmingDelete, setConfirmingDelete ] = useState(false);
  const [ confirmingDeletePhotoId, setConfirmingDeletePhotoId ] = useState<string|null>(null);

  const [ name, setName ] = useState(plant.name);
  const [ scientificName, setScientificName ] = useState(plant.scientificName);
  const [ location, setLocation ] = useState(plant.location);
  const [ needsIdentification, setNeedsIdentification ] = useState(plant.needsIdentification);
  const [ likelyDead, setLikelyDead ] = useState(plant.likelyDead);

  const [ error, setError ] = useState<string|null>(null);

  async function uploadPhoto(photo: { dataUrl: string }, rotation?: number) {
    try {
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
    } catch (e) {
      setError((e as Error).message);
    }
    setCameraOpen(false);
  }

  async function deletePhoto(photoId: string) {
    setDeletingPhoto(true);
    try {
      await fetch(`/api/deletePhoto`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          plantId,
          photoId,
        })
      })
    } catch (e) {
      setError((e as Error).message);
    }
    setDeletingPhoto(false);
  }

  async function savePlant() {
    setSaving(true);
    plant.name = name;
    plant.scientificName = scientificName;
    plant.location = location;
    plant.needsIdentification = needsIdentification;
    plant.likelyDead = likelyDead;
    try {
      await fetch(`/api/putPlant`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          plant,
        })
      });
    } catch (e) {
      setError((e as Error).message);
    }
    setEditing(false);
    setSaving(false);
  }

  async function deletePlant() {
    setDeleting(true);
    try {
      await fetch(`/api/deletePlant`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          plantId,
        })
      });
    } catch (e) {
      setError((e as Error).message);
    }
    window.location.assign(`/${next}`);
    setDeleting(false);
  }

  const sortedPhotos = [...(photos ?? [])].sort(reversed(comparing(p => p.modifyDate, nullsFirst(dateCompare))));
  const buttonsDisabled = saving || deleting || deletingPhoto;

  return (
    <>
      <header>
        <h1 
          contentEditable={editing} 
          suppressContentEditableWarning={editing} 
          onBlur={e => setName((e.target as HTMLHeadingElement).innerText)}
        >
            {name}
        </h1>
        {(scientificName || editing) && 
          <h2 className="scientific-name" 
            contentEditable={editing} 
            suppressContentEditableWarning={editing}
            onBlur={e => setScientificName((e.target as HTMLHeadingElement).innerText)}
          >
            {scientificName}
          </h2>}
      </header>
      {dev && (
        <>
          <nav>
            { prev ? <a href={`/${prev}`}>Prev</a> : <div>Prev</div>}
            <button disabled={buttonsDisabled} type="button" onClick={() => editing ? savePlant() : setEditing(true)}>{editing ? "Save" : "Edit"}</button>
            <button disabled={buttonsDisabled} type="button" onClick={() => setCameraOpen(true)}>Add Photo</button>
            <button disabled={buttonsDisabled} type="button" onClick={() => confirmingDelete ? deletePlant() : setConfirmingDelete(true)}>{confirmingDelete ? "Confirm?" : "Delete"}</button>
            {next ? <a href={`/${next}`}>Next</a> : <div>Next</div>}
          </nav>
          {cameraOpen && 
            <CameraPopup 
              onCancel={() => setCameraOpen(false)} 
              onCapture={uploadPhoto} />}
          {error && <div className="error">{error}</div>}
        </>
      )}
      <section className="quick-info">
        <div onClick={() => setLocationOpen(true)}>
          <strong>Location: </strong> 
          <span 
            contentEditable={editing} 
            suppressContentEditableWarning={editing} 
            onBlur={e => setLocation((e.target as HTMLHeadingElement).innerText)}
          >
            {location ?? "Unknown"}
          </span>
        </div>
        {locationOpen && 
            <LocationPopup allPlants={allPlants} currentLocation={plant.location} onClose={() => setLocationOpen(false)} />}
        {dev && (
          <div className="tags">
            {(needsIdentification || editing) && <label><input checked={needsIdentification} disabled={!editing} type="checkbox" onChange={e => setNeedsIdentification(e.target.checked || undefined)} /> Needs Identification</label>}
            {(likelyDead || editing ) && <label><input checked={likelyDead} disabled={!editing} type="checkbox" onChange={e => setLikelyDead(e.target.checked || undefined)} /> Likely Dead</label>}
          </div>
        )}
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
              <div className="counter">
                <span>{i+1}/{sortedPhotos.length}</span>
                {editing && (
                  <button type="button" className="delete" disabled={buttonsDisabled}
                    onClick={confirmingDeletePhotoId === id ? () => deletePhoto(confirmingDeletePhotoId) : () => setConfirmingDeletePhotoId(id)}
                  >
                    {confirmingDeletePhotoId === id ? "Confirm?" : "Delete"}
                  </button>
                )}
              </div>
              <div className="date">{modifyDate?.substring(0, 10)}</div>
              
              <PhotoImg loading="lazy" sizes="100vw" photoId={`${plantId}/${id}`} dev={dev} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}