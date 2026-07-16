import { open, stat } from "node:fs/promises";
import path from "node:path";
import { SaxesParser } from "saxes";
import yauzl from "yauzl";

export const MAX_MODEL_FILE_SIZE = 50 * 1024 * 1024;
export const MODEL_FORMATS = new Set(["stl", "3mf"]);

const MAX_ARCHIVE_ENTRIES = 256;
const MAX_ARCHIVE_ENTRY_SIZE = 25 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_SIZE = 30 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 250;
const MAX_XML_SIZE = 20 * 1024 * 1024;
const MAX_VERTICES = 200_000;
const MAX_TRIANGLES = 400_000;
const MAX_OBJECTS = 10_000;
const MAX_COMPONENTS = 100_000;
const MAX_BUILD_ITEMS = 10_000;
const MAX_COMPONENT_DEPTH = 32;
const MAX_TRAVERSAL_VERTICES = 1_000_000;
const MAX_TRAVERSAL_STEPS = 200_000;
const MAX_PLATES = 100;
const MAX_PLATE_INSTANCES = 10_000;
const MAX_PLATE_METADATA = 100;
const STANDARD_BUILD_VOLUME_MM = [256, 256, 256];
const MODEL_RELATIONSHIP = "http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel";
const UNIT_FACTORS = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

export class ModelFileError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function modelExtension(format) {
  if (!MODEL_FORMATS.has(format)) throw new ModelFileError("UNSUPPORTED_MODEL_FORMAT", "Formato modello non supportato.");
  return `.${format}`;
}

export function modelContentType(format) {
  return format === "3mf" ? "model/3mf" : "model/stl";
}

export function detectModelFormat(filename) {
  if (typeof filename !== "string") throw new ModelFileError("INVALID_MODEL_EXTENSION", "Il file deve essere STL o 3MF.");
  const lowerName = path.basename(filename.replaceAll("\\", "/")).toLowerCase();
  if (lowerName.endsWith(".gcode.3mf")) {
    throw new ModelFileError("GCODE_3MF_NOT_SUPPORTED", "I file .gcode.3mf non sono supportati.");
  }
  if (lowerName.endsWith(".3mf")) return "3mf";
  if (lowerName.endsWith(".stl")) return "stl";
  throw new ModelFileError("INVALID_MODEL_EXTENSION", "Il file deve avere estensione .stl o .3mf.");
}

export function sanitizeOriginalModelName(value, expectedFormat) {
  const format = detectModelFormat(value);
  if (format !== expectedFormat) throw new ModelFileError("INVALID_FILE_NAME", "Il formato del nome file non corrisponde al modello.");
  const normalized = path.basename(value.replaceAll("\\", "/")).replace(/[\u0000-\u001f\u007f]/g, "_").trim().slice(0, 120);
  if (!normalized) throw new ModelFileError("INVALID_FILE_NAME", "Il nome del file modello non e valido.");
  return normalized;
}

export async function isValidStlFile(filename) {
  const fileStats = await stat(filename);
  if (fileStats.size < 15 || fileStats.size > MAX_MODEL_FILE_SIZE) return false;
  const file = await open(filename, "r");
  try {
    const sampleSize = Math.min(fileStats.size, 4096);
    const sample = Buffer.alloc(sampleSize);
    await file.read(sample, 0, sampleSize, 0);
    if (fileStats.size >= 84) {
      const triangleCount = sample.readUInt32LE(80);
      if (triangleCount > 0 && 84 + triangleCount * 50 === fileStats.size) return true;
    }
    const asciiSample = sample.toString("utf8").trimStart().toLowerCase();
    return asciiSample.startsWith("solid") && asciiSample.includes("facet") && asciiSample.includes("vertex");
  } finally {
    await file.close();
  }
}

function attribute(node, name) {
  const match = Object.values(node.attributes).find((item) => item.local === name || item.name === name);
  return match?.value;
}

