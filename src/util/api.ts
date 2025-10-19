import { Photo, Plant } from "../model/plant";
import { apiFetch } from "./auth";

interface GetAllPlantsResponse {
  plants: Plant[],
}

export async function getAllPlants(): Promise<GetAllPlantsResponse> {
  return rpc(`getAllPlants`);
}

interface GetPlantResponse { 
  plantId: string,
  plant?: Plant, 
  next?: string, 
  prev?: string,
  caller: string,
}

export async function getPlant(plantId: string): Promise<GetPlantResponse> {
  return rpc("getPlant", { plantId });
}

export async function putPlant(plant: Plant): Promise<void> {
  return rpc(`putPlant`, { plant });
}

export async function deletePlant(plantId: string): Promise<void> {
  return rpc(`deletePlant`, { plantId });
}

export async function uploadPhoto(plantId: string, photo: { dataUrl: string, }, rotation?: number): Promise<Photo> {
  const { key, presignedUrl } = await rpc(`requestPresignedUpload`);
  await fetch(presignedUrl, {
    method: "PUT",
    body: await (await fetch(photo.dataUrl)).blob()
  });
  const response = await rpc("uploadPhoto", { plantId, photo: { key }, rotation });
  return { id: response.photoId, modifyDate: response.modifyDate, };
}

export async function deletePhoto(plantId: string, photoId: string): Promise<void> {
  return await rpc(`deletePhoto`, { plantId, photoId });
}

async function rpc(operation: string, input?: object) {
  const response = await apiFetch(`/api/${operation}`, { 
    method: "POST", 
    headers: { "content-type": "application/json" }, 
    body: JSON.stringify(input ?? {}) 
  });

  const contentType = response.headers.get("content-type");
  if (response.ok) {
    if (contentType=== "application/json") {
      return response.json();
    } else {
      throw new Error(`Expected application/json but was ${contentType}: ${await response.text()}`)
    }
  } else {
    let message;
    if (contentType !== "application/json") {
      message = await response.text();
    } else {
      const json = await response.json();
      // Our RPC implementatio uses "error". Lambda-level errors use "Message"
      for (const field in ["error", "Message"]) {
        if (field in json && typeof json[field] === "string") {
          message = json[field];
          break;
        }
      }
      message = JSON.stringify(json);
    }
    throw new RpcError(response.status, message);
  }
}

class RpcError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}