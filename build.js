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

/* ===== nesting-aware div 내용 교체 헬퍼 ===== */
/**
 * id="containerId" 를 가진 <div>의 내용을 newContent로 교체.
 * 중첩 <div>를 카운트해서 정확한 닫힘 태그를 찾으므로
 * build.js를 여러 번 실행해도 안전.
 */
function replaceContainerContent(html, containerId, newContent, indent) {
  const marker = `id="${containerId}"`;
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) throw new Error(`Container #${containerId} not found`);

  // 여는 태그의 '>' 위치 찾기
  const openEnd = html.indexOf('>', markerIdx) + 1;

  // 닫히는 </div> 위치를 depth 카운팅으로 탐색
  let depth = 1;
  let i = openEnd;
  while (i < html.length && depth > 0) {
    if (html[i] === '<') {
      if (html.startsWith('</div', i)) {
        depth--;
        if (depth === 0) break;
      } else if (html.startsWith('<div', i)) {
        depth++;
      }
    }
    i++;
  }
  if (depth !== 0) throw new Error(`No matching </div> for #${containerId}`);

  return html.substring(0, openEnd) + '\n' + newContent + '\n' + indent + html.substring(i);
}

/* ===== index.html에 삽입 ===== */
let html = fs.readFileSync(indexPath, 'utf8');

// tableContainer 내부 교체
const tableHtml = buildTable(verified);
html = replaceContainerContent(html, 'tableContainer', tableHtml, '      ');

// cardContainer 내부 교체
const cardHtml = buildCards(verified, false);
html = replaceContainerContent(html, 'cardContainer', cardHtml, '      ');

// unverifiedContainer 내부 교체
if (unverified.length > 0) {
  const unverifiedCardHtml = buildCards(unverified, true);
  html = replaceContainerContent(html, 'unverifiedContainer', unverifiedCardHtml, '        ');
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

console.log(`✅ index.html 빌드 완료: ${verified.length}개 업체 테이블 + ${unverified.length}개 미확인 업체 삽입됨`);

/* ===== reviews.html 정적화 ===== */
const reviewsDataPath = path.join(__dirname, 'data', 'blog_reviews.json');
const reviewsHtmlPath = path.join(__dirname, 'blog', 'reviews.html');

const reviewsJson = JSON.parse(fs.readFileSync(reviewsDataPath, 'utf8'));

const venueOrder = {
  '가평': [
    '캠프통포레스트', '아토믹 워터파크 수상레저', '이비자 수상레저', '아이언 수상레저',
    '크라운 수상레저', '선셋740 수상레저', '아레나 수상레저', '워터플레이 수상레저', '빠져수상레저&글램핑',
    '리버포인트 수상레저', '클럽비발디 수상레저', '알로하다이노 워터파크', '클로버 수상레저'
  ],
  '양평': ['토마토 수상레저'],
  '춘천': [
    '나루 수상레저', '북한강 포시즌 수상레저', '비버네선착장', '블루샤크 수상레저',
    '스피드존 수상레저', '힐링브릿지 수상레저', '칸 수상레저', '놀자수상레저',
    '리버팰리스 수상레저'
  ]
};

function formatDate(d) {
  if (!d || d.length < 8) return '';
  return d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6, 8);
}

function buildReviewsHtml(data) {
  let out = '';
  for (const [region, venues] of Object.entries(venueOrder)) {
    out += `  <div class="region-divider">${esc(region)}</div>\n`;
    for (const name of venues) {
      const reviews = data.reviews[name];
      if (!reviews || reviews.length === 0) continue;
      const id = name.replace(/[^가-힣a-zA-Z0-9]/g, '_');
      const searchQuery = encodeURIComponent(name + ' 빠지 후기');

      out += `  <div class="review-venue">\n`;
      out += `    <div class="rv-header" onclick="toggleReview('${esc(id)}')">\n`;
      out += `      <div><h4>${esc(name)}</h4><span class="rv-region">${esc(region)} · 리뷰 ${reviews.length}건</span></div>\n`;
      out += `      <span class="rv-toggle" id="toggle-${esc(id)}">▲ 접기</span>\n`;
      out += `    </div>\n`;
      // open 클래스: 정적 빌드에서 Googlebot이 콘텐츠를 볼 수 있도록 펼침 상태로 시작
      out += `    <div class="rv-body open" id="body-${esc(id)}">\n`;
      for (const r of reviews) {
        const link = safeUrl(r.link);
        out += `      <div class="rv-item">\n`;
        out += `        <div class="rv-title">${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>` : esc(r.title)}</div>\n`;
        out += `        <div class="rv-desc">${esc(r.description)}</div>\n`;
        out += `        <div class="rv-date">${esc(formatDate(r.date))}</div>\n`;
        out += `      </div>\n`;
      }
      out += `      <a href="https://search.naver.com/search.naver?where=blog&query=${searchQuery}" target="_blank" rel="noopener noreferrer" class="rv-more">네이버에서 더 많은 리뷰 보기 →</a>\n`;
      out += `    </div>\n`;
      out += `  </div>\n`;
    }
  }
  return out;
}

let reviewsHtml = fs.readFileSync(reviewsHtmlPath, 'utf8');
const reviewsContent = buildReviewsHtml(reviewsJson);
reviewsHtml = replaceContainerContent(reviewsHtml, 'reviewContainer', reviewsContent, '    ');
fs.writeFileSync(reviewsHtmlPath, reviewsHtml, 'utf8');

const totalReviews = Object.values(reviewsJson.reviews || {}).reduce((s, r) => s + r.length, 0);
console.log(`✅ reviews.html 정적화 완료: ${Object.keys(reviewsJson.reviews || {}).length}개 업체, ${totalReviews}건 리뷰 삽입됨`);
