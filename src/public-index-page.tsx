import { Plant } from "./plant";
import { comparing, localeCompare } from "./sorting";

interface PublicIndexProps {
  allPlants: Plant[],
}

export function PublicIndexPage({
  allPlants,
}: PublicIndexProps) {
  const plantsByLocation = allPlants
    .reduce((map, plant) => {
      const location = plant.tags.find(({key}) => key === "location")?.value;
      return map.set(location!, [...(map.get(location!) ?? []), plant])
    }, new Map<string, Plant[]>());

  return (
    <ul className="index">
      {Array.from(plantsByLocation.keys()).sort().map(location => (
        <li key={location}>
          <div className="location">{location}</div>
          <ul>
            {plantsByLocation.get(location)!.sort(comparing(p => p.name, localeCompare)).map(plant => (
              <li key={plant.id} className="plant"><a href={`/${plant.id}`}>{plant.name}</a></li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}