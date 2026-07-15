/**
 * Contact discovery — never invent emails; inferred patterns require confirmation.
 */
import { randomUUID } from "node:crypto";

export const CONTACT_TYPES = Object.freeze({
  PARTNERSHIP_EMAIL: "partnership_email",
  CREATOR_PROGRAM: "creator_program_submission",
  AFFILIATE: "affiliate_application",
  CONTACT_FORM: "general_contact_form",
  PUBLIC_EMPLOYEE_EMAIL: "public_employee_email",
  INFERRED_PATTERN: "inferred_email_pattern",
  GMAIL_EXISTING: "gmail_existing",
  USER_PROVIDED: "user_provided"
});

const PARTNERSHIP_LOCAL = /^(partners?|partnerships?|collab|collaborations?|creators?|creator|influencer|ugc|hello|hi|team|marketing)$/i;

export function assessContactUsability({ contactType, verificationState, inferred, source, value = "" }) {
  if (inferred || contactType === CONTACT_TYPES.INFERRED_PATTERN) {
    return { mayUseForOutreach: false, reason: "Inferred contacts require explicit user confirmation." };
  }
  if (verificationState === "bounced" || verificationState === "revoked") {
    return { mayUseForOutreach: false, reason: "Contact is not deliverable." };
  }
  const local = String(value || "").split("@")[0] || "";
  if (/^(press|pr|media|news|journalist|editorial)$/i.test(local)) {
    return { mayUseForOutreach: false, reason: "Press/media mailbox — evidence only, not a creator partnership contact." };
  }
  if ([CONTACT_TYPES.PARTNERSHIP_EMAIL, CONTACT_TYPES.GMAIL_EXISTING, CONTACT_TYPES.USER_PROVIDED].includes(contactType)) {
    return { mayUseForOutreach: true, reason: "Public or user-owned contact path." };
  }
  if (contactType === CONTACT_TYPES.PUBLIC_EMPLOYEE_EMAIL && source === "mailto") {
    if (/^(support|help|noreply|no-reply|donotreply|billing|careers|jobs|privacy|legal)$/i.test(local)) {
      return { mayUseForOutreach: false, reason: "Public support/ops mailbox — not a creator outreach path." };
    }
    if (
      /^(partners?|partnerships?|collab|collaborations?|creators?|creator|influencer|ugc|hello|hi|team|marketing)$/i.test(local) ||
      /partner|collab|creator|influencer|ugc/i.test(local)
    ) {
      return { mayUseForOutreach: true, reason: "Publicly listed outreach-style mailto address." };
    }
    return { mayUseForOutreach: false, reason: "Public employee email needs confirmation before outreach." };
  }
  if ([CONTACT_TYPES.CREATOR_PROGRAM, CONTACT_TYPES.AFFILIATE, CONTACT_TYPES.CONTACT_FORM].includes(contactType)) {
    return { mayUseForOutreach: false, reason: "Application/form path — useful for strategy, not direct email send." };
  }
  return { mayUseForOutreach: false, reason: "Contact path is informational until confirmed." };
}

export function isPartnershipEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  return PARTNERSHIP_LOCAL.test(local) || /partner|collab|creator|influencer|ugc/i.test(local);
}

export function resolveAbsoluteUrl(baseUrl, href) {
  try {
    return new URL(String(href || ""), baseUrl).toString();
  } catch {
    return null;
  }
}

