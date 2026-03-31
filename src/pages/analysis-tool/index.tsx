import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import KingOfMatches from './king-of-matches';
import './analysis-tool.scss';

type TTab = 'summary' | 'analysis' | 'parameters';

const SUMMARY_STATS = [
    { label: 'Win Rate', value: '68.4%', change: '+2.1%', positive: true, icon: '🎯' },
    { label: 'Total Trades', value: '1,247', change: '+48 today', positive: true, icon: '📊' },
    { label: 'Profit/Loss', value: '+$3,842', change: '+$214 today', positive: true, icon: '💰' },
    { label: 'Avg Trade Duration', value: '4m 32s', change: '-12s vs avg', positive: true, icon: '⏱️' },
    { label: 'Max Drawdown', value: '8.2%', change: '-0.4% improved', positive: true, icon: '📉' },
    { label: 'Sharpe Ratio', value: '2.14', change: '+0.08 this week', positive: true, icon: '⚡' },
];

const MARKET_DATA = [
    { pair: 'Volatility 100 (1s)', trend: 'BULLISH', signal: 'BUY', confidence: 82, last: '9,842.15' },
    { pair: 'Volatility 75 (1s)', trend: 'BEARISH', signal: 'SELL', confidence: 71, last: '5,621.80' },
    { pair: 'Volatility 50 (1s)', trend: 'NEUTRAL', signal: 'WAIT', confidence: 55, last: '3,210.44' },
    { pair: 'Volatility 25 (1s)', trend: 'BULLISH', signal: 'BUY', confidence: 76, last: '1,948.22' },
    { pair: 'Boom 1000 Index', trend: 'BULLISH', signal: 'BUY', confidence: 88, last: '8,104.60' },
    { pair: 'Crash 1000 Index', trend: 'BEARISH', signal: 'SELL', confidence: 64, last: '7,392.11' },
];

const SIGNAL_HISTORY = [
    { time: '21:14:30', pair: 'Vol 100', signal: 'BUY', result: 'WIN', profit: '+$12.50' },
    { time: '21:10:05', pair: 'Boom 1000', signal: 'BUY', result: 'WIN', profit: '+$8.20' },
    { time: '21:07:48', pair: 'Vol 75', signal: 'SELL', result: 'LOSS', profit: '-$5.00' },
    { time: '21:02:12', pair: 'Vol 100', signal: 'BUY', result: 'WIN', profit: '+$10.00' },
    { time: '20:58:34', pair: 'Crash 1000', signal: 'SELL', result: 'WIN', profit: '+$14.00' },
];

const DEFAULT_PARAMS = {
    stake: '10',
    martingale: '2.0',
    max_stake: '500',
    take_profit: '100',
    stop_loss: '50',
    trade_type: 'rise_fall',
    duration: '1',
    duration_unit: 'ticks',
    market: 'synthetic_index',
    symbol: 'R_100',
    max_trades: '20',
    analysis_period: '15',
};

