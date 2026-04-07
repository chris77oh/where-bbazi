(function(){
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.biz-card, .compare-table, .checklist-item, .header-stats').forEach(function(el){
    el.classList.add('reveal');
    io.observe(el);
  });
})();
