/* ===== 보안 유틸 ===== */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return null; // javascript:, data:, etc. 차단
}

/* ===== 상태 ===== */
let allBusinesses = [];
let currentRegion = '전체';
let currentSearch = '';
let currentSort = 'price-asc';
let activeFacilities = new Set();
let currentView = 'table';
let leafletMap = null;

/* ===== 데이터 로딩 ===== */
async function loadData() {
  try {
    const json = window.BBAZI_DATA || await fetch('./data/data.json').then(r => r.json());
    allBusinesses = json.businesses || [];
    const el = document.getElementById('lastUpdated');
    if (json.meta?.last_updated) {
      el.textContent = '· ' + json.meta.last_updated + ' 기준';
    }
    render();
  } catch {
    document.getElementById('tableContainer').innerHTML =
      '<div class="empty-state"><div class="empty-icon">⚠️</div><p>데이터를 불러오지 못했습니다</p></div>';
  }
}

/* ===== 뷰 전환 ===== */
function setView(mode) {
  currentView = mode;
  document.getElementById('tableViewBtn').classList.toggle('active', mode === 'table');
  document.getElementById('mapViewBtn').classList.toggle('active', mode === 'map');
  document.getElementById('tableArea').style.display = mode === 'table' ? '' : 'none';
  document.getElementById('mapArea').style.display = mode === 'map' ? '' : 'none';

  if (mode === 'map') {
    renderMap();
  }
}

/* ===== 필터 & 정렬 ===== */
function getFiltered() {
  let list = allBusinesses.filter(b => b.price_per_person !== null);

  if (currentRegion !== '전체') {
    list = list.filter(b => b.region === currentRegion);
  }
  const q = currentSearch.trim();
  if (q) {
    list = list.filter(b =>
      b.name.includes(q) || b.city.includes(q) || b.region.includes(q)
    );
  }
  if (activeFacilities.has('shower'))       list = list.filter(b => b.facilities?.shower === true);
  if (activeFacilities.has('changing_room')) list = list.filter(b => b.facilities?.changing_room === true);
  if (activeFacilities.has('parking'))      list = list.filter(b => b.parking?.available === true);
  if (activeFacilities.has('pickup'))       list = list.filter(b => b.pickup === true);

  if (currentSort === 'price-asc')  list.sort((a, b) => a.price_per_person - b.price_per_person);
  if (currentSort === 'price-desc') list.sort((a, b) => b.price_per_person - a.price_per_person);
  if (currentSort === 'name-asc')   list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  return list;
}

/* ===== 가격 포맷 ===== */
function priceText(b) {
  const main = b.price_per_person.toLocaleString() + '원';
  if (b.price_min && b.price_max && b.price_min !== b.price_max) {
    return { main, range: b.price_min.toLocaleString() + '~' + b.price_max.toLocaleString() + '원' };
  }
  return { main, range: null };
}

/* ===== 시설 태그 ===== */
function toiletTag(f) {
  if (!f?.toilet) return '<span class="ftag ftag-none">화장실 미확인</span>';
  const map = {
    building: ['ftag-toilet-building', '🏛️ 건물화장실'],
    shared:   ['ftag-toilet-shared',   '🚾 공용화장실'],
    portable: ['ftag-toilet-portable', '🚽 간이화장실']
  };
  const [cls, label] = map[f.toilet] || ['ftag-none', '화장실 미확인'];
  return `<span class="ftag ${cls}">${label}${f.toilet_note ? ' (' + escapeHtml(f.toilet_note) + ')' : ''}</span>`;
}
function showerTag(f) {
  if (f?.shower === null || f?.shower === undefined) return '';
  if (!f.shower) return '<span class="ftag ftag-none">샤워 없음</span>';
  return `<span class="ftag ${f.shower_type === 'free' ? 'ftag-shower-free' : 'ftag-shower-paid'}">${f.shower_type === 'free' ? '🚿 샤워 무료' : '🚿 샤워 유료'}</span>`;
}
function changingTag(f) {
  if (f?.changing_room === null || f?.changing_room === undefined) return '';
  return f.changing_room ? '<span class="ftag ftag-changing">👔 탈의실</span>' : '<span class="ftag ftag-none">탈의실 없음</span>';
}
function parkingTag(p) {
  if (!p?.available) return '<span class="ftag ftag-none">주차 미확인</span>';
  const detail = [p.capacity ? escapeHtml(p.capacity) + '대' : '', p.walk_minutes ? '도보 ' + escapeHtml(p.walk_minutes) + '분' : ''].filter(Boolean).join(' · ');
  return `<span class="ftag ftag-parking">🅿️ 주차${detail ? ' ' + detail : ''}</span>`;
}
function pickupTag(pickup) {
  return pickup ? '<span class="ftag ftag-pickup">🚌 픽업 가능</span>' : '';
}
function allFacilityTags(b) {
  return [toiletTag(b.facilities), showerTag(b.facilities), changingTag(b.facilities), parkingTag(b.parking), pickupTag(b.pickup)].filter(Boolean).join('');
}
function parkingText(p) {
  if (!p?.available) return '-';
  return [p.capacity ? escapeHtml(p.capacity) + '대' : '', p.walk_minutes ? '도보 ' + escapeHtml(p.walk_minutes) + '분' : ''].filter(Boolean).join(' · ') || '가능';
}

