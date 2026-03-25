const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const contentPath = path.join(projectRoot, 'content', 'home.json');
const templatePath = path.join(projectRoot, 'src', 'template.html');
const outputPath = path.join(projectRoot, 'index.html');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function get(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : ''), obj);
}

function localeFromLanguage(language) {
  return language === 'sv' ? 'sv_SE' : 'en_US';
}

function renderServices(items) {
  return items.map((item) => `
    <article class="service-card" id="${escapeHtml(item.id)}">
      <h3 class="service-card__title">${escapeHtml(item.title)}</h3>
      <p class="service-card__text">${escapeHtml(item.text)}</p>
    </article>
  `).join('');
}

function renderUsp(items) {
  return items.map((item) => `<li class="usp-list__item">${escapeHtml(item.label)}</li>`).join('');
}

function renderTestimonials(testimonials) {
  if (!testimonials.enabled) return '';
  const cards = testimonials.items.map((item) => `
    <article class="testimonial-card" id="${escapeHtml(item.id)}">
      <h3 class="testimonial-card__name">${escapeHtml(item.name)}</h3>
      <p class="testimonial-card__text">“${escapeHtml(item.text)}”</p>
    </article>
  `).join('');

  return `
    <section class="testimonials-section section-spacing">
      <div class="site-container">
        <p class="section-eyebrow">Omdömen</p>
        <h2 class="section-title">${escapeHtml(testimonials.title)}</h2>
        <div class="testimonials-grid">${cards}</div>
      </div>
    </section>
  `;
}

function renderFaq(faq) {
  if (!faq.enabled) return '';
  const items = faq.items.map((item) => `
    <article class="faq-item" id="${escapeHtml(item.id)}">
      <h3 class="faq-item__question">${escapeHtml(item.question)}</h3>
      <p class="faq-item__answer">${escapeHtml(item.answer)}</p>
    </article>
  `).join('');

  return `
    <section id="faq" class="faq-section section-spacing">
      <div class="site-container">
        <p class="section-eyebrow">FAQ</p>
        <h2 class="section-title">${escapeHtml(faq.title)}</h2>
        <div class="faq-list">${items}</div>
      </div>
    </section>
  `;
}

function renderSocialLinks(links) {
  const entries = Object.entries(links || {}).filter(([, url]) => url);
  if (!entries.length) {
    return '<span class="site-footer__meta">Lägg till sociala länkar i content/home.json</span>';
  }

  return entries
    .map(([key, url]) => `<a class="site-footer__social-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(key)}</a>`)
    .join('');
}

function renderPage(content) {
  const template = fs.readFileSync(templatePath, 'utf8');
  const enriched = {
    ...content,
    og: {
      locale: localeFromLanguage(content.site.language)
    },
    contact: {
      ...content.contact,
      phoneRaw: String(content.contact.phone || '').replace(/\s+/g, '')
    },
    seo: {
      ...content.seo,
      ogImage: content.seo.ogImage || '/assets/og-default.svg'
    }
  };

  let html = template
    .replace('{{servicesList}}', renderServices(content.services.items))
    .replaceAll('{{uspList}}', renderUsp(content.usp.items))
    .replace('{{testimonialsSection}}', renderTestimonials(content.testimonials))
    .replace('{{faqSection}}', renderFaq(content.faq))
    .replace('{{socialLinks}}', renderSocialLinks(content.footer.socialLinks));

  html = html.replace(/{{\s*([\w.]+)\s*}}/g, (_, keyPath) => escapeHtml(get(enriched, keyPath)));
  return html;
}

function validate(content) {
  const requiredPaths = [
    'site.language',
    'brand.companyName',
    'seo.title',
    'seo.description',
    'seo.canonicalUrl',
    'hero.title',
    'services.items',
    'contact.phone',
    'footer.companyName'
  ];

  for (const keyPath of requiredPaths) {
    const value = get(content, keyPath);
    if (value === '' || value == null || (Array.isArray(value) && value.length === 0)) {
      throw new Error(`Missing required content field: ${keyPath}`);
    }
  }
}

(function build() {
  const content = readJson(contentPath);
  validate(content);
  const html = renderPage(content);
  fs.writeFileSync(outputPath, html);
  console.log('Built index.html from content/home.json');
})();
