import { expect } from 'chai';
import { shallow } from 'enzyme';
import * as React from 'react';
import { test } from 'sarg';
import { spy } from 'sinon';
import { createSafeContext, withContext } from '../src';

test('it should provide context', () => {
    const VersionContext = createSafeContext<string>();
    const contextFn = spy((value: any) => <div id="version">
        {value}
    </div>);
    const wrapper = shallow(
        <VersionContext.Provider value="1.20">
            <VersionContext.Consumer>
                {contextFn}
            </VersionContext.Consumer>
        </VersionContext.Provider>
    );
    expect(wrapper.html()).to.be.deep.equal('<div id="version">1.20</div>');
    expect(contextFn).to.have.been.calledWith('1.20');
});

test('it should throw for unexistent context', () => {
    const VersionContext = createSafeContext<string>({
        name: 'VersionContext'
    });
    const contextFn = spy();
    const wrapper = shallow(
        <VersionContext.Consumer>{contextFn}</VersionContext.Consumer>
    );
    expect(() => wrapper.html()).to.throw(/Invalid value provided for VersionContext context/);
    expect(contextFn).to.have.not.been.called;
});

test('withContext() should combine one or more context', () => {
    interface IConfig {
        maxWaitTime: number;
    }
    const ConfigContext = createSafeContext<IConfig>({
        name: 'ConfigContext'
    });
    const Menu = ({ config }: { config: IConfig; }) => {
        return <React.Fragment>
            Max response time is {config.maxWaitTime}
        </React.Fragment>;
    };
    const MenuWithContext = withContext({
        config: ConfigContext
    }, ({ config }) => ({
        config
    }))(Menu);
    const wrapper = shallow(<ConfigContext.Provider value={{ maxWaitTime: 1000 }}>
        <MenuWithContext/>
    </ConfigContext.Provider>);

    expect(wrapper.html()).to.be.deep.equal('Max response time is 1000');
});
