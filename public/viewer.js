import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";

const dialog = document.querySelector("#viewer-dialog");
const title = document.querySelector("#viewer-title");
const viewport = document.querySelector("#viewer-viewport");
const status = document.querySelector("#viewer-status");
const resetButton = document.querySelector("#viewer-reset");
const stlLoader = new STLLoader();
const threeMfLoader = new ThreeMFLoader();
const unitFactors = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

let renderer;
let scene;
let camera;
let controls;
let model;
let grid;
let resizeObserver;
let loadVersion = 0;
let initialCameraPosition;
let initialTarget;

function resizeRenderer() {
  if (!renderer || viewport.clientWidth === 0 || viewport.clientHeight === 0) {
    return;
  }
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
  camera.aspect = viewport.clientWidth / viewport.clientHeight;
  camera.updateProjectionMatrix();
}

function initializeViewer() {
  if (renderer) {
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfffdf5);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10000);
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  viewport.prepend(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minDistance = 1;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x17201a, 2.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
  keyLight.position.set(4, 7, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x4277ff, 1.8);
  fillLight.position.set(-5, 3, -4);
  scene.add(fillLight);

  resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(viewport);
}

function clearModel() {
  if (model) {
    scene.remove(model);
    disposeObject(model);
    model = undefined;
  }
  if (grid) {
    scene.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
    grid = undefined;
  }
}

function collectResources(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
  });
  return { geometries, materials, textures };
}

function disposeObject(object, protectedResources = { geometries: new Set(), materials: new Set(), textures: new Set() }) {
  const resources = collectResources(object);
  resources.geometries.forEach((geometry) => { if (!protectedResources.geometries.has(geometry)) geometry.dispose(); });
  resources.materials.forEach((material) => { if (!protectedResources.materials.has(material)) material.dispose(); });
  resources.textures.forEach((texture) => { if (!protectedResources.textures.has(texture)) texture.dispose(); });
}

function placeModel(object) {
  object.rotation.x = -Math.PI / 2;
  object.updateMatrixWorld(true);
  const firstBox = new THREE.Box3().setFromObject(object);
  if (firstBox.isEmpty()) throw new Error("Il modello non contiene geometrie visualizzabili.");
  const center = firstBox.getCenter(new THREE.Vector3());
  object.position.add(new THREE.Vector3(-center.x, -firstBox.min.y, -center.z));
  object.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(object);
  const size = finalBox.getSize(new THREE.Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z, 1);
  model = object;
  scene.add(model);

  const gridSize = largestDimension * 3.5;
  grid = new THREE.GridHelper(gridSize, 20, 0x17201a, 0x8c938e);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  initialTarget = new THREE.Vector3(0, size.y * 0.35, 0);
  initialCameraPosition = new THREE.Vector3(
    largestDimension * 1.35,
    largestDimension * 1.05,
    largestDimension * 1.55,
  );
  camera.near = Math.max(largestDimension / 100, 0.01);
  camera.far = largestDimension * 100;
  controls.minDistance = largestDimension * 0.35;
  controls.maxDistance = largestDimension * 8;
  resetView();
}

function resetView() {
  if (!initialCameraPosition || !initialTarget) {
    return;
  }
  camera.position.copy(initialCameraPosition);
  controls.target.copy(initialTarget);
  camera.updateProjectionMatrix();
  controls.update();
}

function startRendering() {
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

export async function openModelViewer(product) {
  initializeViewer();
  const currentLoad = ++loadVersion;
  clearModel();
  title.textContent = product.name;
  viewport.setAttribute("aria-label", `Visualizzatore 3D di ${product.name}`);
  viewport.classList.add("viewer-viewport--loading");
  status.hidden = false;
  status.textContent = "Caricamento modello...";
  resetButton.disabled = true;

  if (!dialog.open) {
    dialog.showModal();
  }
  requestAnimationFrame(() => {
    resizeRenderer();
    startRendering();
  });

  let loadedObject;
  try {
    if (!product.modelUrl) {
      throw new Error("Il prodotto non ha un file modello associato.");
    }
    const modelFormat = product.modelFormat ?? (product.modelUrl.toLowerCase().endsWith(".3mf") ? "3mf" : "stl");
    if (modelFormat === "3mf") {
      loadedObject = await threeMfLoader.loadAsync(product.modelUrl);
      const previewIndexes = new Set(product.inspection?.previewBuildItemIndexes ?? loadedObject.children.map((_child, index) => index));
      const removedChildren = [];
      [...loadedObject.children].forEach((child, index) => {
        if (!previewIndexes.has(index)) {
          loadedObject.remove(child);
          removedChildren.push(child);
        }
      });
      const retainedResources = collectResources(loadedObject);
      removedChildren.forEach((child) => disposeObject(child, retainedResources));
      const unitFactor = unitFactors[product.inspection?.unit ?? "millimeter"];
      if (!unitFactor) throw new Error("Unita 3MF non supportata.");
      loadedObject.scale.setScalar(unitFactor);
    } else {
      const geometry = await stlLoader.loadAsync(product.modelUrl);
      geometry.computeVertexNormals();
      loadedObject = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: 0xff6534, roughness: 0.72, metalness: 0.02, flatShading: true }),
      );
    }
    if (currentLoad !== loadVersion) {
      disposeObject(loadedObject);
      return;
    }
    placeModel(loadedObject);
    viewport.classList.remove("viewer-viewport--loading");
    status.hidden = true;
    resetButton.disabled = false;
  } catch (error) {
    if (loadedObject && loadedObject !== model) disposeObject(loadedObject);
    console.error(error);
    viewport.classList.remove("viewer-viewport--loading");
    viewport.classList.add("viewer-viewport--error");
    status.textContent = "Impossibile caricare il modello 3D.";
  }
}

resetButton.addEventListener("click", resetView);
dialog.addEventListener("close", () => {
  loadVersion += 1;
  renderer?.setAnimationLoop(null);
  clearModel();
  viewport.classList.remove("viewer-viewport--error", "viewer-viewport--loading");
});
