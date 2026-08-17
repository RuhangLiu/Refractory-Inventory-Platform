import { storedLanguage, translateText } from "./i18n.js?v=20260815";

const state = {
  data: null,
  acknowledgments: [],
  warehouse: "all",
  page: "overview",
  language: storedLanguage(),
  lastAgentResult: null,
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

const locale = () => (state.language === "zh" ? "zh-CN" : "en-US");
const numberFormat = {
  format: (value) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(value)
};
const quantityLabel = (value, unit) =>
  `${numberFormat.format(value)} ${state.language === "zh" || value === 1 ? unit : `${unit}s`}`;
const currencyFormat = {
  format: (value) =>
    new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1
    }).format(value)
};
const exactCurrencyFormat = {
  format: (value) =>
    new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value)
};
const monthFormat = {
  format: (value) =>
    new Intl.DateTimeFormat(locale(), { month: "short", year: "2-digit" }).format(value)
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const originalTextNodes = new WeakMap();
const originalAttributes = new WeakMap();

function t(text) {
  return translateText(text, state.language);
}

function localized(english, chinese) {
  return state.language === "zh" ? chinese : english;
}

function translateStaticInterface() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName)) continue;
    if (!originalTextNodes.has(node)) originalTextNodes.set(node, node.nodeValue);
    const original = originalTextNodes.get(node);
    const normalized = original.trim().replace(/\s+/g, " ");
    if (!normalized) continue;
    if (state.language === "en") {
      node.nodeValue = original;
    } else {
      const translated = translateText(normalized, "zh");
      if (translated !== normalized) {
        const leading = original.match(/^\s*/)?.[0] || "";
        const trailing = original.match(/\s*$/)?.[0] || "";
        node.nodeValue = `${leading}${translated}${trailing}`;
      }
    }
  }

  for (const element of $$('[placeholder], [aria-label]')) {
    if (!originalAttributes.has(element)) {
      originalAttributes.set(element, {
        placeholder: element.getAttribute("placeholder"),
        ariaLabel: element.getAttribute("aria-label")
      });
    }
    const original = originalAttributes.get(element);
    if (original.placeholder != null) {
      element.setAttribute("placeholder", translateText(original.placeholder, state.language));
    }
    if (original.ariaLabel != null) {
      element.setAttribute("aria-label", translateText(original.ariaLabel, state.language));
    }
  }

  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = localized("Refractory Inventory Platform", "耐火材料库存平台");
  $$("[data-language]").forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function statusLabel(status) {
  return t(status);
}

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
  return `<span class="status-badge ${statusClass(status)}">${statusLabel(status)}</span>`;
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
    state.warehouse === "all"
      ? t("Across all warehouses")
      : localized(`${state.warehouse} warehouse`, `${state.warehouse} 仓库`)
  );
  setText(
    "#metric-risk-context",
    localized(
      `${risks.filter((row) => inventoryStatus(row) === "Out of stock").length} out of stock`,
      `${risks.filter((row) => inventoryStatus(row) === "Out of stock").length} 项缺货`
    )
  );
  setText("#hero-signal-value", `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`);
  setText(
    "#hero-signal-copy",
    percent >= 1
      ? localized("Higher external activity by forecast horizon", "预测期末外部活动增强")
      : percent <= -1
        ? localized("Lower external activity by forecast horizon", "预测期末外部活动减弱")
        : localized("External activity broadly stable", "外部活动总体稳定")
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
          label: t("Sales"),
          data: activity.map((row) => row.sales_quantity),
          borderColor: "#2f648f",
          backgroundColor: "#2f648f",
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.26
        },
        {
          label: t("Purchases"),
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
  setText(
    "#inventory-count",
    localized(
      `${numberFormat.format(rows.length)} inventory lines`,
      `${numberFormat.format(rows.length)} 条库存记录`
    )
  );
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
    : `<tr><td colspan="9" class="empty-state">${localized(
        "No inventory lines match these filters.",
        "没有符合当前筛选条件的库存记录。"
      )}</td></tr>`;
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
                <span>${t("Available")}</span>
                <strong>${numberFormat.format(row.available_quantity)} ${escapeHtml(row.unit)}</strong>
              </div>
              <div class="alert-measure">
                <span>${t("In transit")}</span>
                <strong>${numberFormat.format(row.in_transit_quantity)} ${escapeHtml(row.unit)}</strong>
              </div>
              <div class="alert-measure">
                <span>${localized("Suggested", "建议数量")}</span>
                <strong>${numberFormat.format(suggestedOrder(row))} ${escapeHtml(row.unit)}</strong>
              </div>
              <button
                class="ack-button"
                type="button"
                data-alert-id="${escapeHtml(row.alert_id)}"
                ${acknowledged ? "disabled" : ""}
              >
                ${
                  acknowledged
                    ? localized("Acknowledged", "已确认")
                    : localized("Acknowledge", "确认预警")
                }
              </button>
            </article>`;
        })
        .join("")
    : `<div class="panel empty-state">${localized(
        "No open inventory alerts for this warehouse.",
        "该仓库没有未处理的库存预警。"
      )}</div>`;

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
          label: localized("Observed", "实际值"),
          data: observedValues,
          borderColor: "#172027",
          backgroundColor: "#172027",
          pointRadius: 1.8,
          borderWidth: 2,
          tension: 0.2
        },
        {
          label: t("Forecast"),
          data: forecastValues,
          borderColor: "#c76535",
          backgroundColor: "#c76535",
          pointRadius: 2,
          borderWidth: 2.5,
          borderDash: [7, 4],
          tension: 0.2
        },
        {
          label: t("Lower bound"),
          data: lowerValues,
          borderColor: "rgba(199, 101, 53, 0)",
          backgroundColor: "rgba(199, 101, 53, 0.13)",
          pointRadius: 0,
          fill: "+1"
        },
        {
          label: t("Upper bound"),
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
          labels: {
            filter: (item) => ![t("Lower bound"), t("Upper bound")].includes(item.text)
          }
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
          title: { display: true, text: localized("Index (2017 = 100)", "指数（2017 = 100）") }
        }
      }
    }
  });

  const direction =
    percent >= 1
      ? localized("Rising", "上升")
      : percent <= -1
        ? localized("Falling", "下降")
        : localized("Stable", "稳定");
  setText("#forecast-direction", direction);
  setText(
    "#forecast-method",
    state.data.mode === "cloud"
      ? "BigQuery ML · ARIMA_PLUS"
      : localized("Local seasonal baseline", "本地季节性基线")
  );
  setText(
    "#forecast-takeaway",
    percent >= 1
      ? localized(
          "External activity points to a firmer demand environment.",
          "外部活动表明需求环境正在增强。"
        )
      : percent <= -1
        ? localized(
            "External activity points to a softer demand environment.",
            "外部活动表明需求环境正在减弱。"
          )
        : localized(
            "External activity is forecast to remain broadly stable.",
            "预计外部活动将总体保持稳定。"
          )
  );
  setText(
    "#forecast-explanation",
    localized(
      `The final forecast observation is ${Math.abs(percent).toFixed(1)}% ${
        percent >= 0 ? "above" : "below"
      } the latest actual index. Use this as planning context, not as a product-level sales commitment.`,
      `最终预测值比最新实际指数${percent >= 0 ? "高" : "低"} ${Math.abs(percent).toFixed(
        1
      )}%。请将其作为规划背景，而非产品级销售承诺。`
    )
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
  setText(
    "#industry-coverage",
    localized(
      `${firstDate}–${lastDate} (${observed.length} observations)`,
      `${firstDate}–${lastDate}（${observed.length} 个观测值）`
    )
  );
  const inventory = state.data.inventory;
  setText(
    "#inventory-coverage",
    localized(
      `${new Set(inventory.map((row) => row.product_code)).size} products × ${
        new Set(inventory.map((row) => row.warehouse)).size
      } warehouses`,
      `${new Set(inventory.map((row) => row.product_code)).size} 个产品 × ${
        new Set(inventory.map((row) => row.warehouse)).size
      } 个仓库`
    )
  );
}

function renderAll() {
  renderMetrics();
  renderOverviewCharts();
  renderOverviewAlertTable();
  renderInventoryTable();
  renderAlerts();
  renderForecast();
  translateStaticInterface();
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
  setText("#page-title", t(pageTitles[page]));
  history.replaceState(null, "", `#${page}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLanguage(language) {
  if (!["en", "zh"].includes(language)) return;
  state.language = language;
  try {
    localStorage.setItem("refractory-language", language);
  } catch {
    // Language switching still works when storage is unavailable.
  }

  const sampleQuestions = $$('[data-agent-question]');
  if (sampleQuestions.length === 3) {
    sampleQuestions[0].dataset.agentQuestion =
      language === "zh"
        ? "是否应该为芝加哥的 MCB-001 补货？为什么？"
        : "Should we replenish MCB-001 at Chicago, and why?";
    sampleQuestions[1].dataset.agentQuestion =
      language === "zh" ? "建议订购量是如何计算的？" : "How is suggested order quantity calculated?";
    sampleQuestions[2].dataset.agentQuestion =
      language === "zh" ? "哪些数据是真实的，哪些是合成的？" : "What data is real and what data is synthetic?";
  }

  setText("#page-title", t(pageTitles[state.page]));
  if (state.data) {
    renderAll();
    updatePlatformStatus();
  }
  if (state.lastAgentResult) renderAgentResult(state.lastAgentResult);
  translateStaticInterface();
  loadAgentStatus();
}

