import { Photo, Plant } from "../model/plant";
import { apiFetch } from "./auth";

interface GetPlantResponse { 
  plantId: string,
  plant?: Plant, 
  next?: string, 
  prev?: string,
  caller: string,
}

export async function getPlant(plantId: string): Promise<GetPlantResponse> {
  const response = await apiFetch(`/api/getPlant`, { 
    method: "POST", 
    headers: { "content-type": "application/json" }, 
    body: JSON.stringify({ plantId }) 
  });
  return response.json();
}

export async function putPlant(plant: Plant) {
  await apiFetch(`/api/putPlant`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      plant,
    })
  });
}

export async function deletePlant(plantId: string) {
  await apiFetch(`/api/deletePlant`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      plantId,
    })
  });
}

export async function uploadPhoto(plantId: string, photo: { dataUrl: string, }, rotation?: number): Promise<Photo> {
  const response = await apiFetch(`/api/uploadPhoto`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      plantId,
      photo,
      rotation,
    })
  });
  const {
    photoId: id,
    modifyDate,
  } = await response.json() as {
    photoId: string,
    modifyDate: string,
  };
  return { ...photo, id, modifyDate, };
}

export async function deletePhoto(plantId: string, photoId: string) {
  await apiFetch(`/api/deletePhoto`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      plantId,
      photoId,
    })
  });
}