import React, { createContext, Fragment, use, useEffect, useRef, useState } from "react";
import { CameraPopup, ReviewView } from "./components/camera-popup";
import { PhotoImg } from "./components/photo-img";
import { comparing, dateCompare, explicit, nullsFirst, reversed } from "./util/sorting";
import { JournalEntry, PartialJournalEntry, Photo, Plant, TAG_KEYS, TagKey } from "./model/plant";
import { loggedIn } from "./util/auth";
import { CalendarPlusIcon, CameraIcon, ChevronLeft, ChevronRight, HamburgerIcon, ImageIcon, ImagePlusIcon, PencilSquareIcon, PeopleIcon, PlusIcon, SaveIcon, Spinner, TrashIcon, UploadIcon, XIcon } from "./components/icons";
import { deletePhoto, deletePlant, getPlant, putPlant, uploadPhoto } from "./util/api";
import { JournalEntryPopup } from "./journal-entry-popup";
import { markdown } from "./util/markdown";
import { AutosizeTextArea } from "./components/autosize-text-area";
import { PhotoPopup } from "./photo-popup";

interface AdminPlantPageProps {
  plantId?: string,
  edit?: boolean,
}

const LocationContext = createContext<(url: string) => void>(() => {})

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
    (async () => {
      if (!await loggedIn()) {
        const redirect = `${location.pathname}${location.search}`
        location.assign(`/login?${new URLSearchParams({ redirect })}`);
        return;
      }

      if (plantId == null) {
        return;
      }
      
      try {
        setState({ result: await getPlant(plantId) });
      } catch (e) {
        setState({ error: e as Error });
      }
    })();
  }, []);

  async function loadPlantFromUrl() {
    setState({ loading: true });
    const plantId = new URL(location.href).searchParams.get("plantId")!;
    try {
        setState({ result: await getPlant(plantId) });
    } catch (e) {
      setState({ error: e as Error });
    }
  }

  function goTo(url: string) {
    history.pushState(url, "", url);
    loadPlantFromUrl();
  }

  useEffect(() => {
    window.addEventListener("popstate", loadPlantFromUrl);
    return () => window.removeEventListener("popstate", loadPlantFromUrl);
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
    return (
      <LocationContext value={goTo}>
        <AdminPlantPageInternal plant={result.plant} 
          next={result.next} 
          prev={result.prev}
          defaultEditing={edit} />
      </LocationContext>
    )
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
  const [ cameraOpen, setCameraOpen ] = useState(false);

  const [ editing, setEditing ] = useState(defaultEditing ?? false);
  const [ addPhotoOpen, setAddPhotoOpen ] = useState(false);

  const [ saving, setSaving ] = useState(false);
  const [ deleting, setDeleting ] = useState(false);
  const [ deletingPhoto, setDeletingPhoto ] = useState(false);
  const [ confirmingDelete, setConfirmingDelete ] = useState(false);

  const [ name, setName ] = useState(plant.name);
  const [ scientificName, setScientificName ] = useState(plant.scientificName);
  const [ description, setDescription ] = useState(plant.description ?? "");
  const [ tags, setTags ] = useState(plant.tags);
  const [ photos, setPhotos ] = useState(plant.photos);
  const [ links, setLinks ] = useState(plant.links ?? []);
  const [ journal, setJournal ] = useState(plant.journal ?? []);

  const [ error, setError ] = useState<string|null>(null);
  const goTo = use(LocationContext);

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
  const [ lastUploadedPhotoId, setLastUploadedPhotoId ] = useState<string|null>(null);

  const [ editingJournalEntry, setEditingJournalEntry ] = useState<JournalEntry|PartialJournalEntry|null>(null);
  const [ editingPhoto, setEditingPhoto ] = useState<Photo|null>(null);

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

  async function doSavePlant() {
    setSaving(true);
    try {
      await putPlant({
        id: plant.id,
        name, scientificName, description,
        tags, photos, links, journal,
      });
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
    window.location.assign(`/admin/list`);
    setDeleting(false);
  }

  async function doPutJournalEntry(journalEntry: JournalEntry|PartialJournalEntry) {
    const fullJournalEntry: JournalEntry = !("id" in journalEntry) ?
      { id: crypto.randomUUID().substring(0, 8), ...journalEntry } : journalEntry;
    const index = journal.findIndex(({ id }) => id === fullJournalEntry.id);
    const newJournal = index === -1 
      ? [...journal, fullJournalEntry] 
      : [ ...journal.slice(0, index), fullJournalEntry, ...journal.slice(index+1) ];
    await putPlant({ id: plant.id, name, scientificName, tags, photos, links, journal: newJournal, });
    setJournal(newJournal);
  }

  async function doDeleteJournalEntry(journalEntryId: string) {
    const index = journal.findIndex(({ id }) => id === journalEntryId);
    const newJournal = [ ...journal.slice(0, index), ...journal.slice(index+1) ];
    await putPlant({ id: plant.id, name, scientificName, tags, photos, links, journal: newJournal, });
    setJournal(newJournal);
  }

  async function doSavePhoto(photo: Photo) {
    const index = photos.findIndex(({ id }) => id === photo.id);
    const newPhotos = [ ...photos.slice(0, index), photo, ...photos.slice(index+1) ];
    await putPlant({ id: plant.id, name, scientificName, tags, photos: newPhotos, links, journal, });
    setPhotos(newPhotos);
  }

  const sortedPhotos = [...(photos ?? [])]
    .sort(reversed(comparing(p => p.modifyDate, nullsFirst(dateCompare))));
  const sortedPhotosByTag = sortedPhotos
    .reduce((photosByTag, photo) => {
      for (const tag of (photo.tags ?? [])) {
        if (!photosByTag.has(tag)) {
          photosByTag.set(tag, []);
        }
        photosByTag.get(tag)?.push(photo);
      }
      return photosByTag;
    }, new Map<string, Photo[]>());
  sortedPhotosByTag.set("all", sortedPhotos);
  const photoTags = Array.from(sortedPhotosByTag.keys())
    .sort(explicit(["all", "timeline"]));

  const sortedJournal = [...(journal ?? [])].sort(reversed(comparing(entry => entry.date, dateCompare)));
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
          overlayPhotoId={sortedPhotos.length > 0 ? `${plant.id}/${sortedPhotos[0].id}` : undefined}
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
              <li key={key} className="tag">
                <a href={`/admin/list?${new URLSearchParams({[key as string]: tags[key]!})}`}>{key}: {tags[key]}</a>
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
      {((description && description.length > 0) || editing) && (
        <section className={`description ${editing ? "editing" : ""}`}>
          {/* eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml */}
          <div dangerouslySetInnerHTML={{__html: markdown(description)}}></div>
          {editing && (
            <AutosizeTextArea value={description} onChange={e => setDescription(e.target.value)} />
          )}
        </section>
      )}
      {((links && links.length > 0) || editing) && (
        <section className={`links ${editing ? "editing" : ""}`}>
          {links.map(({site, url}, index) => 
            // eslint-disable-next-line @eslint-react/no-array-index-key
            <Fragment key={index}>
              {!editing && <a href={url}>{site}</a>}
              {editing && <>
                  <input value={site} onChange={e => setLinks(links => [...links.slice(0, index), { ...links[index], site: e.target.value }, ...links.slice(index+1)])} />
                  <input value={url} onChange={e => setLinks(links => [...links.slice(0, index), { ...links[index], url: e.target.value }, ...links.slice(index+1)])} />
                  <button type="button" onClick={() => setLinks(links => [...links.slice(0, index), ...links.slice(index+1)])}><XIcon /></button>
                </>}
            </Fragment>)}
            {editing && (
              <button type="button" className="add-button" onClick={() => setLinks(links => [...links, { site: "", url: "" }])}>
                <PlusIcon /> Add Link
              </button>
            )}
        </section>
      )}
      <section className="photos">
        {sortedPhotos.length > 0 && (
          <>
            <nav>
              {photoTags
                .map(tag => (
                  <label key={tag}>
                    <input type="radio" name="tags" defaultChecked={photoTags.includes("timeline") ? tag === "timeline" : tag === "all"} /> {tag}
                  </label>
                ))}
            </nav>
            {photoTags.map(tag =>
              <ul key={tag}>
                {sortedPhotosByTag.get(tag)!.map((photo, i) => (
                  <li key={photo.id} ref={photo.id === lastUploadedPhotoId ? e => e?.scrollIntoView() : undefined}>
                    <div className="counter">
                      <span>{i+1}/{sortedPhotosByTag.get(tag)!.length}</span>
                      {editing && (
                        <>
                          <button type="button" className="edit" disabled={buttonsDisabled}
                            onClick={() => setEditingPhoto(photo)}
                          >
                            <PencilSquareIcon />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="date">{photo.modifyDate?.substring(0, 10)}</div>
                    <div className="tags">{(photo.tags ?? []).map(tag => <span key={tag}>{tag}</span>)}</div>
                    <PhotoImg loading="lazy" sizes="100vw" photoId={`${plant.id}/${photo.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {sortedPhotos.length === 0 && (
          <div className="no-photos-placeholder">
            <ImageIcon size="2xl" />
            <button type="button" onClick={() => setCameraOpen(true)}>
              <CameraIcon className="mr-2"/> Take a Photo
            </button>
            <button type="button" onClick={() => photoInput.current?.click()}>
              <UploadIcon className="mr-2" /> Upload existing Photos
            </button>
          </div>
        )}
      </section>
      {editingPhoto != null && (
        <PhotoPopup 
          photo={editingPhoto}
          onSave={doSavePhoto}
          onDelete={doDeletePhoto}
          onClose={() => setEditingPhoto(null)} 
        />
      )}

      {sortedJournal.length > 0 && 
        <section className="journal">
          {sortedJournal.map(entry => (
              <div key={entry.id} className="journal-entry">
                <div className="date">{entry.date.substring(0, 10)}</div>
                {/* eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml */}
                <div className="text" dangerouslySetInnerHTML={{__html: markdown(entry.text ?? "")}}></div>
                {editing && <button type="button" onClick={() => setEditingJournalEntry(entry)}>Edit</button>}

              </div>
            ))}
        </section>}
      {editingJournalEntry != null && (
        <JournalEntryPopup 
          journalEntry={editingJournalEntry}
          onSave={doPutJournalEntry}
          onDelete={doDeleteJournalEntry}
          onClose={() => setEditingJournalEntry(null)} 
        />
      )}
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
            {prev ? <a href={`/admin/plant?plantId=${prev}`} onClick={e => { e.preventDefault(); goTo(e.currentTarget.href); }}><ChevronLeft /></a> : <div className="disabled"><ChevronLeft /></div>}
            <a href="/admin/list"><HamburgerIcon /></a>
            <a href={`/${plant.id}`}><PeopleIcon /></a>
            <button type="button" onClick={() => setEditing(true)}><PencilSquareIcon /></button>
            <button type="button" onClick={() => setAddPhotoOpen(true)}><ImagePlusIcon /></button>
            <button type="button" onClick={() => setEditingJournalEntry({ date: new Date().toISOString().substring(0, 10) })}><CalendarPlusIcon /></button>
            {next ? <a href={`/admin/plant?plantId=${next}`} onClick={e => { e.preventDefault(); goTo(e.currentTarget.href); }}><ChevronRight /></a> : <div className="disabled"><ChevronRight /></div>}
          </>
        )}
      </nav>
    </>
  );
}