const APP_ORIGIN = "https://dme1306.github.io";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemBytes(pem: string) {
  return Uint8Array.from(
    atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")),
    (character) => character.charCodeAt(0)
  );
}

async function googleAccessToken(serviceAccount: { client_email: string; private_key: string; token_uri?: string }) {
  const now = Math.floor(Date.now() / 1000);
  const audience = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const unsigned = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    base64Url(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: audience,
      iat: now,
      exp: now + 3600
    }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))
  );
  const response = await fetch(audience, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + base64Url(signature)
    })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error("Google authentication failed");
  return body.access_token as string;
}

async function authorize(request: Request) {
  const bearer = request.headers.get("authorization") || "";
  const tokenMatch = bearer.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return { ok: false as const, status: 401, message: "Sign in to view this dashboard." };

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const allowedEmails = (Deno.env.get("ALLOWED_EMAILS") || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!projectUrl || !publishableKey || !allowedEmails.length) {
    return { ok: false as const, status: 503, message: "Dashboard access is not configured." };
  }

  const response = await fetch(projectUrl.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: publishableKey, authorization: "Bearer " + tokenMatch[1] }
  });
  if (!response.ok) return { ok: false as const, status: 401, message: "Your sign-in session is invalid or expired." };
  const user = await response.json();
  const email = String(user.email || "").trim().toLowerCase();
  if (!email || !allowedEmails.includes(email)) {
    return { ok: false as const, status: 403, message: "Your account is not on the PPIC dashboard access list." };
  }
  return { ok: true as const, email };
}

type Source = { name: string; id: string; profile: string; skipDrug: boolean };
type Tracker = { name: string; id: string };

