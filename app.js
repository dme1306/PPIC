(function () {
  "use strict";

  var config = window.FMS_CONFIG || {};
  var dashboardData = { tasks: [], specTasks: [], sources: [], warnings: [] };
  var activeView = "all";
  var isLoading = false;
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }

  function normalize(value) {
    return String(value === null || value === undefined ? "" : value).trim().toLowerCase();
  }

  function parseDate(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && value > 20000 && value < 100000) {
      return new Date(Date.UTC(1899, 11, 30) + value * 86400000 - 330 * 60000);
    }

    var text = String(value).trim();
    var iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (iso) {
      return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0)) - 330 * 60000);
    }
    var dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (dmy) {
      var year = Number(dmy[3]);
      if (year < 100) year += 2000;
      return new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] || 0), Number(dmy[5] || 0), Number(dmy[6] || 0)) - 330 * 60000);
    }
    var parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function fmtDate(value) {
    var date = parseDate(value);
    return date ? date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : (value ? String(value) : "—");
  }

  function ageLabel(hours) {
    if (hours === null || hours === undefined || !Number.isFinite(Number(hours))) return "—";
    var rounded = Math.round(Number(hours));
    if (rounded < 0) return "Due in " + Math.abs(rounded) + "h";
    if (rounded >= 24) return Math.floor(rounded / 24) + "d " + (rounded % 24) + "h";
    return rounded + "h";
  }

  function distinctTasks(rows) {
    return new Set(rows.map(function (row) { return row.source + "|" + row.sourceRow; })).size;
  }

  function currentRows() {
    if (activeView === "spec") return dashboardData.specTasks || [];
    if (activeView === "aging") {
      return (dashboardData.tasks || []).filter(function (row) {
        return Number(row.orderAgeDays) >= 5;
      });
    }
    return dashboardData.tasks || [];
  }

  function filteredRows() {
    var search = $("searchInput").value.trim().toLowerCase();
    var source = $("sourceFilter").value;
    var team = $("teamFilter").value;
    var stage = $("stageFilter").value;
    var production = $("productionFilter").value;
    var due = $("dueFilter").value;

    return currentRows().filter(function (row) {
      var haystack = [
        row.source, row.ref, row.company, row.product, row.orderStatus, row.status,
        row.step, row.team, row.owner, row.remarks, row.ppicRemark
      ].join(" ").toLowerCase();
      var flag = normalize(row.productionFlag);
      var hasProductionFlag = flag !== "" && flag !== "unknown";
      var isProductionYes = flag === "yes";

      return (!search || haystack.indexOf(search) !== -1) &&
        (!source || row.source === source) &&
        (!team || row.team === team) &&
        (!stage || row.step === stage) &&
        (!production ||
          (production === "yes" && isProductionYes) ||
          (production === "no" && hasProductionFlag && !isProductionYes) ||
          (production === "unknown" && !hasProductionFlag)) &&
        (!due || (due === "overdue" ? Boolean(row.overdue) : !row.overdue));
    });
  }

  function renderMetrics() {
    var tasks = dashboardData.tasks || [];
    $("ordersMetric").textContent = distinctTasks(tasks).toLocaleString("en-IN");
    $("tasksMetric").textContent = tasks.length.toLocaleString("en-IN");
    $("overdueMetric").textContent = tasks.filter(function (row) { return row.overdue; }).length.toLocaleString("en-IN");

    var agingOrders = new Set(tasks.filter(function (row) {
      return Number(row.orderAgeDays) >= 5;
    }).map(function (row) { return row.source + "|" + row.sourceRow; }));
    $("agingMetric").textContent = agingOrders.size.toLocaleString("en-IN");
  }

  function renderBottlenecks() {
    var totals = new Map();
    (dashboardData.tasks || []).forEach(function (row) {
      var label = row.team || "Unassigned";
      totals.set(label, (totals.get(label) || 0) + 1);
    });
    var sorted = Array.from(totals.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    var max = sorted.length ? sorted[0][1] : 1;
    $("bottleneckTotal").textContent = (dashboardData.tasks || []).length.toLocaleString("en-IN") + " tasks";
    $("bottleneckList").innerHTML = sorted.length ? sorted.map(function (entry) {
      var width = Math.max(4, Math.round((entry[1] / max) * 100));
      return "<div class='bottleneck-row'><span class='bottleneck-name'>" + esc(entry[0]) +
        "</span><span class='bottleneck-track'><span class='bottleneck-bar' style='width:" + width + "%'></span></span><strong>" +
        entry[1].toLocaleString("en-IN") + "</strong></div>";
    }).join("") : "<p class='empty compact-empty'>No pending tasks to group.</p>";
  }

  function setSelectOptions(id, defaultText, values) {
    var select = $(id);
    var current = select.value;
    select.innerHTML = "<option value=''>" + esc(defaultText) + "</option>" + values.map(function (value) {
      return "<option value='" + esc(value) + "'>" + esc(value) + "</option>";
    }).join("");
    if (values.indexOf(current) !== -1) select.value = current;
  }

  function renderFilters() {
    var tasks = (dashboardData.tasks || []).concat(dashboardData.specTasks || []);
    setSelectOptions("sourceFilter", "All companies", Array.from(new Set(tasks.map(function (r) { return r.source; }).filter(Boolean))).sort());
    setSelectOptions("teamFilter", "All teams", Array.from(new Set(tasks.map(function (r) { return r.team; }).filter(Boolean))).sort());
    setSelectOptions("stageFilter", "All steps", Array.from(new Set(tasks.map(function (r) { return r.step; }).filter(Boolean))).sort());
  }

  function renderWarnings() {
    var warnings = dashboardData.warnings || [];
    var banner = $("sourceWarnings");
    if (!warnings.length) {
      banner.hidden = true;
      banner.innerHTML = "";
      return;
    }
    banner.hidden = false;
    banner.innerHTML = "<strong>Source data needs attention.</strong><ul>" +
      warnings.map(function (warning) { return "<li>" + esc(warning) + "</li>"; }).join("") +
      "</ul><span>Displayed records may be incomplete.</span>";
  }

  function renderTable() {
    var rows = filteredRows();
    $("visibleCount").textContent = rows.length.toLocaleString("en-IN") + " tasks";
    $("tableSummary").textContent = "Showing " + rows.length.toLocaleString("en-IN") +
      " of " + currentRows().length.toLocaleString("en-IN") + " tasks in this view";

    $("tableBody").innerHTML = rows.length ? rows.map(function (row) {
      var note = [row.remarks, row.ppicRemark].filter(function (value) {
        return value !== null && value !== undefined && String(value).trim() !== "";
      }).join(" · ");
      var status = row.overdue ? "<span class='state-pill overdue-pill'>Past due</span>" : "<span class='state-pill current-pill'>On plan</span>";
      var prod = normalize(row.productionFlag) === "yes" ?
        "<span class='state-pill production-pill'>Yes</span>" :
        (normalize(row.productionFlag) === "unknown" || !row.productionFlag ? "Unknown" : esc(row.productionFlag));
      var sourceLink = String(row.sourceUrl || "");
      var linkHtml = sourceLink.indexOf("https://docs.google.com/spreadsheets/") === 0 ?
        "<a class='source-link' href='" + esc(sourceLink) + "' target='_blank' rel='noopener noreferrer'>Open row ↗</a>" : "—";
      var stepAge = ageLabel(row.stepAgeHours);
      var ageClass = row.overdue ? "age overdue-text" : "age";

      return "<tr>" +
        "<td><span class='source-chip'>" + esc(row.source || "—") + "</span></td>" +
        "<td><strong class='ref-number'>" + esc(row.ref || "—") + "</strong></td>" +
        "<td class='company-cell'><strong>" + esc(row.company || "—") + "</strong><span>" + esc(row.product || "—") + "</span></td>" +
        "<td>" + esc(row.orderStatus || row.status || "—") + "</td>" +
        "<td><strong>" + esc(row.step || "—") + "</strong><span class='subtle'>" + esc(row.owner || "") + "</span></td>" +
        "<td>" + esc(row.team || "Unassigned") + "</td>" +
        "<td>" + esc(fmtDate(row.planned)) + "<span class='subtle'>" + status + "</span></td>" +
        "<td class='" + ageClass + "'>" + esc(stepAge) + "</td>" +
        "<td>" + (row.orderAgeDays === null || row.orderAgeDays === undefined ? "—" : esc(row.orderAgeDays + " days")) + "</td>" +
        "<td>" + prod + "</td>" +
        "<td class='remarks-cell' title='" + esc(note) + "'>" + esc(note || "—") + "</td>" +
        "<td>" + linkHtml + "</td>" +
        "</tr>";
    }).join("") : "<tr><td colspan='12' class='empty'>No pending tasks match these filters.</td></tr>";

    var headings = {
      all: ["All pending work", "One row per pending workflow group, linked to its original source row."],
      spec: ["QA / spec approval pending", "Orders where the QA / product specification step is planned and its completion field is blank."],
      aging: ["Orders aged 5+ days", "Pending tasks for orders at least five calendar days old."]
    };
    $("queueTitle").textContent = headings[activeView][0];
    $("queueDescription").textContent = headings[activeView][1];
  }

  function render() {
    renderMetrics();
    renderBottlenecks();
    renderWarnings();
    renderTable();
  }

  function updateSourceSummary() {
    var sources = dashboardData.sources || [];
    var ready = sources.filter(function (source) { return source.ok; }).length;
    $("sourceSummary").textContent = ready + "/" + sources.length + " sources · " +
      sources.reduce(function (sum, source) { return sum + (Number(source.rows) || 0); }, 0).toLocaleString("en-IN") + " source rows";
  }

  function showError(message) {
    $("dashboard").hidden = false;
    $("errorPanel").hidden = false;
    $("errorText").textContent = message || "Unknown connection error.";
  }

  async function loadDashboard() {
    if (isLoading) return;
    isLoading = true;
    $("refreshBtn").disabled = true;
    $("refreshBtn").textContent = "Loading…";
    try {
      var response = await fetch(config.SUPABASE_URL + "/functions/v1/" + (config.FUNCTION_NAME || "ppic-fms"), {
        method: "GET",
        headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY },
        cache: "no-store"
      });
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(body.error || ("Request failed (" + response.status + ")."));
      }

      dashboardData = {
        tasks: Array.isArray(body.tasks) ? body.tasks : [],
        specTasks: Array.isArray(body.specTasks) ? body.specTasks : [],
        sources: Array.isArray(body.sources) ? body.sources : [],
        warnings: Array.isArray(body.warnings) ? body.warnings : []
      };
      $("dashboard").hidden = false;
      $("errorPanel").hidden = true;
      renderFilters();
      updateSourceSummary();
      render();
      $("lastUpdated").textContent = "Updated " + new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      showError(error && error.message ? error.message : "Could not load live source data.");
    } finally {
      isLoading = false;
      $("refreshBtn").disabled = false;
      $("refreshBtn").textContent = "↻ Refresh";
    }
  }

  function setView(view) {
    activeView = view;
    $("navAll").classList.toggle("active", view === "all");
    $("navSpec").classList.toggle("active", view === "spec");
    $("navAging").classList.toggle("active", view === "aging");
    renderTable();
  }

  function bindEvents() {
    $("refreshBtn").addEventListener("click", loadDashboard);
    $("retryBtn").addEventListener("click", loadDashboard);
    $("navAll").addEventListener("click", function () { setView("all"); });
    $("navSpec").addEventListener("click", function () { setView("spec"); });
    $("navAging").addEventListener("click", function () { setView("aging"); });
    ["searchInput", "sourceFilter", "teamFilter", "stageFilter", "productionFilter", "dueFilter"].forEach(function (id) {
      $(id).addEventListener("input", renderTable);
      $(id).addEventListener("change", renderTable);
    });
    $("clearFilters").addEventListener("click", function () {
      ["searchInput", "sourceFilter", "teamFilter", "stageFilter", "productionFilter", "dueFilter"].forEach(function (id) {
        $(id).value = "";
      });
      renderTable();
    });
  }

  function init() {
    bindEvents();
    loadDashboard();
    window.setInterval(function () {
      if (document.visibilityState === "visible") loadDashboard();
    }, 300000);
  }

  init();
})();

