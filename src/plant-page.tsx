import { useState } from "react";
import { CameraPopup } from "./camera-popup";
import { PhotoImg } from "./photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./sorting";
import { Plant, TAG_KEYS, TagKey } from "./plant";

interface PageProps {
  plant: Plant,
  allPlants: Plant[],
  prev?: string,
  next?: string,
}

export function PlantPage({
  plant,
  allPlants,
  prev,
  next,
}: PageProps) {
  const {
    id: plantId,
    links,
    photos,
  } = plant;
  const [ cameraOpen, setCameraOpen ] = useState(false);

  const [ editing, setEditing ] = useState(false);
  const [ saving, setSaving ] = useState(false);
  const [ deleting, setDeleting ] = useState(false);
  const [ deletingPhoto, setDeletingPhoto ] = useState(false);
  const [ confirmingDelete, setConfirmingDelete ] = useState(false);
  const [ confirmingDeletePhotoId, setConfirmingDeletePhotoId ] = useState<string|null>(null);

  const [ name, setName ] = useState(plant.name);
  const [ scientificName, setScientificName ] = useState(plant.scientificName);
  const [ tags, setTags ] = useState(plant.tags);

  const [ error, setError ] = useState<string|null>(null);

  function setTag(key: TagKey, value: string|boolean) {
    if (typeof value === "string") {
      setTags(tags => [...tags.filter(tag => tag.key !== key), { key, value }]);
    } else if (value) {
      setTags(tags => [...tags.filter(tag => tag.key !== key), { key, value: "true" }]);
    } else {
      setTags(tags => [...tags.filter(tag => tag.key !== key)]);
    }
  }

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
    plant.tags = tags;
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
          onBlur={e => setName(e.target.innerText)}
        >
            {name}
        </h1>
        {(scientificName || editing) && 
          <h2 className="scientific-name" 
            contentEditable={editing} 
            suppressContentEditableWarning={editing}
            onBlur={e => setScientificName(e.target.innerText)}
          >
            {scientificName}
          </h2>}
      </header>
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
      <section className="tags">
        {!editing && <ul>{tags.map(tag => <li key={tag.key} className="tag">{tag.key}: {tag.value}</li>)}</ul>}
        {editing && (
          TAG_KEYS.map(key => {
            const value = tags.find(t => t.key === key)?.value;
            return (
              <div key={key}>{
                {
                  location: <label>Location: <input value={value ?? ""} onChange={e => setTag(key, e.target.value)} /></label>,
                  planted: <label>Planted: <input value={value ?? ""} onChange={e => setTag(key, e.target.value)}  /></label>,
                  confidence: (
                    <span>
                      Confidence:
                      <label><input type="radio" checked={value === "high"} onChange={e => setTag(key, "high")} /> high</label>
                      <label><input type="radio" checked={value === "medium"} onChange={e => setTag(key, "medium")}/> medium</label>
                      <label><input type="radio" checked={value === "low"} onChange={e => setTag(key, "low")}/> low</label>
                    </span>
                  ),
                  public: <label>Public: <input  type="checkbox" checked={value === "true"} onChange={e => setTag(key, e.target.checked)}  /></label>,
                  bonsai: <label>Bonsai: <input  type="checkbox" checked={value === "true"} onChange={e => setTag(key, e.target.checked)}  /></label>,
                  likelyDead: <label>Likely Dead: <input  type="checkbox" checked={value === "true"}  onChange={e => setTag(key, e.target.checked)}  /></label>,
                  needsIdentification: <label>Needs Identification: <input  type="checkbox" checked={value === "true"}  onChange={e => setTag(key, e.target.checked)}  /></label>,
                }[key]
              }</div>
            )
          })
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
              
              <PhotoImg loading="lazy" sizes="100vw" photoId={`${plantId}/${id}`} dev={true} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}