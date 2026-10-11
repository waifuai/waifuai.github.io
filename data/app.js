(function () {
  var reach=document.querySelector('.reach-layout');
  function watchCountry(country) {
    function select() {
      reach.querySelector('.map-detail').textContent=country.dataset.detail;
      reach.querySelectorAll('.country').forEach(function(shape) { shape.classList.toggle('selected',shape.dataset.country===country.dataset.country); });
    }
    country.addEventListener('click',select);
    country.addEventListener('focus',select);
    country.addEventListener('mouseenter',select);
    country.addEventListener('keydown',function(e) { if(e.key==='Enter' || e.key===' ') { e.preventDefault(); select(); } });
  }
  if(reach) reach.querySelectorAll('.country-ranking [data-country]').forEach(watchCountry);
  var mapSlot=document.querySelector('.world-map-slot');
  if(mapSlot && reach) {
    fetch(mapSlot.dataset.mapSrc).then(function(r) { if(!r.ok) throw new Error('map '+r.status); return r.text(); }).then(function(text) {
      var holder=document.createElement('div');
      holder.innerHTML=text;
      var svg=holder.querySelector('svg');
      if(!svg) throw new Error('map file has no svg');
      var baked=svg.querySelector('style');
      if(baked) baked.remove();
      mapSlot.replaceChildren(svg);
      svg.querySelectorAll('[data-country]').forEach(watchCountry);
    }).catch(function() {});
  }
  document.querySelectorAll('[data-chart-card]').forEach(function(card) {
    var alternate=card.querySelector('[data-alternate-chart]');
    if(alternate) alternate.hidden=true;
    card.querySelectorAll('[data-chart-target]').forEach(function(button) {
      button.addEventListener('click',function() {
        card.querySelectorAll('[data-chart-target]').forEach(function(b) { b.setAttribute('aria-pressed',String(b===button)); });
        card.querySelectorAll('.chart-panel').forEach(function(panel) { panel.hidden=panel.id!==button.dataset.chartTarget; });
        card.querySelector('[data-chart-change]').textContent=button.dataset.change;
        if(alternate) alternate.hidden=false;
      });
    });
  });
  document.querySelectorAll('.month-bar').forEach(function(button) {
    function describe() { button.closest('.chart-panel').querySelector('.chart-detail').textContent=button.dataset.detail; }
    button.addEventListener('click',describe);
    button.addEventListener('focus',describe);
    button.addEventListener('mouseenter',describe);
  });
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator.connection && navigator.connection.saveData)) {
    var videos=document.querySelectorAll('.demo video, .product-tile video');
    function playAll() {
      videos.forEach(function(video) {
        if(!video.paused) return;
        var playback=video.play();
        if(playback && playback.catch) playback.catch(function() {});
      });
    }
    videos.forEach(function(video) { video.muted=true; video.autoplay=true; video.src=video.dataset.src; });
    playAll();
    document.addEventListener('visibilitychange',function() {
      if(document.visibilityState==='visible') playAll();
      else videos.forEach(function(video) { video.pause(); });
    });
  }
  var groups = document.querySelectorAll('[data-collapse]');
  groups.forEach(function (box) {
    var btn = document.querySelector('[data-more="' + box.id + '"]');
    if (!btn) return;
    box.classList.add('is-collapsed');
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var open = box.classList.toggle('is-collapsed') === false;
      btn.textContent = open ? 'Show fewer' : btn.dataset.label;
    });
  });

  document.querySelectorAll('input[data-filter]').forEach(function (input) {
    var box = document.querySelector(input.dataset.filter);
    input.addEventListener('input', function () {
      var q = input.value.toLowerCase().trim();
      if (q) box.classList.remove('is-collapsed');
      box.querySelectorAll('[data-row]').forEach(function (el) {
        el.hidden = q !== '' && el.textContent.toLowerCase().indexOf(q) === -1;
      });
    });
  });

  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var table = th.closest('table');
      var tbody = table.tBodies[0];
      var idx = Array.prototype.indexOf.call(th.parentNode.children, th);
      var numeric = th.dataset.sort === 'number';
      var current = th.getAttribute('aria-sort');
      var desc = current ? current === 'ascending' : numeric;
      table.querySelectorAll('th').forEach(function (h) { h.removeAttribute('aria-sort'); });
      th.setAttribute('aria-sort', desc ? 'descending' : 'ascending');
      var value = function (row) {
        var cell = row.children[idx];
        var v = cell.dataset.v !== undefined ? cell.dataset.v : cell.textContent.trim();
        return numeric ? parseFloat(v.replace(/[^0-9.\-]/g, '')) || 0 : v.toLowerCase();
      };
      var rows = Array.prototype.slice.call(tbody.rows);
      rows.sort(function (a, b) {
        var x = value(a), y = value(b);
        var cmp = numeric ? x - y : x.localeCompare(y);
        return desc ? -cmp : cmp;
      });
      var show = +table.dataset.show || 0;
      rows.forEach(function (row, i) {
        if (show) row.toggleAttribute('data-extra', i >= show);
        tbody.appendChild(row);
      });
    });
  });
})();
