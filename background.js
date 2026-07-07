/*
  Cookie Domain Cleaner v2 - Firefox WebExtension

  Scope: count/delete cookies whose cookie DOMAIN contains the user-entered
  domain/search text. Default search text is "microsoft".

  Examples with default "microsoft":
    microsoft.com
    .microsoft.com
    login.microsoftonline.com
    microsoftedgeinsider.com

  It intentionally does not delete cookies merely because the cookie NAME or
  VALUE contains the search text on an unrelated domain.
*/

const DEFAULT_DOMAIN_TEXT = "microsoft";

function normalizeDomain(domain) {
  return String(domain || "")
    .replace(/^\./, "")
    .toLowerCase();
}

function normalizeDomainText(input) {
  let value = String(input || "")
    .trim()
    .toLowerCase();

  if (!value) return DEFAULT_DOMAIN_TEXT;

  // Let users paste things like "*.microsoft.com", ".microsoft.com", or
  // "https://login.microsoftonline.com/path" without breaking the match.
  value = value.replace(/^\*\./, "").replace(/^\./, "");

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      value = new URL(value).hostname;
    }
  } catch (error) {
    // Keep the raw normalized text if URL parsing fails.
  }

  value = value.split("/")[0].split(":")[0].replace(/^\*\./, "").replace(/^\./, "");
  return value || DEFAULT_DOMAIN_TEXT;
}

function isTargetCookie(cookie, domainText) {
  return normalizeDomain(cookie.domain).includes(domainText);
}

function cookieHost(cookie) {
  return normalizeDomain(cookie.domain);
}

function cookieUrl(cookie) {
  // cookies.remove() identifies a cookie by name + URL (+ store/partition info).
  // The URL must be associated with the cookie domain/path and must use https
  // when removing a Secure cookie.
  const scheme = cookie.secure ? "https" : "http";
  const host = cookieHost(cookie);
  const path = cookie.path && cookie.path.startsWith("/") ? cookie.path : "/";
  return `${scheme}://${host}${path}`;
}

function removalDetails(cookie) {
  const details = {
    url: cookieUrl(cookie),
    name: cookie.name,
    storeId: cookie.storeId
  };

  // Required when First-Party Isolation is enabled. Usually this is "", but
  // pass it through exactly when Firefox provides it.
  if (Object.prototype.hasOwnProperty.call(cookie, "firstPartyDomain")) {
    details.firstPartyDomain = cookie.firstPartyDomain;
  }

  // Required for cookies stored in partitioned storage.
  if (cookie.partitionKey !== undefined && cookie.partitionKey !== null) {
    details.partitionKey = cookie.partitionKey;
  }

  return details;
}

async function getAllCookieStoresSafe() {
  try {
    const stores = await browser.cookies.getAllCookieStores();
    return stores && stores.length ? stores : [{ id: undefined }];
  } catch (error) {
    return [{ id: undefined }];
  }
}

async function getCookiesForStore(storeId) {
  // Firefox cookie storage can be split by container/private store,
  // first-party domain, and partition key. Use the broadest supported query,
  // falling back for older Firefox versions.
  const base = {};
  if (storeId) base.storeId = storeId;

  const attempts = [
    { ...base, firstPartyDomain: null, partitionKey: {} },
    { ...base, partitionKey: {} },
    { ...base, firstPartyDomain: null },
    base
  ];

  let lastError;
  for (const details of attempts) {
    try {
      return await browser.cookies.getAll(details);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function dedupeCookies(cookies) {
  const seen = new Set();
  const out = [];

  for (const cookie of cookies) {
    const partition = cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : "";
    const firstParty = Object.prototype.hasOwnProperty.call(cookie, "firstPartyDomain") ? cookie.firstPartyDomain : "";
    const key = [cookie.storeId, firstParty, partition, cookie.domain, cookie.path, cookie.name].join("\u0000");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cookie);
    }
  }

  return out;
}

async function getTargetCookies(inputDomainText) {
  const domainText = normalizeDomainText(inputDomainText);
  const stores = await getAllCookieStoresSafe();
  const allCookies = [];

  for (const store of stores) {
    const storeCookies = await getCookiesForStore(store.id);
    allCookies.push(...storeCookies);
  }

  return {
    domainText,
    cookies: dedupeCookies(allCookies).filter(cookie => isTargetCookie(cookie, domainText))
  };
}

async function deleteTargetCookies(inputDomainText) {
  const { domainText, cookies } = await getTargetCookies(inputDomainText);
  const deleted = [];
  const failures = [];

  for (const cookie of cookies) {
    const details = removalDetails(cookie);

    try {
      const result = await browser.cookies.remove(details);
      if (result) {
        deleted.push({
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          storeId: cookie.storeId,
          firstPartyDomain: cookie.firstPartyDomain,
          partitionKey: cookie.partitionKey || null
        });
      } else {
        failures.push({
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          storeId: cookie.storeId,
          url: details.url,
          message: "Firefox returned null, so the cookie was not removed."
        });
      }
    } catch (error) {
      failures.push({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        storeId: cookie.storeId,
        url: details.url,
        message: error && error.message ? error.message : String(error)
      });
    }
  }

  return summarize(domainText, cookies, deleted, failures);
}

async function countTargetCookies(inputDomainText) {
  const { domainText, cookies } = await getTargetCookies(inputDomainText);
  return summarize(domainText, cookies, [], []);
}

function summarize(domainText, cookies, deleted, failures) {
  const byDomain = {};
  const byStore = {};

  for (const cookie of cookies) {
    const domain = normalizeDomain(cookie.domain);
    byDomain[domain] = (byDomain[domain] || 0) + 1;
    byStore[cookie.storeId || "default"] = (byStore[cookie.storeId || "default"] || 0) + 1;
  }

  return {
    domainText,
    matchRule: `cookie.domain contains "${domainText}"`,
    found: cookies.length,
    deleted: deleted.length,
    failures: failures.length,
    byDomain,
    byStore,
    deletedSamples: deleted.slice(0, 25),
    failureSamples: failures.slice(0, 25)
  };
}

browser.runtime.onMessage.addListener((message) => {
  if (!message || !message.action) return undefined;

  if (message.action === "countCookies") {
    return countTargetCookies(message.domainText);
  }

  if (message.action === "deleteCookies") {
    return deleteTargetCookies(message.domainText);
  }

  return undefined;
});
