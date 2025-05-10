import { useEffect, useRef, useState } from "react";
import { Plant, Tag } from "./plant";
import { comparing, localeCompare } from "./sorting";
import { ChevronLeft, ChevronRight, XIcon } from "./icons";

interface TagPopupProps {
  allPlants: Plant[],
  tag: Tag,
  onClose?: () => void,
}

export function TagPopup({
  allPlants,
  tag,
  onClose
}: TagPopupProps) {

  const plantsByTagValue = allPlants.map((plant) => [plant.tags[tag.key], plant] as const)
    .reduce((m, [value, plant]) => m.set(value!, [...(m.get(value!) ?? []), plant]), new Map<string, Plant[]>());
  const tagValues = Array.from(plantsByTagValue.keys()).sort(localeCompare);
  
  const [ tagValueIndex, setTagValueIndex ] = useState(tagValues.indexOf(tag.value!));
  const tagValue = tagValues[tagValueIndex];
  const plantsWithTagValue = plantsByTagValue.get(tagValue)!;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, [dialogRef]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [closeButtonRef]);

  return (
    <dialog ref={dialogRef} className="tag-dialog" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>
        <header>
          <button type="button" onClick={() => setTagValueIndex(i => i-1)} disabled={tagValueIndex === 0}>
            <ChevronLeft />
          </button>
          <span>{tag.key}: {tagValue ?? "false"}</span>
          <button type="button" onClick={() => setTagValueIndex(i => i+1)} disabled={tagValueIndex == tagValues.length - 1}>
            <ChevronRight />
          </button>
          <button ref={closeButtonRef} type="button" onClick={onClose}><XIcon /></button>
        </header>
        <ul>
          {plantsWithTagValue.sort(comparing(p => p.name, localeCompare)).map(plant => (
            <li key={plant.id} className="plant"><a href={`/${plant.id}`}>{plant.name}</a></li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}