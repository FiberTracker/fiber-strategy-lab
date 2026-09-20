(() => {
  'use strict';

  const app = document.getElementById('app');
  const body = document.body;
  const config = {
    page: body.dataset.page || 'home',
    content: body.dataset.content || 'content.json',
    counties: body.dataset.counties || 'counties.geojson',
    base: body.dataset.base || ''
  };
  const state = { data: null, sources: new Map(), selectedTargets: new Set(), compareFocus: null };

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const arr = (value) => Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
  const isPresent = (value) => value !== null && value !== undefined && value !== '';
  const valueOr = (value, fallback = 'Not disclosed') => isPresent(value) ? value : fallback;
  const numberOr = (value, fallback = 'Not reported') => {
    if (value === 0) return '0';
    if (!isPresent(value) || Number.isNaN(Number(value))) return fallback;
    return Number(value).toLocaleString('en-US');
  };
  const compactNumber = (value, fallback = 'Not reported') => {
    if (value === 0) return '0';
    if (!isPresent(value) || Number.isNaN(Number(value))) return fallback;
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value));
  };
  const percent = (value, fallback = 'Not reported') => {
    if (!isPresent(value) || Number.isNaN(Number(value))) return fallback;
    return `${(Number(value) * 100).toFixed(1)}%`;
  };
  const sourceIds = (item) => arr(item?.sourceIds || item?.source_ids || item?.sources);
  const rootPath = () => config.base || './';
  const pagePath = (page) => {
    const paths = { home: '', omni: 'omni-lit/', rightfiber: 'rightfiber/', greatplains: 'great-plains/', states: 'states/' };
    return `${rootPath()}${paths[page] || ''}`;
  };
  const navPageKey = (id) => ({ 'omni-lit': 'omni', 'great-plains': 'greatplains' }[id] || id);
  const commaList = (items, fallback = 'Not disclosed') => {
    const values = arr(items).map((item) => typeof item === 'string' ? item : item?.name || item?.title || '').filter(Boolean);
    return values.length ? values.join(', ') : fallback;
  };
  const safeHref = (url) => /^https?:\/\//i.test(String(url || '')) ? String(url) : '';

  function sourceLinks(ids) {
    const values = arr(ids);
    if (!values.length) return '';
    return `<span class="source-links">${values.map((id) => {
      const source = state.sources.get(id);
      const href = safeHref(source?.url) || `${pagePath('states')}#source-${encodeURIComponent(id)}`;
      const label = source ? id : `${id} (source pending)`;
      return `<a class="source-link" href="${esc(href)}"${safeHref(source?.url) ? ' target="_blank" rel="noopener noreferrer"' : ''} aria-label="Source ${esc(id)}">[${esc(label)}]</a>`;
    }).join('')}</span>`;
  }

  function sourceTitle(ids) {
    return arr(ids).map((id) => state.sources.get(id)?.title || id).join('; ');
  }

  function header(data) {
    const fallback = [
      { id: 'omni', title: 'Omni + Lit', subtitle: 'Carrier platform' },
      { id: 'rightfiber', title: 'Rightfiber', subtitle: 'Southern targets' },
      { id: 'greatplains', title: 'Great Plains', subtitle: 'Enterprise / wholesale' },
      { id: 'states', title: 'State Atlas', subtitle: 'FCC availability' }
    ];
    const nav = arr(data.navigation).length ? data.navigation : fallback;
    const navLinks = nav.map((item) => {
      const id = navPageKey(item.id || item.key || '');
      const current = (config.page === id || (config.page === 'home' && id === 'home')) ? ' aria-current="page"' : '';
      return `<a href="${esc(pagePath(id))}"${current}>${esc(item.title || id)}</a>`;
    }).join('');
    const asOf = data.meta?.asOf ? `As of ${esc(data.meta.asOf)}` : 'Public-source research';
    return `<header class="site-header">
      <div class="header-inner">
        <div class="brand-row">
          <a class="brand" href="${esc(pagePath('home'))}">Fiber <span>Strategy Lab</span></a>
          <div class="edition">${asOf}<br>Public research bundle</div>
        </div>
        <nav class="primary-nav" aria-label="Research sections">
          <a href="${esc(pagePath('home'))}"${config.page === 'home' ? ' aria-current="page"' : ''}>Overview</a>
          ${navLinks}
          <a class="atlas-link" href="${esc(pagePath('states'))}#sources">Evidence register</a>
        </nav>
      </div>
    </header>`;
  }

  function footer(data) {
    const limits = arr(data.limitations);
    const limitationList = limits.length
      ? `<ul>${limits.slice(0, 5).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
      : '<p>Limitations are being integrated with the evidence file.</p>';
    return `<footer class="site-footer">
      <div class="shell footer-grid">
        <div>
          <p><strong>Scope and definitions</strong></p>
          <p>${esc(data.meta?.scope || 'Public-source operating, company, and availability context.')}</p>
          <p>FCC counts are reported availability locations within the stated technology and residential filters. They are not passings, subscribers, construction completions, or a measure of unique regional coverage.</p>
        </div>
        <div>
          <p><strong>Limitations carried with the data</strong></p>
          ${limitationList}
        </div>
      </div>
    </footer>`;
  }

  function metricStrip(metrics) {
    const rows = arr(metrics).slice(0, 4);
    if (!rows.length) return '';
    return `<section class="metric-strip" aria-label="Key metrics">${rows.map((metric) => `<div class="metric">
      <div class="metric-label">${esc(metric.label || metric.name || 'Metric')}</div>
      <div class="metric-value">${esc(valueOr(metric.value, 'Not reported'))}</div>
      <div class="metric-note">${esc(metric.note || metric.definition || '')}${sourceLinks(sourceIds(metric))}</div>
    </div>`).join('')}</section>`;
  }

  function hero({ eyebrow, title, lede, decision, compact = false }) {
    return `<section class="hero"><div class="shell hero-grid">
      <div>
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1 class="${compact ? 'compact' : ''}">${esc(title)}</h1>
        <p class="hero-lede">${esc(lede)}</p>
      </div>
      <aside class="decision-box" aria-label="Decision framing">
        <p class="label">Decision framing</p>
        <p>${esc(decision || 'Decision framework is being integrated with the current evidence set.')}</p>
      </aside>
    </div></section>`;
  }

  function evidenceChronology(data, omni) {
    const raw = arr(omni.timeline);
    if (raw.length) {
      return raw.map((entry) => ({
        date: entry.date || entry.period || 'Date not supplied',
        title: entry.title || 'Public evidence',
        text: entry.text || entry.detail || '',
        ids: sourceIds(entry)
      }));
    }
    const seen = new Set();
    const entries = [];
    arr(omni.facts).forEach((fact) => {
      sourceIds(fact).forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        const source = state.sources.get(id);
        entries.push({
          date: source?.date || 'Date not supplied',
          title: fact.title || source?.title || 'Public evidence',
          text: fact.text || '',
          ids: [id]
        });
      });
    });
    return entries.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 8);
  }

  function renderOmni(data) {
    const omni = data.omni || {};
    const carriers = arr(data.carriers);
    const demographics = arr(omni.demographics).sort((a, b) => Number(b.median_household_income_2024_dollars || -1) - Number(a.median_household_income_2024_dollars || -1));
    const chronology = evidenceChronology(data, omni);
    const angleCards = arr(omni.angles).map((angle) => `<article class="analysis-card">
      <span class="verdict">${esc(angle.verdict || 'Analytical lens')}</span>
      <h3>${esc(angle.title || 'Strategy consideration')}</h3>
      <p>${esc(angle.case || angle.text || '')}${sourceLinks(sourceIds(angle))}</p>
      <div class="analysis-row">
        <div><h4>Countercase</h4><p class="counter">${esc(angle.countercase || 'Counterevidence not supplied.')}</p></div>
        <div><h4>Needed proof</h4><ul class="proof-list">${arr(angle.proof).length ? arr(angle.proof).map((item) => `<li>${esc(item)}</li>`).join('') : '<li>Specific operating evidence not supplied.</li>'}</ul></div>
      </div>
    </article>`).join('');
    const facts = arr(omni.facts).map((fact) => `<li><h3>${esc(fact.title || 'Public fact')}</h3><p>${esc(fact.text || '')}${sourceLinks(sourceIds(fact))}</p></li>`).join('');
    const carrierRows = carriers.map((carrier) => `<tr>
      <td class="table-name">${esc(carrier.name || 'Carrier')}</td>
      <td>${esc(carrier.priority || 'Not ranked')}</td>
      <td>${esc(carrier.pitch_inference || carrier.pitchInference || 'Not supplied')}</td>
      <td>${esc(carrier.best_structure_hypothesis || carrier.bestStructureHypothesis || 'Not supplied')}</td>
      <td>${esc(carrier.challenge || carrier.countercase || 'Not supplied')}${sourceLinks(sourceIds(carrier))}</td>
    </tr>`).join('');
    const demographicsRows = demographics.map((county) => `<tr>
      <td class="table-name">${esc(county.name || county.geoid || 'County')}</td>
      <td class="numeric">$${numberOr(county.median_household_income_2024_dollars)}</td>
      <td class="numeric">±$${numberOr(county.income_margin_of_error_90pct)}</td>
      <td class="numeric">${numberOr(county.housing_units)}</td>
      <td class="numeric">${percent(county.share_units_in_structures_5_plus)}</td>
      <td class="numeric">${percent(county.renter_share_of_occupied_housing_units)}</td>
    </tr>`).join('');
    const chronologyRows = chronology.length ? chronology.map((entry) => `<div class="timeline-entry">
      <div class="timeline-date">${esc(entry.date)}</div><p><strong>${esc(entry.title)}</strong><br>${esc(entry.text)}${sourceLinks(entry.ids)}</p>
    </div>`).join('') : '<div class="empty"><h3>Chronology pending</h3><p>Public dated evidence will appear here when it is carried into the canonical content.</p></div>';
    return `${hero({
      eyebrow: 'Omni + Lit Fiber | public strategic review',
      title: omni.title || 'Omni + Lit Fiber',
      lede: omni.lede || 'Public-source platform, build, and carrier-context analysis.',
      decision: omni.decision
    })}
    <div class="shell">${metricStrip(omni.metrics)}</div>
    <main id="main" tabindex="-1" class="shell">
      <section class="section"><div class="section-head"><div><p class="section-kicker">Carrier proposition</p><h2>Decision before description</h2><p class="section-intro">Each point separates an evidenced capability from the proof still required to convert it into a carrier or capital case.</p></div></div>
      <div class="grid-2">${angleCards || '<div class="empty"><h3>Strategy analysis pending</h3><p>The canonical research file has not supplied public analytical lenses.</p></div>'}</div></section>
      <section class="section"><div class="section-head"><div><p class="section-kicker">Build / financing timeline</p><h2>Dated evidence, not a constructed operating history</h2><p class="section-intro">Entries identify the underlying public source and do not convert targets, availability filings, or announcements into completed builds.</p></div></div><div class="timeline">${chronologyRows}</div></section>
      <section class="section"><div class="section-head"><div><p class="section-kicker">Verified facts</p><h2>What the public record establishes</h2></div></div><ul class="evidence-list">${facts || '<li><p>Public facts are being integrated.</p></li>'}</ul></section>
      <section class="section"><div class="section-head"><div><p class="section-kicker">Carrier comparison</p><h2>Strategic fit depends on incremental economics</h2><p class="section-intro">The structure column is analytical inference. It is not evidence of buyer interest, an offer, or a transaction process.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Carrier</th><th>Public priority</th><th>Pitch angle</th><th>Structure hypothesis</th><th>Countercase / diligence</th></tr></thead><tbody>${carrierRows || '<tr><td colspan="5">Carrier comparison has not been supplied.</td></tr>'}</tbody></table></div></section>
      <section class="section"><div class="section-head"><div><p class="section-kicker">County income context</p><h2>Local context is not customer economics</h2><p class="section-intro">ACS 2020–2024 5-year estimates describe each county, not an Omni footprint-weighted customer base. Income margin of error is shown alongside the estimate.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>County</th><th class="numeric">Median household income</th><th class="numeric">Income MOE</th><th class="numeric">Housing units</th><th class="numeric">5+ unit structures</th><th class="numeric">Renter share</th></tr></thead><tbody>${demographicsRows || '<tr><td colspan="6">County demographic context has not been supplied.</td></tr>'}</tbody></table></div>
      <div class="method"><strong>Interpretation:</strong> County demographics provide market context only. Address-level service status, actual customer cohorts, and property rights are required to test uptake or MDU value.${sourceLinks(['acs'])}</div></section>
    </main>`;
  }

  function normalizeTarget(target) {
    const priorityRaw = String(target?.priority ?? target?.rank ?? '').trim();
    const priorityClass = /^(1|a|high|tier 1|p1)/i.test(priorityRaw) ? 'high' : /^(2|b|medium|tier 2|p2)/i.test(priorityRaw) ? 'medium' : 'low';
    const toText = (value) => Array.isArray(value) ? value.filter(Boolean).join(' • ') : typeof value === 'object' && value ? Object.values(value).filter(Boolean).join(' • ') : value;
    return {
      id: String(target?.id ?? target?.name ?? '').trim(),
      name: toText(target?.name) || 'Unnamed company',
      owner: toText(target?.owner ?? target?.owner_status),
      states: arr(target?.states).map(String),
      clusters: toText(target?.clusters),
      role: toText(target?.role),
      priority: priorityRaw || 'Not ranked',
      priorityClass,
      lenses: arr(target?.lenses).map((lens) => String(lens).toLowerCase()),
      publicFacts: arr(target?.publicFacts ?? target?.public_facts ?? target?.facts),
      buildEvidence: arr(target?.buildEvidence ?? target?.build_evidence),
      scale: arr(target?.scale ?? target?.scale_with_unit_date),
      fit: toText(target?.fit ?? target?.fit_inference ?? target?.pitch_inference),
      structure: toText(target?.structure ?? target?.transaction_route ?? target?.best_structure_hypothesis),
      constraint: toText(target?.constraint ?? target?.constraints),
      countercase: toText(target?.countercase ?? target?.counter_case),
      sourceIds: sourceIds(target),
      raw: target
    };
  }

  function lensTargets(data, lens) {
    const pageTargets = arr(data[lens]?.targets);
    const allTargets = arr(data.targets);
    const candidates = pageTargets.length ? pageTargets : allTargets.filter((target) => arr(target?.lenses).map((value) => String(value).toLowerCase()).includes(lens));
    return candidates.map(normalizeTarget).filter((target) => target.id || target.name !== 'Unnamed company');
  }

  function platformMetric(label, value, note) {
    return `<div><div class="platform-metric">${esc(label)}</div><strong>${esc(value)}</strong>${note ? `<p>${esc(note)}</p>` : ''}</div>`;
  }

  function platformBanner(platform) {
    const passings = platform?.reported_ftth_passings;
    const passingValue = isPresent(passings?.value) ? `${passings.qualifier === 'over' ? '>' : ''}${compactNumber(passings.value)}` : 'Not reported';
    return `<section class="platform-banner" aria-label="Current platform perimeter">
      <div><p class="section-kicker" style="color:#9bddd7">Current platform perimeter</p><h2>${esc(platform?.name || 'Platform perimeter pending')}</h2><p>${esc(platform?.owner || 'Ownership not supplied')}</p><p>${esc(platform?.transaction_status || 'Transaction status not supplied')}${sourceLinks(sourceIds(platform))}</p></div>
      ${platformMetric('Reported FTTH passings', passingValue, passings?.unit ? `${passings.unit}${passings.date ? `, ${passings.date}` : ''}` : '')}
      ${platformMetric('Reported network miles', compactNumber(platform?.reported_network_miles), 'Company-reported perimeter')}
      ${platformMetric('Reported states', valueOr(platform?.reported_states, 'Not reported'), 'Network reach, not necessarily residential FTTH')}
    </section>`;
  }

  function targetFilters(targets, lens) {
    const states = [...new Set(targets.flatMap((target) => target.states))].sort();
    const roles = [...new Set(targets.map((target) => target.role).filter(Boolean))].sort();
    const priorities = [...new Set(targets.map((target) => target.priority).filter(Boolean))].sort();
    return `<div class="filter-bar" aria-label="Filter company dossiers">
      <div class="field"><label for="target-name">Company name</label><input id="target-name" type="search" autocomplete="off" placeholder="Search company"></div>
      <div class="field"><label for="target-state">Research geography</label><select id="target-state"><option value="">All states</option>${states.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></div>
      <div class="field"><label for="target-role">Role</label><select id="target-role"><option value="">All roles</option>${roles.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></div>
      <div class="field"><label for="target-priority">Priority</label><select id="target-priority"><option value="">All priorities</option>${priorities.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></div>
      <div class="filter-actions"><button id="download-targets" class="button secondary" type="button">Download full target CSV</button><button id="compare-targets" class="button" type="button" disabled>Compare selected</button></div>
    </div><p id="target-result-count" class="result-count"></p><div id="target-dossiers"></div>`;
  }

  function targetDossier(target) {
    const facts = target.publicFacts.length ? `<ul class="proof-list">${target.publicFacts.map((fact) => `<li>${esc(fact)}</li>`).join('')}</ul>` : '<p class="small">No public fact block has been carried into this dossier.</p>';
    const build = target.buildEvidence.length ? `<ul class="proof-list">${target.buildEvidence.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="small">No build-specific evidence has been supplied.</p>';
    const scale = target.scale.length ? target.scale.map((item) => esc(item)).join('<br>') : 'Not disclosed';
    return `<details class="dossier" data-target-id="${esc(target.id)}"><summary>
      <span><span class="dossier-name">${esc(target.name)}</span><br><span class="dossier-meta">${esc(target.owner || 'Owner status not supplied')}</span></span>
      <span><span class="priority ${esc(target.priorityClass)}">${esc(target.priority)}</span><br><span class="dossier-meta">${esc(target.role || 'Role not supplied')}</span><label class="check-label"><input type="checkbox" data-compare-id="${esc(target.id)}" ${state.selectedTargets.has(target.id) ? 'checked' : ''}> Compare</label></span>
      <span class="dossier-meta">${esc(commaList(target.states))}</span>
      <span class="dossier-meta">${esc(target.clusters || 'Cluster not supplied')}</span>
    </summary><div class="dossier-body">
      <div><h4>Public facts</h4>${facts}<h4 style="margin-top:18px">Build / operating evidence</h4>${build}<p class="small">${sourceLinks(target.sourceIds)} ${esc(sourceTitle(target.sourceIds))}</p></div>
      <div class="fact-stack">
        <section><h4>Historical FCC reporting identities</h4><p>${arr(target.raw.filerLinks).map(x=>`<a href="${pagePath('states')}?provider=${encodeURIComponent(x.id)}">${esc(x.name)} (${esc(x.id)})</a>`).join('<br>') || 'No reporting-identity link resolved in this screen.'}</p><p class="small">${esc(target.raw.filerMappingStatus || '')}</p></section><section><h4>Scale with unit / date</h4><p>${scale}</p></section>
        <section><h4>Public analytical fit</h4><p>${esc(target.fit || 'Analytical fit has not been supplied.')}</p></section>
        <section><h4>Potential transaction route</h4><p>${esc(target.structure || 'No transaction route is implied by this dossier.')}</p></section>
        <section><h4>Constraints</h4><p>${esc(target.constraint || 'Not separately supplied')}</p></section><section class="countercase"><h4>Countercase / needed proof</h4><p>${esc(target.countercase || 'Further diligence is required.')}</p></section>
      </div>
    </div></details>`;
  }

  function emptyTargets(lens) {
    const label = lens === 'rightfiber' ? 'Rightfiber' : 'Great Plains';
    return `<div class="empty"><h3>${label} dossiers are not yet in the canonical content</h3><p>The filters, comparison, and export are ready. No placeholder companies are displayed while public research is still being reviewed.</p></div>`;
  }

  function targetCsv(targets) {
    const headers = ['id', 'name', 'owner', 'states', 'clusters', 'role', 'priority', 'public_facts', 'build_evidence', 'scale_with_unit_date', 'fit_inference', 'transaction_route', 'constraints', 'countercase', 'source_ids'];
    const quote = (value) => {let text=String(value ?? '');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
    const lines = targets.map((target) => [target.id, target.name, target.owner, target.states.join('; '), target.clusters, target.role, target.priority, target.publicFacts.join(' | '), target.buildEvidence.join(' | '), target.scale.join(' | '), target.fit, target.structure, target.constraint, target.countercase, target.sourceIds.join('; ')].map(quote).join(','));
    return [headers.join(','), ...lines].join('\n');
  }

  function bindTargets(data, lens, targets) {
    const name = document.getElementById('target-name');
    const stateSelect = document.getElementById('target-state');
    const role = document.getElementById('target-role');
    const priority = document.getElementById('target-priority');
    const list = document.getElementById('target-dossiers');
    const count = document.getElementById('target-result-count');
    const compare = document.getElementById('compare-targets');
    const download = document.getElementById('download-targets');
    if (!list || !count) return;
    const filtered = () => targets.filter((target) => {
      const query = String(name?.value || '').trim().toLowerCase();
      const candidate = [target.name, target.owner, target.clusters, target.role, target.states.join(' ')].join(' ').toLowerCase();
      return (!query || candidate.includes(query))
        && (!stateSelect?.value || target.states.includes(stateSelect.value))
        && (!role?.value || target.role === role.value)
        && (!priority?.value || target.priority === priority.value);
    });
    const refreshCompare = () => {
      const selected = targets.filter((target) => state.selectedTargets.has(target.id));
      compare.disabled = !selected.length;
      compare.textContent = selected.length ? `Compare selected (${selected.length})` : 'Compare selected';
    };
    const render = () => {
      const rows = filtered();
      count.innerHTML = `<strong>${rows.length}</strong> ${rows.length === 1 ? 'company dossier' : 'company dossiers'} shown${targets.length ? ` of ${targets.length} in the ${esc(lens)} lens` : ''}. Select up to three for comparison.`;
      list.innerHTML = rows.length ? rows.map(targetDossier).join('') : `<div class="empty"><h3>No company matches these filters</h3><p>Clear one or more filters to return to the current curated public dossier set.</p></div>`;
      list.querySelectorAll('input[data-compare-id]').forEach((toggle) => {
        const id = toggle.dataset.compareId;
        toggle.closest('label')?.addEventListener('click', (event) => event.stopPropagation());
        toggle.addEventListener('change', (event) => {
          if (event.target.checked && state.selectedTargets.size >= 3) {
            event.target.checked = false;
            count.textContent = 'Comparison is limited to three companies. Remove one selection before adding another.';
            return;
          }
          if (event.target.checked) state.selectedTargets.add(id); else state.selectedTargets.delete(id);
          refreshCompare();
        });
      });
      refreshCompare();
    };
    [name, stateSelect, role, priority].filter(Boolean).forEach((input) => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', render));
    download?.addEventListener('click', () => {
      if (!targets.length) return;
      const blob = new Blob([targetCsv(targets)], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${lens}-public-targets.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    });
    if (!targets.length) download.disabled = true;
    compare?.addEventListener('click', () => openComparison(targets, compare));
    render();
  }

  function openComparison(targets, opener) {
    const selected = targets.filter((target) => state.selectedTargets.has(target.id));
    if (!selected.length) return;
    const old = document.getElementById('compare-dialog');
    old?.remove();
    const fields = [
      ['Owner status', (target) => target.owner],
      ['States / cluster', (target) => `${target.states.join(', ') || 'Not disclosed'}${target.clusters ? `\n${target.clusters}` : ''}`],
      ['Role / priority', (target) => `${target.role || 'Not disclosed'}\n${target.priority}`],
      ['Scale with unit / date', (target) => target.scale.join('\n') || 'Not disclosed'],
      ['Public analytical fit', (target) => target.fit || 'Not supplied'],
      ['Potential transaction route', (target) => target.structure || 'Not supplied'],
      ['Constraint / countercase', (target) => target.countercase || target.constraint || 'Not supplied'],
      ['Sources', (target) => sourceTitle(target.sourceIds) || 'Source register pending']
    ];
    const dialog = document.createElement('dialog');
    dialog.id = 'compare-dialog';
    dialog.innerHTML = `<div class="dialog-header"><div><p class="eyebrow" style="color:#9bddd7">Company comparison</p><h2>${selected.length} curated public dossiers</h2></div><button class="dialog-close" type="button" aria-label="Close comparison">×</button></div>
      <div class="dialog-body"><div class="table-wrap"><table class="comparison-table"><thead><tr><th>Field</th>${selected.map((target) => `<th>${esc(target.name)}</th>`).join('')}</tr></thead><tbody>${fields.map(([label, getter]) => `<tr><th>${esc(label)}</th>${selected.map((target) => `<td>${esc(getter(target)).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    document.body.appendChild(dialog);
    const close = () => { dialog.close(); dialog.remove(); opener?.focus(); };
    dialog.querySelector('.dialog-close').addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    dialog.showModal();
    dialog.querySelector('.dialog-close').focus();
  }

  function renderTargetPage(data, lens) {
    const page = data[lens] || {};
    const platform = data.platform || {};
    const targets = lensTargets(data, lens);
    const title = page.title || (lens === 'rightfiber' ? 'Rightfiber target screen' : 'Great Plains target screen');
    const lede = page.lede || 'Curated public research and analytical fit assessment.';
    const exclusions = arr(platform.acquisition_exclusions);
    const exclusionRows = exclusions.map((item) => `<tr><td class="table-name">${esc(item.name || 'Platform perimeter item')}</td><td>${esc(item.status || 'Status not supplied')}${sourceLinks(sourceIds(item))}</td><td>${esc(item.implication || 'Implication not supplied')}</td></tr>`).join('');
    return `${hero({ eyebrow: `${lens === 'rightfiber' ? 'Rightfiber' : 'Great Plains'} | public target screen`, title, lede, decision: page.decision, compact: true })}
    <main id="main" tabindex="-1" class="shell">
      <section class="section" style="padding-top:28px">${platformBanner(platform)}<p class="perimeter-note"><strong>Perimeter discipline:</strong> ${esc(platform.scope_limitation || 'Company perimeter is being reconciled.')}${sourceLinks(sourceIds(platform))}</p></section>
      <section class="section"><div class="section-head"><div><p class="section-kicker">Curated company dossiers</p><h2>Public analytical fit, not a sale-process assertion</h2><p class="section-intro">These dossiers are a curated analytical screen. The full state FCC universe remains available in the <a href="${esc(pagePath('states'))}">State Atlas</a>; it is not a list of acquisition candidates.</p></div></div>
      ${targets.length ? targetFilters(targets, lens) : emptyTargets(lens)}</section>
      ${exclusionRows ? `<section class="section"><div class="section-head"><div><p class="section-kicker">Current perimeter exceptions</p><h2>Announced and closed are kept separate</h2></div></div><div class="table-wrap"><table><thead><tr><th>Asset / perimeter</th><th>Status</th><th>Screen implication</th></tr></thead><tbody>${exclusionRows}</tbody></table></div></section>` : ''}
      <section class="section"><div class="method"><strong>Use of priority:</strong> Public priority is a research ranking based on the supplied public evidence and stated platform lens. It is not a view of seller willingness, deal status, relationship history, valuation, or buyer interest.</div></section>
    </main>`;
  }

  function atlasMetrics(data) {
    const atlas = data.atlas || {};
    const metrics = data.meta?.metrics || {};
    const states = arr(atlas.states);
    const complete = states.filter((row) => row.complete === true).length;
    return metricStrip([
      { label: 'States screened', value: valueOr(metrics.states, states.length || 'Not reported'), note: `Completed: ${complete} / ${states.length}` },
      { label: 'FCC filers', value: valueOr(metrics.filers, arr(atlas.providers).length || 'Not reported'), note: `${metrics.residentialFilers} with residential R/X; ${metrics.businessOnlyFilers} business-only` },
      { label: 'Counties with reported residential FTTP', value: valueOr(metrics.counties, Object.keys(atlas.countyNames || {}).length || 'Not reported'), note: data.meta?.acsVintage || 'ACS vintage not supplied' },
      { label: 'FCC vintage', value: data.meta?.fccVintage || 'Not supplied', note: 'Reported availability, not passings or subscribers', sourceIds: ['fcc'] }
    ]);
  }

  function providerRows(providers, countyNames) {
    return providers.map((provider) => {
      const counties = arr(provider.counties);
      const countyLabel = counties.length ? counties.slice(0, 3).map((row) => countyNames?.[row.fips] || row.fips).join('; ') + (counties.length > 3 ? ` +${counties.length - 3}` : '') : (Number(provider.locations)===0 ? 'No qualifying residential R/X locations' : 'County detail not supplied');
      return `<tr><td class="table-name">${esc(provider.name || 'Unnamed filer')}<br><span class="small">${esc(commaList(provider.brands, 'No brand provided'))}</span><br><span class="small">${esc(provider.classification || '')}</span>${provider.ownershipContext ? `<details><summary>Current ownership context</summary><p>${esc(provider.ownershipContext.text)}${sourceLinks(provider.ownershipContext.sourceIds)}</p></details>` : ''}</td><td class="nowrap">${esc(provider.id || 'Not supplied')}</td><td>${esc(commaList(provider.states))}</td><td class="numeric">${numberOr(provider.locations)}</td><td>${esc(countyLabel)}</td><td><span class="quality ${provider.complete === false ? 'incomplete' : ''}">${provider.complete === false ? 'Counts incomplete' : 'Counts reconciled'}</span>${sourceLinks(sourceIds(provider))}</td></tr>`;
    }).join('');
  }

  function renderStates(data) {
    const atlas = data.atlas || {};
    const states = arr(atlas.states);
    const providers = arr(atlas.providers);
    const stateOptions = states.map((row) => `<option value="${esc(row.id || row.fips)}">${esc(row.name || row.id)}</option>`).join('');
    return `${hero({ eyebrow: 'State Atlas | FCC availability context', title: 'Availability is a starting point, not the answer.', lede: 'Search the full measured state filer universe, select a county for local context, and keep reported availability separate from curated company dossiers.', decision: 'Use this atlas to establish reported technology 50 residential R/X availability by filer and county. Confirm current construction, ownership, financing, and transaction status through separate dated evidence.', compact: true })}
    <div class="shell">${atlasMetrics(data)}</div>
    <main id="main" tabindex="-1" class="shell">
      <section class="section"><div class="section-head"><div><p class="section-kicker">Methodology</p><h2>Full state FCC universe, not a target list</h2><p class="section-intro">${esc(atlas.methodology || 'Methodology is being integrated with the FCC data.')}${sourceLinks(['fcc'])}</p><p>${esc(atlas.ownershipMethod || '')}</p></div></div>
      <div class="method"><strong>County map:</strong> county boundaries provide geographic context only. Selecting a county reveals reported availability counts by FCC filer and ACS context. It does not map exact provider coverage within the county.</div></section>
      <section class="section" aria-labelledby="atlas-map-title"><div class="section-head"><div><p class="section-kicker">County context map</p><h2 id="atlas-map-title">Select a county, then inspect its reported filer context</h2></div></div>
      <div class="atlas-layout"><div class="map-card"><div class="map-toolbar"><div><strong id="map-state-title">County geography</strong><br><span class="small">Census county boundaries</span></div><div class="field"><label for="map-state">State</label><select id="map-state">${stateOptions}</select></div></div><div id="county-map-wrap"><div class="empty"><h3>Loading county geography</h3><p>The map remains optional. FCC table search below does not depend on it.</p></div></div><p class="map-caption">Click or focus a county. Map geometry does not establish exact service areas or network routes.</p></div><aside id="county-panel" class="county-panel"><p class="section-kicker">County selection</p><h3>Choose a county</h3><p>Use the map or the county search below to see ACS context and the filers reporting qualifying availability records in that county.</p></aside></div></section>
      <section class="section"><div class="section-head"><div><p class="section-kicker">FCC availability filer rows</p><h2>Search the measured state universe</h2><p class="section-intro">Filer IDs are FCC reporting identities. Counts are deduplicated reported availability locations within the stated filter, not company-wide passings or subscribers.</p></div><button id="download-fcc" class="button secondary" type="button">Export filtered FCC rows</button></div>
      <div class="atlas-controls"><div class="field"><label for="atlas-provider">Provider or exact filer ID</label><input id="atlas-provider" type="search" autocomplete="off" placeholder="Search name, brand, or filer ID"></div><div class="field"><label for="atlas-county">County</label><input id="atlas-county" type="search" autocomplete="off" placeholder="Search county"></div><div class="field"><label for="atlas-state">State universe</label><select id="atlas-state"><option value="">All measured states</option>${stateOptions}</select></div></div>
      <p class="atlas-legend"><span><b>Filter:</b> technology 50 fiber-to-the-premises</span><span><b>Service:</b> residential-capable R/X availability</span><span><b>Units:</b> reported locations, deduplicated per filer / vintage</span><span><b>Files:</b> completed state-file status shown per filer</span></p>
      <p id="atlas-result-count" class="result-count"></p><div class="table-wrap"><table><thead><tr><th>FCC filer / brand</th><th>Exact filer ID</th><th>States</th><th class="numeric">Reported availability locations</th><th>County context</th><th>Source quality</th></tr></thead><tbody id="atlas-provider-rows"></tbody></table></div></section>
      <section id="sources" class="section source-register"><div class="section-head"><div><p class="section-kicker">Evidence register</p><h2>Searchable public source register</h2><p class="section-intro">The register combines primary public disclosures and official datasets. Profile bibliographies support the dossier as a whole; dated claim links appear in the detailed papers.</p></div></div><div class="source-toolbar"><label for="source-search" class="small">Search by source ID, title, date, or type</label><input id="source-search" type="search" autocomplete="off" placeholder="Search evidence register"></div><div class="table-wrap"><table><thead><tr><th>Source ID</th><th>Title</th><th>Date</th><th>Type</th><th>Link</th></tr></thead><tbody id="source-rows"></tbody></table></div></section>
    </main>`;
  }

  function renderHome(data) {
    const meta = data.meta || {};
    const metrics = meta.metrics || {};
    const omni = data.omni || {};
    const subSites = [
      { page: 'omni', title: 'Omni + Lit', text: 'Carrier-platform proposition, verified facts, chronology, and county context.' },
      { page: 'rightfiber', title: 'Rightfiber', text: 'Southern public target screen with dossier filters, comparison, and CSV export.' },
      { page: 'greatplains', title: 'Great Plains', text: 'Enterprise and wholesale lens for the combined platform.' },
      { page: 'states', title: 'State Atlas', text: 'Full measured FCC filer universe, county context map, and evidence register.' }
    ];
    const findings = arr(omni.angles).slice(0, 3).map((item) => `<article class="finding-card"><p class="section-kicker">${esc(item.verdict || 'Analytical finding')}</p><h3>${esc(item.title || 'Research finding')}</h3><p>${esc(item.case || item.text || '')}${sourceLinks(sourceIds(item))}</p></article>`).join('');
    return `${hero({ eyebrow: meta.publicationStatus || 'Public source research', title: meta.title || 'Fiber Strategy Lab', lede: meta.scope || 'Decision-ready public research on fiber platforms, targets, and availability context.', decision: 'Use the four sub-sites to distinguish current platform perimeter, public analytical fit, and reported FCC availability. A curated dossier is not a transaction process, and an FCC row is not a construction claim.' })}
    <div class="shell">${metricStrip([
      { label: 'Measured states', value: valueOr(metrics.states, 'Not reported'), note: `${arr(data.atlas?.states).filter((row) => row.complete).length} reconciled state datasets` },
      { label: 'FCC filer rows', value: valueOr(metrics.filers, 'Not reported'), note: 'Technology 50, residential R/X availability' },
      { label: 'Counties with reported residential FTTP', value: valueOr(metrics.counties, 'Not reported'), note: meta.acsVintage || 'ACS context' },
      { label: 'Public source URLs', value: valueOr(metrics.uniqueSourceUrls, arr(data.sources).length || 'Not reported'), note: `As of ${meta.asOf || 'date not supplied'}` }
    ])}</div>
    <main id="main" tabindex="-1" class="shell">
      <section class="section"><div class="section-head"><div><p class="section-kicker">Research sub-sites</p><h2>Open the decision context you need</h2></div></div><div class="subsite-grid">${subSites.map((site) => `<a class="subsite-card" href="${esc(pagePath(site.page))}"><p class="section-kicker">Public research</p><h2>${esc(site.title)}</h2><p>${esc(site.text)}</p><span class="arrow">Open analysis →</span></a>`).join('')}</div></section>
      <section class="section"><div class="section-head"><div><p class="section-kicker">Current decision context</p><h2>Evidence-backed themes requiring proof</h2><p class="section-intro">The review positions public facts, analytical inference, and unknowns together. It does not infer a sale process, buyer interest, or customer economics from availability data.</p></div></div><div class="grid-3">${findings || '<div class="empty"><h3>Decision themes pending</h3><p>Reviewed public analytical findings will appear here when included in the canonical content.</p></div>'}</div></section>
      <section class="section"><div class="method"><strong>How to read this bundle:</strong> figures retain their original unit and perimeter. Company-reported passings, FCC availability locations, subscribers, targets, announced financing, and closed transactions are not interchangeable. See the <a href="${esc(pagePath('states'))}#sources">evidence register</a> and page-level source links.</div></section>
    </main>`;
  }

  function csvFcc(providers, countyNames) {
    const headers = ['filer_id', 'filer_name', 'brands', 'states', 'reported_availability_locations', 'measurement_scope', 'all_service_locations', 'county_count', 'county_context', 'source_quality', 'source_ids'];
    const quote = (value) => {let text=String(value ?? '');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
    const lines = providers.map((provider) => {
      const names = arr(provider.counties).map((county) => `${countyNames?.[county.fips] || county.fips}: ${county.count ?? ''}`).join(' | ');
      return [provider.id, provider.name, commaList(provider.brands, ''), commaList(provider.states, ''), provider.locations, provider.measurementScope || 'All measured states', provider.allServiceLocations, arr(provider.counties).length, names, provider.complete === false ? 'partial_state_file' : 'completed_state_file', sourceIds(provider).join('; ')].map(quote).join(',');
    });
    return [headers.join(','), ...lines].join('\n');
  }

  function bindAtlas(data) {
    const atlas = data.atlas || {};
    const providers = arr(atlas.providers);
    const countyNames = atlas.countyNames || {};
    const states = arr(atlas.states);
    const stateInput = document.getElementById('atlas-state');
    const providerInput = document.getElementById('atlas-provider');
    const countyInput = document.getElementById('atlas-county');
    const rows = document.getElementById('atlas-provider-rows');
    const count = document.getElementById('atlas-result-count');
    const exportButton = document.getElementById('download-fcc');
    const stateFips = new Map(states.map((item) => [String(item.id || item.fips), String(item.fips || '')]));
    const params = new URLSearchParams(location.search);
    if (params.get('provider')) providerInput.value = params.get('provider');
    if (params.get('state') && states.some(x=>x.id===params.get('state'))) stateInput.value=params.get('state');
    if (params.get('county')) countyInput.value=params.get('county');
    const filtered = () => {
      const query = String(providerInput?.value || '').trim().toLowerCase();
      const cq = String(countyInput?.value || '').trim().toLowerCase();
      const st = stateInput?.value || '';
      const sf = stateFips.get(st);
      return providers.flatMap(provider => {
        const text=[provider.id,provider.name,...arr(provider.brands)].join(' ').toLowerCase();
        if ((query&&!text.includes(query)) || (st&&!arr(provider.states).includes(st))) return [];
        const counties=arr(provider.counties).filter(c=>(!sf||String(c.fips).startsWith(sf))&&(!cq||String(c.fips).includes(cq)||String(countyNames[c.fips]||'').toLowerCase().includes(cq)));
        if(cq&&!counties.length)return [];
        if(!st&&!cq)return [provider];
        const stateRow=arr(provider.stateCoverage).find(x=>x.state===st);
        const locations=st&&!cq&&isPresent(stateRow?.locations)?stateRow.locations:counties.reduce((n,c)=>n+Number(c.count||0),0);
        return [{...provider,counties,states:st?[st]:arr(provider.states).filter(ab=>counties.some(c=>String(c.fips).startsWith(stateFips.get(ab)))),locations,allServiceLocations:null,measurementScope:cq?'Selected matching counties':st+' state'}];
      });
    };
    const render = () => {
      const results = filtered();
      count.innerHTML = `<strong>${results.length}</strong> FCC filer rows shown${stateInput?.value ? ` in ${esc(stateInput.value)}` : ''}. Counts are scoped to the selected state and matching counties, where selected. They are reported technology 50 residential R/X availability locations, deduplicated per filer and FCC vintage.`;
      rows.innerHTML = providerRows(results, countyNames) || '<tr><td colspan="6">No FCC filer rows match the current search.</td></tr>';
    };
    [stateInput, providerInput, countyInput].filter(Boolean).forEach((input) => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', render));
    exportButton?.addEventListener('click', () => {
      const results = filtered();
      const blob = new Blob([csvFcc(results, countyNames)], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'filtered-fcc-availability-rows.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    });
    render();
    bindSourceRegister(data.sources);
    setupCountyMap(data, stateFips, countyInput, stateInput);
  }

  function bindSourceRegister(sources) {
    const search = document.getElementById('source-search');
    const rows = document.getElementById('source-rows');
    if (!rows) return;
    const render = () => {
      const query = String(search?.value || '').trim().toLowerCase();
      const result = arr(sources).filter((source) => [source.id, source.title, source.date, source.type].join(' ').toLowerCase().includes(query));
      rows.innerHTML = result.map((source) => {
        const url = safeHref(source.url);
        return `<tr id="source-${encodeURIComponent(source.id || '')}" class="source-row"><td>${esc(source.id || 'Not supplied')}</td><td>${esc(source.title || 'Untitled source')}</td><td class="nowrap">${esc(source.date || 'Date not supplied')}</td><td>${esc(source.type || 'Public')}</td><td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open source</a>` : '<span class="small">URL not supplied</span>'}</td></tr>`;
      }).join('') || '<tr><td colspan="5">No sources match this search.</td></tr>';
    };
    search?.addEventListener('input', render);
    render();
  }

  function collectCoordinates(geometry) {
    const coords = [];
    const addRing = (ring) => ring.forEach((point) => { if (Array.isArray(point) && point.length >= 2) coords.push(point); });
    if (geometry?.type === 'Polygon') arr(geometry.coordinates).forEach(addRing);
    if (geometry?.type === 'MultiPolygon') arr(geometry.coordinates).forEach((polygon) => arr(polygon).forEach(addRing));
    return coords;
  }

  function geometryPath(geometry, transform) {
    const drawRing = (ring) => arr(ring).map((point, index) => {
      const [x, y] = transform(point);
      return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join('') + 'Z';
    if (geometry?.type === 'Polygon') return arr(geometry.coordinates).map(drawRing).join('');
    if (geometry?.type === 'MultiPolygon') return arr(geometry.coordinates).flatMap((polygon) => arr(polygon).map(drawRing)).join('');
    return '';
  }

  function countyContext(data, fips) {
    const atlas = data.atlas || {};
    const demographic = arr(atlas.demographics).find((row) => String(row.geoid) === String(fips));
    const providers = arr(atlas.providers).map((provider) => ({ provider, count: arr(provider.counties).find((county) => String(county.fips) === String(fips))?.count })).filter((item) => isPresent(item.count)).sort((a, b) => Number(b.count) - Number(a.count));
    return { demographic, providers };
  }

  function renderCountyPanel(data, fips) {
    const panel = document.getElementById('county-panel');
    if (!panel) return;
    const atlas = data.atlas || {};
    const { demographic, providers } = countyContext(data, fips);
    const name = atlas.countyNames?.[fips] || `${fips} County`;
    const total = providers.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const providerList = providers.length ? `<ul class="county-providers">${providers.slice(0, 15).map((item) => `<li><span>${esc(item.provider.name || item.provider.id)}</span><small>${numberOr(item.count)} locations</small></li>`).join('')}</ul>${providers.length > 15 ? `<p class="small">+${providers.length - 15} additional FCC filers. Use the filer table search for the full list.</p>` : ''}` : '<p class="small">No qualifying FCC filer county record was supplied for this selection.</p>';
    panel.innerHTML = `<p class="section-kicker">County selection</p><h3>${esc(name)}</h3><p class="county-fips">FIPS ${esc(fips)} · county geography is context, not exact coverage</p><div class="county-grid">
      <div class="county-stat"><span>FCC filers</span><strong>${numberOr(providers.length)}</strong></div><div class="county-stat"><span>Filer summed availability</span><strong>${compactNumber(total)}</strong></div>
      <div class="county-stat"><span>ACS median income (2024 dollars)</span><strong>${isPresent(demographic?.median_household_income_2024_dollars) ? `$${compactNumber(demographic.median_household_income_2024_dollars)}` : 'Not reported'}</strong></div><div class="county-stat"><span>ACS renter share</span><strong>${percent(demographic?.renter_share_of_occupied_housing_units)}</strong></div>
    </div><p class="small">Filer totals must not be summed into a unique county coverage figure. ACS: ${esc(data.meta?.acsVintage || 'vintage not supplied')}${sourceLinks(['acs'])}</p><h4>Reported qualifying availability by filer</h4>${providerList}`;
  }

  async function setupCountyMap(data, stateFips, countyInput, stateInput) {
    const wrap = document.getElementById('county-map-wrap');
    const stateSelect = document.getElementById('map-state');
    if (!wrap || !stateSelect) return;
    let geometry;
    try {
      const response = await fetch(config.counties, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      geometry = await response.json();
      if (!Array.isArray(geometry.features)) throw new Error('FeatureCollection missing features');
    } catch (error) {
      wrap.innerHTML = '<div class="empty"><h3>County map unavailable</h3><p>County geometry could not be loaded. The FCC universe and source register remain available below.</p></div>';
      return;
    }
    const defaultState = stateSelect.value || arr(data.atlas?.states)[0]?.id || '';
    stateSelect.value = defaultState;
    const draw = () => {
      const selectedState = stateSelect.value;
      const fips = stateFips.get(selectedState) || selectedState;
      const features = geometry.features.filter((feature) => String(feature?.properties?.state_fips) === String(fips));
      if (!features.length) {
        wrap.innerHTML = '<div class="empty"><h3>No county geometry for this state</h3><p>Use the FCC filer table while the geometry set is updated.</p></div>';
        return;
      }
      const coordinates = features.flatMap((feature) => collectCoordinates(feature.geometry));
      const lons = coordinates.map((point) => Number(point[0])).filter(Number.isFinite);
      const lats = coordinates.map((point) => Number(point[1])).filter(Number.isFinite);
      const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const width = 1000, padding = 26;
      const lonSpan = Math.max(maxLon - minLon, .1), latSpan = Math.max(maxLat - minLat, .1);
      const height = Math.max(360, Math.min(760, (latSpan / lonSpan) * width * .82 + padding * 2));
      const scale = Math.min((width - padding * 2) / lonSpan, (height - padding * 2) / latSpan);
      const transform = ([lon, lat]) => [padding + (Number(lon) - minLon) * scale, padding + (maxLat - Number(lat)) * scale];
      const label = arr(data.atlas?.states).find((item) => String(item.id || item.fips) === String(selectedState))?.name || selectedState;
      wrap.innerHTML = `<svg class="county-map" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(label)} county context map"><text class="map-label" x="28" y="38">${esc(label)}</text>${features.map((feature) => {
        const countyFips = String(feature.properties?.fips || '');
        const countyName = data.atlas?.countyNames?.[countyFips] || feature.properties?.name || countyFips;
        return `<path class="county-path" d="${geometryPath(feature.geometry, transform)}" data-fips="${esc(countyFips)}" tabindex="0" role="button" aria-label="Select ${esc(countyName)}"></path>`;
      }).join('')}</svg>`;
      const selectCounty = (countyFips) => {
        wrap.querySelectorAll('.county-path').forEach((path) => path.classList.toggle('is-selected', path.dataset.fips === countyFips));
        renderCountyPanel(data, countyFips);
        if (countyInput) {
          countyInput.value = data.atlas?.countyNames?.[countyFips] || countyFips;
          countyInput.dispatchEvent(new Event('input'));
        }
      };
      wrap.querySelectorAll('.county-path').forEach((path) => {
        path.addEventListener('click', () => selectCounty(path.dataset.fips));
        path.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCounty(path.dataset.fips); } });
      });
    };
    stateSelect.addEventListener('change', () => {
      if (stateInput) stateInput.value = stateSelect.value;
      if (countyInput) countyInput.value = '';
      stateInput?.dispatchEvent(new Event('change'));
      draw();
    });
    countyInput?.addEventListener('change', () => {
      const query = String(countyInput.value || '').trim().toLowerCase();
      if (!query) return;
      const match = Object.entries(data.atlas?.countyNames || {}).find(([, name]) => String(name).toLowerCase() === query || String(name).toLowerCase().includes(query));
      if (!match) return;
      const stateCode = match[0].slice(0, 2);
      const matchingState = [...stateFips.entries()].find(([, fips]) => fips === stateCode)?.[0];
      if (matchingState && stateSelect.value !== matchingState) { stateSelect.value = matchingState; draw(); }
      renderCountyPanel(data, match[0]);
      setTimeout(() => wrap.querySelector(`[data-fips="${match[0]}"]`)?.classList.add('is-selected'), 0);
    });
    draw();
  }

  function renderPage(data) {
    state.data = data;
    state.sources = new Map(arr(data.sources).filter((source) => source?.id).map((source) => [source.id, source]));
    let content;
    if (config.page === 'omni') content = renderOmni(data);
    else if (config.page === 'rightfiber' || config.page === 'greatplains') content = renderTargetPage(data, config.page);
    else if (config.page === 'states') content = renderStates(data);
    else content = renderHome(data);
    app.innerHTML = `${header(data)}${content}${footer(data)}`;
    if (config.page === 'rightfiber' || config.page === 'greatplains') {
      const targets = lensTargets(data, config.page);
      if (targets.length) bindTargets(data, config.page, targets);
    }
    if (config.page === 'states') bindAtlas(data);
  }

  async function boot() {
    try {
      const response = await fetch(config.content, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderPage(data);
    } catch (error) {
      app.innerHTML = `<main id="main" class="shell" tabindex="-1"><div class="empty" style="margin-top:48px"><h3>Research data could not be loaded</h3><p>This page requires the adjacent public <code>content.json</code> file. Serve the bundle from a local web server or GitHub Pages and confirm that file is present.</p></div></main>`;
    }
  }

  boot();
})();
