(function () {
  var SHEETS_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFbVVnAYRg9MTKG2kH8SxlyykZLnvW9DrN-Jrry9HXYKW2hR4Loc_1OVYGhKV7HCF7ycJTadL_DCeP/pub?output=csv";

  var DATA_PATHS = {
    scheduleCSV: SHEETS_BASE + "&gid=0",
    pricing: "/data/cennik.json",
    messages: "/data/komunikaty.json",
    site: "/data/site.json",
    pricingCSV: SHEETS_BASE + "&gid=206099927",
    offerCSV: SHEETS_BASE + "&gid=834507938"
  };

  var DAYS = [
    { key: "Poniedziałek", label: "Poniedziałek" },
    { key: "Wtorek", label: "Wtorek" },
    { key: "Środa", label: "Środa" },
    { key: "Czwartek", label: "Czwartek" },
    { key: "Piątek", label: "Piątek" },
    { key: "Sobota", label: "Sobota" },
    { key: "Niedziela", label: "Niedziela" }
  ];
  var classSliderReady = false;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function createEl(tagName, className, text) {
    var el = document.createElement(tagName);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function appendLine(parent, child) {
    parent.appendChild(child);
    parent.appendChild(document.createElement("br"));
  }

  function phoneHref(phone) {
    return "tel:" + String(phone || "").replace(/[^\d+]/g, "");
  }

  function mailHref(email) {
    var value = String(email || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "mailto:" + value : "#";
  }

  function styleUrl(style) {
    var url = new URL(window.location.href);
    if (style === "modern") {
      url.searchParams.set("style", "modern");
    } else {
      url.searchParams.set("style", style);
    }
    return url.pathname + url.search + url.hash;
  }

  function initStyleVariant() {
    var params = new URLSearchParams(window.location.search);
    var style = params.get("style");
    if (style === "retro") {
      document.documentElement.classList.add("style-retro");
      var link = document.createElement("link");
      link.id = "style-variant-retro";
      link.rel = "stylesheet";
      link.href = "/retro.css?v=1";
      document.head.appendChild(link);
    }
  }

  function initStyleSwitcher() {
    var params = new URLSearchParams(window.location.search);
    var style = params.get("style");
    if (!style) return;

    var switcher = createEl("nav", "style-switcher");
    switcher.setAttribute("aria-label", "Przełącz styl strony");

    var label = createEl("span", "style-switcher-label", "Podgląd");
    var modern = createEl("a", style === "retro" ? "" : "active", "Modern");
    var retro = createEl("a", style === "retro" ? "active" : "", "Vintage");

    modern.href = styleUrl("modern");
    retro.href = styleUrl("retro");

    switcher.appendChild(label);
    switcher.appendChild(modern);
    switcher.appendChild(retro);
    document.body.appendChild(switcher);
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Nie udalo sie pobrac " + url);
      }
      return response.json();
    });
  }

  function activeItems(payload) {
    return (payload.items || []).filter(function (item) {
      return item.aktywne !== false;
    });
  }

  /* ---------- CSV parser ---------- */
  function parseCSVLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  function fetchCSV(url) {
    var bustUrl = url + '&_cb=' + Date.now() + Math.random();
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 4000);
    return fetch(bustUrl, { cache: "no-store", signal: controller.signal }).then(function (response) {
      clearTimeout(timer);
      if (!response.ok) throw new Error("Nie udalo sie pobrac " + url);
      return response.text();
    }).then(function (text) {
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) return [];
      var headers = parseCSVLine(lines[0]);
      var items = [];
      for (var i = 1; i < lines.length; i++) {
        var values = parseCSVLine(lines[i]);
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j].trim();
          var val = values[j] || '';
          if (val === 'TRUE') val = true;
          else if (val === 'FALSE') val = false;
          obj[key] = val;
        }
        if (obj.aktywne !== false) items.push(obj);
      }
      return items;
    });
  }

  /* ---------- Schedule: localStorage + Google Sheets ---------- */
  var _scheduleMemory = null;

  function getScheduleCache() {
    try {
      var raw = localStorage.getItem('mlyn_schedule');
      if (!raw) return null;
      var p = JSON.parse(raw);
      return p.data || null;
    } catch (e) { return null; }
  }

  function setScheduleCache(data) {
    try {
      localStorage.setItem('mlyn_schedule', JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {}
  }

  function fetchScheduleFromSheet(callback) {
    var ts = new Date().toISOString().slice(11, 19);
    if (_scheduleMemory) {
      console.log('[SCHEDULE] source=memory | records=' + _scheduleMemory.length + ' | ts=' + ts + ' | first=' + (_scheduleMemory[0] ? _scheduleMemory[0].nazwa : '?'));
      callback(_scheduleMemory);
      return;
    }

    var cached = getScheduleCache();
    if (cached) {
      var cachedTs = '';
      try { var r = JSON.parse(localStorage.getItem('mlyn_schedule')); cachedTs = r.ts ? new Date(r.ts).toISOString().slice(11, 19) : ''; } catch(e) {}
      console.log('[SCHEDULE] source=localStorage | records=' + cached.length + ' | ts=' + ts + ' | cachedTS=' + cachedTs + ' | first=' + (cached[0] ? cached[0].nazwa : '?'));
      _scheduleMemory = cached;
      callback(cached);
    } else {
      console.log('[SCHEDULE] source=nocache | ts=' + ts);
    }

    var bustUrl = DATA_PATHS.scheduleCSV + '&_cb=' + Date.now() + Math.random();
    fetch(bustUrl, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("CSV error " + response.status);
      return response.text();
    }).then(function (text) {
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) { console.log('[SCHEDULE] CSV<2 lines, abort'); return; }
      var headers = parseCSVLine(lines[0]);
      var items = [];
      for (var i = 1; i < lines.length; i++) {
        var values = parseCSVLine(lines[i]);
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j].trim();
          var val = values[j] || '';
          if (val === 'TRUE') val = true;
          else if (val === 'FALSE') val = false;
          obj[key] = val;
        }
        if (obj.aktywne !== false && obj.dzien) items.push(obj);
      }

      var oldCache = getScheduleCache();
      var oldStr = oldCache ? JSON.stringify(oldCache) : '';
      var newStr = JSON.stringify(items);
      var match = (newStr === oldStr) ? 'SAME' : 'DIFF';

      console.log('[SCHEDULE] source=googleSheets | records=' + items.length + ' | ts=' + ts + ' | ' + match + ' | first=' + (items[0] ? items[0].nazwa : '?') + ' | oldLSlen=' + oldStr.length + ' newLen=' + newStr.length);

      if (newStr !== oldStr) {
        // Nie nadpisuj cache pustą tablicą, jeśli mamy już dane
        if (items.length === 0 && (cached && cached.length > 0)) {
          console.log('[SCHEDULE] empty CSV, preserving cache');
          return;
        }
        setScheduleCache(items);
        _scheduleMemory = items;
        callback(items);
      }
    }).catch(function (err) {
      console.log('[SCHEDULE] fetch error:', err.message);
    });
  }

  /* ---------- Pricing: localStorage + Google Sheets ---------- */
  var _pricingMemory = null;

  function getPricingCache() {
    try {
      var raw = localStorage.getItem('mlyn_pricing');
      if (!raw) return null;
      var p = JSON.parse(raw);
      return p.data || null;
    } catch (e) { return null; }
  }

  function setPricingCache(data) {
    try {
      localStorage.setItem('mlyn_pricing', JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {}
  }

  function fetchPricingFromSheet(callback) {
    if (_pricingMemory) { callback(_pricingMemory); return; }

    var cached = getPricingCache();
    if (cached) {
      _pricingMemory = cached;
      callback(cached);
    }

    var bustUrl = DATA_PATHS.pricingCSV + '&_cb=' + Date.now() + Math.random();
    fetch(bustUrl, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Pricing CSV error " + response.status);
      return response.text();
    }).then(function (text) {
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) return;
      var headers = parseCSVLine(lines[0]);
      var items = [];
      for (var i = 1; i < lines.length; i++) {
        var values = parseCSVLine(lines[i]);
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j].trim();
          var val = values[j] || '';
          if (val === 'TRUE') val = true;
          else if (val === 'FALSE') val = false;
          obj[key] = val;
        }
        if (obj.aktywne !== false && obj.nazwa) items.push(obj);
      }

      var oldStr = _pricingMemory ? JSON.stringify(_pricingMemory) : '';
      var newStr = JSON.stringify(items);

      if (newStr !== oldStr) {
        // Nie nadpisuj cache pustą tablicą, jeśli mamy już dane
        if (items.length === 0 && (cached || _pricingMemory) && (cached ? cached.length > 0 : _pricingMemory.length > 0)) {
          console.log('[PRICING] empty CSV, preserving cache');
          return;
        }
        _pricingMemory = items;
        setPricingCache(items);
        callback(items);
      }
    }).catch(function (err) {
      console.warn('Pricing CSV error:', err.message);
    });
  }

  function groupByDay(items) {
    return DAYS.map(function (day) {
      return {
        day: day.label,
        items: items.filter(function (item) {
          return item.dzien === day.key;
        })
      };
    }).filter(function (group) {
      return group.items.length;
    });
  }

  var CLASS_SHOWCASE = [
    {
      nazwa: 'Pilates',
      opis: 'Wzmacnia głębokie mięśnie, poprawia postawę i pomaga zadbać o kręgosłup.',
      tile: '/assets/pilates_tile_600x400.webp'
    },
    {
      nazwa: 'HIIT',
      opis: 'Dynamiczny trening interwałowy dla osób, które lubią intensywną pracę i mocne tempo.',
      tile: '/assets/hiit_tile_600x400.webp'
    },
    {
      nazwa: 'Body Pump',
      opis: 'Trening ze sztangą i obciążeniem, nastawiony na siłę, wytrzymałość i całe ciało.',
      tile: '/assets/bodypump_tile_600x400.webp'
    },
    {
      nazwa: 'Modelowanie sylwetki',
      opis: 'Zajęcia łączące ćwiczenia wzmacniające, ujędrniające i elementy pracy nad mobilnością.',
      tile: '/assets/modelowanie_sylwetki_tile_600x400.webp'
    },
    {
      nazwa: 'Kickboxing',
      opis: 'Energiczne połączenie ciosów, kopnięć i ćwiczeń kondycyjnych.',
      tile: '/assets/kickboxing_tile_600x400.webp'
    },
    {
      nazwa: 'Zdrowy kręgosłup',
      opis: 'Spokojniejszy trening wzmacniający i rozciągający plecy oraz mięśnie stabilizujące.',
      tile: '/assets/kregoslup_tile_original_600x400.webp'
    },
    {
      nazwa: 'Salsation',
      opis: 'Taneczne zajęcia fitness z choreografią, muzyką i dużą dawką ruchu.',
      tile: '/assets/salsation_tile_600x400.webp'
    }
  ];

  function renderClassShowcase() {
    var node = qs("[data-class-showcase]");
    if (!node) return;
    clearNode(node);
    CLASS_SHOWCASE.forEach(function (item) {
      var card = createEl("article", "class-card");
      card.setAttribute("tabindex", "0");

      var imageWrap = createEl("div", "class-card-img");
      var img = document.createElement("img");
      img.src = item.tile;
      img.alt = item.nazwa;
      img.loading = "eager";
      imageWrap.appendChild(img);

      var overlay = createEl("div", "class-card-overlay");
      overlay.appendChild(createEl("p", "", item.opis));

      var label = createEl("div", "class-card-label");
      label.appendChild(createEl("h3", "", item.nazwa));

      card.appendChild(imageWrap);
      card.appendChild(overlay);
      card.appendChild(label);
      node.appendChild(card);
    });
  }

  function initClassTaps() {
    qsa(".class-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        // Nie przełączaj gdy kliknięto w slider button
        if (e.target.closest(".slider-btn")) return;
        var wasTapped = card.classList.contains("is-tapped");
        // Zamknij wszystkie inne
        qsa(".class-card.is-tapped").forEach(function (c) {
          c.classList.remove("is-tapped");
        });
        if (!wasTapped) {
          card.classList.add("is-tapped");
        }
      });
    });
    // Zamknij po kliknięciu w tło
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".class-card")) {
        qsa(".class-card.is-tapped").forEach(function (c) {
          c.classList.remove("is-tapped");
        });
      }
    });
  }

  function initClassSlider() {
    var slider = qs("[data-class-slider]");
    var track = qs("[data-class-showcase]");
    var prev = qs("[data-class-prev]");
    var next = qs("[data-class-next]");
    if (!slider || !track || !prev || !next) return;
    if (classSliderReady) return;
    classSliderReady = true;

    var cards = qsa("[data-class-showcase] .class-card");
    var total = cards.length;
    if (total < 2) return;

    function step() {
      var firstCard = track.querySelector(".class-card");
      if (!firstCard) return 320;
      var styles = window.getComputedStyle(track);
      var gap = parseFloat(styles.columnGap || styles.gap) || 14;
      return firstCard.getBoundingClientRect().width + gap;
    }

    function wrapIndex(index) {
      return ((index % total) + total) % total;
    }

    var cloneCount = Math.max(1, Math.ceil(track.clientWidth / step()) + 1);
    var before = document.createDocumentFragment();
    var after = document.createDocumentFragment();

    for (var i = 0; i < cloneCount; i += 1) {
      var beforeCard = cards[wrapIndex(total - cloneCount + i)];
      var beforeClone = beforeCard.cloneNode(true);
      beforeClone.classList.add("is-clone");
      before.appendChild(beforeClone);

      var afterCard = cards[wrapIndex(i)];
      var clone = afterCard.cloneNode(true);
      clone.classList.add("is-clone");
      after.appendChild(clone);
    }
    track.insertBefore(before, cards[0]);
    track.appendChild(after);

    var idx = cloneCount;
    var busy = false;
    var delay = 520;

    function goTo(index, smooth) {
      var left = step() * index;
      if (smooth) {
        track.scrollTo({ left: left, behavior: "smooth" });
      } else {
        track.style.scrollBehavior = "auto";
        track.scrollLeft = left;
        track.style.scrollBehavior = "";
      }
    }

    goTo(idx, false);

    function slide(dir) {
      if (busy) return;
      busy = true;
      idx += dir;
      goTo(idx, true);
      window.setTimeout(function () {
        if (idx < cloneCount) {
          idx = cloneCount + total - 1;
          goTo(idx, false);
        } else if (idx >= cloneCount + total) {
          idx = cloneCount;
          goTo(idx, false);
        }
        busy = false;
      }, delay);
    }

    prev.addEventListener("click", function () { slide(-1); });
    next.addEventListener("click", function () { slide(1); });
    window.addEventListener("resize", function () {
      goTo(idx, false);
    });
  }

  function renderSchedule(items) {
    var node = qs("[data-schedule]");
    if (!node) return;
    var childrenBefore = node.children.length;
    console.log('[RENDER] renderSchedule | records=' + items.length + ' | first=' + (items[0] ? items[0].nazwa : '?'));
    clearNode(node);
    groupByDay(items).forEach(function (group) {
      var section = createEl("section", "schedule-day");
      section.appendChild(createEl("h2", "", group.day));

      group.items.forEach(function (item) {
        var article = createEl("article", "schedule-item");
        article.appendChild(createEl("div", "schedule-time", item.godzina));

        var content = createEl("div", "schedule-content");
        content.appendChild(createEl("h3", "", item.nazwa));
        if (item.opis) content.appendChild(createEl("p", "schedule-note", item.opis));
        if (item.trener) content.appendChild(createEl("p", "schedule-trainer", item.trener));

        article.appendChild(content);
        section.appendChild(article);
      });

      node.appendChild(section);
    });
    console.log('[RENDER] renderSchedule done | before=' + childrenBefore + ' after=' + node.children.length);
  }

  function renderPricing(items) {
    var node = qs("[data-pricing]");
    if (!node) return;
    clearNode(node);
    items.forEach(function (item, idx) {
      var featured = (idx === 1) ? true : false;
      var className = featured ? "price-card featured" : "price-card";
      var article = createEl("article", className);
      article.appendChild(createEl("h3", "", item.nazwa));
      article.appendChild(createEl("span", "price", item.cena));
      article.appendChild(createEl("p", "", item.opis));
      node.appendChild(article);
    });
  }

  function renderMessages(items) {
    var node = qs("[data-messages]");
    if (!node || !items.length) return;
    clearNode(node);
    items.forEach(function (item) {
      node.appendChild(createEl("p", "", item.tresc));
    });
  }

  function renderContact(site) {
    qsa("[data-contact]").forEach(function (node) {
      var adres = site.adres || {};
      clearNode(node);
      appendLine(node, createEl("strong", "", site.nazwa));
      appendLine(node, document.createTextNode(adres.ulica || ""));
      appendLine(node, document.createTextNode(((adres.kod || "") + " " + (adres.miasto || "")).trim()));

      var phone = createEl("a", "", site.telefon);
      phone.href = phoneHref(site.telefon);
      appendLine(node, phone);

      var email = createEl("a", "", site.email);
      email.href = mailHref(site.email);
      appendLine(node, email);

      node.appendChild(createEl("span", "", site.godziny));
    });
  }

  function initNav() {
    var toggle = qs("[data-nav-toggle]");
    var nav = qs("[data-nav]");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.contains("is-open");
      if (isOpen) {
        nav.classList.remove("is-open");
      } else {
        nav.style.maxHeight = "none";
        var fullHeight = nav.scrollHeight;
        nav.style.maxHeight = "0px";
        nav.offsetHeight;
        nav.classList.add("is-open");
        nav.style.maxHeight = fullHeight + "px";
        nav.addEventListener("transitionend", function handler() {
          nav.style.maxHeight = "none";
          nav.removeEventListener("transitionend", handler);
        });
      }
    });
  }

  function initReveal() {
    if (!window.IntersectionObserver) return;
    var classes = ['.reveal', '.reveal-left', '.reveal-right', '.reveal-scale'];
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    classes.forEach(function (cls) { qsa(cls).forEach(function (el) { observer.observe(el); }); });
  }

  function initImageFade() {
    document.querySelectorAll('.class-card-img img, .schedule-item img').forEach(function (img) {
      if (img.complete) { img.classList.add('loaded'); }
      else { img.addEventListener('load', function () { img.classList.add('loaded'); }); }
    });
  }

  function renderPricingFromSheet(items) {
    // Oferta: aktualizuj istniejące kafelki (pierwsze 4)
    var offerCards = qsa(".feature-grid > article");
    items.slice(0, 4).forEach(function (item, idx) {
      if (offerCards[idx]) {
        var h3 = offerCards[idx].querySelector("h3");
        var price = offerCards[idx].querySelector(".offer-price");
        var p = offerCards[idx].querySelector("p");
        if (h3) h3.textContent = item.nazwa;
        if (price) price.textContent = item.cena.replace(/(\d)zł/g, '$1 zł');
        if (p) p.textContent = item.opis;
      }
    });

    // Cennik: aktualizuj istniejące kafelki (reszta)
    var pricingCards = qsa(".pricing-grid > article");
    items.slice(4).forEach(function (item, idx) {
      if (pricingCards[idx]) {
        var h3 = pricingCards[idx].querySelector("h3");
        var price = pricingCards[idx].querySelector(".price");
        var p = pricingCards[idx].querySelector("p");
        if (h3) h3.textContent = item.nazwa;
        if (price) price.textContent = item.cena;
        if (p) p.textContent = item.opis;
        // Ustaw featured tylko dla środkowego (indeks 1)
        if (idx === 1) pricingCards[idx].classList.add('featured');
        else pricingCards[idx].classList.remove('featured');
      }
    });
  }

  function init() {
    initNav();
    initReveal();
    initStyleSwitcher();

    if (qs("[data-class-showcase]")) {
      renderClassShowcase();
      initClassSlider();
      initClassTaps();
      initImageFade();
    }

    // Pobieraj harmonogram tylko na stronach, które pokazują grafik
    if (qs("[data-schedule]")) {
      fetchScheduleFromSheet(function (items) {
        renderSchedule(items);
        initImageFade();
      });
    }

    // Logowanie liczby wywołań renderSchedule
    (function() {
      if (!window.__renderCount) window.__renderCount = 0;
      window.__renderCount++;
    })();

    fetchPricingFromSheet(renderPricingFromSheet);

    fetchJson(DATA_PATHS.messages).then(activeItems).then(renderMessages).catch(function (error) { console.warn(error.message); });
    fetchJson(DATA_PATHS.site).then(renderContact).catch(function (error) { console.warn(error.message); });
  }

  initStyleVariant();
  document.addEventListener("DOMContentLoaded", init);
})();
