#!/usr/bin/env node
/**
 * Metro course counting pass.
 *
 * Walks each state's PDGA course directory (server-rendered HTML) and counts
 * courses per metro, filtering rows by the metro's municipality list. This is
 * the authoritative "how many courses actually exist here" number — PDGA is
 * the canonical directory. (UDisc-only courses like Zilker are a cross-check layer,
 * handled separately via the Scrapling sweep — see docs/udisc-cross-check.md.)
 *
 *   npm run count:metros
 *
 * Output: docs/metro-course-counts.md (real counts vs. the targets in
 * docs/course-sourcing-targets.md).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../docs/metro-course-counts.md', import.meta.url));
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

// Metro boundaries: the municipalities whose PDGA rows count as "in the metro".
// These are MSA-informed and should be confirmed per metro before finalizing.
const METROS = {
  Austin: { states: ['TX'], localities: ['austin','round rock','cedar park','pflugerville','georgetown','leander','hutto','kyle','buda','liberty hill','lakeway','bee cave','west lake hills','rollingwood','sunset valley','del valle','manor','elgin','taylor','lago vista','jonestown','bastrop','lockhart','luling','san marcos','dripping springs','wimberley','spicewood','paige','smithville'] },
  Denver: { states: ['CO'], localities: ['denver','aurora','boulder','lakewood','arvada','westminster','thornton','broomfield','littleton','englewood','golden','morrison','conifer','evergreen','parker','highlands ranch','castle rock','centennial','greenwood village','wheat ridge','northglenn','commerce city','lone tree','louisville','lafayette','superior','erie','brighton','bailey','idledale','pine'] },
  Portland: { states: ['OR','WA'], localities: ['portland','gresham','beaverton','hillsboro','tigard','tualatin','lake oswego','milwaukie','oregon city','troutdale','fairview','estacada','north plains','st. helens','corbett','wood village','gladstone','happy valley','vancouver','camas','washougal','battle ground','scappoose','west linn','canby','molalla','wilsonville','sherwood','king city','aloha','forest grove','cornelius','banks','vernonia','rainier','clatskanie','damascus','boring','sandy','eagle creek','ridgefield','la center','woodland','yacolt','amboy','columbia city'] },
  Chicago: { states: ['IL','IN'], localities: ['chicago','joliet','naperville','aurora','elgin','waukegan','arlington heights','evanston','skokie','schaumburg','palatine','des plaines','oak park','cicero','bolingbrook','orland park','tinley park','hinsdale','lockport','mokena','channahon','plainfield','crown point','hammond','gary','michigan city','oak forest','alsip','crestwood','lemont','palos hills','palos park','hickory hills','justice','worth','burbank','bridgeview','oak lawn','evergreen park','blue island','homewood','flossmoor','olympia fields','country club hills','south holland','lansing','calumet city','dolton','harvey','thornton','glenwood','chicago heights','park forest','steger','crete','monee','peotone','manhattan','new lenox','homer glen','shorewood','oswego','yorkville','montgomery','sugar grove','elburn','maple park','sandwich','plano','morris','coal city','braidwood','wilmington','crest hill','romeoville','woodridge','willow springs','la grange','countryside','hodgkins','mccook','summit','forest park','oak brook','elmwood park','river grove','glenview','northbrook','wilmette','winnetka','glencoe','highland park','deerfield','lake forest','lake bluff','north chicago','gurnee','grayslake','round lake','mundelein','libertyville','vernon hills','lake zurich','buffalo grove','wheeling','prospect heights','mount prospect','niles','park ridge','morton grove','lincolnwood','norridge','harwood heights','schiller park','franklin park','melrose park','berwyn','stickney','bartlett','carol stream','crystal lake','algonquin','mchenry','huntley','st. charles','geneva','batavia','west chicago','downers grove','lisle','westmont','burr ridge','willowbrook','darien','warrenville','wheaton','glen ellyn','lombard','villa park','elmhurst','addison','bloomingdale','glendale heights','hanover park','streamwood','hoffman estates','rolling meadows','rosemont','northlake','stone park','bellwood','maywood','broadview','westchester','la grange park','brookfield','riverside','munster','highland','griffith','schererville','chesterton','valparaiso','portage','cedar lake'] },
  Seattle: { states: ['WA'], localities: ['seattle','bellevue','tacoma','everett','kent','redmond','renton','kirkland','bothell','seatac','burien','lakewood','federal way','mountlake terrace','shoreline','north bend','auburn','puyallup','issaquah','sammamish','kenmore','lynnwood','mill creek','mukilteo','des moines','enumclaw','buckley','bonney lake','sumner','orting','edgewood','fife','fircrest','university place','gig harbor','port orchard','bremerton','poulsbo','bainbridge island','vashon','mercer island','newcastle','tukwila','normandy park','edmonds','brier','woodway','lake forest park','snohomish','monroe','lake stevens','marysville','arlington','granite falls','sultan','gold bar','index','woodinville','duvall','carnation','snoqualmie','fall city','maple valley','covington','black diamond','ravensdale','hobart','pacific','algona','milton','steilacoom','dupont','olympia','lacey','tumwater','yelm'] },
  Charlotte: { states: ['NC','SC'], localities: ['charlotte','matthews','huntersville','cornelius','mooresville','concord','rock hill','fort mill','gastonia','belmont','mint hill','davidson','kannapolis','indian trail','monroe','waxhaw','clover','lake wylie'] },
  Houston: { states: ['TX'], localities: ['houston','cypress','spring','the woodlands','conroe','katy','sugar land','pearland','pasadena','baytown','league city','humble','tomball','kingwood','missouri city','stafford','richmond','rosenberg','galveston','texas city','dickinson','friendswood','magnolia','new caney','porter','bellaire','west university place','alief','fulshear','alvin','manvel','angleton','lake jackson','clute','freeport','webster','clear lake','seabrook','kemah','nassau bay','la porte','deer park','channelview','highlands','crosby','atascocita','willis','montgomery','waller','hempstead','brookshire','sealy','bellville','dayton','liberty','cleveland','winnie','anahuac','mont belvieu','splendora'] },
  Phoenix: { states: ['AZ'], localities: ['phoenix','mesa','scottsdale','tempe','chandler','gilbert','glendale','peoria','surprise','fountain hills','goodyear','avondale','apache junction','queen creek','sun city','buckeye','laveen','tolleson','el mirage','maricopa','casa grande'] },
  Nashville: { states: ['TN'], localities: ['nashville','madison','brentwood','franklin','murfreesboro','hendersonville','gallatin','smyrna','lebanon','antioch','hermitage','mount juliet','la vergne','goodlettsville','spring hill','columbia','fairview','white house','springfield'] },
  'Raleigh-Durham': { states: ['NC'], localities: ['raleigh','durham','cary','apex','morrisville','chapel hill','garner','holly springs','fuquay-varina','wake forest','knightdale','zebulon','carrboro','clayton','knightdale','wendell','rolesville','pittsboro','mebane'] },
  'Dallas-Fort Worth': { states: ['TX'], localities: ['dallas','fort worth','arlington','plano','irving','richardson','garland','mesquite','grand prairie','frisco','mckinney','carrollton','denton','lewisville','flower mound','grapevine','rockwall','bedford','euless','north richland hills','benbrook','keller','colleyville','southlake','mansfield','wylie','allen','rowlett','the colony','coppell','duncanville','desoto','cedar hill','lancaster','glenn heights','red oak','waxahachie','ennis','midlothian','farmers branch','addison','highland village','argyle','corinth','krum','sanger','pilot point','prosper','celina','sachse','murphy','parker','st. paul','lucas','fairview','princeton','farmersville','royse city','heath','fate','forney','terrell','kaufman','crandall','seagoville','sunnyvale','balch springs','kennedale','forest hill','haltom city','richland hills','hurst','roanoke','trophy club','haslet','saginaw','blue mound','lake worth','white settlement','river oaks','watauga','burleson','cleburne','granbury','weatherford','azle','springtown'] },
  'Kansas City': { states: ['MO','KS'], localities: ['kansas city','overland park','olathe','lenexa','shawnee','liberty','independence','lees summit','gladstone','raytown','blue springs','merriam','mission','prairie village','leawood','parkville','grandview','belton','raymore','excelsior springs','kearney','smithville','kansas city, ks'] },
  Atlanta: { states: ['GA'], localities: ['atlanta','marietta','alpharetta','roswell','sandy springs','decatur','duluth','lawrenceville','kennesaw','smyrna','dunwoody','brookhaven','east point','college park','dacula','norcross','peachtree city','woodstock','canton','cumming','milton','johns creek','lilburn','snellville','acworth','austell','stone mountain','conyers','covington','powder springs','hiram','dallas','douglasville','lithia springs','mableton','vinings','holly springs','ball ground','jasper','loganville','grayson','auburn','winder','monroe','social circle','oxford','porterdale','lithonia','tucker','clarkston','avondale estates','hapeville','union city','fairburn','palmetto','tyrone','fayetteville','senoia','newnan','riverdale','jonesboro','lovejoy','hampton','mcdonough','stockbridge','locust grove','morrow','forest park','lake city','ellenwood','doraville','chamblee'] },
  Cincinnati: { states: ['OH','KY','IN'], localities: ['cincinnati','covington','newport','florence','burlington','independence','hamilton','fairfield','mason','west chester','loveland','milford','blue ash','montgomery','sharonville','north college hill','norwood','fort thomas','erlanger','lawrenceburg'] },
  'Minneapolis-St. Paul': { states: ['MN'], localities: ['minneapolis','st. paul','bloomington','eden prairie','edina','richfield','roseville','white bear lake','woodbury','maple grove','brooklyn park','coon rapids','eagan','burnsville','apple valley','lakeville','plymouth','st. louis park','south st. paul','east bethel','oak grove','blaine','andover','mendota heights','inver grove heights','cottage grove','shakopee','savage','chaska','chanhassen','brooklyn center','columbia heights','fridley','spring lake park','mounds view','new brighton','arden hills','shoreview','vadnais heights','little canada','maplewood','oakdale','north st. paul','west st. paul','lilydale','rosemount','farmington','hastings','stillwater','oak park heights','bayport','lake elmo','mahtomedi','anoka','ramsey','champlin','dayton','rogers','otsego','elk river','zimmerman','princeton','cambridge','isanti','forest lake','hugo','lino lakes','circle pines','lexington','centerville','north oaks','osseo','crystal','robbinsdale','golden valley','new hope','medicine lake','minnetonka','hopkins','prior lake','carver','victoria','waconia','minnetrista','mound','excelsior','shorewood','tonka bay','deephaven','wayzata','long lake','orono','maple plain','independence','greenfield','corcoran','hanover','st. michael','albertville','monticello','buffalo','delano','watertown','mayer'] },
};

async function fetchState(state) {
  const courses = [];
  for (let page = 0; page < 20; page++) {
    const url = `https://www.pdga.com/course-directory/advanced/search?field_course_location_administrative_area=${state}&page=${page}`;
    const res = await fetch(url, { headers: HEADERS });
    if (res.status !== 200) break;
    const html = await res.text();
    const rows = [...html.matchAll(/<tr class="(?:odd|even)">([\s\S]*?)<\/tr>/g)];
    if (rows.length === 0) break;
    for (const m of rows) {
      const row = m[1];
      const name = (row.match(/course\/([a-z0-9-]+)">([^<]+)</) || [])[2];
      const city = (row.match(/field-course-location" >\s*([^<]+)/) || [])[1];
      const holes = (row.match(/field-course-holes" >\s*([^<]+)/) || [])[1];
      if (name) courses.push({ name: name.trim(), city: (city || '').trim(), holes: (holes || '').trim() });
    }
  }
  return courses;
}

const results = [];
for (const [metro, def] of Object.entries(METROS)) {
  const set = new Set(def.localities.map((l) => l.toLowerCase()));
  let count = 0;
  const found = [];
  for (const state of def.states) {
    const courses = await fetchState(state);
    for (const c of courses) {
      if (set.has(c.city.toLowerCase())) { count++; found.push(`${c.name} — ${c.city}, ${state} (${c.holes}h)`); }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  results.push({ metro, count, found });
  process.stderr.write(`${metro}: ${count}\n`);
}

const lines = [
  '# Metro Course Counts (PDGA counting pass)',
  '',
  `Generated ${new Date().toISOString().slice(0, 10)}. Counts = PDGA-listed courses whose city matches the metro municipality list. Add ~5% for UDisc-only courses (e.g. Zilker) during the exa cross-check.`,
  '',
  '| Metro | PDGA count | Target (est.) |',
  '|---|---|---|',
];
for (const r of results.sort((a, b) => b.count - a.count)) {
  lines.push(`| ${r.metro} | ${r.count} | |`);
}
lines.push('', '## Course lists', '');
for (const r of results) {
  lines.push(`### ${r.metro} (${r.count})`, '');
  r.found.forEach((f) => lines.push(`- ${f}`));
  lines.push('');
}
writeFileSync(OUT, lines.join('\n') + '\n');
console.log('Written to', OUT);
