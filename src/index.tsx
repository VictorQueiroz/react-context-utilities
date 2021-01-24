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

export type ContextKeys = readonly string[];
export type ContextsList = ReadonlyArray<React.Context<any> | ISafeContext<any>>;

export type PropsLike = Record<string, unknown>;

export type MatchProps<InjectedProps extends PropsLike, P extends PropsLike> = {
    [K in keyof P]: K extends keyof InjectedProps ? (
        InjectedProps[K] extends P[K] ? P[K] : InjectedProps[K]
    ) : P[K];
};

export function withContext<
    ContextMap extends Record<string, React.Context<any> | ISafeContext<any>>,
    /**
     * Props that are going to be omitted from component when attached
     */
    TargetProps extends PropsLike
>(
    contextMap: ContextMap,
    mapContextToProps: ((contextMap: ResolveContextMap<ContextMap>) => TargetProps)
) {
    const list: ContextsList = Object.values(contextMap);
    const keys: ContextKeys = Object.keys(contextMap);

    type ResolvedContextMap = ResolveContextMap<ContextMap>;
    type GetFinalProps<T extends React.ComponentType<any>> = Diff<React.ComponentProps<T>, TargetProps>;

    function getContext(map: Partial<ResolvedContextMap>, index: number, callback: (contextMap: TargetProps) => React.ReactElement) {
        if(index > (list.length - 1)) {
            return callback(Object.freeze(Object.seal(mapContextToProps(map as ResolvedContextMap))));
        }
        const {Consumer} = list[index];
        return <Consumer>
            {value => {
                map = Object.seal(Object.freeze({
                    ...map,
                    [keys[index]]: value
                }));
                return getContext(map, index + 1, callback);
            }}
        </Consumer>;
    }

    type GetExpectedComponentProps<T extends React.ComponentType<any>> = MatchProps<TargetProps, React.ComponentProps<T>>;

    const withForwardRef = <T extends React.ComponentType<GetExpectedComponentProps<T>>>(
        Target: T
    ) => {
        type FinalProps = GetFinalProps<T>;
        type ComponentInstance = T extends React.ComponentClass<any> ? InstanceType<T> : undefined;
        type ComputedExpectedComponentProps = GetExpectedComponentProps<T>;
    
        const Component = Target as React.ComponentType<ComputedExpectedComponentProps>;
    
        return React.forwardRef<ComponentInstance, FinalProps>((props, ref) => {
            function render(missingProps: TargetProps) {
                const mergedProps = {
                    ...missingProps,
                    ...props
                } as ComputedExpectedComponentProps;
                return (
                    <Component
                        {...mergedProps}
                        ref={ref} />
                );
            }
            return getContext({}, 0, render);
        });
    };

    const defaultResult = <T extends React.ComponentType<GetExpectedComponentProps<T>>> (Target: T): React.ComponentType<GetFinalProps<T>> => {
        type ComputedExpectedComponentProps = GetExpectedComponentProps<T>;
        type ResultInputProps = GetFinalProps<T>;
        const Component = Target as React.ComponentType<ComputedExpectedComponentProps>
        const Result: React.ComponentType<ResultInputProps> = function(props: ResultInputProps) {
            function render(targetProps: TargetProps) {
                const mergedProps = {
                    ...targetProps,
                    ...props
                } as ComputedExpectedComponentProps;
                return (
                    <Component {...mergedProps} />
                );
            }
            return getContext({}, 0, render);
        }
        Result.displayName = Target.displayName;
        return Result;
    };
    defaultResult.withForwardRef = withForwardRef;

    return defaultResult;
}
