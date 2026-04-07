/**
 * 빌드 스크립트: data.json → index.html 정적 테이블/카드 삽입
 * 구글봇이 JS 없이도 전체 업체 데이터를 볼 수 있도록 함
 *
 * 사용법: node build.js
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data', 'data.json');
const indexPath = path.join(__dirname, 'index.html');
const dataJsPath = path.join(__dirname, 'data', 'data.js');

const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const businesses = json.businesses || [];

// 가격 있는 업체만 추출 후 가격순 정렬
const verified = businesses
  .filter(b => b.price_per_person !== null)
  .sort((a, b) => a.price_per_person - b.price_per_person);

const unverified = businesses.filter(b => b.price_per_person === null);

/* ===== 헬퍼 함수 (app.js 로직과 동일) ===== */
function priceText(b) {
  const main = b.price_per_person.toLocaleString('ko-KR') + '원';
  if (b.price_min && b.price_max && b.price_min !== b.price_max) {
    return { main, range: b.price_min.toLocaleString('ko-KR') + '~' + b.price_max.toLocaleString('ko-KR') + '원' };
  }
  return { main, range: null };
}

function toiletTag(f) {
  if (!f || !f.toilet) return '<span class="ftag ftag-none">화장실 미확인</span>';
  const map = {
    building: ['ftag-toilet-building', '🏛️ 건물화장실'],
    shared: ['ftag-toilet-shared', '🚾 공용화장실'],
    portable: ['ftag-toilet-portable', '🚽 간이화장실']
  };
  const [cls, label] = map[f.toilet] || ['ftag-none', '화장실 미확인'];
  return `<span class="ftag ${cls}">${label}${f.toilet_note ? ' (' + esc(f.toilet_note) + ')' : ''}</span>`;
}

function showerTag(f) {
  if (!f || f.shower === null || f.shower === undefined) return '';
  if (!f.shower) return '<span class="ftag ftag-none">샤워 없음</span>';
  return `<span class="ftag ${f.shower_type === 'free' ? 'ftag-shower-free' : 'ftag-shower-paid'}">${f.shower_type === 'free' ? '🚿 샤워 무료' : '🚿 샤워 유료'}</span>`;
}

function changingTag(f) {
  if (!f || f.changing_room === null || f.changing_room === undefined) return '';
  return f.changing_room ? '<span class="ftag ftag-changing">👔 탈의실</span>' : '<span class="ftag ftag-none">탈의실 없음</span>';
}

function parkingText(p) {
  if (!p || !p.available) return '-';
  return [p.capacity ? esc(p.capacity) + '대' : '', p.walk_minutes ? '도보 ' + esc(p.walk_minutes) + '분' : ''].filter(Boolean).join(' · ') || '가능';
}

function bookingBtn(b) {
  let btns = [];
  const naverUrl = safeUrl(b.naver_booking_url);
  const siteUrl = safeUrl(b.website_url);
  if (naverUrl) btns.push(`<a href="${naverUrl}" target="_blank" rel="noopener noreferrer" class="btn-booking">예약하기 →</a>`);
  if (siteUrl) btns.push(`<a href="${siteUrl}" target="_blank" rel="noopener noreferrer" class="btn-website">홈페이지</a>`);
  if (b.phone) btns.push(`<a href="tel:${esc(b.phone.replace(/[^0-9+]/g, ''))}" class="btn-call">📞 전화</a>`);
  return btns.length ? btns.join('') : '<span class="no-link">준비중</span>';
}

function rankClass(i) {
  return i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank';
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  return /^https?:\/\//i.test(s) ? s : null;
}

function allFacilityTags(b) {
  return [toiletTag(b.facilities), showerTag(b.facilities), changingTag(b.facilities)].filter(Boolean).join('');
}

function pickupTag(pickup) {
  return pickup ? '<span class="ftag ftag-pickup">🚌 픽업</span>' : '';
}

/* ===== 테이블 HTML 생성 ===== */
function buildTable(list) {
  const rows = list.map((b, i) => {
    const { main, range } = priceText(b);
    const isLowest = i === 0;
    const lowestBadge = isLowest ? '<span class="badge-lowest">🏷️ 최저가</span>' : '';
    return `      <tr>
        <td style="text-align:center;width:36px"><span class="${rankClass(i)}">${i + 1}</span></td>
        <td><strong>${esc(b.name)}</strong>${lowestBadge}<br><span style="font-size:11px;color:#9CA3AF">${esc(b.city)}</span></td>
        <td class="price-cell">${main}${range ? `<span class="price-range">${range}</span>` : ''}</td>
        <td style="font-size:13px;color:#6B7280">${b.min_people ? b.min_people + '인 이상' : '-'}</td>
        <td><div class="facility-tags">${toiletTag(b.facilities)}${showerTag(b.facilities)}${changingTag(b.facilities)}</div></td>
        <td class="parking-info">${parkingText(b.parking)}${b.pickup ? '<br><span class="ftag ftag-pickup" style="margin-top:3px;display:inline-block">🚌 픽업</span>' : ''}</td>
        <td>${bookingBtn(b)}</td>
      </tr>`;
  }).join('\n');

  return `<table class="compare-table">
    <thead><tr>
      <th style="width:36px;text-align:center">#</th>
      <th>업체명</th><th>1인 가격</th><th>최소 인원</th><th>시설</th><th>주차/픽업</th><th>예약</th>
    </tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>`;
}

