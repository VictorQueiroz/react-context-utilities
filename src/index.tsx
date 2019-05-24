import * as React from 'react';
import { ConsumerProps, createContext, ProviderProps } from "react";
import { Diff } from 'utility-types';

export type ExtractProps<T> = T extends React.ComponentClass<infer Props> ? Props :
                                                            T extends React.StatelessComponent<infer OutputProps> ?
                                                            OutputProps :
                                                            never;

export type ExtractContextType<T> = T extends React.Context<infer ContextType> ?
                                    ContextType :
                                    T extends ISafeContext<infer OutputContextType> ?
                                    OutputContextType : never;

type AcceptedReactElements<T> = (
    React.ReactNode | React.ReactElement<T> | (T extends HTMLElement ? React.ReactHTMLElement<T> : never) | null
);

export interface ISafeContext<T> {
    Provider: React.FunctionComponent<{
        value: T;
    }>;
    Consumer: React.FunctionComponent<{
        children: <R> (value: T) => AcceptedReactElements<R>;
    }>;
}

export interface ISafeContextOptions {
    name?: string;
    /**
     * Executed
     */
    onError?: <T> (this: ISafeContextOptions) => AcceptedReactElements<T>;
}

/**
 * By default the createSafeContext() will throw an warning and render null for non-available
 * context, but you can easily tweak the input options to change the default
 * behavior
 * @param data Safe context options
 */
export function createSafeContext<T>(data: ISafeContextOptions = {}): ISafeContext<T> {
    const {
        Provider,
        Consumer: UnsafeConsumer
    } = createContext<T | undefined>(undefined);
    return {
        Provider(props: ProviderProps<T>) {
            return <Provider {...props} />;
        },
        Consumer({
            children,
            ...props
        }: ConsumerProps<T>) {
            return <UnsafeConsumer {...props}>
                {(value) => {
                    if(typeof value === 'undefined') {
                        if(data.onError) {
                            return data.onError();
                        }
                        throw new Error(`Invalid value provided for ${data.name} context`);
                    }
                    return children(value);
                }}
            </UnsafeConsumer>;
        }
    };
}

export type ContextMap<T> = {
    [K in keyof T]: T extends React.Context<ExtractContextType<T[K]>> ?
                    React.Context<ExtractContextType<T[K]>> :
                    ISafeContext<ExtractContextType<T[K]>>;
};

export type CombinerFunction<T, R, P> = (
    input: {
        [K in keyof T]: ExtractContextType<T[K]>;
    },
    props: P
) => R;

export function withContext<
    T extends ContextMap<T>,
    CombinedProps extends object = {},
    /**
     * Additional properties that will be necessary to instantiate
     * the contextified component
     */
    AdditionalProps extends object = {}
>(
    map: T,
    mapContextToProps: CombinerFunction<T, CombinedProps, AdditionalProps>
) {
    return <P extends CombinedProps>(Component: React.ComponentType<P>) => {
        type ComponentProps = Diff<P, CombinedProps> & AdditionalProps;
        function getContents(index: number, parentProps: ComponentProps, props: string[], result: any) {
            const prop = props[index] as keyof T;
            const Context = map[prop];
            const { Consumer } = Context as any;

            return <Consumer>
                {(value: any) => {
                    const nextResult = {
                        ...result,
                        [prop]: value
                    };
                    if(index === (props.length - 1)) {
                        const contextProps: any = mapContextToProps(nextResult, parentProps);
                        return <Component
                            {...parentProps}
                            {...contextProps}
                        />;
                    }
                    return getContents(index + 1, parentProps, props, nextResult);
                }}
            </Consumer>;
        }
        function SafeContext(props: ComponentProps) {
            return getContents(0, props, Object.keys(map), {});
        }
        SafeContext.displayName = `SafeContext(${Component.displayName})`;
        return SafeContext;
    };
}
