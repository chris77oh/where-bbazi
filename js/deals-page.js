(function() {
    const API_URL = '/api/coupang-search';
    const containers = document.querySelectorAll('.live-products[data-keyword]');

    function escHtml(str) {
      if (!str) return '';
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

    function formatPrice(price) {
      return Number(price).toLocaleString('ko-KR') + '원';
    }

    function renderProducts(container, products) {
      if (!products || products.length === 0) return;

      let html = '<div class="live-products-title">실시간 인기 상품</div>';
      html += '<div class="live-grid">';

      products.forEach(function(p) {
        const badges = [];
        if (p.isRocket) badges.push('<span class="lc-badge rocket">로켓배송</span>');
        if (p.isFreeShipping) badges.push('<span class="lc-badge free-ship">무료배송</span>');

        const productUrl = safeUrl(p.productUrl);
        const productImage = safeUrl(p.productImage);
        if (!productUrl) return; // URL 검증 실패 시 해당 상품 스킵

        html += '<a href="' + productUrl + '" target="_blank" rel="noopener noreferrer" class="live-card">' +
          (productImage ? '<img src="' + productImage + '" alt="' + escHtml(String(p.productName || '').substring(0, 40)) + '" loading="lazy">' : '') +
          '<div class="lc-name">' + escHtml(p.productName) + '</div>' +
          '<div class="lc-price">' + formatPrice(p.productPrice) + '</div>' +
          (badges.length > 0 ? '<div class="lc-badges">' + badges.join('') + '</div>' : '') +
          '</a>';
      });

      html += '</div>';
      container.innerHTML = html;
    }

    // 시간차 호출 (Rate limit: 시간당 10회)
    let delay = 0;
    containers.forEach(function(container) {
      var keyword = container.getAttribute('data-keyword');

      setTimeout(function() {
        container.innerHTML = '<div class="live-loading">상품 불러오는 중...</div>';

        fetch(API_URL + '?keyword=' + encodeURIComponent(keyword) + '&limit=3')
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data.success && data.products.length > 0) {
              renderProducts(container, data.products);
            } else {
              container.innerHTML = ''; // fallback: 숨김, 정적 카드 유지
            }
          })
          .catch(function() {
            container.innerHTML = ''; // API 실패시 조용히 숨김
          });
      }, delay);

      delay += 800; // 카테고리 간 0.8초 간격
    });
  })();