/* ===== 예약 버튼 ===== */
function bookingBtn(b) {
  let btns = [];
  const naverUrl = safeUrl(b.naver_booking_url);
  const siteUrl = safeUrl(b.website_url);
  if (naverUrl) btns.push(`<a href="${naverUrl}" target="_blank" rel="noopener noreferrer" class="btn-booking">예약하기 →</a>`);
  if (siteUrl) btns.push(`<a href="${siteUrl}" target="_blank" rel="noopener noreferrer" class="btn-website">홈페이지</a>`);
  if (b.phone) btns.push(`<a href="tel:${escapeHtml(b.phone.replace(/[^0-9+]/g,''))}" class="btn-call">📞 전화</a>`);
  return btns.length ? btns.join('') : '<span class="no-link">준비중</span>';
}

/* ===== 순위 클래스 ===== */
function rankClass(i) {
  return i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank';
}

/* ===== 테이블 렌더 ===== */
function renderTable(list) {
  if (!list.length) return '<div class="empty-state"><div class="empty-icon">🔍</div><p>해당하는 업체가 없습니다</p></div>';

  const rows = list.map((b, i) => {
    const { main, range } = priceText(b);
    const isLowest = i === 0 && currentSort === 'price-asc';
    const lowestBadge = isLowest ? '<span class="badge-lowest">🏷️ 최저가</span>' : '';

    return `<tr>
      <td style="text-align:center;width:36px"><span class="${rankClass(i)}">${i + 1}</span></td>
      <td><strong>${escapeHtml(b.name)}</strong>${lowestBadge}<br><span style="font-size:11px;color:#9CA3AF">${escapeHtml(b.city)}</span></td>
      <td class="price-cell">${main}${range ? `<span class="price-range">${range}</span>` : ''}</td>
      <td style="font-size:13px;color:#6B7280">${b.min_people ? escapeHtml(b.min_people) + '인 이상' : '-'}</td>
      <td><div class="facility-tags">${toiletTag(b.facilities)}${showerTag(b.facilities)}${changingTag(b.facilities)}</div></td>
      <td class="parking-info">${parkingText(b.parking)}${b.pickup ? '<br><span class="ftag ftag-pickup" style="margin-top:3px;display:inline-block">🚌 픽업</span>' : ''}</td>
      <td>${bookingBtn(b)}</td>
    </tr>`;
  }).join('');

  return `<table class="compare-table">
    <thead><tr>
      <th style="width:36px;text-align:center">#</th>
      <th>업체명</th><th>1인 가격</th><th>최소 인원</th><th>시설</th><th>주차/픽업</th><th>예약</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ===== 카드 렌더 (모바일) ===== */
function renderCards(list, isUnverified) {
  if (!list.length) return '';
  return list.map((b, i) => {
    const isLowest = i === 0 && currentSort === 'price-asc' && !isUnverified;
    const lowestBadge = isLowest ? '<span class="badge-lowest">🏷️ 최저가</span>' : '';

    let priceBlock = isUnverified
      ? '<div class="card-price" style="color:#9CA3AF;font-size:16px">가격 미확인</div>'
      : (() => {
          const { main, range } = priceText(b);
          return `<div class="card-price">${main} <span class="card-price-sub">/ 1인</span></div>${range ? `<div class="card-price-range">${range}</div>` : ''}`;
        })();

    return `<div class="biz-card">
      <div class="card-rank-name">
        ${!isUnverified ? `<span class="card-rank ${rankClass(i)}">${i + 1}</span>` : ''}
        <span class="card-name">${escapeHtml(b.name)}</span>${lowestBadge}
      </div>
      <div class="card-location">📍 ${escapeHtml(b.region)} ${escapeHtml(b.city)}</div>
      ${priceBlock}
      <div class="card-meta">${[b.min_people ? '최소 ' + escapeHtml(b.min_people) + '인' : '', escapeHtml(b.hours) || ''].filter(Boolean).join(' · ')}</div>
      ${b.price_note ? `<div class="card-note">💬 ${escapeHtml(b.price_note)}</div>` : ''}
      <div class="card-facilities">
        <div class="card-facilities-title">시설</div>
        <div class="facility-tags">${allFacilityTags(b)}</div>
        ${b.parking?.available ? `<div class="card-parking">🅿️ ${parkingText(b.parking)}</div>` : ''}
      </div>
      <div class="card-actions">${bookingBtn(b)}</div>
    </div>`;
  }).join('');
}

/* ===== 지도 렌더 ===== */
function renderMap() {
  const list = allBusinesses.filter(b => b.lat && b.lng);
  const verified = getFiltered().filter(b => b.lat && b.lng);
  const unverified = allBusinesses.filter(b => b.price_per_person === null && b.lat && b.lng);
  const lowestId = verified.length > 0 ? verified[0].id : null;

  if (!leafletMap) {
    leafletMap = L.map('mapContainer').setView([37.75, 127.60], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>'
    }).addTo(leafletMap);
  } else {
    leafletMap.eachLayer(layer => {
      if (layer instanceof L.Marker) leafletMap.removeLayer(layer);
    });
    leafletMap.invalidateSize();
  }

  [...verified, ...unverified].forEach(b => {
    const isLowest = b.id === lowestId;
    const hasPrice = b.price_per_person !== null;
    const markerClass = isLowest ? 'lowest' : !hasPrice ? 'unverified' : '';
    const priceLabel = hasPrice ? b.price_per_person.toLocaleString() + '원' : '문의';

    const icon = L.divIcon({
      className: '',
      html: `<div class="map-price-marker ${markerClass}">${isLowest ? '🏷️ ' : ''}${priceLabel}</div>`,
      iconAnchor: [40, 28]
    });

    const facilityLines = [
      b.facilities?.toilet ? ({ building: '🏛️건물화장실', shared: '🚾공용화장실', portable: '🚽간이화장실' }[b.facilities.toilet] || '') : '',
      b.facilities?.shower ? (b.facilities.shower_type === 'free' ? '🚿샤워무료' : '🚿샤워유료') : '',
      b.facilities?.changing_room ? '👔탈의실' : '',
      b.parking?.available ? '🅿️주차' + (b.parking.capacity ? ' ' + b.parking.capacity + '대' : '') : '',
      b.pickup ? '🚌픽업' : ''
    ].filter(Boolean).join(' · ');

    const naverPlaceUrl = safeUrl(b.naver_place_url);
    const websiteUrl = safeUrl(b.website_url);
    const popup = L.popup({ maxWidth: 220 }).setContent(`
      <div class="map-popup-name">${escapeHtml(b.name)}${isLowest ? ' <span style="color:#FF6B00">🏷️최저가</span>' : ''}</div>
      <div class="map-popup-price">${escapeHtml(priceLabel)} / 1인</div>
      <div class="map-popup-info">${escapeHtml(b.city)}${b.price_note ? '<br>💬 ' + escapeHtml(b.price_note) : ''}${facilityLines ? '<br>' + facilityLines : ''}</div>
      ${naverPlaceUrl ? `<a href="${naverPlaceUrl}" target="_blank" rel="noopener noreferrer" class="map-popup-link">네이버 →</a>` : (websiteUrl ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="map-popup-link">홈페이지 →</a>` : '')}
    `);

    L.marker([b.lat, b.lng], { icon }).bindPopup(popup).addTo(leafletMap);
  });
}

