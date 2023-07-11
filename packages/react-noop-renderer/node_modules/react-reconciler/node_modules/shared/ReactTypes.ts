export type Ref = { current: any } | ((instance: any) => void);
export type ElementType = any;
export type Key = string | null;
export type Props = {
	[key: string]: any;
	children?: any;
};

export interface ReactElementType {
	$$typeof: symbol | number;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
	__mark: 'kt';
}

export type Action<State> = State | ((prevState: State) => State);
