import { createServer } from "node:http";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

const port = Number(process.env.PORT || 8080);
const publicDirectory = join(process.cwd(), "src");
const dataFile = process.env.DATA_FILE || join(process.cwd(), "data", "site.json");
const allowedTags = new Set(["h1", "h2", "h3", "p", "div", "span"]);

const defaults = {
  body: { tag: "body", text: "", className: "", id: "", ariaLabel: "" },
  h1: {
    tag: "h1",
    text: "Un titre simple",
    className: "",
    id: "",
    ariaLabel: "",
  },
  p: {
    tag: "p",
    text: "Ceci est un paragraphe. Sélectionnez un élément pour modifier ses attributs depuis la barre latérale.",
    className: "",
    id: "",
    ariaLabel: "",
  },
};

const staticFiles = {
  "/": "index.html",
  "/index.html": "index.html",
  "/styles.css": "styles.css",
  "/script.js": "script.js",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function normalizeText(value, maximumLength) {
  return typeof value === "string" ? value.slice(0, maximumLength) : "";
}

function validateState(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Contenu invalide");
  }

  const state = structuredClone(defaults);

  for (const name of ["body", "h1", "p"]) {
    const element = value[name];
    if (!element || typeof element !== "object") {
      throw new Error(`Élément ${name} manquant`);
    }

    const tag = name === "body" ? "body" : normalizeText(element.tag, 10);
    if (name !== "body" && !allowedTags.has(tag)) {
      throw new Error(`Balise ${tag} non autorisée`);
    }

    state[name] = {
      tag,
      text: name === "body" ? "" : normalizeText(element.text, 5000),
      className: normalizeText(element.className, 500),
      id: normalizeText(element.id, 200),
      ariaLabel: normalizeText(element.ariaLabel, 500),
    };
  }

  return state;
}

async function loadState() {
  try {
    return validateState(JSON.parse(await readFile(dataFile, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Impossible de charger les données:", error.message);
    }
    return structuredClone(defaults);
  }
}

let state = await loadState();
let writeQueue = Promise.resolve();

function persistState(nextState) {
  state = nextState;
  writeQueue = writeQueue.then(async () => {
    await mkdir(dirname(dataFile), { recursive: true });
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(state, null, 2));
    await rename(temporaryFile, dataFile);
  });
  return writeQueue;
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) {
      throw new Error("Requête trop volumineuse");
    }
  }

  return JSON.parse(body);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  try {
    if (url.pathname === "/api/content" && request.method === "GET") {
      return sendJson(response, 200, state);
    }

    if (url.pathname === "/api/content" && request.method === "PUT") {
      const nextState = validateState(await readJsonBody(request));
      await persistState(nextState);
      return sendJson(response, 200, state);
    }

    if (url.pathname === "/api/content" && request.method === "DELETE") {
      await persistState(structuredClone(defaults));
      return sendJson(response, 200, state);
    }

    const fileName = staticFiles[url.pathname];
    if (request.method === "GET" && fileName) {
      const file = await readFile(join(publicDirectory, fileName));
      response.writeHead(200, {
        "Content-Type": contentTypes[extname(fileName)] || "application/octet-stream",
      });
      return response.end(file);
    }

    sendJson(response, 404, { error: "Ressource introuvable" });
  } catch (error) {
    console.error(error);
    sendJson(response, 400, { error: error.message || "Erreur serveur" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serveur démarré sur http://0.0.0.0:${port}`);
});