function readJsonArraySetting<T>(name: string): T[] {
  try {
    const value = JSON.parse(Deno.env.get(name) || "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

const SOURCES = readJsonArraySetting<Source>("PPIC_SOURCES_JSON");
const TRACKERS = readJsonArraySetting<Tracker>("PPIC_TRACKERS_JSON");
const PPIC_REMARKS_SPREADSHEET_ID = Deno.env.get("PPIC_REMARKS_SPREADSHEET_ID") || "";

type Stage = {
  id: string;
  step: string;
  name: string;
  team: string;
  owner: string;
  signal: string;
  complete: string;
};

function makeStage(id: string, step: string, name: string, team: string, owner: string, signal: string, complete: string): Stage {
  return { id, step, name, team, owner, signal, complete };
}

const CORE_STAGES = [
  makeStage("s1", "1", "Account Master", "Account Master", "Account Master", "S", "U"),
  makeStage("s2", "2", "Payment", "Payment", "Payment", "W", "Y"),
  makeStage("s3", "3", "Legal", "Legal", "Legal", "AA", "AC"),
  makeStage("s4", "4", "F&D", "F&D", "F&D", "AE", "AH"),
  makeStage("s5", "5", "F&D", "F&D", "F&D", "AI", "AK"),
  makeStage("s6", "6", "QA / Product Specification", "Quality Assurance", "QA", "AN", "AP"),
  makeStage("s7", "7", "Sales Order", "Sales Order", "Sales Order", "AS", "AU"),
  makeStage("s8", "8", "Product Master Creation", "Product Master", "Product Master", "AW", "AY"),
  makeStage("s9", "9", "F&D", "F&D", "F&D", "AZ", "BB"),
  makeStage("s10", "10", "Sales Order", "Sales Order", "Sales Order", "BC", "BE"),
  makeStage("s11", "11", "Sale Order Check", "Sales Order Check", "Sales Order Check", "BH", "BJ"),
  makeStage("s12", "12", "Sale Order Update in Production", "Sales Order", "Sales Order", "BK", "BM"),
  makeStage("s13", "13", "Sale Order Confirmation", "Sales Order Confirmation", "Sales Order", "BN", "BP"),
  makeStage("s4a", "4a", "F&D", "F&D", "F&D", "BY", "BW"),
  makeStage("s5a", "5a", "F&D", "F&D", "F&D", "CD", "CB"),
  makeStage("s8a", "8a", "Product Master Recheck", "Product Master", "Lakshmi", "CH", "CF"),
  makeStage("s9a", "9a", "F&D", "F&D", "F&D", "CK", "CI")
];

const REGIONAL_STAGES = [
  makeStage("s1", "1", "Dispatch", "Dispatch", "Dispatch", "T", "V"),
  makeStage("s2", "2", "Payment", "Payment", "Rohit", "X", "Z"),
  makeStage("s3", "3", "Legal", "Legal", "Legal", "AB", "AD"),
  makeStage("s4", "4", "F&D", "F&D", "F&D", "AF", "AI"),
  makeStage("s5", "5", "F&D", "F&D", "F&D", "AJ", "AL"),
  makeStage("s6", "6", "QA / Product Specification", "Quality Assurance", "QA", "AO", "AQ"),
  makeStage("s7", "7", "Sales Order", "Sales Order", "Lakshmi", "AT", "AV"),
  makeStage("s8", "8", "Sales Order", "Sales Order", "Lakshmi", "AX", "AZ"),
  makeStage("s9", "9", "F&D", "F&D", "F&D", "BA", "BC"),
  makeStage("s10", "10", "Sales Order", "Sales Order", "Lakshmi", "BD", "BF"),
  makeStage("s11", "11", "Sale Order Check", "Sales Order Check", "Kanan", "BI", "BK"),
  makeStage("s12", "12", "Sale Order Update in Production", "Sales Order", "Lakshmi", "BL", "BN"),
  makeStage("s13", "13", "Sale Order Confirmation", "Sales Order Confirmation", "Nirmala", "BO", "BQ"),
  makeStage("s4a", "4a", "F&D", "F&D", "F&D", "BZ", "BX"),
  makeStage("s5a", "5a", "F&D", "F&D", "F&D", "CE", "CC"),
  makeStage("s8a", "8a", "Product Master Recheck", "Product Master", "Lakshmi", "CI", "CG"),
  makeStage("s9a", "9a", "F&D", "F&D", "F&D", "CL", "CJ")
];

const CHIMAK_STAGES = REGIONAL_STAGES.filter((stage) => stage.id !== "s9");

const STAGE_GROUPS = [
  { id: "primary", stageIds: null as string[] | null },
  { id: "payment", stageIds: ["s2"] },
  { id: "legal", stageIds: ["s3"] },
  { id: "fnd", stageIds: ["s4", "s5", "s9", "s4a", "s5a", "s9a"] },
  { id: "sales", stageIds: ["s7", "s8", "s10", "s12", "s8a"] },
  { id: "check", stageIds: ["s11"] },
  { id: "confirmation", stageIds: ["s13"] }
];

function stagesFor(profile: string) {
  if (profile === "regional") return REGIONAL_STAGES;
  if (profile === "chimak") return CHIMAK_STAGES;
  return CORE_STAGES;
}

function columnNumber(column: string) {
  let number = 0;
  for (const character of column.toUpperCase()) {
    number = number * 26 + character.charCodeAt(0) - 64;
  }
  return number;
}

function sourceColumnIndex(column: string) {
  const centralColumn = columnNumber(column);
  const sourceColumn = centralColumn > 72 ? centralColumn - 1 : centralColumn;
  return sourceColumn - 1;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeader(headers: unknown[], choices: string[]) {
  const targets = choices.map(normalizeHeader);
  return headers.findIndex((header) => targets.includes(normalizeHeader(header)));
}

function cellValue(row: unknown[], index: number) {
  return index >= 0 && index < row.length ? row[index] : "";
}

function isErrorValue(value: unknown) {
  return typeof value === "string" && /^#(REF!|VALUE!|N\/A|DIV\/0!|NAME\?|NUM!|NULL!)/i.test(value.trim());
}

function isFilled(value: unknown) {
  if (value === null || value === undefined || value === false || isErrorValue(value)) return false;
  return String(value).trim() !== "";
}

function parseSheetDate(value: unknown): Date | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (typeof value === "number" && value > 20000 && value < 100000) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000 - 330 * 60000);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0)) - 330 * 60000);
  }
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] || 0), Number(dmy[5] || 0), Number(dmy[6] || 0)) - 330 * 60000);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function indiaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const output: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") output[part.type] = Number(part.value);
  return output;
}

