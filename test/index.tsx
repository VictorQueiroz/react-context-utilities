import { expect } from 'chai';
import { shallow } from 'enzyme';
import { createContext, createRef, Fragment, PureComponent } from 'react';
import { Suite } from 'sarg';
import { spy } from 'sinon';
import {
    ContextFailure,
    createSafeContext,
    withContext
} from '../src';

const suite = new Suite();
const {test} = suite;

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

test('it should render the value provided to ContextFailure in case of unprovided context', () => {
    const VersionContext = createSafeContext<string>({
        name: 'VersionContext'
    });
    const Test = () => (
        <ContextFailure.Provider value={<Fragment>
            There was an application error, please try again later.
        </Fragment>}>
            <VersionContext.Consumer>{() => null}</VersionContext.Consumer>
        </ContextFailure.Provider>
    );
    const wrapper = shallow(
        <Test/>
    );
    expect(wrapper.html()).to.be.equal('There was an application error, please try again later.');
});

test('withContext() should work if withContext receive no contexts at all', () => {
    const Test1 = ({title}: {title: string;}) => <Fragment>
        {title}
    </Fragment>;
    const Wrapped_Test1 = withContext({}, () => ({}))(Test1);
    const wrapper = shallow(<Wrapped_Test1 title="Title" />);
    expect(wrapper.html()).to.be.equal('Title');
});

// test('withContext() baked component should return original component', () => {
//     const VersionContext = createContext(1.0);
//     const Test1 = ({title, version}: {
//         title: string;
//         version: number;
//     }) => <Fragment>{title} v{version.toFixed(1)}</Fragment>;
//     const Wrapped_Test1 = withContext({
//         version: VersionContext
//     }, ({version}) => ({version}))(Test1);
//     const wrapper1 = shallow(
//         <Wrapped_Test1.Component
//             title="App"
//             version={2.0}/>
//     );
//     const wrapper2 = shallow(
//         <Wrapped_Test1 title="App"/>
//     );
//     expect(wrapper1.html()).to.be.equal('App v2.0');
//     expect(wrapper2.html()).to.be.equal('App v1.0');
// });

// test('withContext() should have mapContextToProps property as optional', () => {
//     const Version = createContext(1.0);
//     function View({Version}:{Version: number;}) {
//         return <Fragment>
//             Version is {Version}
//         </Fragment>;
//     }
//     const Wrapped = withContext({
//         Version
//     })(View);
//     <Wrapped/>;
// });

// test('withContext() should infer properties even if no mapContextToProps property is defined', () => {
//     function View({Version}:{Version: number;}) {
//         return <Fragment>
//             Version is {Version}
//         </Fragment>;
//     }
//     const Wrapped2 = withContext({
//         Version: createContext('')
//     });
//     /* @ts-expect-error */ 
//     Wrapped2(View);
// })

test('withContext() should keep optional properties', () => {
    const Version = createContext(1.0);
    const View = (props: {
        version: number;
        title?: string;
    }) => (
        <Fragment>
            Title is {props.title} and version is {props.version}.
        </Fragment>
    );
    const View2 = withContext({
        version: Version
    },({version}) =>({version}))(View);
    <View2/>;
    <View2 title={undefined}/>;
    // @ts-expect-error
    <View2 title={1}/>;
})

test('withContext() should return a component capable of forwarding ref', () => {
    const Version = createContext(1.0);
    class View extends PureComponent<{title: string; version: number;}> {
        public getVersion() {
            return this.props.version;
        }
        public render() {
            const {
                version
            } = this.props;
            return <Fragment>
                Version is {version}
            </Fragment>;
        }
    }
    const Wrapped = withContext({
        Version
    },({Version}) => ({version: Version})).withForwardRef(View);
    const ref = createRef<View>();
    <Wrapped title="" ref={ref} />;
    // @ts-expect-error
    <Wrapped ref={ref} />;
    // @ts-expect-error
    <Wrapped title={0} ref={ref} />;

    ref.current?.getVersion();
});

test('withContext() should not accept ref object incompatible with the ref type', () => {
    const Version = createContext(1.0);
    class View extends PureComponent<{title: string; version: number;}> {
        public getVersion() {
            return this.props.version;
        }
        public render() {
            const {
                version
            } = this.props;
            return <Fragment>
                Version is {version}
            </Fragment>;
        }
    }
    const Wrapped = withContext({
        Version
    },({Version}) => ({version: Version})).withForwardRef(View);
    const ref = createRef<HTMLDivElement>();
    // @ts-expect-error
    <Wrapped title="" ref={ref} />;
});

test('withContext() should handle multiple contexts', () => {
    const Version = createContext(1.0);
    const URL = createContext('http://localhost:8080');
    const Location = createContext<[number, number]>([
        37.0902,
        95.7129
    ]);
    const View = ({
        url,
        location,
        version
    }: {
        location: [number, number];
        version: number;
        url: string;
    }) => <Fragment>
        URL: {url}, Location: latitude = {location[0]}, longitude = {location[1]}, Version: {version.toFixed(1)}
    </Fragment>;
    const Wrapped_View = withContext({
        version: Version,
        url: URL,
        location: Location
    }, ({location, url, version}) => ({
        version,
        url,
        location
    }))(View);
    const wrapper = shallow(<Wrapped_View/>);
    expect(wrapper.html()).to.be.equal('URL: http://localhost:8080, Location: latitude = 37.0902, longitude = 95.7129, Version: 1.0')
});

test('withContext() should combine one or more context', () => {
    interface IConfig {
        maxWaitTime: number;
    }
    const ConfigContext = createSafeContext<IConfig>({
        name: 'ConfigContext'
    });
    const Menu = ({ config, title }: { config: IConfig; title: string; }) => {
        return <Fragment>
            Title property is "{title}" and max response time is "{config.maxWaitTime}"
        </Fragment>;
    };
    const MenuWithContext = withContext({
        config: ConfigContext
    }, ({ config }) => ({
        config
    }))(Menu);
    const wrapper = shallow(<ConfigContext.Provider value={{ maxWaitTime: 1000 }}>
        <MenuWithContext title="x" />
    </ConfigContext.Provider>);

    expect(wrapper.html()).to.be.deep.equal('Title property is &quot;x&quot; and max response time is &quot;1000&quot;');
});

test('it should not accept withContext() calls where it actually injects invalid properties on the component', () => {
    const Version = createContext(1.0);
    const Test = ({version}: {version: string;}) => <Fragment>
        Version is {version}
    </Fragment>;

    const mapContextToProps = ({version}: {
        version: number;
    }) => ({version});
    
    const create = withContext({
        version: Version
    }, mapContextToProps);

    //@ts-expect-error
    create(Test);
});

export default suite;
