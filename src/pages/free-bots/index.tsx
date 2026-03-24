import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { load, save_types } from '@/external/bot-skeleton';
import './free-bots.scss';

interface Bot {
    id: string;
    name: string;
    description: string;
    fileName: string;
    category: string;
    icon: string;
}

const BOTS: Bot[] = [
    {
        id: '1',
        name: 'Expert Speed Bot',
        description: 'Advanced speed trading bot with optimized entry and exit points for quick trades.',
        fileName: '2_2025_Updated_Expert_Speed_Bot_Version_📉📉📉📈📈📈_1_1_1765711647656.xml',
        category: 'Speed Trading',
        icon: '⚡',
    },
    {
        id: '2',
        name: 'Candle Mine Bot',
        description: 'Analyzes candlestick patterns to identify profitable trading opportunities.',
        fileName: '3_2025_Updated_Version_Of_Candle_Mine🇬🇧_1765711647657.xml',
        category: 'Pattern Analysis',
        icon: '🕯️',
    },
    {
        id: '3',
        name: 'Accumulators Pro Bot',
        description: 'Professional accumulator strategy bot for consistent growth trading.',
        fileName: 'Accumulators_Pro_Bot_1765711647657.xml',
        category: 'Accumulators',
        icon: '📈',
    },
    {
        id: '4',
        name: 'AI Entry Point Bot',
        description: 'AI-powered bot that identifies optimal entry points for maximum profit.',
        fileName: 'AI_with_Entry_Point_1765711647658.xml',
        category: 'AI Trading',
        icon: '🤖',
    },
    {
        id: '5',
        name: 'Alex Speed Bot EXPRO2',
        description: 'Enhanced speed trading bot with advanced algorithms for rapid execution.',
        fileName: 'ALEXSPEEDBOT__EXPRO2_(2)_(1)_1765711647659.xml',
        category: 'Speed Trading',
        icon: '🚀',
    },
    {
        id: '6',
        name: 'Alpha AI Two Predictions',
        description: 'Dual prediction AI system for higher accuracy in market forecasting.',
        fileName: 'Alpha_Ai_Two_Predictions__1765711647659.xml',
        category: 'AI Trading',
        icon: '🎯',
    },
    {
        id: '7',
        name: 'Auto C4 Volt Premium',
        description: 'Premium automated trading bot with advanced market analysis features.',
        fileName: 'AUTO_C4_VOLT_🇬🇧_2_🇬🇧_AI_PREMIUM_ROBOT_(2)_(1)_1765711647660.xml',
        category: 'Premium',
        icon: '⚡',
    },
    {
        id: '8',
        name: 'Binary Flipper AI Plus',
        description: 'AI-enhanced binary options trading bot with flip strategy optimization.',
        fileName: 'BINARY_FLIPPER_AI_ROBOT_PLUS_+_1765711647660.xml',
        category: 'AI Trading',
        icon: '🔄',
    },
    {
        id: '9',
        name: 'Binarytool Wizard AI',
        description: 'Intelligent trading wizard with multiple strategy implementations.',
        fileName: 'BINARYTOOL_WIZARD_AI_BOT_1765711647661.xml',
        category: 'AI Trading',
        icon: '🧙',
    },
    {
        id: '10',
        name: 'Binarytool Differ V2.0',
        description: 'Version 2.0 differ bot with improved accuracy and performance.',
        fileName: 'BINARYTOOL@_DIFFER_V2.0_(1)_(1)_1765711647662.xml',
        category: 'Differ',
        icon: '📊',
    },
    {
        id: '11',
        name: 'Even Odd Thunder AI Pro',
        description: 'Professional even/odd prediction bot with thunder-fast execution.',
        fileName: 'BINARYTOOL@EVEN_ODD_THUNDER_AI_PRO_BOT_1765711647662.xml',
        category: 'Even/Odd',
        icon: '⚡',
    },
    {
        id: '12',
        name: 'Even & Odd AI Bot',
        description: 'Smart AI bot specialized in even and odd digit predictions.',
        fileName: 'BINARYTOOL@EVEN&ODD_AI_BOT_(2)_1765711647663.xml',
        category: 'Even/Odd',
        icon: '🎲',
    },
    {
        id: '13',
        name: 'Consecutive Even Odd',
        description: 'Analyzes consecutive even and odd patterns for trading decisions.',
        fileName: 'Consecutive_Even_Odd_BM_1774351829096.xml',
        category: 'Even/Odd',
        icon: '🔢',
    },
    {
        id: '14',
        name: 'Even Odd AI Entry Scanner',
        description: 'Advanced scanner that identifies optimal entry points for even/odd trades.',
        fileName: 'Even_Odd_AI_Entry_Scanner_🔍_BM_1774351829098.xml',
        category: 'AI Trading',
        icon: '🔍',
    },
    {
        id: '15',
        name: 'Even Odd Entry Bot',
        description: 'Specialized bot for even/odd entry point predictions.',
        fileName: 'EVEN_ODD_ENTRY_BOT_BM_1774351829096.xml',
        category: 'Even/Odd',
        icon: '📍',
    },
    {
        id: '16',
        name: 'Market Switcher Premium',
        description: 'Premium multi-market switching bot for diverse trading opportunities.',
        fileName: 'Market_Switcher_PREMIUM_BM_1774351829097.xml',
        category: 'Premium',
        icon: '🔀',
    },
    {
        id: '17',
        name: 'Monarch SV6 Bot',
        description: 'Sophisticated trading bot with advanced market analysis capabilities.',
        fileName: 'Monarch_SV6_BOT_BM_1774351829096.xml',
        category: 'Premium',
        icon: '👑',
    },
    {
        id: '18',
        name: 'Over 0 AI Bot',
        description: 'AI-powered bot specializing in over/under zero predictions.',
        fileName: 'Over_0_AI_Bot_BM_1774351829099.xml',
        category: 'AI Trading',
        icon: '🎯',
    },
    {
        id: '19',
        name: 'Over 2 AI Bot',
        description: 'Advanced AI bot for over 2 threshold trading strategy.',
        fileName: 'Over_2_AI_Bot_BM_1774351829099.xml',
        category: 'AI Trading',
        icon: '🤖',
    },
    {
        id: '20',
        name: 'Pip Speed Over Under Bot',
        description: 'High-speed pip trading bot for over/under market predictions.',
        fileName: 'Pip_speed_(Over_Under)_Bot_BM_1774351829097.xml',
        category: 'Speed Trading',
        icon: '💨',
    },
    {
        id: '21',
        name: 'Snipper Havoc AI Bot',
        description: 'Aggressive AI bot with snippet-based trading strategies.',
        fileName: 'SNIPPER_HAVOC_AI_BOT_BM_1774351829097.xml',
        category: 'AI Trading',
        icon: '⚔️',
    },
    {
        id: '22',
        name: 'Snipper Havoc V2 AI',
        description: 'Enhanced version 2 of the Snipper Havoc bot with improved algorithms.',
        fileName: 'SNIPPER_HAVOC_V2_AI._BM_1774351829097.xml',
        category: 'AI Trading',
        icon: '🔥',
    },
    {
        id: '23',
        name: 'The Bull Trader AI Software',
        description: 'Bullish market AI software with aggressive trading strategies.',
        fileName: 'THE_BULL_TRADER_AI_SOFTWARE_BM_1774351829098.xml',
        category: 'AI Trading',
        icon: '🐂',
    },
    {
        id: '24',
        name: 'Under 8 Over 5 AI Pro',
        description: 'Professional AI bot for under 8 and over 5 trading patterns.',
        fileName: 'Under_8_Over_5_AI_Pro_Bot_BM_1774351829099.xml',
        category: 'AI Trading',
        icon: '⚡',
    },
    {
        id: '25',
        name: 'Under 9 Bot',
        description: 'Specialized bot for under 9 threshold trading opportunities.',
        fileName: 'Under_9_Bot_BM_1774351829098.xml',
        category: 'Pattern Analysis',
        icon: '📉',
    },
    {
        id: '26',
        name: 'VirtualHOOK Differs',
        description: 'Virtual hook-based differ bot with advanced prediction techniques.',
        fileName: 'VirtualHOOK-Differs_BM_1774351829098.xml',
        category: 'Differ',
        icon: '🎣',
    },
];

