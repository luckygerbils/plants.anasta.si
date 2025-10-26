import { useEffect, useState } from "react";
import { Plant, TAG_KEYS, TagKey } from "./model/plant";
import { loggedIn } from "./util/auth";
import { PlusIcon, Spinner } from "./components/icons";
import { getAllPlants, putPlant } from "./util/api";
import { PhotoImg } from "./components/photo-img";
import { comparing, localeCompare, reversed } from "./util/sorting";

interface AdminIndexPageProps {
  defaultFilterKey?: string,
  defaultFilterValue?: string,
}

export function AdminIndexPage(props: AdminIndexPageProps) {
  const [ { result, loading, error }, setState ] = useState<{ 
    result?: Awaited<ReturnType<typeof getAllPlants>>, 
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
      
      try {
        setState({ result: await getAllPlants() });
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
    return <AdminIndexPageInternal {...props} plants={result!.plants} />
  }
}

interface AdminIndexPageInternalProps {
  plants: Plant[],
  defaultFilterKey?: string,
  defaultFilterValue?: string,
}

function AdminIndexPageInternal({
  plants,
  defaultFilterKey,
  defaultFilterValue,
}: AdminIndexPageInternalProps) {
  
  const [ filterKey, setFilterKey ] = useState<TagKey | "name">(defaultFilterKey as TagKey ?? "name");
  const [ filterValue, setFilterValue ] = useState(defaultFilterValue ?? "");
  const [ creating, setCreating ] = useState(false);
  const [ error, setError ] = useState<Error|null>(null);

  async function createPlant() {
    setCreating(true);
    try {
      const id = crypto.randomUUID().substring(0, 8);
      await putPlant({
        id,
        name: "",
        scientificName: "",
        description: "",
        tags: {},
        photos: [],
        links: [],
      });
      location.assign(`/admin/plant?plantId=${id}&edit=true`);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }

  const plantsByTag = plants
    .reduce((map, plant) => {
      for (const [ tagKey, tagValue ] of Object.entries(plant.tags) as [TagKey, string][]) {
        if (!map.has(tagKey)) {
          map.set(tagKey, new Map());
        }
        if (!map.get(tagKey)!.has(tagValue)) {
          map.get(tagKey)!.set(tagValue, []);
        }
        map.get(tagKey)!.get(tagValue)!.push(plant);
      }
      return map;
    }, new Map<TagKey, Map<string, Plant[]>>)

  const matchingPlants = plants
    .filter(plant => {
      if (filterKey === "name") {
        return plant.name.toLocaleLowerCase().includes(filterValue.toLocaleLowerCase());
      }
      return (plant.tags as Record<string, string>)[filterKey]?.toLocaleLowerCase()?.includes(filterValue.toLocaleLowerCase());
    });
  const plantsByLocation = matchingPlants
    .reduce((map, plant) => {
      const location = plant.tags.location;
      return map.set(location!, [...(map.get(location!) ?? []), plant])
    }, new Map<string, Plant[]>());

  return (
    <>
      <nav>
        <div>
          <select value={filterKey} onChange={e => { setFilterKey(e.target.value as typeof filterKey); setFilterValue(""); }}>
            <option value="name">Name</option>
            {TAG_KEYS.map(key => <option key={key} value={key}>{key}</option>)}
          </select>
          {filterKey === "name" && 
            <input autoFocus value={filterValue} onChange={e => setFilterValue(e.target.value)} />}
          {["location", "confidence", "planted"].includes(filterKey) && 
            <>
              <select className="filter-value-select" 
                value={filterValue} 
                data-value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
              >
                {Array.from(plantsByTag.get(filterKey as TagKey)!.keys()).sort().map(tagValue => 
                  <option key={tagValue}>{tagValue}</option>
                )}
              </select>
            </>}
          {["public", "bonsai", "needsIdentification", "needsLabel", "likelyDead"].includes(filterKey) && 
            <input type="checkbox" checked={filterValue !== "false"} onChange={e => setFilterValue(String(e.target.checked))} />}
        </div>
      </nav>
      {error && (
        <div>{error.message}</div>
      )}
      {filterValue != "" && matchingPlants.length === 0 && (
        <div className="not-found-page">
          No matching plants found
        </div>
      )}
      {matchingPlants.length > 0 && (
        <ul className="locations">
          {Array.from(plantsByLocation.keys()).sort().map(location => (
            <li key={location}>
              <div className="location">{location}</div>
              <ul className="plants">
                {plantsByLocation.get(location)!.sort(comparing(p => p.name, localeCompare)).map(plant => {
                  const latestPhotoId = (plant.photos ?? []).sort(comparing(p => p.modifyDate, reversed(localeCompare)))?.[0]?.id;
                  return (
                    <li key={plant.id} className="plant">
                      <a href={`/admin/plant?plantId=${plant.id}`} id={plant.id}>
                        {latestPhotoId &&
                          <PhotoImg
                            loading="lazy" sizes="
                              (width <= 200px) 100vw,
                              (200px < width <= 400px) 50vw,
                              (400px < width <= 600px) 33vw,
                              (600px < width <= 800px) 25vw,
                              (800px < width) 20vw"
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
      )}
      <button type="button" className="add-button" onClick={createPlant} disabled={creating}>
        <PlusIcon />
      </button>
    </>
  )
}