/*
 * Demonstração vanilla JavaScript para rastreabilidade de transferências.
 * Não contém credenciais e não substitui o backend da aplicação principal.
 */

const storageKey = "castelares-fermentacao-html-js";

const initialState = {
  tanks: [
    { code: "CF1", litres: 0 },
    { code: "CF2", litres: 0 },
    { code: "CF6", litres: 0 },
    { code: "CF8", litres: 0 },
  ],
  movements: [],
  selectedTankCode: "CF1",
};

let state = loadState();

const elements = {
  tankList: document.querySelector("#tank-list"),
  tankCount: document.querySelector("#tank-count"),
  litreTotal: document.querySelector("#litre-total"),
  movementCount: document.querySelector("#movement-count"),
  history: document.querySelector("#movement-history"),
  selectedTankLabel: document.querySelector("#selected-tank-label"),
  historyDescription: document.querySelector("#history-description"),
  movementDialog: document.querySelector("#movement-dialog"),
  movementForm: document.querySelector("#movement-form"),
  sourceSelect: document.querySelector("#source-select"),
  sourceAvailability: document.querySelector("#source-availability"),
  destinationRows: document.querySelector("#destination-rows"),
  balance: document.querySelector("#movement-balance"),
  movementError: document.querySelector("#movement-error"),
  reasonInput: document.querySelector("#reason-input"),
  tankDialog: document.querySelector("#tank-dialog"),
  tankForm: document.querySelector("#tank-form"),
  tankCodeInput: document.querySelector("#tank-code-input"),
  tankVolumeInput: document.querySelector("#tank-volume-input"),
  tankError: document.querySelector("#tank-error"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.tanks && saved?.movements) return saved;
  } catch (_) {
    // Estado inicial quando o navegador não contém dados válidos.
  }
  return structuredClone(initialState);
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function formatLitres(value) {
  return `${Number(value || 0).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} L`;
}

function today() {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(new Date());
}

function getTank(code) {
  return state.tanks.find((tank) => tank.code === code);
}

function render() {
  renderMetrics();
  renderTankList();
  renderHistory();
}

function renderMetrics() {
  elements.tankCount.textContent = String(state.tanks.length);
  elements.litreTotal.textContent = formatLitres(state.tanks.reduce((total, tank) => total + tank.litres, 0));
  elements.movementCount.textContent = String(state.movements.length);
}

