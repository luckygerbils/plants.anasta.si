import { PhotoImg } from "./components/photo-img";
import { comparing, dateCompare, nullsFirst, reversed } from "./util/sorting";
import { Plant, TAG_KEYS } from "./model/plant";
import { HamburgerIcon, ImageIcon, PencilSquareIcon, QuestionIcon } from "./components/icons";

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
        <h1>{name}</h1>
        {scientificName && 
          <h2 className="scientific-name">
            {scientificName}
          </h2>}
      </header>
      <section className="tags">
        <ul>
          {TAG_KEYS.filter(key => key in tags)
            .map(key => {
              const value = tags[key]!;
              const content = ({
                location: <strong><a href={`/#${plantId}`}>{value}</a></strong>,
                planted: <><strong>Planted:</strong>{value}</>,
                confidence: <><strong>Confidence:</strong><span>{value}</span><QuestionIcon size="sm" /></>,
                bonsai: <strong>Bonsai</strong>,
                needsIdentification: <strong>Needs Identification</strong>,
                likelyDead: <strong>Likely Dead</strong>,
              }[key as string]);

              if (content == null) {
                return null;
              }

              const El = key === "confidence" ? "button" : "span";
              return <El key={key} className="tag">{content}</El>;
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
        {(links ?? []).map(({site, url}) => 
          <a key={site} href={url}>{site}</a>)}
      </section>
      <section className="photos">
        {sortedPhotos.length > 0 && (
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
        )}
        {sortedPhotos.length === 0 && (
          <div className="no-photos-placeholder">
            <ImageIcon size="2xl" />
          </div>
        )}
      </section>
      <a className="edit-button" href={`/admin/plant?plantId=${plantId}`}><PencilSquareIcon /></a>
    </>
  )
}