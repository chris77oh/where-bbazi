// 업체 순서 (지역별)
  const venueOrder = {
    "가평": [
      "캠프통포레스트","아토믹 워터파크 수상레저","이비자 수상레저","아이언 수상레저",
      "크라운 수상레저","선셋740 수상레저","아레나 수상레저","워터플레이 수상레저","빠져수상레저&글램핑",
      "리버포인트 수상레저","클럽비발디 수상레저","알로하다이노 워터파크","클로버 수상레저"
    ],
    "양평": ["토마토 수상레저"],
    "춘천": [
      "나루 수상레저","북한강 포시즌 수상레저","비버네선착장","블루샤크 수상레저",
      "스피드존 수상레저","힐링브릿지 수상레저","칸 수상레저","놀자수상레저",
      "리버팰리스 수상레저"
    ]
  };

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
    return /^https?:\/\//i.test(s) ? s : null;
  }

  function formatDate(d) {
    if (!d || d.length < 8) return '';
    return d.slice(0,4) + '.' + d.slice(4,6) + '.' + d.slice(6,8);
  }

  function renderReviews(data) {
    const container = document.getElementById('reviewContainer');
    let html = '';

    for (const [region, venues] of Object.entries(venueOrder)) {
      html += `<div class="region-divider">${region}</div>`;

      for (const name of venues) {
        const reviews = data.reviews[name];
        if (!reviews || reviews.length === 0) continue;

        const id = name.replace(/[^가-힣a-zA-Z0-9]/g, '_');
        html += `<div class="review-venue">
          <div class="rv-header" onclick="toggleReview('${escapeHtml(id)}')">
            <div>
              <h4>${escapeHtml(name)}</h4>
              <span class="rv-region">${escapeHtml(region)} · 리뷰 ${reviews.length}건</span>
            </div>
            <span class="rv-toggle" id="toggle-${escapeHtml(id)}">▼ 펼치기</span>
          </div>
          <div class="rv-body" id="body-${escapeHtml(id)}">`;

        for (const r of reviews) {
          const link = safeUrl(r.link);
          html += `<div class="rv-item">
            <div class="rv-title">${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>` : escapeHtml(r.title)}</div>
            <div class="rv-desc">${escapeHtml(r.description)}</div>
            <div class="rv-date">${escapeHtml(formatDate(r.date))}</div>
          </div>`;
        }

        const searchQuery = encodeURIComponent(name + ' 빠지 후기');
        html += `<a href="https://search.naver.com/search.naver?where=blog&query=${searchQuery}" target="_blank" rel="noopener noreferrer" class="rv-more">네이버에서 더 많은 리뷰 보기 →</a>`;
        html += `</div></div>`;
      }
    }

    container.innerHTML = html;
  }

  function toggleReview(id) {
    const body = document.getElementById('body-' + id);
    const toggle = document.getElementById('toggle-' + id);
    if (body.classList.contains('open')) {
      body.classList.remove('open');
      toggle.textContent = '▼ 펼치기';
    } else {
      body.classList.add('open');
      toggle.textContent = '▲ 접기';
    }
  }

  // 리뷰 데이터 로드
  fetch('../data/blog_reviews.json')
    .then(r => r.json())
    .then(data => renderReviews(data))
    .catch(() => {
      document.getElementById('reviewContainer').innerHTML =
        '<p style="text-align:center;color:#9CA3AF;padding:40px 0;">리뷰 데이터를 불러올 수 없습니다.</p>';
    });
