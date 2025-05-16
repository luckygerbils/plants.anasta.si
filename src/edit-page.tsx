import { useEffect, useState } from "react";
import { CameraPopup } from "./camera-popup";
import { PhotoImg } from "./photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./sorting";
import { Plant, Tag, TAG_KEYS, TagKey } from "./plant";
import { TagPopup } from "./tag-popup";
import { apiFetch, loggedIn } from "./auth";
import { Spinner } from "./icons";

interface PageProps {
  plantId?: string,
}

interface GetPlantResponse { 
  plantId: string,
  plant?: Plant, 
  next?: string, 
  prev?: string,
  caller: string,
}

async function getPlant(plantId: string): Promise<GetPlantResponse> {
  const response = await apiFetch(`/api/getPlant`, { 
    method: "POST", 
    headers: { "content-type": "application/json" }, 
    body: JSON.stringify({ plantId }) 
  });
  return response.json();
}

export function EditPlantPage({
  plantId
}: PageProps) {
  const [ { props, loading, error }, setState ] = useState<{ 
    props?: Parameters<typeof PlantPage>[0], 
    loading?: boolean, 
    error?: Error 
  }>({ loading: true })
  
  useEffect(() => {
    if (!loggedIn()) {
      const redirect = `${location.pathname}${location.search}`
      location.assign(`/login?${new URLSearchParams({ redirect })}`);
      return;
    }

    if (plantId == null) {
      return;
    }

    (async () => {
      try {
        setState({ props: await getPlant(plantId) });
      } catch (e) {
        setState({ error: e as Error });
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="loading-page">
        <Spinner />
      </div>
    );
  } else if (error) {
    return <div>{error.message}</div>;
  } else {
    return <PlantPage {...props!} />
  }
}

export function PlantPage({
  plantId,
  plant, 
  prev, 
  next,
  caller,
}: GetPlantResponse) {
  if (plant == null) {
    return (
      <div>
        No plant found with id {plantId}
      </div>
    )
  }

  const { links, photos } = plant;

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
      await apiFetch(`/api/uploadPhoto`, {
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
      await apiFetch(`/api/deletePhoto`, {
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
      await apiFetch(`/api/putPlant`, {
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
      await apiFetch(`/api/deletePlant`, {
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
      <pre>{caller}</pre>
    </>
  )
}