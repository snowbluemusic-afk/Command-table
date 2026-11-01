/* Forge-powered offline deck workshop. The library is bundled inside APK.
 * This augments the prototype's small catalog with the actual 34k+ scripts.
 */
(() => {
  'use strict';
  const attempted = new Set();
  let searchTimer = null;
  let commanderTimer = null;
  let resolving = false;

  function upsert(card) {
    if (!card || !card.name) return;
    const records = window.CardData?.cards;
    if (!Array.isArray(records)) return;
    const existing=records.find(x=>String(x.name).toLowerCase()===card.name.toLowerCase());
    const verified={...card,implemented:true,effect:'forge'};
    if(existing) Object.assign(existing,verified);
    else records.push(verified);
  }

  async function search(query, commanderOnly = false) {
    const bridge=window.CommandTableNative;
    if(!bridge?.ready || String(query||'').trim().length<2)return [];
    const response=await bridge.request('card.search',{
      query:String(query).trim(),commanderOnly,limit:60
    });
    return Array.isArray(response?.cards)?response.cards:[];
  }

  async function liveSearch(query) {
    try {
      const cards=await search(query);
      cards.forEach(upsert);
      const input=document.getElementById('searchInput');
      if(!input||input.value.trim()!==query)return;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const results=document.getElementById('searchResults');
      if(!cards.length&&results)
        results.textContent='No matches in the installed Forge card database.';
    }catch(err) {
      const results=document.getElementById('searchResults');
      if(results)results.textContent='Forge card search failed: '+(err?.message||String(err));
    }
  }

  async function liveCommanderSearch(query) {
    try {
      const cards=await search(query,true);
      cards.forEach(upsert);
      const input=document.getElementById('commanderSelect');
      if(!input||input.value.trim()!==query)return;
      const list=document.getElementById('commanderOptions');
      if(!list)return;
      list.replaceChildren();
      for (const card of cards) {
        const opt=document.createElement('option');
        opt.value=card.name;
        list.append(opt);
      }
    }catch(_){}
  }

  document.addEventListener('input',event=>{
    if(!event.isTrusted)return; // Avoid recursing on our own refreshed results.
    if(event.target.id==='searchInput') {
      clearTimeout(searchTimer);
      const query=event.target.value.trim();
      if(query.length>=2)searchTimer=setTimeout(()=>liveSearch(query),220);
    }
    if(event.target.id==='commanderSelect') {
      clearTimeout(commanderTimer);
      const query=event.target.value.trim();
      if(query.length>=2)commanderTimer=setTimeout(()=>liveCommanderSearch(query),260);
    }
  },true);

  async function resolveSavedDecks() {
    if(resolving || !window.CommandTableNative?.ready)return;
    const decks=window.app?.decks||[];
    const batch=[];
    for(const deck of decks) {
      for(const name of [deck.commander,...(deck.cards||[])]) {
        const key=String(name||'').trim().toLowerCase();
        if(!key || attempted.has(key))continue;
        attempted.add(key);
        batch.push(name);
        if(batch.length>=150)break;
      }
      if(batch.length>=150)break;
    }
    if(!batch.length)return;
    resolving=true;
    try {
      const response=await window.CommandTableNative.request('cards.resolve',{names:batch});
      (response?.cards||[]).forEach(upsert);
      if(window.app?.view==='edit'||window.app?.view==='decks')window.render?.();
    }catch(err) {
      for(const name of batch)attempted.delete(String(name).trim().toLowerCase());
    }finally{resolving=false;}
  }

  setInterval(resolveSavedDecks,8000);
  setTimeout(resolveSavedDecks,1600);
  window.CommandTableCatalog={search,resolveSavedDecks};
})();
