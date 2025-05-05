import { useEffect, useRef } from "react";
import { Plant } from "./plant";
import { comparing, localeCompare } from "./sorting";

interface LocationPopupProps {
  allPlants: Plant[],
  currentLocation?: string,
  onClose: () => void,
}

export function LocationPopup({
  allPlants,
  currentLocation,
  onClose,
}: LocationPopupProps) {
  const plantsByLocation = allPlants
    .filter(p => p.location != null)
    .reduce((m,p) => m.set(p.location!, [...(m.get(p.location!) ?? []), p]), new Map<string, Plant[]>());
  
  const currentLocationRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    currentLocationRef.current?.scrollIntoView();
  }, [currentLocationRef])
  
  return (
    <div className="location-dialog" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <ul>
          {Array.from(plantsByLocation.keys()).sort().map(location => (
            <li key={location}>
              <span className="location" ref={location === currentLocation ? currentLocationRef : undefined}>{location}</span>
              <ul>
                {plantsByLocation.get(location)!.sort(comparing(p => p.name, localeCompare)).map(plant => (
                  <li key={plant.id} className="plant"><a href={`/${plant.id}`}>{plant.name}</a></li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}