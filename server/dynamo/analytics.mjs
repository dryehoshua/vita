const pages = new Set(['/','/cuenta','/perfil','/panel','/guias','/alojamientos','/ahora','/socialite']);
const dayFormat = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'});

export function mountAnalytics(app, store, local) {
  app.post('/api/internal/page-view', async (req,res) => {
    if (local || req.headers['x-vita-event'] !== 'page-view' || !pages.has(req.body.path)) {
      return res.sendStatus(404);
    }
    const path = req.body.path;
    const day = dayFormat.format(new Date());
    const key = day + ':' + path;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await store.transaction(async tx => {
          const record = await tx.get('PageViews',key) || {day,path,count:0};
          await tx.put('PageViews',key,{...record,count:record.count+1});
        });
        return res.sendStatus(204);
      } catch (error) {
        if (error.status !== 409 || attempt === 4) throw error;
      }
    }
  });
}