/* ===== 메인 렌더 ===== */
function render() {
  const list = getFiltered();
  const unverified = allBusinesses.filter(b => b.price_per_person === null);

  document.getElementById('resultCount').textContent = list.length;
  document.getElementById('tableContainer').innerHTML = renderTable(list);
  document.getElementById('cardContainer').innerHTML = renderCards(list, false);

  const section = document.getElementById('unverifiedSection');
  if (unverified.length > 0) {
    section.style.display = '';
    document.getElementById('unverifiedSummary').textContent = `가격 미확인 업체 (${unverified.length}개) 보기`;
    document.getElementById('unverifiedContainer').innerHTML = renderCards(unverified, true);
  } else {
    section.style.display = 'none';
  }

  if (currentView === 'map') renderMap();
}

/* ===== 이벤트 ===== */
document.getElementById('regionFilters').addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentRegion = btn.dataset.region;
  render();
});

document.getElementById('facilityFilters').addEventListener('click', e => {
  const btn = e.target.closest('.fac-btn');
  if (!btn) return;
  const fac = btn.dataset.fac;
  activeFacilities.has(fac) ? activeFacilities.delete(fac) : activeFacilities.add(fac);
  btn.classList.toggle('active');
  render();
});

document.getElementById('searchInput').addEventListener('input', e => {
  currentSearch = e.target.value;
  render();
});

document.getElementById('sortSelect').addEventListener('change', e => {
  currentSort = e.target.value;
  render();
});

/* ===== 초기화 ===== */
loadData();