function parseXml(buffer, handlers) {
  if (buffer.length > MAX_XML_SIZE) throw new ModelFileError("3MF_XML_TOO_LARGE", "Un documento XML del 3MF e troppo grande.");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new ModelFileError("INVALID_3MF_XML", "Il 3MF contiene dichiarazioni XML non consentite.");
  const parser = new SaxesParser({ xmlns: true, fragment: false });
  parser.on("opentag", handlers.open ?? (() => {}));
  parser.on("text", handlers.text ?? (() => {}));
  parser.on("closetag", handlers.close ?? (() => {}));
  parser.on("error", (error) => { throw error; });
  try {
    parser.write(xml).close();
  } catch (error) {
    if (error instanceof ModelFileError) throw error;
    throw new ModelFileError("INVALID_3MF_XML", "Un documento XML del 3MF non e valido.");
  }
}

function normalizeEntryName(name) {
  if (typeof name !== "string" || name.includes("\\") || name.includes("\0") || /^[A-Za-z]:/.test(name) || name.startsWith("/")) {
    throw new ModelFileError("UNSAFE_3MF_PATH", "Il 3MF contiene un percorso interno non sicuro.");
  }
  const segments = name.split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    throw new ModelFileError("UNSAFE_3MF_PATH", "Il 3MF contiene un percorso interno non sicuro.");
  }
  return segments.filter(Boolean).join("/");
}

function readZipEntry(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const chunks = [];
      let size = 0;
      stream.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_ARCHIVE_ENTRY_SIZE) stream.destroy(new ModelFileError("3MF_ENTRY_TOO_LARGE", "Un file interno del 3MF e troppo grande."));
        else chunks.push(chunk);
      });
      stream.once("error", reject);
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

async function read3mfArchive(filename) {
  const zip = await new Promise((resolve, reject) => {
    yauzl.open(filename, { lazyEntries: true, decodeStrings: true, strictFileNames: true, validateEntrySizes: true, autoClose: false }, (error, archive) => {
      if (error) reject(error);
      else resolve(archive);
    });
  }).catch(() => { throw new ModelFileError("INVALID_3MF_ARCHIVE", "Il file non e un archivio 3MF valido."); });

  const entries = new Map();
  const names = new Set();
  let count = 0;
  let totalSize = 0;
  try {
    await new Promise((resolve, reject) => {
      zip.once("error", reject);
      zip.once("end", resolve);
      zip.on("entry", async (entry) => {
        try {
          count += 1;
          if (count > MAX_ARCHIVE_ENTRIES) throw new ModelFileError("3MF_TOO_MANY_ENTRIES", "Il 3MF contiene troppi file interni.");
          const name = normalizeEntryName(entry.fileName);
          const lookupName = name.toLowerCase();
          if (names.has(lookupName)) throw new ModelFileError("DUPLICATE_3MF_ENTRY", "Il 3MF contiene percorsi interni duplicati.");
          names.add(lookupName);
          if ((entry.generalPurposeBitFlag & 1) !== 0 || ![0, 8].includes(entry.compressionMethod)) {
            throw new ModelFileError("UNSUPPORTED_3MF_ENTRY", "Il 3MF contiene file cifrati o compressioni non supportate.");
          }
          totalSize += entry.uncompressedSize;
          if (entry.uncompressedSize > MAX_ARCHIVE_ENTRY_SIZE || totalSize > MAX_ARCHIVE_TOTAL_SIZE) {
            throw new ModelFileError("3MF_EXPANDED_TOO_LARGE", "Il contenuto espanso del 3MF supera il limite consentito.");
          }
          if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO) {
            throw new ModelFileError("3MF_COMPRESSION_RATIO", "Il rapporto di compressione del 3MF non e sicuro.");
          }
          if (!name.endsWith("/")) entries.set(lookupName, { entry, name, content: null });
          zip.readEntry();
        } catch (error) {
          reject(error);
        }
      });
      zip.readEntry();
    });

    for (const item of entries.values()) {
      const lower = item.name.toLowerCase();
      const needed = lower === "_rels/.rels" || lower.endsWith(".model") || lower === "metadata/model_settings.config";
      if (needed) item.content = await readZipEntry(zip, item.entry);
    }
  } finally {
    zip.close();
  }
  return entries;
}

