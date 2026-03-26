const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const contentPath = path.join(projectRoot, "content", "home.json");
const templatePath = path.join(projectRoot, "src", "template.html");
const outputPath = path.join(projectRoot, "index.html");

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

function get(obj, keyPath) {
  return keyPath.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : ""), obj);
}

function localeFromLanguage(language) {
  return language === "sv" ? "sv_SE" : "en_US";
}

function renderBrand({ companyName, logoUrl, className }) {
  const logo = logoUrl
    ? `<img class="brand-mark__logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} logotyp">`
    : "";

  return `<a class="${escapeHtml(className)}" href="#top" aria-label="Till startsidan">${logo}<span class="brand-mark__text">${escapeHtml(companyName)}</span></a>`;
}

function renderServices(items) {
  return (items || [])
    .map((item) => `
    <article class="service-card">
      <div class="service-card__media">
        <span class="service-card__badge">Tjanst</span>
      </div>
      <h3 class="service-card__title">${escapeHtml(item.title)}</h3>
      <p class="service-card__text">${escapeHtml(item.description)}</p>
    </article>
  `)
    .join("");
}

function renderUsp(items) {
  return (items || [])
    .map((item) => `<li class="usp-list__item">${escapeHtml(item)}</li>`)
    .join("");
}

function renderTestimonials(testimonials) {
  if (!testimonials?.enabled) return "";

  const cards = (testimonials.items || [])
    .map((item) => `
    <article class="testimonial-card">
      <h3 class="testimonial-card__name">${escapeHtml(item.name)}</h3>
      <p class="testimonial-card__text">\"${escapeHtml(item.quote)}\"</p>
    </article>
  `)
    .join("");

  if (!cards) return "";

  return `
    <section class="testimonials-section section-spacing">
      <div class="site-container">
        <p class="section-eyebrow">Omdomen</p>
        <h2 class="section-title">${escapeHtml(testimonials.heading)}</h2>
        <div class="testimonials-grid">${cards}</div>
      </div>
    </section>
  `;
}

function renderFaq(faq) {
  if (!faq?.enabled) return "";

  const items = (faq.items || [])
    .map((item) => `
    <article class="faq-item">
      <h3 class="faq-item__question">${escapeHtml(item.question)}</h3>
      <p class="faq-item__answer">${escapeHtml(item.answer)}</p>
    </article>
  `)
    .join("");

  if (!items) return "";

  return `
    <section id="faq" class="faq-section section-spacing">
      <div class="site-container">
        <p class="section-eyebrow">FAQ</p>
        <h2 class="section-title">${escapeHtml(faq.heading)}</h2>
        <div class="faq-list">${items}</div>
      </div>
    </section>
  `;
}

function renderSocialLinks(links) {
  const entries = Object.entries(links || {}).filter(([, url]) => Boolean(url));
  if (!entries.length) {
    return '<span class="site-footer__meta">Inga sociala lankar angivna.</span>';
  }

  return entries
    .map(
      ([key, url]) =>
        `<a class="site-footer__social-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(key)}</a>`
    )
    .join("");
}

function renderGallery(gallery) {
  if (!Array.isArray(gallery) || gallery.length === 0) {
    return "";
  }

  const items = gallery
    .map(
      (item) => `
      <figure class="gallery-card">
        <img class="gallery-card__image" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt)}">
      </figure>
    `
    )
    .join("");

  return `
    <section id="gallery" class="gallery-section section-spacing">
      <div class="site-container">
        <p class="section-eyebrow">Bilder</p>
        <h2 class="section-title">Inblick i verksamheten</h2>
        <div class="gallery-grid">${items}</div>
      </div>
    </section>
  `;
}

function renderPage(content) {
  const template = fs.readFileSync(templatePath, "utf8");
  const enriched = {
    ...content,
    og: {
      locale: localeFromLanguage(content.site.language)
    },
    contact: {
      ...content.contact,
      phoneRaw: String(content.contact.phone || "").replace(/\s+/g, "")
    },
    seo: {
      ...content.seo,
      ogImage: content.media?.heroImage?.url || "assets/og-default.svg"
    }
  };

  let html = template
    .replace("{{headerBrand}}", renderBrand({
      companyName: content.site.displayName,
      logoUrl: content.media?.logoUrl,
      className: "brand-mark"
    }))
    .replace("{{footerBrand}}", renderBrand({
      companyName: content.footer.companyName,
      logoUrl: content.media?.logoUrl,
      className: "brand-mark brand-mark--footer"
    }))
    .replace("{{servicesList}}", renderServices(content.services.items))
    .replace("{{uspList}}", renderUsp(content.usp.items))
    .replace("{{gallerySection}}", renderGallery(content.media?.gallery))
    .replace("{{testimonialsSection}}", renderTestimonials(content.testimonials))
    .replace("{{faqSection}}", renderFaq(content.faq))
    .replace("{{socialLinks}}", renderSocialLinks(content.footer.socialLinks));

  html = html.replace(/{{\s*([\w.]+)\s*}}/g, (_, keyPath) => escapeHtml(get(enriched, keyPath)));
  return html;
}

(function build() {
  const content = readJson(contentPath);
  const html = renderPage(content);
  fs.writeFileSync(outputPath, html);
  console.log("Built index.html from content/home.json");
})();
