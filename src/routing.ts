export type DashboardSurface='master'|'suite'|'land'|'vision'|'grant'|'thelma'|'cmgio'|'fabric';

export type DashboardRoute={
  surface:DashboardSurface;
  page?:string;
};

export const MASTER_MODULES=[
  'Dashboard','Analyst Memory','AI Mastery','Agent Hub','Leads Pipeline','Content Engine','Social Media','Trends','Communications','CRM','Products','Finance','System Audit','Certificates','Settings','Documents','Files','Team Overview','Video Storyboard','Social Analytics','Lead Scoring Rules','API Integration','Revenue Report','Agent Logs','Media Library','Multi-Account Posting','Trend Signal Alerts','Help Center'
] as const;

export const SUITE_PAGES=[
  'Executive Overview','Decisions & Approvals','Communications','People & Leadership','System Portfolio','Projects & Initiatives','Financial Command','Growth & Marketing','Property Intelligence','Grants & Funding','Operations','Intelligence & Research','Risk, Security & Compliance','Quality Control','Resource & Usage','Audit & History','Settings & Governance'
] as const;

export const slugify=(value:string)=>value.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const modulesBySlug=new Map(MASTER_MODULES.map(name=>[slugify(name),name]));
const suiteBySlug=new Map(SUITE_PAGES.map(name=>[slugify(name),name]));
const systemsBySlug:Record<string,DashboardSurface>={
  landweaver:'land',
  visionweaver:'vision',
  grantos:'grant',
  thelma:'thelma',
  'cmgio-map':'cmgio',
  'integration-fabric':'fabric'
};
const systemPaths:Record<Exclude<DashboardSurface,'master'|'suite'>,string>={
  land:'/systems/landweaver',
  vision:'/systems/visionweaver',
  grant:'/systems/grantos',
  thelma:'/systems/thelma',
  cmgio:'/systems/cmgio-map',
  fabric:'/systems/integration-fabric'
};

export function parseDashboardRoute(pathname:string):DashboardRoute{
  const clean=(pathname.split('?')[0].replace(/\/+$/,'')||'/').toLowerCase();
  if(clean==='/'||clean==='/dashboard')return{surface:'master',page:'Dashboard'};
  if(clean==='/visionweaver')return{surface:'vision'};
  const parts=clean.split('/').filter(Boolean);
  if(parts[0]==='modules'){
    const moduleSlug=parts[1]||'';
    if(moduleSlug==='agent-hub'||moduleSlug==='agent-logs')return{surface:'thelma'};
    const page=modulesBySlug.get(moduleSlug);
    return{surface:'master',page:page||'Dashboard'};
  }
  if(parts[0]==='c-suite'){
    const page=suiteBySlug.get(parts[1]||'executive-overview');
    return{surface:'suite',page:page||'Executive Overview'};
  }
  if(parts[0]==='systems'){
    const surface=systemsBySlug[parts[1]||''];
    if(surface)return{surface};
  }
  return{surface:'master',page:'Dashboard'};
}

export const routeForModule=(name:string)=>name==='Dashboard'?'/dashboard':name==='Agent Hub'||name==='Agent Logs'?'/systems/thelma':`/modules/${slugify(name)}`;
export const routeForSuitePage=(name:string)=>`/c-suite/${slugify(name)}`;
export const routeForSystem=(surface:Exclude<DashboardSurface,'master'|'suite'>)=>systemPaths[surface];
