import { Fragment } from "react";
import { PhotoImg } from "./photo-img";
import { comparing, dateCompare, explicit, nullsFirst, reversed } from "./sorting";
import { Plant, TAG_KEYS } from "./plant";
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
        <div>
          <h1>{name}</h1>
          {scientificName && 
            <h2 className="scientific-name">
              {scientificName}
            </h2>}
        </div>
        <a href={`/#${plantId}`}>
          <HamburgerIcon />
        </a>
      </header>
      <section className="tags">
        <ul>
          {TAG_KEYS.filter(key => key in tags && key != "public")
            .map(key => {
              const value = tags[key]!;
              const El = key === "confidence" ? "button" : "span";
              return <El key={key} className="tag">{
                ({
                  location: <strong>{value}</strong>,
                  planted: <><strong>Planted:</strong>{value}</>,
                  confidence: <><strong>Confidence:</strong><span>{value}</span><QuestionIcon size="sm" /></>,
                  bonsai: <strong>Bonsai</strong>,
                  needsIdentification: <strong>Needs Identification</strong>,
                  likelyDead: <strong>Likely Dead</strong>,
                  public: null,
                }[key] ?? value?.toString() ?? key)
              }</El>;
            })}
        </ul>
        {tags.confidence && (
          <div id="confidence-tooltip" className="tag-tooltip">
            <QuestionIcon size="sm" />
            {{
              "high": "This came with a plant label I trust",
              "medium": "I've personally ID'd this, but I'm not a biologist",
              "low": "I've personally ID'd this, but there are similar-looking plants",
            }[tags.confidence]}
          </div>
        )}
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