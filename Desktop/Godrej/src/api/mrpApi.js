import client from "./client";

export const fetchLockerMaster = async () => {
  const { data } = await client.get("/lockers");
  return data;
};

export const addLocker = async (payload) => {
  const { data } = await client.post("/lockers", payload);
  return data;
};

export const uploadLockerRows = async ({ fileName, rows }) => {
  const { data } = await client.post("/lockers/upload", { fileName, rows });
  return data;
};

export const fetchBom = async () => {
  const { data } = await client.get("/bom");
  return data;
};

export const addCustomBom = async ({ locker_model, rows }) => {
  const { data } = await client.post("/bom/custom", { locker_model, rows });
  return data;
};

export const uploadBomRows = async ({ locker_model, fileName, rows }) => {
  const { data } = await client.post("/bom/upload", { locker_model, fileName, rows });
  return data;
};

export const fetchUploads = async () => {
  const { data } = await client.get("/uploads");
  return data;
};

export const uploadStockRows = async ({ date, fileName, stockRows }) => {
  const { data } = await client.post("/uploads", { date, fileName, stockRows });
  return data;
};

export const savePlanEntries = async ({ date, rows }) => {
  const { data } = await client.post("/plan", { date, rows });
  return data;
};

export const fetchMrpResults = async (planDate) => {
  const { data } = await client.get("/mrp/results", {
    params: planDate ? { planDate } : {},
  });
  return data;
};
