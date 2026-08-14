const state = {
  data: null,
  acknowledgments: [],
  warehouse: "all",
  page: "overview",
  filters: {
    search: "",
    category: "all",
    supplier: "all",
    status: "all"
  },
  charts: {}
};

const pageTitles = {
  overview: "Inventory overview",
  inventory: "Inventory register",
  alerts: "Action queue",
  forecast: "External demand signal",
  data: "Data lineage",
  assistant: "AI planning assistant"
};

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const quantityLabel = (value, unit) =>
  `${numberFormat.format(value)} ${value === 1 ? unit : `${unit}s`}`;
const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
});
const exactCurrencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function inventoryStatus(row) {
  if (row.available_quantity === 0) return "Out of stock";
  if (row.available_quantity < row.safety_stock * 0.5) return "Critical";
  if (row.available_quantity < row.safety_stock) return "Low";
  return "Healthy";
}

function statusRank(status) {
  return { "Out of stock": 0, Critical: 1, Low: 2, Healthy: 3 }[status] ?? 4;
}

function suggestedOrder(row) {
  return Math.max(
    0,
    Math.ceil(row.safety_stock * 1.5 - row.available_quantity - row.in_transit_quantity)
  );
}

function inventoryValue(row) {
  return row.current_quantity * row.unit_price;
}

function selectedInventory() {
  return state.data.inventory.filter(
    (row) => state.warehouse === "all" || row.warehouse === state.warehouse
  );
}

function filteredInventory() {
  const search = state.filters.search.trim().toLowerCase();
  return selectedInventory()
    .filter((row) => {
      const status = inventoryStatus(row);
      const matchesSearch =
        !search ||
        row.product_name.toLowerCase().includes(search) ||
        row.product_code.toLowerCase().includes(search);
      return (
        matchesSearch &&
        (state.filters.category === "all" || row.category === state.filters.category) &&
        (state.filters.supplier === "all" || row.supplier === state.filters.supplier) &&
        (state.filters.status === "all" || status === state.filters.status)
      );
    })
    .sort((a, b) => {
      const rankDifference = statusRank(inventoryStatus(a)) - statusRank(inventoryStatus(b));
      if (rankDifference) return rankDifference;
      return suggestedOrder(b) - suggestedOrder(a);
    });
}

function actionableInventory() {
  return selectedInventory()
    .filter((row) => inventoryStatus(row) !== "Healthy")
    .sort((a, b) => {
      const rankDifference = statusRank(inventoryStatus(a)) - statusRank(inventoryStatus(b));
      if (rankDifference) return rankDifference;
      return suggestedOrder(b) - suggestedOrder(a);
    });
}

