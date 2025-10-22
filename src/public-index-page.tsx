import { PhotoImg } from "./components/photo-img";
import { Plant } from "./model/plant";
import { comparing, localeCompare, reversed } from "./util/sorting";

interface PublicIndexProps {
  allPlants: Plant[],
}

export function PublicIndexPage({
  allPlants,
}: PublicIndexProps) {
  const plantsByLocation = allPlants
    .reduce((map, plant) => {
      const location = plant.tags.location;
      return map.set(location!, [...(map.get(location!) ?? []), plant])
    }, new Map<string, Plant[]>());

  return (
    <ul className="locations">
      {Array.from(plantsByLocation.keys()).sort().map(location => (
        <li key={location}>
          <div className="location">{location}</div>
          <ul className="plants">
            {plantsByLocation.get(location)!.sort(comparing(p => p.name, localeCompare)).map(plant => {
              const latestPhotoId = plant.photos.sort(comparing(p => p.modifyDate, reversed(localeCompare)))?.[0]?.id;
              return (
                <li key={plant.id} className="plant">
                  <a href={`/${plant.id}`} id={plant.id}>
                    {latestPhotoId &&
                      <PhotoImg
                        loading="lazy" sizes="50vw"
                        photoId={`${plant.id}/${latestPhotoId}`} />}
                    <div className="name">{plant.name}</div>
                  </a>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}