function parseRelationships(buffer) {
  const relationships = [];
  parseXml(buffer, {
    open(node) {
      if (node.local !== "Relationship") return;
      relationships.push({
        type: attribute(node, "Type"),
        target: attribute(node, "Target"),
        targetMode: attribute(node, "TargetMode"),
      });
    },
  });
  return relationships;
}

function resolvePartName(target) {
  if (typeof target !== "string" || target.includes("\\") || target.includes("\0")) {
    throw new ModelFileError("INVALID_3MF_RELATIONSHIP", "Il 3MF contiene una relazione non valida.");
  }
  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    throw new ModelFileError("INVALID_3MF_RELATIONSHIP", "Il 3MF contiene una relazione non valida.");
  }
  return normalizeEntryName(decoded.replace(/^\//, "")).toLowerCase();
}

function parseTransform(value) {
  if (value === undefined) return null;
  const values = value.trim().split(/\s+/).map(Number);
  if (values.length !== 12 || values.some((number) => !Number.isFinite(number) || Math.abs(number) > 1e9)) {
    throw new ModelFileError("INVALID_3MF_TRANSFORM", "Il 3MF contiene una trasformazione non valida.");
  }
  return values;
}

function parsePositiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ModelFileError("INVALID_3MF_GEOMETRY", `${label} non e valido.`);
  return id;
}

function parseModel(buffer) {
  const objects = new Map();
  const buildItems = [];
  const metadata = {};
  let unit = "millimeter";
  let currentObject;
  let metadataName;
  let metadataText = "";
  let vertexCount = 0;
  let triangleCount = 0;
  let componentCount = 0;
  let inBuild = false;
  parseXml(buffer, {
    open(node) {
      if (node.local === "model") {
        unit = attribute(node, "unit") ?? "millimeter";
        if (!UNIT_FACTORS[unit]) throw new ModelFileError("UNSUPPORTED_3MF_UNIT", "L'unita di misura del 3MF non e supportata.");
      } else if (node.local === "metadata" && !currentObject) {
        metadataName = attribute(node, "name");
        metadataText = "";
      } else if (node.local === "object") {
        if (objects.size >= MAX_OBJECTS) throw new ModelFileError("3MF_TOO_MANY_OBJECTS", "Il 3MF contiene troppi oggetti.");
        const id = parsePositiveId(attribute(node, "id"), "L'identificativo oggetto");
        if (objects.has(id)) throw new ModelFileError("INVALID_3MF_GEOMETRY", "Il 3MF contiene oggetti duplicati.");
        currentObject = { id, vertices: [], triangles: [], components: [], hasMesh: false };
        objects.set(id, currentObject);
      } else if (node.local === "mesh" && currentObject) {
        currentObject.hasMesh = true;
      } else if (node.local === "vertex" && currentObject) {
        vertexCount += 1;
        if (vertexCount > MAX_VERTICES) throw new ModelFileError("3MF_TOO_MANY_VERTICES", "Il 3MF contiene troppi vertici.");
        const vertex = ["x", "y", "z"].map((axis) => Number(attribute(node, axis)));
        if (vertex.some((number) => !Number.isFinite(number) || Math.abs(number) > 1e9)) throw new ModelFileError("INVALID_3MF_GEOMETRY", "Il 3MF contiene coordinate non valide.");
        currentObject.vertices.push(vertex);
      } else if (node.local === "triangle" && currentObject) {
        triangleCount += 1;
        if (triangleCount > MAX_TRIANGLES) throw new ModelFileError("3MF_TOO_MANY_TRIANGLES", "Il 3MF contiene troppi triangoli.");
        currentObject.triangles.push(["v1", "v2", "v3"].map((name) => Number(attribute(node, name))));
      } else if (node.local === "component" && currentObject) {
        componentCount += 1;
        if (componentCount > MAX_COMPONENTS) throw new ModelFileError("3MF_TOO_MANY_COMPONENTS", "Il 3MF contiene troppi componenti.");
        currentObject.components.push({
          objectId: parsePositiveId(attribute(node, "objectid"), "Il riferimento componente"),
          transform: parseTransform(attribute(node, "transform")),
        });
      } else if (node.local === "build") {
        inBuild = true;
      } else if (node.local === "item" && inBuild) {
        if (buildItems.length >= MAX_BUILD_ITEMS) throw new ModelFileError("3MF_TOO_MANY_BUILD_ITEMS", "Il 3MF contiene troppi elementi di build.");
        buildItems.push({
          objectId: parsePositiveId(attribute(node, "objectid"), "Il riferimento di build"),
          transform: parseTransform(attribute(node, "transform")),
        });
      }
    },
    text(value) {
      if (metadataName && metadataText.length < 1000) metadataText += value;
    },
    close(node) {
      if (node.local === "object") currentObject = undefined;
      if (node.local === "build") inBuild = false;
      if (node.local === "metadata" && metadataName) {
        if (Object.keys(metadata).length < 30) metadata[metadataName.slice(0, 120)] = metadataText.trim().slice(0, 500);
        metadataName = undefined;
      }
    },
  });
  if (!objects.size || !buildItems.length) throw new ModelFileError("INVALID_3MF_GEOMETRY", "Il 3MF non contiene oggetti da stampare.");
  for (const object of objects.values()) {
    for (const triangle of object.triangles) {
      if (triangle.some((index) => !Number.isInteger(index) || index < 0 || index >= object.vertices.length)) {
        throw new ModelFileError("INVALID_3MF_GEOMETRY", "Il 3MF contiene triangoli non validi.");
      }
    }
    if (!object.triangles.length && !object.components.length) throw new ModelFileError("INVALID_3MF_GEOMETRY", "Il 3MF contiene un oggetto senza geometria stampabile.");
    if (object.hasMesh && object.components.length) throw new ModelFileError("INVALID_3MF_GEOMETRY", "Un oggetto 3MF non puo contenere insieme mesh e componenti.");
  }
  return { unit, objects, buildItems, metadata };
}

