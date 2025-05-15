import { LambdaFunctionURLEvent, LambdaFunctionURLHandler, LambdaFunctionURLResult } from 'aws-lambda';

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Plant } from '../plant';

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
  await s3.send(new PutObjectCommand({ Key: "plants.json", Bucket: DATA_BUCKET, Body: JSON.stringify(plants, null, " ") }));
}

async function s3Get<T>(key: string): Promise<T> {
  const response = await s3.send(new GetObjectCommand({ Key: key, Bucket: DATA_BUCKET, }));
  if (response.Body == null) {
    throw new Error("Body is missing in response " + response);
  }
  return JSON.parse(Buffer.from(await response.Body.transformToByteArray()).toString())
}