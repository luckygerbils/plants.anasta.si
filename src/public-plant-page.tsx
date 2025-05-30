import { PhotoImg } from "./components/photo-img";
import { comparing, dateCompare, explicit, nullsFirst, reversed } from "./util/sorting";
import { Photo, Plant, TAG_KEYS } from "./model/plant";
import { HamburgerIcon, ImageIcon, PencilSquareIcon, QuestionIcon } from "./components/icons";
import { markdown } from "./util/markdown";

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
    description,
    links,
    photos,
    tags,
  } = plant;

  const sortedPhotos = [...(photos ?? [])]
    .sort(reversed(comparing(p => p.modifyDate, nullsFirst(dateCompare))));
  const sortedPhotosByTag = sortedPhotos
    .reduce((photosByTag, photo) => {
      for (const tag of (photo.tags ?? [])) {
        if (!photosByTag.has(tag)) {
          photosByTag.set(tag, []);
        }
        photosByTag.get(tag)?.push(photo);
      }
      return photosByTag;
    }, new Map<string, Photo[]>());
  sortedPhotosByTag.set("all", sortedPhotos);
  const photoTags = Array.from(sortedPhotosByTag.keys())
    .sort(explicit(["all", "timeline"]));

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
      {description && description.length > 0 && (
        <section className="description">
          {/* eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml */}
          <div dangerouslySetInnerHTML={{__html: markdown(description)}}></div>
        </section>
      )}
      <section className="links">
        {(links ?? []).map(({site, url}) => 
          <a key={site} href={url}>{site}</a>)}
      </section>
      <section className="photos">
        <nav>
          {photoTags
            .map(tag => (
              <label key={tag}>
                <input type="radio" name="tags" defaultChecked={photoTags.includes("timeline") ? tag === "timeline" : tag === "all"} /> {tag}
              </label>
            ))}
        </nav>
        {sortedPhotos.length > 0 && (
          photoTags.map(tag => (
            <ul key={tag}>
              {sortedPhotosByTag.get(tag)!.map(({ id, modifyDate }, i) => (
                <li key={id}>
                  <div className="counter">
                    <span>{i+1}/{sortedPhotosByTag.get(tag)!.length}</span>
                  </div>
                  <div className="date">{modifyDate?.substring(0, 10)}</div>
                  
                  <PhotoImg loading="lazy" sizes="100vw" photoId={`${plantId}/${id}`} />
                </li>
              ))}
            </ul>
          ))
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