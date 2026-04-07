(function () {
  var SKY_TEXT = { '1': '맑음', '3': '구름 많음', '4': '흐림' };
  var PTY_TEXT = { '0': '', '1': '비', '2': '비/눈', '3': '눈', '5': '빗방울', '6': '빗방울눈날림', '7': '눈날림' };
  var SKY_ICON = { '1': '☀️', '3': '⛅', '4': '☁️' };
  var PTY_ICON = { '1': '🌧️', '2': '🌨️', '3': '❄️', '5': '🌦️', '6': '🌨️', '7': '🌨️' };

  function skyDesc(sky, pty) {
    if (pty && pty !== '0') return (PTY_ICON[pty] || '') + ' ' + (PTY_TEXT[pty] || '');
    return (SKY_ICON[sky] || '') + ' ' + (SKY_TEXT[sky] || '');
  }

  function render(prefix, d) {
    document.getElementById(prefix + '-loading').style.display = 'none';
    document.getElementById(prefix + '-data').style.display = '';
    document.getElementById(prefix + '-temp').textContent = (d.T1H || '--') + '°';
    document.getElementById(prefix + '-sky').textContent = skyDesc(d.SKY, d.PTY);
    document.getElementById(prefix + '-rain').textContent = '강수 ' + (d.RN1 || '--');
    document.getElementById(prefix + '-humidity').textContent = '습도 ' + (d.REH || '--') + '%';
    document.getElementById(prefix + '-wind').textContent = '풍속 ' + (d.WSD || '--') + 'm/s';
  }

  function showFallback() {
    document.getElementById('gp-loading').textContent = '날씨 정보를 불러올 수 없습니다.';
    document.getElementById('cc-loading').textContent = '날씨 정보를 불러올 수 없습니다.';
    document.getElementById('weather-fallback').style.display = '';
  }

  fetch('/api/weather')
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (!json.ok) { showFallback(); return; }
      var gp = json.data.gapyeong;
      var cc = json.data.chuncheon;
      if (gp && !gp.error) render('gp', gp);
      else document.getElementById('gp-loading').textContent = '가평 날씨를 불러올 수 없습니다.';
      if (cc && !cc.error) render('cc', cc);
      else document.getElementById('cc-loading').textContent = '춘천 날씨를 불러올 수 없습니다.';
    })
    .catch(function () { showFallback(); });
})();
