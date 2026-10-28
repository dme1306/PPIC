(function () {
"use strict";
var config = window.FMS_CONFIG || {}, allRows = [], rawRecords = [];
var steps = [
{name:"Account Master",planned:"COL_S",status:"COL_U",person:"Account Master"},
{name:"Payment",planned:"COL_W",status:"COL_Y",person:"Payment"},
{name:"Legal",planned:"COL_AA",status:"COL_AC",person:"Legal"},
{name:"F&D Step 4",planned:"COL_AE",status:"COL_AH",person:"F&D"},
{name:"F&D Step 5",planned:"COL_AI",status:"COL_AK",person:"F&D"},
{name:"QA",planned:"COL_AN",status:"COL_AP",person:"QA"},
{name:"Sales Order Step 7",planned:"COL_AS",status:"COL_AU",person:"Sales Order"},
{name:"Creation Product Master",planned:"COL_AW",status:"COL_AY",person:"Product Master"},
{name:"F&D Step 9",planned:"COL_AZ",status:"COL_BB",person:"F&D"},
{name:"Sales Order Step 10",planned:"COL_BC",status:"COL_BE",person:"Sales Order"},
{name:"Sale Order Check",planned:"COL_BH",status:"COL_BJ",person:"Sales Order"},
{name:"Sale Order Update in Production",planned:"COL_BK",status:"COL_BM",person:"Production"},
{name:"Sale Order Confirmation",planned:"COL_BN",status:"COL_BP",person:"Sales Order"},
{name:"F&D Step 4a",planned:"COL_BY",status:"COL_BW",person:"F&D"},
{name:"F&D Step 5a",planned:"COL_CD",status:"COL_CB",person:"F&D"},
{name:"Lakshmi Step 8a",planned:"COL_CH",status:"COL_CF",person:"Lakshmi"},
{name:"F&D Step 9a",planned:"COL_CK",status:"COL_CI",person:"F&D"}
];
var $ = function(id){return document.getElementById(id);};
function columnName(index){var name="";while(index>0){var rem=(index-1)%26;name=String.fromCharCode(65+rem)+name;index=Math.floor((index-1)/26);}return name;}
function rowsFromValues(values){
 if(!Array.isArray(values)||!values.length)return [];
 var headers=values[0]||[];
 return values.slice(1).filter(function(r){return Array.isArray(r)&&r.some(function(v){return v!==""&&v!==null&&v!==undefined;});}).map(function(valuesRow){
  var obj={};
  valuesRow.forEach(function(value,i){obj["COL_"+columnName(i+1)]=value===null||value===undefined?"":value;if(headers[i])obj[String(headers[i]).trim()]=value===null||value===undefined?"":value;});
  return obj;
 });
}
function fmtDate(value){if(value===null||value===undefined||value==="")return "—";var d=parseDate(value);return !d?String(value):d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function parseDate(value){
 if(value===null||value===undefined||value==="")return null;
 if(typeof value==="number"&&value>20000&&value<100000){return new Date(Date.UTC(1899,11,30)+value*86400000);}
 var s=String(value).trim(), d=new Date(s);if(!isNaN(d.getTime()))return d;
 var m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m){var year=Number(m[3]);if(year<100)year+=2000;d=new Date(year,Number(m[2])-1,Number(m[1]));return isNaN(d.getTime())?null:d;}
 return null;
}
function calculateDelay(planned){var d=parseDate(planned);if(!d)return null;var now=new Date(),roundedDays=Math.round((now.getTime()-d.getTime())/86400000);if(roundedDays>0)return roundedDays*24-(24-d.getHours()-(24-now.getHours()));return roundedDays*24+(24-d.getHours()-(24-now.getHours()));}
function isPastPlannedDate(planned){var d=parseDate(planned);if(!d)return false;var now=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()<new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();}
function headerKey(value){return String(value===null||value===undefined?"":value).trim().toLowerCase().replace(/[^a-z0-9]/g,"");}
function val(row,key){if(Object.prototype.hasOwnProperty.call(row,key))return row[key]===null?"":row[key];var target=headerKey(key);var found=Object.keys(row).find(function(k){return headerKey(k)===target;});return found?((row[found]===null||row[found]===undefined)?"":row[found]):"";}
function isFilled(value){return value!==null&&value!==undefined&&String(value).trim()!==""&&value!==false;}
function makeQueue(records) {
  var queue = [];

  records.forEach(function (row) {
    // Rule 1: Exclude the order whenever column BS contains any non-blank value.
    // Only rows with an empty BS cell are eligible for workflow pending checks.
    if (isFilled(val(row, "COL_BS"))) return;

    // Rule 2: Exclude orders whose Order Status is exactly "Approved/Revised".
    var orderStatusForFilter = String(val(row, "Order Status") || val(row, "COL_L") || "").trim().toLowerCase().replace(/\\s+/g, "");
    if (orderStatusForFilter === "approved/revised") return;

    var pending = null;

    // Rule 2: inspect workflow steps from last to first.
    for (var i = steps.length - 1; i >= 0; i--) {
      var step = steps[i];
      var planned = val(row, step.planned);
      var status = val(row, step.status);
      var hasPlanned = isFilled(planned);
      var hasStatus = isFilled(status);

      // Both blank: this step is unused; continue to the previous step.
      if (!hasPlanned && !hasStatus) continue;

      // Planned and Status both filled: this workflow boundary is complete.
      // Do not show this order as pending and do not inspect earlier steps.
      if (hasPlanned && hasStatus) break;

      // Planned filled, Status blank: this is the pending step to display.
      if (hasPlanned && !hasStatus) {
        pending = { step: step, planned: planned };
        break;
      }

      // Status filled but Planned blank: ignore this pair and continue backward.
    }

    // No pending step found: never include this order in the dashboard.
    if (!pending) return;

    var delay = calculateDelay(pending.planned);
    queue.push({
      timestamp: val(row, "Timestamp") || val(row, "COL_A"),
      ref: val(row, "Ref No.") || val(row, "COL_B"),
      company: val(row, "Company Name") || val(row, "COL_C"),
      product: val(row, "Product Name") || val(row, "ProductName") || val(row, "COL_D"),
      orderStatus: val(row, "Order Status") || val(row, "COL_E"),
      remarks: val(row, "Remarks") || val(row, "COL_BR"),
      person: val(row, "Person Name") || val(row, "COL_BU") || pending.step.person,
      planned: pending.planned,
      step: pending.step.name,
      delayHours: delay === null ? 0 : delay,
      delayed: isPastPlannedDate(pending.planned),
      raw: row
    });
  });

  return queue;
}
function esc(value){return String(value===undefined||value===null?"":value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function render(){var query=$("searchInput").value.trim().toLowerCase(),person=$("personFilter").value,step=$("stepFilter").value,state=$("statusFilter").value;var rows=allRows.filter(function(r){var hay=[r.ref,r.company,r.product,r.remarks,r.person,r.step,r.orderStatus].join(" ").toLowerCase();return(!query||hay.indexOf(query)!==-1)&&(!person||r.person===person)&&(!step||r.step===step)&&(!state||(state==="delayed"?r.delayed:!r.delayed));});$("visibleCount").textContent=rows.length+" records";$("tableSummary").textContent="Showing "+rows.length+" of "+allRows.length+" pending orders";$("tableBody").innerHTML=rows.length?rows.map(function(r){return "<tr><td>"+esc(fmtDate(r.timestamp))+"</td><td><strong>"+esc(r.ref||"—")+"</strong></td><td class='company' title='"+esc(r.company)+"'>"+esc(r.company||"—")+"</td><td title='"+esc(r.product)+"'>"+esc(r.product||"—")+"</td><td>"+esc(r.orderStatus||"—")+"</td><td class='remarks' title='"+esc(r.remarks)+"'>"+esc(r.remarks||"—")+"</td><td>"+esc(r.person||"Unassigned")+"</td><td>"+esc(fmtDate(r.planned))+"</td><td>"+esc(r.step)+"</td><td class='delay "+(r.delayed?"overdue":"")+"'>"+esc(r.delayHours+" h")+"</td></tr>";}).join(""):"<tr><td colspan='10' class='empty'>No pending records match these filters.</td></tr>";}
function fillFilters(){var people=Array.from(new Set(allRows.map(function(r){return r.person;}).filter(Boolean))).sort(),names=Array.from(new Set(allRows.map(function(r){return r.step;})));$("personFilter").innerHTML="<option value=''>All people</option>"+people.map(function(p){return "<option>"+esc(p)+"</option>";}).join("");$("stepFilter").innerHTML="<option value=''>All workflow steps</option>"+names.map(function(n){return "<option>"+esc(n)+"</option>";}).join("");}
function updateMetrics(records,queue){$("totalOrders").textContent=records.length.toLocaleString("en-IN");$("pendingTasks").textContent=queue.length.toLocaleString("en-IN");$("delayedTasks").textContent=queue.filter(function(r){return r.delayed;}).length.toLocaleString("en-IN");$("peopleCount").textContent=new Set(queue.map(function(r){return r.person;}).filter(Boolean)).size.toLocaleString("en-IN");$("rowCount").textContent="· "+records.length.toLocaleString("en-IN")+" orders";}
function showError(message){$("dashboard").hidden=true;$("errorPanel").hidden=false;$("errorText").textContent=message;}
function loadData(){$("refreshBtn").disabled=true;$("refreshBtn").textContent="Loading…";fetch(config.SUPABASE_URL+"/functions/v1/"+(config.FUNCTION_NAME||"ppic-fms"),{method:"GET",headers:{"apikey":config.SUPABASE_PUBLISHABLE_KEY},cache:"no-store"}).then(function(response){if(!response.ok)return response.json().catch(function(){return {};}).then(function(body){throw new Error(body.error||("Request failed ("+response.status+")"));});return response.json();}).then(function(body){var values=Array.isArray(body.values)?body.values:[];rawRecords=rowsFromValues(values);allRows=makeQueue(rawRecords);fillFilters();updateMetrics(rawRecords,allRows);$("errorPanel").hidden=true;$("dashboard").hidden=false;$("lastUpdated").textContent="Updated "+new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});render();}).catch(function(error){showError(error.message||"Unknown connection error");}).finally(function(){$("refreshBtn").disabled=false;$("refreshBtn").textContent="↻ Refresh";});}
function init(){loadData();}
["searchInput","personFilter","stepFilter","statusFilter"].forEach(function(id){$(id).addEventListener("input",render);$(id).addEventListener("change",render);});$("refreshBtn").addEventListener("click",loadData);$("retryBtn").addEventListener("click",loadData);$("clearFilters").addEventListener("click",function(){$("searchInput").value="";$("personFilter").value="";$("stepFilter").value="";$("statusFilter").value="";render();});init();setInterval(function(){if(!$("dashboard").hidden)render();},60000);
})();