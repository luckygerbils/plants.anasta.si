import { use, useEffect, useState } from "react";
import { CameraPopup } from "./camera-popup";
import { PhotoImg } from "./photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./sorting";
import { Plant, Tag, TAG_KEYS, TagKey } from "./plant";
import { TagPopup } from "./tag-popup";

interface PageProps {
  plantId: string,
}

interface GetPlantResponse { 
  plant?: Plant, 
  next?: string, 
  prev?: string 
}

const cache = new Map();
export function fetchData(input: string | URL | globalThis.Request, init?: RequestInit,) {
  if (!cache.has(input)) {
    cache.set(input, fetch(input, init));
  }
  return cache.get(input);
}

async function getPlant(plantId: string): Promise<GetPlantResponse> {
  const response = await fetchData(`/api/getPlant`, { 
    method: "POST", 
    headers: { "content-type": "application/json" }, 
    body: JSON.stringify({ plantId }) 
  });
  return response.json()
}

export function EditPlantPage({
  plantId
}: PageProps) {
  const [ { props, loading, error }, setState ] = useState<{ props?: Parameters<typeof PlantPage>[0], loading?: boolean, error?: Error }>({ loading: true })
  useEffect(() => {
    (async () => {
      try {
        setState({ props: await getPlant(plantId) });
      } catch (e) {
        setState({ error: e as Error });
      }
    })();
  }, []);
  if (loading) {
    return "Loading..."
  } else if (error) {
    return <div>{error.message}</div>;
  } else {
    return <PlantPage {...props} />
  }
}

export function PlantPage({
  plant, prev, next,
}: GetPlantResponse) {
  if (plant == null) {
    throw new Error("Not found");
  }

  const { id: plantId, links, photos } = plant;

  const [ cameraOpen, setCameraOpen ] = useState(false);
  const [ selectedTag, setSelectedTag ] = useState<Tag|null>(null);

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
      setTags(tags => ({ ...tags, [key]: value}));
    } else if (value) {
      setTags(tags => ({ ...tags, [key]: "true"}));
    } else {
      setTags(({[key]: oldValue, ...rest}) => rest);
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
    plant!.name = name;
    plant!.scientificName = scientificName;
    plant!.tags = tags;
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
        <div>
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
        </div>
      </header>
      <nav>
        { prev ? <a href={`/edit?plantId=${prev}`}>Prev</a> : <div>Prev</div>}
        <button disabled={buttonsDisabled} type="button" onClick={() => editing ? savePlant() : setEditing(true)}>{editing ? "Save" : "Edit"}</button>
        <button disabled={buttonsDisabled} type="button" onClick={() => setCameraOpen(true)}>Add Photo</button>
        <button disabled={buttonsDisabled} type="button" onClick={() => confirmingDelete ? deletePlant() : setConfirmingDelete(true)}>{confirmingDelete ? "Confirm?" : "Delete"}</button>
        {next ? <a href={`/edit?plantId=${next}`}>Next</a> : <div>Next</div>}
      </nav>
      {cameraOpen && 
        <CameraPopup 
          onCancel={() => setCameraOpen(false)} 
          onCapture={uploadPhoto} />}
      {error && <div className="error">{error}</div>}
      <section className="tags">
        {!editing && (
          <ul>
            {TAG_KEYS.filter(key => key in tags).map(key => 
              <li key={key} className="tag" onClick={() => setSelectedTag({ key, value: tags[key] })}>
                {key}: {tags[key]}
              </li>
            )}
          </ul>
        )}
        {editing && (
          TAG_KEYS.map(key => {
            const value = tags[key];
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
      {/* {selectedTag && <TagPopup allPlants={allPlants} tag={selectedTag} onClose={() => setSelectedTag(null)} />} */}
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
              
              <PhotoImg loading="lazy" sizes="100vw" photoId={`${plantId}/${id}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}