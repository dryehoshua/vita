export const missionVenues = [
 ['blend-condesa','Blend Station · Condesa','Ámsterdam 282, Condesa','https://blendstation.com.mx/pages/sucursales','cafe'],
 ['chiquitito-condesa','Chiquitito Café · Condesa','Alfonso Reyes 232 E, Hipódromo Condesa','https://chiquititocafe.com/','cafe'],
 ['buna-condesa','BUNA · Condesa','Ámsterdam 285, Condesa','https://buna.mx/pages/cafeterias','cafe'],
 ['pendulo-condesa','Cafebrería El Péndulo · Condesa','Nuevo León 115, Condesa','https://pendulo.com/especial/terraza-del-foro','cafe'],
 ['amin-condesa','Amïn Café','Michoacán 30, Hipódromo Condesa','https://amin.com.mx/','cafe'],
 ['blend-roma','Blend Station · Roma','Puebla 237, Roma Norte','https://blendstation.com.mx/pages/sucursales','cafe'],
 ['buna-roma','BUNA · Roma','Orizaba 42, Roma Norte','https://buna.mx/pages/cafeterias','cafe'],
 ['lardo','Lardo','Agustín Melgar 6, Condesa','https://www.lardo.com.mx/ubicacion.html','restaurant'],
].map(([id,name,address,website,category])=>({id,name,address,website,category,coffee:category==='cafe'}));
