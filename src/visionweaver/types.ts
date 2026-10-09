export type ViewId='V1'|'V2'|'V3';
export type PageKey=
|'home'|'vision-builder'|'strategic-planner'|'initiatives'|'programs-projects'|'ai-co-pilot'|'cmi'|'directors-guild'|'teams-csuite'
|'book-creation'|'avatar-engineering'|'worlds-locations'|'design-studio'|'design-commercial'|'scene-production'|'post-production'|'distribution-growth'
|'quality-audit'|'finance-accounting'|'it-security'|'resources'|'assets-knowledge'|'reports-insights'|'settings';

export type PageDef={
 key:PageKey;
 label:string;
 group:'CORE'|'CREATE & PRODUCE'|'MANAGE & GOVERN';
 primary:ViewId;
 views:Record<ViewId,string>;
 icon:string;
};

export type VWData={
 projects:any[];
 generations:any[];
 assets:any[];
 characters:any[];
 avatar_bindings:any[];
 continuity_jobs:any[];
 continuity_capsules:any[];
};

export type PageProps={
 data:VWData;
 view:ViewId;
 setView:(view:ViewId)=>void;
 open:(page:PageKey)=>void;
};
