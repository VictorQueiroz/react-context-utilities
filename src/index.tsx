import * as React from 'react';
import { ConsumerProps, createContext, ProviderProps } from "react";
import { Diff } from 'utility-types';

export type ExtractContextType<T> = T extends React.Context<infer ContextType> ?
                                    ContextType :
                                    T extends ISafeContext<infer OutputContextType> ?
                                    OutputContextType : never;

export interface ISafeContext<T> extends Pick<ISafeContextOptions, 'name'> {
    Provider: React.ComponentType<{
        value: T;
    }>;
    Consumer: React.ComponentType<{
        children: (value: T) => React.ReactNode;
    }>;
}

export interface ISafeContextOptions {
    name: string;
    /**
     * Executed
     */
    onError: () => React.ReactNode;
}

export const ContextFailure = createContext<React.ReactNode>(null);

export function renderArgument(input: React.ReactNode) {
    return input;
}

/**
 * By default the createSafeContext() will render whatever was provided to `ContextFailure`
 * in case of a context provider is missing, but you can easily tweak the input options to
 * change the default behavior. (See `onError` option)
 * @param data Safe context options
 */
export function createSafeContext<T>(data: Partial<ISafeContextOptions> = {}): ISafeContext<T> {
    const contextName = data.name || 'UntitledContext';
    const OriginalContext = createContext<T | undefined>(undefined);
    function Provider(props: ProviderProps<T>) {
        return <OriginalContext.Provider {...props} />;
    }
    Provider.displayName = `SafeContext(Provider(${contextName}))`;

    function renderWithContextValue(
        this: undefined,
        children: (value: T) => React.ReactNode,
        value?: T
    ) {
        if(typeof value === 'undefined') {
            if(data.onError) {
                return data.onError();
            }
            return <ContextFailure.Consumer>
                {renderArgument}
            </ContextFailure.Consumer>;
        }
        return children(value);
    }

    function Consumer({
        children,
        ...props
    }: ConsumerProps<T>) {
        return <OriginalContext.Consumer {...props}>
            {renderWithContextValue.bind(undefined, children)}
        </OriginalContext.Consumer>;
    }
    Consumer.displayName = `SafeContext(Consumer(${contextName}))`;
    return {
        name: contextName,
        Provider,
        Consumer
    };
}

export type ResolveContextMap<Map extends object> = {
    [K in keyof Map]: ExtractContextType<Map[K]>;
};

type ContextKeys = readonly string[];
type ContextsList = ReadonlyArray<React.Context<any> | ISafeContext<any>>;

type MatchProps<InjectedProps extends object, P extends object> = {
    [K in keyof P]: K extends keyof InjectedProps ? (
        InjectedProps[K] extends P[K] ? P[K] : InjectedProps[K]
    ) : P[K];
};

export function shallowIsEqual<T1 extends object, T2 extends T1>(
    a1: T1,
    a2: T2
) {
    const keys = Object.keys(a1) as Array<keyof T1>;
    if(keys.length !== Object.keys(a2).length) return false;
    for(const key of keys) {
        if(a1[key] !== a2[key]) return false;
    }
    return true;
}

interface ICombinerSnapshot {
    inputProps: any;
    contextMap: any;
    mappedProps: any;
    cachedElement: React.ReactElement<any>;
}

export function withContext<
    ContextMap extends Record<string, React.Context<any> | ISafeContext<any>>,
    /**
     * Props that are going to be omitted from component when attached
     */
    TargetProps extends object
>(
    contextMap: ContextMap,
    mapContextToProps: ((contextMap: ResolveContextMap<ContextMap>) => TargetProps)
) {
    const list: ContextsList = Object.values(contextMap);
    const keys: ContextKeys = Object.keys(contextMap);
    return function<T extends React.ComponentType<MatchProps<TargetProps, React.ComponentProps<T>>>>(
        Target: T
    ): React.ComponentType<Diff<React.ComponentProps<T>, TargetProps>> & {
        Component: T;
    } {
        type P = React.ComponentProps<T>;
        class Combiner extends React.Component<Diff<P, TargetProps>> {
            public static Component = Target;
            public static displayName = `Combined(${Target.displayName || Target.name})`;
            private snapshot?: ICombinerSnapshot;
            public render() {
                if(!list.length) return React.createElement(
                    Target,
                    this.props as P
                );
                return this.getContext(keys, list, 0, {});
            }
            public getContext(
                keys: ContextKeys,
                contextsList: ContextsList,
                index: number,
                resolvedMap: Readonly<Record<string, any>>
            ) {
                const {Consumer} = contextsList[index];
                return <Consumer>
                    {value => {
                        const newResolvedMap = {
                            ...resolvedMap,
                            [keys[index]]: value
                        };
                        if(index === (contextsList.length - 1)) {
                            const contextMap = newResolvedMap as ResolveContextMap<ContextMap>;
                            let {snapshot} = this;
                            if(!snapshot) {
                                const mappedProps = mapContextToProps(contextMap);
                                const finalProps = {
                                    ...this.props,
                                    ...mappedProps
                                } as P;
                                snapshot = {
                                    contextMap,
                                    mappedProps,
                                    inputProps: this.props,
                                    cachedElement: React.createElement(
                                        Target,
                                        finalProps
                                    )
                                };
                                return snapshot.cachedElement;
                            }
                            const contextMapChanged = !shallowIsEqual(snapshot.contextMap, contextMap);
                            const propsChanged = !shallowIsEqual(snapshot.inputProps, this.props);
                            snapshot.inputProps = this.props;
                            snapshot.contextMap = contextMap;
                            if(propsChanged && !contextMapChanged) {
                                snapshot.cachedElement = React.cloneElement(
                                    snapshot.cachedElement,
                                    {
                                        ...this.props,
                                        ...snapshot.mappedProps
                                    }
                                );
                            } else if(contextMapChanged && !propsChanged) {
                                const newMappedProps = mapContextToProps(contextMap);
                                if(!shallowIsEqual(newMappedProps, snapshot.mappedProps)) {
                                    const finalProps = {
                                        ...this.props,
                                        ...newMappedProps
                                    };
                                    snapshot.mappedProps = newMappedProps;
                                    snapshot.cachedElement = React.cloneElement(
                                        snapshot.cachedElement,
                                        finalProps
                                    );
                                }
                            } else if(contextMapChanged && propsChanged) {
                                const newMappedProps = mapContextToProps(contextMap);
                                const finalProps = {
                                    ...snapshot.inputProps,
                                    ...newMappedProps
                                };
                                snapshot.mappedProps = newMappedProps;
                                snapshot.cachedElement = React.cloneElement(
                                    snapshot.cachedElement,
                                    finalProps
                                );
                            }
                            return snapshot.cachedElement;
                        }
                        return this.getContext(
                            keys,
                            contextsList,
                            index + 1,
                            newResolvedMap
                        );
                    }}
                </Consumer>
            }
        }
        return Combiner;
    }
}
