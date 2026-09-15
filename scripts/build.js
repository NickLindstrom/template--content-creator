const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");
const contentPath = path.join(projectRoot, "content", "home.json");
const defaultTemplatePath = path.join(projectRoot, "src", "template.html");
const outputPath = path.join(projectRoot, "index.html");
const indexJsPath = path.join(projectRoot, "index.js");

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function upsertCspMeta(html, policy) {
  if (!hasText(policy)) {
    return html;
  }

  const metaTag =
    `<meta http-equiv="Content-Security-Policy" ` +
    `content="${escapeHtml(policy)}">`;

  const existingRegex =
    /<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*>/i;

  if (existingRegex.test(html)) {
    return html.replace(existingRegex, metaTag);
  }

  /*
   * CSP bör ligga så tidigt som möjligt.
   * Vi placerar den direkt efter charset.
   */

  const charsetRegex =
    /<meta\b[^>]*charset\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/i;

  if (charsetRegex.test(html)) {
    return html.replace(
      charsetRegex,
      (charsetTag) => `${charsetTag}\n  ${metaTag}`,
    );
  }

  return html.replace(
    /<head\b[^>]*>/i,
    (headTag) => `${headTag}\n  ${metaTag}`,
  );
}

function createCspHash(value) {
  const hash = crypto
    .createHash("sha256")
    .update(String(value), "utf8")
    .digest("base64");

  return `'sha256-${hash}'`;
}

function createFileIntegrity(filePath) {
  const fileContents = fs.readFileSync(filePath);

  const hash = crypto
    .createHash("sha256")
    .update(fileContents)
    .digest("base64");

  return `sha256-${hash}`;
}

function sanitizeCspSources(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value) => !/[\s;]/.test(value)),
    ),
  );
}

