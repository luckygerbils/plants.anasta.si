import { Fragment } from "react";
import { PhotoImg } from "./photo-img";
import { comparing, dateCompare, explicit, nullsFirst, reversed } from "./sorting";
import { Plant } from "./plant";
import { HamburgerIcon, QuestionIcon } from "./icons";

interface PublicPageProps {
  plant: Plant,
  allPlants: Plant[],
  prev?: string,
  next?: string,
}

export function PublicPlantPage({
  plant,
}: PublicPageProps) {
  const {
    id: plantId,
    name, 
    scientificName, 
    links,
    photos,
    tags,
  } = plant;

  const sortedPhotos = [...(photos ?? [])].sort(reversed(comparing(p => p.modifyDate, nullsFirst(dateCompare))));

  return (
    <>
      <header>
        <h1><a href="/"><HamburgerIcon /></a> {name}</h1>
        {scientificName && 
          <h2 className="scientific-name">
            {scientificName}
          </h2>}
      </header>
      <section className="tags">
        <ul>
          {tags.filter(t => t.key !== "public")
            .sort(comparing(t => t.key, explicit(["location", "planted", "needsIdentification", "confidence", "bonsai", "likelyDead",])))
            .map(tag => {
              const El = tag.key === "confidence" ? "button" : "span";
              return <El key={tag.key} className="tag">{
                ({
                  location: <strong>{tag.value}</strong>,
                  planted: <><strong>Planted:</strong>{tag.value}</>,
                  confidence: <><strong>Confidence:</strong><span>{tag.value}</span><QuestionIcon size="sm" /></>,
                  bonsai: <strong>Bonsai</strong>,
                  needsIdentification: <strong>Needs Identification</strong>,
                  likelyDead: <strong>Likely Dead</strong>,
                  public: null,
                }[tag.key] ?? tag.value?.toString() ?? tag.key)
              }</El>;
            })}
        </ul>
        <div id="confidence-tooltip" className="tag-tooltip">
          <QuestionIcon size="sm" />
          {{
            "high": "This came with a plant label I trust",
            "medium": "I've personally ID'd this, but I'm not a biologist",
            "low": "I've personally ID'd this, but there are similar-looking plants",
          }[tags.find(({key}) => key === "confidence")?.value ?? ""]}
        </div>
      </section>
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
              </div>
              <div className="date">{modifyDate?.substring(0, 10)}</div>
              
              <PhotoImg loading="lazy" sizes="100vw" photoId={`${plantId}/${id}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}