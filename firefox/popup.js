const statusEl = document.getElementById("status");
const detailsEl = document.getElementById("details");
const domainTextEl = document.getElementById("domainText");
const countButton = document.getElementById("count");
const deleteButton = document.getElementById("delete");

function getDomainText() {
  return domainTextEl.value.trim() || "microsoft";
}

function renderResult(result, actionLabel) {
  statusEl.textContent = `${actionLabel}: matched "${result.domainText}"; found ${result.found}, deleted ${result.deleted}, failures ${result.failures}.`;

  const domainLines = Object.entries(result.byDomain || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([domain, count]) => `${domain}: ${count}`);

  const storeLines = Object.entries(result.byStore || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([store, count]) => `${store}: ${count}`);

  const failureLines = (result.failureSamples || []).map(f =>
    `FAILED ${f.domain}${f.path} :: ${f.name} :: ${f.message}`
  );

  detailsEl.textContent = [
    `Match rule: ${result.matchRule}`,
    "",
    domainLines.length ? "Cookies found by domain:" : "No matching cookies found.",
    ...domainLines,
    storeLines.length ? "\nCookies found by store:" : "",
    ...storeLines,
    failureLines.length ? "\nFailures:" : "",
    ...failureLines
  ].filter(Boolean).join("\n");
}

async function send(action, actionLabel) {
  const domainText = getDomainText();
  statusEl.textContent = `${actionLabel} for "${domainText}"...`;
  detailsEl.textContent = "";

  try {
    const result = await browser.runtime.sendMessage({ action, domainText });
    renderResult(result, actionLabel);
  } catch (error) {
    statusEl.textContent = "Error.";
    detailsEl.textContent = error && error.message ? error.message : String(error);
  }
}

countButton.addEventListener("click", () => {
  send("countCookies", "Count complete");
});

deleteButton.addEventListener("click", () => {
  send("deleteCookies", "Delete complete");
});

domainTextEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    send("countCookies", "Count complete");
  }
});
