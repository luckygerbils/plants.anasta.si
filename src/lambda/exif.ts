/*
 * Extremely basic Exif parsing based on this very helpful StackOverflow answer:
 * https://stackoverflow.com/a/14115795
 * 
 * I didn't want to add a huge dependency (that I'd have to be worried about the security of)
 * for such an unimportant feature as setting the date of timeline entries automatically based
 * on photo time.
 */

/**
 * @param file a user provided file
 * @returns the value of the Exif ModifyDate tag in the file, if present
 * @throws if the file is not a JPEG file or the file's Exif data is malformed
 */
export async function getExifModifyDate(buffer: Buffer) {
  const tags = getExifTags(buffer.buffer);

  const dateString = (tags?.find(({tagId}) => tagId === ExifTagId.ModifyDate) as ExifTagWithStringValue|undefined)?.tagValueString;
  if (dateString == null) {
    return null;
  }

  const match = dateString.match(/([0-9]*):([0-9]*):([0-9]*) ([0-9]*):([0-9]*):([0-9]*)/);
  if (!match) {
    throw new Error(`Unexpected Exif date format: ${dateString}`);
  }
  const [ , year, month, day, hour, minute, second ] = match;
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10));
}

export function getExifTags(buffer: ArrayBuffer) {
  const segmentBytes = new Uint8Array(buffer);
  if (String.fromCharCode(...segmentBytes.slice(0, 6)) !== "Exif\u0000\u0000") {
    // console.log(`APP1 segment isn't Exif, ignoring segment`);
    return [];
  }
  
  const tiffBuffer = buffer.slice(6);
  const littleEndian = String.fromCharCode(...new Uint8Array(tiffBuffer).slice(0, 2)) === "II";
  const tiffDataView = new DataView(tiffBuffer)
  const tiffMarker = tiffDataView.getUint16(2, littleEndian);
  if (tiffMarker !== 0x002a) {
    // console.log("Exif TIFF marker is wrong", tiffMarker.toString(16), "ignoring segment");
    return [];
  }

  const firstIfdPointer = tiffDataView.getUint32(4, littleEndian);
  return parseIfd(tiffBuffer, firstIfdPointer, littleEndian);
}

// Obviously there are more but this is all we care about
export enum ExifTagId {
  ModifyDate = 0x0132,
  Orientation = 0x0112,
}

// Obviously there are more but this is all we care about
enum ExifTagValueType {
  ASCII = 0x2
}

interface ExifTagWithStringValue {
  tagId: ExifTagId,
  tagValueType: ExifTagValueType.ASCII,
  tagValueString: string,
}

interface ExifTagWithByteValue {
  tagId: ExifTagId,
  tagValueType: number,
  tagValueBytes: Uint8Array,
}

type ExifTag = ExifTagWithByteValue | ExifTagWithStringValue;

function parseIfd(tiffBuffer: ArrayBuffer, ifdOffset: number, littleEndian: boolean): ExifTag[] {
  const tiffDataView = new DataView(tiffBuffer);
  const numTags = tiffDataView.getUint16(ifdOffset, littleEndian);
  // console.log(numTags, "tags in this IFD");

  let offset = ifdOffset + 2;
  function parseTag(): ExifTag {
    const tagId = tiffDataView.getUint16(offset, littleEndian);
    offset += 2;
    // console.log("first tag is", tagId.toString(16));
    const tagValueType: ExifTagValueType = tiffDataView.getUint16(offset, littleEndian);
    offset += 2;
    // console.log("tag type is", tagType.toString(16));
    const numComponents = tiffDataView.getUint32(offset, littleEndian);
    offset += 4;
    // console.log("num components is", numComponents)
    const tagValueOffset = tiffDataView.getUint32(offset, littleEndian);
    offset += 4;
    // console.log("tag value is at offset", tagValueOffset);
    const tagValueBytes = new Uint8Array(tiffBuffer.slice(tagValueOffset, tagValueOffset+numComponents));

    if (tagValueType == ExifTagValueType.ASCII) {
      let tagValueString = String.fromCharCode(...tagValueBytes);
      tagValueString = tagValueString.slice(0, tagValueString.length - 1); // nul terminated
      return {
        tagId,
        tagValueType,
        tagValueString,
      };
    } else {
      return {
        tagId,
        tagValueType,
        tagValueBytes,
      };
    }
  }

  const tags = [];
  for (let i = 0; i < numTags; i++) {
    tags.push(parseTag());
  }
  return tags;
}