function statusClass(status) {
  return `status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function statusBadge(status) {
  return `<span class="status-badge ${statusClass(status)}">${status}</span>`;
}

function productCell(row) {
  return `<div class="product-cell"><strong>${escapeHtml(row.product_name)}</strong><span>${escapeHtml(
    row.product_code
  )} · ${escapeHtml(row.unit)}</span></div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function latestForecastStats() {
  const observed = state.data.demandSignal.filter((row) => row.actual_value != null);
  const forecast = state.data.demandSignal.filter((row) => row.forecast_value != null);
  const lastActual = observed.at(-1)?.actual_value ?? 0;
  const lastForecast = forecast.at(-1)?.forecast_value ?? lastActual;
  const percent = lastActual ? ((lastForecast / lastActual) - 1) * 100 : 0;
  return { observed, forecast, lastActual, lastForecast, percent };
}

function renderMetrics() {
  const rows = selectedInventory();
  const available = rows.reduce((sum, row) => sum + row.available_quantity, 0);
  const value = rows.reduce((sum, row) => sum + inventoryValue(row), 0);
  const risks = rows.filter((row) => inventoryStatus(row) !== "Healthy");
  const healthyPercent = rows.length
    ? Math.round(((rows.length - risks.length) / rows.length) * 100)
    : 0;
  const { percent } = latestForecastStats();

  setText("#metric-value", currencyFormat.format(value));
  setText("#metric-available", numberFormat.format(available));
  setText("#metric-risk", numberFormat.format(risks.length));
  setText("#metric-health", `${healthyPercent}%`);
  setText(
    "#metric-value-context",
    state.warehouse === "all" ? "Across all warehouses" : `${state.warehouse} warehouse`
  );
  setText(
    "#metric-risk-context",
    `${risks.filter((row) => inventoryStatus(row) === "Out of stock").length} out of stock`
  );
  setText("#hero-signal-value", `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`);
  setText(
    "#hero-signal-copy",
    percent >= 1
      ? "Higher external activity by forecast horizon"
      : percent <= -1
        ? "Lower external activity by forecast horizon"
        : "External activity broadly stable"
  );
}

function chartDefaults() {
  Chart.defaults.font.family =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  Chart.defaults.color = "#52606a";
  Chart.defaults.borderColor = "#ded8cc";
}

function replaceChart(key, elementId, config) {
  state.charts[key]?.destroy();
  const canvas = document.getElementById(elementId);
  if (!canvas) return;
  state.charts[key] = new Chart(canvas, config);
}

function renderOverviewCharts() {
  const rows = selectedInventory();
  const categoryValue = Object.entries(
    rows.reduce((accumulator, row) => {
      accumulator[row.category] = (accumulator[row.category] || 0) + inventoryValue(row);
      return accumulator;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  replaceChart("category", "category-chart", {
    type: "bar",
    data: {
      labels: categoryValue.map(([category]) => category),
      datasets: [
        {
          data: categoryValue.map(([, value]) => value),
          backgroundColor: "#2f648f",
          borderColor: "#204a6b",
          borderWidth: 1,
          borderRadius: 5
        }
      ]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => exactCurrencyFormat.format(context.raw) } }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "#e9e4da" },
          ticks: { callback: (value) => currencyFormat.format(value) }
        },
        y: { grid: { display: false }, ticks: { autoSkip: false } }
      }
    }
  });

  const activity = state.data.monthlyActivity;
  replaceChart("activity", "activity-chart", {
    type: "line",
    data: {
      labels: activity.map((row) => monthFormat.format(new Date(`${row.month}T00:00:00Z`))),
      datasets: [
        {
          label: "Sales",
          data: activity.map((row) => row.sales_quantity),
          borderColor: "#2f648f",
          backgroundColor: "#2f648f",
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.26
        },
        {
          label: "Purchases",
          data: activity.map((row) => row.purchase_quantity),
          borderColor: "#b99142",
          backgroundColor: "#fffdf9",
          borderDash: [7, 5],
          borderWidth: 2,
          pointRadius: 2,
          pointBorderWidth: 2,
          pointHoverRadius: 5,
          tension: 0.26
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
        y: {
          beginAtZero: true,
          grid: { color: "#e9e4da" },
          ticks: { callback: (value) => numberFormat.format(value) }
        }
      }
    }
  });

  const risks = actionableInventory().slice(0, 6).reverse();
  replaceChart("risk", "risk-chart", {
    type: "bar",
    data: {
      labels: risks.map((row) => `${row.product_code} · ${row.warehouse}`),
      datasets: [
        {
          data: risks.map(suggestedOrder),
          backgroundColor: risks.map((row) =>
            ["Out of stock", "Critical"].includes(inventoryStatus(row)) ? "#c76535" : "#b99142"
          ),
          borderColor: "#8c512f",
          borderWidth: 1,
          borderRadius: 5
        }
      ]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "#e9e4da" } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderOverviewAlertTable() {
  const rows = actionableInventory().slice(0, 6);
  $("#overview-alert-table").innerHTML = rows
    .map((row) => {
      const status = inventoryStatus(row);
      return `
        <tr>
          <td>${productCell(row)}</td>
          <td>${escapeHtml(row.warehouse)}</td>
          <td>${statusBadge(status)}</td>
          <td class="number">${numberFormat.format(row.available_quantity)}</td>
          <td class="number">${numberFormat.format(row.safety_stock)}</td>
          <td class="number">${numberFormat.format(suggestedOrder(row))}</td>
        </tr>`;
    })
    .join("");
}

function renderInventoryTable() {
  const rows = filteredInventory();
  setText("#inventory-count", `${numberFormat.format(rows.length)} inventory lines`);
  $("#inventory-table").innerHTML = rows.length
    ? rows
        .map((row) => {
          const status = inventoryStatus(row);
          return `
            <tr>
              <td>${productCell(row)}</td>
              <td>${escapeHtml(row.category)}</td>
              <td>${escapeHtml(row.warehouse)}</td>
              <td>${statusBadge(status)}</td>
              <td class="number">${numberFormat.format(row.current_quantity)}</td>
              <td class="number">${numberFormat.format(row.reserved_quantity)}</td>
              <td class="number">${numberFormat.format(row.available_quantity)}</td>
              <td class="number">${numberFormat.format(row.in_transit_quantity)}</td>
              <td class="number">${exactCurrencyFormat.format(inventoryValue(row))}</td>
            </tr>`;
        })
        .join("")
    : '<tr><td colspan="9" class="empty-state">No inventory lines match these filters.</td></tr>';
}

function isAcknowledged(row) {
  return state.acknowledgments.some((action) => action.alert_id === row.alert_id);
}

function renderAlerts() {
  const rows = actionableInventory();
  const openRows = rows.filter((row) => !isAcknowledged(row));
  setText("#open-alert-count", numberFormat.format(openRows.length));

  $("#alert-list").innerHTML = rows.length
    ? rows
        .map((row) => {
          const status = inventoryStatus(row);
          const acknowledged = isAcknowledged(row);
          return `
            <article class="alert-card" data-status="${escapeHtml(status)}">
              <div>
                ${statusBadge(status)}
                <h3>${escapeHtml(row.product_name)}</h3>
                <p>${escapeHtml(row.product_code)} · ${escapeHtml(row.warehouse)} · ${escapeHtml(
                  row.supplier
                )}</p>
              </div>
              <div class="alert-measure">
                <span>Available</span>
                <strong>${numberFormat.format(row.available_quantity)} ${escapeHtml(row.unit)}</strong>
              </div>
              <div class="alert-measure">
                <span>In transit</span>
                <strong>${numberFormat.format(row.in_transit_quantity)} ${escapeHtml(row.unit)}</strong>
              </div>
              <div class="alert-measure">
                <span>Suggested</span>
                <strong>${numberFormat.format(suggestedOrder(row))} ${escapeHtml(row.unit)}</strong>
              </div>
              <button
                class="ack-button"
                type="button"
                data-alert-id="${escapeHtml(row.alert_id)}"
                ${acknowledged ? "disabled" : ""}
              >
                ${acknowledged ? "Acknowledged" : "Acknowledge"}
              </button>
            </article>`;
        })
        .join("")
    : '<div class="panel empty-state">No open inventory alerts for this warehouse.</div>';

  $$(".ack-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => acknowledgeAlert(button.dataset.alertId));
  });
}

function renderForecast() {
  const { observed, forecast, percent } = latestForecastStats();
  const visibleObserved = observed.slice(-36);
  const labels = [
    ...visibleObserved.map((row) => row.observation_date),
    ...forecast.map((row) => row.observation_date)
  ];
  const observedValues = [
    ...visibleObserved.map((row) => row.actual_value),
    ...forecast.map(() => null)
  ];
  const forecastValues = [
    ...visibleObserved.slice(0, -1).map(() => null),
    visibleObserved.at(-1)?.actual_value ?? null,
    ...forecast.map((row) => row.forecast_value)
  ];
  const lowerValues = [...visibleObserved.map(() => null), ...forecast.map((row) => row.lower_bound)];
  const upperValues = [...visibleObserved.map(() => null), ...forecast.map((row) => row.upper_bound)];

  replaceChart("forecast", "forecast-chart", {
    type: "line",
    data: {
      labels: labels.map((date) => monthFormat.format(new Date(`${date}T00:00:00Z`))),
      datasets: [
        {
          label: "Observed",
          data: observedValues,
          borderColor: "#172027",
          backgroundColor: "#172027",
          pointRadius: 1.8,
          borderWidth: 2,
          tension: 0.2
        },
        {
          label: "Forecast",
          data: forecastValues,
          borderColor: "#c76535",
          backgroundColor: "#c76535",
          pointRadius: 2,
          borderWidth: 2.5,
          borderDash: [7, 4],
          tension: 0.2
        },
        {
          label: "Lower bound",
          data: lowerValues,
          borderColor: "rgba(199, 101, 53, 0)",
          backgroundColor: "rgba(199, 101, 53, 0.13)",
          pointRadius: 0,
          fill: "+1"
        },
        {
          label: "Upper bound",
          data: upperValues,
          borderColor: "rgba(199, 101, 53, 0)",
          backgroundColor: "rgba(199, 101, 53, 0.13)",
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { filter: (item) => !["Lower bound", "Upper bound"].includes(item.text) }
        },
        tooltip: {
          filter: (context) => context.raw != null,
          callbacks: { label: (context) => `${context.dataset.label}: ${Number(context.raw).toFixed(1)}` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
        y: {
          grid: { color: "#e9e4da" },
          title: { display: true, text: "Index (2017 = 100)" }
        }
      }
    }
  });

  const direction = percent >= 1 ? "Rising" : percent <= -1 ? "Falling" : "Stable";
  setText("#forecast-direction", direction);
  setText(
    "#forecast-method",
    state.data.mode === "cloud" ? "BigQuery ML · ARIMA_PLUS" : "Local seasonal baseline"
  );
  setText(
    "#forecast-takeaway",
    percent >= 1
      ? "External activity points to a firmer demand environment."
      : percent <= -1
        ? "External activity points to a softer demand environment."
        : "External activity is forecast to remain broadly stable."
  );
  setText(
    "#forecast-explanation",
    `The final forecast observation is ${Math.abs(percent).toFixed(1)}% ${
      percent >= 0 ? "above" : "below"
    } the latest actual index. Use this as planning context, not as a product-level sales commitment.`
  );
  $("#forecast-table").innerHTML = forecast
    .slice(0, 6)
    .map(
      (row) => `
        <tr>
          <td>${monthFormat.format(new Date(`${row.observation_date}T00:00:00Z`))}</td>
          <td class="number">${row.forecast_value.toFixed(1)}</td>
          <td class="number">${row.lower_bound.toFixed(1)}</td>
          <td class="number">${row.upper_bound.toFixed(1)}</td>
        </tr>`
    )
    .join("");

  const firstDate = observed.at(0)?.observation_date?.slice(0, 4);
  const lastDate = observed.at(-1)?.observation_date?.slice(0, 7);
  setText("#industry-coverage", `${firstDate}–${lastDate} (${observed.length} observations)`);
  const inventory = state.data.inventory;
  setText(
    "#inventory-coverage",
    `${new Set(inventory.map((row) => row.product_code)).size} products × ${
      new Set(inventory.map((row) => row.warehouse)).size
    } warehouses`
  );
}

function renderAll() {
  renderMetrics();
  renderOverviewCharts();
  renderOverviewAlertTable();
  renderInventoryTable();
  renderAlerts();
  renderForecast();
}

function populateSelect(selector, values) {
  const select = $(selector);
  const existing = new Set([...select.options].map((option) => option.value));
  [...new Set(values)].sort().forEach((value) => {
    if (!existing.has(value)) select.add(new Option(value, value));
  });
}

function populateControls() {
  populateSelect(
    "#global-warehouse",
    state.data.inventory.map((row) => row.warehouse)
  );
  populateSelect(
    "#category-filter",
    state.data.inventory.map((row) => row.category)
  );
  populateSelect(
    "#supplier-filter",
    state.data.inventory.map((row) => row.supplier)
  );
}

function navigate(page) {
  if (!pageTitles[page]) return;
  state.page = page;
  $$(".nav-item").forEach((button) =>
    button.classList.toggle("is-active", button.dataset.page === page)
  );
  $$("[data-page-panel]").forEach((panel) =>
    panel.classList.toggle("is-active", panel.dataset.pagePanel === page)
  );
  setText("#page-title", pageTitles[page]);
  history.replaceState(null, "", `#${page}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function acknowledgeAlert(alertId) {
  const row = state.data.inventory.find((item) => item.alert_id === alertId);
  if (!row) return;
  try {
    const response = await fetch("/api/acknowledgments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertId,
        productCode: row.product_code,
        warehouse: row.warehouse,
        acknowledgedBy: "Warehouse planner"
      })
    });
    if (!response.ok) throw new Error("Acknowledgment could not be saved.");
    state.acknowledgments = [
      await response.json(),
      ...state.acknowledgments.filter((item) => item.alert_id !== alertId)
    ];
    renderAlerts();
    showToast(`${row.product_code} alert acknowledged. No purchase order was created.`);
  } catch (error) {
    showToast(error.message);
  }
}

function exportCsv() {
  const rows = filteredInventory();
  const columns = [
    "product_code",
    "product_name",
    "category",
    "supplier",
    "warehouse",
    "unit",
    "current_quantity",
    "reserved_quantity",
    "available_quantity",
    "in_transit_quantity",
    "safety_stock",
    "status",
    "suggested_order",
    "unit_price",
    "inventory_value"
  ];
  const escapeCsv = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const derived = {
            status: inventoryStatus(row),
            suggested_order: suggestedOrder(row),
            inventory_value: inventoryValue(row).toFixed(2)
          };
          return escapeCsv(column in derived ? derived[column] : row[column]);
        })
        .join(",")
    )
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `refractory-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} inventory lines.`);
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3400);
}

function renderAgentResult(result) {
  $("#agent-answer-panel").hidden = false;
  $("#agent-sources-panel").hidden = false;
  $("#agent-trace-panel").hidden = false;
  $("#agent-answer").textContent = result.answer;
  setText("#agent-answer-mode", result.model ? `${result.generation_mode} · ${result.model}` : result.generation_mode);

  $("#agent-sources").innerHTML = result.sources
    .map(
      (source) => `
        <li>
          <span>${escapeHtml(source.citation)}</span>
          <div>
            <strong>${escapeHtml(source.title)}</strong>
            <small>${escapeHtml(source.source)} · relevance ${escapeHtml(source.score)}</small>
            <p>${escapeHtml(source.excerpt)}</p>
          </div>
        </li>`
    )
    .join("");

  $("#agent-trace").innerHTML = result.trace.steps
    .map(
      (step) => `
        <li>
          <span>${String(step.sequence).padStart(2, "0")}</span>
          <div><strong>${escapeHtml(step.type.replaceAll("_", " "))}</strong><p>${escapeHtml(
            step.summary
          )}</p></div>
        </li>`
    )
    .join("");

  const toolPanel = $("#agent-tool-panel");
  toolPanel.hidden = !result.tool_result;
  if (result.tool_result) {
    const tool = result.tool_result;
    const fields = [
      ["Product", `${tool.product_code} · ${tool.product_name}`],
      ["Warehouse", tool.warehouse],
      ["Status", tool.status],
      ["Available", quantityLabel(tool.available_quantity, tool.unit)],
      ["Safety stock", quantityLabel(tool.safety_stock, tool.unit)],
      ["In transit", quantityLabel(tool.in_transit_quantity, tool.unit)],
      ["Suggested order", quantityLabel(tool.suggested_order_quantity, tool.unit)],
      ["Control", "Human approval required"]
    ];
    $("#agent-tool-result").innerHTML = fields
      .map(
        ([label, value]) =>
          `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
      )
      .join("");
  }
}

async function askAgent(question) {
  const progress = $("#assistant-progress");
  const submit = $("#assistant-submit");
  progress.textContent = "Retrieving evidence and checking tool access…";
  submit.disabled = true;
  try {
    const response = await fetch("/api/agent/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || result.error || "Agent request failed.");
    renderAgentResult(result);
    progress.textContent = `Trace ${result.trace.trace_id.slice(0, 8)} completed.`;
  } catch (error) {
    progress.textContent = error.message;
    showToast(error.message);
  } finally {
    submit.disabled = false;
  }
}

async function loadAgentStatus() {
  try {
    const response = await fetch("/api/agent/status", { cache: "no-store" });
    if (!response.ok) return;
    const status = await response.json();
    setText("#agent-mode", status.generation_mode);
    setText(
      "#agent-model",
      status.model ? `${status.model} · grounded retrieval` : "Grounded local generation · no cloud key"
    );
  } catch (error) {
    console.error(error);
  }
}

function bindEvents() {
  $$(".nav-item").forEach((button) =>
    button.addEventListener("click", () => navigate(button.dataset.page))
  );
  $$("[data-go-to]").forEach((button) =>
    button.addEventListener("click", () => navigate(button.dataset.goTo))
  );
  $("#global-warehouse").addEventListener("change", (event) => {
    state.warehouse = event.target.value;
    renderAll();
  });
  $("#inventory-search").addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderInventoryTable();
  });
  for (const [selector, key] of [
    ["#category-filter", "category"],
    ["#supplier-filter", "supplier"],
    ["#status-filter", "status"]
  ]) {
    $(selector).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      renderInventoryTable();
    });
  }
  $("#clear-filters").addEventListener("click", () => {
    state.filters = { search: "", category: "all", supplier: "all", status: "all" };
    $("#inventory-search").value = "";
    $("#category-filter").value = "all";
    $("#supplier-filter").value = "all";
    $("#status-filter").value = "all";
    renderInventoryTable();
  });
  $("#export-button").addEventListener("click", exportCsv);
  $("#refresh-button").addEventListener("click", loadData);
  $("#assistant-form").addEventListener("submit", (event) => {
    event.preventDefault();
    askAgent($("#assistant-question").value.trim());
  });
  $$('[data-agent-question]').forEach((button) =>
    button.addEventListener("click", () => {
      $("#assistant-question").value = button.dataset.agentQuestion;
      askAgent(button.dataset.agentQuestion);
    })
  );
}

async function loadData() {
  try {
    const [dataResponse, actionsResponse] = await Promise.all([
      fetch("/api/dashboard", { cache: "no-store" }),
      fetch("/api/acknowledgments", { cache: "no-store" })
    ]);
    if (!dataResponse.ok) throw new Error("Dashboard data could not be loaded.");
    state.data = await dataResponse.json();
    state.acknowledgments = actionsResponse.ok ? await actionsResponse.json() : [];
    populateControls();
    chartDefaults();
    renderAll();

    const generated = new Date(state.data.generatedAt);
    setText("#platform-mode", state.data.mode === "cloud" ? "Live cloud data" : "Local validated preview");
    setText("#sidebar-freshness", `Updated ${generated.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })}`);
    showToast("Inventory data refreshed.");
  } catch (error) {
    console.error(error);
    setText("#platform-mode", "Data unavailable");
    setText("#sidebar-freshness", "Check the local server");
    showToast(error.message);
  }
}

bindEvents();
navigate(location.hash.slice(1) || "overview");
loadData();
loadAgentStatus();
