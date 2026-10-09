import type{ReactElement}from'react';
import type{PageKey,PageProps}from'../types';
import{HomePage,VisionBuilderPage,StrategicPlannerPage,InitiativesPage,ProgramsPage,CopilotPage,CMIPage,GuildPage,TeamsPage}from'./core';
import{BookCreationPage,AvatarEngineeringPage,WorldsLocationsPage,DesignStudioPage,DesignCommercialPage,SceneProductionPage,PostProductionPage,DistributionGrowthPage}from'./create';
import{QualityAuditPage,FinanceAccountingPage,ITSecurityPage,ResourcesPage,AssetsKnowledgePage,ReportsInsightsPage,SettingsPage}from'./govern';

const PAGE_COMPONENTS:Partial<Record<PageKey,(p:PageProps)=>ReactElement>>={
 'home':HomePage,
 'vision-builder':VisionBuilderPage,
 'strategic-planner':StrategicPlannerPage,
 'initiatives':InitiativesPage,
 'programs-projects':ProgramsPage,
 'ai-co-pilot':CopilotPage,
 'cmi':CMIPage,
 'directors-guild':GuildPage,
 'teams-csuite':TeamsPage,
 'book-creation':BookCreationPage,
 'avatar-engineering':AvatarEngineeringPage,
 'worlds-locations':WorldsLocationsPage,
 'design-studio':DesignStudioPage,
 'design-commercial':DesignCommercialPage,
 'scene-production':SceneProductionPage,
 'post-production':PostProductionPage,
 'distribution-growth':DistributionGrowthPage,
 'quality-audit':QualityAuditPage,
 'finance-accounting':FinanceAccountingPage,
 'it-security':ITSecurityPage,
 'resources':ResourcesPage,
 'assets-knowledge':AssetsKnowledgePage,
 'reports-insights':ReportsInsightsPage,
 'settings':SettingsPage
};
export default function VisionWeaverPage({page,...props}:PageProps&{page:PageKey}){
 const C=PAGE_COMPONENTS[page];
 return C?<C {...props}/>:null;
}
