import { useEffect, useRef, useState } from "react";
import { JournalEntry, PartialJournalEntry } from "./model/plant";
import { SaveIcon, Spinner, TrashIcon, XIcon } from "./components/icons";

interface JournalEntryPopupProps {
  journalEntry: JournalEntry|PartialJournalEntry,
  onSave: (entry: JournalEntry|PartialJournalEntry) => void,
  onDelete: (entryId: string) => void,
  onClose: () => void,
}

export function JournalEntryPopup({
  journalEntry,
  onSave,
  onDelete,
  onClose,
}: JournalEntryPopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [ date, setDate ] = useState(journalEntry.date);
  const [ text, setText ] = useState(journalEntry.text);

  const [ saving, setSaving ] = useState(false);
  const [ deleting, setDeleting ] = useState(false);
  const [ error, setError ] = useState<Error|null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, [dialogRef]);

  async function doSave() {
    setSaving(true);
    try {
      await onSave({ ...journalEntry, date, text });
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
      await onDelete((journalEntry as JournalEntry).id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="journal-entry-dialog" onClick={onClose}>
      <div className="content" onClick={e => e.stopPropagation()}>
        <div className="body">
          <textarea value={text} onChange={e => setText(e.target.value)} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="buttons">
          {"id" in journalEntry && (
            <button type="button" className="danger" onClick={doDelete}>
              {deleting ? <Spinner /> : <TrashIcon />}
            </button>)}
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