function applyTransform(point, transform) {
  if (!transform) return point;
  const [x, y, z] = point;
  return [
    x * transform[0] + y * transform[3] + z * transform[6] + transform[9],
    x * transform[1] + y * transform[4] + z * transform[7] + transform[10],
    x * transform[2] + y * transform[5] + z * transform[8] + transform[11],
  ];
}

function calculateBounds(model, buildIndexes) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  const factor = UNIT_FACTORS[model.unit];
  let traversedVertices = 0;
  let traversalSteps = 0;
  function visit(objectId, transforms, stack) {
    traversalSteps += 1;
    if (traversalSteps > MAX_TRAVERSAL_STEPS) throw new ModelFileError("3MF_TRAVERSAL_TOO_COMPLEX", "La struttura del 3MF e troppo complessa per l'anteprima.");
    if (stack.length > MAX_COMPONENT_DEPTH || stack.includes(objectId)) throw new ModelFileError("INVALID_3MF_COMPONENTS", "Il 3MF contiene componenti ricorsivi o troppo profondi.");
    const object = model.objects.get(objectId);
    if (!object) throw new ModelFileError("INVALID_3MF_GEOMETRY", "Il 3MF riferisce un oggetto inesistente.");
    const referencedVertices = new Set(object.triangles.flat());
    traversedVertices += referencedVertices.size;
    if (traversedVertices > MAX_TRAVERSAL_VERTICES) throw new ModelFileError("3MF_TRAVERSAL_TOO_COMPLEX", "La struttura del 3MF e troppo complessa per l'anteprima.");
    for (const vertexIndex of referencedVertices) {
      const vertex = object.vertices[vertexIndex];
      const point = transforms.reduce((result, transform) => applyTransform(result, transform), vertex).map((value) => value * factor);
      for (let axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], point[axis]);
        maximum[axis] = Math.max(maximum[axis], point[axis]);
      }
    }
    for (const component of object.components) visit(component.objectId, [component.transform, ...transforms], [...stack, objectId]);
  }
  for (const index of buildIndexes) {
    const item = model.buildItems[index];
    visit(item.objectId, [item.transform], []);
  }
  if (!minimum.every(Number.isFinite) || !maximum.every(Number.isFinite)) throw new ModelFileError("INVALID_3MF_GEOMETRY", "Non e possibile calcolare le dimensioni del 3MF.");
  return { min: minimum, max: maximum, size: maximum.map((value, index) => value - minimum[index]) };
}

