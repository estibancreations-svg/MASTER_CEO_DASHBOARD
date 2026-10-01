import{useState}from'react';
import type{ReactElement,ReactNode}from'react';
import'./boards.css';
import{AgentHubBoard,AiMasteryBoard,CommunicationsBoard,ContentEngineBoard,DashboardBoard,LeadsPipelineBoard,SocialMediaBoard,TrendsBoard}from'./screensA';
import{CertificatesBoard,CrmBoard,FinanceBoard,LeadScoringBoard,ProductsBoard,SettingsBoard,SocialAnalyticsBoard,SystemAuditBoard,TeamOverviewBoard,VideoStoryboardBoard}from'./screensB';
import{AgentLogsBoard,ApiIntegrationBoard,HelpCenterBoard,MediaLibraryBoard,MultiAccountPostingBoard,OperationalSyncBoard,RevenueReportBoard,TrendSignalAlertsBoard,VerificationPortfolioBoard}from'./screensC';

/** Board screens keyed by MASTER_MODULES name (src/routing.ts). */
export const SCREENS:Record<string,()=>ReactElement>={
  'Dashboard':DashboardBoard,'AI Mastery':AiMasteryBoard,'Agent Hub':AgentHubBoard,'Leads Pipeline':LeadsPipelineBoard,
  'Content Engine':ContentEngineBoard,'Social Media':SocialMediaBoard,'Trends':TrendsBoard,'Communications':CommunicationsBoard,
  'CRM':CrmBoard,'Products':ProductsBoard,'Finance':FinanceBoard,'System Audit':SystemAuditBoard,'Certificates':CertificatesBoard,
  'Settings':SettingsBoard,'Team Overview':TeamOverviewBoard,'Video Storyboard':VideoStoryboardBoard,'Social Analytics':SocialAnalyticsBoard,
  'Lead Scoring Rules':LeadScoringBoard,'API Integration':ApiIntegrationBoard,'Revenue Report':RevenueReportBoard,'Agent Logs':AgentLogsBoard,
  'Media Library':MediaLibraryBoard,'Multi-Account Posting':MultiAccountPostingBoard,'Trend Signal Alerts':TrendSignalAlertsBoard,'Help Center':HelpCenterBoard
};
/** Extra board variants that are not their own module. */
export const EXTRAS:Record<string,()=>ReactElement>={'Operational Sync':OperationalSyncBoard,'Verification Portfolio':VerificationPortfolioBoard};

export const hasBoardScreen=(name:string)=>name in SCREENS;
type Theme='standard'|'cyberpunk'|'glass'|'executive'|'neumorphic';
const THEMES:[Theme,string][]=[['standard','Standard'],['executive','Executive Minimalist'],['cyberpunk','Cyberpunk'],['glass','Glass'],['neumorphic','Neumorphic']];

export default function BoardFrame({name,live,liveLabel='Live module'}:{name:string;live:ReactNode;liveLabel?:string}):ReactElement{
  const[tab,setTab]=useState<'board'|'live'>('live');
  const[theme,setTheme]=useState<Theme>('executive');
  const Screen=SCREENS[name];
  if(!Screen)return<>{live}</>;
  return<div className="bd" data-theme={theme}>
    <div className="bd-top">
      <div className="bd-tabs" role="tablist" aria-label={`${name} views`}>
        <button role="tab" aria-selected={tab==='board'} onClick={()=>setTab('board')}>Board design</button>
        <button role="tab" aria-selected={tab==='live'} onClick={()=>setTab('live')}>{liveLabel}</button>
      </div>
      {tab==='board'&&<div className="bd-themes" role="group" aria-label="Theme">{THEMES.map(([id,label])=><button key={id} aria-pressed={theme===id} onClick={()=>setTheme(id)}>{label}</button>)}</div>}
    </div>
    {tab==='board'?<>
      <p className="bd-notice" role="note">Illustrative data. This is a VISUAL_REFERENCE of the approved board, not live or verified figures.</p>
      <Screen/>
    </>:<div className="bd-live">{live}</div>}
  </div>;
}
