import { LambdaFunctionURLEvent, LambdaFunctionURLHandler, LambdaFunctionURLResult } from 'aws-lambda';

import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DATA_BUCKET: string = process.env.DATA_BUCKET ?? 
  (() => { throw new Error("Environment variable DATA_BUCKET not set"); })();

const s3 = new S3Client();

export const handler: LambdaFunctionURLHandler = async (event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  const operation = event.rawPath.replace(/^\/api\//, "");
  const input = event.body;

  console.log(input);

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
  const plants = await getPlants();
  switch (operation) {
    case "getPlant": {
      const { plantId } = JSON.parse(input as string);
      const plantIndex = plants.findIndex(({id}) => plantId === id);
      const plant = plants[plantIndex];
      return { 
        plantId,
        plant, 
        prev: plants[plantIndex-1]?.id, 
        next: plants[plantIndex+1]?.id
      };
    }
    default: 
      throw new Error("Unknown operation " + operation);
  }
  
}

async function getPlants(): Promise<{id: string}[]> {
  try {
    return JSON.parse(await s3.send(new GetObjectCommand({
      Key: "plants.json",
      Bucket: DATA_BUCKET,
    })));
  } catch (e) {
    console.log(`caught ${e}`);
    if (e instanceof NoSuchKey) {
      throw new Error("plants.json doesn't exist")
    }
    throw e;
  }
}