function updatePlatformStatus() {
  if (!state.data) return;
  const generated = new Date(state.data.generatedAt);
  setText(
    "#platform-mode",
    state.data.mode === "cloud"
      ? localized("Live cloud data", "实时云端数据")
      : localized("Local validated preview", "本地已验证预览")
  );
  setText(
    "#sidebar-freshness",
    `${localized("Updated", "更新于")} ${generated.toLocaleString(locale(), {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })}`
  );
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
    showToast(
      localized(
        `${row.product_code} alert acknowledged. No purchase order was created.`,
        `已确认 ${row.product_code} 预警。未创建采购订单。`
      )
    );
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
  showToast(
    localized(`Exported ${rows.length} inventory lines.`, `已导出 ${rows.length} 条库存记录。`)
  );
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3400);
}

function traceLabel(type) {
  if (state.language !== "zh") return type.replaceAll("_", " ");
  return (
    {
      input: "输入",
      retrieval: "证据检索",
      tool_call: "工具调用",
      tool_result: "工具结果",
      tool_decision: "工具决策",
      generation: "回答生成",
      generation_fallback: "生成回退",
      final: "最终回答"
    }[type] || type.replaceAll("_", " ")
  );
}

function traceSummary(step) {
  if (state.language !== "zh") return step.summary;
  return (
    {
      input: "已接收用户问题。",
      retrieval: `已检索 ${step.details?.source_ids?.length ?? ""} 条基于项目数据的证据。`,
      tool_call: "已调用只读补货建议工具。",
      tool_result: "已收到需要人工审批的补货建议。",
      tool_decision: "该问题无需调用补货工具。",
      generation: "已使用基于证据的方式生成回答。",
      generation_fallback: "云端生成不可用，已改用本地证据输出。",
      final: "已返回包含引用和安全控制的回答。"
    }[step.type] || step.summary
  );
}

