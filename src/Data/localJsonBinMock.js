import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";

const binUrl = "https://api.jsonbin.io/v3/b/6ab4f22dac6210605af0436f";
const storageKey = "pong-playoff-tree-generator:jsonbin";

export const worker = setupWorker(
  http.get(binUrl, () => {
    const saved = localStorage.getItem(storageKey);
    return HttpResponse.json(saved === null ? null : JSON.parse(saved));
  }),
  http.put(binUrl, async ({ request }) => {
    const data = await request.json();
    localStorage.setItem(storageKey, JSON.stringify(data));
    return HttpResponse.json({ record: data });
  })
);