function buildCsp(
  content,
  inlineScriptBodies = [],
  externalScriptIntegrities = [],
) {
  const config = content.security?.csp || {};

  if (config.enabled === false) {
    return "";
  }

  /*
   * 'self' behålls som fallback för browsers utan full CSP3-support.
   *
   * Moderna browsers använder SHA-256-hashen tillsammans med
   * 'strict-dynamic'.
   */
  const scriptSources = [
    "'self'",

    ...externalScriptIntegrities
      .filter((integrity) => hasText(integrity))
      .map((integrity) => `'${integrity}'`),

    ...inlineScriptBodies.filter((body) => hasText(body)).map(createCspHash),

    "'strict-dynamic'",
  ];

  const imageSources = ["'self'", "data:", "blob:"];

  /*
   * Standard: tillåt bilder från valfri HTTPS-källa.
   *
   * Sätt allowAnyHttpsImages: false i home.json om ett projekt
   * istället ska använda en strikt domänlista.
   */
  if (config.allowAnyHttpsImages !== false) {
    imageSources.push("https:");
  }

  imageSources.push(...sanitizeCspSources(config.extraImageSources));

  const directives = [
    "default-src 'none'",

    `script-src ${Array.from(new Set(scriptSources)).join(" ")}`,

    "script-src-attr 'none'",

    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",

    `img-src ${Array.from(new Set(imageSources)).join(" ")}`,

    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

function setScriptIntegrity(html, src, integrity) {
  const escapedSrc = escapeRegExp(src);

  const scriptRegex = new RegExp(
    `<script\\b(?=[^>]*\\bsrc\\s*=\\s*(["'])(?:\\./)?${escapedSrc}\\1)[^>]*>`,
    "i",
  );

  if (!scriptRegex.test(html)) {
    throw new Error(`Kunde inte hitta <script src="${src}"> i vald template.`);
  }

  return html.replace(scriptRegex, (tag) =>
    setTagAttribute(tag, "integrity", integrity),
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasText(value) {
  return Boolean(String(value ?? "").trim());
}

function cleanPhone(phone) {
  return String(phone ?? "").replace(/[^\d+]/g, "");
}

function safeJsonForHtml(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function localeFromLanguage(language) {
  return language === "sv" ? "sv_SE" : "en_US";
}

function cleanObject(value) {
  if (Array.isArray(value)) {
    return value
      .map(cleanObject)
      .filter((item) => item !== undefined && item !== null && item !== "");
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const cleaned = cleanObject(item);

      if (
        cleaned !== undefined &&
        cleaned !== null &&
        cleaned !== "" &&
        (!Array.isArray(cleaned) || cleaned.length)
      ) {
        acc[key] = cleaned;
      }

      return acc;
    }, {});
  }

  return hasText(value) ? value : undefined;
}

/* -------------------------------------------------------------------------- */
/* URL helpers                                                                */
/* -------------------------------------------------------------------------- */

function resolvePageUrl(content) {
  const configuredUrl =
    content.site?.url || content.seo?.canonical || process.env.SITE_URL || "";

  if (hasText(configuredUrl)) {
    return configuredUrl.endsWith("/") ? configuredUrl : `${configuredUrl}/`;
  }

  /*
   * GitHub Actions:
   *
   * GITHUB_REPOSITORY = owner/repository
   *
   * Ger:
   *
   * https://owner.github.io/repository/
   */
  if (hasText(process.env.GITHUB_REPOSITORY)) {
    const [owner, repository] = process.env.GITHUB_REPOSITORY.split("/");

    if (owner && repository) {
      return `https://${owner}.github.io/${repository}/`;
    }
  }

  /*
   * Local fallback.
   *
   * For production, site.url in home.json is recommended.
   */

  return "/";
}

function absoluteUrl(value, pageUrl) {
  if (!hasText(value)) {
    return "";
  }

  try {
    if (/^https?:\/\//i.test(value)) {
      return new URL(value).href;
    }

    if (!/^https?:\/\//i.test(pageUrl)) {
      return value;
    }

    return new URL(value, pageUrl).href;
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/* HTML manipulation                                                          */
/* -------------------------------------------------------------------------- */

function findElementById(html, id) {
  const escapedId = escapeRegExp(id);

  const openingRegex = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b` +
      `[^>]*\\bid\\s*=\\s*` +
      `(["'])${escapedId}\\2[^>]*>`,
    "i",
  );

  const match = openingRegex.exec(html);

  if (!match) {
    return null;
  }

  const tagName = match[1];
  const openStart = match.index;
  const openTag = match[0];
  const openEnd = openStart + openTag.length;

  const tagRegex = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");

  tagRegex.lastIndex = openEnd;

  let depth = 1;
  let token;

  while ((token = tagRegex.exec(html))) {
    const tag = token[0];

    if (/^<\//.test(tag)) {
      depth -= 1;
    } else if (!/\/>$/.test(tag)) {
      depth += 1;
    }

    if (depth === 0) {
      return {
        tagName,
        openStart,
        openEnd,
        openTag,
        closeStart: token.index,
        closeEnd: token.index + tag.length,
        closeTag: tag,
      };
    }
  }

  return null;
}

function replaceInnerById(html, id, innerHtml) {
  const element = findElementById(html, id);

  if (!element) {
    return html;
  }

  return (
    html.slice(0, element.openEnd) + innerHtml + html.slice(element.closeStart)
  );
}

function setTagAttribute(tag, attributeName, value) {
  const attributeRegex = new RegExp(
    `\\s${escapeRegExp(attributeName)}\\s*=\\s*` +
      `(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "i",
  );

  let cleaned = tag.replace(attributeRegex, "");

  const selfClosing = /\/>$/.test(cleaned);

  cleaned = cleaned.replace(/\s*\/?>$/, "");

  return (
    `${cleaned} ` +
    `${attributeName}=` +
    `"${escapeHtml(value)}"` +
    `${selfClosing ? " />" : ">"}`
  );
}

function removeTagAttribute(tag, attributeName) {
  const attributeRegex = new RegExp(
    `\\s${escapeRegExp(attributeName)}` +
      `(?:\\s*=\\s*` +
      `(?:"[^"]*"|'[^']*'|[^\\s>]+))?`,
    "i",
  );

  return tag.replace(attributeRegex, "");
}

function setAttributeById(html, id, attributeName, value) {
  const element = findElementById(html, id);

  if (!element) {
    return html;
  }

  const newOpenTag = setTagAttribute(element.openTag, attributeName, value);

  return (
    html.slice(0, element.openStart) + newOpenTag + html.slice(element.openEnd)
  );
}

function setHiddenById(html, id, hidden) {
  const element = findElementById(html, id);

  if (!element) {
    return html;
  }

  let openTag = removeTagAttribute(element.openTag, "hidden");

  if (hidden) {
    openTag = openTag.replace(/>$/, " hidden>");
  }

  return (
    html.slice(0, element.openStart) + openTag + html.slice(element.openEnd)
  );
}

function setText(html, id, value) {
  return replaceInnerById(html, id, escapeHtml(value));
}

function setLink(html, id, href, label) {
  html = setAttributeById(html, id, "href", href || "#");

  html = setText(html, id, label || "");

  return html;
}

function setMeta(html, attributeName, attributeValue, content) {
  const regex = new RegExp(
    `<meta\\b[^>]*\\b` +
      `${escapeRegExp(attributeName)}\\s*=\\s*` +
      `(["'])${escapeRegExp(attributeValue)}\\1[^>]*>`,
    "i",
  );

  return html.replace(regex, (tag) =>
    setTagAttribute(tag, "content", content || ""),
  );
}

function setTitle(html, title) {
  return html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );
}

function upsertHeadLink(html, rel, href) {
  if (!hasText(href)) {
    return html;
  }

  const regex = new RegExp(
    `<link\\b` +
      `(?=[^>]*\\brel\\s*=\\s*` +
      `(["'])${escapeRegExp(rel)}\\1)` +
      `[^>]*>`,
    "i",
  );

  if (regex.test(html)) {
    return html.replace(regex, (tag) => setTagAttribute(tag, "href", href));
  }

  return html.replace(
    /<\/head>/i,
    `  <link rel="${escapeHtml(rel)}" href="${escapeHtml(href)}">\n</head>`,
  );
}

/* -------------------------------------------------------------------------- */
/* Render functions                                                           */
/* -------------------------------------------------------------------------- */

function renderServices(items = []) {
  return items
    .filter(
      (item) => item && (hasText(item.title) || hasText(item.description)),
    )
    .map((item) => {
      const image = item.image?.url
        ? `
          <img
            class="service-card__image"
            src="${escapeHtml(item.image.url)}"
            alt="${escapeHtml(item.image.alt || item.title || "")}"
            loading="lazy"
            decoding="async"
          >
        `
        : "";

      return `
        <article class="service-card">
          <div class="service-card__media${
            image ? " service-card__media--image" : ""
          }">
            ${image}
          </div>

          <h3 class="service-card__title">
            ${escapeHtml(item.title)}
          </h3>

          <p class="service-card__text">
            ${escapeHtml(item.description)}
          </p>
        </article>
      `;
    })
    .join("");
}

function renderHeroVisual(content) {
  const image = content.media?.heroImage;

  if (!image?.url) {
    return "";
  }

  return `
    <div class="hero-visual">
      <div class="hero-visual__main-card">
        <img
          class="hero-visual__image"
          src="${escapeHtml(image.url)}"
          alt="${escapeHtml(image.alt || "")}"
          decoding="async"
          fetchpriority="high"
        >
      </div>

      <div class="hero-visual__floating-card">
        <p class="hero-visual__label">
          Lokalt fokus
        </p>

        <p class="hero-visual__value">
          ${escapeHtml(content.site?.displayName || "")}
        </p>

        ${
          hasText(content.contact?.address)
            ? `
              <p class="hero-visual__caption">
                ${escapeHtml(content.contact.address)}
              </p>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function renderAboutVisual(content) {
  const image = content.media?.aboutImage;

  const imageHtml = image?.url
    ? `
        <div class="about-media__image-frame">
          <img
            class="about-media__image"
            src="${escapeHtml(image.url)}"
            alt="${escapeHtml(image.alt || "")}"
            loading="lazy"
            decoding="async"
          >
        </div>
      `
    : "";

  const uspItems = Array.isArray(content.usp?.items)
    ? content.usp.items.filter(hasText)
    : [];

  const uspHtml =
    content.usp?.enabled !== false &&
    (uspItems.length || hasText(content.usp?.heading))
      ? `
        <div class="highlight-panel">
          <p class="highlight-panel__label">
            ${escapeHtml(content.usp?.heading || "")}
          </p>

          <ul class="usp-list">
            ${uspItems
              .map(
                (item) => `<li class="usp-list__item">${escapeHtml(item)}</li>`,
              )
              .join("")}
          </ul>
        </div>
      `
      : "";

  if (!imageHtml && !uspHtml) {
    return "";
  }

  return `
    <div class="about-media">
      ${imageHtml}
      ${uspHtml}
    </div>
  `;
}

function renderTestimonials(items = []) {
  return items
    .filter((item) => item && (hasText(item.name) || hasText(item.quote)))
    .map(
      (item) => `
        <article class="testimonial-card">
          <h3 class="testimonial-card__name">
            ${escapeHtml(item.name)}
          </h3>

          <p class="testimonial-card__text">
            "${escapeHtml(item.quote)}"
          </p>
        </article>
      `,
    )
    .join("");
}

function renderFaq(items = []) {
  return items
    .filter((item) => item && (hasText(item.question) || hasText(item.answer)))
    .map(
      (item) => `
        <article class="faq-item">
          <h3 class="faq-item__question">
            ${escapeHtml(item.question)}
          </h3>

          <p class="faq-item__answer">
            ${escapeHtml(item.answer)}
          </p>
        </article>
      `,
    )
    .join("");
}

function renderGallery(items = []) {
  return items
    .filter((item) => item?.url)
    .map(
      (item) => `
        <figure class="gallery-card">
          <img
            class="gallery-card__image"
            src="${escapeHtml(item.url)}"
            alt="${escapeHtml(item.alt || "")}"
            loading="lazy"
            decoding="async"
          >
        </figure>
      `,
    )
    .join("");
}

function renderSocialLinks(links = {}) {
  const uniqueEntries = [];
  const seenUrls = new Set();

  Object.entries(links).forEach(([name, url]) => {
    if (!hasText(url) || seenUrls.has(url)) {
      return;
    }

    seenUrls.add(url);

    uniqueEntries.push([name, url]);
  });

  return uniqueEntries
    .map(
      ([name, url]) => `
        <a
          class="site-footer__social-link"
          href="${escapeHtml(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(name)}
        </a>
      `,
    )
    .join("");
}

function renderBrand(content, footer = false) {
  const logoUrl = content.media?.logoUrl;

  const logoOnly = !footer && Boolean(content.media?.headerLogoOnly);

  const companyName = footer
    ? content.footer?.companyName || content.site?.displayName
    : content.site?.displayName;

  const width = hasText(content.media?.logoWidth)
    ? ` style="width:${escapeHtml(content.media.logoWidth)};height:auto"`
    : "";

  const logo = logoUrl
    ? `
        <img
          class="brand-mark__logo"
          src="${escapeHtml(logoUrl)}"
          alt="${escapeHtml(companyName)} logotyp"
          ${width}
        >
      `
    : "";

  const text =
    !logoOnly || !logoUrl
      ? `<span class="brand-mark__text">${escapeHtml(companyName)}</span>`
      : "";

  return `${logo}${text}`;
}

function renderOpeningHoursDays(days = []) {
  return days
    .filter(
      (item) =>
        item &&
        (item.closed === true || hasText(item.opens) || hasText(item.closes)),
    )
    .map((item) => {
      const timeLabel =
        item.closed === true
          ? "Stängt"
          : [item.opens, item.closes].filter(hasText).join(" – ");

      return `
        <div class="opening-hours-row">
          <span class="opening-hours-row__day">
            ${escapeHtml(item.day || "")}
          </span>

          <span class="opening-hours-row__time">
            ${escapeHtml(timeLabel)}
          </span>
        </div>
      `;
    })
    .join("");
}

/* -------------------------------------------------------------------------- */
/* SEO                                                                        */
/* -------------------------------------------------------------------------- */

function applySeo(html, content, pageUrl) {
  const title = content.seo?.title || content.site?.displayName || "";

  const description = content.seo?.description || "";

  const heroImage = absoluteUrl(content.media?.heroImage?.url || "", pageUrl);

  html = setTitle(html, title);

  html = setMeta(html, "name", "description", description);

  html = setMeta(
    html,
    "property",
    "og:locale",
    localeFromLanguage(content.site?.language),
  );

  html = setMeta(html, "property", "og:title", title);

  html = setMeta(html, "property", "og:description", description);

  html = setMeta(html, "property", "og:image", heroImage);

  html = setMeta(html, "name", "twitter:title", title);

  html = setMeta(html, "name", "twitter:description", description);

  html = setMeta(html, "name", "twitter:image", heroImage);

  html = html.replace(/<html\b[^>]*>/i, (tag) =>
    setTagAttribute(tag, "lang", content.site?.language || "sv"),
  );

  if (/^https?:\/\//i.test(pageUrl)) {
    html = upsertHeadLink(html, "canonical", pageUrl);
  }

  return html;
}

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

function buildJsonLd(content, pageUrl) {
  const site = content.site || {};

  const seo = content.seo || {};

  const contact = content.contact || {};

  const footer = content.footer || {};

  const media = content.media || {};

  const services = content.services || {};

  const openingHours = content.openingHours || {};

  const schemaDayNames = {
    Måndag: "Monday",
    Tisdag: "Tuesday",
    Onsdag: "Wednesday",
    Torsdag: "Thursday",
    Fredag: "Friday",
    Lördag: "Saturday",
    Söndag: "Sunday",
  };

  const logoUrl = absoluteUrl(media.logoUrl, pageUrl);

  const heroImageUrl = absoluteUrl(media.heroImage?.url, pageUrl);

  const galleryImages = Array.isArray(media.gallery)
    ? media.gallery
        .map((item) => absoluteUrl(item?.url, pageUrl))
        .filter(Boolean)
    : [];

  const serviceOffers = Array.isArray(services.items)
    ? services.items
        .filter(
          (item) => item && (hasText(item.title) || hasText(item.description)),
        )
        .map((item) => ({
          "@type": "Offer",

          itemOffered: {
            "@type": "Service",
            name: item.title,
            description: item.description,
          },
        }))
    : [];

  const sameAs = Array.from(
    new Set(
      Object.values(footer.socialLinks || {}).filter((value) => hasText(value)),
    ),
  );

  const openingHoursSpecification = Array.isArray(openingHours.days)
    ? openingHours.days
        .filter(
          (item) =>
            item &&
            item.closed !== true &&
            hasText(item.opens) &&
            hasText(item.closes),
        )
        .map((item) => ({
          "@type": "OpeningHoursSpecification",

          dayOfWeek: schemaDayNames[item.day] || item.day,

          opens: item.opens,

          closes: item.closes,
        }))
    : [];

  const businessType = hasText(site.schemaType)
    ? site.schemaType
    : "LocalBusiness";

  const businessId = /^https?:\/\//i.test(pageUrl)
    ? `${pageUrl}#business`
    : "#business";

  const websiteId = /^https?:\/\//i.test(pageUrl)
    ? `${pageUrl}#website`
    : "#website";

  const webpageId = /^https?:\/\//i.test(pageUrl)
    ? `${pageUrl}#webpage`
    : "#webpage";

  const graph = [
    {
      "@type": [businessType, "ProfessionalService"],

      "@id": businessId,

      name: site.displayName || site.companyName || footer.companyName,

      legalName: site.companyName || footer.companyName,

      url: /^https?:\/\//i.test(pageUrl) ? pageUrl : undefined,

      description: seo.description || contact.body || footer.tagline,

      telephone: contact.phone,

      email: contact.email,

      address: contact.address,

      logo: logoUrl,

      image: [heroImageUrl].concat(galleryImages).filter(Boolean),

      sameAs,

      openingHoursSpecification,

      makesOffer: serviceOffers,
    },

    {
      "@type": "WebSite",

      "@id": websiteId,

      url: /^https?:\/\//i.test(pageUrl) ? pageUrl : undefined,

      name: site.displayName || site.companyName || footer.companyName,

      publisher: {
        "@id": businessId,
      },

      inLanguage: site.language || "sv",
    },

    {
      "@type": "WebPage",

      "@id": webpageId,

      url: /^https?:\/\//i.test(pageUrl) ? pageUrl : undefined,

      name: seo.title || site.displayName || site.companyName,

      description: seo.description,

      isPartOf: {
        "@id": websiteId,
      },

      about: {
        "@id": businessId,
      },

      primaryImageOfPage: heroImageUrl
        ? {
            "@type": "ImageObject",

            url: heroImageUrl,
          }
        : undefined,

      inLanguage: site.language || "sv",
    },
  ];

  return cleanObject({
    "@context": "https://schema.org",

    "@graph": graph,
  });
}

function upsertJsonLd(html, jsonLdBody) {
  const scriptTag =
    `<script ` +
    `id="site-json-ld" ` +
    `type="application/ld+json">` +
    `${jsonLdBody}` +
    `</script>`;

  const existingRegex =
    /<script\b[^>]*\bid\s*=\s*(["'])site-json-ld\1[^>]*>[\s\S]*?<\/script>/i;

  if (existingRegex.test(html)) {
    return html.replace(existingRegex, scriptTag);
  }

  return html.replace(/<\/head>/i, `  ${scriptTag}\n</head>`);
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

function applyThemeStylesheet(html, content) {
  const theme = String(content.site?.theme || "").trim();

  if (!theme) {
    return html;
  }

  const themeCssPath = path.join(projectRoot, "themes", theme, "main.css");

  if (!fs.existsSync(themeCssPath)) {
    return html;
  }

  const href = `themes/${theme}/main.css`;

  return html.replace(
    /<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])[^>]*>/i,
    (tag) => setTagAttribute(tag, "href", href),
  );
}

/* -------------------------------------------------------------------------- */
/* Main rendering                                                             */
/* -------------------------------------------------------------------------- */

function renderPage(content) {
  const theme = String(content.site?.theme || "").trim();

  const themeTemplate = theme
    ? path.join(projectRoot, "themes", theme, "template.html")
    : null;

  const templatePath =
    themeTemplate && fs.existsSync(themeTemplate)
      ? themeTemplate
      : defaultTemplatePath;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template hittades inte: ${templatePath}`);
  }

  if (!fs.existsSync(indexJsPath)) {
    throw new Error(`index.js hittades inte: ${indexJsPath}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  const pageUrl = resolvePageUrl(content);

  /*
   * Generera inline-blocken exakt en gång.
   *
   * CSP-hasharna beräknas sedan från exakt
   * samma strängar som hamnar i HTML.
   */
  const initialContentBody = `\n${safeJsonForHtml(content)}\n`;

  const jsonLdBody = `\n${safeJsonForHtml(buildJsonLd(content, pageUrl))}\n`;

  /*
   * 1. SHA-256 på index.js
   */
  const indexJsIntegrity = createFileIntegrity(indexJsPath);

  /*
   * 2. Lägg SRI på script-taggen.
   *
   * Exempel på genererat resultat:
   *
   * <script
   *   defer
   *   src="index.js"
   *   integrity="sha256-AbCd..."
   * ></script>
   */
  html = setScriptIntegrity(html, "index.js", indexJsIntegrity);

  /* SEO + structured data */

  html = applySeo(html, content, pageUrl);

  html = upsertJsonLd(html, jsonLdBody);

  html = applyThemeStylesheet(html, content);

  /* Branding */

  html = replaceInnerById(html, "header-brand", renderBrand(content, false));

  html = replaceInnerById(html, "footer-brand", renderBrand(content, true));

  /* Hero */

  html = setText(html, "hero-eyebrow", content.hero?.eyebrow);

  html = setText(html, "hero-headline", content.hero?.headline);

  html = setText(html, "hero-subheadline", content.hero?.subheadline);

  html = setLink(
    html,
    "hero-primary-cta",
    content.hero?.primaryCtaHref || "#contact",
    content.hero?.primaryCtaLabel || "Kontakta oss",
  );

  html = setLink(
    html,
    "nav-cta-link",
    content.hero?.primaryCtaHref || "#contact",
    content.hero?.primaryCtaLabel || "Kontakt",
  );

  html = setHiddenById(html, "top", content.hero?.enabled === false);

  html = replaceInnerById(html, "hero-visual-slot", renderHeroVisual(content));

  /* Intro */

  const introVisible =
    content.intro?.enabled !== false &&
    (hasText(content.intro?.heading) || hasText(content.intro?.body));

  html = setText(
    html,
    "intro-eyebrow",
    content.intro?.eyebrow || "Introduktion",
  );

  html = setText(html, "intro-heading", content.intro?.heading);

  html = setText(html, "intro-body", content.intro?.body);

  html = setHiddenById(html, "intro-section", !introVisible);

  /* Services */

  const serviceItems = Array.isArray(content.services?.items)
    ? content.services.items
    : [];

  const servicesVisible =
    content.services?.enabled !== false && serviceItems.length > 0;

  html = setText(
    html,
    "services-eyebrow",
    content.services?.eyebrow || "Tjänster",
  );

  html = setText(html, "services-heading", content.services?.heading);

  html = replaceInnerById(html, "services-list", renderServices(serviceItems));

  html = setHiddenById(html, "services", !servicesVisible);

  html = setHiddenById(html, "services-nav-link", !servicesVisible);

  /* About */

  const hasAboutText =
    hasText(content.about?.heading) || hasText(content.about?.body);

  const hasAboutMedia = Boolean(content.media?.aboutImage?.url);

  const hasUspContent =
    content.usp?.enabled !== false &&
    (hasText(content.usp?.heading) ||
      (Array.isArray(content.usp?.items) && content.usp.items.some(hasText)));

  const aboutVisible =
    content.about?.enabled !== false &&
    (hasAboutText || hasAboutMedia || hasUspContent);

  html = setText(html, "about-eyebrow", content.about?.eyebrow || "Om oss");

  html = setText(html, "about-heading", content.about?.heading);

  html = setText(html, "about-body", content.about?.body);

  html = replaceInnerById(
    html,
    "about-visual-slot",
    renderAboutVisual(content),
  );

  html = setHiddenById(html, "about", !aboutVisible);

  html = setHiddenById(html, "about-nav-link", !aboutVisible);

  /* Gallery */

  const galleryItems = Array.isArray(content.media?.gallery)
    ? content.media.gallery
    : [];

  const galleryVisible =
    content.media?.galleryEnabled !== false && galleryItems.length > 0;

  html = setText(
    html,
    "gallery-eyebrow",
    content.media?.galleryEyebrow || "Bilder",
  );

  html = setText(
    html,
    "gallery-heading",
    content.media?.galleryHeading || "Inblick i verksamheten",
  );

  html = replaceInnerById(html, "gallery-grid", renderGallery(galleryItems));

  html = setHiddenById(html, "gallery", !galleryVisible);

  html = setHiddenById(html, "gallery-nav-link", !galleryVisible);

  /* Testimonials */

  const testimonialItems = Array.isArray(content.testimonials?.items)
    ? content.testimonials.items
    : [];

  const testimonialsVisible =
    content.testimonials?.enabled !== false && testimonialItems.length > 0;

  html = setText(
    html,
    "testimonials-eyebrow",
    content.testimonials?.eyebrow || "Omdömen",
  );

  html = setText(html, "testimonials-heading", content.testimonials?.heading);

  html = replaceInnerById(
    html,
    "testimonials-list",
    renderTestimonials(testimonialItems),
  );

  html = setHiddenById(html, "testimonials-section", !testimonialsVisible);

  /* FAQ */

  const faqItems = Array.isArray(content.faq?.items) ? content.faq.items : [];

  const faqVisible = content.faq?.enabled !== false && faqItems.length > 0;

  html = setText(html, "faq-eyebrow", content.faq?.eyebrow || "FAQ");

  html = setText(html, "faq-heading", content.faq?.heading);

  html = replaceInnerById(html, "faq-list", renderFaq(faqItems));

  html = setHiddenById(html, "faq", !faqVisible);

  /* Contact */

  const contactVisible =
    content.contact?.enabled !== false &&
    (hasText(content.contact?.heading) ||
      hasText(content.contact?.body) ||
      hasText(content.contact?.phone) ||
      hasText(content.contact?.email) ||
      hasText(content.contact?.address));

  html = setText(
    html,
    "contact-eyebrow",
    content.contact?.eyebrow || "Kontakt",
  );

  html = setText(html, "contact-heading", content.contact?.heading);

  html = setText(html, "contact-body", content.contact?.body);

  html = setLink(
    html,
    "contact-phone",
    `tel:${cleanPhone(content.contact?.phone)}`,
    content.contact?.phone || "",
  );

  html = setLink(
    html,
    "contact-email",
    `mailto:${content.contact?.email || ""}`,
    content.contact?.email || "",
  );

  html = setText(html, "contact-address", content.contact?.address || "");

  html = setHiddenById(html, "contact", !contactVisible);

  html = setHiddenById(
    html,
    "nav-cta-link",
    !contactVisible || !hasText(content.hero?.primaryCtaLabel),
  );

  html = setHiddenById(
    html,
    "hero-primary-cta",
    !contactVisible || !hasText(content.hero?.primaryCtaLabel),
  );

  /* Opening hours */

  const openingHours = content.openingHours || {};

  const openingHourDays = Array.isArray(openingHours.days)
    ? openingHours.days
    : [];

  const openingHoursHtml = renderOpeningHoursDays(openingHourDays);

  const openingHoursVisible =
    openingHours.enabled !== false && hasText(openingHoursHtml);

  html = setText(
    html,
    "opening-hours-eyebrow",
    openingHours.eyebrow || "Öppettider",
  );

  html = setText(
    html,
    "opening-hours-heading",
    openingHours.heading || "Öppettider",
  );

  html = setText(html, "opening-hours-body", openingHours.body || "");

  html = replaceInnerById(html, "opening-hours-list", openingHoursHtml);

  html = setHiddenById(html, "opening-hours", !openingHoursVisible);

  /* Footer */

  html = setText(html, "footer-tagline", content.footer?.tagline || "");

  html = setText(html, "footer-copyright", content.footer?.copyright || "");

  html = replaceInnerById(
    html,
    "social-links",
    renderSocialLinks(content.footer?.socialLinks),
  );

  html = setHiddenById(html, "site-footer", content.footer?.enabled === false);

  /*
   * Embedded JSON finns kvar endast för de
   * visuella frontendinställningarna som
   * index.js använder.
   */
  html = replaceInnerById(html, "initial-content", initialContentBody);

  /*
   * 3. Generera strict CSP.
   *
   * indexJsIntegrity används både i:
   *
   * integrity="sha256-..."
   *
   * och:
   *
   * script-src 'sha256-...' 'strict-dynamic'
   */
  const cspPolicy = buildCsp(
    content,
    [initialContentBody, jsonLdBody],
    [indexJsIntegrity],
  );

  html = upsertCspMeta(html, cspPolicy);

  return html;
}

/* -------------------------------------------------------------------------- */
/* Build                                                                      */
/* -------------------------------------------------------------------------- */

(function build() {
  const content = readJson(contentPath);

  const html = renderPage(content);

  fs.writeFileSync(outputPath, html, "utf8");

  console.log("");
  console.log("Static build klar.");

  console.log(`Source: ${contentPath}`);

  console.log(`Output: ${outputPath}`);

  console.log("JSON-LD: genererad statiskt");

  console.log("Öppettider: genererade statiskt");

  console.log("CSP: genererad statiskt");

  console.log("index.js: SHA-256 + SRI genererad");

  console.log("");
})();
