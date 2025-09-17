export function showToast(message, type='info'){
  let el = document.querySelector('.toast');
  if(!el){
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>{ el.className = 'toast'; }, 2500);
}