function renderAgentResult(result) {
  state.lastAgentResult = result;
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
            <small>${escapeHtml(source.source)} · ${localized("relevance", "相关度")} ${escapeHtml(
              source.score
            )}</small>
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
          <div><strong>${escapeHtml(traceLabel(step.type))}</strong><p>${escapeHtml(
            traceSummary(step)
          )}</p></div>
        </li>`
    )
    .join("");

  const toolPanel = $("#agent-tool-panel");
  toolPanel.hidden = !result.tool_result;
  if (result.tool_result) {
    const tool = result.tool_result;
    const fields = [
      [t("Product"), `${tool.product_code} · ${tool.product_name}`],
      [t("Warehouse"), tool.warehouse],
      [t("Status"), statusLabel(tool.status)],
      [t("Available"), quantityLabel(tool.available_quantity, tool.unit)],
      [t("Safety stock"), quantityLabel(tool.safety_stock, tool.unit)],
      [t("In transit"), quantityLabel(tool.in_transit_quantity, tool.unit)],
      [t("Suggested order"), quantityLabel(tool.suggested_order_quantity, tool.unit)],
      [localized("Control", "控制要求"), localized("Human approval required", "需要人工审批")]
    ];
    $("#agent-tool-result").innerHTML = fields
      .map(
        ([label, value]) =>
          `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
      )
      .join("");
  }
  translateStaticInterface();
}

async function askAgent(question) {
  const progress = $("#assistant-progress");
  const submit = $("#assistant-submit");
  progress.textContent = localized(
    "Retrieving evidence and checking tool access…",
    "正在检索证据并检查工具权限…"
  );
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
    progress.textContent = localized(
      `Trace ${result.trace.trace_id.slice(0, 8)} completed.`,
      `轨迹 ${result.trace.trace_id.slice(0, 8)} 已完成。`
    );
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
      status.generation_mode === "managed-agent-engine"
        ? `${status.model} · ${localized(
            "BigQuery MCP + GCS MCP + RAG Engine",
            "BigQuery MCP + GCS MCP + RAG Engine"
          )}`
        : status.model
          ? `${status.model} · ${localized("grounded retrieval", "基于证据的检索")}`
        : localized("Grounded local generation · no cloud key", "本地证据生成 · 无需云端密钥")
    );
  } catch (error) {
    console.error(error);
  }
}

function bindEvents() {
  $$("[data-language]").forEach((button) =>
    button.addEventListener("click", () => setLanguage(button.dataset.language))
  );
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
    if (!dataResponse.ok) {
      throw new Error(localized("Dashboard data could not be loaded.", "无法加载仪表板数据。"));
    }
    state.data = await dataResponse.json();
    state.acknowledgments = actionsResponse.ok ? await actionsResponse.json() : [];
    populateControls();
    chartDefaults();
    renderAll();

    updatePlatformStatus();
    translateStaticInterface();
    showToast(localized("Inventory data refreshed.", "库存数据已刷新。"));
  } catch (error) {
    console.error(error);
    setText("#platform-mode", localized("Data unavailable", "数据不可用"));
    setText("#sidebar-freshness", localized("Check the local server", "请检查本地服务器"));
    showToast(error.message);
  }
}

bindEvents();
setLanguage(state.language);
navigate(location.hash.slice(1) || "overview");
loadData();
loadAgentStatus();
