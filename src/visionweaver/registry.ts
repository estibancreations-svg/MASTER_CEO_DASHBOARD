import type{PageDef,PageKey,ViewId}from'./types';

export const PAGES:PageDef[]=[
 {key:'home',label:'Home Dashboard',group:'CORE',primary:'V1',views:{V1:'Dashboard',V2:'Studio Overview',V3:'Project Focus'},icon:'home'},
 {key:'production-studio',label:'Production Studio',group:'CREATE & PRODUCE',primary:'V1',views:{V1:'Live Production Controls',V2:'Backend Operations',V3:'Production Diagnostics'},icon:'clapper'},
 {key:'vision-builder',label:'Vision Builder',group:'CORE',primary:'V1',views:{V1:'Creative Command Canvas',V2:'Blueprint & Dependencies',V3:'Concept-to-Production Map'},icon:'wand'},
 {key:'strategic-planner',label:'Strategic Planner',group:'CORE',primary:'V1',views:{V1:'Strategic Command Center',V2:'Scenario & Roadmap Studio',V3:'Goals, Risks & Outcomes'},icon:'gauge'},
 {key:'initiatives',label:'Initiatives',group:'CORE',primary:'V2',views:{V1:'Initiative Overview',V2:'Initiative Pipeline',V3:'Impact & Dependencies'},icon:'sparkles'},
 {key:'programs-projects',label:'Programs & Projects',group:'CORE',primary:'V2',views:{V1:'Portfolio Command',V2:'Program & Project Workspace',V3:'Timeline & Dependencies'},icon:'briefcase'},
 {key:'ai-co-pilot',label:'AI Co-Pilot',group:'CORE',primary:'V2',views:{V1:'AI Command Center',V2:'Agent Workflow Center',V3:'Specialist Marketplace'},icon:'bot'},
 {key:'cmi',label:'CMI',group:'CORE',primary:'V1',views:{V1:'Creative & Market Intelligence',V2:'Signals & Trends',V3:'Opportunity Intelligence'},icon:'pie'},
 {key:'directors-guild',label:'Directors Guild',group:'CORE',primary:'V2',views:{V1:'Guild Overview',V2:'Review & Decision Queue',V3:'Department Workrooms'},icon:'users'},
 {key:'teams-csuite',label:'Teams & C-Suite',group:'CORE',primary:'V1',views:{V1:'Organization Command',V2:'Authority & Handoff Map',V3:'Workforce & Agent Capacity'},icon:'building'},

 {key:'book-creation',label:'Book Creation',group:'CREATE & PRODUCE',primary:'V1',views:{V1:'Book Command Center',V2:'Writing Workspace',V3:'Publishing Pipeline'},icon:'book'},
 {key:'avatar-engineering',label:'Avatar Engineering',group:'CREATE & PRODUCE',primary:'V2',views:{V1:'Avatar Overview',V2:'Avatar State Studio',V3:'360 Engineering'},icon:'avatar'},
 {key:'worlds-locations',label:'Worlds & Locations',group:'CREATE & PRODUCE',primary:'V2',views:{V1:'Cinematic Grid',V2:'Interactive Map',V3:'World Builder Studio'},icon:'globe'},
 {key:'design-studio',label:'Design Studio',group:'CREATE & PRODUCE',primary:'V2',views:{V1:'Create Grid',V2:'Design Workspace',V3:'Catalogue Builder'},icon:'palette'},
 {key:'design-commercial',label:'Design & Commercial',group:'CREATE & PRODUCE',primary:'V1',views:{V1:'Campaign Command Grid',V2:'Interactive Commercial Studio',V3:'Placement & Performance'},icon:'image'},
 {key:'scene-production',label:'Scene & Production',group:'CREATE & PRODUCE',primary:'V1',views:{V1:'Production Workspace',V2:'Timeline & Continuity',V3:'Scene Operations'},icon:'clapper'},
 {key:'post-production',label:'Post Production',group:'CREATE & PRODUCE',primary:'V1',views:{V1:'Edit & Finish Desk',V2:'Color, Audio & VFX',V3:'AI Finishing & Delivery'},icon:'film'},
 {key:'distribution-growth',label:'Distribution & Growth',group:'CREATE & PRODUCE',primary:'V2',views:{V1:'Distribution Overview',V2:'Content Pipeline',V3:'Analytics & Growth'},icon:'monitor'},

 {key:'quality-audit',label:'Quality & Audit',group:'MANAGE & GOVERN',primary:'V1',views:{V1:'Quality Command Center',V2:'Evidence & Verification',V3:'Release Gate & Audit Trail'},icon:'shield'},
 {key:'finance-accounting',label:'Finance & Accounting',group:'MANAGE & GOVERN',primary:'V1',views:{V1:'Financial Command Center',V2:'Project Budget & Cost Control',V3:'Accounting & Revenue Operations'},icon:'finance'},
 {key:'it-security',label:'IT & Security',group:'MANAGE & GOVERN',primary:'V2',views:{V1:'IT & Security Command',V2:'Security & Infrastructure',V3:'Security, Reliability & Incidents'},icon:'security'},
 {key:'resources',label:'Resources',group:'MANAGE & GOVERN',primary:'V2',views:{V1:'Resource Library',V2:'Resources Hub',V3:'Collections & Collaboration'},icon:'boxes'},
 {key:'assets-knowledge',label:'Assets & Knowledge',group:'MANAGE & GOVERN',primary:'V2',views:{V1:'Assets Overview',V2:'Assets Library',V3:'Collections & Knowledge'},icon:'library'},
 {key:'reports-insights',label:'Reports & Insights',group:'MANAGE & GOVERN',primary:'V2',views:{V1:'Executive Reporting',V2:'Intelligence & Reporting',V3:'Insight Explorer'},icon:'activity'},
 {key:'settings',label:'Settings',group:'MANAGE & GOVERN',primary:'V2',views:{V1:'Quick Settings',V2:'Visual & System Control',V3:'Advanced Administration'},icon:'settings'}
];

export const PAGE_MAP=Object.fromEntries(PAGES.map(p=>[p.key,p])) as Record<PageKey,PageDef>;
export const VIEW_STORAGE_KEY='visionweaver.visualViews.canonical.v1';
export const safePage=(value?:string):PageKey=>{
 const key=(value||'home').toLowerCase() as PageKey;
 return PAGE_MAP[key]?key:'home';
};
export const loadViews=():Partial<Record<PageKey,ViewId>>=>{try{return JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY)||'{}')}catch{return{}}};
export const saveViews=(views:Partial<Record<PageKey,ViewId>>)=>localStorage.setItem(VIEW_STORAGE_KEY,JSON.stringify(views));
