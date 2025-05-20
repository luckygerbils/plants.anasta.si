import React, { useEffect, useRef, useState } from "react";
import { CameraPopup, ReviewView } from "./components/camera-popup";
import { PhotoImg } from "./components/photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./util/sorting";
import { Plant, Tag, TAG_KEYS, TagKey } from "./model/plant";
import { loggedIn } from "./util/auth";
import { CameraIcon, ChevronLeft, ChevronRight, ImagePlusIcon, PencilSquareIcon, PeopleIcon, PlusIcon, SaveIcon, Spinner, TrashIcon, UploadIcon, XIcon } from "./components/icons";
import { deletePhoto, deletePlant, getPlant, putPlant, uploadPhoto } from "./util/api";

interface AdminPlantPageProps {
  plantId?: string,
  edit?: boolean,
}

export function AdminPlantPage({
  plantId,
  edit,
}: AdminPlantPageProps) {
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
    return <AdminPlantPageInternal plant={result.plant} next={result.next} prev={result.prev} defaultEditing={edit} />
  }
}

interface AdminPlantPageInternalProps {
  plant: Plant, 
  prev?: string, 
  next?: string,
  defaultEditing?: boolean,
}

interface PhotoAsDataUrl {
  dataUrl: string,
}

function AdminPlantPageInternal({
  plant, 
  prev, 
  next,
  defaultEditing,
}: AdminPlantPageInternalProps) {
  const { links } = plant;

  const [ cameraOpen, setCameraOpen ] = useState(false);
  const [ selectedTag, setSelectedTag ] = useState<Tag|null>(null);

  const [ editing, setEditing ] = useState(defaultEditing ?? false);
  const [ addPhotoOpen, setAddPhotoOpen ] = useState(false);

  const [ creating, setCreating ] = useState(false);
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

  const photoInput = useRef<HTMLInputElement>(null);
  const [ reviewPhoto, setReviewPhoto ] = useState<PhotoAsDataUrl|null>(null);
  const [ lastUploadedPhotoId, setLastUploadedPhotoId ] = useState<string|null>(null)

  async function doUploadPhoto({ dataUrl }: { dataUrl: string }, rotation?: number) {
    try {
      const photo = await uploadPhoto(plant.id, { dataUrl }, rotation);
      setPhotos(photos => [...photos, photo]);
      setLastUploadedPhotoId(photo.id);
      setAddPhotoOpen(false);
      setReviewPhoto(null);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
  }

  async function doDeletePhoto(photoId: string) {
    setConfirmingDeletePhotoId(null);
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

  async function createPlant() {
    setCreating(true);
    try {
      const id = crypto.randomUUID().substring(0, 8);
      await putPlant({
        id,
        name: "",
        scientificName: "",
        tags: {},
        photos: [],
        links: [],
      });
      location.assign(`/admin/plant?plantId=${id}&edit=true`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function doSavePlant() {
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
        <h1
          contentEditable={editing} 
          suppressContentEditableWarning={editing}
          onBlur={e => setName(e.target.innerText)}
        >
            {name.length > 0 ? name : "No Name"}
        </h1>
        {(scientificName || editing) &&
          <h2 className="scientific-name"
            contentEditable={editing}
            suppressContentEditableWarning={editing}
            onBlur={e => setScientificName(e.target.innerText)}
          >
            {(scientificName && scientificName.length > 0) ? scientificName : "No Scientific Name"}
          </h2>}
      </header>
      {cameraOpen && 
        <CameraPopup 
          onCancel={() => setCameraOpen(false)} 
          onCapture={(photo) => { 
            setCameraOpen(false); 
            setReviewPhoto(photo);
          }} />}
      <input type="file" className="hidden-photo-input"
        ref={photoInput} 
        accept="image/jpg,image/jpeg"
        onChange={async e => {
          const dataUrl = await new Promise<string>(resolve => {
            const fr = new FileReader();
            fr.onloadend = () => resolve(fr.result as string);
            fr.readAsDataURL(e.target.files![0]);
          });
          setReviewPhoto({ dataUrl })
        }} />
      {reviewPhoto &&
        <ReviewView
          photo={reviewPhoto}
          onCancel={() => {
            setReviewPhoto(null);
            if (photoInput?.current) {
              photoInput.current.value = "";
            }
          }}
          onAccept={doUploadPhoto}
        />}
        
      {error && <div className="error">{error}</div>}
      <section className={`tags ${editing ? "editing" : ""}`}>
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
              <React.Fragment key={key}>{
                {
                  location: <><label>Location:</label> <input value={value ?? ""} onChange={e => setTag(key, e.target.value)} /></>,
                  planted: <><label>Planted:</label> <input value={value ?? ""} onChange={e => setTag(key, e.target.value)}  /></>,
                  confidence: (
                    <>
                      <span>Confidence:</span>
                      <span className="radios">
                        <label><input type="radio" checked={value === "high"} onChange={e => setTag(key, "high")} /> high</label>
                        <label><input type="radio" checked={value === "medium"} onChange={e => setTag(key, "medium")}/> medium</label>
                        <label><input type="radio" checked={value === "low"} onChange={e => setTag(key, "low")}/> low</label>
                      </span>
                    </>
                  ),
                  public: <><label htmlFor="public">Public:</label> <input id="public" type="checkbox" checked={value === "true"} onChange={e => setTag(key, e.target.checked)}  /></>,
                  bonsai: <><label htmlFor="bonsai">Bonsai:</label> <input id="bonsai" type="checkbox" checked={value === "true"} onChange={e => setTag(key, e.target.checked)}  /></>,
                  likelyDead: <><label htmlFor="likelyDead">Likely Dead:</label> <input id="likelyDead" type="checkbox" checked={value === "true"}  onChange={e => setTag(key, e.target.checked)}  /></>,
                  needsIdentification: <><label htmlFor="needsId">Needs ID:</label> <input id="needsId" type="checkbox" checked={value === "true"}  onChange={e => setTag(key, e.target.checked)}  /></>,
                  needsLabel: <><label htmlFor="needsLabel">Needs Label:</label> <input id="needsLabel" type="checkbox" checked={value === "true"}  onChange={e => setTag(key, e.target.checked)}  /></>,
                }[key]
              }</React.Fragment>
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
            <li key={id} ref={id === lastUploadedPhotoId ? e => e?.scrollIntoView() : undefined}>
              <div className="counter">
                <span>{i+1}/{sortedPhotos.length}</span>
                {editing && (
                  <button type="button" className="delete" disabled={buttonsDisabled}
                    onClick={confirmingDeletePhotoId === id ? () => doDeletePhoto(confirmingDeletePhotoId) : () => setConfirmingDeletePhotoId(id)}
                  >
                    {deleting && <Spinner /> }
                    {!deleting && confirmingDeletePhotoId === id && "Confirm?"}
                    {!deleting && confirmingDeletePhotoId !== id && "Delete"}
                  </button>
                )}
              </div>
              <div className="date">{modifyDate?.substring(0, 10)}</div>
              <PhotoImg loading="lazy" sizes="100vw" photoId={`${plant.id}/${id}`} />
            </li>
          ))}
        </ul>
      </section>
      <nav>
        {editing && (
          <>
            <button type="button"
              disabled={buttonsDisabled}
              onClick={() => confirmingDelete ? doDeletePlant() : setConfirmingDelete(true)}
              className={confirmingDelete ? "danger" : "warning"}
            >
              {deleting ? <Spinner /> : <TrashIcon />}
            </button>
            <button type="button"
              disabled={buttonsDisabled}
              onClick={doSavePlant}
              className="save"
            >
              {saving ? <Spinner /> : <SaveIcon />}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              <XIcon />
            </button>
          </>
        )}
        {addPhotoOpen && (
          <>
            <button type="button"
              onClick={() => photoInput.current?.click()}  
            >
              {saving ? <Spinner /> : <UploadIcon />}
            </button>
            <button type="button"
              onClick={() => setCameraOpen(true)}
            >
              {saving ? <Spinner /> : <CameraIcon />}
            </button>
            <button type="button" onClick={() => setAddPhotoOpen(false)}>
              <XIcon />
            </button>
          </>
        )}
        {!(editing || addPhotoOpen) && (
          <>
            {prev ? <a href={`/admin/plant?plantId=${prev}`}><ChevronLeft /></a> : <div className="disabled"><ChevronLeft /></div>}
            <a href={`/${plant.id}`}><PeopleIcon /></a>
            <button type="button" onClick={createPlant}><PlusIcon /></button>
            <button type="button" onClick={() => setEditing(true)}><PencilSquareIcon /></button>
            <button type="button" onClick={() => setAddPhotoOpen(true)}><ImagePlusIcon /></button>
            {next ? <a href={`/admin/plant?plantId=${next}`}><ChevronRight /></a> : <div className="disabled"><ChevronRight /></div>}
          </>
        )}
      </nav>
    </>
  );
}