const FreeBots = observer(() => {
    const { dashboard } = useStore();
    const [loadingBotId, setLoadingBotId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    const categories = ['All', ...Array.from(new Set(BOTS.map(bot => bot.category)))];

    const filteredBots = selectedCategory === 'All' 
        ? BOTS 
        : BOTS.filter(bot => bot.category === selectedCategory);

    const sanitizeXML = (xmlString: string): string => {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('Invalid XML file');
            }

            // Get list of supported blocks from Blockly
            const blockly = (window as any).Blockly;
            const supportedBlocks = new Set(Object.keys(blockly?.Blocks || {}));

            // Get all blocks in the XML
            const blocks = xmlDoc.querySelectorAll('block, shadow');
            const unsupportedBlocks: string[] = [];

            // Check for unsupported blocks and log them
            blocks.forEach(block => {
                const blockType = block.getAttribute('type');
                if (blockType && !supportedBlocks.has(blockType)) {
                    if (!unsupportedBlocks.includes(blockType)) {
                        unsupportedBlocks.push(blockType);
                    }
                }
            });

            if (unsupportedBlocks.length > 0) {
                console.warn(`Warning: XML contains unsupported blocks: ${unsupportedBlocks.join(', ')}`);
            }

            // Serialize back to string
            const serializer = new XMLSerializer();
            return serializer.serializeToString(xmlDoc);
        } catch (error) {
            console.error('Error sanitizing XML:', error);
            return xmlString; // Return original if sanitization fails
        }
    };

    const loadBot = async (bot: Bot) => {
        try {
            setLoadingBotId(bot.id);
            
            const response = await fetch(`/bots/${bot.fileName}`);
            if (!response.ok) {
                throw new Error('Failed to fetch bot file');
            }
            
            let xmlContent = await response.text();
            
            // Sanitize XML before loading
            xmlContent = sanitizeXML(xmlContent);
            
            const blockly = (window as any).Blockly;
            
            if (!blockly?.derivWorkspace) {
                throw new Error('Bot Builder workspace not initialized. Please refresh the page.');
            }

            await load({
                block_string: xmlContent,
                file_name: bot.name,
                workspace: blockly.derivWorkspace,
                from: save_types.LOCAL,
                drop_event: {},
                strategy_id: bot.id,
                showIncompatibleStrategyDialog: false,
                show_snackbar: true,
            });

            // Store the XML for later use
            blockly.derivWorkspace.strategy_to_load = xmlContent;

            dashboard.setActiveTab(1);
            window.location.hash = 'bot_builder';
            
        } catch (error) {
            console.error('Error loading bot:', error);
            const errorMsg = error instanceof Error ? error.message : 'Please try again or refresh and retry';
            alert(`Failed to load ${bot.name}.\n\n${errorMsg}`);
        } finally {
            setLoadingBotId(null);
        }
    };

    return (
        <div className='free-bots'>
            <div className='free-bots__header'>
                <h1 className='free-bots__title'>Free Trading Bots</h1>
                <p className='free-bots__subtitle'>
                    Explore our collection of pre-built trading bots. Click on any bot to load it into the Bot Builder.
                </p>
            </div>

            <div className='free-bots__categories'>
                {categories.map(category => (
                    <button
                        key={category}
                        className={`free-bots__category-btn ${selectedCategory === category ? 'free-bots__category-btn--active' : ''}`}
                        onClick={() => setSelectedCategory(category)}
                    >
                        {category}
                    </button>
                ))}
            </div>

            <div className='free-bots__grid'>
                {filteredBots.map(bot => (
                    <div key={bot.id} className='free-bots__card'>
                        <div className='free-bots__card-header'>
                            <span className='free-bots__card-icon'>{bot.icon}</span>
                            <span className='free-bots__card-category'>{bot.category}</span>
                        </div>
                        <h3 className='free-bots__card-title'>{bot.name}</h3>
                        <p className='free-bots__card-description'>{bot.description}</p>
                        <button
                            className='free-bots__card-btn'
                            onClick={() => loadBot(bot)}
                            disabled={loadingBotId === bot.id}
                        >
                            {loadingBotId === bot.id ? (
                                <span className='free-bots__card-btn-loading'>Loading...</span>
                            ) : (
                                <>
                                    <span>Load Bot</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            <div className='free-bots__footer'>
                <p>All bots are provided for educational purposes. Always test with demo accounts first.</p>
            </div>
        </div>
    );
});

export default FreeBots;