function renderTankList() {
  elements.tankList.replaceChildren();

  [...state.tanks]
    .sort((a, b) => a.code.localeCompare(b.code, "pt"))
    .forEach((tank) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tank-option ${tank.code === state.selectedTankCode ? "is-selected" : ""}`;
      button.innerHTML = `<span><strong>${escapeHtml(tank.code)}</strong><span>Ver rastreabilidade</span></span><strong class="tank-volume">${formatLitres(tank.litres)}</strong>`;
      button.addEventListener("click", () => {
        state.selectedTankCode = tank.code;
        persistState();
        render();
      });
      elements.tankList.append(button);
    });
}

function renderHistory() {
  const selectedTank = getTank(state.selectedTankCode);
  elements.history.replaceChildren();

  if (!selectedTank) {
    elements.selectedTankLabel.textContent = "Sem cuba seleccionada";
    elements.historyDescription.textContent = "Seleccione uma cuba para consultar os movimentos.";
    return;
  }

  elements.selectedTankLabel.textContent = selectedTank.code;
  elements.historyDescription.textContent = `Volume actual: ${formatLitres(selectedTank.litres)}. A apresentação varia de acordo com o sentido do movimento.`;

  const relatedMovements = state.movements.filter((movement) =>
    movement.sourceCode === selectedTank.code || movement.destinations.some((destination) => destination.code === selectedTank.code),
  );

  if (!relatedMovements.length) {
    elements.history.innerHTML = '<div class="empty-state">Ainda não existem movimentos registados para esta cuba.</div>';
    return;
  }

  relatedMovements.forEach((movement) => {
    const isSource = movement.sourceCode === selectedTank.code;
    const ownDestination = movement.destinations.find((destination) => destination.code === selectedTank.code);
    const card = document.createElement("article");
    card.className = "movement-card";

    // Regra central: origem mostra todos os destinos; destino mostra somente a sua parcela.
    const movementText = isSource
      ? `<span class="direction-out">↑ Saída</span><p>Transferido para: <strong>${movement.destinations.map((destination) => `${escapeHtml(destination.code)} (${formatLitres(destination.litres)})`).join(", ")}</strong></p>`
      : `<span class="direction-in">↓ Entrada</span><p>Recebido de: <strong>${escapeHtml(movement.sourceCode)}</strong> — ${formatLitres(ownDestination.litres)}</p>`;

    card.innerHTML = `
      <header><span class="badge">Transferência</span><span class="date">${escapeHtml(movement.date)}</span></header>
      ${movementText}
      ${movement.reason ? `<p class="note">Nota: ${escapeHtml(movement.reason)}</p>` : ""}
    `;
    elements.history.append(card);
  });
}

function openMovementDialog() {
  elements.movementForm.reset();
  elements.destinationRows.replaceChildren();
  elements.movementError.textContent = "";
  elements.sourceSelect.replaceChildren();

  state.tanks.forEach((tank) => {
    const option = document.createElement("option");
    option.value = tank.code;
    option.textContent = `${tank.code} — ${formatLitres(tank.litres)}`;
    elements.sourceSelect.append(option);
  });
  elements.sourceSelect.value = state.selectedTankCode || state.tanks[0]?.code || "";
  addDestinationRow();
  updateMovementBalance();
  elements.movementDialog.showModal();
}

function addDestinationRow() {
  const row = document.createElement("div");
  row.className = "destination-row";
  const options = state.tanks
    .map((tank) => `<option value="${escapeAttribute(tank.code)}">${escapeHtml(tank.code)}</option>`)
    .join("");
  row.innerHTML = `
    <select class="destination-select" aria-label="Cuba de destino">${options}</select>
    <input class="litres-input" type="number" min="0.01" step="0.01" placeholder="Litros" aria-label="Litros" />
    <button class="remove-destination" type="button" aria-label="Remover destino">×</button>
  `;
  row.querySelector(".destination-select").addEventListener("change", updateMovementBalance);
  row.querySelector(".litres-input").addEventListener("input", updateMovementBalance);
  row.querySelector(".remove-destination").addEventListener("click", () => {
    if (elements.destinationRows.children.length > 1) row.remove();
    updateMovementBalance();
  });
  elements.destinationRows.append(row);
}

function readDestinations() {
  return [...elements.destinationRows.querySelectorAll(".destination-row")]
    .map((row) => ({
      code: row.querySelector(".destination-select").value,
      litres: Number(row.querySelector(".litres-input").value),
    }))
    .filter((destination) => destination.code && destination.litres > 0);
}

function updateMovementBalance() {
  const source = getTank(elements.sourceSelect.value);
  const destinationLitres = readDestinations().reduce((sum, destination) => sum + destination.litres, 0);
  const availableLitres = source?.litres ?? 0;
  const difference = availableLitres - destinationLitres;
  const sourceText = source ? `${source.code}: ${formatLitres(availableLitres)} disponíveis.` : "Seleccione uma cuba de origem.";

  elements.sourceAvailability.textContent = sourceText;
  elements.balance.classList.toggle("is-error", difference < 0);
  elements.balance.textContent = difference < 0
    ? `Excesso de ${formatLitres(Math.abs(difference))}: reduza os destinos para respeitar o volume disponível.`
    : `Disponível: ${formatLitres(availableLitres)} · A transferir: ${formatLitres(destinationLitres)} · Fica na origem: ${formatLitres(difference)}`;
}

function saveMovement(event) {
  event.preventDefault();
  elements.movementError.textContent = "";

  const source = getTank(elements.sourceSelect.value);
  const destinations = readDestinations();
  const totalToTransfer = destinations.reduce((sum, destination) => sum + destination.litres, 0);
  const duplicateDestination = new Set(destinations.map((destination) => destination.code)).size !== destinations.length;

  if (!source || !destinations.length) return showMovementError("Indique pelo menos um destino e os respectivos litros.");
  if (destinations.some((destination) => destination.code === source.code)) return showMovementError("A cuba de origem não pode ser destino do mesmo movimento.");
  if (duplicateDestination) return showMovementError("Cada cuba de destino só pode aparecer uma vez.");
  if (totalToTransfer > source.litres) return showMovementError("Os litros a transferir não podem ultrapassar o volume disponível na origem.");

  source.litres -= totalToTransfer;
  destinations.forEach((destination) => {
    const tank = getTank(destination.code);
    tank.litres += destination.litres;
  });

  state.movements.unshift({
    id: crypto.randomUUID(),
    date: today(),
    sourceCode: source.code,
    destinations,
    reason: elements.reasonInput.value.trim(),
  });
  state.selectedTankCode = source.code;
  persistState();
  elements.movementDialog.close();
  render();
}

function showMovementError(message) {
  elements.movementError.textContent = message;
}

function openTankDialog() {
  elements.tankForm.reset();
  elements.tankError.textContent = "";
  elements.tankDialog.showModal();
}

function saveTank(event) {
  event.preventDefault();
  const code = elements.tankCodeInput.value.trim().toUpperCase();
  const litres = Number(elements.tankVolumeInput.value);
  elements.tankError.textContent = "";

  if (!code) return showTankError("Indique o código da cuba.");
  if (getTank(code)) return showTankError("Já existe uma cuba com esse código.");
  if (!Number.isFinite(litres) || litres < 0) return showTankError("Indique um volume igual ou superior a zero.");

  state.tanks.push({ code, litres });
  state.selectedTankCode = code;
  persistState();
  elements.tankDialog.close();
  render();
}

function showTankError(message) {
  elements.tankError.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

document.querySelector("#open-movement-button").addEventListener("click", openMovementDialog);
document.querySelector("#add-destination-button").addEventListener("click", addDestinationRow);
document.querySelector("#open-tank-button").addEventListener("click", openTankDialog);
document.querySelector("#reset-button").addEventListener("click", () => {
  if (window.confirm("Pretende eliminar os dados guardados nesta demonstração?")) {
    state = structuredClone(initialState);
    persistState();
    render();
  }
});
elements.sourceSelect.addEventListener("change", updateMovementBalance);
elements.movementForm.addEventListener("submit", saveMovement);
elements.tankForm.addEventListener("submit", saveTank);

render();
