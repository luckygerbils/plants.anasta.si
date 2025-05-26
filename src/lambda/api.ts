import { LambdaFunctionURLEvent, LambdaFunctionURLHandler, LambdaFunctionURLResult } from 'aws-lambda';

import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Plant } from '../model/plant';
import sharp from 'sharp';
import { getExifModifyDate } from './exif';

const DATA_BUCKET: string = process.env.DATA_BUCKET ?? 
  (() => { throw new Error("Environment variable DATA_BUCKET not set"); })();

const s3 = new S3Client();

export const handler: LambdaFunctionURLHandler = async (event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  const operation = event.rawPath.replace(/^\/api\//, "");
  const input = event.body;

  let output;
  try {
    output = await invoke(operation, input);
  } catch (e) {
    console.warn("FAILURE", e);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: (e instanceof Error) ? e.message : String(e),
      }),
    }
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(output ?? {}),
  };
}

async function invoke(operation: string, input: unknown) {
  switch (operation) {
    case "getAllPlants": {
      return {
        plants: await getPlants(),
      };
    }
    case "getPlant": {
      const { plantId } = JSON.parse(input as string);
      const plants = await getPlants();
      const plantIndex = plants.findIndex(({id}) => plantId === id);
      return { 
        plantId,
        plant: plants[plantIndex], 
        prev: plants[plantIndex-1]?.id, 
        next: plants[plantIndex+1]?.id
      };
    }
    case "putPlant": {
      const { plant }: { plant: Plant } = JSON.parse(input as string);
      const plants = await getPlants();
      const existingPlant = plants.find(({id}) => id === plant.id);
      if (existingPlant != null) {
        Object.assign(existingPlant, plant);
      } else {
        plants.push(plant);
      }
      await persistPlants();
      console.log(`Saved ${JSON.stringify(plant)}`);
      return {};
    }
    case "deletePlant": {
      const { plantId }: { plantId: string } = JSON.parse(input as string);
      const plants = await getPlants();
      const plantIndex = plants.findIndex(({id}) => id === plantId);
      const deletedPlant = plants.splice(plantIndex, 1);
      await persistPlants();
      console.log(`Deleted ${JSON.stringify(deletedPlant)}`);
      return {}
    }
    case "uploadPhoto": {
      const { photo: { dataUrl, }, rotation, plantId, } = JSON.parse(input as string);

      const plants = await getPlants();

      const dataUrlWithoutPrefix =
      dataUrl.substring(dataUrl.indexOf(";base64,") + ";base64,".length);
      const original = sharp(Buffer.from(dataUrlWithoutPrefix, "base64"));

      const metadata = await original.metadata();
      if (!(metadata.format === "jpeg" || metadata.format === "jpg")) {
        throw new Error(`Format ${metadata.format} unsupported. JPEG only for now`);
      }

      // Initial rotate to match Exif orientation data
      const exifRotated = sharp(await original.rotate().toBuffer());

      const rotated = rotation ? exifRotated.rotate(rotation) : exifRotated;

      const [
        rotatedOriginal,
        progressive,
        size100,
        size250,
        size500,
        size1000,
      ] = await Promise.all([
        rotated.toBuffer(),
        rotated.jpeg({ progressive: true, }).toBuffer(),
        rotated.resize(100).toBuffer(),
        rotated.resize(250).toBuffer(),
        rotated.resize(500).toBuffer(),
        rotated.resize(1000).toBuffer(),
      ]);

      const modifyDate = (metadata.exif ? await getExifModifyDate(metadata.exif) : null) ?? new Date();

      const photoId = Math.floor(Math.random() * 0xffffffff).toString(16);

      const plant = plants.find(({id}) => id === plantId)!;
      plant.photos ??= [];
      plant.photos.push({ id: photoId, modifyDate: modifyDate.toISOString() });

      const cacheControl = `public, max-age=${356*24*60*60}, immutable`

      await Promise.all([
        s3Put(`data/photos/${plantId}/${photoId}/original.jpg`, rotatedOriginal, { cacheControl }),
        s3Put(`data/photos/${plantId}/${photoId}/progressive.jpg`, progressive, { cacheControl }),
        s3Put(`data/photos/${plantId}/${photoId}/size-100.jpg`, size100, { cacheControl }),
        s3Put(`data/photos/${plantId}/${photoId}/size-250.jpg`, size250, { cacheControl }),
        s3Put(`data/photos/${plantId}/${photoId}/size-500.jpg`, size500, { cacheControl }),
        s3Put(`data/photos/${plantId}/${photoId}/size-1000.jpg`, size1000, { cacheControl }),
        persistPlants(),
      ]);

      console.log(`Added`, plantId, photoId);
      return {
        photoId,
        modifyDate: modifyDate?.toISOString(),
      };
    }
    case "deletePhoto": {
      const { photoId, plantId, } = JSON.parse(input as string);
      const plants = await getPlants();
      const plant = plants.find(({id}) => id === plantId)!;
      if (plant == null) {
        throw new Error(`No plant found with id ${plantId}`);
      }
      const photoIndex = plant.photos.findIndex(({id}) => id === photoId);
      if (photoIndex === -1) {
        throw new Error(`No photo found with id ${photoId}`);
      }
      const deletedPhoto = plant.photos.splice(photoIndex, 1);

      await Promise.all([
        s3List(`data/photos/${plantId}/${photoId}`).then(s3Delete),
        persistPlants(),
      ])
      console.log(`Deleted ${JSON.stringify(deletedPhoto)}`);
      return {};
    }
    default: 
      throw new Error("Unknown operation " + operation);
  }
  
}

let plants: Plant[]|null = null;
async function getPlants(): Promise<Plant[]> {
  if (plants == null) {
    plants = await s3Get("plants.json");
  }
  return plants!;
}

async function persistPlants(): Promise<void> {
  return s3Put("plants.json", JSON.stringify(plants, null, " "))
}

interface S3MetaData {
  cacheControl: string,
}

async function s3Put(key: string, value: string|Buffer, metadata?: S3MetaData): Promise<void> {
  await s3.send(new PutObjectCommand({ Key: key, Bucket: DATA_BUCKET, Body: value, CacheControl: metadata?.cacheControl }));
}

async function s3Delete(keys: string[]): Promise<void> {
  await s3.send(new DeleteObjectsCommand({ Bucket: DATA_BUCKET, Delete: { Objects: keys.map(key => ({ Key: key })) } }));
}


async function s3Get<T>(key: string): Promise<T> {
  const response = await s3.send(new GetObjectCommand({ Key: key, Bucket: DATA_BUCKET, }));
  if (response.Body == null) {
    throw new Error("Body is missing in response " + response);
  }
  return JSON.parse(Buffer.from(await response.Body.transformToByteArray()).toString())
}

async function s3List(prefix: string): Promise<string[]> {
  const response = await s3.send(new ListObjectsV2Command({ Prefix: prefix, Bucket: DATA_BUCKET }));
  return (response.Contents ?? []).map(o => o.Key!);
}