/* ===== 카드 HTML 생성 (모바일) ===== */
function buildCards(list, isUnverified) {
  return list.map((b, i) => {
    const isLowest = i === 0 && !isUnverified;
    const lowestBadge = isLowest ? '<span class="badge-lowest">🏷️ 최저가</span>' : '';

    let priceBlock;
    if (isUnverified) {
      priceBlock = '<div class="card-price" style="color:#9CA3AF;font-size:16px">가격 미확인</div>';
    } else {
      const { main, range } = priceText(b);
      priceBlock = `<div class="card-price">${main} <span class="card-price-sub">/ 1인</span></div>${range ? `<div class="card-price-range">${range}</div>` : ''}`;
    }

    const facilityTags = [toiletTag(b.facilities), showerTag(b.facilities), changingTag(b.facilities),
      (b.parking && b.parking.available) ? `<span class="ftag ftag-parking">🅿️ 주차${b.parking.capacity ? ' ' + esc(b.parking.capacity) + '대' : ''}</span>` : '',
      pickupTag(b.pickup)
    ].filter(Boolean).join('');

    return `    <div class="biz-card">
      <div class="card-rank-name">
        ${!isUnverified ? `<span class="card-rank ${rankClass(i)}">${i + 1}</span>` : ''}
        <span class="card-name">${esc(b.name)}</span>${lowestBadge}
      </div>
      <div class="card-location">📍 ${esc(b.region)} ${esc(b.city)}</div>
      ${priceBlock}
      <div class="card-meta">${[b.min_people ? '최소 ' + esc(b.min_people) + '인' : '', esc(b.hours) || ''].filter(Boolean).join(' · ')}</div>
      ${b.price_note ? `<div class="card-note">💬 ${esc(b.price_note)}</div>` : ''}
      <div class="card-facilities">
        <div class="card-facilities-title">시설</div>
        <div class="facility-tags">${facilityTags}</div>
      </div>
      <div class="card-actions">${bookingBtn(b)}</div>
    </div>`;
  }).join('\n');
}

/* ===== index.html에 삽입 ===== */
let html = fs.readFileSync(indexPath, 'utf8');

// tableContainer 내부 교체
const tableHtml = buildTable(verified);
html = html.replace(
  /(<div id="tableContainer">)([\s\S]*?)(<\/div>)/,
  `$1\n${tableHtml}\n      $3`
);

// cardContainer 내부 교체
const cardHtml = buildCards(verified, false);
html = html.replace(
  /(<div class="card-list" id="cardContainer">)([\s\S]*?)(<\/div>)/,
  `$1\n${cardHtml}\n      $3`
);

// unverifiedContainer 내부 교체
if (unverified.length > 0) {
  const unverifiedCardHtml = buildCards(unverified, true);
  html = html.replace(
    /(<div class="card-list" id="unverifiedContainer">)([\s\S]*?)(<\/div>)/,
    `$1\n${unverifiedCardHtml}\n        $3`
  );
  // unverifiedSection 표시 + summary 텍스트
  html = html.replace(
    /(<details class="unverified-section" id="unverifiedSection") style="display:none"/,
    `$1`
  );
  html = html.replace(
    /(<summary id="unverifiedSummary">)([\s\S]*?)(<\/summary>)/,
    `$1가격 미확인 업체 (${unverified.length}개) 보기$3`
  );
}

// resultCount 초기값
html = html.replace(
  /(<span id="resultCount">)0(<\/span>)/,
  `$1${verified.length}$2`
);

// lastUpdated 초기값
if (json.meta && json.meta.last_updated) {
  html = html.replace(
    /(<span id="lastUpdated" class="last-updated">)(<\/span>)/,
    `$1· ${json.meta.last_updated} 기준$2`
  );
}

fs.writeFileSync(indexPath, html, 'utf8');

// data.js도 동기화
fs.writeFileSync(dataJsPath, 'const BBAZI_DATA = ' + JSON.stringify(json, null, 2) + ';\n', 'utf8');

console.log(`✅ 빌드 완료: ${verified.length}개 업체 테이블 + ${unverified.length}개 미확인 업체 삽입됨`);
