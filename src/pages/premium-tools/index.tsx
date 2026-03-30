import React from 'react';
import { observer } from 'mobx-react-lite';
import './premium-tools.scss';

const PremiumTools = observer(() => {
    return (
        <div className='premium-tools'>
            <div className='premium-tools__header'>
                <h1 className='premium-tools__title'>Premium Tools</h1>
                <p className='premium-tools__subtitle'>
                    Exclusive premium trading tools and advanced features for professional traders.
                </p>
            </div>
            <div className='premium-tools__content'>
                <div className='premium-tools__coming-soon'>
                    <div className='premium-tools__coming-soon-icon'>👑</div>
                    <h2>Coming Soon</h2>
                    <p>Our premium tools are under development. Stay tuned for exclusive features.</p>
                </div>
            </div>
        </div>
    );
});

export default PremiumTools;
