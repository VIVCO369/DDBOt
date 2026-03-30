import React from 'react';
import { observer } from 'mobx-react-lite';
import './copy-trade.scss';

const CopyTrade = observer(() => {
    return (
        <div className='copy-trade'>
            <div className='copy-trade__header'>
                <h1 className='copy-trade__title'>Copy Trade</h1>
                <p className='copy-trade__subtitle'>
                    Automatically copy the trades of expert traders and replicate their success.
                </p>
            </div>
            <div className='copy-trade__content'>
                <div className='copy-trade__coming-soon'>
                    <div className='copy-trade__coming-soon-icon'>📋</div>
                    <h2>Coming Soon</h2>
                    <p>Copy trading functionality is under development. Follow top traders automatically.</p>
                </div>
            </div>
        </div>
    );
});

export default CopyTrade;
