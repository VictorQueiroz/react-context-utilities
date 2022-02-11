import {
    Component,
    ComponentClass,
    ComponentProps,
    ComponentPropsWithoutRef,
    ComponentType,
    ConsumerProps,
    Context,
    createContext,
    forwardRef,
    ForwardRefExoticComponent,
    PropsWithoutRef,
    ProviderProps,
    ReactNode,
    RefAttributes
} from "react";
import { Diff } from 'utility-types';

export type ExtractContextType<T> = T extends Context<infer ContextType> ?
                                    ContextType :
                                    T extends ISafeContext<infer OutputContextType> ?
                                    OutputContextType : never;

export interface ISafeContext<T> extends Pick<ISafeContextOptions, 'name'> {
    Provider: ComponentType<{
        value: T;
    }>;
    Consumer: ComponentType<{
        children: (value: T) => ReactNode;
    }>;
}

export interface ISafeContextOptions {
    name: string;
    /**
     * Executed
     */
    onError: () => ReactNode;
}

export const ContextFailure = createContext<ReactNode>(null);

export function renderArgument(input: ReactNode) {
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
        children: (value: T) => ReactNode,
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

export type ContextMapLike = Record<string, Context<any> | ISafeContext<any>>;

export type ResolveContextMap<T extends ContextMapLike> = {
    [K in keyof T]: ExtractContextType<T[K]>;
};

export type ContextKeys = readonly string[];
// export type ContextsList = ReadonlyArray<Context<any> | ISafeContext<any>>;

export type PropsLike = Record<string, unknown>;

export type MatchProps<InjectedProps extends PropsLike, P extends PropsLike> = {
    [K in keyof P]: K extends keyof InjectedProps ? (
        InjectedProps[K] extends P[K] ? P[K] : InjectedProps[K]
    ) : P[K];
};

export interface IComponentWithContext<RemoveProps extends PropsLike> {
    <T extends ComponentType<MatchProps<RemoveProps,ComponentProps<T>>>>(Target: T): ComponentType<Diff<ComponentProps<T>,RemoveProps>>;
    withForwardRef<T extends ComponentClass<MatchProps<RemoveProps,ComponentProps<T>>>>(
        Target: T
    ): ForwardRefExoticComponent<PropsWithoutRef<Diff<PropsWithoutRef<ComponentProps<T>>, RemoveProps>> & RefAttributes<InstanceType<T>>>;
}

export function withContext<
    ContextMap extends ContextMapLike = {},
    RemoveProps extends PropsLike = {}
>(
    contextMap: ContextMap,
    mapContextToProps: (contextMap: ResolveContextMap<ContextMap>) => RemoveProps
): IComponentWithContext<RemoveProps> {
    const list = Object.entries(contextMap);
    function renderContext(Target: ComponentType<any>, index: number, props: Record<string,any>, contextValues: Record<string,any>){
        const last = list.length;
        if(index === last) {
            props = {
                ...props,
                ...mapContextToProps(contextValues as ResolveContextMap<ContextMap>)
            };
            return (
                <Target {...props}/>
            );
        }
        const current = list[index];
        const {
            Consumer
        } = current[1];
        return (
            <Consumer>
                {value => {
                    contextValues = {
                        ...contextValues,
                        [current[0]]: value
                    };
                    return renderContext(Target, index + 1, props, contextValues);
                }}
            </Consumer>
        )
    }

    // let fn: IComponentWithContext<RemoveProps>;

    // fn = function(Target){
    //     return class extends Component {
    //         public static displayName = Target.displayName || Target.name;
    //         public render() {
    //             return renderContext(Target, 0,this.props, {});
    //         }
    //     }
    // };
    // fn.withForwardRef = function(Target){
    //     return forwardRef((props, ref) => {
    //         return renderContext(Target,0,{
    //             ...props,
    //             ref
    //         },{});
    //     });
    // };

    // fn = () => () => null;
    // fn.withForwardRef = (Target: any) => {
    //     return forwardRef(() => {
    //         return null;
    //     })
    // };

    function ComponentWithoutRef<
        T extends ComponentType<MatchProps<RemoveProps,ComponentProps<T>>>
    >(Target: T): ComponentType<Diff<ComponentProps<T>,RemoveProps>> {
        return class extends Component<Diff<ComponentProps<T>,RemoveProps>> {
            public static displayName = Target.displayName || Target.name;
            public render() {
                return renderContext(Target, 0,this.props, {});
            }
        }
    }

    function withForwardRef<T extends ComponentClass<MatchProps<RemoveProps,ComponentProps<T>>>>(
        Target: T
    ): ForwardRefExoticComponent<PropsWithoutRef<Diff<PropsWithoutRef<ComponentProps<T>>, RemoveProps>> & RefAttributes<InstanceType<T>>> {
        const Out = forwardRef<InstanceType<T>,Diff<ComponentPropsWithoutRef<T>,RemoveProps>>((props, ref) => {
            return renderContext(Target,0,{
                ...props,
                ref
            },{});
        });
        Out.displayName = Target.displayName || Target.name;
        return Out;
    }

    ComponentWithoutRef.withForwardRef = withForwardRef;

    return ComponentWithoutRef;
}

// export function withContext<
//     ContextMap extends Record<string, Context<any> | ISafeContext<any>>,
//     /**
//      * Props that are going to be omitted from component when attached
//      */
//     TargetProps extends PropsLike
// >(
//     contextMap: ContextMap,
//     mapContextToProps: ((contextMap: ResolveContextMap<ContextMap>) => TargetProps)
// ) {
//     const list: ContextsList = Object.values(contextMap);
//     const keys: ContextKeys = Object.keys(contextMap);

//     type ResolvedContextMap = ResolveContextMap<ContextMap>;
//     type GetFinalProps<T extends ComponentType<any>> = Diff<ComponentProps<T>, TargetProps>;

//     function getContext(map: Partial<ResolvedContextMap>, index: number, callback: (contextMap: TargetProps) => ReactElement) {
//         if(index > (list.length - 1)) {
//             return callback(Object.freeze(Object.seal(mapContextToProps(map as ResolvedContextMap))));
//         }
//         const {Consumer} = list[index];
//         return <Consumer>
//             {value => {
//                 map = Object.seal(Object.freeze({
//                     ...map,
//                     [keys[index]]: value
//                 }));
//                 return getContext(map, index + 1, callback);
//             }}
//         </Consumer>;
//     }

//     type GetExpectedComponentProps<T extends ComponentType> = MatchProps<TargetProps, ComponentProps<T>>;

//     const withForwardRef = <T extends ComponentType<GetExpectedComponentProps<T>>>(
//         Target: T
//     ) => {
//         type FinalProps = GetFinalProps<T>;
//         type ComponentInstance = T extends ComponentClass<any> ? InstanceType<T> : undefined;
//         type ComputedExpectedComponentProps = GetExpectedComponentProps<T>;
    
//         const Component = Target as ComponentType<ComputedExpectedComponentProps>;
    
//         return forwardRef<ComponentInstance, FinalProps>((props, ref) => {
//             function render(missingProps: TargetProps) {
//                 const mergedProps = {
//                     ...missingProps,
//                     ...props
//                 } as ComputedExpectedComponentProps;
//                 return (
//                     <Component
//                         {...mergedProps}
//                         ref={ref} />
//                 );
//             }
//             return getContext({}, 0, render);
//         });
//     };

//     const defaultResult = <T extends ComponentType<GetExpectedComponentProps<T>>> (Target: T): ComponentType<GetFinalProps<T>> => {
//         type ComputedExpectedComponentProps = GetExpectedComponentProps<T>;
//         type ResultInputProps = GetFinalProps<T>;
//         const Component = Target as ComponentType<ComputedExpectedComponentProps>
//         const Result: ComponentType<ResultInputProps> = function(props: ResultInputProps) {
//             function render(targetProps: TargetProps) {
//                 const mergedProps = {
//                     ...targetProps,
//                     ...props
//                 } as ComputedExpectedComponentProps;
//                 return (
//                     <Component {...mergedProps} />
//                 );
//             }
//             return getContext({}, 0, render);
//         }
//         Result.displayName = Target.displayName;
//         return Result;
//     };
//     defaultResult.withForwardRef = withForwardRef;

//     return defaultResult;
// }
