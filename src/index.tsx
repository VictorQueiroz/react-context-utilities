import * as React from 'react';
import { ConsumerProps, createContext, ProviderProps } from "react";
import { Diff } from 'utility-types';

export type ExtractContextType<T> = T extends React.Context<infer ContextType> ?
                                    ContextType :
                                    T extends ISafeContext<infer OutputContextType> ?
                                    OutputContextType : never;

export interface ISafeContext<T> {
    Provider: React.ComponentType<{
        value: T;
    }>;
    Consumer: React.ComponentType<{
        children: (value: T) => React.ReactNode;
    }>;
}

export interface ISafeContextOptions {
    name?: string;
    /**
     * Executed
     */
    onError?: (this: ISafeContextOptions) => React.ReactNode;
}

export const ContextFailure = createContext<React.ReactNode>(null);

/**
 * By default the createSafeContext() will render whatever was provided to `ContextFailure`
 * in case of a context provider is missing, but you can easily tweak the input options to
 * change the default behavior. (See `onError` option)
 * @param data Safe context options
 */
export function createSafeContext<T>(data: ISafeContextOptions = {}): ISafeContext<T> {
    const OriginalContext = createContext<T | undefined>(undefined);
    function Provider(props: ProviderProps<T>) {
        return <OriginalContext.Provider {...props} />;
    }
    Provider.displayName = `SafeContext(Provider(${data.name}))`;

    function Consumer({
        children,
        ...props
    }: ConsumerProps<T>) {
        return <OriginalContext.Consumer {...props}>
            {(value) => {
                if(typeof value === 'undefined') {
                    if(data.onError) {
                        return data.onError();
                    }
                    return <ContextFailure.Consumer>
                        {children => children}
                    </ContextFailure.Consumer>;
                }
                return children(value);
            }}
        </OriginalContext.Consumer>;
    }
    Consumer.displayName = `SafeContext(Consumer(${data.name}))`;
    return {
        Provider,
        Consumer
    };
}

export type ResolveContextMap<Map extends object> = {
    [K in keyof Map]: ExtractContextType<Map[K]>;
};

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
    return function<P extends TargetProps>(Target: React.ComponentType<P>) {
        return class Combiner extends React.Component<Diff<P, TargetProps>> {
            public static Component = Target;
            public static displayName = `Combined(${Target.displayName || Target.name})`
            public render() {
                const list = Object.values(contextMap);
                if(!list.length) return <Target {...(this.props as P)}/>;
                return this.getContext(Object.keys(contextMap), list, 0, {});
            }
            public getContext(
                keys: string[],
                contextsList: ReadonlyArray<React.Context<any> | ISafeContext<any>>,
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
                            const finalProps = {
                                ...this.props,
                                ...mapContextToProps(contextMap)
                            } as P;
                            return <Target {...finalProps} />;
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
    }
}
