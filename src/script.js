const fields = {
  tag: document.querySelector("#tag-name"),
  text: document.querySelector("#text-content"),
  className: document.querySelector("#class-name"),
  id: document.querySelector("#element-id"),
  ariaLabel: document.querySelector("#aria-label"),
};

const buttons = [...document.querySelectorAll("[data-target]")];
const selectionName = document.querySelector("#selection-name");
const saveStatus = document.querySelector("#save-status");
let state;
let selectedName = "h1";
let selectedElement = document.querySelector('[data-editor-name="h1"]');
let saveTimer;

function showStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("has-error", isError);
}

function replaceTag(element, tagName) {
  if (element.tagName.toLowerCase() === tagName) {
    return element;
  }

  const replacement = document.createElement(tagName);
  [...element.attributes].forEach(({ name, value }) => {
    replacement.setAttribute(name, value);
  });
  replacement.textContent = element.textContent;
  element.replaceWith(replacement);
  return replacement;
}

function applyElementState(name) {
  const values = state[name];
  let element = document.querySelector(`[data-editor-name="${name}"]`);

  if (name !== "body") {
    element = replaceTag(element, values.tag);
    element.textContent = values.text;
  }

  element.className = values.className;
  element.id = values.id;

  if (values.ariaLabel) {
    element.setAttribute("aria-label", values.ariaLabel);
  } else {
    element.removeAttribute("aria-label");
  }

  const button = buttons.find((item) => item.dataset.target === name);
  button.querySelector("code").textContent = `<${values.tag}>`;
}

function renderState() {
  Object.keys(state).forEach(applyElementState);
  selectElement(selectedName);
}

function selectElement(name) {
  selectedElement?.removeAttribute("data-selected");
  selectedName = name;
  selectedElement = document.querySelector(`[data-editor-name="${name}"]`);

  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.target === name);
  });

  const values = state[name];
  const isBody = name === "body";
  selectionName.textContent = `<${values.tag}>`;
  fields.tag.value = values.tag;
  fields.tag.disabled = isBody;
  fields.text.value = values.text;
  fields.text.disabled = isBody;
  fields.className.value = values.className;
  fields.id.value = values.id;
  fields.ariaLabel.value = values.ariaLabel;

  if (!isBody) {
    selectedElement.dataset.selected = "true";
  }
}

async function saveState() {
  showStatus("Enregistrement…");

  try {
    const response = await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      throw new Error("Échec de l’enregistrement");
    }

    state = await response.json();
    showStatus("Enregistré sur le serveur");
  } catch (error) {
    showStatus(error.message, true);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  showStatus("Modifications non enregistrées");
  saveTimer = setTimeout(saveState, 300);
}

function updateSelectedElement(property, value) {
  state[selectedName][property] = value;
  applyElementState(selectedName);
  selectedElement = document.querySelector(`[data-editor-name="${selectedName}"]`);

  if (selectedName !== "body") {
    selectedElement.dataset.selected = "true";
  }

  selectionName.textContent = `<${state[selectedName].tag}>`;
  scheduleSave();
}

buttons.forEach((button) => {
  button.addEventListener("click", () => selectElement(button.dataset.target));
});

document.querySelector("main").addEventListener("click", (event) => {
  const target = event.target.closest("[data-editor-name]");
  if (target) {
    selectElement(target.dataset.editorName);
  }
});

fields.tag.addEventListener("change", () => {
  updateSelectedElement("tag", fields.tag.value);
  buttons
    .find((button) => button.dataset.target === selectedName)
    .querySelector("code").textContent = `<${fields.tag.value}>`;
});

fields.text.addEventListener("input", () => {
  updateSelectedElement("text", fields.text.value);
});
fields.className.addEventListener("input", () => {
  updateSelectedElement("className", fields.className.value);
});
fields.id.addEventListener("input", () => {
  updateSelectedElement("id", fields.id.value);
});
fields.ariaLabel.addEventListener("input", () => {
  updateSelectedElement("ariaLabel", fields.ariaLabel.value);
});

document.querySelector("#reset").addEventListener("click", async () => {
  clearTimeout(saveTimer);
  showStatus("Réinitialisation…");

  try {
    const response = await fetch("/api/content", { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Échec de la réinitialisation");
    }

    state = await response.json();
    selectedName = "h1";
    renderState();
    showStatus("Réinitialisé sur le serveur");
  } catch (error) {
    showStatus(error.message, true);
  }
});

async function initialize() {
  try {
    const response = await fetch("/api/content");
    if (!response.ok) {
      throw new Error("Impossible de charger les données");
    }

    state = await response.json();
    renderState();
    showStatus("Synchronisé avec le serveur");
  } catch (error) {
    showStatus(error.message, true);
    document.querySelector("form").inert = true;
  }
}

initialize();
