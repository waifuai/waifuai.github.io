(function () {
  function updateDecisionMonths() {
    var panel=document.querySelector('[data-decision-cutoff]');
    if(!panel) return;
    var cutoff=Date.parse(panel.dataset.decisionCutoff), daily=Number(panel.dataset.dailyRate), now=Date.now();
    if(!Number.isFinite(cutoff) || !Number.isFinite(daily) || daily<0) return;
    var allowEstimate=now>=cutoff;
    var day=86400000, offset=8*3600000;
    function monthStart(time) {
      var d=new Date(time+offset);
      return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)-offset;
    }
    function moveMonth(time, count) {
      var d=new Date(time+offset);
      return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+count,1)-offset;
    }
    function key(time) { return new Date(time+offset).toISOString().slice(0,7); }
    function label(time, length) {
      return new Date(time).toLocaleDateString('en-US',{timeZone:'Asia/Singapore',month:length,year:'numeric'});
    }
    function number(value) { return Math.round(value).toLocaleString('en-US'); }
    var saved={}, first;
    panel.querySelectorAll('[data-decision-month]').forEach(function(row) {
      saved[row.dataset.decisionMonth]={calls:Number(row.dataset.calls),partial:row.dataset.partial==='1'};
      if(!first || row.dataset.decisionMonth<first) first=row.dataset.decisionMonth;
    });
    if(!first) return;
    var current=monthStart(Math.max(now,cutoff)), start=Math.max(Date.parse(first+'-01T00:00:00+08:00'),moveMonth(current,-11));
    var months=[];
    for(var time=start; time<=current; time=moveMonth(time,1)) {
      var end=moveMonth(time,1), recorded=saved[key(time)] || {calls:0,partial:false};
      months.push({time:time,key:key(time),recorded:recorded.calls,partial:recorded.partial,
        estimated:allowEstimate && end>cutoff,calls:recorded.calls+(allowEstimate?daily*Math.max(0,end-Math.max(time,cutoff))/day:0)});
    }
    var peak=Math.max.apply(null,months.map(function(m) { return m.calls; }));
    var step=Math.max(1,Math.pow(10,Math.floor(Math.log10(Math.max(1,peak))))/5);
    var ceiling=Math.max(1,Math.ceil(peak*1.15/step)*step);
    var chart=panel.querySelector('.month-chart'), selected=chart.querySelector(':focus');
    var selectedKey=selected && selected.dataset.month;
    var fragment=document.createDocumentFragment();
    months.forEach(function(m) {
      var button=document.createElement('button'), column=document.createElement('span');
      button.type='button';
      button.className='month-bar'+(m.estimated?' forecast-bar':'');
      button.dataset.month=m.key;
      button.style.setProperty('--height',(m.calls/ceiling*100).toFixed(3)+'%');
      var detail=label(m.time,'long')+' · '+number(m.calls)+' decision calls';
      if(m.estimated) detail+=' estimated month · '+number(m.recorded)+' recorded · '+panel.dataset.rateBasis;
      if(m.partial) detail+=' · partial recorded month; no estimate before recording began';
      button.dataset.detail=detail;
      button.setAttribute('aria-label',detail);
      column.className='bar-column';
      if(m.estimated) {
        var fill=document.createElement('span');
        fill.className='forecast-recorded';
        fill.style.height=(m.recorded/Math.max(1,m.calls)*100).toFixed(3)+'%';
        column.appendChild(fill);
      }
      var value=document.createElement('span'), caption=document.createElement('span');
      value.className='bar-value';
      value.textContent=(m.estimated?'≈':'')+number(m.calls);
      column.appendChild(value);
      caption.className='month-label';
      caption.textContent=label(m.time,'short')+(m.partial?' partial':'')+(m.estimated?' est.':'');
      button.append(column,caption);
      fragment.appendChild(button);
    });
    chart.replaceChildren(fragment);
    panel.querySelector('.chart-scale span').textContent=number(ceiling);
    panel.querySelector('.decision-estimate-note').textContent=allowEstimate?
      'Estimates through '+label(current,'long')+' · ≈'+number(daily)+' calls/day · Later months keep using this saved pace until the next export.':
      'Recorded counts only; the latest recorded call is ahead of this device’s clock.';
    if(selectedKey) {
      var replacement=chart.querySelector('[data-month="'+selectedKey+'"]');
      if(replacement) replacement.focus({preventScroll:true});
    }
  }
  updateDecisionMonths();
  setInterval(updateDecisionMonths,60000);
  document.addEventListener('visibilitychange',updateDecisionMonths);

  function openLinkedSection() {
    var id;
    try { id=decodeURIComponent(location.hash.slice(1)); } catch(error) { return; }
    var target=id && document.getElementById(id);
    if(!target) return;
    for(var parent=target; parent; parent=parent.parentElement) {
      if(parent.tagName==='DETAILS') parent.open=true;
    }
    target.scrollIntoView();
  }
  openLinkedSection();
  window.addEventListener('hashchange',openLinkedSection);

  function expireForecasts() {
    document.querySelectorAll('[data-forecast-end]').forEach(function(bar) {
      if(Date.now() >= Date.parse(bar.dataset.forecastEnd)) bar.hidden = true;
    });
  }
  expireForecasts();
  setInterval(expireForecasts, 60000);
  document.addEventListener('visibilitychange', expireForecasts);
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
  document.querySelectorAll('.chart-panel').forEach(function(panel) {
    function describe(event) {
      var button=event.target.closest('.month-bar');
      if(button) panel.querySelector('.chart-detail').textContent=button.dataset.detail;
    }
    panel.addEventListener('click',describe);
    panel.addEventListener('focusin',describe);
    panel.addEventListener('mouseover',describe);
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
