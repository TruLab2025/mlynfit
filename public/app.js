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

  var TILE_MAP = {
    'pilates':      '/assets/pilates_tile_600x400.webp',
    'wzmacnianie':  '/assets/pilates_tile_600x400.webp',
    'hiit':         '/assets/hiit_tile_600x400.webp',
    'spalanie':     '/assets/hiit_tile_600x400.webp',
    'tabata':       '/assets/hiit_tile_600x400.webp',
    'body pump':    '/assets/bodypump_tile_600x400.webp',
    'figura':       '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'brzuch uda':   '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'plaski brzuch': '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'płaski brzuch': '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'kształtowanie': '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'ksztaltowanie': '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'modelowanie':  '/assets/modelowanie_sylwetki_tile_600x400.webp',
    'kickboxing':   '/assets/kickboxing_tile_600x400.webp',
    'kickobxing':   '/assets/kickboxing_tile_600x400.webp',
    'kregoslup':    '/assets/kregoslup_tile_original_600x400.webp',
    'kręgosłup':    '/assets/kregoslup_tile_original_600x400.webp',
    'salsation':    '/assets/salsation_tile_600x400.webp',
    'stretching':   '/assets/kregoslup_tile_original_600x400.webp'
  };

  function getTile(nazwa) {
    var key = (nazwa || '').toLowerCase();
    for (var k in TILE_MAP) {
      if (key.indexOf(k) !== -1) return TILE_MAP[k];
    }
    return null;
  }

  function renderTodayClasses(items) {
    var node = qs("[data-today-classes]");
    if (!node) return;
    if (!items.length) return;
    var classItems = items.slice(0, 7);
    node.innerHTML = classItems.map(function (item) {
      var tile = getTile(item.nazwa);
      var imgHtml = tile ? '<div class="class-card-img"><img src="' + tile + '" alt="' + item.nazwa + '" loading="eager"></div>' : '';
      return [
        '<article class="class-card">',
        imgHtml,
        '<div class="class-card-label">',
        '<h3>' + item.nazwa + '</h3>',
        '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function initClassSlider() {
    var slider = qs("[data-class-slider]");
    var track = qs("[data-today-classes]");
    var prev = qs("[data-class-prev]");
    var next = qs("[data-class-next]");
    if (!slider || !track || !prev || !next) return;
    if (classSliderReady) return;
    classSliderReady = true;
    var cards = qsa("[data-today-classes] .class-card");
    var cardCount = cards.length;
    if (cardCount < 2) return;
    var firstClone = cards[0].cloneNode(true);
    var lastClone = cards[cardCount - 1].cloneNode(true);
    firstClone.classList.add("is-clone");
    lastClone.classList.add("is-clone");
    track.insertBefore(lastClone, cards[0]);
    track.appendChild(firstClone);
    function step() {
      var firstCard = track.querySelector(".class-card");
      if (!firstCard) return 320;
      var gap = 14;
      return firstCard.getBoundingClientRect().width + gap;
    }
    function goTo(index, smooth) {
      var left = step() * index;
      track.scrollTo({ left: left, behavior: smooth ? "smooth" : "auto" });
    }
    var currentIndex = 1;
    var isAnimating = false;
    goTo(currentIndex, false);
    prev.addEventListener("click", function () {
      if (isAnimating) return;
      isAnimating = true;
      currentIndex -= 1;
      goTo(currentIndex, true);
      window.setTimeout(function () {
        if (currentIndex === 0) { currentIndex = cardCount; goTo(currentIndex, false); }
        isAnimating = false;
      }, 350);
    });
    next.addEventListener("click", function () {
      if (isAnimating) return;
      isAnimating = true;
      currentIndex += 1;
      goTo(currentIndex, true);
      window.setTimeout(function () {
        if (currentIndex === cardCount + 1) { currentIndex = 1; goTo(currentIndex, false); }
        isAnimating = false;
      }, 350);
    });
  }

  function renderSchedule(items) {
    var node = qs("[data-schedule]");
    if (!node) return;
    var childrenBefore = node.children.length;
    console.log('[RENDER] renderSchedule | records=' + items.length + ' | first=' + (items[0] ? items[0].nazwa : '?'));
    node.innerHTML = groupByDay(items).map(function (group) {
      return [
        '<section class="schedule-day">',
        '<h2>' + group.day + '</h2>',
        group.items.map(function (item) {
          return [
            '<article class="schedule-item">',
            '<div class="schedule-time">' + item.godzina + '</div>',
            '<div class="schedule-content">',
            '<h3>' + item.nazwa + '</h3>',
            item.opis ? '<p class="schedule-note">' + item.opis + '</p>' : '',
            item.trener ? '<p class="schedule-trainer">' + item.trener + '</p>' : '',
            '</div>',
            '</article>'
          ].join("");
        }).join(""),
        '</section>'
      ].join("");
    }).join("");
    console.log('[RENDER] renderSchedule done | before=' + childrenBefore + ' after=' + node.children.length);
  }

  function renderPricing(items) {
    var node = qs("[data-pricing]");
    if (!node) return;
    node.innerHTML = items.map(function (item, idx) {
      var featured = (idx === 1) ? true : false;
      var className = featured ? "price-card featured" : "price-card";
      return [
        '<article class="' + className + '">',
        '<h3>' + item.nazwa + '</h3>',
        '<span class="price">' + item.cena + '</span>',
        '<p>' + item.opis + '</p>',
        '</article>'
      ].join("");
    }).join("");
  }

  function renderMessages(items) {
    var node = qs("[data-messages]");
    if (!node || !items.length) return;
    node.innerHTML = items.map(function (item) { return '<p>' + item.tresc + '</p>'; }).join("");
  }

  function renderContact(site) {
    qsa("[data-contact]").forEach(function (node) {
      node.innerHTML = [
        '<strong>' + site.nazwa + '</strong><br>',
        site.adres.ulica + '<br>',
        site.adres.kod + ' ' + site.adres.miasto + '<br>',
        '<a href="tel:' + site.telefon.replace(/\s/g, "") + '">' + site.telefon + '</a><br>',
        '<a href="mailto:' + site.email + '">' + site.email + '</a><br>',
        '<span>' + site.godziny + '</span>'
      ].join("");
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

    // Pobieraj harmonogram tylko na stronach, które go używają
    if (qs("[data-schedule]") || qs("[data-today-classes]")) {
      fetchScheduleFromSheet(function (items) {
        renderTodayClasses(items);
        initClassSlider();
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

  document.addEventListener("DOMContentLoaded", init);
})();