function roundedBounds(bounds) {
  const rounded = (values) => values.map((value) => Math.round(value * 1000) / 1000);
  return { min: rounded(bounds.min), max: rounded(bounds.max), size: rounded(bounds.size) };
}

function parseBambuPlates(buffer) {
  const plates = [];
  let plate;
  let instance;
  let instanceCount = 0;
  parseXml(buffer, {
    open(node) {
      if (node.local === "plate") {
        if (plates.length >= MAX_PLATES) throw new ModelFileError("3MF_TOO_MANY_PLATES", "Il progetto 3MF contiene troppi piatti.");
        plate = { metadata: {}, instances: [] };
      } else if (node.local === "model_instance" && plate) {
        instanceCount += 1;
        if (instanceCount > MAX_PLATE_INSTANCES) throw new ModelFileError("3MF_TOO_MANY_INSTANCES", "Il progetto 3MF contiene troppe istanze.");
        instance = {};
      }
      else if (node.local === "metadata") {
        const key = attribute(node, "key");
        const value = attribute(node, "value");
        if (key && key.length <= 100 && value !== undefined && value.length <= 500) {
          const target = instance ?? plate?.metadata;
          if (target && Object.keys(target).length < MAX_PLATE_METADATA) target[key] = value;
        }
      }
    },
    close(node) {
      if (node.local === "model_instance" && plate && instance) {
        plate.instances.push(instance);
        instance = undefined;
      } else if (node.local === "plate" && plate) {
        plates.push(plate);
        plate = undefined;
      }
    },
  });
  return plates;
}

function determineCompatibility(bounds) {
  const fits = bounds.min.every((value) => value >= 0) && bounds.max.every((value, index) => value <= STANDARD_BUILD_VOLUME_MM[index]);
  return {
    status: fits ? "compatible" : "incompatible",
    target: "Piatto standard",
    volumeMm: STANDARD_BUILD_VOLUME_MM,
    warnings: fits ? [] : [{ code: "OUTSIDE_STANDARD_VOLUME", message: `Il primo piatto supera il volume standard ${STANDARD_BUILD_VOLUME_MM.join("x")} mm.` }],
  };
}