function dayOrdinal(date: Date) {
  const parts = indiaParts(date);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function orderAgeDays(timestamp: unknown, now: Date) {
  const date = parseSheetDate(timestamp);
  if (!date) return null;
  return Math.max(0, dayOrdinal(now) - dayOrdinal(date));
}

function formulaDelayHours(planned: unknown, now: Date) {
  const date = parseSheetDate(planned);
  if (!date) return null;
  const plannedParts = indiaParts(date);
  const nowParts = indiaParts(now);
  const roundedDays = Math.round((now.getTime() - date.getTime()) / 86400000);
  if (roundedDays > 0) {
    return roundedDays * 24 - (24 - plannedParts.hour - (24 - nowParts.hour));
  }
  return roundedDays * 24 + (24 - plannedParts.hour - (24 - nowParts.hour));
}

function isPastPlannedDay(planned: unknown, now: Date) {
  const date = parseSheetDate(planned);
  return date ? dayOrdinal(date) < dayOrdinal(now) : false;
}

function clean(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

async function readValues(token: string, spreadsheetId: string, range: string) {
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" +
    encodeURIComponent(spreadsheetId) + "/values/" + encodeURIComponent(range) +
    "?valueRenderOption=FORMATTED_VALUE";
  const response = await fetch(url, { headers: { authorization: "Bearer " + token } });
  const body = await response.json();
  if (!response.ok) throw new Error("Google Sheets access failed");
  return Array.isArray(body.values) ? body.values as unknown[][] : [];
}

function trackerMap(values: unknown[][]) {
  const output = new Map<string, { salesDate: unknown; productionFlag: unknown }>();
  for (const row of values.slice(1)) {
    const ref = clean(row[0]);
    if (!ref || output.has(ref)) continue;
    output.set(ref, { salesDate: row[5] ?? "", productionFlag: row[19] ?? "" });
  }
  return output;
}

function remarksMap(values: unknown[][]) {
  const output = new Map<string, unknown>();
  for (const row of values.slice(1)) {
    const timestamp = clean(row[0]);
    const ref = clean(row[1]);
    const product = clean(row[3]);
    const remark = row[13] ?? "";
    if (!timestamp || !ref || !product || !isFilled(remark)) continue;
    output.set([timestamp, ref, product].join("|"), remark);
  }
  return output;
}

function ppNotesFor(map: Map<string, unknown>, timestamp: unknown, ref: unknown, product: unknown) {
  return map.get([clean(timestamp), clean(ref), clean(product)].join("|")) ?? "";
}

function pending(stage: Stage, row: unknown[]) {
  const trigger = cellValue(row, sourceColumnIndex(stage.signal));
  const completion = cellValue(row, sourceColumnIndex(stage.complete));
  return isFilled(trigger) && !isFilled(completion);
}

function makeTask(
  source: Source,
  stage: Stage,
  row: unknown[],
  headers: unknown[],
  sourceRow: number,
  tracker: { salesDate?: unknown; productionFlag?: unknown } | undefined,
  ppicRemark: unknown,
  now: Date
) {
  const timestampIndex = findHeader(headers, ["Timestamp"]);
  const refIndex = findHeader(headers, ["Ref No.", "Ref No", "Reference No"]);
  const companyIndex = findHeader(headers, ["Company Name", "Party Name"]);
  const productIndex = findHeader(headers, ["ProductName", "Product Name"]);
  const orderStatusIndex = findHeader(headers, ["Order Status"]);
  const sourceStatusIndex = findHeader(headers, ["Status"]);
  const remarksIndex = findHeader(headers, ["Remarks"]);
  const timestamp = cellValue(row, timestampIndex);
  const ref = clean(cellValue(row, refIndex));
  const planned = cellValue(row, sourceColumnIndex(stage.signal));
  const calculatedOrderAge = orderAgeDays(timestamp, now);
  return {
    source: source.name,
    sourceRow,
    sourceUrl: "https://docs.google.com/spreadsheets/d/" + source.id + "/edit#range=Data!A" + sourceRow,
    ref,
    timestamp,
    company: cellValue(row, companyIndex),
    product: cellValue(row, productIndex),
    orderStatus: cellValue(row, orderStatusIndex),
    status: cellValue(row, sourceStatusIndex),
    remarks: cellValue(row, remarksIndex),
    ppicRemark,
    stepId: stage.id,
    step: stage.name + " · Step " + stage.step,
    team: stage.team,
    owner: stage.owner,
    planned,
    stepAgeHours: formulaDelayHours(planned, now),
    overdue: isPastPlannedDay(planned, now),
    orderAgeDays: calculatedOrderAge,
    customerSalesDate: tracker?.salesDate ?? "",
    productionFlag: clean(tracker?.productionFlag) || "Unknown"
  };
}

async function buildDashboard(token: string) {
  const sourceResults = await Promise.all(SOURCES.map(async (source) => {
    try {
      const values = await readValues(token, source.id, "Data!A1:DF");
      return { source, values, error: "" };
    } catch {
      return { source, values: [] as unknown[][], error: "Could not read this source sheet." };
    }
  }));

  const trackerResults = await Promise.all(TRACKERS.map(async (tracker) => {
    try {
      const values = await readValues(token, tracker.id, "'Dashboard With Sales Order'!A:T");
      return { tracker, values, error: "" };
    } catch {
      return { tracker, values: [] as unknown[][], error: "Could not read the customer tracking sheet." };
    }
  }));

  let ppicRemarks: unknown[][] = [];
  let remarksError = "";
  try {
    ppicRemarks = await readValues(token, PPIC_REMARKS_SPREADSHEET_ID, "'PPIC Remarks'!B:O");
  } catch {
    remarksError = "PPIC remarks could not be read.";
  }

  const trackersByBrand = new Map<string, Map<string, { salesDate: unknown; productionFlag: unknown }>>();
  for (const result of trackerResults) {
    if (!result.error) trackersByBrand.set(result.tracker.name, trackerMap(result.values));
  }
  const remarkLookup = remarksMap(ppicRemarks);
  const now = new Date();
  const tasks: ReturnType<typeof makeTask>[] = [];
  const specTasks: ReturnType<typeof makeTask>[] = [];
  const taskKeys = new Set<string>();
  const sourceStatus = sourceResults.map((result) => {
    const rowCount = Math.max(0, result.values.length - 1);
    if (result.error) return { name: result.source.name, ok: false, rows: 0, formulaErrors: 0 };
    const headers = result.values[0] || [];
    const profile = stagesFor(result.source.profile);
    let formulaErrors = 0;
    for (const row of result.values.slice(1)) {
      for (const stage of profile) {
        if (isErrorValue(cellValue(row, sourceColumnIndex(stage.signal)))) formulaErrors++;
        if (isErrorValue(cellValue(row, sourceColumnIndex(stage.complete)))) formulaErrors++;
      }
    }
    return { name: result.source.name, ok: true, rows: rowCount, formulaErrors };
  });

  for (const result of sourceResults) {
    if (result.error || result.values.length < 2) continue;
    const headers = result.values[0] || [];
    const refIndex = findHeader(headers, ["Ref No.", "Ref No", "Reference No"]);
    const statusIndex = findHeader(headers, ["Status"]);
    const orderStatusIndex = findHeader(headers, ["Order Status"]);
    const categoryIndex = findHeader(headers, ["Category"]);
    const timestampIndex = findHeader(headers, ["Timestamp"]);
    const productIndex = findHeader(headers, ["ProductName", "Product Name"]);
    const profile = stagesFor(result.source.profile);
    const trackers = trackersByBrand.get(result.source.name);
    for (let rowIndex = 1; rowIndex < result.values.length; rowIndex++) {
      const row = result.values[rowIndex];
      const ref = clean(cellValue(row, refIndex));
      if (!ref) continue;
      const status = clean(cellValue(row, statusIndex)).toLowerCase();
      const orderStatus = clean(cellValue(row, orderStatusIndex)).toLowerCase();
      if (status === "cancel" || status === "cancelled" || orderStatus === "cancel" || orderStatus === "cancelled") continue;
      if (result.source.skipDrug && clean(cellValue(row, categoryIndex)).toLowerCase() === "drug") continue;

      const tracker = trackers?.get(ref);
      const timestamp = cellValue(row, timestampIndex);
      const product = cellValue(row, productIndex);
      const ppicRemark = ppNotesFor(remarkLookup, timestamp, ref, product);
      const rowNumber = rowIndex + 1;

      const qaStage = profile.find((stage) => stage.id === "s6");
      if (qaStage && pending(qaStage, row)) {
        specTasks.push(makeTask(result.source, qaStage, row, headers, rowNumber, tracker, ppicRemark, now));
      }

      const pendingStages = profile.filter((stage) => pending(stage, row));
      for (const group of STAGE_GROUPS) {
        const candidates = group.stageIds
          ? pendingStages.filter((stage) => group.stageIds!.includes(stage.id))
          : pendingStages;
        const selected = candidates[0];
        if (!selected) continue;
        const taskKey = [result.source.name, rowNumber, selected.id].join("|");
        if (!taskKeys.has(taskKey)) {
          taskKeys.add(taskKey);
          tasks.push(makeTask(result.source, selected, row, headers, rowNumber, tracker, ppicRemark, now));
        }
      }
    }
  }

  const sortRows = (rows: ReturnType<typeof makeTask>[]) => rows.sort((a, b) =>
    (b.orderAgeDays ?? -1) - (a.orderAgeDays ?? -1) ||
    (b.stepAgeHours ?? -1) - (a.stepAgeHours ?? -1)
  );
  sortRows(tasks);
  sortRows(specTasks);

  const warnings: string[] = [];
  for (const source of sourceStatus) if (!source.ok) warnings.push(source.name + " source data is unavailable.");
  for (const source of sourceStatus) {
    if (source.ok && source.formulaErrors > 0) {
      warnings.push(source.name + " has " + source.formulaErrors + " formula error cells in workflow fields.");
    }
  }
  for (const result of trackerResults) if (result.error) warnings.push(result.tracker.name + " production/customer details are unavailable.");
  if (remarksError) warnings.push(remarksError);

  return {
    tasks,
    specTasks,
    sources: sourceStatus,
    trackerSources: trackerResults.map((result) => ({ name: result.tracker.name, ok: !result.error })),
    dataComplete: sourceStatus.every((source) => source.ok),
    warnings,
    updatedAt: new Date().toISOString()
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "GET") return reply({ error: "Method not allowed." }, 405);

  const access = await authorize(request);
  if (!access.ok) return reply({ error: access.message }, access.status);

  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) return reply({ error: "Google Sheets access is not configured." }, 503);
  if (!SOURCES.length || !TRACKERS.length || !PPIC_REMARKS_SPREADSHEET_ID) {
    return reply({ error: "Source sheet configuration is incomplete." }, 503);
  }

  try {
    const googleToken = await googleAccessToken(JSON.parse(serviceAccountJson));
    const result = await buildDashboard(googleToken);
    if (!result.sources.some((source) => source.ok)) {
      return reply({ error: "None of the source sheets could be read.", warnings: result.warnings }, 502);
    }
    return reply(result);
  } catch (error) {
    console.error("PPIC dashboard request failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Could not load the live source sheets. Check backend access and try again." }, 502);
  }
});