export function extractContactsFromHtml(html, pageUrl) {
  const text = String(html || "");
  const mailto = [...text.matchAll(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase());
  const visibleEmails = [...text.matchAll(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((email) => !/(example\.com|domain\.com|email\.com|sentry\.io|wixpress|cloudflare|schema\.org)$/i.test(email));
  const emails = [...new Set([...mailto, ...visibleEmails])].slice(0, 12);
  const links = [...text.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const absoluteLinks = links.map((href) => resolveAbsoluteUrl(pageUrl, href)).filter(Boolean);
  const creatorProgramUrl =
    absoluteLinks.find((href) => /creator|ambassador|influencer|ugc|collab/i.test(href)) || null;
  const affiliateUrl = absoluteLinks.find((href) => /affiliate/i.test(href)) || null;
  const contactPageUrl = absoluteLinks.find((href) => /contact|partnership|work-with|workwith/i.test(href)) || null;
  const formHint = /<form[\s\S]*?(contact|partner|creator|collab)[\s\S]*?<\/form>/i.test(text);
  return {
    emails,
    partnershipEmails: emails.filter(isPartnershipEmail),
    creatorProgramUrl,
    affiliateUrl,
    contactPageUrl,
    hasContactForm: formHint,
    pageUrl
  };
}

async function fetchText(fetchImpl, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: "text/html,application/xhtml+xml" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function upsertBrandContact(store, input) {
  const now = new Date().toISOString();
  const value = String(input.value || "").trim().toLowerCase();
  if (!value) throw new Error("Contact value is required.");
  const looksEmail = value.includes("@") || String(input.contactType || "").includes("email");
  if (looksEmail && !/^https?:\/\//i.test(value)) {
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
      throw new Error("Contact email format is invalid.");
    }
  }
  const inferred = Boolean(input.inferred) || input.contactType === CONTACT_TYPES.INFERRED_PATTERN;
  const usability = assessContactUsability({
    contactType: input.contactType,
    verificationState: input.verificationState || "unverified",
    inferred,
    source: input.source,
    value
  });
  const existing = await store.queryOne(
    `SELECT id FROM mara_brand_contacts
     WHERE user_id = ? AND worker_id = ? AND public_brand_id = ? AND contact_type = ? AND value = ?`,
    input.userId,
    input.workerId,
    input.publicBrandId,
    input.contactType,
    value
  );
  const mayUse = usability.mayUseForOutreach || input.forceAllow ? 1 : 0;
  if (existing?.id) {
    await store.execute(
      `UPDATE mara_brand_contacts
       SET source = ?, source_url = ?, verification_state = ?, confidence = ?, may_use_for_outreach = ?,
           inferred = ?, metadata_json = ?, retrieved_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      input.source,
      input.sourceUrl || null,
      input.verificationState || "unverified",
      Number(input.confidence ?? 50),
      mayUse,
      inferred ? 1 : 0,
      JSON.stringify({ ...(input.metadata || {}), usabilityReason: usability.reason }),
      now,
      now,
      existing.id,
      input.userId
    );
    return existing.id;
  }
  const id = randomUUID();
  await store.execute(
    `INSERT INTO mara_brand_contacts
      (id, user_id, worker_id, public_brand_id, contact_type, value, source, source_url, verification_state,
       confidence, may_use_for_outreach, inferred, bounce_state, metadata_json, retrieved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.workerId,
    input.publicBrandId,
    input.contactType,
    value,
    input.source,
    input.sourceUrl || null,
    input.verificationState || "unverified",
    Number(input.confidence ?? 50),
    mayUse,
    inferred ? 1 : 0,
    JSON.stringify({ ...(input.metadata || {}), usabilityReason: usability.reason }),
    now,
    now,
    now
  );
  return id;
}

export async function confirmInferredContact(store, { userId, workerId, contactId }) {
  const row = await store.queryOne(
    `SELECT * FROM mara_brand_contacts WHERE id = ? AND user_id = ? AND worker_id = ?`,
    contactId,
    userId,
    workerId
  );
  if (!row) throw new Error("Contact not found.");
  const now = new Date().toISOString();
  const meta = typeof row.metadata_json === "object" ? row.metadata_json : JSON.parse(row.metadata_json || "{}");
  await store.execute(
    `UPDATE mara_brand_contacts
     SET inferred = 0, may_use_for_outreach = 1, verification_state = 'user_confirmed', updated_at = ?,
         metadata_json = ?
     WHERE id = ?`,
    now,
    JSON.stringify({ ...meta, confirmedAt: now }),
    contactId
  );
  return contactId;
}

export async function listBrandContacts(store, userId, workerId, publicBrandId) {
  return store.query(
    `SELECT id, contact_type AS "contactType", value, source, source_url AS "sourceUrl",
            verification_state AS "verificationState", confidence,
            may_use_for_outreach AS "mayUseForOutreach", inferred, bounce_state AS "bounceState",
            metadata_json AS "metadataJson", retrieved_at AS "retrievedAt",
            public_brand_id AS "publicBrandId"
     FROM mara_brand_contacts
     WHERE user_id = ? AND worker_id = ? AND public_brand_id = ?
     ORDER BY may_use_for_outreach DESC, confidence DESC, updated_at DESC`,
    userId,
    workerId,
    publicBrandId
  );
}

export async function findBestOutreachContact(store, userId, workerId, publicBrandId) {
  const rows = await listBrandContacts(store, userId, workerId, publicBrandId);
  return (
    rows.find((row) => Number(row.mayUseForOutreach) === 1 && String(row.value).includes("@")) ||
    rows.find((row) => Number(row.mayUseForOutreach) === 1) ||
    null
  );
}

export async function findOutreachContactByBrandName(store, userId, workerId, brandName) {
  const needle = String(brandName || "").trim().toLowerCase();
  if (!needle) return null;
  const rows = await store.query(
    `SELECT c.id, c.contact_type AS "contactType", c.value, c.source, c.source_url AS "sourceUrl",
            c.may_use_for_outreach AS "mayUseForOutreach", c.confidence, c.public_brand_id AS "publicBrandId",
            b.brand_name AS "brandName"
     FROM mara_brand_contacts c
     INNER JOIN mara_public_brands b ON b.id = c.public_brand_id
     WHERE c.user_id = ? AND c.worker_id = ? AND c.may_use_for_outreach = 1
       AND lower(b.brand_name) = ?
     ORDER BY c.confidence DESC, c.updated_at DESC
     LIMIT 5`,
    userId,
    workerId,
    needle
  );
  return rows.find((row) => String(row.value).includes("@")) || rows[0] || null;
}

/** Record publicly observed mailto addresses from research — never invent. */
export async function ingestObservedEmails(store, { userId, workerId, publicBrandId, emails = [], sourceUrl, partnershipEmails = [] }) {
  const saved = [];
  const partnershipSet = new Set(partnershipEmails.map((value) => String(value).toLowerCase()));
  for (const email of emails) {
    const normalized = String(email).toLowerCase();
    const isPartnership = partnershipSet.has(normalized) || isPartnershipEmail(normalized);
    const id = await upsertBrandContact(store, {
      userId,
      workerId,
      publicBrandId,
      contactType: isPartnership ? CONTACT_TYPES.PARTNERSHIP_EMAIL : CONTACT_TYPES.PUBLIC_EMPLOYEE_EMAIL,
      value: normalized,
      source: "mailto",
      sourceUrl,
      confidence: isPartnership ? 78 : 55,
      verificationState: "unverified"
    });
    saved.push(id);
  }
  return saved;
}

export async function ingestGmailContact(store, { userId, workerId, publicBrandId, email, threadId }) {
  if (!email) return null;
  return upsertBrandContact(store, {
    userId,
    workerId,
    publicBrandId,
    contactType: CONTACT_TYPES.GMAIL_EXISTING,
    value: email,
    source: "gmail",
    sourceUrl: threadId ? `gmail-thread:${threadId}` : null,
    confidence: 90,
    verificationState: "observed_in_inbox"
  });
}

export async function ingestProgramOrFormPath(store, { userId, workerId, publicBrandId, url, kind, sourceUrl }) {
  if (!url) return null;
  const contactType =
    kind === "affiliate"
      ? CONTACT_TYPES.AFFILIATE
      : kind === "form"
        ? CONTACT_TYPES.CONTACT_FORM
        : CONTACT_TYPES.CREATOR_PROGRAM;
  return upsertBrandContact(store, {
    userId,
    workerId,
    publicBrandId,
    contactType,
    value: String(url).toLowerCase(),
    source: "site_link",
    sourceUrl: sourceUrl || url,
    confidence: 70,
    verificationState: "unverified"
  });
}

/**
 * Crawl homepage + contact/creator/partnership/press/team pages for public emails.
 * Never invents addresses. Records why discovery failed and next routes.
 */
export const CONTACT_ROLE_PATH_HINTS = Object.freeze([
  /contact/i,
  /partnership/i,
  /collaborat/i,
  /creator/i,
  /influencer/i,
  /affiliate/i,
  /press/i,
  /media/i,
  /marketing/i,
  /about/i,
  /team/i,
  /work-with/i,
  /workwith/i
]);

export function buildContactDiscoveryFailurePlan({ emails = [], outreachReady = false, pagesFetched = 0, hasForm = false, socialHint = null } = {}) {
  if (outreachReady) {
    return {
      status: "contact_found",
      failureReason: null,
      nextRoutes: [],
      scheduleRecheckHours: null,
      deprioritize: false
    };
  }
  const nextRoutes = [];
  if (hasForm) nextRoutes.push({ route: "contact_form", label: "Prepare a contact-form message for manager review" });
  if (socialHint) nextRoutes.push({ route: "social_dm", label: `Recommend a social DM via ${socialHint}` });
  nextRoutes.push({ route: "recheck_site", label: "Recheck the brand site later for new partnership pages" });
  nextRoutes.push({ route: "research_alternatives", label: "Keep sourcing other outreach-ready opportunities meanwhile" });

  return {
    status: pagesFetched === 0 ? "site_unreachable" : emails.length ? "contacts_not_outreach_ready" : "no_public_email",
    failureReason:
      pagesFetched === 0
        ? "Brand site could not be fetched"
        : emails.length
          ? "Public emails found but none are outreach-ready without confirmation"
          : "No public partnership email found on crawled pages",
    nextRoutes,
    scheduleRecheckHours: 72,
    deprioritize: pagesFetched > 0 && emails.length === 0
  };
}

export async function discoverContactsFromBrandSite(store, {
  userId,
  workerId,
  publicBrandId,
  website,
  fetchImpl = globalThis.fetch
}) {
  if (!website || !publicBrandId) {
    return {
      savedIds: [],
      emails: [],
      pagesFetched: 0,
      status: "skipped",
      ...buildContactDiscoveryFailurePlan({ pagesFetched: 0 })
    };
  }
  const pages = [website];
  const savedIds = [];
  const allEmails = new Set();
  let pagesFetched = 0;
  let hasForm = false;

  try {
    const homeHtml = await fetchText(fetchImpl, website);
    pagesFetched += 1;
    const home = extractContactsFromHtml(homeHtml, website);
    hasForm = hasForm || home.hasContactForm;
    for (const email of home.emails) allEmails.add(email);
    savedIds.push(
      ...(await ingestObservedEmails(store, {
        userId,
        workerId,
        publicBrandId,
        emails: home.emails,
        partnershipEmails: home.partnershipEmails,
        sourceUrl: website
      }))
    );
    if (home.creatorProgramUrl) {
      savedIds.push(
        await ingestProgramOrFormPath(store, {
          userId,
          workerId,
          publicBrandId,
          url: home.creatorProgramUrl,
          kind: "creator",
          sourceUrl: website
        })
      );
      pages.push(home.creatorProgramUrl);
    }
    if (home.affiliateUrl) {
      savedIds.push(
        await ingestProgramOrFormPath(store, {
          userId,
          workerId,
          publicBrandId,
          url: home.affiliateUrl,
          kind: "affiliate",
          sourceUrl: website
        })
      );
      pages.push(home.affiliateUrl);
    }
    if (home.contactPageUrl) {
      if (home.hasContactForm) {
        savedIds.push(
          await ingestProgramOrFormPath(store, {
            userId,
            workerId,
            publicBrandId,
            url: home.contactPageUrl,
            kind: "form",
            sourceUrl: website
          })
        );
      }
      pages.push(home.contactPageUrl);
    }

    // Role-based path discovery from homepage links (press, team, marketing, etc.).
    const linkMatches = [...String(homeHtml || "").matchAll(/href=["']([^"']+)["']/gi)]
      .map((m) => resolveAbsoluteUrl(website, m[1]))
      .filter(Boolean)
      .filter((href) => CONTACT_ROLE_PATH_HINTS.some((re) => re.test(href)));
    for (const href of linkMatches.slice(0, 4)) pages.push(href);
  } catch {
    const failure = buildContactDiscoveryFailurePlan({ pagesFetched: 0 });
    return { savedIds, emails: [...allEmails], pagesFetched, ...failure, outreachReady: false, bestContact: null };
  }

  const extra = [...new Set(pages.slice(1))].slice(0, 4);
  const fetchedPages = await Promise.all(
    extra.map(async (pageUrl) => {
      try {
        return { pageUrl, html: await fetchText(fetchImpl, pageUrl) };
      } catch {
        return null;
      }
    })
  );
  for (const page of fetchedPages.filter(Boolean)) {
    try {
      pagesFetched += 1;
      const extracted = extractContactsFromHtml(page.html, page.pageUrl);
      hasForm = hasForm || extracted.hasContactForm;
      for (const email of extracted.emails) allEmails.add(email);
      savedIds.push(
        ...(await ingestObservedEmails(store, {
          userId,
          workerId,
          publicBrandId,
          emails: extracted.emails,
          partnershipEmails: extracted.partnershipEmails,
          sourceUrl: page.pageUrl
        }))
      );
      if (extracted.hasContactForm) {
        savedIds.push(
          await ingestProgramOrFormPath(store, {
            userId,
            workerId,
            publicBrandId,
            url: page.pageUrl,
            kind: "form",
            sourceUrl: page.pageUrl
          })
        );
      }
    } catch {
      continue;
    }
  }

  const best = await findBestOutreachContact(store, userId, workerId, publicBrandId);
  if (best?.value?.includes("@")) {
    try {
      await store.execute(
        `UPDATE worker_brands SET contact_email = COALESCE(NULLIF(contact_email, ''), ?), updated_at = ?
         WHERE user_id = ? AND worker_id = ? AND lower(brand_name) = (
           SELECT lower(brand_name) FROM mara_public_brands WHERE id = ?
         )`,
        best.value,
        new Date().toISOString(),
        userId,
        workerId,
        publicBrandId
      );
    } catch {
      /* worker_brands may be absent in unit tests */
    }
  }

  const outreachReady = Boolean(best?.value?.includes("@"));
  const failure = buildContactDiscoveryFailurePlan({
    emails: [...allEmails],
    outreachReady,
    pagesFetched,
    hasForm
  });

  return {
    savedIds: [...new Set(savedIds.filter(Boolean))],
    emails: [...allEmails],
    pagesFetched,
    outreachReady,
    bestContact: best,
    ...failure
  };
}

/** Attach existing Gmail thread contacts to a public brand by name match. */
export async function syncGmailContactsForBrand(store, { userId, workerId, publicBrandId, brandName }) {
  const needle = String(brandName || "").trim().toLowerCase();
  if (!needle || !publicBrandId) return { synced: 0 };
  let threads = [];
  try {
    threads = await store.query(
      `SELECT id, contact_email AS "contactEmail", brand_name AS "brandName"
       FROM office_email_threads
       WHERE user_id = ? AND worker_slug = ? AND brand_related = 1 AND contact_email <> ''
         AND (lower(brand_name) = ? OR lower(brand_name) LIKE ?)
       ORDER BY received_at DESC
       LIMIT 10`,
      userId,
      workerId,
      needle,
      `%${needle}%`
    );
  } catch {
    return { synced: 0 };
  }
  let synced = 0;
  for (const thread of threads) {
    if (!thread.contactEmail) continue;
    await ingestGmailContact(store, {
      userId,
      workerId,
      publicBrandId,
      email: thread.contactEmail,
      threadId: thread.id
    });
    synced += 1;
  }
  return { synced };
}

export async function discoverAndPersistBrandContacts(store, {
  userId,
  workerId,
  publicBrandId,
  brandName,
  website,
  seedEmails = [],
  partnershipEmails = [],
  fetchImpl = globalThis.fetch,
  forceRefresh = false,
  cacheTtlHours = 72
}) {
  const existingBest = await findBestOutreachContact(store, userId, workerId, publicBrandId).catch(() => null);
  if (!forceRefresh && existingBest?.value?.includes("@") && Number(existingBest.mayUseForOutreach) === 1) {
    let fresh = false;
    try {
      const recent = await store.queryOne(
        `SELECT MAX(updated_at) AS "updatedAt" FROM mara_brand_contacts
         WHERE user_id = ? AND worker_id = ? AND public_brand_id = ? AND may_use_for_outreach = 1`,
        userId,
        workerId,
        publicBrandId
      );
      const ageMs = recent?.updatedAt ? Date.now() - new Date(recent.updatedAt).getTime() : Infinity;
      fresh = ageMs < Math.max(1, Number(cacheTtlHours) || 72) * 3_600_000;
    } catch {
      fresh = false;
    }
    if (fresh) {
      return {
        savedIds: [],
        gmailSynced: 0,
        site: { status: "cache_hit", pagesFetched: 0 },
        outreachReady: true,
        bestContact: existingBest,
        skippedRediscovery: true
      };
    }
  }

  const fromSeed = await ingestObservedEmails(store, {
    userId,
    workerId,
    publicBrandId,
    emails: seedEmails,
    partnershipEmails,
    sourceUrl: website
  });
  const fromSite = website
    ? await discoverContactsFromBrandSite(store, { userId, workerId, publicBrandId, website, fetchImpl })
    : { savedIds: [], emails: [], pagesFetched: 0, status: "no_website", outreachReady: false };
  const fromGmail = await syncGmailContactsForBrand(store, { userId, workerId, publicBrandId, brandName });

  let enrichment = { providers: [], savedIds: [], emailsFound: [] };
  if (website && !fromSite.outreachReady) {
    try {
      const { enrichAndPersistBrandContacts } = await import("./maraContactEnrichment.mjs");
      enrichment = await enrichAndPersistBrandContacts(store, {
        userId,
        workerId,
        publicBrandId,
        website,
        fetchImpl
      });
    } catch {
      enrichment = { providers: [], savedIds: [], emailsFound: [], error: "enrichment_failed" };
    }
  }

  const best = await findBestOutreachContact(store, userId, workerId, publicBrandId);
  const failurePlan = !best?.value?.includes("@")
    ? buildContactDiscoveryFailurePlan({
        emails: [...new Set([...(fromSite.emails || []), ...(enrichment.emailsFound || [])])],
        outreachReady: false,
        pagesFetched: Number(fromSite.pagesFetched || 0),
        hasForm: Boolean(fromSite.nextRoutes?.some?.((r) => r.route === "contact_form") || fromSite.status === "contacts_not_outreach_ready")
      })
    : { status: "contact_found", failureReason: null, nextRoutes: [], scheduleRecheckHours: null, deprioritize: false };

  // Missing public contact information is Mara-owned work. Park the opportunity
  // for a scheduled retry; never turn it into a creator task.
  if (!best?.value?.includes("@") && failurePlan.scheduleRecheckHours) {
    try {
      await store.execute(
        `UPDATE mara_creator_brand_opportunities
         SET lifecycle_stage = 'contact_needed', status = 'qualified',
             next_action_due_at = ?, blocking_reason = ?, updated_at = ?
         WHERE user_id = ? AND worker_id = ? AND (public_brand_id = ? OR brand_profile_id = ?)
           AND COALESCE(lifecycle_stage, status) IN ('qualified', 'contact_needed', 'candidate', 'discovered', 'researching')`,
        new Date(Date.now() + failurePlan.scheduleRecheckHours * 3600_000).toISOString(),
        failurePlan.failureReason || "No outreach-ready contact",
        new Date().toISOString(),
        userId,
        workerId,
        publicBrandId,
        publicBrandId
      );
    } catch {
      /* optional columns */
    }
  }

  // A successful retry immediately returns parked opportunities to Mara's
  // actionable pipeline without waiting for a separate lifecycle pass.
  if (best?.value?.includes("@")) {
    try {
      await store.execute(
        `UPDATE mara_creator_brand_opportunities
         SET lifecycle_stage = 'contact_found', status = 'qualified',
             next_action_due_at = NULL, blocking_reason = NULL, updated_at = ?
         WHERE user_id = ? AND worker_id = ? AND (public_brand_id = ? OR brand_profile_id = ?)
           AND COALESCE(lifecycle_stage, status) IN ('qualified', 'contact_needed', 'candidate', 'discovered', 'researching')`,
        new Date().toISOString(),
        userId,
        workerId,
        publicBrandId,
        publicBrandId
      );
    } catch {
      /* optional columns */
    }
  }

  return {
    savedIds: [...new Set([...fromSeed, ...(fromSite.savedIds || []), ...(enrichment.savedIds || [])])],
    gmailSynced: fromGmail.synced,
    site: fromSite,
    enrichment,
    outreachReady: Boolean(best?.value?.includes("@")),
    bestContact: best,
    skippedRediscovery: false,
    ...failurePlan
  };
}
