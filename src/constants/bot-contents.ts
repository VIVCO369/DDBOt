type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    FREE_BOTS: 2,
    ANALYSIS_TOOL: 3,
    PREMIUM_TOOLS: 4,
    D_TRADER: 5,
    MATCHES: 6,
    COPY_TRADE: 7,
    CHART: 8,
    TUTORIAL: 9,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-free-bots',
    'id-analysis-tool',
    'id-premium-tools',
    'id-d-trader',
    'id-matches',
    'id-copy-trade',
    'id-charts',
    'id-tutorials',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
