import { useEffect, useState } from "react";
import { CameraPopup } from "./components/camera-popup";
import { PhotoImg } from "./components/photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./util/sorting";
import { Plant, Tag, TAG_KEYS, TagKey } from "./model/plant";
import { loggedIn } from "./util/auth";
import { Spinner } from "./components/icons";
import { deletePhoto, deletePlant, getPlant, putPlant, uploadPhoto } from "./util/api";

interface PageProps {
  plantId?: string,
}

export function EditPlantPage({
  plantId
}: PageProps) {
  const [ { result, loading, error }, setState ] = useState<{ 
    result?: Awaited<ReturnType<typeof getPlant>>, 
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
        setState({ result: await getPlant(plantId) });
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
  } else if (result?.plant == null) {
    return (
      <div className="not-found-page">
        <div>No plant found with id <code>{plantId}</code></div>
      </div>
    )
  } else {
    return <PlantPage plant={result.plant} next={result.next} prev={result.prev} />
  }
}

interface PlantPageProps {
  plant: Plant, 
  prev?: string, 
  next?: string,
}

export function PlantPage({
  plant, 
  prev, 
  next,
}: PlantPageProps) {
  const { links } = plant;

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
  const [ photos, setPhotos ] = useState(plant.photos);

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

  async function doUploadPhoto({ dataUrl }: { dataUrl: string }, rotation?: number) {
    try {
      const photo = await uploadPhoto(plant.id, { dataUrl }, rotation);
      setPhotos(photos => [...photos, photo]);
      setCameraOpen(false);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
  }

  async function doDeletePhoto(photoId: string) {
    setDeletingPhoto(true);
    try {
      await deletePhoto(plant.id, photoId);
      setPhotos(photos => {
        const photoIndex = photos.findIndex(({id}) => id === photoId);
        const newPhotos = [...photos];
        newPhotos.splice(photoIndex, 1);
        return newPhotos;
      });
      setDeletingPhoto(false);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
  }

  async function doPutPlant() {
    setSaving(true);
    plant!.name = name;
    plant!.scientificName = scientificName;
    plant!.tags = tags;
    try {
      await putPlant(plant!);
    } catch (e) {
      setError((e as Error).message);
    }
    setEditing(false);
    setSaving(false);
  }

  async function doDeletePlant() {
    setDeleting(true);
    try {
      await deletePlant(plant.id);
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
        <button disabled={buttonsDisabled} type="button" onClick={() => editing ? doPutPlant() : setEditing(true)}>{editing ? "Save" : "Edit"}</button>
        <button disabled={buttonsDisabled} type="button" onClick={() => setCameraOpen(true)}>Add Photo</button>
        <button disabled={buttonsDisabled} type="button" onClick={() => confirmingDelete ? doDeletePlant() : setConfirmingDelete(true)}>{confirmingDelete ? "Confirm?" : "Delete"}</button>
        {next ? <a href={`/edit?plantId=${next}`}>Next</a> : <div>Next</div>}
      </nav>
      {cameraOpen && 
        <CameraPopup 
          onCancel={() => setCameraOpen(false)} 
          onCapture={doUploadPhoto} />}
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
                  needsLabel: <label>Needs Label: <input  type="checkbox" checked={value === "true"}  onChange={e => setTag(key, e.target.checked)}  /></label>,
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
                    onClick={confirmingDeletePhotoId === id ? () => doDeletePhoto(confirmingDeletePhotoId) : () => setConfirmingDeletePhotoId(id)}
                  >
                    {deleting && <Spinner /> }
                    {!deleting && confirmingDeletePhotoId === id && "Confirm?"}
                    {!deleting && !confirmingDeletePhotoId && "Delete"}
                  </button>
                )}
              </div>
              <div className="date">{modifyDate?.substring(0, 10)}</div>
              
              <PhotoImg loading="lazy" sizes="100vw" photoId={`${plant.id}/${id}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}