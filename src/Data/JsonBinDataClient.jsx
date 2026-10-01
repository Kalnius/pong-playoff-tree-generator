const BIN_URL = "https://api.jsonbin.io/v3/b/6ab4f22dac6210605af0436f";

// In-memory working copy shared across routes for the whole page session.
let currentData;
let loadPromise = null;

export function getData() {
  if (!loadPromise) {
    loadPromise = fetch(`${BIN_URL}`, {
      method: "GET",
      headers: {
        "X-Master-Key": import.meta.env.VITE_JSONBIN_MASTER_KEY,
        "X-Bin-Meta": "false"
      }
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (currentData === undefined) currentData = data;
      })
      .catch((error) => {
        console.error("Failed to get data:", error);
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise.then(() => currentData ?? null);
}

export function updateData(data) {
  currentData = data;
}

export async function saveData(data = currentData) {
  currentData = data;
  try {
    const response = await fetch(BIN_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": import.meta.env.VITE_JSONBIN_MASTER_KEY,
        "X-Bin-Versioning": false
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.error("Failed to save data:", error);
    return false;
  }
}