export async function inspect3mfFile(filename) {
  const fileStats = await stat(filename);
  if (fileStats.size < 100 || fileStats.size > MAX_MODEL_FILE_SIZE) throw new ModelFileError("INVALID_3MF_ARCHIVE", "Il file 3MF e vuoto o supera 50 MB.");
  const entries = await read3mfArchive(filename);
  const rootRelationships = entries.get("_rels/.rels")?.content;
  if (!rootRelationships) throw new ModelFileError("INVALID_3MF_RELATIONSHIP", "Il 3MF non contiene le relazioni principali.");
  const modelRelationship = parseRelationships(rootRelationships).find((item) => item.type === MODEL_RELATIONSHIP && item.targetMode !== "External");
  if (!modelRelationship) throw new ModelFileError("INVALID_3MF_RELATIONSHIP", "Il 3MF non indica il modello principale.");
  const modelPartName = resolvePartName(modelRelationship.target);
  const modelPartNames = [...entries.keys()].filter((name) => name.endsWith(".model"));
  if (modelPartNames.length !== 1) throw new ModelFileError("3MF_MULTIPART_NOT_SUPPORTED", "I progetti 3MF con piu parti modello non sono ancora supportati.");
  const modelBuffer = entries.get(modelPartName)?.content;
  if (!modelBuffer) throw new ModelFileError("INVALID_3MF_RELATIONSHIP", "Il modello principale del 3MF non esiste.");
  const hasGcode = [...entries.keys()].some((name) => /^metadata\/plate_[1-9][0-9]*\.gcode$/i.test(name));
  if (hasGcode) throw new ModelFileError("GCODE_3MF_NOT_SUPPORTED", "I progetti 3MF contenenti G-code non sono supportati.");

  const model = parseModel(modelBuffer);
  const plateBuffer = entries.get("metadata/model_settings.config")?.content;
  const plates = plateBuffer ? parseBambuPlates(plateBuffer) : [];
  const validPlates = plates
    .map((plate) => ({ ...plate, id: Number(plate.metadata.plater_id) }))
    .filter((plate) => Number.isInteger(plate.id) && plate.id > 0)
    .sort((left, right) => left.id - right.id);
  if (plates.length && (validPlates.length !== plates.length || new Set(validPlates.map(({ id }) => id)).size !== validPlates.length)) {
    throw new ModelFileError("INVALID_BAMBU_PLATE", "Gli identificativi dei piatti Bambu non sono validi.");
  }
  const firstPlate = validPlates[0];
  let previewBuildItemIndexes = model.buildItems.map((_item, index) => index);
  if (plates.length) {
    if (!firstPlate || !firstPlate.instances.length) throw new ModelFileError("INVALID_BAMBU_PLATE", "Il primo piatto Bambu non contiene istanze valide.");
    const allInstancesByObject = new Map();
    for (const plate of validPlates) for (const item of plate.instances) {
      const objectId = Number(item.object_id);
      const instanceId = Number(item.instance_id);
      if (!Number.isInteger(objectId) || !Number.isInteger(instanceId) || objectId <= 0 || instanceId < 0) {
        throw new ModelFileError("INVALID_BAMBU_PLATE", "Un'istanza dei piatti Bambu non e valida.");
      }
      if (!allInstancesByObject.has(objectId)) allInstancesByObject.set(objectId, []);
      allInstancesByObject.get(objectId).push(instanceId);
    }
    for (const ids of allInstancesByObject.values()) {
      if (new Set(ids).size !== ids.length) throw new ModelFileError("INVALID_BAMBU_PLATE", "Le istanze dei piatti Bambu non sono univoche.");
    }
    const firstInstancesByObject = new Map();
    for (const item of firstPlate.instances) {
      const objectId = Number(item.object_id);
      const instanceId = Number(item.instance_id);
      if (!Number.isInteger(objectId) || !Number.isInteger(instanceId) || instanceId < 0) continue;
      if (!firstInstancesByObject.has(objectId)) firstInstancesByObject.set(objectId, []);
      firstInstancesByObject.get(objectId).push(instanceId);
    }
    const zeroBasedObjects = new Set([...allInstancesByObject].filter(([, ids]) => ids.includes(0)).map(([objectId]) => objectId));
    const occurrences = new Map();
    const matchedInstances = new Set();
    previewBuildItemIndexes = model.buildItems.flatMap((item, index) => {
      const occurrence = occurrences.get(item.objectId) ?? 0;
      occurrences.set(item.objectId, occurrence + 1);
      const expectedId = zeroBasedObjects.has(item.objectId) ? occurrence : occurrence + 1;
      if (!firstInstancesByObject.get(item.objectId)?.includes(expectedId)) return [];
      matchedInstances.add(`${item.objectId}:${expectedId}`);
      return [index];
    });
    if (!previewBuildItemIndexes.length || matchedInstances.size !== firstPlate.instances.length) {
      throw new ModelFileError("INVALID_BAMBU_PLATE", "Il primo piatto Bambu non riferisce tutte le istanze dichiarate.");
    }
  }
  const rawBounds = calculateBounds(model, previewBuildItemIndexes);
  const boundsMm = roundedBounds(rawBounds);
  return {
    projectType: plateBuffer ? "bambu" : "generic",
    unit: model.unit,
    plateCount: plates.length || 1,
    previewPlate: firstPlate?.id ?? 1,
    previewBuildItemIndexes,
    boundsMm,
    referencePlate: { name: "Piatto standard", volumeMm: STANDARD_BUILD_VOLUME_MM },
    compatibility: determineCompatibility(rawBounds),
    metadata: model.metadata,
  };
}

export async function inspectModelFile(filename, format) {
  if (format === "stl") {
    if (!(await isValidStlFile(filename))) throw new ModelFileError("INVALID_STL_CONTENT", "Il file non contiene una struttura STL valida.");
    return null;
  }
  if (format === "3mf") return inspect3mfFile(filename);
  throw new ModelFileError("UNSUPPORTED_MODEL_FORMAT", "Formato modello non supportato.");
}
