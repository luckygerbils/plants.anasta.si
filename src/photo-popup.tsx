import { ChangeEvent, FocusEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Photo } from "./model/plant";
import { SaveIcon, Spinner, TrashIcon, XIcon } from "./components/icons";

interface PhotoPopupProps {
  photo: Photo,
  onSave: (entry: Photo) => void,
  onDelete: (entryId: string) => void,
  onClose: () => void,
}

export function PhotoPopup({
  photo,
  onSave,
  onDelete,
  onClose,
}: PhotoPopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [ tags, setTags ] = useState(photo.tags ?? []);
  const [ tagInput, setTagInput ] = useState("");

  const [ saving, setSaving ] = useState(false);
  const [ confirmingDelete, setConfirmingDelete ] = useState(false);
  const [ deleting, setDeleting ] = useState(false);
  const [ error, setError ] = useState<Error|null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, [dialogRef]);

  function onTagInput(e: ChangeEvent<HTMLInputElement>) {
    console.log("input");
    const input = e.target.value;
    const firstIndexOfSpace = input.indexOf(" ");
    if (firstIndexOfSpace != -1) {
      setTags(tags => [...tags, input.substring(0, firstIndexOfSpace)]);
      setTagInput(input.substring(firstIndexOfSpace+1));
    } else {
      setTagInput(input);
    }
  }

  function deleteTag(i: number) {
    setTags(tags => [...tags.slice(0, i), ...tags.slice(i+1)]);
  }

  function submitTag(e: FormEvent<HTMLFormElement>) {
    console.log("submit");
    e.preventDefault();
    const parts = tagInput.split(" ").filter(p => p.trim().length > 0);
    setTags(tags => [...tags, ...parts]);
    setTagInput("");
  }

  function onBlur(e: FocusEvent<HTMLInputElement>) {
    console.log("blur");
    const parts = tagInput.split(" ").filter(p => p.trim().length > 0);
    setTags(tags => [...tags, ...parts]);
    setTagInput("");
  }

  async function doSave() {
    setSaving(true);
    try {
      await onSave({ ...photo, tags });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
    }
  }
  async function doDelete() {
    setDeleting(true);
    try {
      await onDelete(photo.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="photo-dialog" onClick={onClose} onClose={onClose}>
      <div className="content" onClick={e => e.stopPropagation()}>
        <div className="body">
          <div className="tags">
            {(tags ?? []).map((tag, i) => (
              <span key={tag} className="tag">
                <button type="button" onClick={() => deleteTag(i)}><XIcon size="sm" /></button> {tag}
              </span>))}
              <form onSubmit={submitTag}>
                <input value={tagInput} onChange={onTagInput} onBlur={onBlur} />
              </form>
          </div>
        </div>
        <div className="buttons">
          <button type="button" className="danger" onClick={confirmingDelete ? doDelete : () => setConfirmingDelete(true)}>
              {deleting ? <Spinner /> : (confirmingDelete ? "Confirm?" : <TrashIcon />)}
          </button>
          <button type="button" className="save" onClick={doSave}>
            {saving ? <Spinner /> : <SaveIcon />}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            <XIcon />
          </button>
        </div>
        {error && (
          <div>Error: {error.message}</div>
        )}
      </div>
    </dialog>
  );
}