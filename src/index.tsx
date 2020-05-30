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
    type NewProps<P extends object> = Diff<P, TargetProps>;
    const list: ContextsList = Object.values(contextMap);
    const keys: ContextKeys = Object.keys(contextMap);
    return function<P extends TargetProps>(
        Target: React.ComponentType<P>
    ) {
        return class Combiner extends React.Component<NewProps<P>> {
            public static Component = Target;
            public static displayName = `Combined(${Target.displayName || Target.name})`
            public render() {
                if(!list.length) return <Target {...(this.props as P)} />;
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
