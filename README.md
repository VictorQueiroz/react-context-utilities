# react-context-utilities

Utilities to productively create and combine new ReactJS context.

### Installation

```
yarn add react-context-utilities
```

### Usage

You can use `createSafeContext` to create a safe ReactJS context instance. Whenever you try to render the `Context.Consumer` without rendering `Context.Provider` above it, it'll throw an error. 

```ts
interface IConfig {
    maxWaitTime: number;
}
/**
 * createSafeContext will make sure it won't need to provide
 * a default value for it since it'll throw an error
 * if you try to consume without a provider above it
 */
const ConfigContext = createSafeContext<IConfig>({
    name: 'ConfigContext'
});
function mapContextToProps({ config }: { config: ConfigContext; }) {
    return {
        config
    };
}
const Menu = ({ config }: { config: IConfig; }) => {
    return <React.Fragment>
        Max response time is {config.maxWaitTime}
    </React.Fragment>;
};
/**
 * As expected, `MenuWithContext` will no longer ask
 * for `config` property in type annotation
 */
const MenuWithContext = withContext({
    config: ConfigContext
}, mapContextToProps)(Menu);
const wrapper = shallow(<ConfigContext.Provider value={{ maxWaitTime: 1000 }}>
    <MenuWithContext/>
</ConfigContext.Provider>);
```