const AnalysisTool = observer(() => {
    const [activeTab, setActiveTab] = useState<TTab>('summary');
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [saved, setSaved] = useState(false);

    const handleParamChange = (key: string, value: string) => {
        setParams(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handleReset = () => {
        setParams(DEFAULT_PARAMS);
        setSaved(false);
    };

    return (
        <div className='analysis-tool'>
            <div className='analysis-tool__tabs'>
                <button
                    className={`analysis-tool__tab analysis-tool__tab--summary ${activeTab === 'summary' ? 'analysis-tool__tab--active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                >
                    Summary
                </button>
                <button
                    className={`analysis-tool__tab analysis-tool__tab--analysis ${activeTab === 'analysis' ? 'analysis-tool__tab--active' : ''}`}
                    onClick={() => setActiveTab('analysis')}
                >
                    AnalysisTool
                </button>
                <button
                    className={`analysis-tool__tab analysis-tool__tab--parameters ${activeTab === 'parameters' ? 'analysis-tool__tab--active' : ''}`}
                    onClick={() => setActiveTab('parameters')}
                >
                    Trading Parameters
                </button>
            </div>

            <div className='analysis-tool__content'>
                {activeTab === 'summary' && (
                    <div className='analysis-tool__summary'>
                        <div className='analysis-tool__summary-stats'>
                            {SUMMARY_STATS.map(stat => (
                                <div key={stat.label} className='analysis-tool__stat-card'>
                                    <div className='analysis-tool__stat-icon'>{stat.icon}</div>
                                    <div className='analysis-tool__stat-info'>
                                        <div className='analysis-tool__stat-value'>{stat.value}</div>
                                        <div className='analysis-tool__stat-label'>{stat.label}</div>
                                        <div className={`analysis-tool__stat-change ${stat.positive ? 'analysis-tool__stat-change--positive' : 'analysis-tool__stat-change--negative'}`}>
                                            {stat.change}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className='analysis-tool__summary-grid'>
                            <div className='analysis-tool__panel'>
                                <h3 className='analysis-tool__panel-title'>📈 Live Market Signals</h3>
                                <div className='analysis-tool__market-table'>
                                    <div className='analysis-tool__table-head'>
                                        <span>Symbol</span>
                                        <span>Trend</span>
                                        <span>Signal</span>
                                        <span>Confidence</span>
                                        <span>Last Price</span>
                                    </div>
                                    {MARKET_DATA.map(row => (
                                        <div key={row.pair} className='analysis-tool__table-row'>
                                            <span className='analysis-tool__symbol'>{row.pair}</span>
                                            <span className={`analysis-tool__trend analysis-tool__trend--${row.trend.toLowerCase()}`}>
                                                {row.trend === 'BULLISH' ? '▲' : row.trend === 'BEARISH' ? '▼' : '—'} {row.trend}
                                            </span>
                                            <span className={`analysis-tool__signal analysis-tool__signal--${row.signal.toLowerCase()}`}>
                                                {row.signal}
                                            </span>
                                            <div className='analysis-tool__confidence'>
                                                <div className='analysis-tool__confidence-bar'>
                                                    <div
                                                        className='analysis-tool__confidence-fill'
                                                        style={{ width: `${row.confidence}%` }}
                                                    />
                                                </div>
                                                <span>{row.confidence}%</span>
                                            </div>
                                            <span className='analysis-tool__price'>{row.last}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className='analysis-tool__panel'>
                                <h3 className='analysis-tool__panel-title'>🕐 Recent Signal History</h3>
                                <div className='analysis-tool__history'>
                                    {SIGNAL_HISTORY.map((entry, i) => (
                                        <div key={i} className={`analysis-tool__history-row analysis-tool__history-row--${entry.result.toLowerCase()}`}>
                                            <span className='analysis-tool__history-time'>{entry.time}</span>
                                            <span className='analysis-tool__history-pair'>{entry.pair}</span>
                                            <span className={`analysis-tool__history-signal analysis-tool__signal--${entry.signal.toLowerCase()}`}>{entry.signal}</span>
                                            <span className={`analysis-tool__history-result analysis-tool__history-result--${entry.result.toLowerCase()}`}>
                                                {entry.result === 'WIN' ? '✓' : '✗'} {entry.result}
                                            </span>
                                            <span className={`analysis-tool__history-profit ${entry.profit.startsWith('+') ? 'analysis-tool__positive' : 'analysis-tool__negative'}`}>
                                                {entry.profit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className='analysis-tool__kom-container'>
                        <KingOfMatches />
                    </div>
                )}

                {activeTab === 'parameters' && (
                    <div className='analysis-tool__parameters'>
                        <div className='analysis-tool__params-header'>
                            <h2 className='analysis-tool__params-title'>⚙️ Trading Parameters</h2>
                            <p className='analysis-tool__params-desc'>Configure your trading settings. These parameters will be applied when running your analysis and bots.</p>
                        </div>

                        <div className='analysis-tool__params-grid'>
                            <div className='analysis-tool__param-section'>
                                <h3 className='analysis-tool__section-title'>💵 Stake & Risk Management</h3>
                                <div className='analysis-tool__param-fields'>
                                    <div className='analysis-tool__param-field'>
                                        <label>Initial Stake ($)</label>
                                        <input
                                            type='number'
                                            value={params.stake}
                                            onChange={e => handleParamChange('stake', e.target.value)}
                                            min='0.35'
                                            step='0.01'
                                        />
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Martingale Multiplier</label>
                                        <input
                                            type='number'
                                            value={params.martingale}
                                            onChange={e => handleParamChange('martingale', e.target.value)}
                                            min='1'
                                            step='0.1'
                                        />
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Max Stake ($)</label>
                                        <input
                                            type='number'
                                            value={params.max_stake}
                                            onChange={e => handleParamChange('max_stake', e.target.value)}
                                            min='1'
                                        />
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Take Profit ($)</label>
                                        <input
                                            type='number'
                                            value={params.take_profit}
                                            onChange={e => handleParamChange('take_profit', e.target.value)}
                                            min='1'
                                        />
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Stop Loss ($)</label>
                                        <input
                                            type='number'
                                            value={params.stop_loss}
                                            onChange={e => handleParamChange('stop_loss', e.target.value)}
                                            min='1'
                                        />
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Max Trades Per Session</label>
                                        <input
                                            type='number'
                                            value={params.max_trades}
                                            onChange={e => handleParamChange('max_trades', e.target.value)}
                                            min='1'
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className='analysis-tool__param-section'>
                                <h3 className='analysis-tool__section-title'>📊 Market & Contract Settings</h3>
                                <div className='analysis-tool__param-fields'>
                                    <div className='analysis-tool__param-field'>
                                        <label>Market</label>
                                        <select
                                            value={params.market}
                                            onChange={e => handleParamChange('market', e.target.value)}
                                        >
                                            <option value='synthetic_index'>Synthetic Indices</option>
                                            <option value='forex'>Forex</option>
                                            <option value='stocks'>Stocks</option>
                                            <option value='commodities'>Commodities</option>
                                            <option value='crypto'>Cryptocurrencies</option>
                                        </select>
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Symbol</label>
                                        <select
                                            value={params.symbol}
                                            onChange={e => handleParamChange('symbol', e.target.value)}
                                        >
                                            <option value='R_100'>Volatility 100 (1s)</option>
                                            <option value='R_75'>Volatility 75 (1s)</option>
                                            <option value='R_50'>Volatility 50 (1s)</option>
                                            <option value='R_25'>Volatility 25 (1s)</option>
                                            <option value='R_10'>Volatility 10 (1s)</option>
                                            <option value='BOOM1000'>Boom 1000 Index</option>
                                            <option value='CRASH1000'>Crash 1000 Index</option>
                                            <option value='BOOM500'>Boom 500 Index</option>
                                            <option value='CRASH500'>Crash 500 Index</option>
                                        </select>
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Trade Type</label>
                                        <select
                                            value={params.trade_type}
                                            onChange={e => handleParamChange('trade_type', e.target.value)}
                                        >
                                            <option value='rise_fall'>Rise / Fall</option>
                                            <option value='higher_lower'>Higher / Lower</option>
                                            <option value='touch'>Touch / No Touch</option>
                                            <option value='even_odd'>Even / Odd</option>
                                            <option value='matches_differs'>Matches / Differs</option>
                                            <option value='over_under'>Over / Under</option>
                                        </select>
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Duration</label>
                                        <input
                                            type='number'
                                            value={params.duration}
                                            onChange={e => handleParamChange('duration', e.target.value)}
                                            min='1'
                                        />
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Duration Unit</label>
                                        <select
                                            value={params.duration_unit}
                                            onChange={e => handleParamChange('duration_unit', e.target.value)}
                                        >
                                            <option value='ticks'>Ticks</option>
                                            <option value='seconds'>Seconds</option>
                                            <option value='minutes'>Minutes</option>
                                            <option value='hours'>Hours</option>
                                            <option value='days'>Days</option>
                                        </select>
                                    </div>
                                    <div className='analysis-tool__param-field'>
                                        <label>Analysis Period (candles)</label>
                                        <input
                                            type='number'
                                            value={params.analysis_period}
                                            onChange={e => handleParamChange('analysis_period', e.target.value)}
                                            min='5'
                                            max='200'
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='analysis-tool__params-actions'>
                            <button className='analysis-tool__btn analysis-tool__btn--reset' onClick={handleReset}>
                                ↺ Reset to Default
                            </button>
                            <button
                                className={`analysis-tool__btn analysis-tool__btn--save ${saved ? 'analysis-tool__btn--saved' : ''}`}
                                onClick={handleSave}
                            >
                                {saved ? '✓ Saved!' : '💾 Save Parameters'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default AnalysisTool;
